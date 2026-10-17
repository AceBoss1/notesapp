import Link from "next/link";
import type { ReactNode } from "react";

// A numbered list for Most viewed and Trending: position, title, a line under it, and the count.
export type RankedRow = { key: string; href: string; title: string; sub?: ReactNode; count: number; unit?: string; image?: string };
export default function RankedList({ rows, start = 1 }: { rows: RankedRow[]; start?: number }) {
  return (
    <ol className="divide-y divide-rule overflow-hidden rounded-lg border border-rule bg-card">
      {rows.map((r, i) => (
        <li key={r.key}>
          <Link href={r.href} className="flex items-center gap-4 px-4 py-3 hover:bg-paper">
            <span className="w-7 flex-shrink-0 text-center font-display text-2xl text-crimson">{start + i}</span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {r.image && <img src={r.image} alt="" className="h-11 w-11 flex-shrink-0 rounded object-cover" />}
            <span className="min-w-0 flex-1">
              <span className="block truncate font-ui text-sm font-semibold text-ink">{r.title}</span>
              {r.sub && <span className="block truncate text-xs text-slate">{r.sub}</span>}
            </span>
            <span className="flex-shrink-0 font-mono text-xs text-slate">{r.count.toLocaleString("en-GB")} {r.unit ?? "views"}</span>
          </Link>
        </li>
      ))}
    </ol>
  );
}
