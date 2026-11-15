"use client";

import { createContext, useContext, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { jumpTo, type MenuGroup, type MenuPage } from "@/lib/side-menu";

// A frame with a grouped side menu, from the Moda redesigns (November 2026): Admin (components/admin/AdminShell.tsx) and My account
// (components/account/AccountShell.tsx). On a computer a sidebar: a way back, an optional label and "Jump to a page", then the groups
// (icon, how many pages, a chevron) that open to their pages, the open page as a crimson pill, and an optional footer (Day/Night, Sign out).
// On a phone a bar under the masthead says where you are ("My account / Money / Analytics") and opens the same menu as a drawer.

// What the page heading inside the frame shows above its title ("MY ACCOUNT · MONEY"); PageHero reads it and drops its crimson band.
export const ShellHead = createContext<{ eyebrow: string } | null>(null);
export const useShellHead = () => useContext(ShellHead);

const ICON: Record<string, React.ReactNode> = {
  Workspace: <path d="M4 5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5Zm9 3-4 6h5m0-6v9" />,
  Content: <path d="M5 4h14v16H5zM8 8h8M8 12h8M8 16h5" />,
  "People & Trust": <path d="M12 3 4.5 6v5.5c0 4.6 3.1 8.1 7.5 9.5 4.4-1.4 7.5-4.9 7.5-9.5V6L12 3Zm-3 9 2.2 2.2L15.5 10" />,
  Money: <path d="M4 7a2 2 0 0 1 2-2h11v4M4 7v10a2 2 0 0 0 2 2h14V9H6a2 2 0 0 1-2-2Zm12 7h.01" />,
  Growth: <path d="M4 4v16h16M7 15l4-4 3 3 5-6" />,
  Platform: <path d="M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm7.4 4.6.2-1.6-.2-1.6 1.8-1.4-2-3.4-2.1.8a7 7 0 0 0-2.8-1.6L14 2.6h-4l-.3 2.2A7 7 0 0 0 6.9 6.4l-2.1-.8-2 3.4 1.8 1.4-.2 1.6.2 1.6-1.8 1.4 2 3.4 2.1-.8a7 7 0 0 0 2.8 1.6l.3 2.2h4l.3-2.2a7 7 0 0 0 2.8-1.6l2.1.8 2-3.4-1.8-1.4Z" />,
  Admin: <path d="M14.7 6.3a4 4 0 0 0-5.4 5.2L3.5 17.3a1.4 1.4 0 0 0 2 2l5.8-5.8a4 4 0 0 0 5.2-5.4l-2.6 2.6-2-.5-.5-2 2.6-2.6Z" />,
  Profile: <path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 4.5a3 3 0 1 1 0 6 3 3 0 0 1 0-6ZM6.3 17.8c1.2-1.9 3.3-3 5.7-3s4.5 1.1 5.7 3" />,
  Store: <path d="M4 9.5 5.5 4h13L20 9.5M4 9.5V20h16V9.5M4 9.5c0 1.4 1.1 2.5 2.7 2.5S9.3 10.9 9.3 9.5c0 1.4 1.2 2.5 2.7 2.5s2.7-1.1 2.7-2.5c0 1.4 1.1 2.5 2.6 2.5S20 10.9 20 9.5M10 20v-5h4v5" />,
};
export function GroupIcon({ name, className = "h-[18px] w-[18px]" }: { name: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`shrink-0 ${className}`}>
      {ICON[name] ?? <circle cx="12" cy="12" r="7" />}
    </svg>
  );
}
export const Chevron = ({ open, className = "" }: { open: boolean; className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`h-3.5 w-3.5 shrink-0 transition-transform ${open ? "-rotate-90" : ""} ${className}`}>
    <path d="m9 6 6 6-6 6" />
  </svg>
);
const SearchIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden="true" className="h-3.5 w-3.5 shrink-0"><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></svg>
);

function Menu({ groups, pages, active, search, onNavigate }: { groups: MenuGroup[]; pages: MenuPage[]; active?: MenuPage; search?: boolean; onNavigate?: () => void }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<Record<string, boolean>>({});
  // The open page's group starts open (and opens again when you move to a page in another group).
  useEffect(() => { if (active) setOpen((o) => ({ ...o, [active.group]: true })); }, [active]);
  const hits = search ? jumpTo(pages, q) : [];

  return (
    <div className="font-ui">
      {search && (
        <label className="mb-3 flex items-center gap-2 rounded-[10px] border border-rule bg-paper px-3 py-2.5 text-slate focus-within:border-crimson">
          <SearchIcon />
          <input
            type="text" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Jump to a page" aria-label="Jump to a page"
            className="min-w-0 flex-1 bg-transparent text-[13px] text-ink outline-none placeholder:text-slate/80"
            onKeyDown={(e) => { if (e.key === "Enter" && hits[0]) window.location.assign(hits[0].href); }}
          />
        </label>
      )}

      {search && q.trim() ? (
        <ul className="space-y-0.5" aria-label="Pages found">
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
        <ul className="space-y-1">
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

export default function SideShell({
  title, crumbTitle, pages, groups, active, crumb, back, label, search, footer, eyebrow, heading = "line", width = "17rem", children,
}: {
  title: string; // "Admin", "My account": the drawer's title and what the phone bar says when no page is open
  crumbTitle?: boolean; // the phone bar starts with the title ("My account / Money / Analytics")
  pages: MenuPage[]; groups: MenuGroup[]; active?: MenuPage;
  crumb?: { group?: string; label?: string }; // the phone bar, when it isn't the open menu page
  back: { href: string; label: string };
  label?: string; // a small label over the groups ("MY ACCOUNT")
  search?: boolean; // "Jump to a page"
  footer?: React.ReactNode; // the bottom of the sidebar and the drawer
  eyebrow?: string; // over the page: "Admin · People & Trust"
  heading?: "line" | "hero"; // "line": the eyebrow is a line over the page; "hero": PageHero shows it, in place of its crimson band
  width?: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [drawer, setDrawer] = useState(false);
  useEffect(() => { setDrawer(false); }, [pathname]);
  useEffect(() => {
    if (!drawer) return;
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setDrawer(false); };
    document.addEventListener("keydown", esc);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", esc); document.body.style.overflow = prev; };
  }, [drawer]);
  const where = crumb ?? (active ? { group: active.group, label: active.label } : {});
  const id = `${title.toLowerCase().replace(/\W+/g, "-")}-drawer`;
  const menu = (onNavigate?: () => void) => (
    <>
      {label && !onNavigate && <p className="mb-2 px-1 font-mono text-xs font-medium uppercase tracking-[0.12em] text-crimson-bright">{label}</p>}
      <Menu groups={groups} pages={pages} active={active} search={search} onNavigate={onNavigate} />
    </>
  );

  return (
    <div className="lg:grid" style={{ gridTemplateColumns: `${width} minmax(0,1fr)` }}>
      {/* Computers: the sidebar */}
      <aside aria-label={title} className="hidden border-r border-rule bg-card lg:sticky lg:top-[4.5rem] lg:flex lg:h-[calc(100vh-4.5rem)] lg:flex-col lg:overflow-y-auto">
        <div className="flex flex-1 flex-col px-4 pb-6 pt-5">
          <Link href={back.href} className="mb-3 flex items-center gap-2 px-3 font-ui text-[13px] text-slate hover:text-crimson">
            <Chevron open={false} className="rotate-180" /> {back.label}
          </Link>
          {menu()}
          {footer && <div className="mt-auto pt-6">{footer}</div>}
        </div>
      </aside>

      {/* Beside the menu, a page's own centred boxes sit at the left, as in the designs. */}
      <div className="min-w-0 lg:[&>.mx-auto]:ml-0">
        {/* Phones and tablets: where you are, opening the menu */}
        <button
          type="button" onClick={() => setDrawer(true)} aria-expanded={drawer} aria-controls={id}
          className="flex w-full items-center gap-2.5 border-b border-rule bg-card px-4 py-3 text-left font-ui text-sm lg:hidden"
        >
          <GroupIcon name={where.group ?? groups[0]?.name ?? ""} className="h-4 w-4 text-crimson-bright" />
          <span className="min-w-0 flex-1 truncate text-slate">
            {where.label
              ? <>{[crumbTitle ? title : "", where.group].filter(Boolean).map((x) => `${x} / `).join("")}<span className="font-semibold text-ink">{where.label}</span></>
              : <span className="font-semibold text-ink">{title}</span>}
          </span>
          <span className="sr-only">Open the {title} menu</span>
          <Chevron open={false} className="rotate-90 text-slate" />
        </button>

        <ShellHead.Provider value={heading === "hero" && eyebrow ? { eyebrow } : null}>
          {heading === "line" && eyebrow && (
            <p className="mx-auto max-w-5xl px-4 pt-6 font-mono text-xs font-medium uppercase tracking-[0.12em] text-crimson-bright sm:px-6 lg:pt-9">{eyebrow}</p>
          )}
          {children}
        </ShellHead.Provider>
      </div>

      {/* The drawer */}
      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label={`${title} menu`} id={id}>
          <button type="button" aria-label={`Close the ${title} menu`} onClick={() => setDrawer(false)} className="absolute inset-0 bg-ink/40" />
          <div className="absolute inset-y-0 left-0 flex w-[82%] max-w-[22rem] flex-col overflow-y-auto bg-card px-3 pb-8 pt-4 shadow-2xl">
            <div className="mb-4 flex items-center gap-2.5 px-1">
              <Image src="/images/brand/notesapp-icon.webp" alt="" width={32} height={32} className="h-8 w-8 rounded-lg" />
              <span className="flex-1 font-ui text-base font-bold text-ink">{title}</span>
              <button type="button" onClick={() => setDrawer(false)} aria-label={`Close the ${title} menu`} className="flex h-9 w-9 items-center justify-center rounded-full text-ink hover:bg-field">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden="true" className="h-5 w-5"><path d="M6 6l12 12M18 6 6 18" /></svg>
              </button>
            </div>
            {menu(() => setDrawer(false))}
            <Link href={back.href} className="mt-6 px-3 font-ui text-[13px] text-slate hover:text-crimson">← {back.label}</Link>
            {footer && <div className="mt-6">{footer}</div>}
          </div>
        </div>
      )}
    </div>
  );
}
