import type { Metadata } from "next";
import { POLICY_TEXT } from "@/lib/cancellation";
import { LEGAL_CONTACT, LEGAL_VERSION } from "@/lib/legal";
import { COMPANY_INFO } from "@/lib/site";
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
      <p>Free journals carry ads; Pro, Business and Enterprise publishers may opt in to ads on their pages to earn an ad share at their plan's rate. Each month we divide the ad revenue we have actually received over the valid impressions served and credit each opted-in publisher their pages' impressions at that rate, multiplied by their plan's share. Only valid activity counts: unique views and clicks by real visitors, as we measure them. Publishers must not click their own ads, ask or pay others to, or use bots or other means to inflate views or clicks. Each monthly statement is reviewed before approval; an approved share is held for 30 days before it is paid to the publisher's verified bank account, and amounts under ₦1,000 roll over to the next month. We may withhold or reverse a share for invalid activity, and remove ads or the opt-in from an account that breaches this clause. Ad revenue that has not been received by us is not shared.</p>

      <h2>5e. Buying ads</h2>
      <p>Anyone with a verified account may buy a banner campaign: a block of validated impressions (unique per visitor per ad per day, as we measure them) delivered across the chosen placements within the package's window. Every ad is reviewed before it runs. We do not run ads for illegal goods or services, scams or misleading offers; adult, hateful, violent or harassing content; impersonation of #NotesApp, another brand or person (including copying a verification badge); loans or investment schemes promising guaranteed returns, or unlicensed financial, medical or betting offers; or links to malware, phishing or pages that differ from the ad. If we do not approve an ad you are refunded in full. A campaign ends when its impressions are delivered or its window closes; impressions not delivered by then are refunded pro rata. We start every refund promptly; Paystack, our payment provider, handles the rest of the refund process, and it can take several business days to reach your bank or card. Delivery is not guaranteed to produce clicks or sales. We may pause or remove an ad that breaches these Terms, with a pro-rata refund of the undelivered part unless the breach was deliberate.</p>

      <h2>5f. Organisation accounts</h2>
      <p>A company, NGO, church, school or other body may open an organisation account and must give its CAC registration number accurately; the person who opens it confirms they are authorised to act for the organisation. New organisation accounts receive one free 30-day trial of the Business plan, once per registration number; unless the plan is paid for before the trial ends, the account then returns to Free Basic and keeps what it published. Until #NotesApp has confirmed the registration, the channel and each of its posts carry a notice that the organisation is unverified; the verified ✔ shows only after confirmation and while the account is on a plan that includes it. Confirmation of a registration number is not an identity check, an endorsement or a guarantee of the organisation's conduct. On Business and Enterprise the owner may invite admins and writers (up to the seats on the plan). Posts a team member writes for the organisation are published under the organisation's name and credited to the writer; the organisation is the author for all earnings purposes — gifts, subscriptions, ad share and sessions on those posts are paid to the organisation's payout account, not to the writer — and the organisation is responsible for what its team publishes. Team members can only publish while the organisation is on a plan that includes a team. We may reject a registration number, remove the organisation label or suspend an account that misrepresents who it is or impersonates another body.</p>

      <h2>5g. Store sales and delivery</h2>
      <p>A publisher on a plan that can publish may sell physical goods through #NotesApp checkout from their store. Stores sell through #NotesApp checkout only — listings that send the buyer to another checkout are not allowed; the only links out are the profile link and links inside posts. The seller is the seller: they set the price, delivery fee and stock (a managed count that goes down with each order, reserved for a buyer for 30 minutes while they pay, and at zero no one can order), describe the item accurately, and are responsible for dispatching it and delivering it to the address given. #NotesApp is not the seller, the carrier or a guarantor of the goods or of delivery. We take a commission on the item price (not on the delivery fee) at the rate for the seller's plan shown on the pricing page. We hold the buyer's payment until the buyer confirms delivery, or 7 days after the parcel is marked delivered if the buyer says nothing, and then make it payable to the seller's verified bank account. A buyer who has a problem may report it before then; we hold the money while we review, may ask both sides for proof, and decide whether to release it to the seller or refund the buyer. Sellers must keep the parcel's tracking up to date — either a courier name, tracking number and link, or a log of who holds the parcel at each stage (rider, driver or park agent) — and may share a no-login update link with each holder; a holder's link stops working once the next holder confirms they have the parcel. A holder's name, location and, with their agreement, phone number are shown on the parcel's tracking page; the phone number is shown only to the buyer, the seller or a person who gives the parcel ID and the last four digits of the receiver's phone number. Sellers must have each holder's agreement before adding their phone number. For an organisation's store, the organisation is the seller: the owner may give team members access to run the store and its orders, they act for the organisation, orders are paid out to the organisation's payout account, and the organisation carries the funds, liability and risk for what its team sells and ships. Prohibited goods include anything illegal, counterfeit, stolen, dangerous or restricted by law, and anything misrepresented. We may remove a listing, freeze a payout or refund a buyer where a sale breaches these Terms or the law.</p>
      <p><strong>Digital downloads.</strong> A seller may also sell a digital download: a file they upload, stored privately and available only to buyers who have paid. The buyer gets access immediately after payment and can download the file again at any time. A digital sale is final once the buyer has started a download: no refund is available after that (before a first download, a refund is at our discretion, for example if the file is not what was described or does not work). The seller is responsible for the file and for having the right to sell it, and must not upload anything unlawful, infringing or harmful. We take a commission on the price at the digital-download rate for the seller&apos;s plan shown on the pricing page, hold the payment for a 7-day dispute window, and then pay it to the seller&apos;s verified bank account.</p>

      <h2>6. Liability</h2>
      <p>Sessions are agreements between clients and publishers. #NotesApp provides the platform "as is" and is not responsible for advice given in sessions. To the extent permitted by law, our liability is limited to the fees we received for the transaction in question.</p>

      <h2>7. Governing law</h2>
      <p>These terms are governed by the laws of the Federal Republic of Nigeria.</p>

      <h2>8. Contact</h2>
      <p>{COMPANY_INFO.legalName} (RC {COMPANY_INFO.rcNumber}) · {LEGAL_CONTACT}</p>
    </article>
  );
}
