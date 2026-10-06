import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getUserByUsername } from "@/lib/users";
import { POLICY_TEXT } from "@/lib/cancellation";
import { LEGAL_VERSION } from "@/lib/legal";
import PoweredBy from "@/components/site/PoweredBy";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Terms of Service" };

// The terms of a member's own site (Business and Enterprise custom domains), in the member's name, with a "powered by
// #NotesApp" block. The #NotesApp Terms of Service sit underneath (accounts, payments, payouts, platform rules).
export default async function SiteTermsPage({ params }: { params: { username: string } }) {
  const p = await getUserByUsername(params.username).catch(() => null);
  if (!p || p.suspended || p.uid.startsWith("admin:")) notFound();
  const name = p.displayName;
  return (
    <article className="prose mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <p className="eyebrow">Version {LEGAL_VERSION}</p>
      <h1>Terms of Service</h1>
      <p>These terms apply when you use the {name} website: reading its notes, booking its sessions, subscribing, or buying from its shop. By using the site, creating an account or paying, you agree to them.</p>

      <h2>1. Who you are dealing with</h2>
      <p>{name} is the publisher and seller on this site. It sets its own prices, describes what it offers and is responsible for delivering it. The site is powered by #NotesApp, which provides the accounts, booking, payment and shop technology but is not the seller of {name}&apos;s sessions, subscriptions or goods.</p>

      <h2>2. Your account</h2>
      <p>You sign in with a #NotesApp account, which works on every #NotesApp-powered site. You must be 18 or older, give accurate details, keep your password secret and verify your email before paying. You are responsible for activity on your account. Accounts that break these terms may be suspended.</p>

      <h2>3. Notes and content</h2>
      <p>The notes, images, videos and other content on this site belong to {name} or its authors. You may read and share links to them, but you may not copy, resell or republish them without permission. Comments you post must be lawful, respectful and your own; they may be removed if they are not.</p>

      <h2>4. Paid sessions</h2>
      <p>Session prices and times are set by {name}; times are in Lagos time (WAT). Payments are processed by Paystack, and card details are never stored by this site or #NotesApp. {POLICY_TEXT}</p>

      <h2>5. Subscriptions</h2>
      <p>A subscription unlocks {name}&apos;s premium notes for as long as it is active. It renews monthly until you cancel; cancelling stops the next renewal and you keep access until the period you paid for ends.</p>

      <h2>6. The shop</h2>
      <p><strong>Physical items.</strong> You pay through #NotesApp checkout and your payment is held until you confirm the item arrived (or 7 days after it is marked delivered, if you say nothing). Each parcel gets a tracking ID. If something is wrong, report it before then and the payment stays held while the problem is reviewed; the review may end in a release to the seller or a refund to you. The seller arranges and is responsible for delivery, and the delivery fee is set by the seller.</p>
      <p><strong>Digital downloads and view-only items.</strong> You get access straight after payment. A digital purchase is final once you start a download or first open a view-only item, so there is no refund after that (before then, a refund is at the seller&apos;s and #NotesApp&apos;s discretion, for example if the file is not as described or does not work). View-only items and courses work on up to two devices per purchase; sharing your access, getting around the device limit, or recording and redistributing the content is not allowed and access may be withdrawn.</p>

      <h2>7. Disputes</h2>
      <p>If you have a problem with a session, order or payment, raise it with {name} first. If it is not resolved, report it through your orders or bookings page and #NotesApp will review it and may hold or refund the payment as set out above.</p>

      <h2>8. Liability</h2>
      <p>Sessions and goods are agreements between you and {name}. To the extent the law allows, neither {name} nor #NotesApp is liable for indirect or consequential loss, and the platform is provided &ldquo;as is&rdquo;. Nothing here limits any right you have under Nigerian consumer law.</p>

      <h2>9. Changes and law</h2>
      <p>We may update these terms and will change the version date above when we do; material changes need your acceptance before your next payment. They are governed by the laws of the Federal Republic of Nigeria.</p>

      <h2>10. Contact</h2>
      <p>Questions about a session, subscription or order: contact {name} through the details on the Home page, or through your booking or order page. Questions about your account or the platform: see the note below.</p>

      <PoweredBy name={name} />
    </article>
  );
}
