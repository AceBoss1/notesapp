"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import type { SocialLinks } from "@/lib/admin";
import { linkText, profileLinks } from "@/components/SocialLinksRow";
import { PencilIcon } from "./icons";

// A profile's About sections (the All tab): each with its title and, on your own profile only, a pencil to Edit profile at that part.
// Rows are icon + words; a section with nothing in it is left out for visitors, and on your own profile it says what you could add.
export type AboutRow = { key: string; icon: ReactNode; text: string; sub?: string };

export function AboutSection({ title, editHref, editLabel, children }: { title: string; editHref?: string; editLabel?: string; children: ReactNode }) {
  return (
    <section className="card p-4 sm:p-5" aria-label={title}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-ui text-[17px] font-bold text-ink">{title}</h2>
        {editHref && (
          <Link href={editHref} aria-label={editLabel ?? `Edit ${title.toLowerCase()}`} title={editLabel ?? `Edit ${title.toLowerCase()}`}
            className="-mr-1.5 flex h-9 w-9 items-center justify-center rounded-full text-slate hover:bg-field hover:text-crimson">
            <PencilIcon className="h-[18px] w-[18px]" />
          </Link>
        )}
      </div>
      <div className="mt-2">{children}</div>
    </section>
  );
}

function Rows({ rows }: { rows: AboutRow[] }) {
  return (
    <ul className="grid gap-2.5">
      {rows.map((r) => (
        <li key={r.key} className="flex items-start gap-3 text-[15px] text-ink">
          <span className="mt-0.5 shrink-0 text-slate">{r.icon}</span>
          <span className="min-w-0 break-words">{r.text}{r.sub && <span className="block text-xs text-slate">{r.sub}</span>}</span>
        </li>
      ))}
    </ul>
  );
}

const addLink = "inline-flex rounded-full border border-dashed border-crimson/50 px-4 py-1.5 font-ui text-xs font-semibold text-crimson hover:bg-crimson/5";

export default function ProfileAbout({ own, details, work, social, extra }: {
  own: boolean;
  details: AboutRow[];
  work: AboutRow[];
  social?: SocialLinks;
  extra?: ReactNode; // anything else the page adds under the sections
}) {
  const [allLinks, setAllLinks] = useState(false);
  const links = profileLinks(social);
  const shown = allLinks ? links : links.slice(0, 1);
  return (
    <div className="grid gap-3">
      {details.length > 0 && (
        <AboutSection title="Details" editHref={own ? "/profile/edit" : undefined} editLabel="Edit profile">
          <Rows rows={details} />
        </AboutSection>
      )}
      {(work.length > 0 || own) && (
        <AboutSection title="Work" editHref={own ? "/profile/edit#work" : undefined} editLabel="Edit your work">
          {work.length > 0 ? <Rows rows={work} /> : <Link href="/profile/edit#work" className={addLink}>+ Add what you do and where</Link>}
        </AboutSection>
      )}
      {(links.length > 0 || own) && (
        <AboutSection title="Links" editHref={own ? "/profile/edit#links" : undefined} editLabel="Edit your social links">
          {links.length > 0 ? (
            <ul className="grid gap-2.5">
              {shown.map((l) => (
                <li key={l.key} className="flex min-w-0 items-center gap-3 text-[15px]">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center text-slate [&_svg]:h-[18px] [&_svg]:w-[18px]">{l.icon}</span>
                  <a href={l.href} target="_blank" rel="noopener noreferrer nofollow" className="min-w-0 truncate font-semibold text-crimson hover:underline underline-offset-2" title={l.label}>{linkText(l.key, l.href)}</a>
                </li>
              ))}
              {links.length > 1 && (
                <li>
                  <button type="button" onClick={() => setAllLinks((x) => !x)} aria-expanded={allLinks} className="rounded-full bg-field px-3 py-1 font-ui text-xs font-semibold text-ink hover:text-crimson">
                    {allLinks ? "Show fewer" : `+ ${links.length - 1} more`}
                  </button>
                </li>
              )}
            </ul>
          ) : <Link href="/profile/edit#links" className={addLink}>+ Add your social links</Link>}
        </AboutSection>
      )}
      {extra}
    </div>
  );
}
