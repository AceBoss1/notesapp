"use client";

import { useEffect, useRef, useState } from "react";
import { collection, getDocs, limitToLast, orderBy, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { setting } from "@/lib/config";
import { LIVE_FALLBACK_AFTER, liveSocketUrl, reconnectDelay, type LiveChat, type LiveClientMsg, type LiveHand, type LiveServerMsg } from "@/lib/live-rooms";
import type { LiveRole } from "@/lib/live-token";
import type { RoomChat, RoomDoc, StageMode } from "@/lib/rooms";
import { capi } from "./api";

// A relay room's chat and live signals over the live-rooms worker (lib/live-rooms.ts, v0.127.0): one WebSocket to the room's Durable
// Object for the chat, the live listener count, raised hands and stage/video signals (camera on/off is decided by our server and only
// mirrored here), so nobody reads Firestore for every message.
// Used only when NEXT_PUBLIC_LIVE_ROOMS_URL is set and the room was opened on the worker (room.edge); otherwise `on` is false and the
// room screen keeps its Firestore path unchanged. The socket reconnects with backoff (a fresh 10-minute token each time, from
// /api/community/rooms action "livetoken"); after LIVE_FALLBACK_AFTER failures in a row `status` is "fallback": the chat is polled from
// Firestore (only what's new, every POLL_MS) and sent through the server, and the count comes from the room doc, while it keeps trying.
export type LiveStatus = "off" | "connecting" | "live" | "fallback";
export type LiveChannel = {
  on: boolean; status: LiveStatus;
  count: number | null; // listeners connected now (null: use the room doc's count)
  hands: Record<string, LiveHand> | null; // null: use the room doc's hands
  video: Record<string, boolean>; // cameras up (our server decides: lib/rooms-live-server.ts; the room doc's videoOn stays the truth)
  msgs: LiveChat[]; slow: number; hostSlow: boolean | null;
  you: { role: LiveRole; mod: boolean; muted: boolean } | null;
  mutedList: string[]; // the host and moderators: who is muted in the chat (to unmute)
  // The stage (lib/rooms.ts "Stage seats"), as the worker last said; the room doc stays the truth and is used whenever these are null.
  stageMode: StageMode | null; mics: Record<string, boolean> | null; invite: { on: boolean; by?: string } | null;
  err: string; gone: string; // the last refusal (slow mode, rate), and why the room closed on us (ended, removed)
  send: (text: string) => boolean; // false: not connected (send through the server instead)
  remove: (id: string) => boolean; raise: (up: boolean) => boolean;
  mute: (uid: string, on: boolean) => boolean; ban: (uid: string) => boolean; setSlow: (on: boolean | null) => boolean;
};
const POLL_MS = 10_000;
const MSGS_MAX = 200;
const PING_MS = 30_000;
const byId = (list: LiveChat[]) => [...new Map(list.map((m) => [m.id, m])).values()].sort((a, b) => a.id.localeCompare(b.id)).slice(-MSGS_MAX);

export function useLiveChannel(id: string, me: string, room: RoomDoc | null): LiveChannel {
  const base = (setting("NEXT_PUBLIC_LIVE_ROOMS_URL") ?? "").trim();
  const on = !!base && room?.mode === "relay" && !!room.edge;
  const [status, setStatus] = useState<LiveStatus>("off");
  const [count, setCount] = useState<number | null>(null);
  const [hands, setHands] = useState<Record<string, LiveHand> | null>(null);
  const [video, setVideo] = useState<Record<string, boolean>>({});
  const [msgs, setMsgs] = useState<LiveChat[]>([]);
  const [slow, setSlow] = useState(0);
  const [hostSlow, setHostSlow] = useState<boolean | null>(null);
  const [you, setYou] = useState<LiveChannel["you"]>(null);
  const [mutedList, setMutedList] = useState<string[]>([]);
  const [err, setErr] = useState("");
  const [gone, setGone] = useState("");
  const [stageMode, setStageMode] = useState<StageMode | null>(null);
  const [mics, setMics] = useState<Record<string, boolean> | null>(null);
  const [invite, setInvite] = useState<{ on: boolean; by?: string } | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!on) { setStatus("off"); return; }
    let stop = false, fails = 0, ws: WebSocket | null = null;
    let retry: ReturnType<typeof setTimeout> | undefined, ping: ReturnType<typeof setInterval> | undefined, poll: ReturnType<typeof setInterval> | undefined, errTimer: ReturnType<typeof setTimeout> | undefined;
    let lastAt = "";
    // The Firestore fallback: what's new in the server-written chat, every POLL_MS (one read per new message, not a live read).
    const pollOnce = async () => {
      const col = collection(db, "communityRooms", id, "chat");
      const snap = await getDocs(lastAt ? query(col, where("at", ">", lastAt), orderBy("at"), limitToLast(MSGS_MAX)) : query(col, orderBy("at"), limitToLast(50))).catch(() => null);
      if (!snap || stop) return;
      const got = snap.docs.map((d) => ({ ...(d.data() as RoomChat), id: d.id }));
      if (got.length) { lastAt = got[got.length - 1].at; setMsgs((cur) => byId([...cur, ...got])); }
    };
    const fallback = (yes: boolean) => {
      clearInterval(poll); poll = undefined;
      if (yes) { setStatus("fallback"); setCount(null); setHands(null); void pollOnce(); poll = setInterval(pollOnce, POLL_MS); }
    };
    const fail = () => {
      if (stop) return;
      fails += 1;
      if (fails >= LIVE_FALLBACK_AFTER) fallback(true); else setStatus((s) => (s === "fallback" ? s : "connecting"));
      retry = setTimeout(connect, reconnectDelay(fails));
    };
    const handle = (m: LiveServerMsg) => {
      switch (m.t) {
        case "hello":
          fails = 0; fallback(false); setStatus("live");
          setYou(m.you); setMutedList(m.mutedList ?? []); setCount(m.count); setHands(m.hands); setVideo(m.video); setSlow(m.slow); setHostSlow(m.hostSlow);
          setMsgs((cur) => byId([...cur, ...m.recent]));
          setStageMode(m.stageMode ?? null); setMics(Object.fromEntries((m.mics ?? []).map((u) => [u, true])));
          return;
        case "stagemode": setStageMode(m.mode); return;
        case "mic": setMics((cur) => { const next = { ...(cur ?? {}) }; if (m.on) next[m.uid] = true; else delete next[m.uid]; return next; }); return;
        case "invite": setInvite({ on: m.on, ...(m.by ? { by: m.by } : {}) }); return;
        case "chat": setMsgs((cur) => byId([...cur, m.m])); return;
        case "del": setMsgs((cur) => cur.filter((x) => x.id !== m.id)); return;
        case "count": setCount(m.n); return;
        case "hand": setHands((cur) => { const next = { ...(cur ?? {}) }; if (m.up) next[m.uid] = { name: m.name ?? "", avatar: m.avatar ?? "", at: m.at ?? new Date().toISOString() }; else delete next[m.uid]; return next; }); return;
        case "video": setVideo((cur) => { const next = { ...cur }; if (m.on) next[m.uid] = true; else delete next[m.uid]; return next; }); return;
        case "stage": if (m.uid === me) setYou((y) => (y ? { ...y, role: m.role } : y)); return;
        case "slow": setSlow(m.slow); setHostSlow(m.hostSlow); return;
        case "muted":
          if (m.uid === me) setYou((y) => (y ? { ...y, muted: m.on } : y));
          setMutedList((cur) => (m.on ? [...new Set([...cur, m.uid])] : cur.filter((u) => u !== m.uid)));
          return;
        case "err": setErr(m.msg); clearTimeout(errTimer); errTimer = setTimeout(() => setErr(""), 4000); return;
        case "ended": setGone("The room has ended."); return;
        default: return;
      }
    };
    async function connect() {
      if (stop) return;
      let t: { url: string; token: string };
      try { t = await capi<{ url: string; token: string }>("/api/community/rooms", { action: "livetoken", id }); }
      catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (/removed from this room/i.test(msg)) { setGone(msg); stop = true; fallback(true); return; }
        fail(); return;
      }
      if (stop) return;
      try { ws = new WebSocket(liveSocketUrl(t.url || base, id, t.token)); } catch { fail(); return; }
      wsRef.current = ws;
      const mine = ws;
      mine.onmessage = (e) => { try { handle(JSON.parse(String(e.data)) as LiveServerMsg); } catch { /* not ours */ } };
      mine.onclose = (e) => {
        if (wsRef.current === mine) wsRef.current = null;
        clearInterval(ping);
        if (stop) return;
        if (e.code === 4000) { setGone("The room has ended."); return; }
        if (e.code === 4003) { setGone("You've been removed from this room."); stop = true; return; }
        fail();
      };
      // The worker answers "ping" without waking the room (hibernation); it keeps proxies from closing a quiet socket.
      clearInterval(ping);
      ping = setInterval(() => { if (mine.readyState === WebSocket.OPEN) mine.send("ping"); }, PING_MS);
    }
    setStatus("connecting");
    void connect();
    return () => { stop = true; clearTimeout(retry); clearInterval(ping); clearInterval(poll); clearTimeout(errTimer); ws?.close(1000); wsRef.current = null; };
  }, [on, id, me, base]);

  const out = (m: LiveClientMsg) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return false;
    ws.send(JSON.stringify(m));
    return true;
  };
  return {
    on, status, count, hands, video, msgs, slow, hostSlow, you, mutedList, err, gone, stageMode, mics, invite,
    send: (text) => out({ t: "chat", text }),
    remove: (mid) => out({ t: "del", id: mid }),
    raise: (up) => out({ t: "hand", up }),
    mute: (uid, v) => out({ t: "mute", uid, on: v }),
    ban: (uid) => out({ t: "ban", uid }),
    setSlow: (v) => out({ t: "slow", on: v }),
  };
}
