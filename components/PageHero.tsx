import type { ReactNode } from "react";

// The crimson band at the top of the main pages (About, Pricing, Help …): a deep crimson with a soft glow, a small label, a serif headline
// and an intro. `art` sits on the right on wide screens (for example Nana). Content goes below it in the page itself.
export default function PageHero({ eyebrow, title, children, art, max = "max-w-6xl" }: { eyebrow: string; title: ReactNode; children?: ReactNode; art?: ReactNode; max?: string }) {
  return (
    <section className="relative overflow-hidden bg-crimson-deep text-paper" style={{ backgroundImage: "radial-gradient(60rem 28rem at 85% -10%, rgba(166,9,61,0.65), transparent 70%), linear-gradient(135deg, #4E0119 0%, #7A0328 100%)" }}>
      <div className={`relative mx-auto grid ${max} gap-10 px-4 py-16 sm:px-6 sm:py-20 lg:px-8 ${art ? "lg:grid-cols-[1.3fr,0.7fr] lg:items-center" : ""}`}>
        <div>
          <span className="font-mono text-[11px] uppercase tracking-eyebrow text-paper/70">{eyebrow}</span>
          <h1 className="mt-4 font-display text-4xl leading-[1.08] text-paper sm:text-5xl">{title}</h1>
          {children && <div className="mt-5 max-w-2xl space-y-3 text-lg text-paper/85 [&_a]:!text-paper [&_a]:underline [&_p]:m-0 [&_.small]:text-sm [&_.small]:text-paper/70">{children}</div>}
        </div>
        {art && <div className="hidden justify-self-end lg:block">{art}</div>}
      </div>
    </section>
  );
}
