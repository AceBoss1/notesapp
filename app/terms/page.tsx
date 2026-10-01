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

      <h2>5b. Verified badge</h2>
      <p>The #NotesApp team mark beside the badge identifies staff, guest writers and official accounts and is set only by #NotesApp. The verified badge is included with Business and Enterprise plans and for #NotesApp staff and official accounts; other accounts can add it for ₦999 per month, renewing until cancelled (cancelling keeps the badge until the paid period ends). The badge shows an account in good standing with an active plan or badge subscription. It is not an identity check or an endorsement, and we may remove it, without refund, from an account that is suspended or that impersonates or misleads others. The gold badge marks accounts that #NotesApp has endorsed after review, or whose identity has been checked. It is by application and review at our discretion, costs ₦1,999 per month for individuals or ₦2,999 per month for organisations on every plan, and renews until cancelled (cancelling keeps it until the paid period ends). An identity check also requires a one-off verification deposit (₦999 individuals, ₦1,999 organisations) that covers a third-party check, is non-refundable whether or not the check succeeds, and is paid before review. Endorsement has no deposit. We do not keep identity documents; the check is run by our verification partner under its own terms. We may withdraw gold, without refund, where an account is suspended, misleads others, or no longer meets the criteria.</p>

      <h2>5c. Co-authored posts</h2>
      <p>Pro, Business and Enterprise publishers may invite other members to co-author a draft post and propose each person's percentage share of that post's earnings (the lead keeps at least 10% and each co-author at least 5%, up to four co-authors). Anyone may be invited, but accepting requires a publishing account (Free Basic or above), because the share is paid out to a publisher. A co-author is listed only after accepting, and the split is fixed when the post is published; invitations still pending then expire. Gifts sent on a co-authored post are divided between its authors in the agreed percentages and each portion is held and paid like any gift (7-day window, to the author's verified bank account), minus that author's own plan commission. Ad share on the post will be divided the same way once ad-share payouts are live. Paid sessions are personal: each author sets their own price and is paid for their own sessions only. We may remove a co-author listing or withhold a share where there is a dispute or a breach of these Terms.</p>

      <h2>5d. Ads and ad share</h2>
      <p>Free journals carry ads; Pro and Business publishers may opt in to ads on their pages to earn an ad share at their plan's rate. Ad share is calculated only on valid activity: unique views and clicks by real visitors, as we measure them. Publishers must not click their own ads, ask or pay others to, or use bots or other means to inflate views or clicks. We may hold ad-share payouts for a review period, withhold or reverse the share for invalid activity, and remove ads or the opt-in from an account that breaches this clause. Ad-share payouts start when the ad program launches; until then, ad activity is counted but nothing is paid.</p>

      <h2>6. Liability</h2>
      <p>Sessions are agreements between clients and publishers. #NotesApp provides the platform "as is" and is not responsible for advice given in sessions. To the extent permitted by law, our liability is limited to the fees we received for the transaction in question.</p>

      <h2>7. Governing law</h2>
      <p>These terms are governed by the laws of the Federal Republic of Nigeria.</p>

      <h2>8. Contact</h2>
      <p>{LEGAL_CONTACT}</p>
    </article>
  );
}
