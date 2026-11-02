import Link from "next/link";
import type { Metadata } from "next";
import Image from "next/image";
import PageHero from "@/components/PageHero";
import BooksCta from "@/components/books/BooksCta";
import { booksCaps, inventoryAddonPrice } from "@/lib/pricing";

export const metadata: Metadata = {
  title: "Business books",
  description:
    "Business books on #NotesApp: walk-in sales with receipts, expenses, money owed to you and profit, beside your online store. Free on Free Basic.",
};

// The public landing for Business books (live since v0.118.0; the app itself is /profile/books, components/books/). Receipts and
// statements link here from their footer ("Keep your own books free"). The old waitlist's sign-ups stay in Admin → Leads.
const DOES = [
  { t: "Walk-in sales in a few taps", d: "Pick from your store or type a one-off item, then cash, transfer, POS or on credit. Paid online store orders come in by themselves." },
  { t: "Receipts", d: "A receipt link with Save as PDF and a QR code for every sale. Customers on #NotesApp get it by email and the bell; others by WhatsApp from your phone." },
  { t: "Expenses", d: "Rent, diesel, transport, staff pay and the rest, by category, with up to 3 private photos of the receipt." },
  { t: "Stock that keeps up", d: "A walk-in sale takes the item off your inventory, voiding it puts it back, and Books home shows what's running low." },
  { t: "Money owed to you, and what you owe", d: "Who owes you, since when and what's late, with Record payment and reminders. Your suppliers and when you pay them." },
  { t: "Profit for a day, a week or a month", d: "Sales, the cost of what you sold, expenses and profit, cash in hand and your best sellers, with a PDF report and a CSV." },
  { t: "Bring your records", d: "Import a stock list, past sales, expenses or customers from a CSV (Excel, Google Sheets, Tralo, Shopify, WooCommerce, Selar, Bumpa, Paystack) or a bank statement. Check a dry run first, and undo for 24 hours." },
];

const SHOTS = [
  { src: "/images/books/books-record-sale.webp", w: 1440, h: 900, alt: "Recording a sale: rice and garri from inventory, paid partly in cash with the rest owed by Monday" },
  { src: "/images/books/books-profit-and-loss.webp", w: 1440, h: 900, alt: "Profit and loss for October: weekly sales, the statement, expenses by category and best sellers" },
];

export default function BooksPage() {
  const caps = booksCaps();
  return (
    <>
      <PageHero eyebrow="Business books" title={<>Your shop&apos;s books, beside your online store</>}>
        <p>For market traders, shops, food sellers, salons and anyone who sells in person: record what you sell and spend, see who owes you, and know your profit.</p>
        <p className="small">Free on Free Basic: {caps.freeEntries} walk-in sales and expenses a month and up to {caps.freeCustomers} customers owing at once. No limit on Pro, Business and Enterprise.</p>
        <p className="mt-2"><BooksCta className="inline-flex rounded-full border border-paper/70 bg-paper/10 px-6 py-3 font-ui text-sm font-semibold !no-underline hover:bg-paper/20" /></p>
      </PageHero>

      <div className="mx-auto grid max-w-6xl gap-12 px-4 py-12 sm:px-6 lg:grid-cols-[1.1fr,0.9fr] lg:px-8">
        <div>
          <p className="eyebrow">What it does</p>
          <ul className="mt-4 grid gap-4 sm:grid-cols-2">
            {DOES.map((w) => (
              <li key={w.t} className="card p-5">
                <p className="font-ui font-bold text-ink">{w.t}</p>
                <p className="mt-1 text-sm text-slate">{w.d}</p>
              </li>
            ))}
          </ul>
          <p className="mt-5 text-sm text-slate">
            Selling online too? Your <Link href="/store-selling" className="text-crimson underline">store</Link> and{" "}
            <Link href="/help/inventory" className="text-crimson underline">inventory</Link> work with your books (inventory is included on
            Business, and {inventoryAddonPrice()} a month on Free Basic and Pro). Online store orders never count toward the Free Basic limit.
          </p>
        </div>
        <div className="lg:sticky lg:top-24 lg:self-start">
          <div className="card grid gap-4 p-6 sm:p-7">
            <p className="eyebrow">Start now</p>
            <h2 className="font-display text-2xl text-ink">Open your books</h2>
            <p className="text-sm text-slate">It&apos;s under My account → Business books. Record your first sale in a minute, or import what you already keep.</p>
            <BooksCta className="btn-primary justify-self-start" />
            <p className="text-xs text-slate">
              How it works, step by step: <Link href="/help/business-books" className="text-crimson underline">the Business books help article</Link>.
              Prices on <Link href="/pricing" className="text-crimson underline">Pricing</Link>.
            </p>
          </div>
        </div>
      </div>

      <section className="border-t border-rule bg-field/40">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
          <p className="eyebrow">A look inside</p>
          <h2 className="mt-2 font-display text-3xl text-ink">Books home, a sale and your profit</h2>
          <p className="mt-2 max-w-2xl text-sm text-slate">From the approved designs, so a few details differ from the app. The shop and the numbers are made up.</p>
          <div className="mt-8 grid items-start gap-6 lg:grid-cols-[0.42fr,1fr]">
            <Image src="/images/books/books-home-phone.webp" width={780} height={1688} alt="Books home on a phone: today's profit, sales, expenses, cash in hand, money owed and a Record a sale button" className="mx-auto w-full max-w-[300px] rounded-[2rem] border border-rule shadow-sm" />
            <div className="grid gap-6">
              {SHOTS.map((s) => (
                <Image key={s.src} src={s.src} width={s.w} height={s.h} alt={s.alt} className="w-full rounded-xl2 border border-rule shadow-sm" />
              ))}
            </div>
          </div>
          <p className="mt-8 text-sm text-slate">
            Also in it: Tell Nana (type a sentence, check the entries she writes), entry with no signal, a monthly summary email, Cashier and
            Manager staff on Business and Enterprise, and Pay now on statements so customers pay what they owe online. See what&apos;s next
            on the <Link href="/roadmap" className="text-crimson underline">roadmap</Link>.
          </p>
        </div>
      </section>
    </>
  );
}
