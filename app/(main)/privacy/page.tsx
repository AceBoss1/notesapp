import type { Metadata } from "next";
import { LEGAL_CONTACT, LEGAL_VERSION } from "@/lib/legal";
import { COMPANY_INFO } from "@/lib/site";

export const metadata: Metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <article className="prose mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <p className="eyebrow">Version {LEGAL_VERSION}</p>
      <h1>Privacy Policy</h1>
      <h2>What we collect</h2>
      <p>Account details (name, username, email, avatar, bio, social links), content you publish and comments you write, bookings and payment references, payout bank details for publishers (the account name, bank and last four digits, a payment-provider recipient code and, so that a payout can be sent, the full account number, which we keep encrypted and readable only by our server), and basic technical data needed to run the site. If you apply for an identity-checked gold badge we record only your application, the deposit payment and the outcome of the check (passed, failed or pending) with a reference number — not your ID number, ID photo, selfie or CAC documents.</p>

      <h2>Why we use it</h2>
      <p>To run your account, deliver bookings and subscriptions, process payments and payouts, send confirmations and reminders, keep the platform safe, and meet legal obligations. Our legal bases are performing our contract with you, our legitimate interests in security and fraud prevention, and your consent where required.</p>

      <h2>Who processes it for us</h2>
      <p>Google Firebase (accounts and database), Cloudflare (media storage, including the private storage used for paid digital downloads, and Cloudflare Stream, which hosts the video lessons of view-only courses). For view-only purchases we also keep a random identifier for each browser you open them on, with its browser and system type and when it was last used, to enforce the two-device limit, Paystack and Paylony (payments, virtual accounts and payouts), Resend (transactional email) and Vercel (hosting). Only if you choose an identity-checked gold badge, Dojah also processes the identity details you submit (for individuals a NIN and a live face check; for organisations CAC registration details) to run the check; you enter them on Dojah&apos;s own page, it handles them under its own privacy policy, and #NotesApp does not keep them. Some of these providers process data outside Nigeria under appropriate safeguards.</p>

      <h2>How long we keep it</h2>
      <p>While your account is active, and afterwards only what we must keep for financial, tax and dispute records: when you delete your account, payment, payout and order records are kept without your name, email, address or phone number. Error records (technical details of failures, with personal data removed) are deleted automatically after 30 days.</p>

      <h2>Your rights</h2>
      <p>You may access, correct, export or delete your data, object to processing, and withdraw consent. Most of this you can do yourself under <a href="/profile/account">Account</a> → Your data: download a copy of your data, or delete your account (it is refused while money, orders, sessions or paid plans are still open, so nobody is left out of pocket). For anything else, contact us at {LEGAL_CONTACT}. You may also complain to the Nigeria Data Protection Commission.</p>

      <h2>Cookies and storage</h2>
      <p>We use only what is needed to keep you signed in and remember basic preferences.</p>

      <h2>Contact</h2>
      <p>{COMPANY_INFO.legalName} (RC {COMPANY_INFO.rcNumber}) · {LEGAL_CONTACT}</p>
    </article>
  );
}
