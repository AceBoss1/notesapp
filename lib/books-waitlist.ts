// The Business books waitlist (owner, 2 Nov 2026: "not coming soon anywhere: a waitlist"). Business books isn't built yet
// (docs/BUSINESS-BOOKS.md); /books says what it will do and takes sign-ups. Pure: shared by the form (components/BooksWaitlistForm.tsx)
// and the server (/api/books/waitlist, lib/leads-server.ts submitBooksWaitlist). A sign-up is saved as a lead of category
// "books-waitlist" (leads/{id}.booksWaitlist) and listed on Admin → Leads → Business books waitlist.

export const BOOKS_PATH = "/books";
// Sign-ups an hour, per address and per member (the route's rate limit).
export const WAITLIST_LIMIT = { max: 5, windowSec: 3600 } as const;

export const BUSINESS_TYPES = [
  { id: "market", label: "Market stall or trader" },
  { id: "shop", label: "Shop or supermarket" },
  { id: "food", label: "Food, drinks or catering" },
  { id: "salon", label: "Salon, barber or beauty" },
  { id: "fashion", label: "Fashion, tailoring or fabrics" },
  { id: "services", label: "Services (repairs, cleaning, other)" },
  { id: "online", label: "Mostly online seller" },
  { id: "ngo", label: "NGO, church or school that sells" },
  { id: "other", label: "Something else" },
] as const;
export type BusinessType = (typeof BUSINESS_TYPES)[number]["id"];

export const KEEPS_BOOKS = [
  { id: "exercise-book", label: "An exercise book or notebook" },
  { id: "excel", label: "Excel or Google Sheets" },
  { id: "tralo", label: "Tralo" },
  { id: "other-app", label: "Another app" },
  { id: "nothing", label: "Nothing yet" },
] as const;
export type KeepsBooks = (typeof KEEPS_BOOKS)[number]["id"];

export type WaitlistAnswers = {
  businessType: BusinessType;
  sells: string; // what they sell
  keepsBooks: KeepsBooks;
  otherApp: string; // which app, when "other-app"
  city: string;
  notify: boolean; // email me when it opens
};

const text = (v: unknown, max: number) => String(v ?? "").replace(/[\r\n\t]+/g, " ").replace(/\s{2,}/g, " ").trim().slice(0, max);
export type CheckedWaitlist = { ok: true; value: WaitlistAnswers & { name: string; email: string } } | { ok: false; error: string };

// What the server keeps from a sign-up, or why it can't.
export function checkWaitlist(raw: unknown): CheckedWaitlist {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const name = text(o.name, 100);
  const email = text(o.email, 200).toLowerCase();
  if (!name) return { ok: false, error: "Tell us your name." };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, error: "Enter your email address." };
  const businessType = BUSINESS_TYPES.find((b) => b.id === o.businessType)?.id;
  if (!businessType) return { ok: false, error: "Choose your kind of business." };
  const sells = text(o.sells, 300);
  if (!sells) return { ok: false, error: "Tell us what you sell." };
  const keepsBooks = KEEPS_BOOKS.find((k) => k.id === o.keepsBooks)?.id;
  if (!keepsBooks) return { ok: false, error: "Choose how you keep your books today." };
  const otherApp = keepsBooks === "other-app" ? text(o.otherApp, 80) : "";
  const city = text(o.city, 80);
  if (!city) return { ok: false, error: "Tell us your city or town." };
  return { ok: true, value: { name, email, businessType, sells, keepsBooks, otherApp, city, notify: o.notify !== false } };
}

export const businessTypeLabel = (id: string) => BUSINESS_TYPES.find((b) => b.id === id)?.label ?? id;
export const keepsBooksLabel = (id: string, otherApp = "") => (id === "other-app" && otherApp ? `Another app: ${otherApp}` : KEEPS_BOOKS.find((k) => k.id === id)?.label ?? id);

// The lead's message: the answers as plain words, so the sign-up reads well anywhere a lead is shown (and in a search).
export function waitlistMessage(a: WaitlistAnswers): string {
  return [
    `Business: ${businessTypeLabel(a.businessType)}`,
    `Sells: ${a.sells}`,
    `Keeps books today: ${keepsBooksLabel(a.keepsBooks, a.otherApp)}`,
    `City: ${a.city}`,
    `Notify when it opens: ${a.notify ? "yes" : "no"}`,
  ].join("\n");
}
