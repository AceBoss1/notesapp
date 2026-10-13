import Image from "next/image";
import Link from "next/link";

// One card for the coming game, used on the home, About and Roadmap pages. Links to the Notes Life page (also served at life.notesapp.name.ng).
export default function NotesLifeCard({ className = "" }: { className?: string }) {
  return (
    <Link href="/life" className={`group block overflow-hidden rounded-3xl border border-rule bg-gradient-to-br from-sky-100 via-emerald-50 to-amber-50 shadow-sm transition hover:shadow-lg ${className}`}>
      <div className="grid items-center gap-0 sm:grid-cols-[1.1fr,0.9fr]">
        <div className="p-6 sm:p-8">
          <p className="font-mono text-[11px] uppercase tracking-eyebrow text-emerald-700"><span className="mr-2 inline-block h-2 w-2 rounded-full bg-amber-400" aria-hidden="true" />Coming soon · a NotesApp game</p>
          <h2 className="mt-2 font-display text-3xl text-ink sm:text-4xl">Notes Life</h2>
          <p className="mt-2 max-w-md text-sm text-slate">Start in a face-me-I-face-you room in your own city. Get a job, decorate, call your friends, shop real NotesApp stores and climb the Billionaires List, with your NotesApp account.</p>
          <span className="mt-4 inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 font-ui text-sm font-bold text-paper group-hover:bg-crimson">See Notes Life →</span>
        </div>
        <div className="relative h-56 sm:h-full sm:min-h-[16rem]">
          <Image src="/images/life/room-desktop.webp" alt="An early mockup of Notes Life: a small room in Lagos with a bed, a sofa, a stove and a water drum" fill sizes="(min-width: 640px) 40vw, 100vw" className="object-cover" />
        </div>
      </div>
    </Link>
  );
}
