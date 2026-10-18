"use client";

import { academyFaq } from "@/lib/academy-faq";
import Markdownish from "@/components/Markdownish";

// The course page's questions (lib/academy-faq.ts), each opening on tap.
export default function AcademyFaq() {
  return (
    <section className="mt-10" aria-labelledby="faq">
      <h2 id="faq" className="font-display text-2xl text-ink">Frequently asked questions</h2>
      <div className="mt-3 divide-y divide-rule rounded-2xl border border-rule bg-card">
        {academyFaq().map((f) => (
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
