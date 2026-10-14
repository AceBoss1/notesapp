// Notes Life: what runs on the player's device. Needs, mood and timed activities live in the save (lib/life/save.ts); anything of
// value (Notesville Naira, what you own, your job, deals, rank) lives on the server (lib/life/server.ts) and is never trusted from here.
import { DIFFICULTY, GAME_HOUR_MS, LOW_NEED, NEEDS, type Difficulty, type Need, type PlaceId } from "./catalog";

export type Needs = Record<Need, number>;
export const START_NEEDS: Needs = { hunger: 70, energy: 90, fun: 65, social: 60, hygiene: 85, bladder: 80 };

export type Activity = {
  kind: "sleep" | "wc" | "bath" | "read" | "cook" | "eat" | "travel" | "shift" | "dinein" | "hotel" | "wait";
  label: string; icon: string; startedAt: number; endsAt: number;
  perHour?: Partial<Needs>; // applied steadily while it runs (sleep, reading)
  end?: Partial<Needs>; // applied when it finishes
  set?: Partial<Needs>; // set to this when it finishes (a hotel suite: energy 100)
  to?: PlaceId; // where you are when it finishes (travel)
  plates?: number; // plates of food ready when it finishes (cooking)
};

export type SaveState = {
  v: 1;
  needs: Needs;
  tickAt: number; // needs were last brought up to date at this moment (only while the game is open)
  difficulty: Difficulty;
  outfit: string; // shirt colour
  rug: string; // which owned rug is down
  place: PlaceId;
  plates: number; // cooked plates waiting
  activity: Activity | null;
  delivery: { at: number; hunger: number } | null; // food on its way to your room
  bikeRides: number;
  ebikeAskedAt: number;
  seenWelcome: boolean;
  seenRich: boolean;
  socialAt: number; // last time a message to a friend counted for Social
  gymUntil: number; // energy lasts longer (from the hotel gym)
};

export function freshSave(now = Date.now()): SaveState {
  return { v: 1, needs: { ...START_NEEDS }, tickAt: now, difficulty: "normal", outfit: "#f59e0b", rug: "rug_notesapp", place: "home", plates: 0, activity: null, delivery: null, bikeRides: 0, ebikeAskedAt: 0, seenWelcome: false, seenRich: false, socialAt: 0, gymUntil: 0 };
}

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n * 10) / 10));
export function applyNeeds(n: Needs, add?: Partial<Needs>, set?: Partial<Needs>): Needs {
  const out = { ...n };
  for (const k of Object.keys(add ?? {}) as Need[]) out[k] = clamp(out[k] + (add![k] ?? 0));
  for (const k of Object.keys(set ?? {}) as Need[]) out[k] = clamp(set![k] ?? out[k]);
  return out;
}

// Needs go down over game time, faster on Hard. Asleep you get hungry and need the WC more slowly; after the gym energy lasts longer.
export function decayNeeds(n: Needs, ms: number, s: Pick<SaveState, "difficulty" | "gymUntil" | "activity">, at = Date.now()): Needs {
  const hours = Math.max(0, ms) / GAME_HOUR_MS;
  if (!hours) return n;
  const k = DIFFICULTY[s.difficulty]?.decay ?? 1;
  const asleep = s.activity?.kind === "sleep";
  const out = { ...n };
  for (const need of NEEDS) {
    let rate = need.perHour * k;
    if (asleep && (need.id === "hunger" || need.id === "bladder")) rate *= 0.5;
    if (asleep && need.id === "energy") rate = 0;
    if (need.id === "energy" && s.gymUntil > at) rate *= 0.7;
    out[need.id] = clamp(out[need.id] - rate * hours);
  }
  return out;
}

// Brings the save up to `now`: needs decay (only for time the game was open: `open`), a running activity adds its steady effect, and a
// finished one applies its end effect. Returns the updated save and the activity that just finished, if any.
export function advance(s: SaveState, now = Date.now(), open = true): { s: SaveState; finished: Activity | null; delivered: number } {
  let next: SaveState = { ...s };
  const a = s.activity;
  const until = a ? Math.min(now, a.endsAt) : now;
  const from = Math.min(s.tickAt, until);
  if (open) next.needs = decayNeeds(next.needs, until - from, next, now);
  if (a?.perHour) {
    const hrs = Math.max(0, until - Math.max(a.startedAt, from)) / GAME_HOUR_MS;
    const add: Partial<Needs> = {};
    for (const k of Object.keys(a.perHour) as Need[]) add[k] = (a.perHour[k] ?? 0) * hrs;
    next.needs = applyNeeds(next.needs, add);
  }
  let finished: Activity | null = null;
  if (a && now >= a.endsAt) {
    finished = a;
    next.needs = applyNeeds(next.needs, a.end, a.set);
    if (a.to) next.place = a.to;
    if (a.plates) next.plates += a.plates;
    next.activity = null;
    if (open && now > a.endsAt) next.needs = decayNeeds(next.needs, now - a.endsAt, next, now);
  }
  let delivered = 0;
  if (next.delivery && now >= next.delivery.at) { delivered = next.delivery.hunger; next.needs = applyNeeds(next.needs, { hunger: delivered }); next.delivery = null; }
  next.tickAt = now;
  return { s: next, finished, delivered };
}

export const needsLow = (n: Needs) => NEEDS.some((x) => n[x.id] < LOW_NEED);
export function mood(n: Needs): { label: string; icon: string } {
  const avg = NEEDS.reduce((t, x) => t + n[x.id], 0) / NEEDS.length;
  const low = NEEDS.filter((x) => n[x.id] < LOW_NEED).length;
  if (low >= 3 || avg < 35) return { label: "Low", icon: "😩" };
  if (low >= 1 || avg < 60) return { label: "Okay", icon: "😊" };
  return avg >= 80 ? { label: "Great", icon: "😎" } : { label: "Good", icon: "🙂" };
}

// A save from the device or the cloud: anything missing or wrong is filled from a fresh one, so an old or damaged save still loads.
export function sanitize(raw: unknown, now = Date.now()): SaveState {
  const f = freshSave(now);
  if (!raw || typeof raw !== "object") return f;
  const r = raw as Partial<SaveState>;
  const needs = { ...f.needs };
  for (const x of NEEDS) { const v = (r.needs as Needs | undefined)?.[x.id]; if (typeof v === "number" && isFinite(v)) needs[x.id] = clamp(v); }
  const num = (v: unknown, d: number) => (typeof v === "number" && isFinite(v) ? v : d);
  const places: PlaceId[] = ["home", "work", "chef", "hotel"];
  return {
    ...f, needs,
    tickAt: num(r.tickAt, now), difficulty: r.difficulty && r.difficulty in DIFFICULTY ? r.difficulty : "normal",
    outfit: typeof r.outfit === "string" && /^#[0-9a-f]{6}$/i.test(r.outfit) ? r.outfit : f.outfit,
    rug: typeof r.rug === "string" ? r.rug : f.rug, place: places.includes(r.place as PlaceId) ? (r.place as PlaceId) : "home",
    plates: Math.max(0, Math.min(30, Math.floor(num(r.plates, 0)))),
    activity: r.activity && typeof r.activity === "object" && typeof r.activity.endsAt === "number" ? r.activity : null,
    delivery: r.delivery && typeof r.delivery.at === "number" ? r.delivery : null,
    bikeRides: num(r.bikeRides, 0), ebikeAskedAt: num(r.ebikeAskedAt, 0), seenWelcome: !!r.seenWelcome, seenRich: !!r.seenRich,
    socialAt: num(r.socialAt, 0), gymUntil: num(r.gymUntil, 0),
  };
}
