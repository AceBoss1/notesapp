"use client";

import { academyFaq } from "@/lib/academy-faq";
import Markdownish from "@/components/Markdownish";

// Questions, each opening on tap: the learners' ones (lib/academy-faq.ts) on every course page, or the list given (Notes Academy's
// own page adds the teachers' questions).
export default function AcademyFaq({ items, title = "Frequently asked questions", id = "faq", className = "mt-10" }: {
  items?: { q: string; a: string }[]; title?: string; id?: string; className?: string;
}) {
  return (
    <section className={className} aria-labelledby={id}>
      <h2 id={id} className="font-display text-2xl text-ink">{title}</h2>
      <div className="mt-3 divide-y divide-rule rounded-2xl border border-rule bg-card">
        {(items ?? academyFaq()).map((f) => (
          <details key={f.q} className="group px-4 py-3">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-ui text-[15px] font-semibold text-ink">
              {f.q}<span aria-hidden="true" className="shrink-0 text-slate transition-transform group-open:rotate-45">+</span>
            </summary>
            <div className="mt-2 text-sm leading-relaxed text-slate"><Markdownish text={f.a} /></div>
          </details>
        ))}
      </div>
    </section>
  );
}
