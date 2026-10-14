"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { startCheckout } from "@/lib/checkout";
import * as C from "@/lib/life/catalog";
import type { LifePlayer } from "@/lib/life/server";
import { advance, applyNeeds, mood, needsLow, type Activity, type SaveState } from "@/lib/life/play";
import { loadSave, restorePoint, restorePoints, saveCloud, saveLocal, type RestorePoint } from "./save";
import { createWorld, type RoomSpot, type SceneSpec, type Tag, type World } from "./world";

type Player = LifePlayer & { cooking: number; serverNow: number };
type Panel =
  | "welcome" | "needs" | "sleep" | "desk" | "outfit" | "cook" | "deal" | "go" | "food" | "hotel" | "phone" | "jobs" | "friends"
  | "invite" | "bank" | "rich" | "settings" | "ebike" | { shop: C.ItemCat } | null;
type Toast = { text: string; share?: string; tone?: "ok" | "warn" } | null;
type Friend = { uid: string; username: string; name: string; avatar: string; plays: boolean; netWorth: number };
type RichRow = { rank: number; uid: string; username: string; name: string; avatar: string; city: string; netWorth: number; owned: string[] };

const OUTFITS = ["#f59e0b", "#e53935", "#2563eb", "#16a34a", "#7c3aed", "#0f766e", "#111827", "#f472b6"];
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
  const [picked, setPicked] = useState<{ name: string; tel: string }[]>([]);
  const [bankLines, setBankLines] = useState<{ id: string; amount: number; label: string; at: number }[] | null>(null);
  const [buyAmt, setBuyAmt] = useState(1_000);
  const [rich, setRich] = useState<{ rows: RichRow[]; me: { rank: number | null; netWorth: number } | null } | null>(null);
  const [richPop, setRichPop] = useState(false);
  const [points, setPoints] = useState<RestorePoint[] | null>(null);
  const panelKey = typeof panel === "string" ? panel : null;
  useEffect(() => {
    if (!user || !panelKey) return;
    if (panelKey === "go") setGoTo(null);
    if (panelKey === "food") { setFoodMode(saveRef.current?.place === "chef" ? "dinein" : "delivery"); setCart({ combo: 1 }); }
    if (panelKey === "invite") setPicked([]);
    if (panelKey === "friends") { setFriendList(null); call<{ friends: Friend[] }>(user, "GET", undefined, "?view=friends").then((r) => setFriendList(r.friends)).catch(() => setFriendList([])); }
    if (panelKey === "bank") { setBankLines(null); call<{ lines: { id: string; amount: number; label: string; at: number }[] }>(user, "GET", undefined, "?view=tx").then((r) => setBankLines(r.lines)).catch(() => setBankLines([])); }
    if (panelKey === "rich") { setRich(null); setRichPop(!saveRef.current?.seenRich); call<{ rows: RichRow[]; me: { rank: number | null; netWorth: number } }>(user, "GET", undefined, "?view=rich").then(setRich).catch(() => setRich({ rows: [], me: null })); }
    if (panelKey === "settings") { setPoints(null); restorePoints(user.uid).then(setPoints).catch(() => setPoints([])); }
  }, [panelKey, user]);
  const canvas = useRef<HTMLCanvasElement>(null);
  const world = useRef<World | null>(null);
  const saveRef = useRef<SaveState | null>(null);
  const playerRef = useRef<Player | null>(null);
  const offset = useRef(0); // server clock minus this device's clock
  const lastCloud = useRef(0);
  saveRef.current = save; playerRef.current = player;

  const say = useCallback((text: string, share?: string, tone: "ok" | "warn" = "ok") => { setToast({ text, share, tone }); window.setTimeout(() => setToast((t) => (t?.text === text ? null : t)), share ? 9000 : 4500); }, []);
  const shareText = useCallback((text: string) => (player ? `${text} Play Notes Life with me: ${C.inviteLink(player.username)}` : text), [player]);
  const gotPlayer = (p: Player) => { offset.current = p.serverNow - Date.now(); setPlayer(p); };
  const update = (f: (s: SaveState) => SaveState) => setSave((s) => (s ? f(s) : s));

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
  const spec: SceneSpec | null = useMemo(() => {
    if (!save || !player) return null;
    const a = save.activity;
    if (a?.kind === "travel") return { id: "street", outfit: save.outfit, night, riding: a.icon === "🛵" ? "ebike" : null };
    if (a?.kind === "hotel" && a.label.includes("pool")) return { id: "pool", outfit: save.outfit };
    if (save.place === "chef") return { id: "chef", outfit: save.outfit, night };
    if (save.place === "hotel") return { id: "hotel", outfit: save.outfit };
    if (save.place === "work") return { id: "street", outfit: save.outfit, night, riding: player.owned.includes("ebike") ? "ebike" : null };
    return { id: "room", owned: player.owned, rug: save.rug, outfit: save.outfit, night, ringing: player.deal?.state === "offered", at: spot, sleeping: a?.kind === "sleep" };
  }, [save?.place, save?.activity?.kind, save?.activity?.label, save?.outfit, save?.rug, player?.owned.join(), player?.deal?.state, night, spot]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (spec && world.current) void world.current.show(spec); }, [spec]);

  // ---- the game loop: every second ----
  const finishShift = useCallback(async () => {
    if (!user) return;
    try {
      const r = await call<{ player: Player; result: { pay: number; firstShift?: boolean; referralBonus?: string } }>(user, "POST", { action: "shift_finish" });
      gotPlayer(r.player);
      if (r.result.firstShift) say(`First shift done: ${C.fmtN(r.result.pay)} earned!`, shareText(`I just finished my first shift in Notes Life and earned ${C.fmtN(r.result.pay)} 💼`));
      else say(`Shift done: ${C.fmtN(r.result.pay)} paid.`);
      if (r.result.referralBonus === "paid") window.setTimeout(() => say("🎁 Welcome bonus: Bonus Credits added to your NotesApp wallet, and to your friend's."), 4600);
    } catch (e) { say(e instanceof Error ? e.message : "Couldn't finish the shift.", undefined, "warn"); }
  }, [user, say, shareText]);

  useEffect(() => {
    if (!save || !user) return;
    const t = window.setInterval(() => {
      const s = saveRef.current; if (!s) return;
      const now = Date.now();
      const r = advance(s, now, true);
      setSave(r.s); setNow(now);
      if (r.delivered) say(`🛵 Your Chef Adams order arrived. Hunger +${r.delivered}.`);
      const f = r.finished;
      if (f) {
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
    const now = Date.now();
    update((x) => ({ ...x, activity: { ...a, startedAt: now, endsAt: now + C.gameMinutesToMs(minutes) } }));
    setPanel(null);
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
  async function order(mode: C.FoodMode, items: Record<string, number>) {
    const list = Object.entries(items).filter(([, q]) => q > 0).map(([id, qty]) => ({ id, qty }));
    if (!list.length) return setErr("Add something to your order.");
    const r = await act<{ hunger: number; minutes: number; fun: number; social: number; total: number }>({ action: "food", mode, items: list });
    if (!r) return;
    if (mode === "delivery") { update((x) => ({ ...x, delivery: { at: Date.now() + C.gameMinutesToMs(r.minutes), hunger: r.hunger } })); setPanel(null); say(`🛵 Order placed: a rider brings it in ${r.minutes} game minutes.`); }
    else start({ kind: mode === "dinein" ? "dinein" : "eat", label: mode === "dinein" ? "Eating in at Chef Adams" : "Eating your takeaway", icon: mode === "dinein" ? "🍽" : "🥡", end: { hunger: r.hunger, fun: r.fun, social: r.social } }, r.minutes);
  }
  async function hotel(h: C.HotelService) {
    const r = await act<{ minutes: number; effect: Partial<Record<C.Need, number>>; set: Partial<Record<C.Need, number>> | null; boost: string | null }>({ action: "hotel", service: h.id });
    if (!r) return;
    if (r.boost === "gym") update((x) => ({ ...x, gymUntil: Date.now() + C.GAME_DAY_MS }));
    start({ kind: "hotel", label: h.id === "pool" ? "Relaxing by the pool" : h.name, icon: h.icon, end: r.effect, set: r.set ?? undefined }, r.minutes);
    if (h.id === "suite") say("👑 Checked in to the Imperial Suite.", shareText("Living large at the Candellux Imperial in Notes Life 👑"));
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
    if (j.place === "chef" && s.place !== "chef") { setPanel("go"); return setErr("Your job is at Chef Adams in Wuse. Go there first."); }
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
  async function buyNaira(naira: number, how: "wallet" | "card") {
    if (!user) return;
    if (how === "card") { try { await startCheckout(user, { kind: "life_naira", amountNaira: naira }, { amountKobo: naira * 100 }); } catch (e) { if (e instanceof Error && e.message) setErr(e.message); } return; }
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
      if (key === "pool") return { label: "🏊 Pool", go: () => setPanel("hotel") };
    }
    if (spec?.id === "pool") return { label: ({ pool: "🏊 Pool", bar: "🍸 VIP bar", gym: "🏋 Gym", suites: "🛏 Suites", front: "↩ Front" } as Record<string, string>)[key] ?? key, go: () => setPanel("hotel") };
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

  return (
    <div className="life-game fixed inset-0 overflow-hidden bg-sky-100 font-ui text-ink">
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
            <span>{wt.night ? "🌙" : "☀️"}</span><b>{wt.label}</b><span className="text-slate">·</span><span title="Difficulty">{diff.icon}</span><span className="hidden text-[11px] text-slate sm:inline">{diff.label}</span><span className="ml-auto font-mono text-[11px] text-slate">{save.place === "hotel" ? "Garki" : "Wuse"}, Abuja</span>
          </button>
          <button onClick={() => setPanel("bank")} className="pill pointer-events-auto flex items-center gap-2 py-1 pl-3 pr-1 text-sm"><b>{window.innerWidth < 700 ? C.fmtShort(player.naira) : C.fmtN(player.naira)}</b><span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 font-bold text-white">+</span></button>
        </div>
        <div className="mx-auto mt-2 flex flex-wrap justify-center gap-2 text-[11px]">
          <span className="pill px-3 py-1">☁️ {savedAt ? `Saved ${Math.max(1, Math.round((Date.now() - savedAt) / 1000))}s ago` : "Saved on this device"}</span>
          <span className="pill px-3 py-1">📅 Day {day}{player.rentOwed ? <b className="text-crimson"> · rent owed {C.fmtN(player.rentOwed)}</b> : ` · rent day ${(Math.floor((day - 1) / C.MONTH_DAYS) + 1) * C.MONTH_DAYS + 1}`}</span>
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
              <button key={l as string} onClick={f as () => void} className={`rounded-2xl py-2 ${(l === "Home" && !panel) || (l === "Phone" && ["phone", "jobs", "friends", "bank", "invite", "food", "deal"].includes(String(panel))) || (l === "Go" && panel === "go") || (l === "Rich list" && panel === "rich") || (l === "Shop" && typeof panel === "object" && panel) ? "bg-ink text-white" : ""}`}>{i as string}<br />{l as string}</button>
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
    </div>
  );

  // ---------------- panels ----------------
  function renderPanels() {
    if (!player || !save) return null;
    const p = player, s = save;
    const close = <button onClick={() => setPanel(null)} className="float-right text-xl leading-none text-slate" aria-label="Close">×</button>;
    const eco = (t?: string) => (t ? <span className="ml-1 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800">🌿 {t}</span> : null);

    if (panel === "welcome") return (
      <div className="text-center">
        {p.avatar ? <img src={p.avatar} alt="" className="mx-auto h-20 w-20 rounded-full border-4 border-emerald-400 object-cover" /> : null}
        <p className="mt-2 text-[11px] font-bold uppercase tracking-widest text-emerald-700">Welcome to Notes Life</p>
        <h2 className="text-2xl font-extrabold">Start small. Hustle. Ball out.</h2>
        <p className="mt-1 text-sm text-slate">Hi {p.name.split(" ")[0]}. You start on day 1 with {C.fmtN(C.START_NAIRA)}, a room in Wuse, a bicycle and a deal phone. Rent is {C.fmtN(C.RENT_NAIRA)} every 30 game days (one real day). One game day is 48 real minutes.</p>
        <div className="mt-3 grid gap-2 text-left text-sm">
          <Row icon="🏙" title="Abuja" note="Home of NotesApp · Wuse, Garki, Maitama" right={<b className="text-emerald-700">✓</b>} pick />
          {C.COMING_CITIES.map((c) => <Row key={c} icon="🔒" title={c} note="Coming soon" />)}
        </div>
        <p className="mt-3 text-[11px] text-slate">Notesville Naira (N$) is game money: it can&apos;t be cashed out. Your progress saves on this device and in your NotesApp account.</p>
        <div className="mt-4"><Btn tone="green" onClick={() => { update((x) => ({ ...x, seenWelcome: true })); setPanel(null); saveNow(); }}>Start in Abuja</Btn></div>
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
      {s.plates > 0 && <div className="mt-3"><Row icon="🍽" title={`Eat a plate (${s.plates} ready)`} note="Hunger +50" pick onClick={() => { update((x) => ({ ...x, plates: x.plates - 1 })); start({ kind: "eat", label: "Eating", icon: "🍽", end: { hunger: 50 } }, 15); }} /></div>}
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
              : <button disabled={busy} onClick={() => buy(i)} className="rounded-full bg-emerald-500 px-3 py-1 font-bold text-white disabled:opacity-40">{C.fmtN(i.price)}</button>} />;
        })}</div>
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
    if (panel === "hotel") return (<div>{close}
      <div className="flex items-center gap-3"><img src="/images/life/partners/candellux-logo.webp" alt="" className="h-12 w-12 rounded-full object-cover" /><div><p className="font-serif text-xl font-bold italic leading-tight text-[#262b6b]">Candellux</p><p className="text-[11px] font-bold tracking-wider text-[#262b6b]">IMPERIAL HOTEL &amp; SUITES <span className="rounded-full bg-[#e3b23c]/20 px-1.5 py-0.5 text-[9px] text-[#8a6a12]">PARTNER</span></p><p className="text-[10px] text-slate">Garki, Abuja · {C.CANDELLUX.tagline}</p></div></div>
      {s.place !== "hotel" && <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900">You&apos;re not at the hotel. <button className="font-bold underline" onClick={() => setPanel("go")}>Go to Garki</button></p>}
      <div className="mt-3 grid gap-1.5">{C.HOTEL.map((h) => <Row key={h.id} icon={h.icon} title={h.name} note={h.note} right={h.soon ? <span className="text-slate">Soon</span> : <button disabled={busy || s.place !== "hotel"} onClick={() => hotel(h)} className="rounded-full bg-[#262b6b] px-3 py-1 font-bold text-white disabled:opacity-40">{C.fmtN(h.price)}</button>} />)}</div>
      <div className="mt-3 flex gap-3 rounded-2xl border border-[#e3b23c] bg-[#fffbeb] p-2.5"><img src="/images/life/partners/candellux-pool.webp" alt="" className="h-16 w-20 shrink-0 rounded-xl object-cover" /><div className="min-w-0 text-[11px]"><b className="block text-[12px]">Stay at the real Candellux</b>{C.CANDELLUX.address} · WhatsApp {C.CANDELLUX.whatsappLabel}<a href={WA("Hello Candellux, I'd like to book a room (I found you on Notes Life).", C.CANDELLUX.whatsapp)} target="_blank" rel="noreferrer" className="mt-1 block font-bold text-[#262b6b] underline">Book a real room ↗</a></div></div>
      <p className="mt-2 text-center text-[10px] text-slate">Candellux Imperial is a Notes Life partner.</p></div>);

    if (panel === "phone") return (<div>{close}<p className="text-lg font-extrabold">📱 Phone</p>
      <div className="mt-3 grid grid-cols-4 gap-3 text-center text-[11px] font-semibold">{([["💼", "Jobs", "bg-emerald-500", () => setPanel("jobs")], ["👥", "Friends", "bg-crimson", () => setPanel("friends")], ["🎁", "Invite", "bg-pink-500", () => setPanel("invite")], ["☎️", "Deals", "bg-sky-500", () => setPanel("deal")], ["🏦", "Bank", "bg-amber-500", () => setPanel("bank")], ["🛺", "Go", "bg-teal-600", () => setPanel("go")], ["CHEF", "Chef Adams", "bg-[#292929]", () => setPanel("food")], ["👑", "Candellux", "bg-[#262b6b]", () => setPanel("hotel")], ["👑", "Rich list", "bg-slate-800", () => setPanel("rich")], ["🛋", "Shop", "bg-orange-500", () => setPanel({ shop: "rug" })], ["📰", "NotesApp", "bg-[#7A0328]", () => window.open("/journals", "_blank")], ["⚙️", "Settings", "bg-slate-400", () => setPanel("settings")]] as [string, string, string, () => void][]).map(([i, n, c, f]) => (
        <button key={n + i} onClick={f}><span className={`mx-auto flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl ${c} text-2xl text-white shadow`}>{i === "CHEF" ? <img src="/images/life/partners/chef-emblem.webp" alt="" className="h-12 w-12 object-contain" /> : i}</span><span className="mt-1 block">{n}</span></button>
      ))}</div></div>);

    if (panel === "jobs") return (<div>{close}<p className="text-lg font-extrabold">💼 Jobs in Abuja</p><p className="text-[11px] text-slate">Real NotesApp careers. Better gear, better pay. One shift is {C.SHIFT_HOURS} game hours ({C.SHIFT_MS / 60_000} real minutes).</p>
      {job && <div className="mt-3 rounded-2xl border-2 border-emerald-400 bg-emerald-50 p-3"><b className="block">{job.icon} Your job: {job.title}</b><span className="text-[11px] text-slate">{job.employer} · {C.fmtN(C.shiftPay(job, p.owned, needsLow(s.needs)))} a shift{needsLow(s.needs) ? " (a need is low)" : ""} · {p.shifts} shifts done</span>
        <div className="mt-2 flex gap-2">{p.shift ? <span className="text-xs font-semibold">On shift now</span> : <><Btn tone="green" onClick={startShift}>Start a shift</Btn><Btn tone="ghost" onClick={() => act({ action: "job_quit" })}>Quit</Btn></>}</div></div>}
      <div className="mt-3 grid gap-1.5">{C.JOBS.filter((j) => j.id !== job?.id).map((j) => { const block = C.jobBlocker(j, { owned: p.owned, cooking: p.cooking, chefShifts: p.chefShifts, reputation: p.reputation }); return (
        <Row key={j.id} icon={j.brand ? <img src="/images/life/partners/chef-emblem.webp" alt="" className="h-9 w-9 object-contain" /> : j.icon} title={<>{j.title}</>} note={<>{j.employer}{block ? <b className="block text-crimson">🔒 {block}</b> : j.ladder ? <span className="block">{j.ladder}</span> : null}</>}
          right={<><b className="block text-emerald-700">{j.pay ? `${C.fmtN(j.pay)}/shift` : ""}</b>{!block && !p.shift && <button disabled={busy} onClick={async () => { const r = await act<{ message: string }>({ action: "job_apply", job: j.id }); if (r) say(r.message, shareText(`I just got a job as ${j.title} in Notes Life 💼`)); }} className="mt-1 rounded-full bg-ink px-2.5 py-1 text-[11px] font-bold text-white">Take it</button>}</>} />); })}</div>
      <div className="mt-3 rounded-2xl border-2 border-[#F2B544] bg-[#292929] p-3 text-white"><p className="text-[10px] font-bold uppercase tracking-widest text-[#F2B544]">🤝 Become a Partner</p><p className="text-[13px] font-bold">Own a Chef Adams outlet</p><div className="mt-1.5 grid grid-cols-2 gap-1.5 text-[10px]"><span className="rounded-xl bg-white/10 p-2"><b className="block text-[12px]">Takeaway Kiosk</b>from {C.fmtShort(C.CHEF_PARTNER.kiosk)}</span><span className="rounded-xl bg-white/10 p-2"><b className="block text-[12px]">Mini Dine-In Shop</b>from {C.fmtShort(C.CHEF_PARTNER.shop)}</span></div><p className="mt-1.5 text-[10px] opacity-80">One brand. Standardised recipes, training and quality control in every outlet. Coming soon in the game.</p></div></div>);

    if (panel === "friends") return friendsPanel(close);
    if (panel === "invite") return invitePanel(close);
    if (panel === "bank") return bankPanel(close);
    if (panel === "rich") return richPanel(close);
    if (panel === "settings") return settingsPanel(close);
    return null;

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
      const groups: [string, C.Food["group"]][] = [["Chef's combo", "combo"], ["Rice & noodles", "rice"], ["Protein", "protein"], ["Sides", "side"]];
      return (<div>{close}
        <div className="flex items-center gap-2"><img src="/images/life/partners/chef-emblem.webp" alt="" className="h-12 w-12 object-contain" /><div><img src="/images/life/partners/chef-wordmark.webp" alt="Chef Adams" className="h-7 object-contain" /><span className="block text-[10px] text-slate">@chef_adams · Wuse, Abuja · <span className="font-bold">PARTNER</span></span></div></div>
        <div className="mt-3 grid grid-cols-3 gap-1 rounded-full bg-slate-100 p-1 text-center text-[11px] font-bold">{(Object.keys(C.FOOD_MODES) as C.FoodMode[]).map((k) => <button key={k} onClick={() => setMode(k)} className={`rounded-full py-1.5 ${k === mode ? "bg-[#E53935] text-white" : ""}`}>{C.FOOD_MODES[k].icon} {C.FOOD_MODES[k].label}</button>)}</div>
        <p className="mt-2 text-[11px] text-slate">{fm.where} · {fm.minutes} game min{fm.fee ? ` · ${C.fmtN(fm.fee)} delivery` : ""}{mode === "dinein" ? " · Fun +10 · Social +5" : ""}</p>
        {mode !== "delivery" && !atChef ? <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900">You&apos;re not at Chef Adams. <button className="font-bold underline" onClick={() => setPanel("go")}>Go there</button>, or order delivery.</p> : (
          <>
            {groups.map(([title, g]) => <div key={g}><p className="mt-2 text-[10px] font-bold uppercase tracking-wider text-slate">{title}</p><div className="mt-1 grid gap-1">{C.FOODS.filter((f) => f.group === g).map((f) => (
              <div key={f.id} className="flex items-center gap-2 rounded-xl border border-slate-200 px-2 py-1.5 text-[12px]"><span className="min-w-0 flex-1"><b className="block leading-tight">{f.name}</b><span className="text-[10px] text-emerald-700">🍲 +{f.hunger}</span></span><b className="text-[11px]">{C.fmtN(f.price)}</b>
                <button onClick={() => setCart((c) => ({ ...c, [f.id]: Math.max(0, (c[f.id] || 0) - 1) }))} className="h-6 w-6 rounded-full border font-bold">−</button><b className="w-4 text-center">{cart[f.id] || 0}</b><button onClick={() => setCart((c) => ({ ...c, [f.id]: (c[f.id] || 0) + 1 }))} className="h-6 w-6 rounded-full bg-[#E53935] font-bold text-white">+</button></div>
            ))}</div></div>)}
            <div className="mt-3 rounded-2xl bg-[#292929] p-3 text-white"><button disabled={busy} onClick={() => order(mode, cart)} className="block w-full rounded-full bg-[#E53935] py-2 text-center text-sm font-bold disabled:opacity-40">Order · {C.fmtN(total)}</button></div>
          </>
        )}
        <p className="mt-2 text-center text-[10px] text-slate">Craving it for real? <a href="/u/chef_adams" target="_blank" rel="noreferrer" className="font-bold text-[#E53935]">@chef_adams</a> is on NotesApp ↗ · Satisfaction in every bite.</p></div>);
    }
    function friendsPanel(close: ReactNode) {
      const list = friendList;
      const message = (f: Friend) => {
        window.open(`/messages/new?to=${encodeURIComponent(f.username)}`, "_blank");
        const now = Date.now();
        if (now - s.socialAt > C.GAME_HOUR_MS) { update((x) => ({ ...x, socialAt: now, needs: applyNeeds(x.needs, { social: 10 }) })); say("💬 Social +10"); }
      };
      return (<div>{close}<p className="text-lg font-extrabold">👥 Friends</p><p className="text-[11px] text-slate">People on NotesApp you follow who follow you back</p>
        {!list ? <p className="mt-3 text-sm text-slate">Loading…</p> : list.length === 0 ? <p className="mt-3 text-sm text-slate">No friends here yet. Invite people, and follow each other on NotesApp.</p> : (
          <ul className="mt-2 divide-y text-sm">{list.map((f) => <li key={f.uid} className="flex items-center gap-2.5 py-2.5">{f.avatar ? <img src={f.avatar} alt="" className="h-10 w-10 rounded-full object-cover" /> : <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-200 font-bold">{f.name[0]}</span>}
            <span className="min-w-0 flex-1"><b className="block leading-tight">{f.name}</b><span className="text-[10px] text-slate">@{f.username} · {f.plays ? `plays · ${C.fmtShort(f.netWorth)}` : "not playing yet"}</span></span>
            <button onClick={() => message(f)} className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100" title="Message on NotesApp">💬</button>
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
        {!canPick && <p className="mt-1 text-center text-[10px] text-slate">Picking from your contacts works in Chrome on Android; on other phones, share on WhatsApp and choose your friends there.</p>}</div>);
    }
    function bankPanel(close: ReactNode) {
      const lines = bankLines, naira = buyAmt, setNaira = setBuyAmt;
      return (<div>{close}<p className="text-[11px] font-bold uppercase tracking-widest text-emerald-700">🏦 Central Bank of Notesville</p><h2 className="text-2xl font-extrabold">{C.fmtN(p.naira)}</h2><p className="text-xs text-slate">Notesville Naira · net worth {C.fmtShort(p.netWorth)}</p>
        <div className="mt-3 rounded-2xl border-2 border-crimson/20 p-3"><b className="text-sm">Buy N$ with NotesApp Credit</b><p className="text-[11px] text-slate">₦1 = N$ 100. Game money: it can&apos;t be turned back into naira. Purchases are final.</p>
          <div className="mt-2 flex flex-wrap gap-1.5">{[100, 500, 1_000, 3_500, 10_000].map((n) => <button key={n} onClick={() => setNaira(n)} className={`rounded-full px-3 py-1 text-xs font-bold ${naira === n ? "bg-ink text-white" : "border"}`}>₦{n.toLocaleString("en-NG")} → {C.fmtShort(n * 100)}</button>)}</div>
          <div className="mt-2 grid grid-cols-2 gap-2"><Btn tone="green" onClick={() => buyNaira(naira, "wallet")}>From my wallet</Btn><Btn tone="ghost" onClick={() => buyNaira(naira, "card")}>Card or bank</Btn></div>
          <a href="/profile/wallet" target="_blank" rel="noreferrer" className="mt-2 block text-center text-[11px] text-crimson underline">Top up your NotesApp wallet ↗</a></div>
        <p className="mt-3 text-[11px] font-bold uppercase tracking-wider text-slate">Statement</p>
        {!lines ? <p className="text-sm text-slate">Loading…</p> : <ul className="mt-1 divide-y text-sm">{lines.map((l) => <li key={l.id} className="flex justify-between py-1.5"><span className="min-w-0 truncate pr-2">{l.label}<span className="block text-[10px] text-slate">{new Date(l.at).toLocaleString("en-NG", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</span></span><b className={l.amount > 0 ? "text-emerald-700" : ""}>{l.amount > 0 ? "+" : "−"}{C.fmtN(Math.abs(l.amount))}</b></li>)}</ul>}</div>);
    }
    function richPanel(close: ReactNode) {
      const data = rich, pop = richPop, setPop = setRichPop;
      const brag = data?.me?.rank ? `I'm #${data.me.rank} on the Notes Life Billionaires List with ${C.fmtShort(data.me.netWorth)} 😎` : "I'm climbing the Notes Life Billionaires List 😎";
      if (pop) return (<div className="text-center"><div className="text-5xl">🧑‍⚖️</div><h3 className="mt-2 text-xl font-extrabold">Welcome to the official <span className="rounded bg-ink px-1.5 text-white">[REDACTED BY LAWYERS]</span> Rich List!</h3><p className="mt-2 text-sm text-slate">Our lawyers asked us to call it the {C.RICH_TITLE}. Net worth = your Notesville Naira plus everything you own.</p><div className="mt-4"><Btn onClick={() => { setPop(false); update((x) => ({ ...x, seenRich: true })); }}>Show me the money</Btn></div></div>);
      return (<div>{close}<p className="text-[11px] font-bold uppercase tracking-widest text-amber-600">👑 {C.RICH_TITLE}</p><h2 className="text-2xl font-extrabold">{C.RICH_SUBTITLE}</h2><p className="text-xs text-slate">Net worth = Notesville Naira + what you own.</p>
        {!data ? <p className="mt-3 text-sm text-slate">Loading…</p> : <ol className="mt-3 divide-y">{data.rows.map((r) => <li key={r.uid} className={`flex items-center gap-2.5 py-2 ${r.uid === p.uid ? "rounded-xl bg-amber-50 px-2" : ""}`}><b className={`w-6 text-center ${r.rank <= 3 ? "text-amber-600" : ""}`}>{r.rank}</b>{r.avatar ? <img src={r.avatar} alt="" className="h-9 w-9 rounded-full object-cover" /> : <span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-200 text-xs font-bold">{r.name[0]}</span>}<span className="min-w-0 flex-1"><b className="block truncate text-sm">{r.name}</b><span className="text-[10px] text-slate">@{r.username} · Abuja {r.owned.map((o) => C.ITEM(o)?.icon).join(" ")}</span></span><b className="text-sm">{C.fmtShort(r.netWorth)}</b></li>)}</ol>}
        {data?.me && <p className="mt-2 text-center text-xs">You: <b>#{data.me.rank}</b> · {C.fmtShort(data.me.netWorth)}</p>}
        <a href={WA(shareText(brag))} target="_blank" rel="noreferrer" className="mt-3 block rounded-full bg-amber-500 py-3 text-center font-bold text-white">😎 Brag on WhatsApp</a></div>);
    }
    function settingsPanel(close: ReactNode) {
      const restore = async (slot: string) => { if (!user || !confirm("Go back to this restore point? Your needs, place and looks go back; your money and what you own stay as they are.")) return; const st = await restorePoint(user.uid, slot); if (st) { setSave({ ...st, tickAt: Date.now() }); setPanel(null); say("Restored."); saveNow(); } };
      return (<div>{close}<p className="text-[11px] font-bold uppercase tracking-widest text-slate">⚙️ Settings</p><h2 className="text-xl font-extrabold">Your progress</h2>
        <div className="mt-3 flex items-center gap-3 rounded-2xl bg-emerald-50 p-3"><span className="text-2xl">☁️</span><span className="text-sm"><b className="block">{savedAt ? `Saved ${Math.max(1, Math.round((Date.now() - savedAt) / 1000))} seconds ago` : "Saved on this device"}</b>On this device and in your NotesApp account (@{p.username}). Sign in anywhere to carry on.</span></div>
        <p className="mt-3 text-[11px] font-bold uppercase tracking-wider text-slate">Difficulty</p>
        <div className="mt-1 grid grid-cols-3 gap-2">{(Object.keys(C.DIFFICULTY) as C.Difficulty[]).map((d) => <button key={d} onClick={() => update((x) => ({ ...x, difficulty: d }))} className={`rounded-2xl border-2 p-2 text-sm font-bold ${s.difficulty === d ? "border-ink" : "border-slate-200"}`}>{C.DIFFICULTY[d].icon} {C.DIFFICULTY[d].label}</button>)}</div>
        <p className="mt-1 text-[10px] text-slate">Harder means needs drop faster.</p>
        <p className="mt-3 text-[11px] font-bold uppercase tracking-wider text-slate">Restore points</p>
        {!points ? <p className="text-sm text-slate">Loading…</p> : points.length === 0 ? <p className="text-sm text-slate">None yet: one is kept each hour and each day you play.</p> : <ul className="mt-1 divide-y rounded-2xl border text-sm">{points.slice(0, 8).map((pt) => <li key={pt.slot} className="flex items-center justify-between px-3 py-2"><span><b className="block">{new Date(pt.savedAt).toLocaleString("en-NG", { weekday: "short", hour: "numeric", minute: "2-digit" })}</b><span className="text-[11px] text-slate">{pt.kind}</span></span><button onClick={() => restore(pt.slot)} className="rounded-full border px-3 py-1 text-xs font-semibold">Restore</button></li>)}</ul>}
        <p className="mt-3 rounded-xl bg-slate-100 px-3 py-2 text-[11px] text-slate">🔒 Your Notesville Naira, anything you bought and your rank are kept on our servers. A restore never takes them away or doubles them.</p>
        <p className="mt-3 text-center text-[11px]"><a href="/help/notes-life" target="_blank" rel="noreferrer" className="text-crimson underline">How Notes Life works</a> · <a href="/journals" className="text-crimson underline">Back to NotesApp</a></p></div>);
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
