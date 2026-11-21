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
import { RECENT_KEY, accountMenu, pushRecent, shortcutsFrom, type MenuItem, type MenuSection } from "@/lib/account-menu";
import { MenuGlyph } from "./menuIcons";

type L = { href: string; label: string };
type Run = { id: string; name: string; avatar: string; memberCount: number; role: string };

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
  const [recent, setRecent] = useState<string[]>([]);
  useEffect(() => { try { const r = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]"); if (Array.isArray(r)) setRecent(r.filter((x) => typeof x === "string")); } catch { /* no storage */ } }, []);

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
  const shortcuts = shortcutsFrom(recent, menu);

  const went = (href: string) => {
    const next = pushRecent(recent, href);
    setRecent(next);
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch { /* no storage */ }
    onNavigate?.();
  };
  const openSwitcher = async () => {
    setSwitcher((s) => !s);
    if (runs || !user) return;
    try {
      const r = await fetch("/api/community?run=1", { headers: { Authorization: `Bearer ${await user.getIdToken()}` } });
      const j = await r.json();
      setRuns(Array.isArray(j.communities) ? j.communities : []);
    } catch { setRuns([]); }
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
              <button type="button" onClick={openSwitcher} aria-expanded={switcher} aria-label="Switch to a community, your store or your organisation" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-paper text-ink hover:bg-rule">
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
                {runs === null ? <p className="px-2 py-2 text-xs text-slate">Loading your communities…</p> : runs.map((c) => (
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

      {shortcuts.length > 0 && (
        <div className="pb-2">
          <p className="px-4 pb-2 font-ui text-sm font-bold text-slate">Your shortcuts</p>
          <div className="flex gap-2 overflow-x-auto px-3 pb-1 [scrollbar-width:none]">
            {shortcuts.map((s) => (
              <Link key={s.href} href={s.href} onClick={() => went(s.href)} className="flex w-[5.5rem] shrink-0 flex-col items-center gap-1.5 rounded-2xl border border-rule bg-card px-2 py-3 text-center hover:bg-paper">
                <MenuGlyph name={s.icon} className="h-6 w-6 text-ink" />
                <span className="line-clamp-2 font-ui text-[12px] font-semibold leading-tight text-ink">{s.label}</span>
              </Link>
            ))}
          </div>
        </div>
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
