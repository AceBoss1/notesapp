import Link from "next/link";

export default function AdvertisePage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
      <span className="eyebrow">Coming Soon</span>
      <h1 className="mt-4 font-display text-4xl text-ink sm:text-5xl">
        Advertise on #NotesApp
      </h1>
      <p className="mt-5 text-lg text-slate">
        Ads on #NotesApp come with a revenue share built in from day
        one — not something a professional has to unlock, earn, or
        wait for.
      </p>

      <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-3">
        <div className="card p-6">
          <p className="font-mono text-xs uppercase tracking-eyebrow text-crimson-bright">
            Free journals
          </p>
          <p className="mt-3 font-display text-2xl text-ink">Ads shown</p>
          <p className="mt-2 text-sm text-slate">No revenue share.</p>
        </div>
        <div className="card p-6 !border-crimson">
          <p className="font-mono text-xs uppercase tracking-eyebrow text-crimson-bright">
            Pro tier
          </p>
          <p className="mt-3 font-display text-2xl text-ink">25% ad share</p>
          <p className="mt-2 text-sm text-slate">
            If you opt in to showing ads on your pages.
          </p>
        </div>
        <div className="card p-6 !border-crimson">
          <p className="font-mono text-xs uppercase tracking-eyebrow text-crimson-bright">
            Business tier
          </p>
          <p className="mt-3 font-display text-2xl text-ink">45% ad share</p>
          <p className="mt-2 text-sm text-slate">
            If you opt in to showing ads on your pages.
          </p>
        </div>
      </div>

      <div className="card mt-10 p-7">
        <p className="font-ui text-base font-bold text-ink">
          No gated conditions
        </p>
        <p className="mt-2 text-sm text-slate">
          Most platforms make you hit a follower count, a view
          threshold, or an approval process before you can earn from
          ads. #NotesApp's Pro and Business tiers get their ad share
          from the day they opt in — no waiting period, no audience
          minimum.
        </p>
      </div>

      <div className="card mt-6 p-7">
        <p className="font-ui text-base font-bold text-ink">
          Who can buy an ad
        </p>
        <p className="mt-2 text-sm text-slate">
          Anyone — a #NotesApp user or not, on the free tier or a paid
          one. Advertising on the platform isn't restricted to members.
        </p>
      </div>

      <p className="mt-10 text-sm text-slate">
        This is a roadmap commitment, not a live feature yet — nothing
        here is wired up for real ad placements or payouts. Want early
        access when it ships?{" "}
        <Link href="/contact" className="text-crimson underline underline-offset-2">
          Get in touch
        </Link>
        .
      </p>
    </div>
  );
}
