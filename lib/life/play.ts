// Notes Life: what runs on the player's device. Needs, mood and timed activities live in the save (lib/life/save.ts); anything of
// value (Notesville Naira, what you own, your job, deals, rank) lives on the server (lib/life/server.ts) and is never trusted from here.
import { DIFFICULTY, FOOD_SPOIL_HOURS, GAME_HOUR_MS, LOW_NEED, NEEDS, POWER_TANK, type Difficulty, type Need, type PlaceId } from "./catalog";

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
  delivery: { at: number; hunger: number; keep?: number } | null; // food on its way to your room (keep: plates to store instead of eating)
  bikeRides: number;
  ebikeAskedAt: number;
  seenWelcome: boolean;
  seenRich: boolean;
  socialAt: number; // last time a message to a friend counted for Social
  gymUntil: number; // energy lasts longer (from the hotel gym)
  battery: number; // Power GO charge, Wh (0 to 320)
  fuel: number; // generator petrol, litres
  genOn: boolean; // the generator is running (only during a blackout)
  nepaSeen: string | null; // the blackout whose "NEPA has taken light" prompt you've seen
  tank: number; // itel Power Tank 1000 charge, Wh (0 to 1000)
  plateWarm: number; // game hours your stored plates have been out of a cold fridge (they spoil at 8)
  spoiledAt: number; // when stored food last spoiled
};

export function freshSave(now = Date.now()): SaveState {
  return { v: 1, needs: { ...START_NEEDS }, tickAt: now, difficulty: "normal", outfit: "#f59e0b", rug: "rug_notesapp", place: "home", plates: 0, activity: null, delivery: null, bikeRides: 0, ebikeAskedAt: 0, seenWelcome: false, seenRich: false, socialAt: 0, gymUntil: 0, battery: 320, fuel: 0, genOn: false, nepaSeen: null, tank: POWER_TANK.wh, plateWarm: 0, spoiledAt: 0 };
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
  if (next.delivery && now >= next.delivery.at) {
    if (next.delivery.keep) { next.plates = Math.min(30, next.plates + next.delivery.keep); delivered = -next.delivery.keep; }
    else { delivered = next.delivery.hunger; next.needs = applyNeeds(next.needs, { hunger: delivered }); }
    next.delivery = null;
  }
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
  const places: PlaceId[] = ["home", "work", "chef", "hotel", "itel"];
  return {
    ...f, needs,
    tickAt: num(r.tickAt, now), difficulty: r.difficulty && r.difficulty in DIFFICULTY ? r.difficulty : "normal",
    outfit: typeof r.outfit === "string" && /^#[0-9a-f]{6}$/i.test(r.outfit) ? r.outfit : f.outfit,
    rug: typeof r.rug === "string" ? r.rug : f.rug, place: places.includes(r.place as PlaceId) ? (r.place as PlaceId) : "home",
    plates: Math.max(0, Math.min(30, Math.floor(num(r.plates, 0)))),
    activity: r.activity && typeof r.activity === "object" && typeof r.activity.endsAt === "number" ? r.activity : null,
    delivery: r.delivery && typeof r.delivery.at === "number" ? r.delivery : null,
    tank: Math.max(0, Math.min(POWER_TANK.wh, num(r.tank, POWER_TANK.wh))), plateWarm: Math.max(0, num(r.plateWarm, 0)), spoiledAt: num(r.spoiledAt, 0),
    bikeRides: num(r.bikeRides, 0), ebikeAskedAt: num(r.ebikeAskedAt, 0), seenWelcome: !!r.seenWelcome, seenRich: !!r.seenRich,
    socialAt: num(r.socialAt, 0), gymUntil: num(r.gymUntil, 0),
    battery: Math.max(0, Math.min(320, num(r.battery, 320))), fuel: Math.max(0, Math.min(12, num(r.fuel, 0))), genOn: r.genOn === true,
    nepaSeen: typeof r.nepaSeen === "string" ? r.nepaSeen.slice(0, 20) : null,
  };
}

// ---- Power through NEPA's blackouts (runs every second while the game is open) ----
// Light on: the Power GO charges. Light off: a running generator burns petrol (and stops when the tank is empty), otherwise the Power GO
// runs the lamp at night, the fan (not needed with AC) and the laptop while you work at the desk. The solar panel charges it by day,
// light or no light. Asleep in a blackout with nothing running, the room is hot: energy fills more slowly.
export type PowerSource = "grid" | "gen" | "go" | "tank" | "none";
export function powerSource(s: Pick<SaveState, "genOn" | "fuel" | "battery"> & { tank?: number }, out: boolean, owned: string[]): PowerSource {
  if (!out) return "grid";
  if (s.genOn && s.fuel > 0 && (owned.includes("gen_small") || owned.includes("gen_big"))) return "gen";
  if (owned.includes("power_go") && s.battery > 0.5) return "go";
  if (owned.includes("power_tank") && (s.tank ?? 0) > 0.5) return "tank";
  return "none";
}
// The fridge is cold while it has power: NEPA, a running generator, or the Power Tank (which runs it alone for about 5 game hours).
export const fridgeCold = (s: Pick<SaveState, "genOn" | "fuel"> & { tank?: number }, out: boolean, owned: string[]) =>
  owned.includes("fridge") && (!out || (s.genOn && s.fuel > 0 && (owned.includes("gen_small") || owned.includes("gen_big"))) || (owned.includes("power_tank") && (s.tank ?? 0) > 0.5));
export function powerStep(s: SaveState, ms: number, o: { out: boolean; owned: string[]; night: boolean; deskWork: boolean }): SaveState {
  const h = Math.max(0, ms) / GAME_HOUR_MS;
  if (!h) return s;
  const n = { ...s };
  const src = powerSource(n, o.out, o.owned);
  const gen = o.owned.includes("gen_big") ? 1.1 : o.owned.includes("gen_small") ? 0.4 : 0;
  const room = ((o.night ? 10 : 0) + (o.owned.includes("ac") ? 0 : 16) + (o.deskWork ? 65 : 0)) * h;
  const tankOwned = o.owned.includes("power_tank");
  // stored food: cold in a powered fridge, otherwise it warms up and spoils after 8 game hours (checked before this hour's drain)
  const cold = fridgeCold(n, o.out, o.owned);
  if (src === "grid") { n.battery += 100 * h; n.genOn = false; if (tankOwned) n.tank += POWER_TANK.chargeW * h; }
  else if (src === "gen") { n.fuel = Math.max(0, n.fuel - gen * h); if (n.fuel <= 0) n.genOn = false; }
  else if (src === "go") n.battery -= room;
  else if (src === "tank") n.tank -= room;
  if (o.out && src !== "gen" && tankOwned && o.owned.includes("fridge")) n.tank -= POWER_TANK.fridgeW * h;
  if (o.owned.includes("solar_panel") && !o.night) n.battery += 55 * h;
  if (tankOwned && !o.night) n.tank += POWER_TANK.panelW * h * ((o.owned.includes("solar_650") ? 1 : 0) + (o.owned.includes("solar_650b") ? 1 : 0));
  n.battery = Math.max(0, Math.min(320, n.battery));
  n.tank = Math.max(0, Math.min(POWER_TANK.wh, n.tank ?? 0));
  if (n.plates > 0 && !cold) { n.plateWarm = (n.plateWarm ?? 0) + h; if (n.plateWarm >= FOOD_SPOIL_HOURS) { n.plates = 0; n.plateWarm = 0; n.spoiledAt = Date.now(); } }
  else if (n.plates === 0) n.plateWarm = 0;
  if (src === "none" && o.out && n.activity?.kind === "sleep") n.needs = applyNeeds(n.needs, { energy: -3 * h });
  return n;
}
