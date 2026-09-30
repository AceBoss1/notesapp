import type { Metadata } from "next";
import { LEGAL_CONTACT, LEGAL_VERSION } from "@/lib/legal";

export const metadata: Metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <article className="prose mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <p className="eyebrow">Version {LEGAL_VERSION}</p>
      <h1>Privacy Policy</h1>
      <h2>What we collect</h2>
      <p>Account details (name, username, email, avatar, bio, social links), content you publish and comments you write, bookings and payment references, payout bank details for publishers (we store the account name, bank and last four digits, plus a Paystack recipient code — not the full number), and basic technical data needed to run the site.</p>

      <h2>Why we use it</h2>
      <p>To run your account, deliver bookings and subscriptions, process payments and payouts, send confirmations and reminders, keep the platform safe, and meet legal obligations. Our legal bases are performing our contract with you, our legitimate interests in security and fraud prevention, and your consent where required.</p>

      <h2>Who processes it for us</h2>
      <p>Google Firebase (accounts and database), Cloudflare (media storage), Paystack (payments and payouts), Resend (transactional email) and Vercel (hosting). Some of these process data outside Nigeria under appropriate safeguards.</p>

      <h2>How long we keep it</h2>
      <p>While your account is active, and afterwards only what we must keep for financial, tax and dispute records.</p>

      <h2>Your rights</h2>
      <p>You may access, correct, export or delete your data, object to processing, and withdraw consent. Contact us at {LEGAL_CONTACT}. You may also complain to the Nigeria Data Protection Commission.</p>

      <h2>Cookies and storage</h2>
      <p>We use only what is needed to keep you signed in and remember basic preferences.</p>

      <h2>Contact</h2>
      <p>{LEGAL_CONTACT}</p>
    </article>
  );
}
