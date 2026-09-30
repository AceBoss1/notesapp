import type { Metadata } from "next";
import { POLICY_TEXT } from "@/lib/cancellation";
import { LEGAL_CONTACT, LEGAL_VERSION } from "@/lib/legal";
import { TIERS, formatPercent } from "@/lib/tiers";

export const metadata: Metadata = { title: "Terms of Service" };

export default function TermsPage() {
  const rates = TIERS.filter((t) => t.canPublish)
    .map((t) => `${t.label}: ${formatPercent(t.sessionAndUnlockCommission, t.sessionAndUnlockCommissionFloor)}`)
    .join(" · ");
  return (
    <article className="prose mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <p className="eyebrow">Version {LEGAL_VERSION}</p>
      <h1>Terms of Service</h1>
      <h2>1. Accounts</h2>
      <p>You must be 18 or older, give accurate details, keep your password secret, and verify your email. You are responsible for activity on your account. We may suspend accounts that break these terms, with a right of appeal from your profile.</p>

      <h2>2. Your content</h2>
      <p>You own what you publish. You give #NotesApp a licence to host, display and distribute it on the platform. Do not publish anything unlawful, infringing, hateful or misleading, and only upload media you have the rights to.</p>

      <h2>3. Paid sessions and subscriptions</h2>
      <p>Publishers set their own prices within platform limits. Payments are processed by Paystack; #NotesApp does not store card details. Session times are in Lagos time (WAT). Journal subscriptions renew monthly until cancelled and unlock the publisher's premium entries.</p>

      <h2>4. Cancellations and refunds</h2>
      <p>{POLICY_TEXT}</p>
      <p>No-shows and disputes are reviewed by #NotesApp; payouts to the publisher may be held while a dispute is open.</p>

      <h2>5. Commission and payouts</h2>
      <p>#NotesApp deducts a commission from paid sessions and subscriptions according to the publisher's tier ({rates}). Session earnings are released after the session takes place; subscription earnings after a 7-day dispute window. Payouts go to the bank account the publisher has verified.</p>

      <h2>5a. Paid plans, boosts and gifts</h2>
      <p>Pro and Business are paid plans billed monthly or yearly through Paystack and renewing automatically until you cancel. Cancelling stops renewal and you keep the plan until the end of the period you have paid for; plan fees are not refunded in part. If a renewal fails and is not resolved within a few days, the account returns to Free Basic. Boosts are sold by validated impressions and any undelivered impressions are refunded pro-rata when the boost ends. Gifts are voluntary, final unless a problem is reported and reviewed, and are subject to the publisher's tier commission.</p>

      <h2>6. Liability</h2>
      <p>Sessions are agreements between clients and publishers. #NotesApp provides the platform "as is" and is not responsible for advice given in sessions. To the extent permitted by law, our liability is limited to the fees we received for the transaction in question.</p>

      <h2>7. Governing law</h2>
      <p>These terms are governed by the laws of the Federal Republic of Nigeria.</p>

      <h2>8. Contact</h2>
      <p>{LEGAL_CONTACT}</p>
    </article>
  );
}
