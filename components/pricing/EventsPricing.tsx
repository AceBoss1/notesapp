import Link from "next/link";
import { formatNaira } from "@/lib/booking-time";
import { bandsText } from "@/lib/giving";
import { invitesConfig, planPrice, planRate, enterpriseFrom } from "@/lib/pricing";
import { getTierConfig, formatPercent } from "@/lib/tiers";

// Events and bookings, plan by plan (docs/EVENTS_DISCOVER.md; the plan-card idea the owner sent). Every figure is live from Admin →
// Pricing; the page calls loadLivePricing() first.
export default function EventsPricing() {
  const inv = invitesConfig();
  const ent = getTierConfig("enterprise");
  const n = (x: number) => x.toLocaleString("en-NG");
  const plans = [
    { name: "Free Basic", price: "₦0", note: "free forever", cta: ["Start free", "/signup"], lead: "", points: [
      "Unlimited events and guests, in person, online or both", "Reminders by email, bell and phone notification", `Send up to ${n(inv.perWeekBasic)} invitations a week`,
      "Ticket types and up to 10 tickets an order; QR tickets and check-in", "Approval to join, guest limits, covers and themes", "Meetings with 2 to 50 seats, and 1:1 sessions",
      <>Tickets <b>{bandsText(formatNaira).split(",")[0]}…</b>, no commission</>, <><b>{planRate("basic", "session")}</b> on paid meetings and sessions</>,
    ] },
    { name: "Pro", price: planPrice("pro"), note: "a month · try free for 15 days", cta: ["Try Pro free", "/pricing#compare"], lead: "Everything in Free Basic, plus:", points: [
      <><b>{planRate("pro", "session")}</b> on paid meetings and sessions</>, `Send up to ${n(inv.perWeekPro)} invitations a week`, `${planRate("pro", "adShare")} of the ad revenue on your pages`, "Paid courses, co-authoring and more",
    ] },
    { name: "Business", price: planPrice("business"), note: "a month · try free for 15 days", cta: ["Try Business free", "/pricing#compare"], lead: "Everything in Pro, plus:", hl: true, points: [
      <><b>{planRate("business", "session")}</b> on paid meetings and sessions</>, `Send up to ${n(inv.perWeekBusiness)} invitations a week`, "Your own domain for your site and calendar", "Verified badge ✔ included", `${planRate("business", "adShare")} of the ad revenue on your pages`,
    ] },
    { name: "Enterprise", price: `From ${enterpriseFrom()}`, note: "a month · agreed with us", cta: ["Talk to us", "/contact?topic=enterprise"], lead: "Everything in Business, plus:", points: [
      <>From <b>{formatPercent(ent.sessionAndUnlockCommission, ent.sessionAndUnlockCommissionFloor).replace(/^Custom \(from /, "").replace(/\+?\)$/, "")}</b> on paid meetings and sessions</>, `${n(inv.perWeekEnterprise)} invitations a week, or as agreed`, "API and webhooks", "Full white label and more seats",
    ] },
  ];
  return (
    <section id="events" className="mt-14 scroll-mt-24">
      <p className="eyebrow">Events, meetings and sessions</p>
      <h2 className="mt-2 font-display text-3xl text-ink">Events and bookings, priced for Nigeria</h2>
      <p className="mt-2 max-w-3xl text-slate">Free with unlimited events and guests. Upgrade for a lower commission on meetings and sessions and more invitations. See how each works on <Link href="/booking" className="text-crimson underline">Events, meetings and sessions</Link>.</p>
      <ul className="mt-6 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        {plans.map((p) => (
          <li key={p.name} className={`card flex flex-col gap-2 p-5 ${p.hl ? "border-crimson shadow-[0_14px_30px_-18px_rgba(122,3,40,0.5)]" : ""}`}>
            <p className="font-ui font-bold text-ink">{p.name}</p>
            <p className="font-display text-2xl text-crimson">{p.price}</p>
            <p className="text-xs text-slate">{p.note}</p>
            <Link href={p.cta[1]} className={`${p.hl ? "btn-primary" : "btn-ghost"} justify-center !py-2 text-xs`}>{p.cta[0]}</Link>
            {p.lead && <p className="mt-1 text-xs font-bold text-ink">{p.lead}</p>}
            <ul className="space-y-1.5 text-xs text-ink">{p.points.map((x, i) => <li key={i} className="flex gap-1.5"><span className="font-bold text-emerald-700">✓</span><span>{x}</span></li>)}</ul>
          </li>
        ))}
      </ul>
      <div className="mt-6 grid gap-4 md:grid-cols-[1.2fr,1fr]">
        <div>
          <p className="font-ui text-sm font-bold text-ink">More invitations</p>
          <p className="mt-1 text-xs text-slate">Messages to people already going or booked are always unlimited. Invitations to people who aren&apos;t in yet count toward your week.</p>
          <table className="mt-3 w-full overflow-hidden rounded-xl border border-rule text-left text-sm">
            <thead><tr className="bg-crimson text-white"><th className="px-3 py-2">More invitations a week</th><th className="px-3 py-2">Price</th></tr></thead>
            <tbody>
              {[[10_000, inv.pack10kKobo], [25_000, inv.pack25kKobo], [50_000, inv.pack50kKobo]].map(([s, k]) => <tr key={s} className="border-t border-rule bg-white"><td className="px-3 py-2">{n(s)}</td><td className="px-3 py-2">{formatNaira(k)} a month</td></tr>)}
            </tbody>
          </table>
        </div>
        <p className="self-start rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">Card payments are charged by Paystack at cost (1.5% + ₦100, the ₦100 waived under ₦2,500, at most ₦2,000), on top of what we take. Paying from NotesApp Credit has no card charge. Prices are in naira; buyers abroad pay in their own currency.</p>
      </div>
    </section>
  );
}
