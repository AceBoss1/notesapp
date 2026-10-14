// Notes Life: the game's rules and everything that can be bought, eaten, worked or ridden. Shared by the server (which owns money and
// ownership: lib/life/server.ts), the game screens and the tests. Prices are in Notesville Naira (N$), whole numbers.
// Decided 14 October 2026: start with N$ 100,000 on day 1 in Wuse, Abuja; ₦1 of NotesApp Credit buys N$ 100; 24 game hours = 48 real
// minutes (30 game days = 24 real hours); rent N$ 60,000 every 30 game days.

export const LIFE_LIVE = process.env.NEXT_PUBLIC_LIFE_LIVE !== "false";

export const START_NAIRA = 100_000;
export const GAME_DAY_MS = 48 * 60_000;
export const GAME_HOUR_MS = GAME_DAY_MS / 24; // 2 real minutes
export const GAME_MIN_MS = GAME_HOUR_MS / 60; // 2 real seconds
export const MONTH_DAYS = 30;
export const RENT_NAIRA = 60_000;
export const LANDLORD = "Alhaji Bello";
// ₦1 = 100 kobo buys N$ 100, so one kobo of NotesApp Credit is exactly N$ 1.
export const NAIRA_PER_KOBO = 1;
export const BUY_NAIRA_MIN = 100; // ₦
export const BUY_NAIRA_MAX = 100_000; // ₦ per purchase
// The world clock is the same for everyone (power cuts and events happen at the same moment), counted from this instant.
export const WORLD_EPOCH = Date.UTC(2026, 9, 1, 5, 0, 0); // a game day starts at 6:00 AM Lagos time on 1 Oct 2026

export const CITY = { id: "abuja", name: "Abuja", area: "Wuse" } as const;
export const COMING_CITIES = ["Lagos", "Port Harcourt"];

// ---- Needs ----
export type Need = "hunger" | "energy" | "fun" | "social" | "hygiene" | "bladder";
export const NEEDS: { id: Need; icon: string; label: string; perHour: number; tip: string }[] = [
  { id: "hunger", icon: "🍲", label: "Hunger", perHour: 3, tip: "Eat: Chef Adams delivery, takeaway or dine-in, or cook at home" },
  { id: "energy", icon: "⚡", label: "Energy", perHour: 2.5, tip: "Sleep in your bed. A fan sleeps lighter; AC sleeps deep" },
  { id: "fun", icon: "🎉", label: "Fun", perHour: 2, tip: "Read or play at your desk, the pool, dine-in" },
  { id: "social", icon: "💬", label: "Social", perHour: 1.5, tip: "Message a friend, take a deal call, the VIP bar" },
  { id: "hygiene", icon: "🫧", label: "Hygiene", perHour: 2, tip: "Take a bath (clients notice!)" },
  { id: "bladder", icon: "🚽", label: "Bladder", perHour: 5, tip: "Use the WC" },
];
export const LOW_NEED = 40; // below this a need is "low" (amber) and work pays less
export const LOW_PAY_FACTOR = 0.8;

export type Difficulty = "easy" | "normal" | "hard";
export const DIFFICULTY: Record<Difficulty, { label: string; icon: string; decay: number }> = {
  easy: { label: "Easy", icon: "🙂", decay: 0.7 },
  normal: { label: "Normal", icon: "😀", decay: 1 },
  hard: { label: "Hard", icon: "🌶️", decay: 1.3 },
};

// ---- Things you own ----
export type ItemCat = "rug" | "computer" | "cooling" | "kitchen" | "lights" | "phone" | "transport";
export type Item = {
  id: string; cat: ItemCat; name: string; note: string; price: number; icon: string; eco?: string; starter?: boolean;
  workSpeed?: number; sleepPerHour?: number; dealEveryHours?: number; dealBoost?: number; commute?: TransportId; desk?: boolean;
};
export const ITEMS: Item[] = [
  { id: "rug_notesapp", cat: "rug", name: "Maroon NotesApp rug", note: "Your starter rug, with the na icon", price: 0, icon: "🟥", starter: true },
  { id: "rug_ankara", cat: "rug", name: "Ankara geometric rug", note: "Unbranded · recycled cotton", price: 35_000, icon: "🔶", eco: "Recycled" },
  { id: "rug_jute", cat: "rug", name: "Hand-woven jute rug", note: "Unbranded · made in Kano", price: 48_000, icon: "🟫", eco: "Natural" },
  { id: "pc_old", cat: "computer", name: "Old big desktop", note: "1 article a shift · slow start-up", price: 0, icon: "🖥", starter: true, workSpeed: 1, desk: true },
  { id: "pc_laptop", cat: "computer", name: "Recent laptop (refurbished)", note: "2× faster · work anywhere", price: 180_000, icon: "💻", eco: "Refurbished", workSpeed: 2, desk: true },
  { id: "pc_aio", cat: "computer", name: "All-in-one display PC", note: "2.5× faster · no tower, low power", price: 320_000, icon: "🖥️", eco: "Low power", workSpeed: 2.5, desk: true },
  { id: "fan", cat: "cooling", name: "Standing fan", note: "Sleep is lighter on hot nights", price: 0, icon: "🌀", starter: true, sleepPerHour: 12 },
  { id: "ac", cat: "cooling", name: "Inverter split AC", note: "Deep sleep · solar-ready", price: 450_000, icon: "❄️", eco: "Inverter", sleepPerHour: 16 },
  { id: "cooker", cat: "kitchen", name: "Small cooker (2-plate induction)", note: "Cook at home: cheaper meals, takes time", price: 65_000, icon: "🍳", eco: "Induction" },
  { id: "lamp", cat: "lights", name: "Bedside lamp", note: "A warm light for reading", price: 0, icon: "💡", starter: true },
  { id: "lamp_led", cat: "lights", name: "LED lamp", note: "Brighter, a tenth of the power", price: 9_000, icon: "💡", eco: "LED" },
  { id: "phone_basic", cat: "phone", name: "Bedside deal phone", note: "A deal call about every 8 game hours", price: 0, icon: "☎️", starter: true, dealEveryHours: 8 },
  { id: "phone_smart", cat: "phone", name: "Smartphone deal line", note: "Deals every 4 game hours, bigger ones", price: 90_000, icon: "📱", dealEveryHours: 4, dealBoost: 1.3 },
  { id: "bicycle", cat: "transport", name: "Bicycle", note: "Free, healthy, a bit slow", price: 0, icon: "🚲", starter: true, commute: "bicycle" },
  { id: "ebike", cat: "transport", name: "Green Wheels e-bike", note: "12 min to Garki · 2× deliveries", price: 450_000, icon: "🛵", eco: "Zero fuel", commute: "ebike" },
  { id: "ev", cat: "transport", name: "Electric car", note: "Comfort and status · charges at EV points", price: 18_000_000, icon: "🚙", eco: "Electric", commute: "ev" },
];
export const ITEM = (id: string) => ITEMS.find((i) => i.id === id);
export const STARTER_ITEMS = ITEMS.filter((i) => i.starter).map((i) => i.id);
export const SHOP_CATS: { id: ItemCat; label: string }[] = [
  { id: "rug", label: "Rugs" }, { id: "computer", label: "Computer" }, { id: "cooling", label: "Cooling" }, { id: "kitchen", label: "Kitchen" },
  { id: "lights", label: "Lights" }, { id: "phone", label: "Phone" }, { id: "transport", label: "Transport" },
];
// The best owned item in a category (by price), which is the one that counts for speed, sleep or deals.
export function bestOwned(owned: string[], cat: ItemCat): Item | undefined {
  return ITEMS.filter((i) => i.cat === cat && owned.includes(i.id)).sort((a, b) => b.price - a.price)[0];
}

// ---- Getting around ----
export type TransportId = "bicycle" | "bus" | "keke" | "taxi" | "ebike" | "ev";
export const TRANSPORT: { id: TransportId; name: string; icon: string; minutes: number; price: number; energy: number; note: string; eco?: string; needs?: string }[] = [
  { id: "bicycle", name: "Your bicycle", icon: "🚲", minutes: 28, price: 0, energy: -10, note: "Fitness +", eco: "Zero fuel", needs: "bicycle" },
  { id: "bus", name: "Metro bus", icon: "🚌", minutes: 30, price: 200, energy: -3, note: "25 min + wait at Wuse stop", eco: "Shared" },
  { id: "keke", name: "Keke", icon: "🛺", minutes: 15, price: 400, energy: -2, note: "Gets you there on time" },
  { id: "taxi", name: "Taxi", icon: "🚕", minutes: 12, price: 1_500, energy: 0, note: "Door to door" },
  { id: "ebike", name: "Your e-bike", icon: "🛵", minutes: 12, price: 0, energy: -2, note: "Charged at home", eco: "Zero fuel", needs: "ebike" },
  { id: "ev", name: "Your electric car", icon: "🚙", minutes: 10, price: 0, energy: 0, note: "Charged at home", eco: "Electric", needs: "ev" },
];
export const TRANSPORT_OF = (id: string) => TRANSPORT.find((t) => t.id === id);
export const EBIKE_PROMPT_AFTER = 3; // after this many bicycle rides, suggest an e-bike

export type PlaceId = "home" | "work" | "chef" | "hotel";
export const PLACES: { id: PlaceId; name: string; area: string; icon: string }[] = [
  { id: "home", name: "Home", area: "Wuse", icon: "🏠" },
  { id: "chef", name: "Chef Adams", area: "Wuse", icon: "🍽" },
  { id: "hotel", name: "Candellux Imperial", area: "Garki", icon: "👑" },
  { id: "work", name: "Work", area: "Garki", icon: "💼" },
];

// ---- Jobs (they mirror NotesApp careers; Chef Adams is a partner brand) ----
export type Job = {
  id: string; title: string; employer: string; icon: string; pay: number; place: "home" | "work" | "chef";
  ladder?: string; needItem?: string[]; needCooking?: number; needChefShifts?: number; needReputation?: number; needHygiene?: number;
  brand?: "chef_adams"; usesBike?: boolean; soon?: boolean;
};
export const SHIFT_HOURS = 4;
export const SHIFT_MS = SHIFT_HOURS * GAME_HOUR_MS; // 8 real minutes
export const JOBS: Job[] = [
  { id: "writer", title: "Junior writer", employer: "Notesville Daily · from your desk", icon: "✍️", pay: 6_000, place: "home", ladder: "Intern → Editor → Publisher" },
  { id: "rider", title: "Delivery rider", employer: "Wuse market · your bicycle", icon: "📦", pay: 4_500, place: "work", usesBike: true, needItem: ["bicycle", "ebike"], ladder: "E-bike: 2× more deliveries" },
  { id: "tutor", title: "Maths tutor", employer: "Book sessions, like on NotesApp", icon: "🎓", pay: 8_000, place: "work", ladder: "Needs a good mood (all needs green)" },
  { id: "tech", title: "Tech freelancer", employer: "Remote clients · from your desk", icon: "💻", pay: 15_000, place: "home", needItem: ["pc_laptop", "pc_aio"] },
  { id: "fashion", title: "Fashion seller", employer: "Your own stall at Wuse market", icon: "🧵", pay: 0, place: "work", soon: true, ladder: "Your own store, like on NotesApp" },
  { id: "chef_kiosk", title: "Kiosk attendant", employer: "Chef Adams · takeaway kiosk, Wuse", icon: "🥡", pay: 4_000, place: "chef", brand: "chef_adams", needHygiene: 60 },
  { id: "chef_cook", title: "Line cook", employer: "Chef Adams · trained on the house recipes", icon: "🍳", pay: 5_500, place: "chef", brand: "chef_adams", needCooking: 3, ladder: "Cook → Supervisor → Partner" },
  { id: "chef_rider", title: "Delivery rider", employer: "Chef Adams · red bag provided", icon: "🛵", pay: 4_500, place: "chef", brand: "chef_adams", usesBike: true, needItem: ["bicycle", "ebike"] },
  { id: "chef_super", title: "Outlet supervisor", employer: "Chef Adams · run a shift, train staff", icon: "⭐", pay: 9_000, place: "chef", brand: "chef_adams", needChefShifts: 10, needReputation: 4 },
];
export const JOB = (id: string) => JOBS.find((j) => j.id === id);
// What a shift pays, decided when it starts: desk work goes faster on a better computer, riders twice as fast on an e-bike, and low needs cut pay.
export function shiftPay(job: Job, owned: string[], needsLow: boolean): number {
  let pay = job.pay;
  if (job.place === "home") pay *= bestOwned(owned, "computer")?.workSpeed ?? 1;
  if (job.usesBike && owned.includes("ebike")) pay *= 2;
  if (needsLow) pay *= LOW_PAY_FACTOR;
  return Math.round(pay);
}
export function jobBlocker(job: Job, p: { owned: string[]; cooking: number; chefShifts: number; reputation: number }): string | null {
  if (job.soon) return "Coming soon";
  if (job.needItem && !job.needItem.some((i) => p.owned.includes(i))) return `Needs ${job.needItem.map((i) => ITEM(i)?.name.toLowerCase()).join(" or ")}`;
  if (job.needCooking && p.cooking < job.needCooking) return `Needs cooking skill ${job.needCooking} (you have ${p.cooking})`;
  if (job.needChefShifts && p.chefShifts < job.needChefShifts) return `After ${job.needChefShifts} Chef Adams shifts (you have ${p.chefShifts})`;
  if (job.needReputation && p.reputation < job.needReputation) return `Needs reputation ${job.needReputation}★`;
  return null;
}
export const CHEF_PARTNER = { kiosk: 2_500_000, shop: 8_000_000 }; // shown now, buying an outlet comes later

// ---- Food: Chef Adams (partner) and cooking at home ----
export type Food = { id: string; name: string; group: "combo" | "rice" | "protein" | "side"; price: number; hunger: number };
export const FOODS: Food[] = [
  { id: "combo", name: "Chef's combo: jollof rice, chicken and plantain", group: "combo", price: 2_400, hunger: 50 },
  { id: "jollof", name: "Jollof rice", group: "rice", price: 1_200, hunger: 30 },
  { id: "fried", name: "Fried rice", group: "rice", price: 1_200, hunger: 30 },
  { id: "native", name: "Native rice", group: "rice", price: 1_500, hunger: 35 },
  { id: "noodles", name: "Noodles", group: "rice", price: 800, hunger: 20 },
  { id: "chicken", name: "Chicken", group: "protein", price: 1_000, hunger: 15 },
  { id: "beef", name: "Beef", group: "protein", price: 700, hunger: 10 },
  { id: "turkey", name: "Turkey", group: "protein", price: 1_500, hunger: 20 },
  { id: "fish", name: "Fish", group: "protein", price: 1_200, hunger: 15 },
  { id: "plantain", name: "Plantain", group: "side", price: 400, hunger: 8 },
  { id: "coleslaw", name: "Coleslaw", group: "side", price: 300, hunger: 5 },
  { id: "salad", name: "Salad", group: "side", price: 400, hunger: 6 },
  { id: "moimoi", name: "Moi moi", group: "side", price: 500, hunger: 10 },
];
export const FOOD = (id: string) => FOODS.find((f) => f.id === id);
export type FoodMode = "delivery" | "takeaway" | "dinein";
export const FOOD_MODES: Record<FoodMode, { label: string; icon: string; fee: number; minutes: number; fun: number; social: number; where: string }> = {
  delivery: { label: "Delivery", icon: "🛵", fee: 300, minutes: 25, fun: 0, social: 0, where: "To your room in Wuse" },
  takeaway: { label: "Takeaway", icon: "🥡", fee: 0, minutes: 5, fun: 0, social: 0, where: "At the Chef Adams kiosk" },
  dinein: { label: "Dine-in", icon: "🍽", fee: 0, minutes: 45, fun: 10, social: 5, where: "At the Chef Adams Mini Dine-In Shop" },
};
export const ORDER_MAX_ITEMS = 8;
export type Recipe = { id: string; name: string; icon: string; cost: number; minutes: number; plates: number; hunger: number };
export const RECIPES: Recipe[] = [
  { id: "jollof3", name: "Jollof rice (3 plates)", icon: "🍛", cost: 1_800, minutes: 40, plates: 3, hunger: 50 },
  { id: "fried3", name: "Fried rice (3 plates)", icon: "🍳", cost: 2_100, minutes: 50, plates: 3, hunger: 50 },
  { id: "noodles_egg", name: "Noodles and egg", icon: "🍜", cost: 400, minutes: 10, plates: 1, hunger: 25 },
];
export const RECIPE = (id: string) => RECIPES.find((r) => r.id === id);
export const cookingSkill = (cooks: number) => Math.min(10, 1 + Math.floor(cooks / 2));

// ---- Candellux Imperial Hotel & Suites (partner), Garki ----
export type HotelService = { id: string; name: string; icon: string; price: number; minutes: number; effect: Partial<Record<Need, number>>; set?: Partial<Record<Need, number>>; note: string; boost?: "barber" | "gym"; soon?: boolean };
export const HOTEL: HotelService[] = [
  { id: "suite", name: "Luxury suite (a night)", icon: "🛏", price: 180_000, minutes: 8 * 60, effect: { fun: 20 }, set: { energy: 100, hygiene: 100 }, note: "Energy and hygiene to 100% · mood: great" },
  { id: "restaurant", name: "24-hour restaurant", icon: "🍽", price: 6_500, minutes: 40, effect: { hunger: 70, fun: 10 }, note: "Hunger +70 · Fun +10" },
  { id: "pool", name: "Swimming pool (day pass)", icon: "🏊", price: 25_000, minutes: 60, effect: { fun: 30, energy: 10, hygiene: 5 }, note: "Fun +30 · Energy +10" },
  { id: "vipbar", name: "VIP bar", icon: "🍸", price: 12_000, minutes: 45, effect: { social: 40, fun: 10 }, note: "Social +40 · meet top players" },
  { id: "gym", name: "Gym", icon: "🏋", price: 10_000, minutes: 60, effect: { energy: -10, fun: 5 }, note: "Fitness: energy lasts longer for a game day", boost: "gym" },
  { id: "barber", name: "Barbing saloon", icon: "💈", price: 8_000, minutes: 30, effect: { hygiene: 10 }, note: "Look sharp: deals +10% for a game day", boost: "barber" },
  { id: "laundry", name: "Laundry", icon: "🧺", price: 3_000, minutes: 20, effect: { hygiene: 15 }, note: "Fresh outfits for the week" },
  { id: "conference", name: "Conference hall", icon: "🎤", price: 400_000, minutes: 0, effect: {}, note: "Host an event, sell tickets (coming soon)", soon: true },
];
export const HOTEL_OF = (id: string) => HOTEL.find((h) => h.id === id);
export const CANDELLUX = { name: "Candellux Imperial Hotel & Suites", tagline: "…We Strive for the Best", address: "Area 1, No. 5 Sir Anebo Okekenta Street, Garki, Abuja", whatsapp: "2349160049435", whatsappLabel: "+234 916 004 9435" };

// ---- Deal calls on the bedside phone ----
export type DealTemplate = { who: string; from: string; ask: string; cost: number; pay: number; hours: number };
export const DEALS: DealTemplate[] = [
  { who: "Mrs Okafor", from: "Garki Boutique", ask: "I need 20 shirts for my staff by Friday. You dey?", cost: 60_000, pay: 90_000, hours: 12 },
  { who: "Musa", from: "Wuse market", ask: "Help me buy 50 cartons of noodles wholesale. I go pay you well.", cost: 25_000, pay: 38_000, hours: 8 },
  { who: "Pastor Daniel", from: "Area 1 church", ask: "We need chairs and canopies for Sunday. Can you arrange am?", cost: 40_000, pay: 62_000, hours: 16 },
  { who: "Ify", from: "Notesville Daily", ask: "Write 3 sponsored articles for a client by tomorrow?", cost: 0, pay: 15_000, hours: 10 },
  { who: "Alhaja Kudi", from: "Maitama", ask: "Find me a good tailor and handle my daughter's aso-ebi, 12 pieces.", cost: 70_000, pay: 105_000, hours: 20 },
  { who: "Chinedu", from: "Jabi", ask: "Supply 30 power banks for my phone shop. Cash on delivery.", cost: 90_000, pay: 130_000, hours: 14 },
];
export const NEGOTIATE_CHANCE = 0.6;

// ---- Net worth and the Billionaires List ----
export function netWorth(naira: number, owned: string[]): number {
  return naira + owned.reduce((n, id) => n + (ITEM(id)?.price ?? 0), 0);
}
export const RICH_TITLE = "Billionaires List";
export const RICH_SUBTITLE = "NotesVille Fat Wallet Index";

// ---- The world clock ----
export function worldTime(now = Date.now()): { hour: number; minute: number; label: string; night: boolean } {
  const f = (((now - WORLD_EPOCH) % GAME_DAY_MS) + GAME_DAY_MS) % GAME_DAY_MS / GAME_DAY_MS;
  const mins = Math.floor(f * 24 * 60 + 6 * 60) % (24 * 60);
  const hour = Math.floor(mins / 60), minute = mins % 60;
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return { hour, minute, label: `${h12}:${String(minute).padStart(2, "0")} ${hour < 12 ? "AM" : "PM"}`, night: hour >= 19 || hour < 6 };
}
export const lifeDay = (startedAt: number, now = Date.now()) => Math.max(1, Math.floor((now - startedAt) / GAME_DAY_MS) + 1);
export const gameMinutesToMs = (m: number) => m * GAME_MIN_MS;
export const fmtN = (n: number) => `N$ ${Math.round(n).toLocaleString("en-NG")}`;
export const fmtShort = (n: number) => (n >= 1e9 ? `N$ ${(n / 1e9).toFixed(2)}bn` : n >= 1e6 ? `N$ ${(n / 1e6).toFixed(1)}m` : fmtN(n));
