import Link from "next/link";
import VerifiedBadge from "@/components/VerifiedBadge";
import { GOLD_PRICING } from "@/lib/gold";
import { GOLD_KIND_LIVE } from "@/lib/badges";
import { formatNaira } from "@/lib/booking-time";

// One explainer for the gold badge, reused on the landing page, /about and
// /pricing so the pitch, prices and status never drift apart.
export default function GoldBadgeExplainer({ heading = true }: { heading?: boolean }) {
  const p = GOLD_PRICING.personal;
  const c = GOLD_PRICING.corporate;
  const idLive = GOLD_KIND_LIVE.identity;
  return (
    <div>
      {heading && (
        <>
          <p className="eyebrow flex items-center gap-2"><VerifiedBadge size={16} level="gold" /> Gold badge</p>
          <h2 className="mt-3 font-display text-3xl text-ink">Show clients you&apos;re the real thing</h2>
          <p className="mt-3 max-w-2xl text-slate">
            The gold ✔ marks accounts #NotesApp has either <strong className="text-ink">endorsed</strong> or{" "}
            <strong className="text-ink">identity-checked</strong>. It sits beside your name on your profile, in the people
            directory and on every post — and it&apos;s the same price on every plan, from Free Basic to Enterprise.
          </p>
        </>
      )}
      <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div className="card p-6">
          <p className="font-ui text-base font-bold text-ink">Endorsed by #NotesApp</p>
          <p className="mt-2 text-sm text-slate">
            We review your public work by hand — who you are, what you publish, links that back it up — and endorse accounts
            we&apos;d vouch for. <strong className="text-ink">No fee to apply or to be reviewed.</strong>
          </p>
          <p className="mt-3 font-mono text-xs uppercase tracking-eyebrow text-crimson-bright">
            Open now · {formatNaira(p.monthlyKobo)}/mo personal · {formatNaira(c.monthlyKobo)}/mo organisation
          </p>
        </div>
        <div className="card p-6">
          <p className="font-ui text-base font-bold text-ink">Identity-checked</p>
          <p className="mt-2 text-sm text-slate">
            People are checked with their NIN and a live face check; organisations with their CAC registration — through our
            verification partner Dojah. <strong className="text-ink">We don&apos;t keep your ID documents.</strong> A one-off,
            non-refundable deposit ({formatNaira(p.identityDepositKobo)} personal / {formatNaira(c.identityDepositKobo)} organisation)
            covers the check, then the same monthly price applies.
          </p>
          <p className="mt-3 font-mono text-xs uppercase tracking-eyebrow text-crimson-bright">
            {idLive ? "Open now" : "Coming soon"} · {formatNaira(p.monthlyKobo)}/mo personal · {formatNaira(c.monthlyKobo)}/mo organisation
          </p>
        </div>
      </div>
      <ol className="mt-6 grid grid-cols-1 gap-3 text-sm text-slate sm:grid-cols-4">
        {["Apply on the badges page", "We review it (identity: after the deposit)", "You're approved", "Subscribe — gold shows straight away"].map((s, i) => (
          <li key={s} className="border border-rule bg-card px-4 py-3">
            <span className="font-mono text-xs text-crimson-bright">{i + 1}</span> {s}
          </li>
        ))}
      </ol>
      <p className="mt-5 text-sm text-slate">
        Gold replaces the maroon ✔ while it&apos;s active and lapses if you stop renewing. The maroon ✔ only shows good
        standing; gold means we&apos;ve vouched for you or checked who you are.{" "}
        <Link href="/badges" className="text-crimson underline underline-offset-2">Apply for gold →</Link>
      </p>
    </div>
  );
}
