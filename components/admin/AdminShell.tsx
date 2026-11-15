"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { adminAccess } from "@/lib/admin-claims";
import { activeSection, allowedSections, groupSections, jumpMatches, type Access, type AdminGroup as Group, type Section } from "@/lib/admin-access";

// The admin area's frame (owner, 15 Nov 2026, the Moda "Admin Dashboard Redesign"): on a computer a sidebar with Back to site, "Jump to
// a page", and the menu groups (icon, how many pages, a chevron) that open to their pages, the open page as a crimson pill; the page has
// "ADMIN · <GROUP>" above it. On a phone a bar under the masthead says where you are ("People & Trust / Throwaway emails") and opens the
// same menu as a drawer. Only staff see it, and only the pages their role covers; never on the login page.

const ICON: Record<string, React.ReactNode> = {
  Workspace: <path d="M4 5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5Zm9 3-4 6h5m0-6v9" />,
  Content: <path d="M5 4h14v16H5zM8 8h8M8 12h8M8 16h5" />,
  "People & Trust": <path d="M12 3 4.5 6v5.5c0 4.6 3.1 8.1 7.5 9.5 4.4-1.4 7.5-4.9 7.5-9.5V6L12 3Zm-3 9 2.2 2.2L15.5 10" />,
  Money: <path d="M4 7a2 2 0 0 1 2-2h11v4M4 7v10a2 2 0 0 0 2 2h14V9H6a2 2 0 0 1-2-2Zm12 7h.01" />,
  Growth: <path d="M4 4v16h16M7 15l4-4 3 3 5-6" />,
  Platform: <path d="M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm7.4 4.6.2-1.6-.2-1.6 1.8-1.4-2-3.4-2.1.8a7 7 0 0 0-2.8-1.6L14 2.6h-4l-.3 2.2A7 7 0 0 0 6.9 6.4l-2.1-.8-2 3.4 1.8 1.4-.2 1.6.2 1.6-1.8 1.4 2 3.4 2.1-.8a7 7 0 0 0 2.8 1.6l.3 2.2h4l.3-2.2a7 7 0 0 0 2.8-1.6l2.1.8 2-3.4-1.8-1.4Z" />,
  Admin: <path d="M14.7 6.3a4 4 0 0 0-5.4 5.2L3.5 17.3a1.4 1.4 0 0 0 2 2l5.8-5.8a4 4 0 0 0 5.2-5.4l-2.6 2.6-2-.5-.5-2 2.6-2.6Z" />,
};
export function GroupIcon({ name, className = "h-[18px] w-[18px]" }: { name: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`shrink-0 ${className}`}>
      {ICON[name] ?? <circle cx="12" cy="12" r="7" />}
    </svg>
  );
}
const Chevron = ({ open, className = "" }: { open: boolean; className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`h-3.5 w-3.5 shrink-0 transition-transform ${open ? "-rotate-90" : ""} ${className}`}>
    <path d="m9 6 6 6-6 6" />
  </svg>
);
const SearchIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden="true" className="h-3.5 w-3.5 shrink-0"><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></svg>
);

function Menu({ groups, sections, active, onNavigate }: { groups: Group[]; sections: Section[]; active?: Section; onNavigate?: () => void }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<Record<string, boolean>>({});
  // The open page's group starts open (and opens again when you move to a page in another group).
  useEffect(() => { if (active) setOpen((o) => ({ ...o, [active.group]: true })); }, [active]);
  const hits = jumpMatches(sections, q);

  return (
    <div className="font-ui">
      <label className="flex items-center gap-2 rounded-[10px] border border-rule bg-paper px-3 py-2.5 text-slate focus-within:border-crimson">
        <SearchIcon />
        <input
          type="text" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Jump to a page" aria-label="Jump to a page"
          className="min-w-0 flex-1 bg-transparent text-[13px] text-ink outline-none placeholder:text-slate/80"
          onKeyDown={(e) => { if (e.key === "Enter" && hits[0]) { window.location.assign(hits[0].href); } }}
        />
      </label>

      {q.trim() ? (
        <ul className="mt-3 space-y-0.5" aria-label="Pages found">
          {hits.length === 0 && <li className="px-3 py-2 text-[13px] text-slate">No page called that.</li>}
          {hits.map((s) => (
            <li key={s.href}>
              <Link href={s.href} onClick={() => { setQ(""); onNavigate?.(); }} className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-ink hover:bg-field">
                <GroupIcon name={s.group} className="h-4 w-4 text-slate" />
                <span className="min-w-0 flex-1 truncate">{s.label}</span>
                <span className="font-mono text-[10px] uppercase tracking-eyebrow text-slate">{s.group}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <ul className="mt-3 space-y-1">
          {groups.map((g) => {
            const here = active?.group === g.name;
            const isOpen = !!open[g.name];
            return (
              <li key={g.name}>
                <button
                  type="button" aria-expanded={isOpen} onClick={() => setOpen((o) => ({ ...o, [g.name]: !isOpen }))}
                  className={`flex h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-sm ${here ? "font-semibold text-crimson-bright" : "font-medium text-ink hover:bg-field"} ${here && !isOpen ? "bg-crimson-bright/10" : ""}`}
                >
                  <GroupIcon name={g.name} className={`h-[18px] w-[18px] ${here ? "text-crimson-bright" : "text-slate"}`} />
                  <span className="min-w-0 flex-1 truncate">{g.name}</span>
                  <span className={`font-mono text-xs ${here ? "text-crimson-bright" : "text-slate/80"}`}>{g.pages.length}</span>
                  <Chevron open={isOpen} className={here ? "text-crimson-bright" : "text-slate/80"} />
                </button>
                {isOpen && (
                  <ul className="mt-1 space-y-1">
                    {g.pages.map((s) => {
                      const on = s === active;
                      return (
                        <li key={s.href}>
                          <Link
                            href={s.href} aria-current={on ? "page" : undefined} onClick={onNavigate}
                            className={`flex h-[34px] items-center rounded-lg pl-10 pr-3 text-sm ${on ? "bg-crimson-bright font-semibold text-white" : "text-slate hover:bg-field hover:text-ink"}`}
                          >
                            <span className="truncate">{s.label}</span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [access, setAccess] = useState<Access | null>(null);
  const [drawer, setDrawer] = useState(false);
  useEffect(() => onAuthStateChanged(auth, async (u) => setAccess(await adminAccess(u))), []);
  const sections = useMemo(() => allowedSections(access), [access]);
  const groups = useMemo(() => groupSections(sections), [sections]);
  const active = activeSection(sections, pathname);
  useEffect(() => { setDrawer(false); }, [pathname]);
  useEffect(() => {
    if (!drawer) return;
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setDrawer(false); };
    document.addEventListener("keydown", esc);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", esc); document.body.style.overflow = prev; };
  }, [drawer]);

  if (!access || pathname.startsWith("/admin/login")) return <>{children}</>;

  return (
    <div className="lg:grid lg:grid-cols-[17rem,minmax(0,1fr)]">
      {/* Computers: the sidebar */}
      <aside aria-label="Admin" className="hidden border-r border-rule bg-card lg:sticky lg:top-[4.5rem] lg:block lg:h-[calc(100vh-4.5rem)] lg:overflow-y-auto">
        <div className="px-4 pb-8 pt-5">
          <Link href="/" className="mb-3 flex items-center gap-2 px-3 font-ui text-[13px] text-slate hover:text-crimson">
            <Chevron open={false} className="rotate-180" /> Back to site
          </Link>
          <Menu groups={groups} sections={sections} active={active} />
        </div>
      </aside>

      <div className="min-w-0">
        {/* Phones and tablets: where you are, opening the menu */}
        <button
          type="button" onClick={() => setDrawer(true)} aria-expanded={drawer} aria-controls="admin-drawer"
          className="flex w-full items-center gap-2.5 border-b border-rule bg-card px-4 py-3 text-left font-ui text-sm lg:hidden"
        >
          <GroupIcon name={active?.group ?? "Workspace"} className="h-4 w-4 text-crimson-bright" />
          <span className="min-w-0 flex-1 truncate text-slate">
            {active ? <>{active.group} / <span className="font-semibold text-ink">{active.label}</span></> : <span className="font-semibold text-ink">Admin</span>}
          </span>
          <span className="sr-only">Open the admin menu</span>
          <Chevron open={true} className="text-slate" />
        </button>

        {active && (
          <p className="mx-auto max-w-5xl px-4 pt-6 font-mono text-xs font-medium uppercase tracking-[0.12em] text-crimson-bright sm:px-6 lg:pt-9">
            Admin · {active.group}
          </p>
        )}
        {children}
      </div>

      {/* The drawer */}
      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Admin menu" id="admin-drawer">
          <button type="button" aria-label="Close the admin menu" onClick={() => setDrawer(false)} className="absolute inset-0 bg-ink/40" />
          <div className="absolute inset-y-0 left-0 flex w-[82%] max-w-[22rem] flex-col overflow-y-auto bg-card px-3 pb-8 pt-4 shadow-2xl">
            <div className="mb-4 flex items-center gap-2.5 px-1">
              <Image src="/images/brand/notesapp-icon.webp" alt="" width={32} height={32} className="h-8 w-8 rounded-lg" />
              <span className="flex-1 font-ui text-base font-bold text-ink">Admin</span>
              <button type="button" onClick={() => setDrawer(false)} aria-label="Close the admin menu" className="flex h-9 w-9 items-center justify-center rounded-full text-ink hover:bg-field">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden="true" className="h-5 w-5"><path d="M6 6l12 12M18 6 6 18" /></svg>
              </button>
            </div>
            <Menu groups={groups} sections={sections} active={active} onNavigate={() => setDrawer(false)} />
            <Link href="/" className="mt-6 px-3 font-ui text-[13px] text-slate hover:text-crimson">← Back to site</Link>
          </div>
        </div>
      )}
    </div>
  );
}
