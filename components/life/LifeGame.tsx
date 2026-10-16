"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { startCheckout } from "@/lib/checkout";
import * as C from "@/lib/life/catalog";
import type { InviteRow, LifePlayer } from "@/lib/life/server";
import { CHAT_SOCIAL, advance, applyNeeds, chatSocial, fridgeCold, mood, needsLow, powerSource, powerStep, type Activity, type SaveState } from "@/lib/life/play";
import { loadSave, restorePoint, restorePoints, saveCloud, saveLocal, type RestorePoint } from "./save";
import { createWorld, type Power, type RoomSpot, type SceneSpec, type Tag, type World } from "./world";
import { announce, hide, setShowMe, showMe, whoIsHere, type Present, type PresencePlace } from "./presence";
import { TOPICS, chatWith, say as chatSay, type Line as ChatLine, type Topic } from "./chats";
import VipPano from "./VipPano";
import FriendChat, { type ChatFriend } from "./FriendChat";
import { Sound, loadSoundPrefs, saveSoundPrefs, type Ambience, type Sfx, type SoundPrefs } from "./sound";

type Player = LifePlayer & { cooking: number; swimming: number; serverNow: number };
type Panel =
  | "welcome" | "needs" | "sleep" | "desk" | "outfit" | "cook" | "deal" | "go" | "food" | "hotel" | "phone" | "jobs" | "friends"
  | "invite" | "bank" | "rich" | "settings" | "ebike" | "nepa" | "power" | "itel" | "product" | "business" | "kitchen" | "arrive" | "hotelpool" | "vip" | "dw" | { shop: C.ItemCat } | { chat: string } | { player: Present }
  | { jobs: C.Brand } | { partner: "chef_adams" | "itel" } | { outlet: C.OutletKind } | null;
type Toast = { text: string; share?: string; tone?: "ok" | "warn" } | null;
type Friend = { uid: string; username: string; name: string; avatar: string; plays: boolean; netWorth: number };
type RichRow = { rank: number; uid: string; username: string; name: string; avatar: string; city: string; netWorth: number; owned: string[]; npc?: { role: string; area: string; icons: string } };
type RichData = { rows: RichRow[]; me: { rank: number | null; realRank?: number | null; netWorth: number } | null };

const OUTFITS = ["#f59e0b", "#e53935", "#2563eb", "#16a34a", "#7c3aed", "#0f766e", "#111827", "#f472b6"];
const NOTESAPP_HOME = "https://app.notesapp.name.ng/journals"; // "Back to NotesApp": the app's journal feed
const WA = (text: string, phone?: string) => `https://wa.me/${phone ?? ""}?text=${encodeURIComponent(text)}`;
const ngPhone = (tel: string) => { const d = tel.replace(/\D/g, ""); return d.startsWith("0") && d.length === 11 ? `234${d.slice(1)}` : d; };

async function call<T>(user: User, method: "GET" | "POST", body?: object, q = ""): Promise<T> {
  const r = await fetch(`/api/life${q}`, { method, headers: { Authorization: `Bearer ${await user.getIdToken()}`, ...(body ? { "Content-Type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined, cache: "no-store" });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || "Something went wrong. Try again.");
  return j as T;
}

export default function LifeGame() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [player, setPlayer] = useState<Player | null>(null);
  const [save, setSave] = useState<SaveState | null>(null);
  const [panel, setPanel] = useState<Panel>(null);
  const [toast, setToast] = useState<Toast>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [tags, setTags] = useState<Tag[]>([]);
  const [spot, setSpot] = useState<RoomSpot>("rug");
  const [savedAt, setSavedAt] = useState(0);
  const [, setNow] = useState(Date.now());
  // What the bigger panels hold (destination, food order, lists): kept here so the once-a-second re-render doesn't reset it, and loaded
  // once each time a panel opens.
  const [goTo, setGoTo] = useState<C.PlaceId | null>(null);
  const [foodMode, setFoodMode] = useState<C.FoodMode>("delivery");
  const [cart, setCart] = useState<Record<string, number>>({ combo: 1 });
  const [friendList, setFriendList] = useState<Friend[] | null>(null);
  // Chatting with a friend inside the game (components/life/FriendChat.tsx), and what each friend has sent that you haven't read.
  const [fchat, setFchat] = useState<ChatFriend | null>(null);
  const [dwTab, setDwTab] = useState<"courses" | "certs" | "jobs">("courses");
  const [chatGains, setChatGains] = useState<{ after: string; text: string }[]>([]);
  const [unreadBy, setUnreadBy] = useState<Record<string, number>>({});
  const [picked, setPicked] = useState<{ name: string; tel: string }[]>([]);
  const [inviteList, setInviteList] = useState<{ invites: InviteRow[]; paid: number } | null>(null);
  const [bankLines, setBankLines] = useState<{ id: string; amount: number; label: string; at: number }[] | null>(null);
  const [buyAmt, setBuyAmt] = useState(1_000);
  const [rich, setRich] = useState<RichData | null>(null);
  const [richReal, setRichReal] = useState(false);
  const [others, setOthers] = useState<Present[]>([]);
  const [chat, setChat] = useState<ChatLine[]>([]);
  const [showMeOn, setShowMeOn] = useState(true);
  const [richPop, setRichPop] = useState(false);
  const [points, setPoints] = useState<RestorePoint[] | null>(null);
  const [outletArea, setOutletArea] = useState<C.OutletArea>("wuse");
  const [keepFood, setKeepFood] = useState(false);
  const panelKey = typeof panel === "string" ? panel : null;
  useEffect(() => {
    if (!user || !panelKey) return;
    if (panelKey === "go") setGoTo(null);
    if (panelKey === "food") { setFoodMode(saveRef.current?.place === "chef" ? "dinein" : "delivery"); setCart({ combo: 1 }); }
    if (panelKey === "invite") { setPicked([]); setInviteList(null); call<{ invites: InviteRow[]; paid: number }>(user, "GET", undefined, "?view=invites").then(setInviteList).catch(() => setInviteList({ invites: [], paid: 0 })); }
    if (panelKey === "friends") { setFriendList(null); call<{ friends: Friend[] }>(user, "GET", undefined, "?view=friends").then((r) => setFriendList(r.friends)).catch(() => setFriendList([])); }
    if (panelKey === "bank") { setBankLines(null); call<{ lines: { id: string; amount: number; label: string; at: number }[] }>(user, "GET", undefined, "?view=tx").then((r) => setBankLines(r.lines)).catch(() => setBankLines([])); }
    if (panelKey === "rich") { setRich(null); setRichPop(!saveRef.current?.seenRich); call<RichData>(user, "GET", undefined, `?view=rich${richReal ? "&real=1" : ""}`).then(setRich).catch(() => setRich({ rows: [], me: null })); }
    if (panelKey === "settings") { setPoints(null); restorePoints(user.uid).then(setPoints).catch(() => setPoints([])); }
  }, [panelKey, user, richReal]);
  const chatId = panel && typeof panel === "object" && "chat" in panel ? panel.chat : null;
  useEffect(() => { if (user && chatId) setChat(chatWith(user.uid, chatId)); }, [user, chatId]);
  useEffect(() => { setShowMeOn(showMe()); }, []);
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === "Escape") setPanel(null); }; window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, []);
  const canvas = useRef<HTMLCanvasElement>(null);
  const world = useRef<World | null>(null);
  const saveRef = useRef<SaveState | null>(null);
  const playerRef = useRef<Player | null>(null);
  const offset = useRef(0); // server clock minus this device's clock
  const lastCloud = useRef(0);
  const lastPowerAt = useRef(0);
  const wasOut = useRef<boolean | null>(null);
  saveRef.current = save; playerRef.current = player;

  // ---- sound (components/life/sound.ts): made in the browser, volumes kept on this device ----
  const snd = useRef<Sound | null>(null);
  const [soundPrefs, setSoundPrefs] = useState<SoundPrefs>(() => loadSoundPrefs());
  if (!snd.current && typeof window !== "undefined") snd.current = new Sound(soundPrefs);
  const sfx = (n: Sfx) => snd.current?.play(n);
  useEffect(() => () => { snd.current?.dispose(); snd.current = null; }, []);
  useEffect(() => { snd.current?.setPrefs(soundPrefs); saveSoundPrefs(soundPrefs); }, [soundPrefs]);
  useEffect(() => {
    const vis = () => (document.visibilityState === "hidden" ? snd.current?.pause() : snd.current?.resume());
    document.addEventListener("visibilitychange", vis);
    return () => document.removeEventListener("visibilitychange", vis);
  }, []);

  const say = useCallback((text: string, share?: string, tone: "ok" | "warn" = "ok") => { if (tone === "warn") snd.current?.play("warn"); setToast({ text, share, tone }); window.setTimeout(() => setToast((t) => (t?.text === text ? null : t)), share ? 9000 : 4500); }, []);
  const shareText = useCallback((text: string) => (player ? `${text} Play Notes Life with me: ${C.inviteLink(player.username)}` : text), [player]);
  const gotPlayer = (p: Player) => {
    const prev = playerRef.current;
    if (prev && p.naira > prev.naira) sfx("coin"); else if (prev && p.naira < prev.naira) sfx("pay");
    offset.current = p.serverNow - Date.now(); setPlayer(p);
  };
  const update = (f: (s: SaveState) => SaveState) => setSave((s) => (s ? f(s) : s));

  // ---- friends: who follows each other (loaded once at the start, again when the Friends panel opens) and their unread messages ----
  const friendsRef = useRef<Map<string, Friend>>(new Map());
  useEffect(() => { friendsRef.current = new Map((friendList ?? []).map((f) => [f.uid, f])); }, [friendList]);
  useEffect(() => {
    if (!user) return;
    call<{ friends: Friend[] }>(user, "GET", undefined, "?view=friends").then((r) => setFriendList((cur) => cur ?? r.friends)).catch(() => {});
  }, [user]);
  // Your conversations, live (the same listener as the site menu's unread count). A friend's unread going up means they wrote: Social +4.
  useEffect(() => {
    if (!user || !C.LIFE_LIVE) return;
    const uid = user.uid;
    let prev: Record<string, number> | null = null;
    return onSnapshot(query(collection(db, "conversations"), where("participants", "array-contains", uid)), (snap) => {
      const next: Record<string, number> = {};
      for (const d of snap.docs) {
        const c = d.data();
        if (c.kind === "group") continue;
        const other = (c.participants as string[]).find((x) => x !== uid);
        if (other) next[other] = Number(c.unread?.[uid] ?? 0);
      }
      if (prev) for (const [other, n] of Object.entries(next)) {
        const f = friendsRef.current.get(other);
        if (f && n > (prev[other] ?? 0)) chatGain("reply", f.name.split(" ")[0]);
      }
      prev = next;
      setUnreadBy(next);
    }, () => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);
  function chatGain(kind: "send" | "here" | "reply", first: string, after?: string) {
    const cur = saveRef.current;
    if (!cur) return;
    const r = chatSocial(cur, kind);
    update((x) => chatSocial(x, kind).save);
    const label = kind === "reply" ? `${first} replied` : kind === "here" ? "same place" : "";
    const text = r.gain ? `💬 +${r.gain} Social${label ? ` · ${label}` : ""}` : `💬 Social maxed for this hour (${CHAT_SOCIAL.perHour})`;
    if (after) setChatGains((g) => [...g.slice(-20), { after, text }]);
    if (kind === "reply") say(r.gain ? `💬 ${first} sent you a message · Social +${r.gain}` : `💬 ${first} sent you a message`);
    else if (r.gain) say(`💬 Social +${r.gain}`);
  }
  const friendUnread = (friendList ?? []).reduce((n, f) => n + (unreadBy[f.uid] ?? 0), 0);
  const openChat = (f: ChatFriend) => { setPanel(null); setChatGains([]); setFchat(f); };

  // ---- sign-in, load ----
  useEffect(() => {
    const ref = new URLSearchParams(location.search).get("ref");
    if (ref) try { localStorage.setItem("notesLife:ref", ref); } catch { /* fine */ }
    return onAuthStateChanged(auth, setUser);
  }, []);
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        let ref = ""; try { ref = localStorage.getItem("notesLife:ref") || ""; } catch { /* fine */ }
        const [{ player: p }, loaded] = await Promise.all([call<{ player: Player }>(user, "GET", undefined, ref ? `?ref=${encodeURIComponent(ref)}` : ""), loadSave(user.uid)]);
        gotPlayer(p);
        const resumed = advance(loaded.state, Date.now(), false); // time away doesn't make you hungrier; what finished while you were away is applied
        let s = resumed.s;
        if (!s.seenWelcome) setPanel("welcome");
        // A shift that ended while you were away is paid now.
        if (p.shift) {
          const ends = p.shift.endsAt - offset.current;
          s = { ...s, activity: { kind: "shift", label: `At work: ${C.JOB(p.shift.jobId)?.title ?? "shift"}`, icon: "💼", startedAt: p.shift.startedAt - offset.current, endsAt: ends } };
        }
        setSave(s);
      } catch (e) { setErr(e instanceof Error ? e.message : "Couldn't open Notes Life."); }
    })();
  }, [user]);

  // ---- the 3D world ----
  useEffect(() => {
    if (!canvas.current || !save || world.current) return;
    const w = createWorld(canvas.current);
    world.current = w;
    const off = w.onTags(setTags);
    return () => { off(); w.dispose(); world.current = null; };
  }, [save !== null]); // eslint-disable-line react-hooks/exhaustive-deps

  const night = C.worldTime(Date.now() + offset.current).night;
  // NEPA: the same blackout for everyone (lib/life/catalog.ts nepaAt), and what powers your room through it.
  const nepa = C.nepaAt(Date.now() + offset.current);
  const src = save && player ? powerSource(save, nepa.out, player.owned) : "grid";
  const roomPower: Power = src === "grid" ? "grid" : src === "gen" ? "gen" : src === "go" ? "go" : src === "tank" ? "tank" : "out";
  const mine = (player?.outlets ?? []).map((o) => ({ kind: o.kind, owner: player!.name.split(" ")[0] }));
  const mineKey = mine.map((m) => m.kind).join();
  const vipKey = C.vipsAt(Date.now() + offset.current).in.join() + (C.cynthiaAt(Date.now() + offset.current) ?? "");
  const othersKey = others.map((o) => o.uid + o.outfit).join();
  const spec: SceneSpec | null = useMemo(() => {
    if (!save || !player) return null;
    const a = save.activity;
    const o = others.map((x) => ({ uid: x.uid, outfit: x.outfit }));
    if (a?.kind === "travel") return { id: "street", outfit: save.outfit, night, riding: a.icon === "🛵" ? "ebike" : null, others: o };
    const vips = C.vipsAt(Date.now() + offset.current).in;
    if (a?.kind === "hotel" && /Swimming|lesson|Pool bar|VIP bar|Gym/.test(a.label)) return { id: "hotel", outfit: save.outfit, others: o, night, view: "pool", swim: /Swimming|lesson/.test(a.label), vips };
    if (save.place === "chef") return { id: "chef", outfit: save.outfit, night, others: o, mine };
    if (save.place === "itel") return { id: "itel", outfit: save.outfit, night, others: o, mine };
    if (save.place === "hotel") return { id: "hotel", outfit: save.outfit, others: o, night, vips: C.vipsAt(Date.now() + offset.current).in };
    if (save.place === "dw") return { id: "dw", outfit: save.outfit, others: o, night, cynthia: C.cynthiaAt(Date.now() + offset.current) === "dw", learning: a?.kind === "class" };
    if (save.place === "work") return { id: "street", outfit: save.outfit, night, riding: player.owned.includes("ebike") ? "ebike" : null, others: o };
    return { id: "room", owned: player.owned, rug: save.rug, outfit: save.outfit, night, ringing: player.deal?.state === "offered", at: spot, sleeping: a?.kind === "sleep", power: roomPower };
  }, [save?.place, save?.activity?.kind, save?.activity?.label, save?.outfit, save?.rug, player?.owned.join(), player?.deal?.state, night, spot, roomPower, othersKey, mineKey, vipKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Where you are, for other players (lifePresence), and who else is here: every 45 s, and when you move.
  const presencePlace: PresencePlace | null = !save ? null : save.activity?.kind === "travel" ? "ride" : (save.place as PresencePlace);
  useEffect(() => {
    if (!user || !presencePlace) return;
    let alive = true;
    const tick = async () => {
      void announce(user.uid, presencePlace, saveRef.current?.outfit ?? "#64748b");
      const list = await whoIsHere(user.uid, presencePlace);
      if (alive) setOthers(list);
    };
    void tick();
    const t = window.setInterval(tick, 45_000);
    return () => { alive = false; window.clearInterval(t); };
  }, [user, presencePlace, showMeOn]);
  useEffect(() => { if (spec && world.current) void world.current.show(spec); }, [spec]);
  // What you hear around you, and the bedside phone while a deal call waits.
  const ambience: Ambience = !spec ? "none" : spec.id === "room" ? (night ? "room-night" : "room") : spec.id === "street" || spec.id === "chef" || spec.id === "dw" ? (night ? "street-night" : "street") : spec.id === "hotel" ? (spec.view === "pool" ? "pool" : "hotel") : "pool";
  useEffect(() => { snd.current?.ambience(ambience); }, [ambience]);
  useEffect(() => { snd.current?.generators(src === "gen" && save?.place === "home" ? (player?.owned.includes("gen_big") ? "big" : "small") : null, nepa.out); }, [src, save?.place, nepa.out, player?.owned]); // eslint-disable-line react-hooks/exhaustive-deps
  const ringing = player?.deal?.state === "offered" && save?.place === "home";
  useEffect(() => { snd.current?.ringing(!!ringing); }, [ringing]);

  // ---- the game loop: every second ----
  const finishShift = useCallback(async () => {
    if (!user) return;
    try {
      const r = await call<{ player: Player; result: { pay: number; extra?: number; extraLabel?: string | null; meal?: number; firstShift?: boolean; referralBonus?: string } }>(user, "POST", { action: "shift_finish" });
      gotPlayer(r.player);
      sfx("success");
      if (r.result.meal) setSave((x) => (x ? { ...x, needs: applyNeeds(x.needs, { hunger: r.result.meal }) } : x));
      if (r.result.extra) say(`Shift done: ${C.fmtN(r.result.pay)} paid, with ${C.fmtN(r.result.extra)} in ${(r.result.extraLabel ?? "extras").toLowerCase()}.${r.result.meal ? ` Staff meal: Hunger +${r.result.meal}.` : ""}`);
      else if (r.result.meal) say(`Shift done: ${C.fmtN(r.result.pay)} paid. Staff meal: Hunger +${r.result.meal}.`);
      else if (r.result.firstShift) say(`First shift done: ${C.fmtN(r.result.pay)} earned!`, shareText(`I just finished my first shift in Notes Life and earned ${C.fmtN(r.result.pay)} 💼`));
      else say(`Shift done: ${C.fmtN(r.result.pay)} paid.`);
      if (r.result.referralBonus === "paid") window.setTimeout(() => sfx("bonus"), 4600);
      if (r.result.referralBonus === "paid") window.setTimeout(() => say("🎁 Welcome bonus: Bonus Credits added to your NotesApp wallet, and to your friend's."), 4600);
    } catch (e) { say(e instanceof Error ? e.message : "Couldn't finish the shift.", undefined, "warn"); }
  }, [user, say, shareText]);

  useEffect(() => {
    if (!save || !user) return;
    const t = window.setInterval(() => {
      const s = saveRef.current; if (!s) return;
      const now = Date.now();
      const r = advance(s, now, true);
      // Power through blackouts, and NEPA's comings and goings.
      const p0 = playerRef.current;
      if (p0) {
        const n0 = C.nepaAt(now + offset.current);
        const deskWork = r.s.activity?.kind === "shift" && C.JOB(p0.jobId ?? "")?.place === "home";
        r.s = powerStep(r.s, now - (lastPowerAt.current || now), { out: n0.out, owned: p0.owned, night: C.worldTime(now + offset.current).night, deskWork });
        lastPowerAt.current = now;
        if (n0.out && r.s.nepaSeen !== n0.id) {
          r.s = { ...r.s, nepaSeen: n0.id };
          sfx("nepa_off");
          say("⚡ NEPA has taken light! Mama Nkechi: “Ah! NEPA don take light again o!”", undefined, "warn");
          setPanel((cur) => cur ?? "nepa");
        }
        if (wasOut.current && !n0.out) { sfx("up_nepa"); say("💡 Nwiiiii… UP NEPA! Light has returned. “Shhhh! Before dem hear and take am again!”"); r.s = { ...r.s, genOn: false }; }
        wasOut.current = n0.out;
      }
      if (r.s.spoiledAt > s.spoiledAt) say(r.s.plates === 0 && !p0?.owned.includes("fridge") ? "🤢 Your stored food spoiled: 8 game hours without a fridge. A fridge keeps it fresh." : "🤢 Your stored food spoiled: the fridge was off for 8 game hours. A Power Tank 1000 keeps it cold through a blackout.", undefined, "warn");
      setSave(r.s); setNow(now);
      if (r.delivered) sfx("door");
      if (r.delivered > 0) say(`🛵 Your Chef Adams order arrived. Hunger +${r.delivered}.`);
      if (r.delivered < 0) say(`🛵 Your Chef Adams order arrived: ${-r.delivered} plate${r.delivered === -1 ? "" : "s"} put away for later.`);
      const f = r.finished;
      if (f) {
        if (f.kind !== "shift") sfx("done");
        if (f.kind === "shift") void finishShift();
        else if (f.kind === "travel") {
          say(`You've arrived: ${C.PLACES.find((p) => p.id === f.to)?.name ?? "there"}.`);
          const p = playerRef.current;
          if (f.icon === "🚲" && p && !p.owned.includes("ebike") && r.s.bikeRides >= C.EBIKE_PROMPT_AFTER && now - r.s.ebikeAskedAt > 6 * 3_600_000) { setSave((x) => (x ? { ...x, ebikeAskedAt: now } : x)); setPanel((cur) => cur ?? "ebike"); }
        } else if (f.kind === "cook") say(`${f.label.replace("Cooking: ", "")} is ready. Tap the cooker to eat.`);
        else if (f.kind !== "wait") say(`${f.icon} Done: ${f.label.replace(/…$/, "")}.`);
      }
      if (now - (Number(localStorage.getItem("notesLife:localAt")) || 0) > 5_000) { saveLocal(user.uid, r.s, now); try { localStorage.setItem("notesLife:localAt", String(now)); } catch { /* fine */ } }
      if (now - lastCloud.current > 30_000) { lastCloud.current = now; saveCloud(user.uid, r.s, now).then(() => setSavedAt(Date.now())).catch(() => {}); }
    }, 1000);
    const hide = () => { const s = saveRef.current; if (document.visibilityState === "hidden" && s) { saveLocal(user.uid, s); saveCloud(user.uid, s).then(() => setSavedAt(Date.now())).catch(() => {}); } };
    document.addEventListener("visibilitychange", hide);
    return () => { window.clearInterval(t); document.removeEventListener("visibilitychange", hide); };
  }, [save !== null, user, finishShift, say]); // eslint-disable-line react-hooks/exhaustive-deps
  // Back to NotesApp: save first (the device save at once, the account save for up to 1.5 s), then go.
  const leave = useCallback(async () => {
    const s = saveRef.current;
    if (user && s) { saveLocal(user.uid, s); await Promise.race([saveCloud(user.uid, s).catch(() => {}), new Promise((r) => setTimeout(r, 1500))]); }
    window.location.assign(NOTESAPP_HOME);
  }, [user]);
  // Saves right after the change that asked for it has rendered (saveRef only has the new state from then).
  const saveNow = useCallback(() => { window.setTimeout(() => { const s = saveRef.current; if (user && s) { saveLocal(user.uid, s); lastCloud.current = Date.now(); saveCloud(user.uid, s).then(() => setSavedAt(Date.now())).catch(() => {}); } }, 0); }, [user]);

  // ---- the bedside phone rings now and then (the server decides) ----
  useEffect(() => {
    if (!user || !player) return;
    const t = window.setInterval(async () => {
      const p = playerRef.current, s = saveRef.current;
      if (!p || !s || p.deal || s.place !== "home" || s.activity?.kind === "sleep") return;
      const every = (C.bestOwned(p.owned, "phone")?.dealEveryHours ?? 8) * C.GAME_HOUR_MS;
      if (Date.now() + offset.current - p.lastDealAt < every) return;
      try {
        const r = await call<{ player: Player; result: { deal: LifePlayer["deal"] } }>(user, "POST", { action: "deal_ring" });
        gotPlayer(r.player);
        if (r.result.deal) { say(`☎️ Your bedside phone is ringing: ${r.result.deal.who}.`); setPanel((cur) => cur ?? "deal"); }
      } catch { /* try again later */ }
    }, 20_000);
    return () => window.clearInterval(t);
  }, [user, player !== null, say]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- actions ----
  async function act<T = Record<string, unknown>>(body: object): Promise<T | null> {
    if (!user) return null;
    setBusy(true); setErr(null);
    try { const r = await call<{ player: Player; result: T }>(user, "POST", body); gotPlayer(r.player); return r.result; }
    catch (e) { setErr(e instanceof Error ? e.message : "That didn't work."); return null; }
    finally { setBusy(false); }
  }
  function start(a: Omit<Activity, "startedAt" | "endsAt">, minutes: number) {
    const s = saveRef.current; if (!s) return false;
    if (s.activity) { say(`Finish what you're doing first: ${s.activity.label}`, undefined, "warn"); return false; }
    const pl = playerRef.current, n0 = C.nepaAt(Date.now() + offset.current);
    if (a.kind === "read" && pl && n0.out && C.worldTime(Date.now() + offset.current).night && powerSource(s, true, pl.owned) === "none") { say("It's too dark: NEPA has taken light. Use a Power GO or a generator, or wait for light.", undefined, "warn"); setPanel("nepa"); return false; }
    const now = Date.now();
    update((x) => ({ ...x, activity: { ...a, startedAt: now, endsAt: now + C.gameMinutesToMs(minutes) } }));
    setPanel(null);
    const k = a.kind;
    sfx(k === "bath" || k === "wc" ? "water" : k === "eat" || k === "dinein" ? "eat" : k === "cook" ? "sizzle" : k === "sleep" ? "sleep" : k === "read" ? "page" : k === "hotel" ? "door" : k === "travel" ? (a.icon === "🚲" ? "bell" : a.icon === "🛵" || a.icon === "🚙" ? "whoosh" : "horn") : "tap");
    return true;
  }
  function stop() {
    const s = saveRef.current; if (!s?.activity) return;
    if (s.activity.kind === "shift") { if (!confirm("Stop your shift now? You won't be paid for it.")) return; void act({ action: "shift_cancel" }); }
    if (s.activity.kind === "travel") return say("You're on the way: it can't be stopped.", undefined, "warn");
    update((x) => ({ ...x, activity: null }));
  }
  const walk = (to: RoomSpot) => { setSpot(to); world.current?.walk(to); };

  async function buy(item: C.Item) {
    const r = await act<{ message: string }>({ action: "buy", item: item.id });
    if (!r) return;
    if (item.cat === "rug") update((x) => ({ ...x, rug: item.id }));
    say(`${item.icon} ${r.message}`, shareText(`I just got a ${item.name} in Notes Life ${item.icon}${item.eco ? " 🌿" : ""}`));
    saveNow();
  }
  async function travel(mode: C.TransportId, to: C.PlaceId) {
    const tr = C.TRANSPORT_OF(mode)!;
    const r = await act<{ minutes: number; energy: number }>({ action: "travel", mode, to });
    if (!r) return;
    update((x) => ({ ...x, bikeRides: x.bikeRides + (mode === "bicycle" ? 1 : 0), needs: applyNeeds(x.needs, { energy: r.energy }) }));
    start({ kind: "travel", label: `${tr.name.replace(/^Your /, "")} to ${C.PLACES.find((p) => p.id === to)?.name}`, icon: tr.icon, to }, r.minutes);
  }
  async function order(mode: C.FoodMode, items: Record<string, number>, keep = false) {
    const list = Object.entries(items).filter(([, q]) => q > 0).map(([id, qty]) => ({ id, qty }));
    if (!list.length) return setErr("Add something to your order.");
    const r = await act<{ hunger: number; minutes: number; fun: number; social: number; total: number }>({ action: "food", mode, items: list });
    if (!r) return;
    // Kept for later: stored as plates (about 50 Hunger each), fresh in a cold fridge, spoiled after 8 game hours without one.
    const plates = Math.max(1, Math.round(list.reduce((n, i) => n + (C.FOOD(i.id)?.hunger ?? 0) * i.qty, 0) / 50));
    if (keep && mode === "delivery") { update((x) => ({ ...x, delivery: { at: Date.now() + C.gameMinutesToMs(r.minutes), hunger: r.hunger, keep: plates } })); setPanel(null); say(`🛵 Order placed: ${plates} plate${plates === 1 ? "" : "s"} to keep for later, in ${r.minutes} game minutes.`); return; }
    if (keep && mode === "takeaway") { update((x) => ({ ...x, plates: Math.min(30, x.plates + plates) })); setPanel(null); say(`🥡 ${plates} plate${plates === 1 ? "" : "s"} packed to take home.${playerRef.current?.owned.includes("fridge") ? " Into the fridge with them." : " No fridge: eat within 8 game hours."}`); saveNow(); return; }
    if (mode === "delivery") { update((x) => ({ ...x, delivery: { at: Date.now() + C.gameMinutesToMs(r.minutes), hunger: r.hunger } })); setPanel(null); say(`🛵 Order placed: a rider brings it in ${r.minutes} game minutes.`); }
    else start({ kind: mode === "dinein" ? "dinein" : "eat", label: mode === "dinein" ? "Eating in at Chef Adams" : "Eating your takeaway", icon: mode === "dinein" ? "🍽" : "🥡", end: { hunger: r.hunger, fun: r.fun, social: r.social } }, r.minutes);
  }
  async function hotel(h: C.HotelService) {
    const r = await act<{ minutes: number; effect: Partial<Record<C.Need, number>>; set: Partial<Record<C.Need, number>> | null; boost: string | null }>({ action: "hotel", service: h.id });
    if (!r) return;
    if (r.boost === "gym") update((x) => ({ ...x, gymUntil: Date.now() + C.GAME_DAY_MS }));
    const swimLabel = h.id === "pool" ? `Swimming${(playerRef.current?.swimLessons ?? 0) >= C.SWIM_DEEP_LESSONS ? "" : " · shallow end"}` : h.id === "lesson" ? "Swimming lesson with Coach Femi" : h.name;
    start({ kind: "hotel", label: swimLabel, icon: h.icon, end: r.effect, set: r.set ?? undefined }, r.minutes);
    if (h.id === "suite") say("👑 Checked in to the Imperial Suite.", shareText("Living large at the Candellux Imperial in Notes Life 👑"));
  }
  async function dwClass(c: C.Course) {
    const r = await act<{ minutes: number; effect: Partial<Record<C.Need, number>>; done: number; of: number; cert: boolean }>({ action: "dw_class", course: c.id });
    if (!r) return;
    setPanel(null);
    start({ kind: "class", label: `${c.name} · class ${r.done} of ${r.of}`, icon: "📚", end: r.effect }, r.minutes);
    if (r.cert) { sfx("success"); say(`🎓 Final class! You're Digital Witch certified in ${c.name}. ${C.JOB(c.job)?.title} is open to you (Phone → Jobs).`, shareText(`I just got Digital Witch certified in ${c.name} in Notes Life 🎓`)); }
    else say(`📚 Class ${r.done} of ${r.of}: ${c.name}.`);
  }
  async function giveaway() {
    const r = await act<{ prize: number }>({ action: "dw_giveaway" });
    if (!r) return;
    if (r.prize > 0) { sfx("bonus"); say(`🎉 Cynthia's graduate giveaway: you won ${C.fmtN(r.prize)}! “You took the course, you're working your skill. Keep going!”`, shareText(`I just won ${C.fmtN(r.prize)} in Cynthia Okeh's Digital Witch graduate giveaway on Notes Life 🎉`)); }
    else say("🎁 Not this time. Cynthia: “Keep working your skill, my dear. There's always next Saturday!”");
  }
  async function cook(rcp: C.Recipe) {
    const r = await act<{ minutes: number; plates: number; hunger: number; skill: number }>({ action: "cook", recipe: rcp.id });
    if (!r) return;
    walk("cooker");
    start({ kind: "cook", label: `Cooking: ${rcp.name}`, icon: rcp.icon, plates: r.plates }, r.minutes);
  }
  async function startShift() {
    const p = playerRef.current, s = saveRef.current; if (!p || !s || !p.jobId) return;
    const j = C.JOB(p.jobId)!;
    if (j.place === "home" && s.place !== "home") return setErr("This job is at your desk at home. Go home first.");
    if (j.place === "work" && s.place !== "work") { setPanel("go"); return setErr("Get to work first: choose how to go."); }
    if ((j.place === "chef" || j.place === "itel" || j.place === "hotel") && s.place !== j.place) { setPanel("go"); return setErr(`Your job is at ${C.PLACES.find((x) => x.id === j.place)?.name} in ${C.PLACES.find((x) => x.id === j.place)?.area}. Go there first.`); }
    if (s.activity) return setErr(`Finish what you're doing first: ${s.activity.label}`);
    const r = await act<{ endsAt: number; pay: number }>({ action: "shift_start", needsLow: needsLow(s.needs) });
    if (!r) return;
    if (j.place === "home") walk("desk");
    update((x) => ({ ...x, activity: { kind: "shift", label: `At work: ${j.title}`, icon: "💼", startedAt: Date.now(), endsAt: r.endsAt - offset.current } }));
    setPanel(null);
    say(`💼 Shift started: ${C.fmtN(r.pay)} when it ends (${C.SHIFT_HOURS} game hours).`);
  }
  async function answerDeal(answer: "accept" | "negotiate" | "decline") {
    const r = await act<{ message?: string; lost?: boolean }>({ action: "deal_answer", answer });
    if (r?.message) say(r.message, undefined, r.lost ? "warn" : "ok");
    if (r) setPanel(null);
  }
  async function collectDeal() {
    const who = playerRef.current?.deal?.who;
    const r = await act<{ pay: number }>({ action: "deal_collect" });
    if (r) say(`📦 Deal delivered: ${C.fmtN(r.pay)} from ${who}.`, shareText(`Just closed a ${C.fmtN(r.pay)} deal in Notes Life 📦`));
  }
  async function buyFuel(litres: number) {
    const r = await act<{ litres: number; tank: number }>({ action: "fuel", litres });
    if (r) { update((x) => ({ ...x, fuel: Math.min(r.tank, x.fuel + r.litres) })); say(`⛽ ${r.litres} L of petrol in the tank.`); saveNow(); }
  }
  // A stored plate: hot from the microwave (Hunger +50) when there's power for it, otherwise eaten cold (+40).
  function eatPlate() {
    const s0 = saveRef.current, pl = playerRef.current; if (!s0 || !pl || s0.plates < 1) return;
    const hot = pl.owned.includes("microwave") && powerSource(s0, C.nepaAt(Date.now() + offset.current).out, pl.owned) !== "none";
    update((x) => ({ ...x, plates: x.plates - 1 }));
    start({ kind: "eat", label: hot ? "Eating a hot plate" : "Eating leftovers cold", icon: hot ? "♨️" : "🍽", end: { hunger: hot ? 50 : 40 } }, hot ? 12 : 15);
  }
  async function openOutlet(kind: C.OutletKind, area: C.OutletArea) {
    const t = C.OUTLET(kind)!;
    if (!confirm(`Open a ${t.name} in ${C.OUTLET_AREAS[area].name} for ${C.fmtN(C.outletPrice(t, area))}?`)) return;
    const r = await act<{ message: string }>({ action: "outlet_open", outlet: kind, area });
    if (r) { sfx("bonus"); say(`${t.icon} ${r.message}`, shareText(`I just opened my own ${t.name} in Notes Life ${t.icon}`)); setPanel({ outlet: kind }); }
  }
  async function collect(kind?: C.OutletKind) {
    const r = await act<{ total: number }>({ action: "outlet_collect", ...(kind ? { outlet: kind } : {}) });
    if (r) say(r.total > 0 ? `💼 ${C.fmtN(r.total)} in takings collected.` : "Nothing to collect yet.");
  }
  async function outletBackup(kind: C.OutletKind) {
    if (!confirm(`Fit ${C.OUTLET_BACKUP.name} for ${C.fmtN(C.OUTLET_BACKUP.price)}? Takings so far are collected first.`)) return;
    const r = await act<{ message: string }>({ action: "outlet_backup", outlet: kind });
    if (r) say(`🔋 ${r.message}`);
  }
  function genSwitch(on: boolean) {
    const s = saveRef.current, p = playerRef.current; if (!s || !p) return;
    if (on && !(p.owned.includes("gen_small") || p.owned.includes("gen_big"))) return setPanel({ shop: "power" });
    if (on && s.fuel <= 0) return setErr("The tank is empty: buy petrol first.");
    if (on && !C.nepaAt(Date.now() + offset.current).out) return say("NEPA has light now: no need for the generator.");
    if (on) { sfx("pull"); window.setTimeout(() => say(p.owned.includes("gen_big") ? "🛢️ Vroom! The big generator is on: everything works, AC too." : "⛽ “I Better Pass My Neighbour” is on! Loud, but there is light."), 900); }
    update((x) => ({ ...x, genOn: on }));
  }
  function askResident(id: string, topic: Topic) {
    if (!user) return;
    setChat(chatSay(user.uid, id, topic));
    const k = `notesLife:social:${id}`, now = Date.now();
    let last = 0; try { last = Number(localStorage.getItem(k)) || 0; } catch { /* fine */ }
    if (now - last > C.GAME_HOUR_MS) { try { localStorage.setItem(k, String(now)); } catch { /* fine */ } update((x) => ({ ...x, needs: applyNeeds(x.needs, { social: 8 }) })); say("💬 Social +8"); }
  }
  async function buyNaira(naira: number, how: "wallet" | "card") {
    if (!user) return;
    if (how === "card") {
      setBusy(true); setErr(null); saveNow();
      try { await startCheckout(user, { kind: "life_naira", amountNaira: naira }, { amountKobo: naira * 100, payWith: "card" }); }
      catch (e) { if (e instanceof Error && e.message) setErr(e.message); setBusy(false); }
      return; // on success the page goes to Paystack, and comes back to the game from the payment screen
    }
    setBusy(true); setErr(null);
    try {
      const r = await fetch("/api/paystack/initialize", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${await user.getIdToken()}` }, body: JSON.stringify({ kind: "life_naira", amountNaira: naira, payWith: "wallet" }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.code === "consent_required" ? "Accept the NotesApp Terms first: open NotesApp once and you'll be asked." : j.error || "Couldn't buy Notesville Naira.");
      const p = await call<{ player: Player }>(user, "GET"); gotPlayer(p.player);
      say(`🏦 ${C.fmtN(naira * 100)} added from your NotesApp wallet.`);
    } catch (e) { setErr(e instanceof Error ? e.message : "Couldn't buy Notesville Naira."); } finally { setBusy(false); }
  }

  // ---- what each tag in the scene says and does ----
  const tagInfo = (key: string): { label: string; up?: boolean; go: () => void } | null => {
    if (!player || !save) return null;
    if (key.startsWith("npc:")) { const r = C.RESIDENT(key.slice(4)); return r ? { label: `${r.name} 🤖${r.id === "cynthia" ? " · #1" : ""}`, go: () => setPanel({ chat: r.id }) } : null; }
    if (key.startsWith("bb:digitalwitch")) return { label: "📣 Digital Witch · Learn a tech skill", go: () => { setDwTab("courses"); setPanel("dw"); } };
    if (spec?.id === "dw") {
      const open = C.dwOpen(Date.now() + offset.current);
      if (key === "hub") return { label: open ? "🎓 Digital Witch · Training Hub" : "🎓 Digital Witch · classes from 9 AM", up: true, go: () => { setDwTab("courses"); setPanel("dw"); } };
      if (key === "class") return save.activity?.kind === "class" ? { label: `📚 In class · ${save.activity.label}`, up: true, go: () => setPanel("dw") } : null;
      if (key === "tower") return { label: "🏙 Skyscraper Plaza · CBD", go: () => setPanel("dw") };
      if (key === "fountain") return { label: "⛲ Plaza", go: () => say("The Skyscraper Plaza fountain. Learners meet here between classes.") };
    }
    if (key === "bb:challenge") return { label: "📣 #1MillionNairaNotesAppChallenge", up: true, go: () => { window.open("https://www.notesapp.name.ng/challenge", "_blank"); } };
    if (key === "bb:itel" || key === "bb:itel2") return { label: "⚡ itel Energy · Go solar", go: () => setPanel("itel") };
    if (key.startsWith("bb:chef")) return { label: ({ "bb:chef2": "🌯 Shawarma · Order now", "bb:chef3": "🍕 Chef Adams pizza", "bb:chef4": "🍌 Sum Ting Fresh" } as Record<string, string>)[key] ?? "🍽 Chef Adams · Order now", go: () => setPanel("food") };
    if (key.startsWith("mine:")) { const t = C.OUTLET(key.slice(5)); const o = player.outlets.find((x) => x.kind === t?.id); return t && o ? { label: `${t.icon} Your ${t.short} · ${C.fmtShort(C.outletTakings(o, Date.now() + offset.current).takings)}`, up: true, go: () => setPanel({ outlet: t.id }) } : null; }
    if (key.startsWith("player:")) { const o = others.find((x) => x.uid === key.slice(7)); return o ? { label: `👤 ${o.name.split(" ")[0]}`, up: true, go: () => setPanel({ player: o }) } : null; }
    const has = (id: string) => player.owned.includes(id);
    const pc = C.bestOwned(player.owned, "computer");
    if (spec?.id === "room") {
      switch (key) {
        case "bed": return { label: save.activity?.kind === "sleep" ? "🛏 Wake up" : "🛏 Sleep", go: () => (save.activity?.kind === "sleep" ? stop() : (walk("bed"), setPanel("sleep"))) };
        case "lamp": return { label: has("lamp_led") ? "💡 LED lamp" : "💡 Lamp", go: () => say("Click. Nice and warm.") };
        case "phone": return { label: player.deal?.state === "offered" ? "☎️ Ringing!" : "☎️ Deal line", up: player.deal?.state === "offered", go: () => { walk("phone"); setPanel("deal"); } };
        case "wardrobe": return { label: "👔 Wardrobe", go: () => { walk("wardrobe"); setPanel("outfit"); } };
        case "bath": return { label: "🛁 Bath", go: () => { walk("bath"); start({ kind: "bath", label: "Taking a bath", icon: "🛁", set: { hygiene: 100 } }, 20); } };
        case "wc": return { label: "🚽 WC", go: () => { walk("wc"); start({ kind: "wc", label: "Using the WC", icon: "🚽", set: { bladder: 100 } }, 5); } };
        case "desk": return { label: `${pc?.icon ?? "🖥"} Desk${has("pc_laptop") || has("pc_aio") ? "" : " ⬆"}`, up: !(has("pc_laptop") || has("pc_aio")), go: () => { walk("desk"); setPanel("desk"); } };
        case "cool": return { label: has("ac") ? "❄️ AC" : "🌀 Fan ⬆", up: !has("ac"), go: () => setPanel({ shop: "cooling" }) };
        case "rug": return { label: `${C.ITEM(save.rug)?.name.replace(/ rug$/, "") ?? "Rug"} rug ⬆`, up: true, go: () => setPanel({ shop: "rug" }) };
        case "cooker": return { label: save.plates ? `🍳 Eat (${save.plates} ready)` : "🍳 Cook", go: () => { walk("cooker"); setPanel("cook"); } };
        case "door": return { label: "🚪 Go out", go: () => setPanel("go") };
        case "powergo": return { label: `🔋 Power GO ${Math.round((save.battery / C.POWER_GO.wh) * 100)}%`, up: src === "go", go: () => setPanel("power") };
        case "fridge": return { label: player.owned.includes("fridge") ? `🧊 Fridge${save.plates ? ` · ${save.plates} plate${save.plates === 1 ? "" : "s"}` : ""}` : `♨️ Microwave${save.plates ? ` · ${save.plates} plate${save.plates === 1 ? "" : "s"}` : ""}`, go: () => setPanel("kitchen") };
        case "tank": return { label: `🔋 Power Tank ${Math.round((save.tank / C.POWER_TANK.wh) * 100)}%`, up: src === "tank", go: () => setPanel("power") };
        case "gen": return { label: src === "gen" ? `⛽ Generator ON · ${save.fuel.toFixed(1)} L` : `⛽ Generator · ${save.fuel.toFixed(1)} L`, up: src === "gen", go: () => setPanel("power") };
      }
    }
    if (spec?.id === "chef") {
      if (key === "dinein") return { label: "🍽 Chef Adams · Dine-in", go: () => setPanel("food") };
      if (key === "kiosk") return { label: "🥡 Takeaway", go: () => setPanel("food") };
      if (key === "rider") return { label: "🛵 Delivery", up: true, go: () => setPanel("food") };
      if (key === "home") return { label: "🏠 Go home", go: () => setPanel("go") };
    }
    if (spec?.id === "hotel") {
      if (key === "sign" || key === "gate") return { label: key === "gate" ? "👑 Enter Candellux" : "Facilities", up: key === "gate", go: () => setPanel("hotel") };
      if (key === "pool") return { label: save.activity?.label.startsWith("Swimming") ? "🏊 You're swimming" : "🏊 Swim", up: true, go: () => setPanel("hotelpool") };
      if (key === "roof") return { label: "👑 Candellux Imperial · Garki", go: () => setPanel("hotel") };
      if (key === "guard") return { label: player.jobId === "hotel_guard" ? "🏊 Your lifeguard chair" : "Lifeguard 🤖", go: () => setPanel({ jobs: "candellux" }) };
      if (key === "gym") return { label: "🏋 Gym", go: () => setPanel("hotelpool") };
      if (key === "bar") return { label: "🍹 Pool bar", go: () => setPanel("hotelpool") };
      if (key === "vip") return { label: `👑 VIP bar · ${C.vipsAt(Date.now() + offset.current).in.length} VIPs in`, up: true, go: () => setPanel("vip") };
    }
    if (spec?.id === "itel") {
      if (key === "shop") return { label: "⚡ itel Energy · Solar shop", up: true, go: () => setPanel("itel") };
      if (key === "go") return { label: "🔋 Power GO Pro", go: () => setPanel("product") };
      if (key === "kit") return { label: "☀️ Small home solar kit", go: () => say("☀️ The small home solar kit (IP66 inverter, battery and 4 panels) is coming soon.") };
      if (key === "inverter") return { label: "IP66 inverters", go: () => say("IP66: dust-tight and waterproof, made for Nigerian weather. Coming with the home kit.") };
    }
    if (spec?.id === "street") {
      if (key === "shop") return { label: "🛵 Green Wheels", up: true, go: () => setPanel({ shop: "transport" }) };
      if (key === "bike" && save.place === "work") return { label: save.activity?.kind === "shift" ? "💼 At work" : "💼 Work", up: true, go: () => setPanel("jobs") };
      if (["bus", "keke", "stop", "ev"].includes(key)) return { label: ({ bus: "🚌 Metro N$ 200", keke: "🛺 Keke N$ 400", stop: "🚏 Wuse stop", ev: "⚡ EV point" } as Record<string, string>)[key], go: () => setPanel("go") };
    }
    return null;
  };

  // ---------------- screens ----------------
  if (user === null) return <Gate />;
  if (err && !player) return <Center><p className="text-lg font-bold">Notes Life couldn&apos;t open</p><p className="mt-2 text-sm text-slate">{err}</p><button className="mt-4 rounded-full bg-ink px-5 py-2 text-sm font-bold text-white" onClick={() => location.reload()}>Try again</button></Center>;
  if (!user || !player || !save) return <Center><p className="text-3xl">🏠</p><p className="mt-2 font-bold">Opening your life in Wuse…</p></Center>;

  const wt = C.worldTime(Date.now() + offset.current);
  const day = C.lifeDay(player.startedAt, Date.now() + offset.current);
  const m = mood(save.needs);
  const a = save.activity;
  const deal = player.deal;
  const dealReady = deal?.state === "active" && Date.now() + offset.current >= (deal.dueAt ?? 0) - 3000;
  const job = player.jobId ? C.JOB(player.jobId) : null;
  const diff = C.DIFFICULTY[save.difficulty];
  const takingsAll = player.outlets.reduce((n, o) => n + C.outletTakings(o, Date.now() + offset.current).takings, 0);

  return (
    <div className="life-game fixed inset-0 overflow-hidden bg-sky-100 font-ui text-ink" onClickCapture={(e) => { const was = snd.current?.ready; snd.current?.unlock(); if (was && (e.target as HTMLElement).closest("button")) sfx("tap"); }}>
      <canvas ref={canvas} className="absolute inset-0 h-full w-full touch-none" />
      {/* tappable labels over the scene */}
      <div className="pointer-events-none absolute inset-0 z-[5]">
        {declutter(tags.flatMap((t) => { const info = tagInfo(t.key); return info && t.visible ? [{ ...t, info, x: Math.min(window.innerWidth - 60, Math.max(60, t.x)) }] : []; })).map(({ key, info, x, y }) => (
          <button key={key} onClick={info.go} className={`pointer-events-auto absolute -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold text-white shadow-lg ${info.up ? "bg-[#7A0328]" : "bg-gray-900/85"} hover:scale-105`} style={{ left: x, top: y }}>{info.label}</button>
        ))}
      </div>

      {/* HUD */}
      <div className="pointer-events-none absolute inset-0 z-[6] flex flex-col p-3 lg:p-5">
        <div className="mx-auto flex w-full max-w-md items-center gap-2 lg:max-w-2xl">
          <button onClick={() => setPanel("settings")} className="pill pointer-events-auto flex flex-1 items-center gap-2 px-3 py-2 text-sm">
            <span>{wt.night ? "🌙" : "☀️"}</span><b className="whitespace-nowrap">{wt.label}</b><span className="text-slate">·</span><span title="Difficulty">{diff.icon}</span><span className="hidden text-[11px] text-slate sm:inline">{diff.label}</span><span className="ml-auto truncate font-mono text-[11px] text-slate">{save.place === "hotel" ? "Garki" : "Wuse"}<span className="hidden sm:inline">, Abuja</span></span>
          </button>
          <button onClick={() => setPanel("bank")} className="pill pointer-events-auto flex items-center gap-2 py-1 pl-3 pr-1 text-sm"><b>{window.innerWidth < 700 ? C.fmtShort(player.naira) : C.fmtN(player.naira)}</b><span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 font-bold text-white">+</span></button>
          <button onClick={() => setSoundPrefs((p) => ({ ...p, on: !p.on }))} className="pill pointer-events-auto flex h-10 w-10 shrink-0 items-center justify-center text-lg" aria-label={soundPrefs.on ? "Mute sound" : "Turn sound on"} title={soundPrefs.on ? "Mute" : "Sound on"}>{soundPrefs.on ? "🔊" : "🔇"}</button>
        </div>
        <div className="mx-auto mt-2 flex flex-wrap justify-center gap-2 text-[11px]">
          <span className="pill px-3 py-1">☁️ {savedAt ? `Saved ${Math.max(1, Math.round((Date.now() - savedAt) / 1000))}s ago` : "Saved on this device"}</span>
          <span className="pill px-3 py-1">📅 Day {day}{player.rentOwed ? <b className="text-crimson"> · rent owed {C.fmtN(player.rentOwed)}</b> : ` · rent day ${(Math.floor((day - 1) / C.MONTH_DAYS) + 1) * C.MONTH_DAYS + 1}`}</span>
          {nepa.out && <button onClick={() => setPanel(save.place === "home" ? "power" : "nepa")} className={`pill pointer-events-auto px-3 py-1 font-bold ${src === "none" ? "text-red-700" : "text-amber-700"}`}>⚡ NEPA off{src === "go" ? ` · 🔋 Power GO ${Math.round((save.battery / C.POWER_GO.wh) * 100)}%` : src === "tank" ? ` · 🔋 Power Tank ${Math.round((save.tank / C.POWER_TANK.wh) * 100)}%` : src === "gen" ? ` · ⛽ ${save.fuel.toFixed(1)} L` : ""}</button>}
          <button onClick={() => setPanel("invite")} className="pill pointer-events-auto px-3 py-1 font-bold text-pink-600">🎁 Invite · {`₦${C.REFERRAL_BONUS_KOBO / 100}`} each</button>
          {takingsAll >= 1_000 && <button onClick={() => setPanel("business")} className="pill pointer-events-auto px-3 py-1 font-bold text-amber-700">💼 {C.fmtShort(takingsAll)} to collect</button>}
          {save.delivery && <span className="pill px-3 py-1">🛵 Food in {Math.max(1, Math.ceil((save.delivery.at - Date.now()) / C.GAME_MIN_MS))} min</span>}
          {deal?.state === "active" && <button onClick={() => dealReady && collectDeal()} className={`pill pointer-events-auto px-3 py-1 ${dealReady ? "!bg-emerald-500 font-bold text-white" : ""}`}>📦 {deal.who}: {dealReady ? `deliver · ${C.fmtN(deal.pay)}` : `ready in ${Math.max(1, Math.ceil(((deal.dueAt ?? 0) - Date.now() - offset.current) / C.GAME_HOUR_MS))} h`}</button>}
        </div>
        {a && (
          <div className="pill pointer-events-auto mx-auto mt-2 flex w-full max-w-sm items-center gap-2 rounded-2xl px-3 py-2 text-xs">
            <span className="text-lg">{a.icon}</span>
            <span className="min-w-0 flex-1"><b className="block truncate">{a.label}</b><span className="bar mt-1 block"><i style={{ width: `${Math.min(100, ((Date.now() - a.startedAt) / Math.max(1, a.endsAt - a.startedAt)) * 100)}%`, background: "#22c55e" }} /></span></span>
            <span className="font-mono text-[10px] text-slate">{Math.max(0, Math.ceil((a.endsAt - Date.now()) / 1000))}s</span>
            {a.kind !== "travel" && <button onClick={stop} className="rounded-full border px-2 py-0.5 font-semibold">{a.kind === "sleep" ? "Wake" : "Stop"}</button>}
          </div>
        )}
        {toast && (
          <div className={`pointer-events-auto mx-auto mt-2 flex max-w-sm items-center gap-2 rounded-2xl px-3 py-2 text-xs font-semibold text-white shadow-xl ${toast.tone === "warn" ? "bg-amber-600" : "bg-emerald-600"}`}>
            <span className="flex-1">{toast.text}</span>
            {toast.share && <a href={WA(toast.share)} target="_blank" rel="noreferrer" className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-emerald-700">Share on WhatsApp</a>}
          </div>
        )}
        <div className="mt-auto">
          <div className="mb-2 flex items-end gap-2">
            <button onClick={() => setPanel("needs")} className="pointer-events-auto relative shrink-0">
              {player.avatar ? <img src={player.avatar} alt="" className="h-14 w-14 rounded-full border-4 border-emerald-400 object-cover lg:h-16 lg:w-16" /> : <span className="flex h-14 w-14 items-center justify-center rounded-full border-4 border-emerald-400 bg-white text-xl font-bold">{player.name[0]}</span>}
              <span className="absolute -bottom-1 -right-1 rounded-full bg-white px-1 text-sm shadow" title={`Mood: ${m.label}`}>{m.icon}</span>
            </button>
            <button onClick={() => setPanel("needs")} className="pill pointer-events-auto grid flex-1 grid-cols-3 gap-x-3 gap-y-1.5 rounded-2xl px-3 py-2 text-left text-[10px] lg:max-w-md">
              {C.NEEDS.map((n) => <span key={n.id} title={n.label}>{n.icon} <span className="bar inline-block w-10 align-middle sm:w-12"><i style={{ width: `${save.needs[n.id]}%`, background: save.needs[n.id] < C.LOW_NEED ? "#f59e0b" : "#22c55e" }} /></span></span>)}
            </button>
          </div>
          <nav className="pill pointer-events-auto mx-auto grid max-w-md grid-cols-5 gap-1 rounded-3xl p-1.5 text-center text-[11px] font-semibold lg:max-w-xl">
            {[["🏠", "Home", () => (save.place === "home" ? setPanel(null) : setPanel("go"))], ["🛋", "Shop", () => setPanel({ shop: "rug" })], ["🗺", "Go", () => setPanel("go")], ["📱", "Phone", () => setPanel("phone")], ["👑", "Rich list", () => setPanel("rich")]].map(([i, l, f]) => (
              <button key={l as string} onClick={f as () => void} className={`rounded-2xl py-2 ${(l === "Home" && !panel) || (l === "Phone" && ["phone", "jobs", "friends", "bank", "invite", "food", "deal", "business"].includes(String(panel))) || (l === "Go" && panel === "go") || (l === "Rich list" && panel === "rich") || (l === "Shop" && typeof panel === "object" && !!panel && "shop" in panel) ? "bg-ink text-white" : ""} relative`}>{i as string}<br />{l as string}{l === "Phone" && friendUnread > 0 && <span className="absolute right-2 top-0.5 rounded-full bg-rose-600 px-1.5 text-[10px] font-extrabold text-white" aria-label={`${friendUnread} unread from friends`}>{friendUnread}</span>}</button>
            ))}
          </nav>
        </div>
      </div>

      {panel && (
        <div className="absolute inset-0 z-20 flex items-end justify-center bg-black/40 p-3 lg:items-center" onClick={() => setPanel(null)}>
          <div className="max-h-[82vh] w-full max-w-md overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl lg:max-w-lg" onClick={(e) => e.stopPropagation()}>
            {err && <p className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-800">{err}</p>}
            <BusyCtx.Provider value={busy}>{renderPanels()}</BusyCtx.Provider>
          </div>
        </div>
      )}
      {fchat && user && save && (
        <FriendChat user={user} friend={fchat} here={others.some((o) => o.uid === fchat.uid)} where={C.PLACES.find((x) => x.id === save.place)?.name ?? "Abuja"}
          social={save.needs.social} gains={chatGains}
          onSent={(id) => chatGain(others.some((o) => o.uid === fchat.uid) ? "here" : "send", fchat.name.split(" ")[0], id)}
          onClose={() => setFchat(null)} />
      )}
    </div>
  );

  // ---------------- panels ----------------
  function renderPanels() {
    if (!player || !save) return null;
    const p = player, s = save;
    const close = <button onClick={() => setPanel(null)} className="float-right text-xl leading-none text-slate" aria-label="Close">×</button>;
    const eco = (t?: string) => (t ? <span className="ml-1 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800">🌿 {t}</span> : null);

    if (panel === "welcome") return (
      <div>
        <p className="text-center text-[11px] font-bold uppercase tracking-widest text-emerald-700">Welcome to Notes Life</p>
        <h2 className="text-center text-2xl font-extrabold">Choose your city</h2>
        <p className="mt-1 text-center text-sm text-slate">Hi {p.name.split(" ")[0]}. Start in a room with {C.fmtN(C.START_NAIRA)}. Rent is {C.fmtN(C.RENT_NAIRA)} every 30 game days (one real day); a game day is 48 real minutes.</p>
        <div className="mt-4 grid gap-3">
          {C.CITY_CARDS.map((c) => { const open = c.id === "abuja", asked = p.cityNotify?.includes(c.id); return (
            <div key={c.id} className={`overflow-hidden rounded-2xl ${open ? "border-2 border-emerald-500 shadow" : "border border-slate-200"}`}>
              <div className="relative h-28 bg-white"><img src={c.icon} alt={c.landmark} className={`h-full w-full object-cover ${open ? "" : "opacity-90"}`} /><span className={`absolute right-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-bold text-white ${open ? "bg-emerald-500" : "bg-slate-800"}`}>{open ? "OPEN" : "🔒 SOON"}</span></div>
              <div className="p-3"><b className="block text-lg">{c.name}</b><span className="text-[11px] text-slate">{c.landmark}</span>
                {open ? <div className="mt-2"><Btn tone="green" onClick={() => { update((x) => ({ ...x, seenWelcome: true })); setPanel("arrive"); saveNow(); }}>Start in Abuja</Btn></div>
                  : <button disabled={busy || asked} onClick={async () => { const r = await act<{ message: string }>({ action: "city_notify", city: c.id }); if (r) say(`🔔 ${r.message}`); }} className="mt-2 w-full rounded-full border py-2 text-sm font-bold disabled:opacity-60">{asked ? "✓ We'll tell you when it opens" : "🔔 Tell me when it opens"}</button>}</div>
            </div>); })}
        </div>
        <p className="mt-3 text-center text-[11px] text-slate">Notesville Naira (N$) is game money: it can&apos;t be cashed out. Your progress saves on this device and in your NotesApp account.</p>
      </div>
    );
    if (panel === "arrive") return (
      <div className="-m-5 overflow-hidden text-center">
        <div className="bg-[#020617] pt-5"><p className="text-[11px] font-bold uppercase tracking-[0.3em] text-emerald-300">Federal Capital Territory</p><h2 className="mt-1 font-serif text-4xl font-bold text-white">Welcome to Abuja</h2><img src="/images/life/cities/abuja-night.svg" alt="The Abuja City Gate at night: You are welcome" className="mt-1 h-56 w-full object-cover" /></div>
        <div className="p-5"><p className="text-sm text-slate">You drive in through the City Gate. Your room is waiting in Wuse, with {C.fmtN(C.START_NAIRA)}, a bicycle and a deal phone.</p>
          <div className="mt-3 flex justify-center gap-2 text-[11px] font-bold"><span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-800">🏠 Wuse</span><span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-800">👑 Garki</span><span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-800">🏙 Maitama</span></div>
          <div className="mt-4"><Btn tone="green" onClick={() => setPanel(null)}>Go to my room →</Btn></div></div>
      </div>
    );

    if (panel === "needs") return (
      <div>{close}
        <p className="text-[11px] font-bold uppercase tracking-widest text-emerald-700">Your needs</p>
        <h2 className="text-xl font-extrabold">{m.icon} Mood: {m.label}</h2>
        <p className="text-xs text-slate">Keep all six green to earn full pay. Difficulty: {diff.icon} {diff.label}.</p>
        <div className="mt-3 grid gap-1.5">{C.NEEDS.map((n) => (
          <div key={n.id} className="rounded-2xl border border-slate-200 px-2.5 py-1.5"><div className="flex items-center gap-2 text-sm"><span>{n.icon}</span><b className="w-16">{n.label}</b><span className="bar flex-1"><i style={{ width: `${s.needs[n.id]}%`, background: s.needs[n.id] < C.LOW_NEED ? "#f59e0b" : "#22c55e" }} /></span><b className="w-9 text-right text-xs">{Math.round(s.needs[n.id])}%</b></div><p className="pl-6 text-[10px] text-slate">{n.tip}</p></div>
        ))}</div>
        {needsLow(s.needs) && <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-[11px] text-amber-900">⚠ A need is low: shifts pay {Math.round((1 - C.LOW_PAY_FACTOR) * 100)}% less until it&apos;s green again.</p>}
      </div>
    );

    if (panel === "sleep") {
      const rate = C.bestOwned(p.owned, "cooling")?.sleepPerHour ?? 12;
      return (<div>{close}<h2 className="text-xl font-extrabold">🛏 Sleep</h2><p className="text-xs text-slate">{p.owned.includes("ac") ? "The AC keeps it cool: deep sleep." : "The fan helps a little: sleep is lighter. An AC sleeps deeper."} Energy +{rate} a game hour.</p>
        <div className="mt-3 grid gap-2">{[[1, "Power nap", "2 real minutes"], [4, "Short sleep", "8 real minutes"], [8, "Full night", "16 real minutes"]].map(([h, t, n]) => <Row key={t as string} icon="😴" title={`${t} · ${h} game hour${h === 1 ? "" : "s"}`} note={n as string} onClick={() => start({ kind: "sleep", label: "Sleeping", icon: "😴", perHour: { energy: rate } }, (h as number) * 60)} />)}</div>
        <p className="mt-2 text-[11px] text-slate">You can close the game while you sleep: you wake up rested.</p></div>);
    }

    if (panel === "desk") {
      const pc = C.bestOwned(p.owned, "computer")!;
      const deskJob = job?.place === "home";
      return (<div>{close}<h2 className="text-xl font-extrabold">{pc.icon} Your desk</h2><p className="text-xs text-slate">{pc.name} · work speed {pc.workSpeed}×</p>
        <div className="mt-3 grid gap-2">
          <Row icon="📖" title="Read for a game hour" note="Fun +15" onClick={() => start({ kind: "read", label: "Reading", icon: "📖", perHour: { fun: 15 } }, 60)} />
          <Row icon="🎮" title="Play games for a game hour" note="Fun +25 · Energy −5" onClick={() => start({ kind: "read", label: "Playing games", icon: "🎮", perHour: { fun: 25, energy: -5 } }, 60)} />
          {deskJob ? <Row icon="💼" title={`Work a shift: ${job!.title}`} note={`${C.SHIFT_HOURS} game hours · ${C.fmtN(C.shiftPay(job!, p.owned, needsLow(s.needs)))}`} onClick={startShift} pick /> : <Row icon="💼" title="Work from your desk" note="Writer and tech freelancer jobs are done here (Phone → Jobs)" onClick={() => setPanel("jobs")} />}
          {!(p.owned.includes("pc_laptop") || p.owned.includes("pc_aio")) && <Row icon="⬆" title="Upgrade your computer" note="A laptop doubles your desk pay, and unlocks tech jobs" onClick={() => setPanel({ shop: "computer" })} />}
        </div></div>);
    }

    if (panel === "outfit") return (<div>{close}<h2 className="text-xl font-extrabold">👔 Wardrobe</h2><p className="text-xs text-slate">Pick today&apos;s outfit.</p>
      <div className="mt-3 grid grid-cols-4 gap-2">{OUTFITS.map((c) => <button key={c} onClick={() => { update((x) => ({ ...x, outfit: c })); setPanel(null); }} className={`h-14 rounded-2xl border-4 ${s.outfit === c ? "border-ink" : "border-white"} shadow`} style={{ background: c }} aria-label={`Outfit ${c}`} />)}</div></div>);

    if (panel === "cook") return (<div>{close}
      <p className="text-[11px] font-bold uppercase tracking-widest text-emerald-700">🍳 Cook at home</p><h2 className="text-xl font-extrabold">What are you cooking?</h2>
      <p className="text-xs text-slate">Cheaper than eating out, but it takes time. Cooking skill: <b>{p.cooking} of 10</b> (skill 3 qualifies you as a Chef Adams line cook).</p>
      {s.plates > 0 && <div className="mt-3"><Row icon="🍽" title={`Eat a plate (${s.plates} ready)`} note={p.owned.includes("microwave") ? "Warmed in the microwave: Hunger +50" : "Hunger +40 cold · a microwave warms it: +50"} pick onClick={eatPlate} />{!p.owned.includes("fridge") && <p className="mt-1 text-[10px] text-amber-800">No fridge: plates spoil after {C.FOOD_SPOIL_HOURS} game hours ({Math.max(0, Math.ceil(C.FOOD_SPOIL_HOURS - s.plateWarm))} h left).</p>}</div>}
      <div className="mt-3 grid gap-2">{C.RECIPES.map((r) => <Row key={r.id} icon={r.icon} title={r.name} note={`Ingredients ${C.fmtN(r.cost)} · ${r.minutes} game min · 🍲 +${r.hunger} a plate`} right={<b>{C.fmtN(Math.round(r.cost / r.plates))}/plate</b>} onClick={() => cook(r)} />)}</div></div>);

    if (panel === "deal") {
      if (!deal) return (<div>{close}<h2 className="text-xl font-extrabold">☎️ Deal line</h2><p className="mt-1 text-sm text-slate">No calls right now. People call your bedside phone with deals about every {C.bestOwned(p.owned, "phone")?.dealEveryHours} game hours while you&apos;re home and awake. A smartphone line gets more calls and bigger deals.</p>
        <div className="mt-3 flex gap-2"><Btn tone="ghost" onClick={() => setPanel({ shop: "phone" })}>See phones</Btn></div></div>);
      if (deal.state === "active") return (<div>{close}<h2 className="text-xl font-extrabold">📦 Deal with {deal.who}</h2><p className="text-sm text-slate">{deal.from} · {deal.ask}</p>
        <p className="mt-2 text-sm">Pays <b>{C.fmtN(deal.pay)}</b> {dealReady ? "now." : `in about ${Math.max(1, Math.ceil(((deal.dueAt ?? 0) - Date.now() - offset.current) / C.GAME_HOUR_MS))} game hours.`}</p>
        <div className="mt-3"><Btn tone="green" disabled={!dealReady} onClick={collectDeal}>{dealReady ? "Deliver and get paid" : "Not ready yet"}</Btn></div></div>);
      return (<div>{close}<p className="text-[11px] font-bold uppercase tracking-widest text-crimson">☎️ Deal line · incoming</p>
        <div className="mt-2 flex items-center gap-3"><span className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-2xl">📞</span><div><b className="block text-lg leading-tight">{deal.who}</b><span className="text-xs text-slate">{deal.from}</span></div></div>
        <p className="mt-3 rounded-2xl bg-slate-100 p-3 text-sm italic">“{deal.ask}”</p>
        <p className="mt-2 text-sm">{deal.cost ? <>Costs <b>{C.fmtN(deal.cost)}</b> up front, pays</> : "Pays"} <b>{C.fmtN(deal.pay)}</b> in {deal.hours} game hours.</p>
        <div className="mt-3 grid grid-cols-3 gap-2"><Btn tone="green" onClick={() => answerDeal("accept")}>Accept</Btn><Btn onClick={() => answerDeal("negotiate")}>Negotiate</Btn><Btn tone="ghost" onClick={() => answerDeal("decline")}>Decline</Btn></div>
        <p className="mt-2 text-[11px] text-slate">Negotiating asks for 10% more: they may say yes, or hang up{p.barberUntil > Date.now() + offset.current ? " (your fresh cut helps!)" : ""}. Delivered deals raise your reputation ({p.reputation.toFixed(1)}★).</p></div>);
    }

    if (typeof panel === "object" && panel && "shop" in panel) {
      const cat = panel.shop;
      return (<div>{close}<p className="text-[11px] font-bold uppercase tracking-widest text-crimson">🛋 Shop</p><h2 className="text-xl font-extrabold">Make it yours</h2>
        <div className="mt-3 flex flex-wrap gap-1.5 text-xs font-semibold">{C.SHOP_CATS.map((c) => <button key={c.id} onClick={() => setPanel({ shop: c.id })} className={`rounded-full px-3 py-1 ${c.id === cat ? "bg-ink text-white" : "border"}`}>{c.label}</button>)}</div>
        <div className="mt-3 grid gap-2">{C.ITEMS.filter((i) => i.cat === cat).map((i) => {
          const own = p.owned.includes(i.id);
          return <Row key={i.id} icon={i.icon} title={<>{i.name}{eco(i.eco)}</>} note={i.note} pick={cat === "rug" && s.rug === i.id}
            right={own ? (cat === "rug" ? (s.rug === i.id ? <span className="rounded-full bg-slate-200 px-2 py-0.5 font-bold">In use</span> : <button className="rounded-full border px-2 py-0.5 font-bold" onClick={() => update((x) => ({ ...x, rug: i.id }))}>Put down</button>) : <span className="rounded-full bg-slate-200 px-2 py-0.5 font-bold">Owned</span>)
              : i.soon ? <span className="text-slate"><b className="block">{C.fmtShort(i.price)}</b>soon</span>
              : <button disabled={busy} onClick={() => buy(i)} className="rounded-full bg-emerald-500 px-3 py-1 font-bold text-white disabled:opacity-40">{C.fmtN(i.price)}</button>} />;
        })}</div>
        {cat === "power" && <p className="mt-3 rounded-xl bg-[#fff1f3] px-3 py-2 text-[11px]">⚡ itel products come from the <button className="font-bold text-[#e8173f] underline" onClick={() => setPanel("itel")}>itel Energy shop</button> in Wuse. Generators are from the market: loud, and they need petrol.</p>}
        <p className="mt-3 text-center text-[11px] text-slate">Prices in Notesville Naira, earned from jobs and deals. Short? <button className="underline" onClick={() => setPanel("bank")}>Buy N$ with NotesApp Credit</button>.</p></div>);
    }

    if (panel === "go") {
      const dests = C.PLACES.filter((d) => d.id !== s.place && (d.id !== "work" || job?.place === "work"));
      return goPanel(close, dests);
    }

    if (panel === "ebike") return (<div className="text-center">{close}<span className="text-5xl">🛵</span><p className="mt-1 text-[11px] font-bold uppercase tracking-widest text-emerald-700">🌿 Ride greener, faster</p><h2 className="text-2xl font-extrabold">Tired of cycling?</h2>
      <p className="text-sm text-slate">An e-bike gets you anywhere in 12 game minutes, without the sweat, and doubles delivery pay.</p>
      <div className="mt-3 rounded-2xl border-2 border-emerald-400 p-3 text-left"><div className="flex justify-between"><b>Green Wheels e-bike</b><b>{C.fmtN(450_000)}</b></div>
        <div className="mt-2 flex items-center gap-2 text-[11px]"><span className="bar flex-1"><i style={{ width: `${Math.min(100, (p.naira / 450_000) * 100)}%`, background: "#22c55e" }} /></span><b>{C.fmtN(p.naira)} saved</b></div></div>
      <div className="mt-3 grid gap-2">
        {p.naira >= 450_000 ? <Btn tone="green" onClick={() => buy(C.ITEM("ebike")!)}>Buy it now · {C.fmtN(450_000)}</Btn> : <Btn tone="green" onClick={() => setPanel("bank")}>Get it now · top up ₦{Math.ceil((450_000 - p.naira) / 100).toLocaleString("en-NG")} NotesApp Credit</Btn>}
        <Btn tone="ghost" onClick={() => setPanel(null)}>Save up for it ({Math.min(99, Math.floor((p.naira / 450_000) * 100))}%)</Btn>
        <button className="py-1 text-xs font-semibold text-slate underline" onClick={() => setPanel(null)}>Not now, keep cycling</button></div>
      <p className="mt-2 text-[10px] text-slate">₦1 of NotesApp Credit = N$ 100 · Electric cars from N$ 18m · Everything here is eco-friendly 🌿</p></div>);

    if (panel === "food") return foodPanel(close);
    if (panel === "hotel" || panel === "hotelpool") {
      const poolTab = panel === "hotelpool";
      const hotelRow = (h: C.HotelService) => { const half = C.isStaff(p.jobId, "candellux") && C.STAFF_PERKS.hotelHalf.includes(h.id); return <Row key={h.id} icon={h.icon} title={h.id === "lesson" ? `${h.name} · ${Math.min(p.swimLessons + 1, C.SWIM_DEEP_LESSONS)} of ${C.SWIM_DEEP_LESSONS}` : h.name} note={<>{h.note}{h.id === "pool" && p.swimLessons < C.SWIM_DEEP_LESSONS && <b className="block text-sky-700">Shallow end until you&apos;ve had {C.SWIM_DEEP_LESSONS} lessons</b>}{half && <b className="block text-emerald-700">Staff: half price</b>}</>} pick={h.id === "pool"} right={h.soon ? <span className="text-slate">Soon</span> : <button disabled={busy || s.place !== "hotel"} onClick={() => hotel(h)} className="rounded-full bg-[#262b6b] px-3 py-1 font-bold text-white disabled:opacity-40">{C.fmtN(half ? Math.round(h.price / 2) : h.price)}</button>} />; };
      const vipIn = C.vipsAt(Date.now() + offset.current).in.map((id) => C.RESIDENT(id)?.name).filter(Boolean);
      return (<div>{close}
      {brandHead("candellux")}{brandTabs("candellux", poolTab ? "pool" : "main")}
      {s.place !== "hotel" && <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900">You&apos;re not at the hotel. <button className="font-bold underline" onClick={() => setPanel("go")}>Go to Garki</button></p>}
      {!poolTab && <div className="mt-3 grid grid-cols-3 gap-1.5"><img src="/images/life/partners/candellux-night.webp" alt="Candellux Imperial Hotel & Suites at night" className="col-span-2 row-span-2 h-full w-full rounded-xl object-cover" /><img src="/images/life/partners/candellux-sign.webp" alt="The Candellux services sign" className="h-20 w-full rounded-xl object-cover" /><img src="/images/life/partners/candellux-gate-day.webp" alt="The Candellux gate by day" className="h-20 w-full rounded-xl object-cover" /></div>}
      <div className="mt-3 grid gap-1.5">{C.HOTEL.filter((h) => (h.tab === "pool") === poolTab).map(hotelRow)}</div>
      {poolTab && <>
        <button onClick={() => setPanel("vip")} className="mt-3 flex w-full items-center gap-3 rounded-2xl bg-[#1c2030] p-3 text-left text-white"><span className="text-2xl">👑</span><span className="min-w-0 flex-1 text-[11px]"><b className="block text-[13px] text-[#e3b23c]">In the VIP bar now</b>{vipIn.join(" and ")} 🤖</span><span className="text-xs font-bold">See →</span></button>
        <div className="mt-3 rounded-2xl bg-sky-50 p-3 text-[11px]"><b>Your swimming skill: {p.swimming} of 10.</b> <span className="text-slate">Lessons (+2) and swims raise it. Skill 5 qualifies you as a swimming instructor.</span><span className="bar mt-1.5 block"><i style={{ width: `${p.swimming * 10}%`, background: "#0ea5e9" }} /></span></div>
      </>}
      {!poolTab && <div className="mt-3 flex gap-3 rounded-2xl border border-[#e3b23c] bg-[#fffbeb] p-2.5"><img src="/images/life/partners/candellux-pool.webp" alt="" className="h-16 w-20 shrink-0 rounded-xl object-cover" /><div className="min-w-0 text-[11px]"><b className="block text-[12px]">Stay at the real Candellux</b>{C.CANDELLUX.address} · WhatsApp {C.CANDELLUX.whatsappLabel}<a href={WA("Hello Candellux, I'd like to book a room (I found you on Notes Life).", C.CANDELLUX.whatsapp)} target="_blank" rel="noreferrer" className="mt-1 block font-bold text-[#262b6b] underline">Book a real room ↗</a><a href={C.CANDELLUX.site} target="_blank" rel="noreferrer" className="mt-0.5 block text-[#262b6b] underline">candelluximperialhotel.com ↗</a></div></div>}
      <p className="mt-2 text-center text-[10px] text-slate">Candellux Imperial is a Notes Life partner. Turn the camera round at the hotel: the pool is at the back.</p></div>);
    }
    if (panel === "vip") {
      const v = C.vipsAt(Date.now() + offset.current), vip = C.HOTEL_OF("vipbar")!, bar = C.HOTEL_OF("poolbar")!;
      const nx = v.next ? C.RESIDENT(v.next) : null, rank = (id: string) => C.RESIDENTS.filter((r) => r.netWorth).sort((a2, b2) => (b2.netWorth ?? 0) - (a2.netWorth ?? 0)).findIndex((r) => r.id === id) + 1;
      // The real VIP bar at the Candellux, from their photos, as a 360° view: what players see when they walk in.
      return (<div>{close}<div className="mb-3 mt-1"><VipPano /></div><p className="text-[11px] font-bold uppercase tracking-widest text-[#8a6a12]">👑 VIP bar · Candellux</p><h2 className="text-xl font-extrabold">Who&apos;s in {night ? "tonight" : "now"}</h2>
        <p className="text-xs text-slate">Where the top of the Billionaires List drinks. 15% more than the pool bar. Who&apos;s in changes every {C.VIP_EVERY_HOURS} game hours.</p>
        <div className="mt-3 grid gap-2">{v.in.map((id, i) => { const r = C.RESIDENT(id)!; return <Row key={id} pick={i === 0} icon={r.photo ? <img src={r.photo} alt="" className="h-10 w-10 rounded-full object-cover ring-2 ring-amber-400" /> : <span className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white" style={{ background: r.look[0] === "#f5f5f4" ? "#78716c" : r.look[0] }}>{r.name.split(" ").filter((w) => w[0] === w[0].toUpperCase()).map((w) => w[0]).slice(-2).join("")}</span>} title={`${r.name} 🤖 · #${rank(id)}`} note={`${r.role} · ${C.fmtShort(r.netWorth ?? 0)} · “${r.lines.money[0]}”`} right={<button onClick={() => setPanel({ chat: id })} className="rounded-full bg-[#262b6b] px-3 py-1 font-bold text-white">Say hello</button>} />; })}
          {nx && <Row icon="🔒" title={`Next in: ${nx.name} 🤖`} note={`${nx.role} · arrives at ${C.worldTime(v.nextAt).label}`} />}</div>
        <div className="mt-3 grid grid-cols-2 gap-2"><Btn tone="navy" disabled={s.place !== "hotel"} onClick={() => hotel(vip)}>👑 Order · {C.fmtN(vip.price)}</Btn><Btn tone="ghost" disabled={s.place !== "hotel"} onClick={() => hotel(bar)}>🍹 Pool bar · {C.fmtN(bar.price)}</Btn></div>
        {v.in.includes("cynthia") && C.giveawayOn(Date.now() + offset.current) && <div className="mt-3"><Btn tone="green" disabled={s.place !== "hotel"} onClick={giveaway}>🎁 Cynthia&apos;s graduate giveaway is on tonight</Btn></div>}
        <p className="mt-2 text-[10px] text-slate">VIPs are residents 🤖 for now. Ekwutosi Cynthia Okeh (Digital Witch) comes every evening from 7 PM. When real players reach the top of the list, they&apos;ll take turns here too.</p></div>);
    }

    if (panel === "phone") return (<div>{close}<p className="text-lg font-extrabold">📱 Phone</p>
      <div className="mt-3 grid grid-cols-4 gap-3 text-center text-[11px] font-semibold">{([["💼", "Jobs", "bg-emerald-500", () => setPanel("jobs")], ["👥", "Friends", "bg-crimson", () => setPanel("friends")], ["🎁", "Invite", "bg-pink-500", () => setPanel("invite")], ["☎️", "Deals", "bg-sky-500", () => setPanel("deal")], ["🏦", "Bank", "bg-amber-500", () => setPanel("bank")], ["🛺", "Go", "bg-teal-600", () => setPanel("go")], ["CHEF", "Chef Adams", "bg-[#292929]", () => setPanel("food")], ["👑", "Candellux", "bg-[#262b6b]", () => setPanel("hotel")], ["⚡", "itel Energy", "bg-[#e8173f]", () => setPanel("itel")], ["DW", "Digital Witch", "bg-[#0b1442]", () => { setDwTab("courses"); setPanel("dw"); }], ["🏪", "Businesses", "bg-[#F2B544]", () => setPanel("business")], ["👑", "Rich list", "bg-slate-800", () => setPanel("rich")], ["🛋", "Shop", "bg-orange-500", () => setPanel({ shop: "rug" })], ["📰", "NotesApp", "bg-[#7A0328]", () => void leave()], ["⚙️", "Settings", "bg-slate-400", () => setPanel("settings")]] as [string, string, string, () => void][]).map(([i, n, c, f]) => (
        <button key={n + i} onClick={f} className="relative">{n === "Friends" && friendUnread > 0 && <span className="absolute right-1 top-0 z-10 rounded-full bg-rose-600 px-1.5 text-[10px] font-extrabold text-white">{friendUnread}</span>}<span className={`mx-auto flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl ${c} text-2xl text-white shadow`}>{i === "CHEF" ? <img src="/images/life/partners/chef-emblem.webp" alt="" className="h-12 w-12 object-contain" /> : i === "DW" ? <img src="/images/life/partners/digitalwitch-logo.webp" alt="" className="h-14 w-14 object-cover" /> : i}</span><span className="mt-1 block">{n}</span></button>
      ))}</div></div>);

    if (panel === "jobs") return (<div>{close}<p className="text-lg font-extrabold">💼 Jobs in Abuja</p><p className="text-[11px] text-slate">Real NotesApp careers. Better gear, better pay. One shift is {C.SHIFT_HOURS} game hours ({C.SHIFT_MS / 60_000} real minutes).</p>
      {job && <div className="mt-3 rounded-2xl border-2 border-emerald-400 bg-emerald-50 p-3"><b className="block">{job.icon} Your job: {job.title}</b><span className="text-[11px] text-slate">{job.employer} · {C.fmtN(C.shiftPay(job, p.owned, needsLow(s.needs)))} a shift{needsLow(s.needs) ? " (a need is low)" : ""} · {p.shifts} shifts done</span>
        <div className="mt-2 flex gap-2">{p.shift ? <span className="text-xs font-semibold">On shift now</span> : <><Btn tone="green" onClick={startShift}>Start a shift</Btn><Btn tone="ghost" onClick={() => act({ action: "job_quit" })}>Quit</Btn></>}</div></div>}
      {([[undefined, "Around town"], ["tech", "Tech · remote · need a Digital Witch certificate"], ["chef_adams", "Chef Adams"], ["itel", "itel Energy"], ["candellux", "Candellux"]] as [C.Brand | "tech" | undefined, string][]).map(([b, title]) => <div key={title}><p className="mt-3 text-[10px] font-bold uppercase tracking-wider text-slate">{title}</p><div className="mt-1 grid gap-1.5">{C.JOBS.filter((j) => j.id !== job?.id && (b === "tech" ? !!j.tech : !j.tech && j.brand === b)).map(jobRow)}</div></div>)}
      <div className="mt-3 grid grid-cols-2 gap-2">{partnerCard("chef_adams")}{partnerCard("itel")}</div></div>);

    if (typeof panel === "object" && panel && "jobs" in panel) {
      const b = panel.jobs;
      return (<div>{close}{brandHead(b)}{brandTabs(b, "jobs")}
        {job?.brand === b && <p className="mt-3 rounded-2xl border-2 border-emerald-400 bg-emerald-50 px-3 py-2 text-xs"><b>{job.icon} You work here: {job.title}.</b> {p.shift ? "On shift now." : <button className="font-bold underline" onClick={startShift}>Start a shift</button>}</p>}
        <div className="mt-3 grid gap-1.5">{C.JOBS.filter((j) => j.brand === b && j.id !== job?.id).map(jobRow)}</div>
        <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-[11px] text-slate">{b === "itel" ? `💡 itel staff get ${Math.round(C.STAFF_PERKS.itelDiscount * 100)}% off itel products. ` : b === "candellux" ? "⭐ Staff perk: half price at the pool, gym and VIP bar. " : "🍲 Line cooks train on the house recipes. "}You've done {C.brandShifts(p, b)} shift{C.brandShifts(p, b) === 1 ? "" : "s"} here. Shifts are {C.SHIFT_HOURS} game hours.</p></div>);
    }
    if (typeof panel === "object" && panel && "partner" in panel) return partnerPanel(close, panel.partner);
    if (typeof panel === "object" && panel && "outlet" in panel) return outletPanel(close, panel.outlet);
    if (panel === "business") return businessPanel(close);
    if (panel === "kitchen") {
      const fr = p.owned.includes("fridge"), mw = p.owned.includes("microwave"), cold = fridgeCold(s, nepa.out, p.owned);
      return (<div>{close}<p className="text-[11px] font-bold uppercase tracking-widest text-emerald-700">🧊 Kitchen</p><h2 className="text-xl font-extrabold">{s.plates ? `${s.plates} plate${s.plates === 1 ? "" : "s"} stored` : "Nothing stored"}</h2>
        <p className="text-xs text-slate">{fr ? (cold ? "The fridge is cold: food keeps." : `The fridge has no power: food spoils after ${C.FOOD_SPOIL_HOURS} game hours without cold (${Math.max(0, Math.ceil(C.FOOD_SPOIL_HOURS - s.plateWarm))} h left).`) : `No fridge: stored food spoils after ${C.FOOD_SPOIL_HOURS} game hours.`}</p>
        <div className="mt-3 grid gap-2">
          {s.plates > 0 && <Row icon={mw ? "♨️" : "🍽"} title="Eat a plate" note={mw ? "Warmed in the microwave: Hunger +50" : "Eaten cold: Hunger +40"} pick onClick={eatPlate} />}
          <Row icon="🥡" title="Get takeaway or delivery to keep" note="Tick “Keep for later” when you order from Chef Adams" onClick={() => setPanel("food")} />
          {!fr && <Row icon="🧊" title="Buy a fridge" note="Keeps food fresh while it has power" right={<b>{C.fmtShort(C.ITEM("fridge")!.price)}</b>} onClick={() => setPanel({ shop: "kitchen" })} />}
          {!mw && <Row icon="♨️" title="Buy a microwave" note="Hot food: Hunger +50 instead of +40" right={<b>{C.fmtShort(C.ITEM("microwave")!.price)}</b>} onClick={() => setPanel({ shop: "kitchen" })} />}
          {fr && !p.owned.includes("power_tank") && <Row icon="🔋" title="itel Power Tank 1000" note="Keeps the fridge cold about 5 game hours in a blackout" right={<b className="text-[#e8173f]">{C.fmtShort(C.ITEM("power_tank")!.price)}</b>} onClick={() => setPanel("itel")} />}
        </div></div>);
    }


    if (panel === "nepa") {
      const hasGo = p.owned.includes("power_go"), gen = p.owned.includes("gen_big") ? "gen_big" : p.owned.includes("gen_small") ? "gen_small" : null;
      return (<div>{close}<div className="text-center"><p className="text-[11px] font-bold uppercase tracking-widest text-amber-600">⚡ Power cut · everyone in Abuja</p><h2 className="text-2xl font-extrabold">{nepa.out ? "NEPA has taken light!" : "NEPA has light"}</h2>
        <p className="mt-1 text-sm text-slate">{nepa.out ? "“Ah! NEPA don take light again o!” Mama Nkechi shouts next door. Generators start roaring one by one down the street." : "Light is on for now. Nobody knows when it will go."}</p></div>
        <div className="mt-3 grid gap-2">
          {hasGo ? <Row icon={<img src="/images/life/partners/itel-powergo.webp" alt="" className="h-10 w-10 object-contain" />} title={`Power GO Pro · ${Math.round((s.battery / C.POWER_GO.wh) * 100)}%`} note={src === "go" ? "Running your lamp, fan and laptop. Silent." : s.battery <= 0.5 ? "Empty: it charges when light returns, or by day with the solar panel." : "Ready."} pick={src === "go"} onClick={() => setPanel("power")} />
            : <Row icon={<img src="/images/life/partners/itel-powergo.webp" alt="" className="h-10 w-10 object-contain" />} title="Get a Power GO Pro at itel Energy" note="Lamp, fan and laptop keep going · silent, no fuel" right={<b className="text-[#e8173f]">{C.fmtShort(C.ITEM("power_go")!.price)}</b>} pick onClick={() => setPanel("itel")} />}
          {gen ? <Row icon={C.ITEM(gen)!.icon} title={src === "gen" ? `${C.ITEM(gen)!.name} is ON` : `Start ${C.ITEM(gen)!.name}`} note={`${s.fuel.toFixed(1)} L of petrol · ${C.ITEM(gen)!.litresPerHour} L a game hour`} pick={src === "gen"} onClick={() => setPanel("power")} />
            : <Row icon="⛽" title="Buy “I Better Pass My Neighbour”" note="950W generator from the market · loud · needs petrol" right={<b>{C.fmtShort(C.ITEM("gen_small")!.price)}</b>} onClick={() => setPanel({ shop: "power" })} />}
          {p.owned.includes("power_tank") ? <Row icon="🔋" title={`itel Power Tank 1000 · ${Math.round((s.tank / C.POWER_TANK.wh) * 100)}%`} note={p.owned.includes("fridge") ? "Keeps your fridge cold through the blackout" : "Runs the lights when the Power GO is empty"} pick={src === "tank"} onClick={() => setPanel("power")} />
            : <Row icon="🔋" title="itel Power Tank 1000" note="1000W AC: your fridge keeps food fresh about 5 game hours" right={<b className="text-[#e8173f]">{C.fmtShort(C.ITEM("power_tank")!.price)}</b>} onClick={() => setPanel("itel")} />}
          {s.plates > 0 && !fridgeCold(s, nepa.out, p.owned) && <p className="rounded-xl bg-red-50 px-3 py-2 text-[11px] text-red-800">🤢 Your {s.plates} stored plate{s.plates === 1 ? "" : "s"} spoil{s.plates === 1 ? "s" : ""} in {Math.max(0, Math.ceil(C.FOOD_SPOIL_HOURS - s.plateWarm))} game hours without a cold fridge.</p>}
          <Row icon="☀️" title="Small home solar kit" note="Never affected again (coming soon)" right={<span className="text-slate">soon</span>} />
          <Row icon="🔦" title="Stay in the dark till light returns" note="No reading at night, an old desktop can't work, and you sleep hot" onClick={() => setPanel(null)} />
        </div>
        <p className="mt-2 text-center text-[11px] text-slate">Light usually returns in 2 to 6 game hours.</p></div>);
    }
    if (panel === "power") {
      const gen = p.owned.includes("gen_big") ? C.ITEM("gen_big")! : p.owned.includes("gen_small") ? C.ITEM("gen_small")! : null;
      const pct = Math.round((s.battery / C.POWER_GO.wh) * 100);
      return (<div>{close}<p className="text-[11px] font-bold uppercase tracking-widest text-amber-600">⚡ Power</p><h2 className="text-xl font-extrabold">{!nepa.out ? "NEPA has light" : src === "none" ? "Dark: NEPA has taken light" : src === "go" ? "Running on Power GO" : "Running on the generator"}</h2>
        {p.owned.includes("power_go") ? <div className="mt-3 rounded-2xl border p-3"><div className="flex items-center gap-3"><img src="/images/life/partners/itel-powergo.webp" alt="" className="h-12 w-10 object-contain" /><div className="flex-1"><b className="text-sm">itel Power GO Pro · {pct}%</b><span className="bar mt-1 block"><i style={{ width: `${pct}%`, background: pct < 20 ? "#ef4444" : "#a855f7" }} /></span><span className="mt-1 block text-[11px] text-slate">{nepa.out ? "Lamp, fan and laptop on the battery when the generator is off." : "Charging from NEPA."}{p.owned.includes("solar_panel") ? " ☀️ Solar panel: charges by day." : ""}</span></div></div>
          {!p.owned.includes("solar_panel") && <button onClick={() => setPanel("itel")} className="mt-2 text-[11px] font-bold text-[#e8173f] underline">Add the 100W solar panel ({C.fmtShort(C.ITEM("solar_panel")!.price)})</button>}</div>
          : <div className="mt-3"><Row icon="🔋" title="No Power GO yet" note="itel Energy, Wuse market road" right={<b className="text-[#e8173f]">{C.fmtShort(C.ITEM("power_go")!.price)}</b>} onClick={() => setPanel("itel")} /></div>}
        {p.owned.includes("power_tank") && (() => { const tp = Math.round((s.tank / C.POWER_TANK.wh) * 100); const panels = (p.owned.includes("solar_650") ? 1 : 0) + (p.owned.includes("solar_650b") ? 1 : 0); return <div className="mt-3 rounded-2xl border p-3"><div className="flex items-center gap-3"><span className="flex h-12 w-10 items-center justify-center text-2xl">🔋</span><div className="flex-1"><b className="text-sm">itel Power Tank 1000 · {tp}%</b><span className="bar mt-1 block"><i style={{ width: `${tp}%`, background: tp < 20 ? "#ef4444" : "#0ea5e9" }} /></span><span className="mt-1 block text-[11px] text-slate">{nepa.out ? (p.owned.includes("fridge") ? `Fridge on the Power Tank: about ${Math.max(0, (s.tank / C.POWER_TANK.fridgeW)).toFixed(1)} game hours left.` : "Ready for the lights when the Power GO is empty.") : "Charging from NEPA."}{panels ? ` ☀️ ${panels} × 650W panel${panels === 1 ? "" : "s"}: charges by day.` : ""}</span></div></div>
          {panels < 2 && <button onClick={() => setPanel("itel")} className="mt-2 text-[11px] font-bold text-[#e8173f] underline">Add a 650W bifacial panel ({C.fmtShort(C.ITEM("solar_650")!.price)} each, it takes two)</button>}</div>; })()}
        {gen ? <div className="mt-3 rounded-2xl border p-3"><div className="flex items-center justify-between"><b className="text-sm">{gen.icon} {gen.name}</b><b className="text-xs">{s.fuel.toFixed(1)} / {gen.tank} L</b></div><span className="bar mt-1 block"><i style={{ width: `${(s.fuel / (gen.tank ?? 5)) * 100}%`, background: "#f59e0b" }} /></span>
          <div className="mt-2 flex flex-wrap gap-2">{src === "gen" ? <Btn tone="ghost" onClick={() => genSwitch(false)}>Switch off</Btn> : <Btn tone="green" onClick={() => genSwitch(true)} disabled={!nepa.out || s.fuel <= 0}>Pull the cord</Btn>}
            {[1, 3, gen.tank ?? 5].map((l) => <Btn key={l} tone="ghost" onClick={() => buyFuel(Math.min(l, Math.floor((gen.tank ?? 5) - s.fuel) || 1))}>⛽ {l} L · {C.fmtShort(l * C.FUEL_NAIRA)}</Btn>)}</div>
          <p className="mt-1 text-[10px] text-slate">Petrol {C.fmtN(C.FUEL_NAIRA)} a litre. Loud: the neighbours hear it.</p></div>
          : <div className="mt-3"><Row icon="⛽" title="No generator" note="“I Better Pass My Neighbour” from the market" right={<b>{C.fmtShort(C.ITEM("gen_small")!.price)}</b>} onClick={() => setPanel({ shop: "power" })} /></div>}
      </div>);
    }
    if (panel === "itel" || panel === "product") {
      const items = C.ITEMS.filter((i) => i.brand === "itel");
      const goItem = C.ITEM("power_go")!;
      const real = <a href={C.ITEL.sellerUrl} target="_blank" rel="noreferrer" className="mt-3 flex gap-3 rounded-2xl border border-[#e8173f]/30 bg-[#fff1f3] p-2.5"><img src="/images/life/partners/itel-powergo.webp" alt="" className="h-16 w-14 shrink-0 object-contain" /><span className="min-w-0 text-[11px]"><b className="block text-[12px]">Get the real Power GO Pro</b>From @{C.ITEL.seller}, the itel distributor on NotesApp. CarlCare after-sales with replacement warranty.<span className="mt-1 block font-bold text-[#e8173f] underline">Shop @{C.ITEL.seller} on NotesApp ↗</span></span></a>;
      const staff = C.isStaff(p.jobId, "itel"), cost = (i: C.Item) => (staff ? Math.round(i.price * (1 - C.STAFF_PERKS.itelDiscount)) : i.price);
      if (panel === "product") return (<div>{close}<div className="flex gap-4"><img src="/images/life/partners/itel-powergo.webp" alt="" className="h-32 w-24 shrink-0 object-contain" /><div><img src="/images/life/partners/itel-logo.svg" alt="itel" className="h-7" /><h2 className="mt-1 text-2xl font-extrabold leading-tight">Power GO Pro</h2><p className="text-xs text-slate">320Wh · 200W max output · 100% grade A cells</p><p className="mt-2 text-xl font-extrabold">{C.fmtN(goItem.price)}</p></div></div>
        <p className="mt-3 text-[11px] font-bold uppercase tracking-wider text-slate">In a power cut it runs</p>
        <div className="mt-1 grid grid-cols-3 gap-1.5 text-center text-[11px]">{C.RUNTIMES.map(([i, a, b]) => <div key={b} className="rounded-2xl bg-[#7a0f1f] p-2 text-white"><span className="text-lg">{i}</span><b className="block text-sm">{a}</b><span className="opacity-80">{b}</span></div>)}</div>
        <p className="mt-3 text-[11px] text-slate">In the game: when NEPA takes light, your lamp, fan and laptop stay on and desk work keeps paying. The battery goes down as you use it and fills again when light returns, or by day with the solar panel.</p>
        <div className="mt-3 grid grid-cols-2 gap-2">{p.owned.includes("power_go") ? <Btn tone="ghost" onClick={() => setPanel("power")}>✓ Owned · see power</Btn> : <Btn tone="red" onClick={() => buy(goItem)}>Buy · {C.fmtShort(cost(goItem))}</Btn>}<Btn tone="ghost" onClick={() => setPanel("itel")}>All itel products</Btn></div>{real}</div>);
      return (<div>{close}{brandHead("itel")}{brandTabs("itel", "main")}<h2 className="mt-3 text-xl font-extrabold">The sun is free. Why not use it?</h2><p className="text-xs text-slate">Keep your lamp, fan, laptop and fridge going through a power cut. Silent, no fuel, no fumes.{staff ? ` Staff price: ${Math.round(C.STAFF_PERKS.itelDiscount * 100)}% off.` : ""}</p>
        <div className="mt-3 grid gap-2">{items.map((i) => { const own = p.owned.includes(i.id); return <Row key={i.id} icon={i.id === "power_go" ? <img src="/images/life/partners/itel-powergo.webp" alt="" className="h-10 w-10 object-contain" /> : i.icon} title={<>{i.name.replace(/^itel (.)/, (_, c: string) => c.toUpperCase())}{eco(i.eco)}</>} note={i.note} pick={i.id === "power_go" && !own} onClick={i.id === "power_go" ? () => setPanel("product") : undefined}
          right={own ? <span className="rounded-full bg-slate-200 px-2 py-0.5 font-bold">Owned</span> : i.soon ? <span className="text-slate"><b className="block">{C.fmtShort(i.price)}</b>soon</span> : <button disabled={busy} onClick={(e) => { e.stopPropagation(); void buy(i); }} className="rounded-full bg-[#e8173f] px-3 py-1 font-bold text-white disabled:opacity-40">{C.fmtShort(cost(i))}</button>} />; })}</div>
        {nepa.out && <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-[11px] text-amber-900">⚡ NEPA has taken light right now. Solar homes never noticed.</p>}{real}</div>);
    }
    if (chatId) {
      const r = C.RESIDENT(chatId);
      if (!r) return null;
      const tNow = Date.now() + offset.current;
      return (<div>{close}<div className="flex items-center gap-3">{r.photo ? <img src={r.photo} alt="" className="h-14 w-14 shrink-0 rounded-full object-cover ring-2 ring-amber-400" /> : <span className="flex h-14 w-14 items-center justify-center rounded-full text-lg font-bold text-white" style={{ background: r.look[0] }}>{r.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}</span>}<div><b className="block text-lg leading-tight">{r.name}</b><span className="text-[11px] text-slate">🤖 Resident · {r.role}</span>{r.id === "cynthia" && <span className="mt-0.5 block text-[11px] font-bold text-amber-700">👑 #1 on the Billionaires List · {C.fmtShort(r.netWorth ?? 0)}</span>}</div></div>
        <div className="mt-3 max-h-64 space-y-2 overflow-y-auto text-sm">{chat.length === 0 ? <p className="max-w-[85%] rounded-2xl rounded-tl-sm bg-slate-100 px-3 py-2">{r.lines.greet[0]}</p> : chat.map((l, i) => <p key={i} className={`max-w-[85%] rounded-2xl px-3 py-2 ${l.me ? "ml-auto rounded-tr-sm bg-emerald-500 text-white" : "rounded-tl-sm bg-slate-100"}`}>{l.text}</p>)}</div>
        <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold">{TOPICS.map((t) => <button key={t.id} onClick={() => askResident(r.id, t.id)} className="rounded-full border px-3 py-1.5">{t.label}</button>)}</div>
        {r.id === "cynthia" && cynthiaBox(tNow)}
        <p className="mt-2 text-[10px] text-slate">Residents are computer players, marked 🤖. Chats with them stay on this device only.</p></div>);
    }
    if (panel && typeof panel === "object" && "player" in panel) {
      const o = panel.player;
      return (<div>{close}<div className="flex items-center gap-3">{o.avatar ? <img src={o.avatar} alt="" className="h-14 w-14 rounded-full object-cover" /> : <span className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-lg font-bold">{o.name[0]}</span>}<div><b className="block text-lg leading-tight">{o.name}</b><span className="text-[11px] text-slate">👤 Real player · @{o.username} · here now</span></div></div>
        <p className="mt-3 text-sm text-slate">{o.name.split(" ")[0]} is at the same place as you. {friendsRef.current.has(o.uid) ? "You follow each other, so you can chat right here in the game." : "Say hello: it opens a real NotesApp chat. Follow each other on NotesApp to chat in the game for Social."}</p>
        <div className="mt-3 grid grid-cols-2 gap-2">{friendsRef.current.has(o.uid)
          ? <button onClick={() => openChat({ uid: o.uid, username: o.username, name: o.name, avatar: o.avatar })} className="rounded-full bg-ink py-2.5 text-center text-sm font-bold text-white">💬 Chat here · +{CHAT_SOCIAL.here} Social</button>
          : <a href={`/messages/new?to=${encodeURIComponent(o.username)}`} target="_blank" rel="noreferrer" className="rounded-full bg-ink py-2.5 text-center text-sm font-bold text-white">💬 Message</a>}<a href={`/u/${encodeURIComponent(o.username)}`} target="_blank" rel="noreferrer" className="rounded-full border py-2.5 text-center text-sm font-bold">View profile</a></div>
        <p className="mt-2 text-[10px] text-slate">Messages follow the usual NotesApp rules: anyone can block or report.</p></div>);
    }
    if (panel === "friends") return friendsPanel(close);
    if (panel === "dw") return dwPanel(close);
    if (panel === "invite") return invitePanel(close);
    if (panel === "bank") return bankPanel(close);
    if (panel === "rich") return richPanel(close);
    if (panel === "settings") return settingsPanel(close);
    return null;

    // --- brands: a header and tabs (Eat or Shop or Services · Jobs · Partner), job rows, partner outlets ---
    function brandHead(b: C.Brand) {
      if (b === "chef_adams") return <div className="flex items-center gap-2"><img src="/images/life/partners/chef-emblem.webp" alt="" className="h-12 w-12 object-contain" /><div><img src="/images/life/partners/chef-wordmark.webp" alt="Chef Adams" className="h-7 object-contain" /><span className="block text-[10px] text-slate">@chef_adams · Wuse, Abuja · <span className="font-bold">PARTNER</span></span></div></div>;
      if (b === "itel") return <div><div className="flex items-center gap-3"><img src="/images/life/partners/itel-logo.svg" alt="itel" className="h-9" /><span className="rounded-full bg-[#FF073C]/10 px-2 py-0.5 text-[10px] font-bold text-[#FF073C]">PARTNER</span></div><p className="mt-0.5 text-[10px] text-slate">{C.ITEL.note}</p></div>;
      return <div className="flex items-center gap-3"><img src="/images/life/partners/candellux-logo.webp" alt="" className="h-12 w-12 rounded-full object-cover" /><div><p className="font-serif text-xl font-bold italic leading-tight text-[#262b6b]">Candellux</p><p className="text-[11px] font-bold tracking-wider text-[#262b6b]">IMPERIAL HOTEL &amp; SUITES <span className="rounded-full bg-[#e3b23c]/20 px-1.5 py-0.5 text-[9px] text-[#8a6a12]">PARTNER</span></p><p className="text-[10px] text-slate">Garki, Abuja · {C.CANDELLUX.tagline}</p></div></div>;
    }
    function brandTabs(b: C.Brand, on: "main" | "jobs" | "partner" | "pool") {
      const col = b === "chef_adams" ? "#292929" : b === "itel" ? "#FF073C" : "#262b6b";
      const main: Panel = b === "chef_adams" ? "food" : b === "itel" ? "itel" : "hotel";
      const tabs: [string, "main" | "jobs" | "partner" | "pool", Panel][] = [[b === "chef_adams" ? "Eat" : b === "itel" ? "Shop" : "Services", "main", main], ...(b === "candellux" ? [["Pool", "pool", "hotelpool"] as [string, "pool", Panel]] : []), ["Jobs", "jobs", { jobs: b }], ...(b === "candellux" ? [] : [["Partner", "partner", { partner: b }] as [string, "partner", Panel]])];
      return <div className="mt-3 grid gap-1 rounded-full bg-slate-100 p-1 text-center text-xs font-bold" style={{ gridTemplateColumns: `repeat(${tabs.length},1fr)` }}>{tabs.map(([l, k, to]) => <button key={k} onClick={() => setPanel(to)} className="rounded-full py-1.5" style={k === on ? { background: col, color: "#fff" } : undefined}>{l}</button>)}</div>;
    }
    function jobRow(j: C.Job) {
      const block = C.jobBlocker(j, { owned: p.owned, cooking: p.cooking, chefShifts: p.chefShifts, itelShifts: p.itelShifts, hotelShifts: p.hotelShifts, reputation: p.reputation, fit: p.gymUntil > Date.now() + offset.current, swim: p.swimming, gymSessions: p.gymSessions, certs: p.certs });
      const icon = j.brand === "chef_adams" ? <img src="/images/life/partners/chef-emblem.webp" alt="" className="h-9 w-9 object-contain" /> : j.icon;
      return <Row key={j.id} icon={icon} title={<>{j.title}</>} note={<>{j.employer}{block ? <b className="block text-crimson">🔒 {block}</b> : j.ladder ? <span className="block">{j.ladder}</span> : null}</>}
        right={<><b className="block text-emerald-700">{j.pay ? `${C.fmtN(j.pay)}/shift` : ""}</b>{j.extra && <span className="block text-[10px] text-slate">+ {j.extra.label.toLowerCase()}</span>}{!block && !p.shift && <button disabled={busy} onClick={async () => { const r = await act<{ message: string }>({ action: "job_apply", job: j.id }); if (r) say(r.message, shareText(`I just got a job as ${j.title} in Notes Life 💼`)); }} className="mt-1 rounded-full bg-ink px-2.5 py-1 text-[11px] font-bold text-white">Take it</button>}</>} />;
    }
    function partnerCard(b: "chef_adams" | "itel") {
      const list = C.OUTLETS.filter((o) => o.brand === b);
      return <button onClick={() => setPanel({ partner: b })} className={`rounded-2xl border-2 p-2.5 text-left text-white ${b === "chef_adams" ? "border-[#F2B544] bg-[#292929]" : "border-[#FF073C] bg-[#1a0a0e]"}`}><p className={`text-[9px] font-bold uppercase tracking-widest ${b === "chef_adams" ? "text-[#F2B544]" : "text-[#ff6b86]"}`}>🤝 Become a Partner</p><b className="block text-[12px] leading-tight">Own {b === "chef_adams" ? "a Chef Adams" : "an itel"} outlet</b>{list.map((o) => <span key={o.id} className="block text-[10px] opacity-80">{o.short} from {C.fmtShort(o.price)}</span>)}</button>;
    }
    function partnerPanel(close: ReactNode, b: "chef_adams" | "itel") {
      const now = Date.now() + offset.current, chef = b === "chef_adams";
      const gold = chef ? "#F2B544" : "#ff6b86";
      const check: C.OutletCheck = { owned: p.owned, chefShifts: p.chefShifts, itelShifts: p.itelShifts, reputation: p.reputation, outlets: p.outlets };
      const list = C.OUTLETS.filter((o) => o.brand === b);
      const open = list.find((t) => !C.outletBlocker(t, check, now));
      return (<div>{close}{brandHead(b)}{brandTabs(b, "partner")}
        <div className={`mt-3 rounded-2xl border-2 p-3 text-white ${chef ? "border-[#F2B544] bg-[#292929]" : "border-[#FF073C] bg-[#1a0a0e]"}`}>
          <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: gold }}>🤝 Become a Partner</p><p className="text-[15px] font-bold">{chef ? "Own a Chef Adams outlet" : "Own an itel retail outlet"}</p>
          <p className="mt-1 text-[11px] opacity-80">{chef ? "One brand. Standardised recipes, training and quality control in every outlet." : "Sell itel phones, Power GO, Power Tank and solar. Stock from itel at partner prices, CarlCare after-sales behind you."}</p>
          <div className="mt-2 grid grid-cols-2 gap-1 rounded-full bg-white/10 p-1 text-center text-[11px] font-bold">{(Object.keys(C.OUTLET_AREAS) as C.OutletArea[]).map((a) => <button key={a} onClick={() => setOutletArea(a)} className="rounded-full py-1" style={outletArea === a ? { background: gold, color: "#111" } : undefined}>{C.OUTLET_AREAS[a].name}</button>)}</div>
          <div className="mt-2 grid gap-2">{list.map((t) => {
            const own = p.outlets.find((o) => o.kind === t.id), block = own ? null : C.outletBlocker(t, check, now);
            const n = t.needs, ok = (b2: boolean, txt: string) => <span key={txt} className={b2 ? "text-emerald-300" : "text-amber-200"}>{b2 ? "✔" : "🔒"} {txt}</span>;
            const reqs = [
              n.brandShifts ? ok(C.brandShifts(p, t.brand) >= n.brandShifts, `${n.brandShifts} ${C.BRAND_NAME[t.brand]} shifts (${C.brandShifts(p, t.brand)})`) : null,
              n.item ? ok(p.owned.includes(n.item), `own a ${C.ITEM(n.item)?.name.replace(/^itel /, "")}`) : null,
              n.outlet ? ok(!!p.outlets.find((o) => o.kind === n.outlet && now - o.openedAt >= (n.outletDays ?? 0) * C.GAME_DAY_MS), `run a ${C.OUTLET(n.outlet)!.short} ${n.outletDays} game days${n.quality ? ` at ${n.quality}%+` : ""}`) : null,
              n.reputation ? ok(p.reputation >= n.reputation, `reputation ${n.reputation}★`) : null,
            ].filter(Boolean);
            return <div key={t.id} className="rounded-2xl bg-white/10 p-2.5"><div className="flex items-center justify-between"><b className="text-[13px]">{t.icon} {t.short}</b><b style={{ color: gold }}>{own ? "Yours ✓" : C.fmtShort(C.outletPrice(t, outletArea))}</b></div>
              <div className="mt-1.5 grid grid-cols-3 gap-1 text-center text-[10px]"><span className="rounded-xl bg-white/10 p-1.5"><b className="block text-[12px]">~{C.fmtShort(C.outletProfitPerDay(t, outletArea, 90))}</b>profit a game day</span><span className="rounded-xl bg-white/10 p-1.5"><b className="block text-[12px]">{t.staff} staff</b>residents 🤖</span><span className="rounded-xl bg-white/10 p-1.5"><b className="block text-[12px]">~{Math.round(C.outletPrice(t, outletArea) / C.outletProfitPerDay(t, outletArea, 90))} days</b>to pay back</span></div>
              <p className="mt-1.5 flex flex-wrap gap-x-2 text-[10px]">{reqs}</p>
              {own ? <button onClick={() => setPanel({ outlet: t.id })} className="mt-2 w-full rounded-full bg-white py-1.5 text-xs font-extrabold text-ink">Manage your {t.short} →</button>
                : !block && <button disabled={busy} onClick={() => openOutlet(t.id, outletArea)} className="mt-2 w-full rounded-full py-2 text-sm font-extrabold disabled:opacity-40" style={{ background: gold, color: "#111" }}>Open · {C.fmtN(C.outletPrice(t, outletArea))}</button>}</div>;
          })}</div>
          {!open && !list.some((t) => p.outlets.find((o) => o.kind === t.id)) && <p className="mt-2 text-[10px] opacity-80">Work shifts at {C.BRAND_NAME[b]} to qualify: <button className="font-bold underline" onClick={() => setPanel({ jobs: b })}>see the jobs</button>.</p>}
          <p className="mt-2 text-[10px] opacity-80">{chef ? `Chef Adams keeps ${Math.round(C.OUTLETS[0].feeRate * 100)}% of sales as the brand fee.` : "itel earns from the stock you buy at partner prices."} Takings wait up to {C.OUTLET_HOLD_DAYS} game days (about a real day). Without backup power an outlet sells half in a blackout.</p>
        </div>
        <a href={C.REAL_PARTNER[b]} target="_blank" rel="noreferrer" className={`mt-3 flex items-center justify-between rounded-2xl border p-3 text-[12px] ${chef ? "border-[#F2B544] bg-[#fffbeb]" : "border-[#FF073C]/30 bg-[#fff1f3]"}`}><span><b className="block">Become a real partner ↗</b>{chef ? "Own a Chef Adams franchise in your choice location" : "Open a real itel Home store"}</span><span className="text-lg">🤝</span></a>
        <p className="mt-2 text-center text-[10px] text-slate">Your outlet appears in Notesville with your name on it, and its value counts on the Billionaires List.</p></div>);
    }
    function outletPanel(close: ReactNode, kind: C.OutletKind) {
      const t = C.OUTLET(kind)!, o = p.outlets.find((x) => x.kind === kind);
      if (!o) return partnerPanel(close, t.brand);
      const now = Date.now() + offset.current, r = C.outletTakings(o, now), chef = t.brand === "chef_adams";
      const day = Math.floor((now - o.openedAt) / C.GAME_DAY_MS) + 1, nextInspect = 7 - ((day - 1) % 7);
      const up = C.OUTLETS.find((x) => x.needs.outlet === kind);
      const staff = Array.from({ length: t.staff }, (_, i) => C.OUTLET_STAFF[(i + (chef ? 0 : 3)) % C.OUTLET_STAFF.length]);
      return (<div>{close}<div className="flex items-center gap-3">{chef ? <img src="/images/life/partners/chef-emblem.webp" alt="" className="h-11 w-11 object-contain" /> : <img src="/images/life/partners/itel-logo.svg" alt="itel" className="h-8" />}<div><p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: chef ? "#E53935" : "#FF073C" }}>Your outlet · day {day}</p><h2 className="text-xl font-extrabold leading-tight">{p.name.split(" ")[0]}&apos;s {t.short} · {C.OUTLET_AREAS[o.area].name}</h2></div></div>
        <div className={`mt-3 rounded-2xl p-3 text-white ${chef ? "bg-[#292929]" : "bg-[#1a0a0e]"}`}><div className="flex items-end justify-between gap-2"><div><span className="text-[10px] opacity-75">Takings waiting</span><b className="block text-2xl">{C.fmtN(r.takings)}</b><span className="text-[10px] opacity-75">{r.capped ? `Held ${C.OUTLET_HOLD_DAYS} game days: it stopped selling until you collect` : `${r.days.toFixed(1)} game days · after ${chef ? "the brand fee, stock" : "itel stock"} and wages`}</span></div><button disabled={busy || r.takings <= 0} onClick={() => collect(kind)} className="rounded-full px-4 py-2 text-sm font-extrabold text-ink disabled:opacity-40" style={{ background: chef ? "#F2B544" : "#ff6b86" }}>Collect</button></div>
          <div className="mt-2 grid grid-cols-4 gap-1 text-center text-[10px]">{[[String(r.customers), "customers a day"], [`${Math.round(r.quality)}%`, "quality"], [C.fmtShort(C.outletValue(o)), "value"], [C.fmtShort(o.earned), "earned"]].map(([a2, b2]) => <span key={b2} className="rounded-xl bg-white/10 p-1.5"><b className="block text-[12px]">{a2}</b>{b2}</span>)}</div></div>
        {r.quality < 80 && <p className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-[11px] text-red-800">Quality is slipping: takings have sat uncollected too long. Collect to bring it back up.</p>}
        <p className="mt-3 text-[11px] font-bold uppercase tracking-wider text-slate">Staff · {t.staff} residents 🤖</p>
        <div className="mt-1 flex flex-wrap gap-1.5 text-[11px]">{staff.map((n, i) => <span key={i} className="rounded-full bg-slate-100 px-2.5 py-1">{n} 🤖 · {t.staffRole} · {C.fmtN(t.wage)}/day</span>)}</div>
        <p className="mt-3 text-[11px] font-bold uppercase tracking-wider text-slate">Power</p>
        <div className="mt-1">{o.backup ? <Row icon="🔋" title="Backup power fitted" note={`${C.OUTLET_BACKUP.name}: sells through every blackout`} right={<b className="text-emerald-700">OK</b>} />
          : <Row icon="⚡" title={nepa.out ? "NEPA has taken light: selling half" : "No backup power"} note={`Fit ${C.OUTLET_BACKUP.name}: full sales in blackouts, quality up`} right={<button disabled={busy} onClick={() => outletBackup(kind)} className="rounded-full bg-[#FF073C] px-3 py-1 font-bold text-white disabled:opacity-40">{C.fmtShort(C.OUTLET_BACKUP.price)}</button>} pick={nepa.out} />}</div>
        <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-[11px] text-slate">🔍 {C.BRAND_NAME[t.brand]} inspection in {nextInspect} game day{nextInspect === 1 ? "" : "s"}: {chef ? "standard recipes, hygiene and stock" : "stock, displays and CarlCare service"}. Keep quality at 80% or more.</p>
        {up && !p.outlets.some((x) => x.kind === up.id) && <div className="mt-3 rounded-2xl border-2 border-dashed p-2.5 text-[11px]" style={{ borderColor: chef ? "#F2B544" : "#FF073C" }}><b>Next: {up.icon} {up.short} · from {C.fmtShort(up.price)}.</b> {C.outletBlocker(up, { owned: p.owned, chefShifts: p.chefShifts, itelShifts: p.itelShifts, reputation: p.reputation, outlets: p.outlets }, now) ?? "You qualify now."} <button className="font-bold underline" onClick={() => setPanel({ partner: t.brand })}>See it</button></div>}
      </div>);
    }
    function businessPanel(close: ReactNode) {
      const now = Date.now() + offset.current;
      const rows = p.outlets.map((o) => ({ o, t: C.OUTLET(o.kind)!, r: C.outletTakings(o, now) }));
      const total = rows.reduce((n, x) => n + x.r.takings, 0);
      return (<div>{close}<p className="text-[11px] font-bold uppercase tracking-widest text-amber-600">🏪 My businesses</p><h2 className="text-2xl font-extrabold">{rows.length ? `${C.fmtN(total)} to collect` : "No outlets yet"}</h2>
        <p className="text-xs text-slate">Takings wait up to {C.OUTLET_HOLD_DAYS} game days (about a real day). After that an outlet stops selling until you collect.</p>
        <div className="mt-3 grid gap-2">{rows.map(({ o, t, r }) => <Row key={o.kind} icon={t.brand === "chef_adams" ? <img src="/images/life/partners/chef-emblem.webp" alt="" className="h-9 w-9 object-contain" /> : <img src="/images/life/partners/itel-logo.svg" alt="itel" className="h-6" />} title={`${t.name} · ${C.OUTLET_AREAS[o.area].name}`} note={`Quality ${Math.round(r.quality)}% · ${r.customers} customers a day${o.backup ? " · 🔋 backup" : ""}`} pick={r.takings > 0} onClick={() => setPanel({ outlet: o.kind })}
          right={<b className="block">{C.fmtShort(r.takings)}</b>} />)}
          {C.OUTLETS.filter((t) => !t.needs.outlet && !p.outlets.some((o) => o.kind === t.id)).map((t) => <Row key={t.id} icon={t.icon} title={`${t.name}`} note={C.outletBlocker(t, { owned: p.owned, chefShifts: p.chefShifts, itelShifts: p.itelShifts, reputation: p.reputation, outlets: p.outlets }, now) ?? "You qualify: open one"} right={<b className="text-slate">{C.fmtShort(t.price)}</b>} onClick={() => setPanel({ partner: t.brand as "chef_adams" | "itel" })} />)}
        </div>
        {rows.length > 0 && <div className="mt-3"><Btn tone="green" disabled={total <= 0} onClick={() => collect()}>Collect everything · {C.fmtN(total)}</Btn></div>}
        <div className="mt-3 grid grid-cols-3 gap-1.5 text-center text-[10px]">{[[C.fmtShort(p.outlets.reduce((n, o) => n + C.outletValue(o), 0)), "outlets' value"], [C.fmtShort(p.outlets.reduce((n, o) => n + o.earned, 0)), "earned so far"], [String(p.outlets.length), `outlet${p.outlets.length === 1 ? "" : "s"}`]].map(([a2, b2]) => <span key={b2} className="rounded-2xl bg-slate-50 p-2"><b className="block text-[13px]">{a2}</b>{b2}</span>)}</div>
        <p className="mt-2 text-[10px] text-slate">Outlets are staffed by residents 🤖. Real players work shifts at the brands&apos; own outlets.</p></div>);
    }

    // --- bigger panels (their state is held at the top of the game) ---
    function goPanel(close: ReactNode, dests: typeof C.PLACES) {
      const to: C.PlaceId = goTo && dests.some((d) => d.id === goTo) ? goTo : dests[0]?.id ?? "home";
      const setTo = setGoTo;
      const modes = C.TRANSPORT.filter((t) => !t.needs || p.owned.includes(t.needs));
      return (<div>{close}<p className="text-[11px] font-bold uppercase tracking-widest text-teal-700">🗺 Go</p><h2 className="text-xl font-extrabold">Where to?</h2>
        <div className="mt-2 flex flex-wrap gap-1.5 text-xs font-semibold">{dests.map((d) => <button key={d.id} onClick={() => setTo(d.id)} className={`rounded-full px-3 py-1 ${to === d.id ? "bg-ink text-white" : "border"}`}>{d.icon} {d.name} · {d.area}</button>)}</div>
        <div className="mt-3 grid gap-2">{modes.map((t) => <Row key={t.id} icon={t.icon} title={t.name} note={`${t.minutes} game min · ${t.note}${t.energy ? ` · ⚡ ${t.energy}` : ""}`} right={<><b className="block">{t.price ? C.fmtN(t.price) : "Free"}</b>{eco(t.eco)}</>} onClick={() => travel(t.id, to)} />)}</div>
        {!p.owned.includes("ebike") && <p className="mt-3 text-center text-[11px] text-slate">Later: your own <button className="underline" onClick={() => setPanel({ shop: "transport" })}>e-bike or electric car</button>.</p>}</div>);
    }
    function foodPanel(close: ReactNode) {
      const atChef = s.place === "chef";
      const mode = foodMode, setMode = setFoodMode;
      const fm = C.FOOD_MODES[mode];
      const total = Object.entries(cart).reduce((n, [id, q]) => n + (C.FOOD(id)?.price ?? 0) * q, 0) + fm.fee;
      const groups: [string, C.Food["group"]][] = [["Chef's combo", "combo"], ["Rice & noodles", "rice"], ["Protein", "protein"], ["Sides", "side"], ["Shawarma & pizza", "fast"], ["Sum Ting Fresh 🍌", "fresh"]];
      return (<div>{close}
        {brandHead("chef_adams")}{brandTabs("chef_adams", "main")}
        <div className="mt-3 grid grid-cols-3 gap-1 rounded-full bg-slate-100 p-1 text-center text-[11px] font-bold">{(Object.keys(C.FOOD_MODES) as C.FoodMode[]).map((k) => <button key={k} onClick={() => setMode(k)} className={`rounded-full py-1.5 ${k === mode ? "bg-[#E53935] text-white" : ""}`}>{C.FOOD_MODES[k].icon} {C.FOOD_MODES[k].label}</button>)}</div>
        <p className="mt-2 text-[11px] text-slate">{fm.where} · {fm.minutes} game min{fm.fee ? ` · ${C.fmtN(fm.fee)} delivery` : ""}{mode === "dinein" ? " · Fun +10 · Social +5" : ""}</p>
        {mode !== "delivery" && !atChef ? <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900">You&apos;re not at Chef Adams. <button className="font-bold underline" onClick={() => setPanel("go")}>Go there</button>, or order delivery.</p> : (
          <>
            {groups.map(([title, g]) => <div key={g}><p className="mt-2 text-[10px] font-bold uppercase tracking-wider text-slate">{title}</p><div className="mt-1 grid gap-1">{C.FOODS.filter((f) => f.group === g).map((f) => (
              <div key={f.id} className="flex items-center gap-2 rounded-xl border border-slate-200 px-2 py-1.5 text-[12px]"><span className="min-w-0 flex-1"><b className="block leading-tight">{f.name}</b><span className="text-[10px] text-emerald-700">🍲 +{f.hunger}</span></span><b className="text-[11px]">{C.fmtN(f.price)}</b>
                <button onClick={() => setCart((c) => ({ ...c, [f.id]: Math.max(0, (c[f.id] || 0) - 1) }))} className="h-6 w-6 rounded-full border font-bold">−</button><b className="w-4 text-center">{cart[f.id] || 0}</b><button onClick={() => setCart((c) => ({ ...c, [f.id]: (c[f.id] || 0) + 1 }))} className="h-6 w-6 rounded-full bg-[#E53935] font-bold text-white">+</button></div>
            ))}</div></div>)}
            <div className="mt-3 rounded-2xl bg-[#292929] p-3 text-white">
              {mode !== "dinein" && <label className="mb-2 flex items-center gap-2 text-[11px]"><input type="checkbox" checked={keepFood} onChange={(e) => setKeepFood(e.target.checked)} className="h-4 w-4 accent-[#F2B544]" /><span><b>🧊 Keep for later</b> · {p.owned.includes("fridge") ? "into your fridge" : `no fridge: eat within ${C.FOOD_SPOIL_HOURS} game hours`}</span></label>}
              <button disabled={busy} onClick={() => order(mode, cart, keepFood && mode !== "dinein")} className="block w-full rounded-full bg-[#E53935] py-2 text-center text-sm font-bold disabled:opacity-40">Order · {C.fmtN(total)}</button></div>
          </>
        )}
        <p className="mt-2 text-center text-[10px] text-slate">Craving it for real? <a href="/u/chef_adams" target="_blank" rel="noreferrer" className="font-bold text-[#E53935]">@chef_adams</a> is on NotesApp ↗ · Satisfaction in every bite.</p></div>);
    }
    // --- Digital Witch: courses, certificates and the tech jobs they open ---
    function dwPanel(close: ReactNode) {
      const tNow = Date.now() + offset.current, open = C.dwOpen(tNow), here = s.place === "dw", busyNow = !!s.activity;
      const nextClassAt = p.dwClassAt + C.DW_CLASS_MS;
      const NAVY = "#0b1442";
      const head = <div className="flex items-center gap-3"><img src="/images/life/partners/digitalwitch-logo.webp" alt="Digital Witch" className="h-12 w-12 rounded-xl object-cover" /><div><p className="text-lg font-extrabold leading-tight" style={{ color: NAVY }}>Digital Witch</p><p className="text-[11px] text-slate">Training Hub · Skyscraper Plaza, CBD · <b>PARTNER</b></p></div></div>;
      const tabs = <div className="mt-3 grid grid-cols-3 gap-1 rounded-full bg-slate-100 p-1 text-center text-xs font-bold">{([["courses", "Courses"], ["certs", "My certificates"], ["jobs", "Jobs"]] as const).map(([k, l]) => <button key={k} onClick={() => setDwTab(k)} className={`rounded-full py-1.5 ${dwTab === k ? "text-white" : ""}`} style={dwTab === k ? { background: NAVY } : undefined}>{l}</button>)}</div>;
      const where = !here ? <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900">Classes happen at the hub. <button className="font-bold underline" onClick={() => setPanel("go")}>Go to the Digital Witch hub (CBD)</button></p> : !open ? <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900">The hub is closed. Classes run {C.DW_HOURS.from} AM to {C.DW_HOURS.to - 12} PM.</p> : null;
      const courseRow = (c: C.Course) => {
        const enrolled = c.id in p.dwCourses, done = p.dwCourses[c.id] ?? 0, cert = p.certs.includes(c.id), j = C.JOB(c.job);
        const right = cert ? <b className="text-emerald-700">🎓 Certified</b>
          : !enrolled ? <button disabled={busy} onClick={() => act({ action: "dw_enroll", course: c.id }).then((r) => r && say(`🎓 ${(r as { message?: string }).message ?? "Enrolled."}`))} className="rounded-full px-3 py-1 font-bold text-white disabled:opacity-40" style={{ background: NAVY }}>{C.fmtN(c.price)}</button>
          : <button disabled={busy || !here || !open || busyNow || tNow < nextClassAt - 3000} onClick={() => dwClass(c)} className="rounded-full bg-emerald-600 px-3 py-1 font-bold text-white disabled:opacity-40">Class {done + 1} of {c.classes}</button>;
        return <Row key={c.id} icon={c.icon} title={`${c.name} · ${c.classes} classes`} note={<>{enrolled && !cert ? <b className="block" style={{ color: NAVY }}>{done} of {c.classes} done</b> : null}Unlocks {j?.title} · {C.fmtN(j?.pay ?? 0)} a shift{j?.needItem ? " · needs a laptop" : ""}</>} pick={enrolled && !cert} right={right} />;
      };
      return (<div>{close}{head}{tabs}
        {dwTab === "courses" && <>
          <p className="mt-3 text-xs text-slate">On-demand tech skills with Ekwutosi Cynthia Okeh&apos;s team. One class is {C.DW_CLASS_HOURS} game hours at the hub (Energy −10, Fun +5). Finish every class to get <b>Digital Witch certified</b>: tech jobs need it.</p>
          {where}
          <div className="mt-3 grid gap-2">{C.DW_COURSES.map(courseRow)}</div>
          <div className="mt-3 rounded-2xl p-3 text-[11px] text-white" style={{ background: NAVY }}><b>Learn for real:</b> Digital Witch has trained {C.DIGITAL_WITCH.learners} learners. <a href={C.DIGITAL_WITCH.site} target="_blank" rel="noreferrer" className="underline">digitalwitchng.com ↗</a> · <a href={`https://wa.me/${C.DIGITAL_WITCH.whatsapp}?text=${encodeURIComponent("Hello Digital Witch, I'd like to learn a tech skill (I found you on Notes Life).")}`} target="_blank" rel="noreferrer" className="underline">WhatsApp {C.DIGITAL_WITCH.whatsappLabel} ↗</a></div>
        </>}
        {dwTab === "certs" && <div className="mt-3">{p.certs.length === 0 ? <p className="text-sm text-slate">No certificates yet. Pick a course and finish its classes.</p> : <div className="grid gap-2">{p.certs.map((id) => { const c = C.DW_COURSE(id)!; return <Row key={id} icon="🎓" title={`Digital Witch certified · ${c.name}`} note={`Opens ${C.JOB(c.job)?.title}`} right={<button onClick={() => setDwTab("jobs")} className="font-bold underline">Jobs</button>} />; })}</div>}
          <div className="mt-3 rounded-2xl bg-amber-50 p-3 text-[11px]"><b className="block text-[12px]">🎁 Cynthia&apos;s graduate giveaway</b><span className="text-slate">Saturday nights, 7 PM to 11 PM, at the Candellux VIP bar: N$ 500,000 or N$ 1,000,000 for some graduates who are doing well (a certificate and {C.GIVEAWAY.needTechShifts} tech shifts). You: {p.certs.length ? <b className="text-emerald-700">certified ✓</b> : "no certificate yet"} · <b>{Math.min(p.techShifts, C.GIVEAWAY.needTechShifts)} of {C.GIVEAWAY.needTechShifts} tech shifts</b></span></div></div>}
        {dwTab === "jobs" && <div className="mt-3 grid gap-1.5">{C.JOBS.filter((j) => j.tech).map(jobRow)}</div>}
      </div>);
    }
    function cynthiaBox(tNow: number) {
      const at = C.cynthiaAt(tNow), on = C.giveawayOn(tNow), ok = C.giveawayEligible(p.certs, p.techShifts);
      return (<><div className="mt-3 rounded-2xl bg-amber-50 p-3 text-[11px]"><b className="block text-[12px]">🎁 {on ? "Her graduate giveaway is on now, at the Candellux VIP bar" : `Next giveaway: Saturday night at the Candellux VIP bar`}</b><span className="text-slate">For Digital Witch graduates who are doing well: a certificate and {C.GIVEAWAY.needTechShifts} tech shifts. You: {p.certs.length ? <b className="text-emerald-700">certified ✓</b> : "no certificate yet"} · <b>{Math.min(p.techShifts, C.GIVEAWAY.needTechShifts)} of {C.GIVEAWAY.needTechShifts} tech shifts</b></span>
        {on && at === "hotel" && <div className="mt-2"><Btn tone="green" disabled={s.place !== "hotel" || !ok} onClick={giveaway}>🎁 Go up to Cynthia</Btn></div>}</div>
        <div className="mt-2 rounded-2xl bg-slate-50 p-3 text-[11px] text-slate"><b className="text-ink">Where to find her:</b> the Digital Witch hub 9 AM to 5 PM · the Candellux VIP bar 7 PM to 11 PM. <button className="font-bold text-ink underline" onClick={() => { setDwTab("courses"); setPanel("dw"); }}>Digital Witch courses</button></div></>);
    }
    function friendsPanel(close: ReactNode) {
      const list = friendList;
      const message = (f: Friend) => openChat({ uid: f.uid, username: f.username, name: f.name, avatar: f.avatar });
      const hereNow = new Set(others.map((o) => o.uid));
      return (<div>{close}<p className="text-lg font-extrabold">👥 Friends</p><p className="text-[11px] text-slate">People on NotesApp you follow who follow you back. Chat right here: +{CHAT_SOCIAL.send} Social a message, +{CHAT_SOCIAL.reply} when they reply, +{CHAT_SOCIAL.here} at the same place (up to +{CHAT_SOCIAL.perHour} an hour).</p>
        {!list ? <p className="mt-3 text-sm text-slate">Loading…</p> : list.length === 0 ? <p className="mt-3 text-sm text-slate">No friends here yet. Invite people, and follow each other on NotesApp.</p> : (
          <ul className="mt-2 divide-y text-sm">{list.map((f) => <li key={f.uid} className="flex items-center gap-2.5 py-2.5">{f.avatar ? <img src={f.avatar} alt="" className="h-10 w-10 rounded-full object-cover" /> : <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-200 font-bold">{f.name[0]}</span>}
            <span className="min-w-0 flex-1"><b className="block leading-tight">{f.name}</b><span className="text-[10px] text-slate">@{f.username} · {hereNow.has(f.uid) ? "🟢 here with you" : f.plays ? `plays · ${C.fmtShort(f.netWorth)}` : "not playing yet"}</span></span>
            {(unreadBy[f.uid] ?? 0) > 0 && <span className="rounded-full bg-rose-600 px-2 py-0.5 text-[10px] font-extrabold text-white">{unreadBy[f.uid]} new</span>}
            <button onClick={() => message(f)} className="rounded-full bg-indigo-900 px-3 py-1.5 text-[11px] font-bold text-white" title="Chat here in the game">💬 Chat</button>
            {!f.plays && <a href={WA(`Join me on Notes Life, the NotesApp game! ${C.inviteLink(p.username)}`)} target="_blank" rel="noreferrer" className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100" title="Invite on WhatsApp">🎁</a>}</li>)}</ul>
        )}
        <p className="mt-2 text-[10px] text-slate">📞 Calls in the game (voice ₦5/min, video ₦10/min) are coming. Visiting rooms is coming too.</p>
        <div className="mt-3"><Btn tone="green" onClick={() => setPanel("invite")}>🎁 Invite friends</Btn></div></div>);
    }
    function invitePanel(close: ReactNode) {
      const link = C.inviteLink(p.username);
      const text = `Come play Notes Life with me, the free NotesApp life game: start in Abuja with N$ 100,000, get a job, eat at Chef Adams, ball out at Candellux 👑 ${link}`;
      const nav = typeof navigator !== "undefined" ? (navigator as Navigator & { contacts?: { select: (p: string[], o: { multiple: boolean }) => Promise<{ name?: string[]; tel?: string[] }[]> } }) : null;
      const canPick = !!nav?.contacts?.select;
      const pick = async () => { try { const c = await nav!.contacts!.select(["name", "tel"], { multiple: true }); setPicked(c.filter((x) => x.tel?.[0]).map((x) => ({ name: x.name?.[0] ?? x.tel![0], tel: x.tel![0] }))); } catch { /* cancelled */ } };
      const shareSheet = async () => { try { await navigator.share({ title: "Notes Life", text, url: link }); } catch { /* cancelled */ } };
      const bonus = `₦${(C.REFERRAL_BONUS_KOBO / 100).toLocaleString("en-NG")}`;
      const bonusOf = (n: number) => `₦${((n * C.REFERRAL_BONUS_KOBO) / 100).toLocaleString("en-NG")}`;
      return (<div>{close}<p className="text-[11px] font-bold uppercase tracking-widest text-pink-600">🎁 Invite friends</p><h2 className="text-xl font-extrabold">Play together, both get {bonus}</h2>
        <p className="mt-1 text-sm text-slate">When a friend joins with your link and finishes their first shift, you each get <b>{bonus} in Bonus Credits</b> in your NotesApp wallet (for boosts, badges and adverts). Up to {C.REFERRAL_MAX_PER_MONTH} friends a month. Invited so far: <b>{p.invitesDone}</b>.</p>
        <div className="mt-3 grid gap-2">
          {canPick && <Btn tone="green" onClick={pick}>📇 Invite from your contacts</Btn>}
          <a href={WA(text)} target="_blank" rel="noreferrer" className="rounded-full bg-[#25D366] px-4 py-2.5 text-center text-sm font-bold text-white">Share on WhatsApp</a>
          {typeof navigator !== "undefined" && "share" in navigator && <Btn tone="ghost" onClick={shareSheet}>More ways to share</Btn>}
          <Btn tone="ghost" onClick={() => { navigator.clipboard?.writeText(link).then(() => say("Link copied.")).catch(() => {}); }}>Copy my link</Btn>
        </div>
        {picked.length > 0 && <ul className="mt-3 divide-y rounded-2xl border text-sm">{picked.map((c) => <li key={c.tel} className="flex items-center gap-2 px-3 py-2"><span className="min-w-0 flex-1"><b className="block truncate">{c.name}</b><span className="text-[10px] text-slate">{c.tel}</span></span><a href={WA(text, ngPhone(c.tel))} target="_blank" rel="noreferrer" className="rounded-full bg-[#25D366] px-2.5 py-1 text-xs font-bold text-white">WhatsApp</a><a href={`sms:${c.tel}?body=${encodeURIComponent(text)}`} className="rounded-full border px-2.5 py-1 text-xs font-bold">SMS</a></li>)}</ul>}
        <p className="mt-2 break-all text-center font-mono text-[10px] text-slate">{link}</p>
        {!canPick && <p className="mt-1 text-center text-[10px] text-slate">Picking from your contacts works in Chrome on Android; on other phones, share on WhatsApp and choose your friends there.</p>}
        <div className="mt-4 flex items-baseline justify-between"><p className="text-[11px] font-bold uppercase tracking-wider text-slate">Your invites</p>{inviteList && <span className="text-[11px] text-slate">{inviteList.invites.length} joined · {inviteList.paid} paid · you earned <b className="text-emerald-700">{bonusOf(inviteList.paid)}</b></span>}</div>
        {!inviteList ? <p className="text-sm text-slate">Loading…</p> : inviteList.invites.length === 0 ? <p className="mt-1 rounded-2xl bg-slate-50 px-3 py-3 text-center text-xs text-slate">Nobody has joined from your link yet. Friends show up here as soon as they open Notes Life from it.</p> : (
          <ul className="mt-1 divide-y rounded-2xl border text-sm">{inviteList.invites.map((f) => (
            <li key={f.uid} className="flex items-center gap-2.5 px-3 py-2">{f.avatar ? <img src={f.avatar} alt="" className="h-9 w-9 rounded-full object-cover" /> : <span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-200 text-xs font-bold">{(f.name || f.username || "?")[0]}</span>}
              <span className="min-w-0 flex-1"><b className="block truncate leading-tight">{f.name || f.username}</b><span className="text-[10px] text-slate">@{f.username} · joined {f.joinedAt ? new Date(f.joinedAt).toLocaleDateString("en-NG", { day: "numeric", month: "short" }) : ""}</span></span>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${f.status === "paid" ? "bg-emerald-100 text-emerald-800" : f.status === "limit" ? "bg-slate-100 text-slate" : "bg-amber-100 text-amber-900"}`}>{f.status === "paid" ? `✓ ${bonus} each` : f.status === "shift" ? "Needs a first shift" : f.status === "verify" ? "Needs a verified email" : "Over the monthly limit"}</span></li>))}</ul>)}
        <p className="mt-2 text-[10px] text-slate">Bonus Credits show in your <a href="/profile/wallet" target="_blank" rel="noreferrer" className="font-semibold text-crimson underline">NotesApp wallet ↗</a> as “Invite bonus”. A friend who hasn&apos;t verified their email yet gets it, and so do you, after their next shift once they have.</p></div>);
    }
    function bankPanel(close: ReactNode) {
      const lines = bankLines, naira = buyAmt, setNaira = setBuyAmt;
      return (<div>{close}<p className="text-[11px] font-bold uppercase tracking-widest text-emerald-700">🏦 Central Bank of Notesville</p><h2 className="text-2xl font-extrabold">{C.fmtN(p.naira)}</h2><p className="text-xs text-slate">Notesville Naira · net worth {C.fmtShort(p.netWorth)}</p>
        <div className="mt-3 rounded-2xl border-2 border-crimson/20 p-3"><b className="text-sm">Buy N$ with NotesApp Credit</b><p className="text-[11px] text-slate">₦1 = N$ 100. Game money: it can&apos;t be turned back into naira. Purchases are final.</p>
          <div className="mt-2 flex flex-wrap gap-1.5">{[100, 500, 1_000, 3_500, 10_000].map((n) => <button key={n} onClick={() => setNaira(n)} className={`rounded-full px-3 py-1 text-xs font-bold ${naira === n ? "bg-ink text-white" : "border"}`}>₦{n.toLocaleString("en-NG")} → {C.fmtShort(n * 100)}</button>)}</div>
          <div className="mt-2 grid grid-cols-2 gap-2"><Btn tone="green" onClick={() => buyNaira(naira, "wallet")}>From my wallet</Btn><Btn tone="ghost" onClick={() => buyNaira(naira, "card")}>Card or bank</Btn></div>
          <a href="/profile/wallet" target="_blank" rel="noreferrer" className="mt-2 block text-center text-[11px] text-crimson underline">Top up your NotesApp wallet ↗</a></div>
        <p className="mt-3 text-[11px] font-bold uppercase tracking-wider text-slate">Statement</p>
        {!lines ? <p className="text-sm text-slate">Loading…</p> : <ul className="mt-1 divide-y text-sm">{lines.map((l) => <li key={l.id} className="flex justify-between py-1.5"><span className="min-w-0 truncate pr-2">{l.label}<span className="block text-[10px] text-slate">{new Date(l.at).toLocaleString("en-NG", { day: "numeric", month: "short", hour: "numeric", hour12: true, minute: "2-digit" })}</span></span><b className={l.amount > 0 ? "text-emerald-700" : ""}>{l.amount > 0 ? "+" : "−"}{C.fmtN(Math.abs(l.amount))}</b></li>)}</ul>}</div>);
    }
    function richPanel(close: ReactNode) {
      const data = rich, pop = richPop, setPop = setRichPop;
      const brag = data?.me?.rank ? `I'm #${data.me.rank} on the Notes Life Billionaires List with ${C.fmtShort(data.me.netWorth)} 😎` : "I'm climbing the Notes Life Billionaires List 😎";
      if (pop) return (<div className="text-center"><div className="text-5xl">🧑‍⚖️</div><h3 className="mt-2 text-xl font-extrabold">Welcome to the official <span className="rounded bg-ink px-1.5 text-white">[REDACTED BY LAWYERS]</span> Rich List!</h3><p className="mt-2 text-sm text-slate">Our lawyers asked us to call it the {C.RICH_TITLE}. Net worth = your Notesville Naira plus everything you own.</p><div className="mt-4"><Btn onClick={() => { setPop(false); update((x) => ({ ...x, seenRich: true })); }}>Show me the money</Btn></div></div>);
      return (<div>{close}<p className="text-[11px] font-bold uppercase tracking-widest text-amber-600">👑 {C.RICH_TITLE}</p><h2 className="text-2xl font-extrabold">{C.RICH_SUBTITLE}</h2><p className="text-xs text-slate">Net worth = Notesville Naira + what you own. 🤖 = resident (computer player).</p>
        <div className="mt-2 grid grid-cols-2 gap-1 rounded-full bg-slate-100 p-1 text-center text-[11px] font-bold">{[[false, "Everyone"], [true, "Real players only"]].map(([v, l]) => <button key={String(v)} onClick={() => setRichReal(v as boolean)} className={`rounded-full py-1.5 ${richReal === v ? "bg-ink text-white" : ""}`}>{l as string}</button>)}</div>
        {!data ? <p className="mt-3 text-sm text-slate">Loading…</p> : <ol className="mt-2 divide-y">{data.rows.map((r) => <li key={r.uid} className={`flex items-center gap-2.5 py-2 ${r.uid === p.uid ? "rounded-xl bg-amber-50 px-2" : ""}`}><b className={`w-6 text-center ${r.rank <= 3 ? "text-amber-600" : ""}`}>{r.rank}</b>{r.npc && r.avatar ? <img src={r.avatar} alt="" className="h-9 w-9 rounded-full object-cover ring-2 ring-amber-400" /> : r.npc ? <span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-200">🤖</span> : r.avatar ? <img src={r.avatar} alt="" className="h-9 w-9 rounded-full object-cover" /> : <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold">{r.name[0]}</span>}<span className="min-w-0 flex-1"><b className="block truncate text-sm">{r.name}</b><span className="text-[10px] text-slate">{r.npc ? `🤖 Resident · ${r.npc.role} ${r.npc.icons}` : `@${r.username} · Abuja ${r.owned.map((o) => C.ITEM(o)?.icon).join(" ")}`}</span></span><b className="text-sm">{C.fmtShort(r.netWorth)}</b></li>)}</ol>}
        {data?.me && <p className="mt-2 text-center text-xs">You: <b>#{data.me.rank}</b>{!richReal && data.me.realRank ? <> · <b>#{data.me.realRank}</b> of real players</> : null} · {C.fmtShort(data.me.netWorth)}</p>}
        <a href={WA(shareText(brag))} target="_blank" rel="noreferrer" className="mt-3 block rounded-full bg-amber-500 py-3 text-center font-bold text-white">😎 Brag on WhatsApp</a></div>);
    }
    function settingsPanel(close: ReactNode) {
      const restore = async (slot: string) => { if (!user || !confirm("Go back to this restore point? Your needs, place and looks go back; your money and what you own stay as they are.")) return; const st = await restorePoint(user.uid, slot); if (st) { setSave({ ...st, tickAt: Date.now() }); setPanel(null); say("Restored."); saveNow(); } };
      return (<div>{close}<p className="text-[11px] font-bold uppercase tracking-widest text-slate">⚙️ Settings</p><h2 className="text-xl font-extrabold">Your progress</h2>
        <div className="mt-3 flex items-center gap-3 rounded-2xl bg-emerald-50 p-3"><span className="text-2xl">☁️</span><span className="text-sm"><b className="block">{savedAt ? `Saved ${Math.max(1, Math.round((Date.now() - savedAt) / 1000))} seconds ago` : "Saved on this device"}</b>On this device and in your NotesApp account (@{p.username}). Sign in anywhere to carry on.</span></div>
        <p className="mt-3 text-[11px] font-bold uppercase tracking-wider text-slate">Difficulty</p>
        <div className="mt-1 grid grid-cols-3 gap-2">{(Object.keys(C.DIFFICULTY) as C.Difficulty[]).map((d) => <button key={d} onClick={() => update((x) => ({ ...x, difficulty: d }))} className={`rounded-2xl border-2 p-2 text-sm font-bold ${s.difficulty === d ? "border-ink" : "border-slate-200"}`}>{C.DIFFICULTY[d].icon} {C.DIFFICULTY[d].label}</button>)}</div>
        <p className="mt-1 text-[10px] text-slate">Harder means needs drop faster.</p>
        <div className="mt-3 flex items-center justify-between"><p className="text-[11px] font-bold uppercase tracking-wider text-slate">Sound</p>
          <button onClick={() => setSoundPrefs((x) => ({ ...x, on: !x.on }))} className={`rounded-full px-3 py-1 text-xs font-bold ${soundPrefs.on ? "bg-emerald-500 text-white" : "border"}`}>{soundPrefs.on ? "🔊 On" : "🔇 Off"}</button></div>
        <div className={`mt-1 grid gap-1.5 rounded-2xl border p-3 text-xs ${soundPrefs.on ? "" : "opacity-50"}`}>
          {([["master", "🔈 Volume"], ["sfx", "🔔 Effects"], ["amb", "🌿 Surroundings and music"]] as [keyof Omit<SoundPrefs, "on">, string][]).map(([k, l]) => (
            <label key={k} className="flex items-center gap-3"><span className="w-40 shrink-0 font-semibold">{l}</span>
              <input type="range" min={0} max={100} value={Math.round(soundPrefs[k] * 100)} disabled={!soundPrefs.on} onChange={(e) => setSoundPrefs((x) => ({ ...x, [k]: Number(e.target.value) / 100 }))} onPointerUp={() => sfx(k === "amb" ? "bell" : "coin")} className="w-full accent-emerald-600" aria-label={l} />
              <b className="w-8 text-right">{Math.round(soundPrefs[k] * 100)}</b></label>))}
          <p className="text-[10px] text-slate">Birds by day, crickets at night, traffic on the street, generators in a blackout, lounge music at Candellux. Saved on this device.</p>
          <button onClick={() => snd.current?.test()} className="justify-self-start rounded-full border px-3 py-1 text-xs font-bold">▶ Test sound</button>
          <p className="text-[10px] text-slate">No sound? Turn your phone's volume up (media volume) and, on iPhone, the silent switch off.</p>
        </div>
        <label className="mt-3 flex items-center justify-between gap-3 rounded-2xl border p-3 text-xs"><span><b className="block text-sm">Show me to other players</b>Players at the same place see your name and outfit, and can message you on NotesApp.</span>
          <input type="checkbox" checked={showMeOn} onChange={(e) => { setShowMe(e.target.checked); setShowMeOn(e.target.checked); if (!e.target.checked && user) void hide(user.uid); }} className="h-5 w-5 accent-emerald-600" /></label>
        <p className="mt-3 text-[11px] font-bold uppercase tracking-wider text-slate">Restore points</p>
        {!points ? <p className="text-sm text-slate">Loading…</p> : points.length === 0 ? <p className="text-sm text-slate">None yet: one is kept each hour and each day you play.</p> : <ul className="mt-1 divide-y rounded-2xl border text-sm">{points.slice(0, 8).map((pt) => <li key={pt.slot} className="flex items-center justify-between px-3 py-2"><span><b className="block">{new Date(pt.savedAt).toLocaleString("en-NG", { weekday: "short", hour: "numeric", hour12: true, minute: "2-digit" })}</b><span className="text-[11px] text-slate">{pt.kind}</span></span><button onClick={() => restore(pt.slot)} className="rounded-full border px-3 py-1 text-xs font-semibold">Restore</button></li>)}</ul>}
        <p className="mt-3 rounded-xl bg-slate-100 px-3 py-2 text-[11px] text-slate">🔒 Your Notesville Naira, anything you bought and your rank are kept on our servers. A restore never takes them away or doubles them.</p>
        <p className="mt-3 text-center text-[11px]"><a href="/help/notes-life" target="_blank" rel="noreferrer" className="text-crimson underline">How Notes Life works</a> · <button onClick={() => void leave()} className="text-crimson underline">Back to NotesApp</button></p></div>);
    }
  }
}

// Buttons and rows in the panels. They live out here (not inside the game) so the game's once-a-second re-render updates them in place
// instead of replacing them, which would swallow a tap that lands just as the clock ticks.
const BusyCtx = createContext(false);
function Btn({ children, onClick, tone = "ink", disabled }: { children: ReactNode; onClick: () => void; tone?: "ink" | "green" | "red" | "ghost" | "navy"; disabled?: boolean }) {
  const busy = useContext(BusyCtx);
  return <button disabled={busy || disabled} onClick={onClick} className={`rounded-full px-4 py-2.5 text-sm font-bold disabled:opacity-40 ${tone === "green" ? "bg-emerald-500 text-white" : tone === "red" ? "bg-[#E53935] text-white" : tone === "navy" ? "bg-[#262b6b] text-white" : tone === "ghost" ? "border border-slate-200" : "bg-ink text-white"}`}>{children}</button>;
}
function Row({ icon, title, note, right, onClick, pick }: { icon: ReactNode; title: ReactNode; note?: ReactNode; right?: ReactNode; onClick?: () => void; pick?: boolean }) {
  return (
    <div onClick={onClick} className={`flex items-center gap-3 rounded-2xl border p-2.5 ${pick ? "border-2 border-crimson bg-crimson/5" : "border-slate-200"} ${onClick ? "cursor-pointer hover:border-slate-300" : ""}`}>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-xl">{icon}</span>
      <span className="min-w-0 flex-1"><b className="block text-sm leading-tight">{title}</b>{note && <span className="text-[11px] text-slate">{note}</span>}</span>
      {right && <span className="shrink-0 text-right text-xs">{right}</span>}
    </div>
  );
}

// Scene labels that would cover each other: the lower one moves down until it is clear (widths estimated from the text).
function declutter<T extends { x: number; y: number; info: { label: string } }>(list: T[]): T[] {
  const out: (T & { w: number })[] = [];
  for (const t of [...list].sort((a, b) => a.y - b.y)) {
    const w = t.info.label.length * 6.6 + 24;
    let y = t.y;
    for (let k = 0; k < 6; k++) {
      const hit = out.find((o) => Math.abs(o.x - t.x) < (o.w + w) / 2 + 4 && Math.abs(o.y - y) < 25);
      if (!hit) break;
      y = hit.y + 27;
    }
    out.push({ ...t, y, w });
  }
  return out;
}

function Center({ children }: { children: ReactNode }) {
  return <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-sky-200 to-amber-50 p-6 text-center font-ui text-ink">{children}</div>;
}
function Gate() {
  const next = typeof window !== "undefined" ? `/life/play${location.search}` : "/life/play";
  return (
    <Center>
      <p className="text-2xl font-extrabold">Notes <span className="text-emerald-600">Life</span></p>
      <p className="mt-2 max-w-sm text-sm text-slate">The free NotesApp life game. Start in a room in Wuse, Abuja with N$ 100,000, get a job, eat at Chef Adams, and climb the Billionaires List.</p>
      <a href={`/login?next=${encodeURIComponent(next)}`} className="mt-5 rounded-full bg-ink px-6 py-3 text-sm font-bold text-white">Sign in with NotesApp</a>
      <a href={`/signup?next=${encodeURIComponent(next)}`} className="mt-3 text-sm font-semibold text-crimson underline">New to NotesApp? Join free</a>
    </Center>
  );
}
