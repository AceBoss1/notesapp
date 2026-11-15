"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import Home, { type HomeData } from "./Home";
import RecordSale from "./RecordSale";
import AddExpense from "./AddExpense";
import MoneyOwed from "./MoneyOwed";
import ProfitLoss from "./ProfitLoss";
import ImportExport from "./ImportExport";
import { EntriesTab, StockTab } from "./Lists";
import TellNana from "./TellNana";
import Staff from "./Staff";
import CashierHome, { type CashierData } from "./CashierHome";
import { OutboxProvider, SyncBadge, isOfflineError, kvGet, kvSet } from "./outbox";
import { ROLE_LABEL, can, type BooksAct, type BooksRole } from "@/lib/books";
import { makeApi } from "./shared";
import SelectBox from "@/components/ui/SelectBox";

// The Business books app at /profile/books: the shop, its save state and whose books at the top, then the tabs (a dropdown on phones),
// as in the Moda user dashboard redesign (the My account menu sits on the left), and the quick sheets (Record a sale,
// Add expense, Tell Nana) from anywhere. Tabs live in ?tab= so a link can open one; an organisation's admins and staff pass
// ?owner=<the books' owner uid>. What shows follows the role (lib/books.ts can): a cashier gets the counter view only; a manager every tab
// but Staff. With no connection, the last copy kept on the phone shows and new entries wait in the outbox (components/books/outbox.tsx).
const TABS = [
  { id: "today", label: "Today", icon: "home", act: "home" }, { id: "sales", label: "Sales", icon: "bag", act: "sales" }, { id: "expenses", label: "Expenses", icon: "card", act: "expenses" },
  { id: "stock", label: "Stock", icon: "box", act: "costs" }, { id: "owed", label: "Money owed", icon: "people", act: "owed" }, { id: "pnl", label: "Profit and loss", icon: "chart", act: "pnl" },
  { id: "import", label: "Import and export", icon: "download", act: "import" }, { id: "staff", label: "Staff", icon: "lock", act: "staff" },
] as const;
type Tab = (typeof TABS)[number]["id"];
const TIER: Record<string, string> = { basic: "Free Basic", pro: "Pro", business: "Business", enterprise: "Enterprise" };
type NoAccess = { access: { ok: false; reason: string }; accounts: { uid: string; name: string }[] };
type Loaded = (HomeData & { role?: BooksRole }) | CashierData;

export default function BooksApp() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [owner, setOwner] = useState("");
  const [tab, setTab] = useState<Tab>("today");
  const [home, setHome] = useState<Loaded | null>(null);
  const [offline, setOffline] = useState(false);
  const [blocked, setBlocked] = useState<NoAccess | null>(null);
  const [error, setError] = useState("");
  const [sheet, setSheet] = useState<"sale" | "expense" | "nana" | null>(null);
  const [pnlStart, setPnlStart] = useState<{ period?: string; back?: number }>({});
  const api = useMemo(() => (user ? makeApi(user, owner) : null), [user, owner]);
  const snapKey = user ? `home:${owner || user.uid}` : "";

  const load = useCallback(async () => {
    if (!api) return;
    try {
      const d = await api<Loaded | NoAccess>("view=home");
      if ("access" in d && !d.access.ok) { setBlocked(d as NoAccess); setHome(null); } else { setHome(d as Loaded); setBlocked(null); void kvSet(snapKey, d); }
      setError(""); setOffline(false);
    } catch (e) {
      // No connection: the copy kept on this phone, so sales can still be recorded.
      const kept = isOfflineError(e) ? await kvGet<Loaded>(snapKey) : undefined;
      if (kept) { setHome(kept); setOffline(true); setError(""); } else setError(isOfflineError(e) ? "You're offline, and Books hasn't been opened on this phone with a connection yet. Connect once and it works offline after that." : (e as Error).message);
    }
  }, [api, snapKey]);
  useEffect(() => onAuthStateChanged(auth, (u) => {
    if (!u) return router.replace("/login?next=/profile/books");
    const sp = new URLSearchParams(window.location.search);
    setOwner(sp.get("owner") ?? "");
    const t = sp.get("tab");
    if (t && TABS.some((x) => x.id === t)) setTab(t as Tab);
    if (t === "pnl") setPnlStart({ period: sp.get("period") ?? undefined, back: Number(sp.get("back") ?? 0) || 0 });
    setUser(u);
  }), [router]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { const on = () => { if (offline) load(); }; window.addEventListener("online", on); return () => window.removeEventListener("online", on); }, [offline, load]);
  const go = (t: string) => {
    setTab(t as Tab);
    const sp = new URLSearchParams(window.location.search);
    if (t === "today") sp.delete("tab"); else sp.set("tab", t);
    sp.delete("period"); sp.delete("back");
    window.history.replaceState(null, "", `/profile/books${sp.toString() ? `?${sp}` : ""}`);
    window.scrollTo({ top: 0 });
  };

  if (error) return <div className="mx-auto max-w-3xl px-4 py-16"><p className="card p-5 text-sm text-red-700" role="alert">{error}</p></div>;
  if (blocked) return <GetIn reason={blocked.access.reason} />;
  if (!api || !home || !user) return <div className="mx-auto max-w-5xl px-4 py-16 text-sm text-slate">Loading your books…</div>;
  const role: BooksRole = home.role ?? "owner";
  const tabs = TABS.filter((t) => (role === "cashier" ? t.id === "today" : can(role, t.act as BooksAct)));
  const cur: Tab = tabs.some((t) => t.id === tab) ? tab : "today";
  const switchTo = (uid: string) => { const o = uid === home.accounts[0].uid ? "" : uid; setHome(null); setOwner(o); setTab("today"); const sp = new URLSearchParams(window.location.search); if (o) sp.set("owner", o); else sp.delete("owner"); sp.delete("tab"); window.history.replaceState(null, "", `/profile/books${sp.toString() ? `?${sp}` : ""}`); };

  return (
    <OutboxProvider user={user} owner={owner} onSynced={load}>
      <div className="mx-auto max-w-6xl">
        <div className="min-w-0">
          <header className="px-4 pt-5 sm:px-6 lg:px-8 lg:pt-7">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[10px] bg-crimson font-ui font-bold text-paper">{home.shop.name.trim()[0]?.toUpperCase()}</span>
              <span className="min-w-0 flex-1"><span className="block truncate font-ui text-[15px] font-semibold leading-tight text-ink">{home.shop.name}</span><span className="text-xs text-slate">{role === "owner" ? TIER[home.shop.tier] ?? home.shop.tier : `You: ${ROLE_LABEL[role]}`}</span></span>
              <SyncBadge saved />
              {home.accounts.length > 1 && (
                <SelectBox label="Whose books" hideLabel className="hidden w-48 md:block" value={owner || home.accounts[0].uid} onChange={switchTo}
                  options={home.accounts.map((a, i) => ({ value: a.uid, label: i === 0 ? "My books" : a.name }))} />
              )}
            </div>
            {tabs.length > 1 ? (
              <>
                <div className="mt-5 hidden items-end justify-between gap-4 border-b border-rule md:flex">
                  <nav className="flex gap-7 overflow-x-auto font-ui text-sm" aria-label="Business books">
                    {tabs.map((t) => (
                      <button key={t.id} onClick={() => go(t.id)} aria-current={cur === t.id ? "page" : undefined}
                        className={`-mb-px shrink-0 border-b-[3px] py-2.5 ${cur === t.id ? "border-crimson-bright font-semibold text-crimson-bright" : "border-transparent font-medium text-slate hover:text-ink"}`}>{t.label}</button>
                    ))}
                  </nav>
                  {role !== "cashier" && (
                    <details className="relative mb-2 shrink-0">
                      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-[10px] border border-rule bg-card px-3.5 py-2 font-ui text-sm text-ink [&::-webkit-details-marker]:hidden">Shop <span aria-hidden className="text-xs text-slate">⌄</span></summary>
                      <div className="absolute right-0 z-30 mt-2 w-48 overflow-hidden rounded-2xl border border-rule bg-card py-1 shadow-xl">
                        {[["/profile/inventory", "Inventory"], ["/orders", "Online orders"], ["/profile/analytics", "Analytics"]].map(([href, label]) => <Link key={href} href={href} className="block px-4 py-2.5 font-ui text-sm text-ink hover:bg-field">{label}</Link>)}
                      </div>
                    </details>
                  )}
                </div>
                <div className={`mt-4 grid gap-3 md:hidden ${home.accounts.length > 1 ? "grid-cols-[1.4fr,1fr]" : ""}`}>
                  <SelectBox accent label="Business books" hideLabel value={cur} onChange={go} options={tabs.map((t) => ({ value: t.id, label: t.label }))} />
                  {home.accounts.length > 1 && (
                    <SelectBox label="Whose books" hideLabel value={owner || home.accounts[0].uid} onChange={switchTo}
                      options={home.accounts.map((a, i) => ({ value: a.uid, label: i === 0 ? "My books" : a.name }))} />
                  )}
                </div>
              </>
            ) : <p className="mt-3 font-ui text-sm font-semibold text-ink">{home.shop.name} · {ROLE_LABEL[role]}</p>}
          </header>
          <main className="px-4 py-6 sm:px-6 lg:px-8 lg:py-7">
            {offline && <p className="mb-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900" role="status">You&apos;re offline. This is your books as they were when you were last online; new sales, expenses and payments are kept on this phone and sync when you&apos;re back.</p>}
            {role === "cashier" ? <CashierHome data={home as CashierData} api={api} onSale={() => setSheet("sale")} onNana={() => setSheet("nana")} onChanged={load} /> : <>
              {cur === "today" && <Home data={home as HomeData} api={api} onSale={() => setSheet("sale")} onExpense={() => setSheet("expense")} onNana={() => setSheet("nana")} onChanged={load} go={go} />}
              {cur === "sales" && <EntriesTab api={api} kind="sale" monthOk={(home as HomeData).access.monthPnl} categories={(home as HomeData).categories} onChanged={load} onAdd={() => setSheet("sale")} />}
              {cur === "expenses" && <EntriesTab api={api} kind="expense" monthOk={(home as HomeData).access.monthPnl} categories={(home as HomeData).categories} onChanged={load} onAdd={() => setSheet("expense")} />}
              {cur === "stock" && <StockTab api={api} inventory={home.inventory} />}
              {cur === "owed" && <MoneyOwed api={api} onChanged={load} />}
              {cur === "pnl" && <ProfitLoss api={api} monthOk={(home as HomeData).access.monthPnl} shop={home.shop.name} start={pnlStart} />}
              {cur === "import" && <ImportExport api={api} maxRows={(home as HomeData).access.importRows} inventory={home.inventory} />}
              {cur === "staff" && <Staff api={api} />}
            </>}
          </main>
        </div>
        {sheet === "sale" && <RecordSale api={api} today={home.today} onClose={() => setSheet(null)} onSaved={load} />}
        {sheet === "expense" && <AddExpense api={api} today={home.today} categories={(home as HomeData).categories} onClose={() => setSheet(null)} onSaved={load} />}
        {sheet === "nana" && <TellNana api={api} today={home.today} cashier={role === "cashier"} onClose={() => setSheet(null)} onSaved={load} />}
      </div>
    </OutboxProvider>
  );
}

function GetIn({ reason }: { reason: string }) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-14">
      <p className="eyebrow">Business books</p>
      <h1 className="mt-2 font-display text-4xl text-ink">Keep your shop&apos;s books here</h1>
      <p className="mt-3 text-[15px] text-slate">Walk-in sales and expenses, who owes you, and what you made today, this week and this month, next to your online store.</p>
      <p className="card mt-5 p-5 text-sm text-ink">{reason}</p>
      <div className="mt-5 flex flex-wrap gap-3"><Link href="/profile/edit" className="btn-primary">Switch to Free Basic</Link><Link href="/pricing" className="btn-ghost">See the plans</Link><Link href="/help/business-books" className="btn-ghost">How it works</Link></div>
    </div>
  );
}
