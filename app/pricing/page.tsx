import type { Metadata } from "next";
import Link from "next/link";
import { TIERS, formatPercent } from "@/lib/tiers";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "#NotesApp's tier ladder — Free Standard for readers, Free Basic through Enterprise for publishers, with transparent ad revenue share and booking/unlock/merch commission at every level.",
};

const ROWS: { label: string; render: (t: (typeof TIERS)[number]) => string }[] = [
  { label: "Can publish?", render: (t) => (t.canPublish ? "Yes" : "No — read & engage only") },
  {
    label: "Ad revenue share",
    render: (t) =>
      t.adRevenueShare === null ? "—" : t.adRevenueShare === 0 ? "0% (ads run, no share)" : `${(t.adRevenueShare * 100).toFixed(0)}%`,
  },
  {
    label: "Booking & unlock commission",
    render: (t) =>
      t.canPublish
        ? `NotesApp takes ${formatPercent(t.sessionAndUnlockCommission, t.sessionAndUnlockCommissionFloor)}`
        : "—",
  },
  {
    label: "Internal merch store commission",
    render: (t) => (t.canPublish ? `NotesApp takes ${formatPercent(t.merchCommission, t.merchCommissionFloor)}` : "—"),
  },
  {
    label: "External store (Selar, Amazon, etc.)",
    render: (t) => (t.canPublish ? (t.externalStoreAllowed ? "Available" : "Not available") : "—"),
  },
  { label: "AI draft assistance", render: (t) => (t.canPublish ? "Included — every publisher tier" : "—") },
];

export default function PricingPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
      <span className="eyebrow">Pricing</span>
      <h1 className="mt-4 font-display text-4xl text-ink sm:text-5xl">
        One ladder, transparent at every rung
      </h1>
      <p className="mt-5 max-w-2xl text-lg text-slate">
        Reading, commenting, booking a session, unlocking a locked
        journal, and buying merch are always free to do. Publishing
        your own journal opens the ladder below — the more you commit
        to the platform, the less commission NotesApp takes on what
        you earn through it.
      </p>
      <p className="mt-3 max-w-2xl text-sm text-slate">
        Every publisher tier — Free Basic included — can connect their
        own AI assistant to draft from their past notes. That's not a
        paid-tier perk here.
      </p>

      <div className="mt-12 overflow-x-auto">
        <table className="w-full min-w-[900px] border-collapse text-left">
          <thead>
            <tr>
              <th className="border-b-2 border-ink py-4 pr-4 font-ui text-sm text-slate">
                &nbsp;
              </th>
              {TIERS.map((t) => (
                <th key={t.tier} className="border-b-2 border-ink px-4 py-4">
                  <p className="font-display text-xl text-ink">{t.label}</p>
                  <p className="mt-1 font-mono text-sm text-crimson-bright">{t.price}</p>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => (
              <tr key={row.label} className="border-b border-rule">
                <td className="py-4 pr-4 font-ui text-sm font-semibold text-ink">{row.label}</td>
                {TIERS.map((t) => (
                  <td key={t.tier} className="px-4 py-4 text-sm text-slate">
                    {row.render(t)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div className="card p-6">
          <p className="font-ui text-sm font-bold text-ink">How to move up the ladder</p>
          <p className="mt-2 text-sm text-slate">
            Free Standard → Free Basic is a self-serve application from
            your own profile, reviewed by an admin — no payment
            involved. Pro, Business, and Enterprise are paid upgrades;
            billing isn't live yet (see{" "}
            <Link href="/roadmap" className="text-crimson underline underline-offset-2">
              the roadmap
            </Link>
            ), so these show as "Coming soon" rather than a working
            checkout today.
          </p>
        </div>
        <div className="card p-6">
          <p className="font-ui text-sm font-bold text-ink">
            Why external stores are restricted
          </p>
          <p className="mt-2 text-sm text-slate">
            An external link-out (Selar, Amazon, etc.) is revenue
            NotesApp never takes a commission on. That option stays
            available to the two founders' existing stores and to
            Enterprise — everyone else sells through NotesApp's own
            internal fulfillment, where the commission table on the
            left actually applies.
          </p>
        </div>
      </div>

      <p className="mt-10 text-sm text-slate">
        Full ad-share policy detail (why no gated conditions, who can
        advertise):{" "}
        <Link href="/advertise" className="text-crimson underline underline-offset-2">
          Advertise page
        </Link>
        .
      </p>
    </div>
  );
}
