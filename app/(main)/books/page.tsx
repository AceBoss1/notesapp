import Link from "next/link";
import type { Metadata } from "next";
import Image from "next/image";
import PageHero from "@/components/PageHero";
import BooksWaitlistForm from "@/components/BooksWaitlistForm";
import { inventoryAddonPrice } from "@/lib/pricing";

export const metadata: Metadata = {
  title: "Business books: join the waitlist",
  description:
    "Business books on #NotesApp: walk-in sales with receipts, expenses, stock, money owed to you and profit, beside your online store. Not live yet: join the waitlist.",
};

// Business books isn't built yet (docs/BUSINESS-BOOKS.md, the plan). This page says what it will do, honestly and without a date, and
// takes waitlist sign-ups (components/BooksWaitlistForm.tsx → /api/books/waitlist → Admin → Leads → Business books waitlist).
const WILL = [
  { t: "Walk-in sales in a few taps", d: "Pick from your stock or type the item, then cash, transfer, POS or on credit. Online store orders come in by themselves." },
  { t: "Receipts", d: "A receipt link or PDF for every sale. Customers on #NotesApp get it by email and the bell; others by WhatsApp from your phone." },
  { t: "Expenses", d: "Rent, diesel, transport, staff pay and the rest, with a photo of the receipt." },
  { t: "Stock that keeps up", d: "A sale takes it off your inventory and a purchase adds it back, with a warning when something runs low." },
  { t: "Money owed to you, and what you owe", d: "Who owes you, since when and what's late, with reminders. Your suppliers and when you pay them." },
  { t: "Profit for a day, a week or a month", d: "Sales, the cost of what you sold, expenses and profit, cash in hand and your best sellers." },
  { t: "Tell Nana", d: "Type “Sold 3 bags of rice ₦45,000 to Mama Bisi on credit” and check the entry Nana makes before it's saved." },
  { t: "Bring your records", d: "Import a stock list or past sales from Excel or other tools. Nothing is saved until you've checked it." },
];

const SHOTS = [
  { src: "/images/books/books-record-sale.webp", w: 1440, h: 900, alt: "Design for recording a sale: rice and garri from inventory, paid partly in cash with the rest owed by Monday" },
  { src: "/images/books/books-profit-and-loss.webp", w: 1440, h: 900, alt: "Design for profit and loss for October: weekly sales, the statement, expenses by category and best sellers" },
];

export default function BooksPage() {
  return (
    <>
      <PageHero eyebrow="Business books · join the waitlist" title={<>Your shop&apos;s books, beside your online store</>}>
        <p>For market traders, shops, food sellers, salons and anyone who sells in person: record what you sell and spend, see who owes you, and know your profit.</p>
        <p className="small">Not live yet, and we&apos;re not promising a date. We&apos;re building it with the sellers on the waitlist.</p>
        <p><a href="#waitlist" className="mt-2 inline-flex rounded-full border border-paper/70 bg-paper/10 px-6 py-3 font-ui text-sm font-semibold !no-underline hover:bg-paper/20">Join the waitlist</a></p>
      </PageHero>

      <div className="mx-auto grid max-w-6xl gap-12 px-4 py-12 sm:px-6 lg:grid-cols-[1.1fr,0.9fr] lg:px-8">
        <div>
          <p className="eyebrow">What it will do</p>
          <ul className="mt-4 grid gap-4 sm:grid-cols-2">
            {WILL.map((w) => (
              <li key={w.t} className="card p-5">
                <p className="font-ui font-bold text-ink">{w.t}</p>
                <p className="mt-1 text-sm text-slate">{w.d}</p>
              </li>
            ))}
          </ul>
          <p className="mt-5 text-sm text-slate">
            Already selling online? Your <Link href="/store-selling" className="text-crimson underline">store</Link> and{" "}
            <Link href="/help/inventory" className="text-crimson underline">inventory</Link> are live today (inventory is included on Business, and{" "}
            {inventoryAddonPrice()} a month on Free Basic and Pro). Business books will build on them.
          </p>
        </div>
        <div className="scroll-mt-24 lg:sticky lg:top-24 lg:self-start" id="waitlist">
          <BooksWaitlistForm />
        </div>
      </div>

      <section className="border-t border-rule bg-field/40">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
          <p className="eyebrow">Early designs</p>
          <h2 className="mt-2 font-display text-3xl text-ink">How it could look</h2>
          <p className="mt-2 max-w-2xl text-sm text-slate">Designs, not the finished app: they may change before it opens. The shop and the numbers are made up.</p>
          <div className="mt-8 grid items-start gap-6 lg:grid-cols-[0.42fr,1fr]">
            <Image src="/images/books/books-home-phone.webp" width={780} height={1688} alt="Design for Books home on a phone: today's profit, sales, expenses, cash in hand, money owed and a Record a sale button" className="mx-auto w-full max-w-[300px] rounded-[2rem] border border-rule shadow-sm" />
            <div className="grid gap-6">
              {SHOTS.map((s) => (
                <Image key={s.src} src={s.src} width={s.w} height={s.h} alt={s.alt} className="w-full rounded-xl2 border border-rule shadow-sm" />
              ))}
            </div>
          </div>
          <p className="mt-8 text-sm text-slate">
            See everything else that&apos;s planned on the <Link href="/roadmap" className="text-crimson underline">roadmap</Link>.
          </p>
        </div>
      </section>
    </>
  );
}
