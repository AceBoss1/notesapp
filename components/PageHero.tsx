"use client";

import type { ReactNode } from "react";
import { useShellHead } from "@/components/shell/SideShell";

// The crimson band at the top of the main pages (About, Pricing, Help …): a deep crimson with a soft glow, a small label, a serif headline
// and an intro. `compact` is a slimmer band for settings and work pages. `art` sits on the right on wide screens (for example Nana). Content goes below it in the page itself.
//
// Inside My account's frame (components/account/AccountShell.tsx, the Moda user dashboard redesign) it is a plain heading instead: the
// label in crimson ("MY ACCOUNT · MONEY" when the page's own label is just "My account" or its @username), the serif title and the intro.
// `side` (for example the account picker on Analytics) sits at the right of the plain heading, and under the intro on the band.
export default function PageHero({ eyebrow, title, children, art, side, max = "max-w-6xl", compact }: { eyebrow: string; title: ReactNode; children?: ReactNode; art?: ReactNode; side?: ReactNode; max?: string; compact?: boolean }) {
  const shell = useShellHead();
  if (shell) {
    const label = eyebrow === "My account" || eyebrow.startsWith("@") ? shell.eyebrow : eyebrow;
    return (
      <header className={`mx-auto ${max} px-4 pt-6 sm:px-6 lg:flex lg:items-start lg:justify-between lg:gap-8 lg:px-8 lg:pt-8`}>
        <div className="min-w-0">
          <p className="font-mono text-xs font-medium uppercase tracking-[0.12em] text-crimson-bright">{label}</p>
          <h1 className="mt-2 font-display text-[2rem] font-medium leading-tight text-ink">{title}</h1>
          {children && <div className="mt-2 max-w-2xl space-y-2 font-ui text-[15px] text-slate [&_a]:text-crimson [&_a]:underline [&_p]:m-0 [&_.small]:text-sm">{children}</div>}
        </div>
        {side && <div className="mt-4 shrink-0 lg:mt-0 lg:w-[300px]">{side}</div>}
      </header>
    );
  }
  return (
    <section className="relative overflow-hidden bg-crimson-deep text-paper" style={{ backgroundImage: "radial-gradient(60rem 28rem at 85% -10%, rgba(166,9,61,0.65), transparent 70%), linear-gradient(135deg, #4E0119 0%, #7A0328 100%)" }}>
      <div className={`relative mx-auto grid ${max} gap-10 px-4 ${compact ? "py-10 sm:py-12" : "py-16 sm:py-20"} sm:px-6 lg:px-8 ${art ? "lg:grid-cols-[1.3fr,0.7fr] lg:items-center" : ""}`}>
        <div>
          <span className="font-mono text-[11px] uppercase tracking-eyebrow text-paper/70">{eyebrow}</span>
          <h1 className="mt-4 font-display text-4xl leading-[1.08] text-paper sm:text-5xl">{title}</h1>
          {children && <div className="mt-5 max-w-2xl space-y-3 text-lg text-paper/85 [&_a]:!text-paper [&_a]:underline [&_p]:m-0 [&_.small]:text-sm [&_.small]:text-paper/70">{children}</div>}
          {side && <div className="mt-5 max-w-sm text-ink">{side}</div>}
        </div>
        {art && <div className="hidden justify-self-end lg:block">{art}</div>}
      </div>
    </section>
  );
}
