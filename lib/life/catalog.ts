import { LIFE_URL } from "@/lib/host";
import { setting } from "@/lib/config";
// Notes Life: the game's rules and everything that can be bought, eaten, worked or ridden. Shared by the server (which owns money and
// ownership: lib/life/server.ts), the game screens and the tests. Prices are in Notesville Naira (N$), whole numbers.
// Decided 14 October 2026: start with N$ 100,000 on day 1 in Wuse, Abuja; ₦1 of NotesApp Credit buys N$ 100; 24 game hours = 48 real
// minutes (30 game days = 24 real hours); rent N$ 60,000 every 30 game days.

export const LIFE_LIVE = setting("NEXT_PUBLIC_LIFE_LIVE") !== "false";

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
// The city picker: our own drawings of each city's landmark (public/images/life/cities/).
export const CITY_CARDS = [
  { id: "abuja", name: "Abuja", landmark: "City Gate · “You are welcome” · Wuse, Garki, Maitama", icon: "/images/life/cities/abuja.svg" },
  { id: "lagos", name: "Lagos", landmark: "Wole Soyinka Centre for Culture and Creative Arts (National Theatre), Iganmu", icon: "/images/life/cities/lagos.svg" },
  { id: "port_harcourt", name: "Port Harcourt", landmark: "Isaac Boro Park · the Garden City", icon: "/images/life/cities/port-harcourt.svg" },
];

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
export type ItemCat = "rug" | "computer" | "cooling" | "kitchen" | "lights" | "phone" | "transport" | "power";
export type Item = {
  id: string; cat: ItemCat; name: string; note: string; price: number; icon: string; eco?: string; starter?: boolean;
  workSpeed?: number; sleepPerHour?: number; dealEveryHours?: number; dealBoost?: number; commute?: TransportId; desk?: boolean;
  needs?: string; soon?: boolean; brand?: "itel"; litresPerHour?: number; tank?: number;
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
  { id: "fridge", cat: "kitchen", name: "Fridge", note: "Keeps cooked plates and takeaway fresh while it has power. Without one, food spoils after 8 game hours", price: 160_000, icon: "🧊", eco: "Inverter" },
  { id: "microwave", cat: "kitchen", name: "Microwave", note: "Warm stored food in 2 game minutes: full Hunger instead of cold leftovers", price: 45_000, icon: "♨️" },
  { id: "lamp", cat: "lights", name: "Bedside lamp", note: "A warm light for reading", price: 0, icon: "💡", starter: true },
  { id: "lamp_led", cat: "lights", name: "LED lamp", note: "Brighter, a tenth of the power", price: 9_000, icon: "💡", eco: "LED" },
  { id: "phone_basic", cat: "phone", name: "Bedside deal phone", note: "A deal call about every 8 game hours", price: 0, icon: "☎️", starter: true, dealEveryHours: 8 },
  { id: "phone_smart", cat: "phone", name: "Smartphone deal line", note: "Deals every 4 game hours, bigger ones", price: 90_000, icon: "📱", dealEveryHours: 4, dealBoost: 1.3 },
  // Power for NEPA's blackouts. itel Energy (partner) via @clickam, the itel distributor on NotesApp; generators from the market.
  { id: "power_go", cat: "power", name: "itel Power GO Pro", note: "320Wh · 200W · lamp, fan and laptop through a blackout · silent", price: 150_000, icon: "🔋", eco: "No fuel", brand: "itel" },
  { id: "solar_panel", cat: "power", name: "itel 100W solar panel", note: "Charges your Power GO by day, even when NEPA is off", price: 55_000, icon: "☀️", eco: "Solar", brand: "itel", needs: "power_go" },
  { id: "power_tank", cat: "power", name: "itel Power Tank 1000", note: "1000W AC output · keeps your fridge cold about 5 game hours in a blackout, and the lights on", price: 400_000, icon: "🔋", eco: "No fuel", brand: "itel" },
  { id: "solar_650", cat: "power", name: "itel 650W bifacial solar panel", note: "Charges your Power Tank by day, even when NEPA is off · it takes two", price: 110_000, icon: "☀️", eco: "Solar", brand: "itel", needs: "power_tank" },
  { id: "solar_650b", cat: "power", name: "itel 650W bifacial panel (second)", note: "Two panels fill the Power Tank twice as fast", price: 110_000, icon: "☀️", eco: "Solar", brand: "itel", needs: "solar_650" },
  { id: "home_kit", cat: "power", name: "itel small home solar kit", note: "IP66 inverter, battery and 4 panels: the whole room, never off again", price: 2_400_000, icon: "🏠", eco: "Solar", brand: "itel", soon: true },
  { id: "gen_small", cat: "power", name: "“I Better Pass My Neighbour” 950W", note: "Bulb, fan and charging · loud · 0.4 L of petrol a game hour", price: 65_000, icon: "⛽", litresPerHour: 0.4, tank: 5 },
  { id: "gen_big", cat: "power", name: "Big generator 3.5kVA", note: "Runs everything, AC too · very loud · 1.1 L a game hour", price: 420_000, icon: "🛢️", litresPerHour: 1.1, tank: 12 },
  { id: "bicycle", cat: "transport", name: "Bicycle", note: "Free, healthy, a bit slow", price: 0, icon: "🚲", starter: true, commute: "bicycle" },
  { id: "ebike", cat: "transport", name: "Green Wheels e-bike", note: "12 min to Garki · 2× deliveries", price: 450_000, icon: "🛵", eco: "Zero fuel", commute: "ebike" },
  { id: "ev", cat: "transport", name: "Electric car", note: "Comfort and status · charges at EV points", price: 18_000_000, icon: "🚙", eco: "Electric", commute: "ev" },
];
export const ITEM = (id: string) => ITEMS.find((i) => i.id === id);
export const STARTER_ITEMS = ITEMS.filter((i) => i.starter).map((i) => i.id);
export const SHOP_CATS: { id: ItemCat; label: string }[] = [
  { id: "rug", label: "Rugs" }, { id: "computer", label: "Computer" }, { id: "cooling", label: "Cooling" }, { id: "kitchen", label: "Kitchen" },
  { id: "lights", label: "Lights" }, { id: "phone", label: "Phone" }, { id: "power", label: "Power" }, { id: "transport", label: "Transport" },
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

export type PlaceId = "home" | "work" | "chef" | "hotel" | "itel" | "dw" | "market" | "wuse2";
export const PLACES: { id: PlaceId; name: string; area: string; icon: string }[] = [
  { id: "home", name: "Home", area: "Wuse", icon: "🏠" },
  { id: "chef", name: "Chef Adams", area: "Wuse", icon: "🍽" },
  { id: "hotel", name: "Candellux Imperial", area: "Garki", icon: "👑" },
  { id: "itel", name: "itel Energy", area: "Wuse", icon: "⚡" },
  { id: "work", name: "Work", area: "Garki", icon: "💼" },
  { id: "dw", name: "Digital Witch hub", area: "CBD", icon: "🎓" },
  { id: "market", name: "Wuse Market, Zone 4", area: "Wuse", icon: "🛍" },
  { id: "wuse2", name: "Aminu Kano Crescent, Wuse II", area: "Wuse II", icon: "🌃" },
];

// ---- Jobs (they mirror NotesApp careers; Chef Adams is a partner brand) ----
export type Brand = "chef_adams" | "itel" | "candellux" | "luxnas";
export type Job = {
  id: string; title: string; employer: string; icon: string; pay: number; place: "home" | "work" | "chef" | "itel" | "hotel" | "market";
  ladder?: string; needItem?: string[]; needCooking?: number; needBrandShifts?: number; needReputation?: number; needHygiene?: number; needFitness?: boolean;
  brand?: Brand; usesBike?: boolean; soon?: boolean;
  extra?: { label: string; min: number; max: number; step: number }; // paid on top when the shift ends: tips, a bonus on what you sold
  needSwim?: number; needGymSessions?: number; // swimming skill (lessons and swims at Candellux), gym sessions done
  meal?: number; // a free staff meal at the end of the shift (Hunger)
  needCert?: string; // a Digital Witch certificate: a course id, or "any"
  tech?: boolean; // a tech job: its shifts count towards Cynthia's graduate giveaway
  needLuxCert?: string; // a LUXNAS Academy certificate (a LUX_COURSES id)
};
export const SHIFT_HOURS = 4;
export const SHIFT_MS = SHIFT_HOURS * GAME_HOUR_MS; // 8 real minutes
export const JOBS: Job[] = [
  { id: "writer", title: "Junior writer", employer: "Notesville Daily · from your desk", icon: "✍️", pay: 6_000, place: "home", ladder: "Intern → Editor → Publisher" },
  { id: "rider", title: "Delivery rider", employer: "Wuse market · your bicycle", icon: "📦", pay: 4_500, place: "work", usesBike: true, needItem: ["bicycle", "ebike"], ladder: "E-bike: 2× more deliveries" },
  { id: "tutor", title: "Maths tutor", employer: "Book sessions, like on NotesApp", icon: "🎓", pay: 8_000, place: "work", ladder: "Needs a good mood (all needs green)" },
  { id: "tech", title: "Tech freelancer", employer: "Remote clients · from your desk", icon: "💻", pay: 15_000, place: "home", needItem: ["pc_laptop", "pc_aio"], needCert: "any", tech: true },
  // Tech jobs: remote, from your desk, each needs its Digital Witch certificate (from 16 October 2026; players already in a tech job keep it)
  { id: "dw_va", title: "Remote virtual assistant", employer: "Remote clients · from your desk · Digital Witch certified", icon: "🧑‍💻", pay: 9_000, place: "home", needCert: "va", tech: true },
  { id: "dw_cs", title: "Remote customer support", employer: "Global brands · from your desk · Digital Witch certified", icon: "🎧", pay: 8_500, place: "home", needCert: "cs", tech: true },
  { id: "dw_smm", title: "Social media manager", employer: "Brands and creators · from your desk · Digital Witch certified", icon: "📱", pay: 11_000, place: "home", needCert: "smm", tech: true },
  { id: "dw_pm", title: "Remote project coordinator", employer: "Tech teams abroad · from your desk · Digital Witch certified", icon: "🗂", pay: 14_000, place: "home", needCert: "pm", tech: true },
  { id: "dw_data", title: "Data analyst", employer: "Remote clients · from your desk · Digital Witch certified", icon: "📊", pay: 16_000, place: "home", needItem: ["pc_laptop", "pc_aio"], needCert: "data", tech: true },
  { id: "dw_ux", title: "UI/UX designer", employer: "Product teams · from your desk · Digital Witch certified", icon: "🎨", pay: 18_000, place: "home", needItem: ["pc_laptop", "pc_aio"], needCert: "ux", tech: true },
  { id: "fashion", title: "Fashion seller", employer: "Your own stall at Wuse market", icon: "🧵", pay: 0, place: "work", soon: true, ladder: "Your own store, like on NotesApp" },
  { id: "chef_kiosk", title: "Kiosk attendant", employer: "Chef Adams · takeaway kiosk, Wuse", icon: "🥡", pay: 4_000, place: "chef", brand: "chef_adams", needHygiene: 60 },
  { id: "chef_cook", title: "Line cook", employer: "Chef Adams · trained on the house recipes", icon: "🍳", pay: 5_500, place: "chef", brand: "chef_adams", needCooking: 3, ladder: "Cook → Supervisor → Partner" },
  { id: "chef_rider", title: "Delivery rider", employer: "Chef Adams · red bag provided", icon: "🛵", pay: 4_500, place: "chef", brand: "chef_adams", usesBike: true, needItem: ["bicycle", "ebike"] },
  { id: "chef_super", title: "Outlet supervisor", employer: "Chef Adams · run a shift, train staff", icon: "⭐", pay: 9_000, place: "chef", brand: "chef_adams", needBrandShifts: 10, needReputation: 4 },
  // itel Energy (partner), Wuse market road
  { id: "itel_sales", title: "Sales attendant", employer: "itel Energy · Wuse shop · a bonus on every Power GO you sell", icon: "🛍", pay: 5_000, place: "itel", brand: "itel", ladder: "Attendant → Supervisor → Partner", extra: { label: "Power GO sales bonus", min: 0, max: 1_500, step: 500 } },
  { id: "itel_carlcare", title: "CarlCare technician", employer: "itel Energy · repairs and warranty swaps", icon: "🔧", pay: 8_000, place: "itel", brand: "itel", needItem: ["pc_laptop", "pc_aio"] },
  { id: "itel_installer", title: "Solar installer", employer: "itel Energy · ride out to homes and fit panels", icon: "☀️", pay: 9_000, place: "itel", brand: "itel", usesBike: true, needItem: ["bicycle", "ebike"], ladder: "E-bike: 2× more installs" },
  { id: "itel_super", title: "Store supervisor", employer: "itel Energy · run the shop, train staff", icon: "⭐", pay: 12_000, place: "itel", brand: "itel", needBrandShifts: 10 },
  // Candellux Imperial Hotel & Suites (partner), Garki
  { id: "hotel_desk", title: "Front desk", employer: "Candellux · check guests in, answer the phone", icon: "🛎", pay: 6_000, place: "hotel", brand: "candellux", needHygiene: 70 },
  { id: "hotel_waiter", title: "Restaurant waiter", employer: "Candellux · 24-hour restaurant · tips from guests", icon: "🍽", pay: 5_000, place: "hotel", brand: "candellux", extra: { label: "Tips", min: 500, max: 3_000, step: 100 } },
  { id: "hotel_house", title: "Housekeeping", employer: "Candellux · suites and laundry · a free staff meal", icon: "🧺", pay: 4_500, place: "hotel", brand: "candellux", meal: 40 },
  { id: "hotel_guard", title: "Pool lifeguard", employer: "Candellux · sit in the high chair; rescue a swimmer in trouble for a bonus", icon: "🏊", pay: 6_500, place: "hotel", brand: "candellux", needFitness: true, extra: { label: "Rescue bonus", min: 0, max: 1_500, step: 500 } },
  { id: "hotel_swim", title: "Swimming instructor", employer: "Candellux · teach residents and players to swim", icon: "🎓", pay: 8_000, place: "hotel", brand: "candellux", needSwim: 5, extra: { label: "Lesson bonus", min: 500, max: 2_000, step: 500 } },
  { id: "hotel_gym", title: "Gym instructor", employer: "Candellux · classes and personal training", icon: "🏋", pay: 8_500, place: "hotel", brand: "candellux", needGymSessions: 10 },
  { id: "hotel_cook", title: "Restaurant cook", employer: "Candellux · the 24-hour kitchen", icon: "👨‍🍳", pay: 7_500, place: "hotel", brand: "candellux", needCooking: 4 },
  { id: "hotel_manager", title: "Duty manager", employer: "Candellux · run the hotel for a shift", icon: "👑", pay: 15_000, place: "hotel", brand: "candellux", needBrandShifts: 15, needReputation: 4, ladder: "Front desk → Supervisor → Manager" },
  // LUXNAS (partner, from 27 October 2026): custom tailoring and bespoke African fashion, Wuse Market (Zone 4). Train at LUXNAS Academy.
  { id: "lux_rider", title: "Delivery rider", employer: "LUXNAS · finished orders to customers around Abuja", icon: "🛍", pay: 4_500, place: "market", brand: "luxnas", usesBike: true, needItem: ["bicycle", "ebike"], ladder: "E-bike: 2× more deliveries" },
  { id: "lux_tailor", title: "Tailor", employer: "LUXNAS · Senator suits, Agbadas, Kaftans and custom-fit jeans", icon: "🧵", pay: 7_000, place: "market", brand: "luxnas", needLuxCert: "lux_tailoring", ladder: "Tailor → Designer → Studio owner" },
  { id: "lux_embroider", title: "Embroiderer", employer: "LUXNAS · embroidery on Agbadas, Kaftans and bridal wear", icon: "🪡", pay: 8_000, place: "market", brand: "luxnas", needLuxCert: "lux_embroidery" },
  { id: "lux_designer", title: "Fashion designer", employer: "LUXNAS · Ankara sets, Asoebi and bridal, bespoke pieces · tips from happy clients", icon: "👗", pay: 12_000, place: "market", brand: "luxnas", needLuxCert: "lux_design", extra: { label: "Client tips", min: 0, max: 3_000, step: 500 } },
  { id: "lux_super", title: "Studio supervisor", employer: "LUXNAS · run the studio, train the tailors", icon: "⭐", pay: 13_000, place: "market", brand: "luxnas", needBrandShifts: 10, needLuxCert: "lux_tailoring" },
];
export const BRAND_NAME: Record<Brand, string> = { chef_adams: "Chef Adams", itel: "itel Energy", candellux: "Candellux", luxnas: "LUXNAS" };
// Real players work shifts at the brands' own outlets; outlets players own are staffed by residents (🤖) only, for now.
export const STAFF_PERKS = { itelDiscount: 0.2, hotelHalf: ["pool", "gym", "vipbar", "poolbar"] }; // itel staff: 20% off itel products; Candellux staff: half price
export const isStaff = (jobId: string | null, brand: Brand) => !!jobId && JOB(jobId)?.brand === brand;
export const JOB = (id: string) => JOBS.find((j) => j.id === id);
// What a shift pays, decided when it starts: desk work goes faster on a better computer, riders twice as fast on an e-bike, and low needs cut pay.
export function shiftPay(job: Job, owned: string[], needsLow: boolean): number {
  let pay = job.pay;
  if (job.place === "home") pay *= bestOwned(owned, "computer")?.workSpeed ?? 1;
  if (job.usesBike && owned.includes("ebike")) pay *= 2;
  if (needsLow) pay *= LOW_PAY_FACTOR;
  return Math.round(pay);
}
export type JobCheck = { owned: string[]; cooking: number; chefShifts: number; itelShifts?: number; hotelShifts?: number; luxShifts?: number; luxCerts?: string[]; reputation: number; fit?: boolean; swim?: number; gymSessions?: number; certs?: string[] };
export const brandShifts = (p: Pick<JobCheck, "chefShifts" | "itelShifts" | "hotelShifts" | "luxShifts">, b: Brand) => (b === "chef_adams" ? p.chefShifts : b === "itel" ? p.itelShifts ?? 0 : b === "luxnas" ? p.luxShifts ?? 0 : p.hotelShifts ?? 0);
export function jobBlocker(job: Job, p: JobCheck): string | null {
  if (job.soon) return "Coming soon";
  if (job.needItem && !job.needItem.some((i) => p.owned.includes(i))) return `Needs ${job.needItem.map((i) => ITEM(i)?.name.toLowerCase()).join(" or ")}`;
  if (job.needCooking && p.cooking < job.needCooking) return `Needs cooking skill ${job.needCooking} (you have ${p.cooking})`;
  if (job.needBrandShifts && job.brand && brandShifts(p, job.brand) < job.needBrandShifts) return `After ${job.needBrandShifts} ${BRAND_NAME[job.brand]} shifts (you have ${brandShifts(p, job.brand)})`;
  if (job.needReputation && p.reputation < job.needReputation) return `Needs reputation ${job.needReputation}★`;
  if (job.needFitness && !p.fit) return "Needs fitness: train at the Candellux gym first";
  if (job.needSwim && (p.swim ?? 0) < job.needSwim) return `Needs swimming skill ${job.needSwim} (you have ${p.swim ?? 0})`;
  if (job.needGymSessions && (p.gymSessions ?? 0) < job.needGymSessions) return `After ${job.needGymSessions} gym sessions (${p.gymSessions ?? 0} so far)`;
  if (job.needLuxCert && !(p.luxCerts ?? []).includes(job.needLuxCert)) return `Needs the LUXNAS Academy ${LUX_COURSE(job.needLuxCert)?.name ?? ""} certificate`;
  if (job.needCert) {
    const certs = p.certs ?? [];
    if (job.needCert === "any" ? !certs.length : !certs.includes(job.needCert)) return job.needCert === "any" ? "Needs a Digital Witch certificate" : `Needs the Digital Witch ${DW_COURSE(job.needCert)?.name ?? ""} certificate`;
  }
  return null;
}
// The extra on top of a shift (tips, a sales bonus), rolled when it ends.
export const shiftExtra = (job: Job, rand: () => number) => (job.extra ? job.extra.min + Math.floor(rand() * ((job.extra.max - job.extra.min) / job.extra.step + 1)) * job.extra.step : 0);

// ---- Partner outlets: own a Chef Adams or itel outlet. It sells while you're away, staffed by residents (🤖); you collect the takings.
// Takings wait up to 30 game days (about a real day); after that the outlet stops selling until you collect. Without backup power it
// sells half during NEPA's blackouts, and quality slips while takings sit uncollected. Agreed 14 October 2026: Chef Adams keeps 8% of
// sales as the brand fee; itel earns from the stock you buy at partner prices. ----
export type OutletKind = "chef_kiosk" | "chef_shop" | "itel_home" | "itel_mall" | "luxnas_studio";
export type OutletType = {
  id: OutletKind; brand: "chef_adams" | "itel" | "luxnas"; name: string; short: string; icon: string; price: number; salesPerDay: number;
  feeRate: number; stockRate: number; staff: number; wage: number; ticket: number; staffRole: string;
  needs: { brandShifts?: number; reputation?: number; item?: string; outlet?: OutletKind; outletDays?: number; quality?: number };
};
export const OUTLETS: OutletType[] = [
  { id: "chef_kiosk", brand: "chef_adams", name: "Chef Adams Takeaway Kiosk", short: "Takeaway Kiosk", icon: "🥡", price: 2_500_000, salesPerDay: 110_000, feeRate: 0.08, stockRate: 0.2, staff: 2, wage: 3_500, ticket: 1_800, staffRole: "kiosk attendant", needs: { brandShifts: 10, reputation: 3 } },
  { id: "chef_shop", brand: "chef_adams", name: "Chef Adams Mini Dine-In Shop", short: "Mini Dine-In Shop", icon: "🍽", price: 8_000_000, salesPerDay: 330_000, feeRate: 0.08, stockRate: 0.2, staff: 6, wage: 4_000, ticket: 2_600, staffRole: "cook or waiter", needs: { outlet: "chef_kiosk", outletDays: 7, quality: 80, reputation: 4 } },
  { id: "itel_home", brand: "itel", name: "itel Home Store", short: "Home Store", icon: "🏪", price: 1_500_000, salesPerDay: 150_000, feeRate: 0, stockRate: 0.66, staff: 1, wage: 4_000, ticket: 30_000, staffRole: "sales attendant", needs: { brandShifts: 5, item: "power_go" } },
  { id: "itel_mall", brand: "itel", name: "itel Mall Store", short: "Mall Store", icon: "🏬", price: 7_000_000, salesPerDay: 560_000, feeRate: 0, stockRate: 0.64, staff: 4, wage: 5_000, ticket: 45_000, staffRole: "sales or CarlCare", needs: { outlet: "itel_home", outletDays: 7, reputation: 4 } },
  { id: "luxnas_studio", brand: "luxnas", name: "LUXNAS Tailoring Studio", short: "Tailoring Studio", icon: "🧵", price: 3_000_000, salesPerDay: 150_000, feeRate: 0.1, stockRate: 0.25, staff: 2, wage: 4_000, ticket: 25_000, staffRole: "tailor", needs: { brandShifts: 10, reputation: 3 } },
];
export const OUTLET = (id: string) => OUTLETS.find((o) => o.id === id);
export type OutletArea = "wuse" | "garki";
export const OUTLET_AREAS: Record<OutletArea, { name: string; k: number }> = { wuse: { name: "Wuse market", k: 1 }, garki: { name: "Garki Area 1", k: 1.12 } };
export const OUTLET_HOLD_DAYS = 30;
export const OUTLET_BACKUP = { price: 620_000, name: "itel Power Tank 1000 and two 650W bifacial panels" };
export const OUTLET_STAFF = ["Emeka", "Halima", "Tunde", "Aisha", "Chinedu", "Ngozi", "Musa", "Ifeoma"];
export const REAL_PARTNER: Record<"chef_adams" | "itel" | "luxnas", string> = {
  luxnas: "https://www.notesapp.name.ng/s/luxnas",
  chef_adams: `/journals/own-a-chef-adams-franchise-in-your-choice-location`,
  itel: "https://www.itel-life.com/ng/itel-home/about-itel-home",
};
export type Outlet = { kind: OutletKind; area: OutletArea; openedAt: number; lastCollectAt: number; earned: number; backup: boolean };
export const outletPrice = (t: OutletType, area: OutletArea) => Math.round((t.price * OUTLET_AREAS[area].k) / 10_000) * 10_000;
export const outletValue = (o: Outlet) => { const t = OUTLET(o.kind); return t ? Math.round(outletPrice(t, o.area) * 0.96) : 0; };
// Quality: 96% with backup power, 88% without, and 2 points lower for every game day takings sit uncollected after the third.
export const outletQuality = (o: Outlet, at: number) => Math.max(60, (o.backup ? 96 : 88) - 2 * Math.max(0, (at - o.lastCollectAt) / GAME_DAY_MS - 3));
export function outletProfitPerDay(t: OutletType, area: OutletArea, quality = 100) {
  return Math.round(t.salesPerDay * OUTLET_AREAS[area].k * (quality / 100) * (1 - t.feeRate - t.stockRate) - t.staff * t.wage);
}
// What's waiting to be collected now: day by day since the last collection (at most 30 game days), sales at that day's quality, half
// sales in blackout hours without backup power, less the brand fee or stock, and the staff's wages.
export function outletTakings(o: Outlet, now: number): { takings: number; days: number; quality: number; capped: boolean; customers: number } {
  const t = OUTLET(o.kind);
  if (!t) return { takings: 0, days: 0, quality: 0, capped: false, customers: 0 };
  const end = Math.min(now, o.lastCollectAt + OUTLET_HOLD_DAYS * GAME_DAY_MS);
  const k = OUTLET_AREAS[o.area]?.k ?? 1, perMs = (t.salesPerDay * k) / GAME_DAY_MS, margin = 1 - t.feeRate - t.stockRate;
  let gross = 0;
  for (let a = o.lastCollectAt; a < end; a += GAME_DAY_MS) {
    const b = Math.min(end, a + GAME_DAY_MS);
    let outMs = 0;
    if (!o.backup) { const d0 = Math.floor((a - WORLD_EPOCH) / GAME_DAY_MS); for (let d = d0 - 1; d <= d0 + 1; d++) for (const x of outagesOfDay(d)) outMs += Math.max(0, Math.min(b, x.to) - Math.max(a, x.from)); }
    gross += perMs * (b - a - outMs * 0.5) * (outletQuality(o, (a + b) / 2) / 100);
  }
  const days = Math.max(0, end - o.lastCollectAt) / GAME_DAY_MS;
  const quality = outletQuality(o, now);
  return { takings: Math.max(0, Math.round(gross * margin - t.staff * t.wage * days)), days, quality, capped: now >= o.lastCollectAt + OUTLET_HOLD_DAYS * GAME_DAY_MS, customers: Math.round((t.salesPerDay * k * quality) / 100 / t.ticket) };
}
export type OutletCheck = { owned: string[]; chefShifts: number; itelShifts: number; luxShifts?: number; reputation: number; outlets: Outlet[] };
export function outletBlocker(t: OutletType, p: OutletCheck, now: number): string | null {
  const n = t.needs;
  if (p.outlets.some((o) => o.kind === t.id)) return "You already own one";
  const shifts = t.brand === "chef_adams" ? p.chefShifts : t.brand === "luxnas" ? p.luxShifts ?? 0 : p.itelShifts;
  if (n.brandShifts && shifts < n.brandShifts) return `After ${n.brandShifts} ${BRAND_NAME[t.brand]} shifts (you have ${shifts})`;
  if (n.item && !p.owned.includes(n.item)) return `Own a ${ITEM(n.item)?.name ?? n.item} first`;
  if (n.outlet) {
    const base = p.outlets.find((o) => o.kind === n.outlet), bt = OUTLET(n.outlet)!;
    if (!base) return `Run a ${bt.short} first`;
    const days = Math.floor((now - base.openedAt) / GAME_DAY_MS);
    if (n.outletDays && days < n.outletDays) return `Run your ${bt.short} for ${n.outletDays} game days (${days} so far)`;
    if (n.quality && outletQuality(base, now) < n.quality) return `Keep your ${bt.short} at quality ${n.quality}%+`;
  }
  if (n.reputation && p.reputation < n.reputation) return `Needs reputation ${n.reputation}★ (you have ${p.reputation.toFixed(1)})`;
  return null;
}

// ---- Food: Chef Adams (partner) and cooking at home ----
export type Food = { id: string; name: string; group: "combo" | "rice" | "protein" | "side" | "fast" | "fresh"; price: number; hunger: number };
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
  // from the real Chef Adams menu: shawarma and pizza, and the "Sum Ting Fresh" range
  { id: "shawarma", name: "Chicken shawarma", group: "fast", price: 3_500, hunger: 45 },
  { id: "pizza", name: "Pizza to share", group: "fast", price: 6_000, hunger: 70 },
  { id: "smoothie", name: "Banana smoothie", group: "fresh", price: 1_800, hunger: 15 },
  { id: "juice", name: "Cold-pressed juice", group: "fresh", price: 1_500, hunger: 10 },
  { id: "parfait", name: "Yoghurt parfait", group: "fresh", price: 2_000, hunger: 20 },
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
export type HotelService = { id: string; name: string; icon: string; price: number; minutes: number; effect: Partial<Record<Need, number>>; set?: Partial<Record<Need, number>>; note: string; boost?: "barber" | "gym"; soon?: boolean; tab?: "pool" };
// A stay in a suite: you have the room till checkout at 11 AM, game time, even when you go for a swim or leave the hotel. A stay is a
// hotel day (24 game hours, 11 AM to 11 AM); check in early in the morning (from 6 AM) and it runs to 11 AM the next day. Every
// time you're in the room, Energy, Hygiene, Bladder and Fun go to 100%, and food from the hotel restaurant comes as room service
// (Hunger to 100%).
export const HOTEL_CHECKOUT_HOUR = 11;
export const SUITE_SET: Partial<Record<Need, number>> = { energy: 100, hygiene: 100, bladder: 100, fun: 100 };
export function hotelCheckout(now = Date.now()): number {
  const t = worldTime(now);
  let hours = HOTEL_CHECKOUT_HOUR - (t.hour + t.minute / 60);
  if (hours <= 0) hours += 24;
  if (hours <= HOTEL_CHECKOUT_HOUR - 6) hours += 24; // checked in from 6 AM: tomorrow's 11 AM
  return now + Math.round(hours * GAME_HOUR_MS);
}
export const lodged = (hotelUntil: number, now = Date.now()) => hotelUntil > now;
export const HOTEL: HotelService[] = [
  { id: "suite", name: "Luxury suite (a stay)", icon: "🛏", price: 180_000, minutes: 60, effect: {}, set: SUITE_SET, note: "Your room till 11 AM checkout · Energy, Hygiene, Bladder and Fun to 100% · room service fills you up" },
  { id: "restaurant", name: "24-hour restaurant", icon: "🍽", price: 6_500, minutes: 40, effect: { hunger: 70, fun: 10 }, note: "Hunger +70 · Fun +10 · as room service while you're staying: Hunger to 100%" },
  { id: "pool", name: "Swim · day pass", icon: "🏊", price: 25_000, minutes: 60, effect: { fun: 30, energy: 10, hygiene: 5 }, note: "Swim with residents and players. Fun +30 · Energy +10", tab: "pool" },
  { id: "lesson", name: "Swimming lesson", icon: "🎓", price: 15_000, minutes: 45, effect: { fun: 10, energy: -8 }, note: "With Coach Femi 🤖 · swimming skill +2 · after 3 you can swim in the deep end", tab: "pool" },
  { id: "gym", name: "Gym session", icon: "🏋", price: 10_000, minutes: 60, effect: { energy: -10, fun: 5 }, note: "With a gym instructor · fitness: energy lasts longer for a game day (needed for lifeguard)", boost: "gym", tab: "pool" },
  { id: "poolbar", name: "Pool bar", icon: "🍹", price: 10_000, minutes: 30, effect: { social: 25, fun: 10 }, note: "Drinks and small chops on the grass · Social +25 · Fun +10", tab: "pool" },
  { id: "vipbar", name: "VIP bar", icon: "👑", price: 11_500, minutes: 45, effect: { social: 40, fun: 10 }, note: "15% more than the pool bar · Social +40 · meet the VIPs, the richest on the Billionaires List", tab: "pool" },
  { id: "barber", name: "Barbing saloon", icon: "💈", price: 8_000, minutes: 30, effect: { hygiene: 10 }, note: "Look sharp: deals +10% for a game day", boost: "barber" },
  { id: "laundry", name: "Laundry", icon: "🧺", price: 3_000, minutes: 20, effect: { hygiene: 15 }, note: "Fresh outfits for the week" },
  { id: "conference", name: "Conference hall", icon: "🎤", price: 400_000, minutes: 0, effect: {}, note: "Host an event, sell tickets (coming soon)", soon: true },
];
export const HOTEL_OF = (id: string) => HOTEL.find((h) => h.id === id);
// What a player pays, staff perks included: the server charges this and the CardTap terminal shows it (lib/life/cardtap.ts).
export const itemPrice = (it: Item, jobId: string | null) => (it.brand === "itel" && isStaff(jobId, "itel") ? Math.round(it.price * (1 - STAFF_PERKS.itelDiscount)) : it.price);
export const hotelPrice = (h: HotelService, jobId: string | null) => (isStaff(jobId, "candellux") && STAFF_PERKS.hotelHalf.includes(h.id) ? Math.round(h.price / 2) : h.price);
// Swimming: lessons (+2 each) and swims (+1 every 2) raise your skill; after 3 lessons you swim in the deep end.
export const SWIM_DEEP_LESSONS = 3;
export const swimSkill = (lessons: number, swims: number) => Math.min(10, lessons * 2 + Math.floor(swims / 2));
// The VIP bar: who's in changes every 4 game hours, two at a time from the richest residents on the Billionaires List (real players later).
export const VIP_EVERY_HOURS = 4;
export function vipsAt(now = Date.now()): { in: string[]; next: string | null; nextAt: number } {
  const top = RESIDENTS.filter((r) => r.netWorth && r.id !== "cynthia").sort((a, b) => (b.netWorth ?? 0) - (a.netWorth ?? 0)).slice(0, 4).map((r) => r.id);
  if (!top.length) return { in: [], next: null, nextAt: now };
  const span = VIP_EVERY_HOURS * GAME_HOUR_MS, slot = Math.floor((now - WORLD_EPOCH) / span);
  const at = (k: number) => top[((k % top.length) + top.length) % top.length];
  // Cynthia Okeh (Digital Witch, #1) is at the VIP bar every evening (cynthiaAt); the rest of the top of the list takes turns beside her.
  if (cynthiaAt(now) === "hotel") return { in: ["cynthia", at(slot)], next: at(slot + 1), nextAt: WORLD_EPOCH + (slot + 1) * span };
  return { in: Array.from(new Set([at(slot), at(slot + 1)])), next: at(slot + 2), nextAt: WORLD_EPOCH + (slot + 1) * span };
}
// ---- Digital Witch (partner, from 16 October 2026): an EdTech platform for on-demand tech skills, founded by Ekwutosi Cynthia Okeh.
// Its training hub is the ground floor of the Skyscraper Plaza in the Central Business District. Courses are paid in Notesville Naira;
// passing every class gives a Digital Witch certificate, which tech jobs need. Cynthia is at the hub by day and the Candellux VIP bar
// in the evening, and on Saturday nights she gives some of her graduates who are doing well N$ 500,000 or N$ 1,000,000. ----
export const DIGITAL_WITCH = { name: "Digital Witch", site: "https://digitalwitchng.com", whatsapp: "2347011944457", whatsappLabel: "+234 701 194 4457", learners: "150,000+", place: "Skyscraper Plaza, Central Business District" };
export type Course = { id: string; name: string; icon: string; price: number; classes: number; job: string };
export const DW_COURSES: Course[] = [
  { id: "va", name: "Virtual Assistant", icon: "🧑‍💻", price: 60_000, classes: 4, job: "dw_va" },
  { id: "cs", name: "Customer Support", icon: "🎧", price: 60_000, classes: 4, job: "dw_cs" },
  { id: "smm", name: "Social Media Management", icon: "📱", price: 80_000, classes: 5, job: "dw_smm" },
  { id: "pm", name: "Project Management", icon: "🗂", price: 100_000, classes: 5, job: "dw_pm" },
  { id: "data", name: "Data Analysis", icon: "📊", price: 120_000, classes: 6, job: "dw_data" },
  { id: "ux", name: "UI/UX Design", icon: "🎨", price: 120_000, classes: 6, job: "dw_ux" },
];
export const DW_COURSE = (id: string) => DW_COURSES.find((c) => c.id === id);
export const DW_CLASS_HOURS = 2;
export const DW_CLASS_MS = DW_CLASS_HOURS * GAME_HOUR_MS; // 4 real minutes
export const DW_CLASS_EFFECT: Partial<Record<Need, number>> = { energy: -10, fun: 5 };
export const DW_HOURS = { from: 9, to: 18 }; // classes run 9 AM to 6 PM
export const dwOpen = (now = Date.now()) => { const h = worldTime(now).hour; return h >= DW_HOURS.from && h < DW_HOURS.to; };
// Where Cynthia is: the hub 9 AM to 5 PM, the Candellux VIP bar 7 PM to 11 PM, home otherwise.
export function cynthiaAt(now = Date.now()): "dw" | "hotel" | null {
  const h = worldTime(now).hour;
  return h >= 9 && h < 17 ? "dw" : h >= 19 && h < 23 ? "hotel" : null;
}
// Game days and weeks, counted from midnight (a game day's clock starts at 6 AM, see worldTime). Day 0 was a Monday.
export const worldDay = (now = Date.now()) => Math.floor((now - WORLD_EPOCH + GAME_DAY_MS / 4) / GAME_DAY_MS);
export const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
export const weekdayOf = (now = Date.now()) => ((worldDay(now) % 7) + 7) % 7;
// The graduate giveaway: Saturday 7 PM to 11 PM at the VIP bar, once a game week per player, for certified players with 10 tech shifts.
export const GIVEAWAY = { weekday: 5, from: 19, to: 23, needTechShifts: 10, big: 1_000_000, small: 500_000, pBig: 0.05, pSmall: 0.1 };
export const giveawayOn = (now = Date.now()) => { const h = worldTime(now).hour; return weekdayOf(now) === GIVEAWAY.weekday && h >= GIVEAWAY.from && h < GIVEAWAY.to; };
export const giveawayWeek = (now = Date.now()) => Math.floor(worldDay(now) / 7);
export const giveawayEligible = (certs: string[], techShifts: number) => certs.length > 0 && techShifts >= GIVEAWAY.needTechShifts;
export const giveawayPrize = (r: number) => (r < GIVEAWAY.pBig ? GIVEAWAY.big : r < GIVEAWAY.pBig + GIVEAWAY.pSmall ? GIVEAWAY.small : 0);
export const CANDELLUX = { name: "Candellux Imperial Hotel & Suites", tagline: "…We Strive for the Best", address: "Area 1, No. 5 Sir Anebo Okekenta Street, Garki, Abuja", whatsapp: "2349160049435", whatsappLabel: "+234 916 004 9435", site: "https://candelluximperialhotel.com/" };

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

// ---- Inviting friends: both of you get Bonus Credits (NotesApp wallet) once your friend finishes their first shift ----
export const REFERRAL_BONUS_KOBO = 25_000; // ₦250 of Bonus Credits each, for the inviter and the friend who joins
export const REFERRAL_MAX_PER_MONTH = 20; // rewarded invites per inviter per calendar month
// The game never hands out more than this in Bonus Credits in a calendar month (all players together); override with LIFE_BONUS_MONTHLY_CAP_NAIRA.
export const BONUS_MONTHLY_CAP_KOBO = Math.max(0, Number(setting("LIFE_BONUS_MONTHLY_CAP_NAIRA") || 500_000)) * 100;
export const PLAY_URL = LIFE_URL;
export const inviteLink = (username: string) => `${PLAY_URL}/?ref=${encodeURIComponent(username)}`;

// ---- Net worth and the Billionaires List ----
export function netWorth(naira: number, owned: string[], outlets: Outlet[] = []): number {
  return naira + owned.reduce((n, id) => n + (ITEM(id)?.price ?? 0), 0) + outlets.reduce((n, o) => n + outletValue(o), 0);
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

// ---- itel Energy (partner, through @clickam, the itel distributor on NotesApp) ----
export const ITEL = { name: "itel Energy", seller: "clickam", sellerUrl: "/u/clickam", note: "Solar shop, Wuse market road · products from @clickam on NotesApp" };
export const POWER_GO = { wh: 320, maxW: 200, chargeW: 100, solarW: 55 }; // battery size, mains charging, the 100W panel's average by day
export const POWER_TANK = { wh: 1000, chargeW: 250, fridgeW: 200, panelW: 300 }; // 1000Wh: the fridge alone for 5 game hours; each 650W panel averages ~300W by day
export const FOOD_SPOIL_HOURS = 8; // stored food without a cold fridge spoils after this many game hours
// What runs on backup power, in watts: the lamp and fan always, the laptop while you work at the desk, the AC only on the big generator.
export const LOADS = { lamp: 10, fan: 16, laptop: 65, ac: 900 };
export const FUEL_NAIRA = 1_100; // a litre of petrol
export const RUNTIMES = [["💻", "6.8 h", "laptop"], ["🌀", "20 h", "DC fan"], ["💡", "32 h", "bulb"], ["🔊", "53 h", "speaker"], ["📺", "21 h", "LED TV"], ["📱", "14", "phone charges"]] as const;

// ---- NEPA: power cuts at the same moment for every player, 2 or 3 a game day, 2 to 6 game hours each ----
function seeded(n: number) { let t = (n * 2654435761) >>> 0; return () => { t = (t + 0x6d2b79f5) >>> 0; let r = Math.imul(t ^ (t >>> 15), 1 | t); r ^= r + Math.imul(r ^ (r >>> 7), 61 | r); return ((r ^ (r >>> 14)) >>> 0) / 4294967296; }; }
export function outagesOfDay(day: number): { id: string; from: number; to: number }[] {
  const rnd = seeded(day + 77), start = WORLD_EPOCH + day * GAME_DAY_MS, n = 2 + (rnd() < 0.5 ? 1 : 0), out: { id: string; from: number; to: number }[] = [];
  let at = start + rnd() * 3 * GAME_HOUR_MS;
  for (let i = 0; i < n; i++) {
    const len = (2 + rnd() * 4) * GAME_HOUR_MS;
    out.push({ id: `${day}-${i}`, from: at, to: at + len });
    at += len + (2 + rnd() * 5) * GAME_HOUR_MS;
  }
  return out;
}
export function nepaAt(now = Date.now()): { out: boolean; id: string | null; until: number; next: number } {
  const day = Math.floor((now - WORLD_EPOCH) / GAME_DAY_MS);
  const all = [...outagesOfDay(day - 1), ...outagesOfDay(day), ...outagesOfDay(day + 1)];
  const cur = all.find((o) => now >= o.from && now < o.to);
  const next = all.find((o) => o.from > now)?.from ?? now + GAME_DAY_MS;
  return { out: !!cur, id: cur?.id ?? null, until: cur?.to ?? 0, next };
}

// ---- Residents: computer players of Notesville, always marked 🤖. They live in the scenes, chat (kept on your device only), and a few
// sit on the Billionaires List so new players have someone to chase. ----
export type Resident = { id: string; name: string; role: string; area: string; look: [string, string, string, boolean]; netWorth?: number; owned?: string; photo?: string; partner?: string; story?: string; lines: Record<"greet" | "food" | "work" | "nepa" | "money", string[]> };
const L = (greet: string[], food: string[], work: string[], nepa: string[], money: string[]) => ({ greet, food, work, nepa, money });
export const RESIDENTS: Resident[] = [
  { id: "nkechi", name: "Mama Nkechi", role: "Your neighbour · pepper soup seller", area: "Wuse", look: ["#7c3aed", "#5b3520", "#1f2937", true], netWorth: 230_000,
    lines: L(["My pikin! How body? You don chop today?", "Good morning o! This Abuja sun no be here."], ["Chef Adams native rice sweet die. Go before rush hour.", "Cook for house, e cheaper. Buy that small cooker."], ["Delivery riders dey make money for Wuse. Get bicycle first.", "Chef Adams dey find people for kiosk. Bathe well before you go!"], ["NEPA don take light again o! My son buy Power GO from itel shop, NEPA no fit embarrass am again.", "If you get generator, fuel am before night."], ["Small small, you go reach. Rent first, enjoyment later.", "Save am for bank, no spend am anyhow."]) },
  { id: "chinedu", name: "Chinedu Eze", role: "Phone shop owner, Jabi", area: "Jabi", look: ["#0ea5e9", "#6b3f22", "#334155", false], netWorth: 640_000, owned: "📱 🛵",
    lines: L(["Bros! Wetin dey happen?", "My guy, you look sharp today."], ["I dey chop for Chef Adams every Friday. Their combo na correct."], ["Answer your deal phone. Deals na where money dey.", "Get laptop. Tech freelance pay pass desktop work."], ["I get Power GO for shop. Customers dey charge phone, I dey collect money.", "Solar panel + Power GO = no more NEPA wahala."], ["Buy low, sell high. That's the whole business."]) },
  { id: "halima", name: "Halima Sule", role: "Tailor, Wuse market", area: "Wuse", look: ["#db2777", "#7a4a2c", "#1f2937", true], netWorth: 410_000,
    lines: L(["Sannu! How family?", "You need new outfit? Check your wardrobe."], ["I like their fried rice. Small plantain on top."], ["If you get hand work, people go pay. Reputation matters."], ["When NEPA take light, my machine stop. I dey save for solar kit."], ["My shop pay me better than any office."]) },
  { id: "tunde", name: "Tunde", role: "Keke rider", area: "Wuse", look: ["#f97316", "#4e2c17", "#1e3a8a", false], netWorth: 95_000,
    lines: L(["Oga! Where you dey go? I fit carry you.", "Wuse to Garki, N$ 400, I go reach am fast."], ["Takeaway from the Chef Adams kiosk na the fastest."], ["Rider work no easy but money dey."], ["Traffic light no dey work when NEPA take light. Wahala!"], ["Keke na my bank. Every trip na deposit."]) },
  { id: "emeka", name: "Emeka", role: "Chef Adams delivery rider", area: "Wuse", look: ["#e53935", "#5b3520", "#111827", false], netWorth: 120_000,
    lines: L(["How far! I dey rush delivery o."], ["Order delivery, I go bring am hot hot."], ["E-bike double my deliveries. Green Wheels get am."], ["At night when NEPA take light, every house dey order food."], ["Tips na my best friend."]) },
  { id: "dauda", name: "Mr Dauda", role: "itel Energy staff", area: "Wuse", look: ["#e8173f", "#6b3f22", "#111827", false],
    lines: L(["Welcome to itel Energy! How can I help you?"], ["Our Power GO can even run a small blender for a while."], ["We're always looking for solar installers."], ["Power GO Pro: 320Wh, silent, no fuel. Your lamp, fan and laptop stay on. Add the solar panel and charge it by day.", "Generators are loud and need petrol. Solar is quiet and free after you buy."], ["Pay once, enjoy light every night."]) },
  { id: "musa", name: "Alhaji Musa Bello", role: "Real estate, Maitama", area: "Maitama", look: ["#f5f5f4", "#6b3f22", "#f5f5f4", false], netWorth: 4_800_000_000, owned: "🏢 🚙 ✈️",
    lines: L(["Young man, young woman. Hard work pays.", "Assalamu alaikum."], ["Candellux restaurant is where I hold my meetings."], ["Start small. My first business was one shop in Wuse."], ["All my buildings run on solar. NEPA is not my business."], ["Property. Always property."]) },
  { id: "ifeoma", name: "Dr Ifeoma Obi", role: "Clinics, Asokoro", area: "Asokoro", look: ["#0f766e", "#7a4a2c", "#1f2937", true], netWorth: 2_100_000_000, owned: "🏥 🚙",
    lines: L(["Good day. Are you keeping well?", "Remember to sleep. Energy matters."], ["Eat well. Hunger lowers your pay, you know."], ["Skills first. Then money follows."], ["My clinics can't stop for NEPA. Inverters and batteries everywhere."], ["Invest in what you know."]) },
  // A real partner: Ekwutosi Cynthia Okeh, founder of Digital Witch (her photo, with her permission through the partnership).
  { id: "cynthia", name: "Ekwutosi Cynthia Okeh", role: "Founder, Digital Witch · on-demand skills coach", area: "Central Business District", look: ["#111827", "#6b3f22", "#111827", false], netWorth: 7_500_000_000, owned: "🎓 🏙 🚙", photo: "/images/life/partners/cynthia-okeh.webp", partner: "digital_witch",
    lines: L(["Welcome! Are you ready to learn a skill that pays in dollars?", "Hello, my dear! Remember: your background doesn't decide your future."], ["Feed your body, then feed your brain. Class starts at 9!"], ["Get certified, then get hired. Remote work doesn't care where you live.", "Pick one skill, master it, and the world becomes your office."], ["NEPA can take light, but nobody can take your skill. Charge your laptop and keep learning."], ["Learn, earn, repeat. My graduates who do well get a giveaway from me now and then.", "Skills first. The money will follow."]) },
  // Emerald Ezurukam dreamed up Notesville and its rules as a teenager; Notes Life brings his game to life (the owner, 27 October 2026).
  // He's #1 on the Billionaires List and works from Emerald Towers on Wuse Market Street. His real photo comes later (`photo`).
  { id: "emerald", name: "Emerald Ezurukam", role: "The mind behind Notes Life · Emerald Towers, Wuse II", area: "Wuse II", look: ["#047857", "#5b3520", "#111827", false], netWorth: 12_000_000_000, owned: "💎 🏙 ✈️ 🚙",
    story: "Emerald dreamed up Notesville, its streets and its rules when we were kids. Notes Life is his teenage game, brought to life.",
    lines: L(["Welcome to Notesville! I dreamed this city up when I was a kid. Now you live in it.", "Every rule in this town started as a game I played in my head. Enjoy it!"], ["Eat first, plan second. Nobody builds anything hungry.", "Mama Nkechi's pepper soup is the best on this street. I've been eating it since I was small."], ["Start with one errand, then one shift, then one shop. That's how every fortune here started.", "Reputation is the real money in Notesville. Keep your word and the deals come."], ["NEPA taught me to always have a plan B. Solar is mine.", "When the light goes, the hustlers keep moving."], ["Don't chase the list. Build something, and the list will find you.", "Save some, spend some, invest the rest. I made that rule up as a teenager and I still keep it."]) },
  // A real partner: Chinasa Odina, CEO of LUXNAS (@luxnas, @chinasa on NotesApp). Her photo comes later.
  { id: "chinasa", name: "Chinasa Odina", role: "CEO, LUXNAS · custom tailoring and bespoke African fashion", area: "Wuse", look: ["#0a0a0a", "#7a4a2c", "#0a0a0a", true], partner: "luxnas",
    lines: L(["Welcome to LUXNAS! Senator, Agbada, Kaftan or something for the ladies?", "Hello! Every piece here is tailored to you, not off a rack."], ["Eat well before a fitting. We take your measurements properly!"], ["Learn at LUXNAS Academy: tailoring, embroidery, then design. Then work with us, or open your own studio.", "Deliveries first, then the tape measure. That's how my best tailors started."], ["NEPA or no NEPA, our machines keep running. Customers don't wait for light."], ["From Nnewi to the world: we ship worldwide. Quality travels.", "Bespoke pays. One good Asoebi order can pay your rent."]) },
  { id: "sani", name: "Mallam Sani", role: "Suya man, Wuse Market (Zone 4)", area: "Wuse", look: ["#f8fafc", "#4e2c17", "#f8fafc", false], netWorth: 310_000,
    lines: L(["Sannu! Suya dey ready from evening.", "My friend, you don chop suya today?"], ["Beef suya with onion and yaji. Na medicine for hunger!"], ["Come help me for the grill at night. I go pay you and give you suya."], ["NEPA no fit stop suya. Na charcoal we dey use!"], ["Small small, the grill don build my house for village."]) },
  { id: "bose", name: "Iya Bose", role: "POS agent, Wuse Market (Zone 4)", area: "Wuse", look: ["#ea580c", "#6b3f22", "#1f2937", true], netWorth: 520_000,
    lines: L(["Cash out, transfer, airtime! How I fit help you?", "My customer! Welcome."], ["I dey chop puff-puff for that stall every morning."], ["Lunch time na rush hour for POS. Come help me make I share you money."], ["When NEPA take light, network dey misbehave. Customers dey vex!"], ["Every transfer get small charge. Na so the money dey gather."]) },
  { id: "aisha", name: "Aisha", role: "Student", area: "Wuse", look: ["#16a34a", "#8a5a3b", "#1f2937", true],
    lines: L(["Hi! Exams soon, I'm reading every night."], ["Noodles and egg is my survival meal."], ["Tutoring pays well if your needs are green."], ["I bought Power GO to read at night. Best decision."], ["I'm saving for a laptop."]) },
];
export const RESIDENT = (id: string) => RESIDENTS.find((r) => r.id === id);
// Where a resident stands on the Billionaires List among the residents (1 = the richest), or null without a fortune.
export const residentRank = (id: string) => { const r = RESIDENT(id); return r?.netWorth ? RESIDENTS.filter((x) => (x.netWorth ?? 0) > r.netWorth!).length + 1 : null; };
// Which residents you meet where.
export const RESIDENTS_AT: Partial<Record<PlaceId | "street", string[]>> = { street: ["nkechi", "tunde", "halima", "emeka"], chef: ["halima", "emeka"], itel: ["dauda", "aisha", "chinedu"], hotel: ["musa", "ifeoma"], home: ["nkechi"], dw: ["aisha"], market: ["chinasa", "nkechi", "halima", "chinedu", "bose", "sani", "aisha"], wuse2: ["emerald", "musa", "ifeoma"] };

// ---- The Wuse streets (from 27 October 2026), beside the first street: Wuse Market in Zone 4 (Abuja's biggest open market, the Bureau De
// Change operators, stalls and errands) and Aminu Kano Crescent in Wuse II (the premium strip: office plazas, a bank, restaurants and
// nightlife). You walk from shop to shop; residents give errands (short paid tasks, each once a game day); the shops sell food, a
// haircut, data and a night out. ----
export type StreetPlace = "market" | "wuse2";
export type MarketSpot = "keke" | "pharmacy" | "tailor" | "phones" | "soup" | "barber" | "data" | "pos" | "bdc" | "lesson" | "puff" | "suya" | "water"
  | "park" | "plaza" | "bank" | "emerald" | "cafe" | "grill" | "lounge";
export const MARKET_SHOPS: Record<MarketSpot, { place: StreetPlace; name: string; icon: string; who?: string }> = {
  keke: { place: "market", name: "Keke park and market stalls", icon: "🛺" },
  pharmacy: { place: "market", name: "WuseCare Pharmacy", icon: "💊" },
  tailor: { place: "market", name: "LUXNAS", icon: "🧵", who: "chinasa" },
  phones: { place: "market", name: "Chinedu Phones & Accessories", icon: "📱", who: "chinedu" },
  soup: { place: "market", name: "Mama Nkechi's Pepper Soup", icon: "🍲", who: "nkechi" },
  barber: { place: "market", name: "Fresh Cut Barbers", icon: "💈" },
  data: { place: "market", name: "Recharge & Data", icon: "📶" },
  pos: { place: "market", name: "Iya Bose POS", icon: "💳", who: "bose" },
  bdc: { place: "market", name: "Bureau De Change", icon: "💱" },
  lesson: { place: "market", name: "Bright Minds Lesson Centre", icon: "📚", who: "aisha" },
  puff: { place: "market", name: "Puff-puff & Zobo", icon: "🥤" },
  suya: { place: "market", name: "Mallam Sani Suya", icon: "🍢", who: "sani" },
  water: { place: "market", name: "Borehole tap", icon: "🪣" },
  park: { place: "wuse2", name: "Crescent car park", icon: "🚕" },
  plaza: { place: "wuse2", name: "Crescent Plaza (offices)", icon: "🏢", who: "ifeoma" },
  bank: { place: "wuse2", name: "Notesville Trust Bank", icon: "🏦", who: "musa" },
  emerald: { place: "wuse2", name: "Emerald Towers", icon: "💎", who: "emerald" },
  cafe: { place: "wuse2", name: "Crescent Café", icon: "☕" },
  grill: { place: "wuse2", name: "The Crescent Grill", icon: "🥩" },
  lounge: { place: "wuse2", name: "Skyline Lounge", icon: "🍸" },
};
export const MARKET_SPOTS = Object.keys(MARKET_SHOPS) as MarketSpot[];
export const spotsOf = (place: StreetPlace) => MARKET_SPOTS.filter((k) => MARKET_SHOPS[k].place === place);
export const STREET_ENTRY: Record<StreetPlace, MarketSpot> = { market: "keke", wuse2: "park" };
export const isStreetPlace = (p: string): p is StreetPlace => p === "market" || p === "wuse2";
// Open from `from` to `to` o'clock, game time (to may be 24).
export type Hours = [number, number];
export const openAt = (h: Hours | undefined, now = Date.now()) => { if (!h) return true; const x = worldTime(now).hour; return x >= h[0] && x < h[1]; };
export const hoursLabel = (h: Hours) => { const f = (n: number) => (n % 24 === 0 ? "midnight" : n === 12 ? "noon" : n < 12 ? `${n} AM` : `${n - 12} PM`); return `${f(h[0])} to ${f(h[1])}`; };

export type StreetService = { id: string; spot: MarketSpot; name: string; icon: string; price: number; minutes: number; effect: Partial<Record<Need, number>>; hours?: Hours; note: string; barber?: boolean };
export const STREET: StreetService[] = [
  { id: "pepper_soup", spot: "soup", name: "Goat meat pepper soup", icon: "🍲", price: 1_800, minutes: 25, effect: { hunger: 35, social: 5 }, hours: [10, 23], note: "Hunger +35 · Social +5 · hot, with plenty of utazi" },
  { id: "suya", spot: "suya", name: "Beef suya with onions and yaji", icon: "🍢", price: 1_500, minutes: 10, effect: { hunger: 25, fun: 5 }, hours: [18, 24], note: "Hunger +25 · Fun +5 · from 6 PM" },
  { id: "puff", spot: "puff", name: "Puff-puff and chilled zobo", icon: "🥤", price: 600, minutes: 5, effect: { hunger: 12, fun: 3 }, hours: [7, 20], note: "Hunger +12 · Fun +3" },
  { id: "haircut", spot: "barber", name: "A clean low cut", icon: "💈", price: 2_000, minutes: 30, effect: { hygiene: 15, fun: 5 }, hours: [8, 21], barber: true, note: "Hygiene +15 · Fun +5 · looking sharp for 12 game hours: deals say yes more often" },
  { id: "vitamins", spot: "pharmacy", name: "Multivitamins and ORS", icon: "💊", price: 2_500, minutes: 5, effect: { energy: 15 }, hours: [8, 22], note: "Energy +15" },
  { id: "data", spot: "data", name: "2 GB data bundle", icon: "📶", price: 1_000, minutes: 2, effect: { social: 15 }, note: "Social +15 · call and chat with family" },
  { id: "coffee", spot: "cafe", name: "Cappuccino and a croissant", icon: "☕", price: 2_800, minutes: 20, effect: { hunger: 15, fun: 8, energy: 5 }, hours: [7, 21], note: "Hunger +15 · Fun +8 · Energy +5" },
  { id: "grill_lunch", spot: "grill", name: "Peppered steak, chips and salad", icon: "🥩", price: 6_500, minutes: 45, effect: { hunger: 60, fun: 10, social: 5 }, hours: [11, 23], note: "Hunger +60 · Fun +10 · Social +5" },
  { id: "night_out", spot: "lounge", name: "A night out at Skyline Lounge", icon: "🍸", price: 8_000, minutes: 90, effect: { fun: 35, social: 30, energy: -10 }, hours: [20, 24], note: "8 PM to midnight · Fun +35 · Social +30 · Energy −10" },
];
export const STREET_OF = (id: string) => STREET.find((x) => x.id === id);
export const BARBER_STREET_MS = GAME_DAY_MS / 2;

// Errands: once a game day each, paid when done (the server checks the hours and the day). Sanitation pays in reputation, not naira.
export type Errand = { id: string; spot: MarketSpot; who?: string; title: string; icon: string; minutes: number; pay: number; effect: Partial<Record<Need, number>>; hours?: Hours; weekday?: number; reputation?: number; needReputation?: number; needHygiene?: number; note: string };
export const ERRANDS: Errand[] = [
  { id: "luxnas", spot: "tailor", who: "chinasa", title: "Deliver LUXNAS orders", icon: "🛍", minutes: 45, pay: 2_500, effect: { energy: -8, social: 8 }, hours: [8, 18], note: "Senator suits, Ankara sets and an Asoebi order, wrapped, to customers around Wuse" },
  { id: "stall", spot: "phones", who: "chinedu", title: "Mind Chinedu's phone stall", icon: "📱", minutes: 60, pay: 2_200, effect: { fun: -4, social: 6 }, hours: [9, 19], note: "Sell screen guards and chargers while he restocks in Jabi" },
  { id: "pos", spot: "pos", who: "bose", title: "Run Iya Bose's POS stand for the lunch rush", icon: "💳", minutes: 60, pay: 2_400, effect: { energy: -6, social: 5 }, hours: [11, 15], note: "Cash-outs and transfers, 11 AM to 3 PM" },
  { id: "porter", spot: "keke", title: "Carry loads for market women", icon: "🧺", minutes: 30, pay: 1_200, effect: { energy: -12, hygiene: -10 }, hours: [7, 18], note: "Baskets of tomatoes and yams from the kekes to the stalls" },
  { id: "water", spot: "water", who: "nkechi", title: "Fetch water for Mama Nkechi", icon: "🪣", minutes: 20, pay: 600, effect: { energy: -8, social: 10 }, hours: [6, 19], note: "Four jerrycans from the borehole to her kitchen" },
  { id: "grill", spot: "suya", who: "sani", title: "Help Mallam Sani at the suya grill", icon: "🔥", minutes: 90, pay: 3_000, effect: { energy: -10, hygiene: -10, hunger: 20 }, hours: [18, 23], needHygiene: 50, note: "Slice, spice and wrap, 6 PM to 11 PM · a free stick of suya at the end" },
  { id: "lesson", spot: "lesson", who: "aisha", title: "Teach the compound kids with Aisha", icon: "📚", minutes: 60, pay: 3_000, effect: { energy: -6, fun: 8 }, hours: [16, 19], note: "Evening lesson, 4 PM to 7 PM: reading and times tables" },
  { id: "bdc", spot: "bdc", title: "Count and bundle notes at the Bureau De Change", icon: "💱", minutes: 45, pay: 2_000, effect: { fun: -6 }, hours: [9, 17], needReputation: 1, note: "Dollars, pounds and naira, all counted twice · needs reputation 1★" },
  { id: "courier", spot: "plaza", who: "ifeoma", title: "Courier documents between Crescent offices", icon: "📨", minutes: 45, pay: 2_800, effect: { energy: -8 }, hours: [9, 17], note: "Envelopes to the plazas along Aminu Kano Crescent" },
  { id: "queue", spot: "bank", who: "musa", title: "Hold Alhaji Musa's place in the bank queue", icon: "🏦", minutes: 40, pay: 1_800, effect: { fun: -8 }, hours: [9, 16], note: "He's in a meeting; you keep his place till the teller calls" },
  { id: "flyers", spot: "grill", title: "Hand out lunch-special flyers for The Crescent Grill", icon: "📄", minutes: 30, pay: 1_500, effect: { energy: -5, social: 6 }, hours: [11, 15], note: "11 AM to 3 PM, to the office crowd" },
  { id: "valet", spot: "lounge", title: "Park cars at Skyline Lounge", icon: "🔑", minutes: 90, pay: 4_000, effect: { energy: -10 }, hours: [20, 24], needHygiene: 60, needReputation: 1, note: "8 PM to midnight · needs reputation 1★ and a clean look (Hygiene 60+)" },
  { id: "proposal", spot: "emerald", who: "emerald", title: "Deliver a proposal for Emerald Ezurukam", icon: "📜", minutes: 60, pay: 6_000, effect: { energy: -8, social: 10 }, hours: [10, 16], needReputation: 2, note: "To a partner across Wuse II, 10 AM to 4 PM · needs reputation 2★: he only trusts people who keep their word" },
  { id: "sanitation", spot: "keke", title: "Saturday sanitation: clear the gutters", icon: "🧹", minutes: 60, pay: 0, effect: { energy: -10, hygiene: -15, social: 15 }, hours: [7, 10], weekday: 5, reputation: 0.3, note: "Saturdays 7 AM to 10 AM, with the whole street · no pay, Reputation +0.3" },
];
export const ERRAND = (id: string) => ERRANDS.find((e) => e.id === id);
// Why an errand can't start now (null when it can): today's done list, the hours, the weekday, reputation and hygiene.
export function errandBlocker(e: Errand, p: { done: string[]; reputation: number; hygiene?: number }, now = Date.now()): string | null {
  if (p.done.includes(e.id)) return "Done today · back tomorrow";
  if (e.weekday !== undefined && weekdayOf(now) !== e.weekday) return `${WEEKDAYS[e.weekday]}s only`;
  if (!openAt(e.hours, now)) return `${hoursLabel(e.hours!)}`;
  if (e.needReputation && p.reputation < e.needReputation) return `Needs reputation ${e.needReputation}★`;
  if (e.needHygiene && p.hygiene !== undefined && p.hygiene < e.needHygiene) return `Freshen up first (Hygiene ${e.needHygiene}+)`;
  return null;
}

// ---- Emerald's convoy (the owner, 27 October 2026): three times a game day Emerald Ezurukam's convoy passes the Wuse bus stand on the
// first street. It stops for half a game hour, and he gives N$ 100,000 to each stranger waiting there, but never to the same person
// again within 30 game days. ----
export const CONVOY = { gift: 100_000, everyDays: 30, hours: [8, 13, 18], minutes: 30 } as const;
const clockMinute = (now: number) => Math.floor(((((now - WORLD_EPOCH) % GAME_DAY_MS) + GAME_DAY_MS) % GAME_DAY_MS) / GAME_MIN_MS + 6 * 60) % (24 * 60);
// Whether the convoy is at the bus stand now, until when, and when it next arrives.
export function convoyAt(now = Date.now()): { on: boolean; until: number; next: number } {
  const m = clockMinute(now), base = now - (((now - WORLD_EPOCH) % GAME_MIN_MS) + GAME_MIN_MS) % GAME_MIN_MS;
  let on = false, until = 0, next = Infinity;
  for (const h of CONVOY.hours) {
    const since = (m - h * 60 + 1440) % 1440;
    if (since < CONVOY.minutes) { on = true; until = base + (CONVOY.minutes - since) * GAME_MIN_MS; }
    const to = (h * 60 - m + 1440) % 1440 || 1440;
    next = Math.min(next, base + to * GAME_MIN_MS);
  }
  return { on, until, next };
}
// When this player can next be given a gift (0: now).
export const convoyNextFor = (lastAt: number) => (lastAt ? lastAt + CONVOY.everyDays * GAME_DAY_MS : 0);
export const BUS_STAND_WAIT_MINUTES = 45;

// ---- Hygiene and Bladder away from home (the owner, 27 October 2026). A boost of 100 fills the need; 50 adds 50 points. ----
// Candellux: a lodged guest's suite WC and bathroom fill both. The outdoor shower by the pool fills Hygiene for anyone who swam in
// the last 24 game hours, otherwise +50. The VIP bar's restroom fills Bladder for anyone who used the VIP bar in the last 24 game hours,
// otherwise +50. The regular hotel bar, itel Energy, Chef Adams, Emerald Towers and Digital Witch: Bladder +50. Wuse Market: mobile
// WC and shower units, paid, that fill the need.
export type RestroomId = "suite_wc" | "suite_bath" | "pool_shower" | "vip_wc" | "hotel_wc" | "itel_wc" | "chef_wc" | "emerald_wc" | "dw_wc" | "market_wc" | "market_shower";
export type Restroom = { id: RestroomId; place: PlaceId; need: "bladder" | "hygiene"; name: string; icon: string; price: number; note: string };
export const RESTROOMS: Restroom[] = [
  { id: "suite_wc", place: "hotel", need: "bladder", name: "Your suite's WC", icon: "🚽", price: 0, note: "Guests only · Bladder to 100%" },
  { id: "suite_bath", place: "hotel", need: "hygiene", name: "Your suite's bathroom", icon: "🛁", price: 0, note: "Guests only · Hygiene to 100%" },
  { id: "pool_shower", place: "hotel", need: "hygiene", name: "Outdoor shower by the pool", icon: "🚿", price: 0, note: "Hygiene to 100% if you swam in the last 24 game hours, otherwise +50" },
  { id: "vip_wc", place: "hotel", need: "bladder", name: "VIP bar restroom", icon: "👑", price: 0, note: "Bladder to 100% if you used the VIP bar in the last 24 game hours, otherwise +50" },
  { id: "hotel_wc", place: "hotel", need: "bladder", name: "Pool bar restroom", icon: "🚻", price: 0, note: "Bladder +50" },
  { id: "itel_wc", place: "itel", need: "bladder", name: "itel Energy staff restroom", icon: "🚻", price: 0, note: "Bladder +50" },
  { id: "chef_wc", place: "chef", need: "bladder", name: "Chef Adams restroom", icon: "🚻", price: 0, note: "Bladder +50" },
  { id: "emerald_wc", place: "wuse2", need: "bladder", name: "Emerald Towers lobby restroom", icon: "🚻", price: 0, note: "Bladder +50" },
  { id: "dw_wc", place: "dw", need: "bladder", name: "Digital Witch hub restroom", icon: "🚻", price: 0, note: "Bladder +50" },
  { id: "market_wc", place: "market", need: "bladder", name: "Mobile WC (emergency)", icon: "🚽", price: 500, note: "Bladder to 100%" },
  { id: "market_shower", place: "market", need: "hygiene", name: "Mobile shower (emergency)", icon: "🚿", price: 800, note: "Hygiene to 100%" },
];
export const RESTROOM = (id: string) => RESTROOMS.find((r) => r.id === id);
export const RESTROOM_RECENT_MS = 24 * GAME_HOUR_MS;
// What a restroom gives this player now: the need, 100 (fill it) or 50 (add 50), and the price; or why it isn't open to them.
export function restroomBoost(r: Restroom, p: { hotelUntil: number; lastSwimAt: number; lastVipAt: number }, now = Date.now()): { need: Restroom["need"]; pct: 100 | 50; price: number } | { blocked: string } {
  const recent = (t: number) => t > 0 && now - t < RESTROOM_RECENT_MS;
  if ((r.id === "suite_wc" || r.id === "suite_bath") && !lodged(p.hotelUntil, now)) return { blocked: "For guests staying in a suite" };
  const full = r.id === "suite_wc" || r.id === "suite_bath" || r.id === "market_wc" || r.id === "market_shower" || (r.id === "pool_shower" && recent(p.lastSwimAt)) || (r.id === "vip_wc" && recent(p.lastVipAt));
  return { need: r.need, pct: full ? 100 : 50, price: r.price };
}

// ---- LUXNAS (partner, from 27 October 2026): a boutique lifestyle, business and fashion brand from Nnewi, led by CEO Chinasa Odina.
// Custom tailoring, embroidery, ready-to-wear and bespoke African fashion; it ships worldwide. In Notesville its shop is on Wuse Market
// (Zone 4): deliver its orders, learn at LUXNAS Academy, then work there or open your own LUXNAS studio. ----
export const LUXNAS = { name: "LUXNAS", handle: "luxnas", shop: "https://www.notesapp.name.ng/s/luxnas", instagram: "https://www.instagram.com/fw_diamondstitches/", ceo: "Chinasa Odina", ceoHandle: "chinasa", origin: "Nnewi",
  offers: ["Senator suits, custom Agbadas and Kaftans for men", "Ankara two-piece sets, long dresses, office looks, Asoebi and bridal wear", "Custom denim, custom-fit jeans and chinos", "Worldwide orders with international shipping"] };
export type LuxCourse = { id: string; name: string; icon: string; price: number; classes: number; job: string };
export const LUX_COURSES: LuxCourse[] = [
  { id: "lux_tailoring", name: "Tailoring and custom fit", icon: "🧵", price: 50_000, classes: 4, job: "lux_tailor" },
  { id: "lux_embroidery", name: "Embroidery", icon: "🪡", price: 60_000, classes: 4, job: "lux_embroider" },
  { id: "lux_design", name: "Bespoke African fashion design", icon: "👗", price: 90_000, classes: 5, job: "lux_designer" },
];
export const LUX_COURSE = (id: string) => LUX_COURSES.find((c) => c.id === id);
export const LUX_CLASS_HOURS = 2;
export const LUX_CLASS_EFFECT: Partial<Record<Need, number>> = { energy: -10, fun: 5 };
