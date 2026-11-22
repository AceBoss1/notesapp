"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { canPublish } from "@/lib/users";
import { useMember } from "@/lib/member-client";
import { MESSAGES_LIVE } from "@/lib/moments-rules";
import { WALLET_LIVE } from "@/lib/wallet";
import { useCycleMenu } from "@/lib/cycle-client";
import { useCalendarToday } from "@/components/calendar/useCalendarToday";
import { useGoLive } from "@/components/lives/useGoLive";
import ThemeSwitch from "@/components/theme/ThemeSwitch";
import Avatar from "@/components/Avatar";
import { NameBadgeIcons } from "@/components/PersonName";
import { PINNED_KEY, RECENT_KEY, accountMenu, allPlaces, forget, pin, pushRecent, shortcutsFrom, unpin, type MenuItem, type MenuSection } from "@/lib/account-menu";
import { MenuGlyph } from "./menuIcons";

type L = { href: string; label: string };
type Run = { id: string; name: string; avatar: string; memberCount: number; role: string };
type Managed = { uid: string; username: string; name: string; avatar: string; org: boolean; role: "admin" | "manager" | "cashier"; store: boolean };
const ROLE_LABEL: Record<Managed["role"], string> = { admin: "Admin", manager: "Manager", cashier: "Cashier" };
// Where you can work for an organisation or business you help run; each page checks the role again.
const workLinks = (m: Managed): { href: string; label: string }[] => [
  { href: `/profile/books?owner=${m.uid}`, label: "Books" },
  ...(m.role !== "cashier" ? [{ href: `/profile/inventory?owner=${m.uid}`, label: "Inventory" }] : []),
  ...(m.role === "admin" && m.org ? [{ href: `/organisation/team?org=${m.uid}`, label: "Team" }, { href: `/profile/jobs?org=${m.uid}`, label: "Jobs" }] : []),
];

// The account menu's body (lib/account-menu.ts), shared by the phone sheet and the computer's menu: your profile (▾ switches to a
// community you run, your store or your organisation), your shortcuts, eight tiles and "See more", the sections that fold, Sign out.
export default function AccountMenu({ onNavigate, siteLinks = [] }: { onNavigate?: () => void; siteLinks?: L[] }) {
  const { user, profile, unreadDms } = useMember();
  const goLive = useGoLive();
  const cycle = useCycleMenu(user ?? null, profile?.accountKind === "organisation");
  const calToday = useCalendarToday(user ?? null);
  const [more, setMore] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [switcher, setSwitcher] = useState(false);
  const [runs, setRuns] = useState<Run[] | null>(null);
  const [managed, setManaged] = useState<Managed[]>([]);
  // While the menu is open, Nana's bubble slides off the screen (components/NanaChat.tsx reads this), so it never covers Sign out.
  useEffect(() => {
    const el = document.documentElement;
    el.dataset.menuOpen = "1";
    return () => { delete el.dataset.menuOpen; };
  }, []);
  const [recent, setRecent] = useState<string[]>([]);
  const [pinned, setPinned] = useState<string[]>([]);
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    const read = (k: string) => { try { const r = JSON.parse(localStorage.getItem(k) || "[]"); return Array.isArray(r) ? r.filter((x): x is string => typeof x === "string") : []; } catch { return []; } };
    setRecent(read(RECENT_KEY)); setPinned(read(PINNED_KEY));
  }, []);
  const save = (k: string, v: string[]) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* no storage: it lasts for this visit */ } };
  const setPins = (v: string[]) => { setPinned(v); save(PINNED_KEY, v); };
  const setRecents = (v: string[]) => { setRecent(v); save(RECENT_KEY, v); };

  const menu = useMemo(() => {
    const m = accountMenu({
      username: profile?.username ?? null, canPublish: !!profile && canPublish(profile), isOrg: profile?.accountKind === "organisation",
      goLive: !!goLive, cycle: !!cycle, calToday: calToday ?? 0, wallet: WALLET_LIVE, messages: MESSAGES_LIVE, unreadDms,
    });
    // The site's own links (Journals, Pricing, About…) join "More from #NotesApp" where they aren't there already.
    const apps = m.sections.find((s) => s.key === "apps");
    if (apps) for (const l of siteLinks) if (![...m.tiles, ...m.more, ...m.sections.flatMap((s) => s.items)].some((i) => i.href === l.href)) apps.items.push({ href: l.href, label: l.label, icon: "link" });
    return m;
  }, [profile, goLive, cycle, calToday, unreadDms, siteLinks]);
  const shortcuts = shortcutsFrom(recent, menu, pinned);
  const addable = allPlaces(menu).filter((i) => !pinned.includes(i.href));

  const went = (href: string) => {
    setRecents(pushRecent(recent, href));
    onNavigate?.();
  };
  const openSwitcher = async () => {
    setSwitcher((s) => !s);
    if (runs || !user) return;
    const headers = { Authorization: `Bearer ${await user.getIdToken()}` };
    const [c, m] = await Promise.all([
      fetch("/api/community?run=1", { headers }).then((r) => r.json()).catch(() => ({})),
      fetch("/api/account/managed", { headers }).then((r) => r.json()).catch(() => ({})),
    ]);
    setManaged(Array.isArray(m.accounts) ? m.accounts : []);
    setRuns(Array.isArray(c.communities) ? c.communities : []);
  };

  const tile = (i: MenuItem) => (
    <Link key={i.href} href={i.href} onClick={() => went(i.href)} className="relative flex flex-col gap-2 rounded-2xl border border-rule bg-card px-4 py-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition hover:border-crimson/40 hover:bg-paper">
      <MenuGlyph name={i.icon} className="h-6 w-6 text-ink" />
      <span className="font-ui text-[15px] font-semibold leading-tight text-ink">{i.label}</span>
      {!!i.badge && <span className="absolute right-3 top-3 rounded-full bg-crimson px-1.5 py-0.5 font-mono text-[11px] font-bold text-paper">{i.badge}</span>}
      {i.note && <span className="absolute right-3 top-3 rounded-full bg-crimson/10 px-1.5 py-0.5 text-[10px] font-bold text-crimson">{i.note}</span>}
    </Link>
  );
  const row = (i: MenuItem) => (
    <Link key={i.href} href={i.href} onClick={() => went(i.href)} className="flex items-center gap-3 rounded-xl px-3 py-2.5 font-ui text-[15px] text-ink hover:bg-paper">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-rule bg-card"><MenuGlyph name={i.icon} className="h-5 w-5" /></span>{i.label}
    </Link>
  );
  const section = (s: MenuSection) => (
    <div key={s.key} className="border-t border-rule">
      <button type="button" onClick={() => setOpen(open === s.key ? null : s.key)} aria-expanded={open === s.key} className="flex w-full items-center gap-3 px-4 py-3.5 text-left font-ui text-base font-bold text-ink hover:bg-paper">
        <MenuGlyph name={s.icon} className="h-6 w-6" />
        <span className="flex-1">{s.label}</span>
        <MenuGlyph name="chevron" className={`h-5 w-5 text-slate transition-transform ${open === s.key ? "rotate-180" : ""}`} />
      </button>
      {open === s.key && (
        <div className="px-2 pb-3">
          {s.items.map(row)}
          {s.key === "settings" && <div className="px-3 pt-2"><p className="mb-1.5 font-mono text-[11px] uppercase tracking-eyebrow text-slate">Day or night</p><ThemeSwitch compact /></div>}
        </div>
      )}
    </div>
  );

  return (
    <div className="flex flex-col">
      {profile ? (
        <div className="p-3">
          <div className="rounded-2xl border border-rule bg-card shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
            <div className="flex items-center gap-3 p-3">
              <Link href={`/u/${profile.username}`} onClick={() => went(`/u/${profile.username}`)} className="flex min-w-0 flex-1 items-center gap-3">
                <Avatar src={profile.avatar} alt={profile.displayName} size={44} square={profile.accountKind === "organisation"} />
                <span className="min-w-0">
                  <span className="flex items-center gap-1 font-ui text-base font-bold text-ink"><span className="truncate">{profile.displayName}</span><NameBadgeIcons username={profile.username} /></span>
                  <span className="block truncate text-xs text-slate">See your profile</span>
                </span>
              </Link>
              <button type="button" onClick={openSwitcher} aria-expanded={switcher} aria-label="Switch to an organisation, business or community you run, or your store" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-paper text-ink hover:bg-rule">
                <MenuGlyph name="chevron" className={`h-5 w-5 transition-transform ${switcher ? "rotate-180" : ""}`} />
              </button>
            </div>
            {switcher && (
              <div className="border-t border-rule p-2">
                <Link href={`/u/${profile.username}`} onClick={() => went(`/u/${profile.username}`)} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-paper">
                  <Avatar src={profile.avatar} alt="" size={32} square={profile.accountKind === "organisation"} />
                  <span className="flex-1 font-ui text-sm font-semibold text-ink">{profile.displayName}</span>
                  <MenuGlyph name="check" className="h-5 w-5 text-crimson" />
                </Link>
                <Link href={`/u/${profile.username}/store`} onClick={() => went(`/u/${profile.username}/store`)} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-paper">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-paper"><MenuGlyph name="store" className="h-[18px] w-[18px]" /></span>
                  <span className="flex-1 font-ui text-sm text-ink">My store</span><span className="rounded-full bg-paper px-2 py-0.5 text-[11px] text-slate">Store</span>
                </Link>
                {profile.accountKind === "organisation" && (
                  <Link href="/organisation" onClick={() => went("/organisation")} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-paper">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-paper"><MenuGlyph name="org" className="h-[18px] w-[18px]" /></span>
                    <span className="flex-1 font-ui text-sm text-ink">Organisation setup</span><span className="rounded-full bg-paper px-2 py-0.5 text-[11px] text-slate">Organisation</span>
                  </Link>
                )}
                {runs !== null && managed.length > 0 && <p className="px-2 pb-1 pt-2 font-ui text-[11px] font-bold uppercase tracking-wide text-slate">Organisations and businesses you help run</p>}
                {managed.map((m) => (
                  <div key={m.uid} className="rounded-xl px-2 py-2 hover:bg-paper">
                    <Link href={`/u/${m.username}`} onClick={() => went(`/u/${m.username}`)} className="flex items-center gap-3">
                      <Avatar src={m.avatar} alt="" size={32} square={m.org} />
                      <span className="min-w-0 flex-1"><span className="block truncate font-ui text-sm text-ink">{m.name}</span><span className="text-[11px] text-slate">@{m.username}</span></span>
                      <span className="rounded-full bg-paper px-2 py-0.5 text-[11px] text-slate">{ROLE_LABEL[m.role]}</span>
                    </Link>
                    <div className="mt-1.5 flex flex-wrap gap-1.5 pl-11">
                      {workLinks(m).map((l) => (
                        <Link key={l.href} href={l.href} onClick={() => went(l.href)} className="rounded-full border border-rule bg-card px-2.5 py-1 font-ui text-[12px] font-semibold text-ink hover:border-crimson hover:text-crimson">{l.label}</Link>
                      ))}
                    </div>
                  </div>
                ))}
                {runs !== null && runs.length > 0 && <p className="px-2 pb-1 pt-2 font-ui text-[11px] font-bold uppercase tracking-wide text-slate">Communities you run</p>}
                {runs === null ? <p className="px-2 py-2 text-xs text-slate">Loading…</p> : runs.map((c) => (
                  <Link key={c.id} href={`/c/${c.id}`} onClick={() => went(`/c/${c.id}`)} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-paper">
                    <Avatar src={c.avatar} alt="" size={32} square />
                    <span className="min-w-0 flex-1"><span className="block truncate font-ui text-sm text-ink">{c.name}</span><span className="text-[11px] text-slate">{c.memberCount.toLocaleString()} members</span></span>
                    <span className="rounded-full bg-paper px-2 py-0.5 text-[11px] text-slate">{c.role === "owner" ? "Owner" : "Admin"}</span>
                  </Link>
                ))}
                <Link href="/community" onClick={() => went("/community")} className="flex items-center gap-3 rounded-xl px-2 py-2 text-sm text-crimson hover:bg-paper">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-crimson/10"><MenuGlyph name="plus" className="h-[18px] w-[18px]" /></span>Start or find a community
                </Link>
              </div>
            )}
          </div>
        </div>
      ) : user === null && (
        <div className="grid grid-cols-2 gap-3 p-4">
          <Link href="/login" onClick={onNavigate} className="btn-ghost !py-2.5 text-center text-sm">Sign in</Link>
          <Link href="/signup" onClick={onNavigate} className="btn-primary !py-2.5 text-center text-sm">Create account</Link>
        </div>
      )}

      {profile && (shortcuts.length > 0 || editing) && (
        <div className="pb-2">
          <div className="flex items-center justify-between px-4 pb-2">
            <p className="font-ui text-sm font-bold text-slate">Your shortcuts</p>
            <button type="button" onClick={() => setEditing((e) => !e)} aria-pressed={editing} className="rounded-full px-3 py-1 font-ui text-sm font-semibold text-crimson hover:bg-crimson/10">{editing ? "Done" : "Edit"}</button>
          </div>
          <div className="flex gap-2 overflow-x-auto px-3 pb-1 pt-2 [scrollbar-width:none]">
            {shortcuts.map((s) => (
              <div key={s.href} className="relative shrink-0">
                <Link href={s.href} onClick={(e) => { if (editing) { e.preventDefault(); return; } went(s.href); }} className="flex w-[5.5rem] flex-col items-center gap-1.5 rounded-2xl border border-rule bg-card px-2 py-3 text-center hover:bg-paper">
                  <MenuGlyph name={s.icon} className="h-6 w-6 text-ink" />
                  <span className="line-clamp-2 font-ui text-[12px] font-semibold leading-tight text-ink">{s.label}</span>
                </Link>
                {editing && (
                  <button type="button" onClick={() => (s.pinned ? setPins(unpin(pinned, s.href)) : setRecents(forget(recent, s.href)))} aria-label={`Remove ${s.label} from your shortcuts`}
                    className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-ink text-paper shadow"><span aria-hidden="true" className="text-sm leading-none">×</span></button>
                )}
              </div>
            ))}
            {shortcuts.length === 0 && <p className="px-1 py-3 text-sm text-slate">No shortcuts yet. Add some below.</p>}
          </div>
          {editing && (
            <div className="mx-3 mt-2 rounded-2xl border border-rule bg-card p-2">
              <p className="px-2 pb-1 pt-1 font-ui text-xs font-bold uppercase tracking-wide text-slate">Add a shortcut</p>
              <div className="max-h-64 overflow-y-auto">
                {addable.map((i) => (
                  <button key={i.href} type="button" onClick={() => setPins(pin(pinned, i.href))} className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left font-ui text-sm text-ink hover:bg-paper">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-rule bg-card"><MenuGlyph name={i.icon} className="h-[18px] w-[18px]" /></span>
                    <span className="flex-1">{i.label}</span>
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-crimson/10 text-crimson"><MenuGlyph name="plus" className="h-4 w-4" /></span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      {profile && shortcuts.length === 0 && !editing && (
        <button type="button" onClick={() => setEditing(true)} className="mx-3 mb-3 flex items-center justify-center gap-2 rounded-xl border border-dashed border-rule py-2.5 font-ui text-sm font-semibold text-slate hover:border-crimson hover:text-crimson">
          <MenuGlyph name="plus" className="h-4 w-4" />Add shortcuts
        </button>
      )}

      {menu.tiles.length > 0 && (
        <div className="px-3 pb-3">
          <div className="grid grid-cols-2 gap-2">{menu.tiles.map(tile)}{more && menu.more.map(tile)}</div>
          {menu.more.length > 0 && (
            <button type="button" onClick={() => setMore((m) => !m)} aria-expanded={more} className="mt-2 w-full rounded-xl bg-rule/60 py-2.5 font-ui text-sm font-semibold text-ink hover:bg-rule">
              {more ? "See less" : "See more"}
            </button>
          )}
        </div>
      )}

      {menu.sections.map(section)}

      {user && (
        <div className="border-t border-rule p-3">
          <button type="button" onClick={() => { void signOut(auth); onNavigate?.(); }} className="flex w-full items-center justify-center gap-2 rounded-xl bg-rule/60 py-3 font-ui text-sm font-semibold text-ink hover:bg-rule">
            <MenuGlyph name="signout" className="h-[18px] w-[18px]" />Sign out
          </button>
        </div>
      )}
    </div>
  );
}
