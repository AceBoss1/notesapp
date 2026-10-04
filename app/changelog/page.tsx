import type { Metadata } from "next";
import { CHANGELOG, ChangeKind } from "@/lib/changelog";

export const metadata: Metadata = {
  title: "Changelog",
  description: "All notable changes to #NotesApp, newest first.",
};

const KIND: Record<ChangeKind, { label: string; cls: string }> = {
  added: { label: "Added", cls: "bg-emerald-100 text-emerald-900" },
  changed: { label: "Changed", cls: "bg-amber-100 text-amber-900" },
  fixed: { label: "Fixed", cls: "bg-sky-100 text-sky-900" },
};

const fmt = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

export default function ChangelogPage() {
  return (
    <section className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <span className="eyebrow">What&apos;s new</span>
      <h1 className="mt-3 font-display text-4xl text-ink sm:text-5xl">Changelog</h1>
      <p className="mt-4 text-lg text-slate">
        All notable changes to #NotesApp, newest first. Versions go up by <strong>major</strong> (something existing changed), <strong>minor</strong> (new features) or <strong>patch</strong> (fixes).
      </p>

      <ol className="mt-12 space-y-12 border-l border-rule pl-6 sm:pl-8">
        {CHANGELOG.map((r) => (
          <li key={r.version} className="relative">
            <span className="absolute -left-[calc(1.5rem+5px)] top-2 h-2.5 w-2.5 rounded-full border-2 border-crimson bg-paper sm:-left-[calc(2rem+5px)]" aria-hidden="true" />
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="font-display text-2xl text-ink">{r.version}</h2>
              <span className="rounded-full bg-ink px-2.5 py-0.5 font-ui text-xs font-semibold text-paper">{r.bump}</span>
              <time dateTime={r.date} className="font-mono text-sm text-slate">{r.date}</time>
            </div>
            <ul className="card mt-4 divide-y divide-rule">
              {r.changes.map((c, i) => (
                <li key={i} className="flex items-start gap-3 px-4 py-3">
                  <span className={`mt-0.5 shrink-0 rounded-md px-2 py-0.5 font-ui text-[11px] font-bold uppercase tracking-wide ${KIND[c.kind].cls}`}>{KIND[c.kind].label}</span>
                  <p className="text-sm text-ink">{c.text}</p>
                </li>
              ))}
            </ul>
            <span className="sr-only">Released {fmt(r.date)}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
