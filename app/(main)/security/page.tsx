import Link from "next/link";
import type { Metadata } from "next";
import { COMPANY_INFO } from "@/lib/site";

export const metadata: Metadata = {
  title: "Trust & Security",
  description:
    "How #NotesApp protects buyers, sellers and publishers: held payments, signed webhooks, private downloads, tested access rules, identity checks, monitoring and your data rights.",
};

const SECTIONS: { title: string; points: string[] }[] = [
  {
    title: "Your money",
    points: [
      "Payments run through Paystack's hosted checkout, a licensed Nigerian payment processor. Card and bank details never touch our servers.",
      "Held until it's earned. A store buyer's payment is held until they confirm delivery (or 7 days after it is marked delivered). Session earnings are paid 24 hours after the session ends. Digital sales are paid after a 7-day dispute window. Any of these can be frozen while we review a reported problem.",
      "Sellers and publishers are paid to a bank account whose name we verify first. We store the account name, bank and last four digits, never the full number.",
      "Every payment event from Paystack is checked against its cryptographic signature before we act on it. Unsigned or altered messages are rejected.",
      "Refund rules are published before you pay: the booking policy on every booking page, and the Terms.",
    ],
  },
  {
    title: "Your files and content",
    points: [
      "Paid digital downloads live in a separate private storage bucket that has no public address. A buyer gets a short-lived download link (valid for one minute) only after paying, and the file is never exposed on a public URL.",
      "View-only items and courses never expose a file: PDF pages are streamed only to the buyer's signed-in, registered device and drawn in the page, and videos play from Cloudflare Stream with short-lived signed links and downloads switched off. Each purchase is tied to the buyer's account and two devices; a third device is refused and every attempt is counted. This deters sharing and casual copying — it can't stop someone recording their screen.",
      "Uploads are limited by file type and size, and the size is built into the upload link so it can't be exceeded. Executable files are not accepted.",
      "Drafts are private to their author; suspension records and appeals are private to the account and to admins.",
    ],
  },
  {
    title: "Who can do what",
    points: [
      "Access rules are enforced by the database itself, not just the website: money records, orders, payouts and private files can only be changed by our servers, and members can only read their own.",
      "Those rules have automated tests that run on every change. A test fails if, for example, a member could read someone else's payout or give themselves a higher plan.",
      "Admin access uses cryptographic claims on the account, not a list of email addresses, and refunds, payouts and freezes can only be done by an admin through our servers.",
      "Payment, upload, booking and public endpoints are rate-limited to slow down abuse.",
    ],
  },
  {
    title: "Who you're dealing with",
    points: [
      `#NotesApp is run by ${COMPANY_INFO.legalName}, a private company limited by shares registered with the Corporate Affairs Commission (RC ${COMPANY_INFO.rcNumber}, registered ${new Date(COMPANY_INFO.registeredOn).toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" })}) and tax-registered with the Nigeria Revenue Service (TIN ${COMPANY_INFO.tin}).`,
      "Gold identity checks are done by Dojah. We receive only a pass or fail result and never store ID numbers, selfies or documents.",
      "Organisations are checked against their CAC registration before they are marked verified, and are labelled unverified until then.",
      "Email must be verified before you can pay. Emails are never shown on public profiles.",
      "Accounts can be suspended with a reason, and the member can appeal.",
    ],
  },
  {
    title: "Keeping the lights on",
    points: [
      "A public status page shows live health for the website, database, sign-in, payments, email, media and our scheduled jobs.",
      "Errors, on our servers and in your browser, are recorded with personal data removed. Each new kind of error alerts our team the first time it appears.",
      "Scheduled jobs (reminders, payout release, order release) report in on every run, and the status page turns amber if they stop.",
    ],
  },
  {
    title: "Your data and your rights",
    points: [
      "Download a copy of your data, or delete your account, yourself under Account → Your data. Deleting removes your profile, posts, comments, store items and notifications; payment and order records are kept without your personal details because tax and dispute rules require it.",
      "We follow the Nigeria Data Protection Act's principles: we collect what we need, say why, and let you access, correct, export and delete it. See the Privacy Policy.",
      "Accepting the Terms and Privacy Policy is recorded before your first payment, and again whenever they change.",
    ],
  },
];

export default function SecurityPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <span className="eyebrow">Trust &amp; Security</span>
      <h1 className="mt-4 font-display text-4xl text-ink sm:text-5xl">How we protect people who buy, sell and publish here</h1>
      <p className="mt-5 text-lg text-slate">
        #NotesApp lets small sellers, professionals and organisations take real money from people they've never met. That only works if buyers can trust the seller and sellers can trust the platform.
        This page says what we actually do, not what we hope to do.
      </p>

      <div className="mt-10 space-y-6">
        {SECTIONS.map((s) => (
          <section key={s.title} className="card p-6">
            <h2 className="font-display text-2xl text-ink">{s.title}</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate">
              {s.points.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <section className="card mt-6 p-6">
        <h2 className="font-display text-2xl text-ink">What we're still building</h2>
        <p className="mt-3 text-sm text-slate">
          We'd rather be plain about the gaps. #NotesApp is a young product: we don't hold ISO or SOC certifications, we haven't yet had an independent penetration test, and the mobile apps and WhatsApp reminders are still ahead of us (see the{" "}
          <Link href="/roadmap" className="text-crimson underline">Roadmap</Link>). We are not a bank: payments are processed by Paystack, and we only hold money under the published rules above.
        </p>
      </section>

      <p className="mt-8 text-sm text-slate">
        Found a security problem? Please tell us privately through the <Link href="/contact" className="text-crimson underline">Contact page</Link> before sharing it publicly. See also the{" "}
        <Link href="/terms" className="text-crimson underline">Terms</Link>, <Link href="/privacy" className="text-crimson underline">Privacy Policy</Link> and{" "}
        <Link href="/status" className="text-crimson underline">live status</Link>.
      </p>
    </div>
  );
}
