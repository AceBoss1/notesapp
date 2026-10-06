import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getUserByUsername } from "@/lib/users";
import { LEGAL_CONTACT, LEGAL_VERSION } from "@/lib/legal";
import PoweredBy from "@/components/site/PoweredBy";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Privacy Policy" };

// The privacy policy of a member's own site, in the member's name, with a "powered by #NotesApp" block.
export default async function SitePrivacyPage({ params }: { params: { username: string } }) {
  const p = await getUserByUsername(params.username).catch(() => null);
  if (!p || p.suspended || p.uid.startsWith("admin:")) notFound();
  const name = p.displayName;
  return (
    <article className="prose mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <p className="eyebrow">Version {LEGAL_VERSION}</p>
      <h1>Privacy Policy</h1>
      <p>This policy explains how your personal data is handled when you use the {name} website. The site is powered by #NotesApp, which runs the accounts, bookings, payments and shop on {name}&apos;s behalf, so both {name} and #NotesApp handle your data, as described below.</p>

      <h2>What we collect</h2>
      <p>Your account details (name, username, email, avatar), the comments you write, your bookings, subscriptions and orders, the delivery address and phone number you give for a physical order, payment references (never your card number), and basic technical data needed to run the site. For view-only purchases we also keep a random identifier for each browser you open them on, with its browser and system type and when it was last used, to enforce the two-device limit.</p>

      <h2>Why we use it</h2>
      <p>To run your account, deliver sessions, subscriptions and orders, process payments, send confirmations and reminders, keep the site safe and meet legal obligations. Our legal bases are performing our contract with you, legitimate interests in security and fraud prevention, and your consent where it is needed. {name} uses what you give for a session or order to provide it to you; it is not sold.</p>

      <h2>Who processes it</h2>
      <p>#NotesApp (NOTESAPP TECHNOLOGIES LTD) operates the platform. It uses Google Firebase (accounts and database), Cloudflare (storage, and video hosting for courses), Paystack (payments and payouts), Resend (email) and Vercel (hosting). Some of these providers process data outside Nigeria under appropriate safeguards.</p>

      <h2>Who can see what</h2>
      <p>{name} can see your name, email and the details of the sessions and orders you place with it, including the delivery address and phone number for a physical order. Carriers or riders handling a parcel may be given your phone number if you agreed to it. Your comments are public on the page where you post them.</p>

      <h2>How long we keep it</h2>
      <p>While your account is active, and afterwards only what must be kept for financial, tax and dispute records: when an account is deleted, payment and order records are kept without your name, email, address or phone number.</p>

      <h2>Your rights</h2>
      <p>You may access, correct, export or delete your data, object to its processing and withdraw consent. Most of this you can do yourself in your #NotesApp account under Account → Your data. For anything else, contact {LEGAL_CONTACT}. You may also complain to the Nigeria Data Protection Commission.</p>

      <h2>Cookies and storage</h2>
      <p>We use only what is needed to keep you signed in, remember basic preferences and identify your device for view-only purchases. This site does not use advertising cookies of its own.</p>

      <h2>Contact</h2>
      <p>For questions about your data, write to {LEGAL_CONTACT}; for questions about {name}&apos;s services, contact {name} through the details on the Home page.</p>

      <PoweredBy name={name} />
    </article>
  );
}
