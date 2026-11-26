// The homepage's four doors, one landing page for four audiences (docs/GTM_DOORS_AND_TRIALS.md; owner approved 25 Nov 2026 after Victory
// Adugbo's review: "a door per audience", "proof, not claims"). Pure: the doors, the live figures under them, and the quotes.
//
// Rule: nothing made up. The dashboards behind each door are marked "Sample"; the figures are the platform's own (lib/traction.ts),
// rounded down and shown only above a floor; a quote is shown only once a real customer has given it, with permission.

export type DoorKey = "professionals" | "academics" | "sellers" | "organisations";
export type Door = {
  key: DoorKey; icon: string; title: string; who: string; blurb: string; headline: string;
  sample: { title: string; rows: [string, string][] }; // the dashboard they get once signed in, with sample figures
  cta: { label: string; href: string }; alt?: { label: string; href: string };
};

export const DOORS: Door[] = [
  {
    key: "professionals", icon: "💼", title: "Professionals", who: "Coaches · consultants · therapists · lawyers · trainers",
    blurb: "Sessions, group meetings, events, client journals and your own site.",
    headline: "Your clients find you, book you, pay you and come back. All in one place.",
    sample: { title: "Your dashboard", rows: [["📅 Today", "2 sessions · 10:00, 14:30"], ["💰 Earned this month", "₦96,000"], ["🔒 Waiting to be released", "₦24,000"], ["📝 Client journals", "3 notes to write up"], ["🌐 Your site", "/s/your-name"]] },
    cta: { label: "Start free", href: "/signup" }, alt: { label: "Try Pro free for 15 days", href: "/pricing#compare" },
  },
  {
    key: "academics", icon: "🎓", title: "Academics & students", who: "Lecturers · tutors · exam prep · students",
    blurb: "Free and paid courses, notes, live classes, paid meetings and certificates.",
    headline: "Teach once, and let your notes, classes and courses work for you.",
    sample: { title: "Your teaching", rows: [["📚 Courses", "3 · 214 students"], ["🔴 Live class", "Thursday, 4pm"], ["🏅 Certificates issued", "38"], ["💰 From courses this month", "₦61,500"], ["📝 Exam prep", "WAEC, NECO, JAMB"]] },
    cta: { label: "Start teaching free", href: "/signup" }, alt: { label: "See Notes Academy", href: "/academy" },
  },
  {
    key: "sellers", icon: "🛍️", title: "SMEs & sellers", who: "Shops · makers · hotels · logistics",
    blurb: "A store in Notes Market, business books, stock and delivery.",
    headline: "Sell online and in person, and see your whole business in one place.",
    sample: { title: "Your business", rows: [["📦 Orders today", "5 · 2 to send"], ["💰 Sales this week", "₦184,000"], ["⚠️ Running low", "3 items"], ["🧾 Owed to you", "₦42,000"], ["🚚 Parcels on the way", "4"]] },
    cta: { label: "Open your store free", href: "/signup" }, alt: { label: "How selling works", href: "/store-selling" },
  },
  {
    key: "organisations", icon: "🏛️", title: "Organisations", who: "Churches · NGOs · schools · clubs",
    blurb: "Members, events with tickets, lives, announcements and giving.",
    headline: "Your members, events, lives and giving, under your own name.",
    sample: { title: "Your organisation", rows: [["👥 Members", "214 · 9 waiting to join"], ["📣 Announcement", "Sunday service, 9am"], ["🔴 Live room", "Thursday prayer, 7pm"], ["🙏 Giving this month", "₦310,500"], ["🎟️ Next event", "Youth summit · 48 tickets"]] },
    cta: { label: "Set up your organisation", href: "/organisations" }, alt: { label: "Free 15-day Business trial", href: "/organisations" },
  },
];
export const DOOR_KEYS = DOORS.map((d) => d.key);
export const isDoor = (v: unknown): v is DoorKey => typeof v === "string" && (DOOR_KEYS as string[]).includes(v);
// A campaign link opens a door: /#for-professionals (or ?for=professionals, kept for links shared before the hash).
export const doorHash = (k: DoorKey) => `for-${k}`;
export function doorFrom(hash: string, search = ""): DoorKey | null {
  const h = hash.replace(/^#/, "").replace(/^for-/, "");
  if (isDoor(h)) return h;
  const q = new URLSearchParams(search).get("for");
  return isDoor(q) ? q : null;
}

// ── Real quotes ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// Add one only with the customer's written permission to use their words and name. A door without a quote shows none.
export type Quote = { door: DoorKey; text: string; name: string; role: string; href?: string; permission: string /* when and how given */ };
export const QUOTES: Quote[] = [];
export const quotesFor = (k: DoorKey, list: Quote[] = QUOTES) => list.filter((q) => q.door === k && q.text.trim() && q.name.trim() && q.permission.trim());

// ── The live figures under the doors ────────────────────────────────────────────────────────────────────────────────────────────
// Rounded down so the page never says more than we can show, and hidden below a floor so a small number is never the headline.
export const PROOF_FLOORS = { processedKobo: 100_000_000, paidOutKobo: 10_000_000, organisations: 3 };

export function roundDownNaira(kobo: number): string {
  const n = Math.floor(Math.max(0, kobo) / 100);
  if (n >= 1_000_000) return `₦${Math.floor(n / 1_000_000)}M+`;
  if (n >= 100_000) return `₦${Math.floor(n / 100_000) * 100}k+`; // ₦823,072 → ₦800k+
  if (n >= 1_000) return `₦${Math.floor(n / 1_000)}k+`;
  return `₦${n}`;
}

export type ProofIn = { processedKobo: number; paidOutKobo: number; organisations: number };
export function proofFigures(p: ProofIn): { value: string; label: string }[] {
  const out: { value: string; label: string }[] = [];
  if (p.processedKobo >= PROOF_FLOORS.processedKobo) out.push({ value: roundDownNaira(p.processedKobo), label: "processed through #NotesApp" });
  if (p.paidOutKobo >= PROOF_FLOORS.paidOutKobo) out.push({ value: roundDownNaira(p.paidOutKobo), label: "paid out to creators and sellers" });
  if (p.organisations >= PROOF_FLOORS.organisations) out.push({ value: String(p.organisations), label: "organisations run on #NotesApp" });
  out.push({ value: "Held until delivery", label: "buyers' money waits until they get what they paid for" });
  return out;
}
