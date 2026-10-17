import Link from "next/link";
import type { ReactNode } from "react";

// The numbered list on Trending (Moda redesign): a big serif position, the title, a line under it, and the count.
export type RankedRow = { key: string; href: string; title: string; sub?: ReactNode; count: number; unit?: string };
export default function RankedList({ rows, start = 1 }: { rows: RankedRow[]; start?: number }) {
  return (
    <ol className="overflow-hidden rounded-2xl border border-rule bg-card px-4 sm:px-6">
      {rows.map((r, i) => (
        <li key={r.key} className="border-b border-rule last:border-b-0">
          <Link href={r.href} className="group flex items-center gap-4 py-5 sm:gap-6 sm:py-4">
            <span className="w-7 shrink-0 text-center font-display text-[2rem] leading-none text-crimson-bright sm:text-2xl">{start + i}</span>
            <span className="min-w-0 flex-1">
              <span className="block font-ui text-[17px] font-semibold leading-snug text-ink group-hover:text-crimson sm:text-[15px]">{r.title}</span>
              {r.sub && <span className="mt-1.5 block truncate text-[15px] text-slate sm:mt-0.5 sm:text-xs">{r.sub}</span>}
            </span>
            <span className="shrink-0 font-mono text-[15px] text-ink/80 sm:text-xs sm:text-slate">{r.count.toLocaleString("en-GB")}<span className="hidden sm:inline"> {r.unit ?? "views"}</span></span>
          </Link>
        </li>
      ))}
    </ol>
  );
}
