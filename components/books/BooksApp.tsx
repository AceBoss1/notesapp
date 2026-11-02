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
import { Icon, makeApi } from "./shared";

// The Business books app at /profile/books: a sidebar on desktop, tabs across the top on phones, and the two quick sheets (Record a sale,
// Add expense) from anywhere. Tabs live in ?tab= so a link can open one; an organisation's admins pass ?owner=<organisation uid>.
const TABS = [
  { id: "today", label: "Today", icon: "home" }, { id: "sales", label: "Sales", icon: "bag" }, { id: "expenses", label: "Expenses", icon: "card" },
  { id: "stock", label: "Stock", icon: "box" }, { id: "owed", label: "Money owed", icon: "people" }, { id: "pnl", label: "Profit and loss", icon: "chart" },
  { id: "import", label: "Import and export", icon: "download" },
] as const;
type Tab = (typeof TABS)[number]["id"];
const TIER: Record<string, string> = { basic: "Free Basic", pro: "Pro", business: "Business", enterprise: "Enterprise" };
type NoAccess = { access: { ok: false; reason: string }; accounts: { uid: string; name: string }[] };

export default function BooksApp() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [owner, setOwner] = useState("");
  const [tab, setTab] = useState<Tab>("today");
  const [home, setHome] = useState<HomeData | null>(null);
  const [blocked, setBlocked] = useState<NoAccess | null>(null);
  const [error, setError] = useState("");
  const [sheet, setSheet] = useState<"sale" | "expense" | null>(null);
  const api = useMemo(() => (user ? makeApi(user, owner) : null), [user, owner]);

  const load = useCallback(async () => {
    if (!api) return;
    try {
      const d = await api<HomeData | NoAccess>("view=home");
      if ("access" in d && !d.access.ok) { setBlocked(d as NoAccess); setHome(null); } else { setHome(d as HomeData); setBlocked(null); }
      setError("");
    } catch (e) { setError((e as Error).message); }
  }, [api]);
  useEffect(() => onAuthStateChanged(auth, (u) => {
    if (!u) return router.replace("/login?next=/profile/books");
    const sp = new URLSearchParams(window.location.search);
    setOwner(sp.get("owner") ?? "");
    const t = sp.get("tab");
    if (t && TABS.some((x) => x.id === t)) setTab(t as Tab);
    setUser(u);
  }), [router]);
  useEffect(() => { load(); }, [load]);
  const go = (t: string) => {
    setTab(t as Tab);
    const sp = new URLSearchParams(window.location.search);
    if (t === "today") sp.delete("tab"); else sp.set("tab", t);
    window.history.replaceState(null, "", `/profile/books${sp.toString() ? `?${sp}` : ""}`);
    window.scrollTo({ top: 0 });
  };

  if (error) return <div className="mx-auto max-w-3xl px-4 py-16"><p className="card p-5 text-sm text-red-700" role="alert">{error}</p></div>;
  if (blocked) return <GetIn reason={blocked.access.reason} />;
  if (!api || !home) return <div className="mx-auto max-w-5xl px-4 py-16 text-sm text-slate">Loading your books…</div>;
  const monthOk = home.access.monthPnl;

  return (
    <div className="mx-auto max-w-[1440px] lg:grid lg:grid-cols-[232px_1fr]">
      <aside className="hidden border-r border-rule px-3.5 py-6 lg:block">
        <div className="flex items-center gap-3 px-2">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-crimson font-ui font-bold text-paper">{home.shop.name.trim()[0]?.toUpperCase()}</span>
          <span className="min-w-0"><span className="block font-ui text-[15px] font-bold leading-tight text-ink">{home.shop.name}</span><span className="text-xs text-slate">{TIER[home.shop.tier] ?? home.shop.tier}</span></span>
        </div>
        {home.accounts.length > 1 && (
          <select aria-label="Whose books" value={owner || home.accounts[0].uid} onChange={(e) => { const o = e.target.value === home.accounts[0].uid ? "" : e.target.value; setHome(null); setOwner(o); }} className="mt-3 w-full rounded-lg border border-rule bg-card px-2 py-1.5 text-sm text-ink">
            {home.accounts.map((a) => <option key={a.uid} value={a.uid}>{a.name}</option>)}
          </select>
        )}
        <nav className="mt-5 space-y-0.5" aria-label="Business books">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => go(t.id)} aria-current={tab === t.id ? "page" : undefined} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left font-ui text-[15px] ${tab === t.id ? "bg-crimson/10 font-semibold text-crimson" : "text-ink hover:bg-field"}`}><Icon name={t.icon} className="h-[18px] w-[18px]" />{t.label}</button>
          ))}
        </nav>
        <p className="mt-6 px-3 font-mono text-[11px] uppercase tracking-eyebrow text-crimson">Shop</p>
        <nav className="mt-2 space-y-0.5">
          {[["/profile/inventory", "Inventory", "box"], ["/orders", "Online orders", "bag"], ["/profile/analytics", "Analytics", "chart"]].map(([href, label, icon]) => <Link key={href} href={href} className="flex items-center gap-3 rounded-xl px-3 py-2.5 font-ui text-[15px] text-ink hover:bg-field"><Icon name={icon} className="h-[18px] w-[18px]" />{label}</Link>)}
        </nav>
        <p className="mt-6 rounded-2xl bg-field p-3 text-xs leading-relaxed text-slate"><Icon name="cloud" className="mb-1 h-4 w-4" /><b className="text-ink">All saved.</b> Every entry is saved as soon as you tap Save, and paid online orders come in by themselves.</p>
      </aside>

      <div className="min-w-0">
        <nav className="sticky top-0 z-20 flex gap-2 overflow-x-auto border-b border-rule bg-paper px-4 py-3 lg:hidden" aria-label="Business books">
          {TABS.map((t) => <button key={t.id} onClick={() => go(t.id)} aria-current={tab === t.id ? "page" : undefined} className={`shrink-0 rounded-full px-4 py-2 font-ui text-sm font-semibold ${tab === t.id ? "bg-ink text-paper" : "bg-field text-ink"}`}>{t.label}</button>)}
        </nav>
        <main className="px-4 py-6 sm:px-6 lg:px-9 lg:py-8">
          {tab === "today" && <Home data={home} api={api} onSale={() => setSheet("sale")} onExpense={() => setSheet("expense")} onChanged={load} go={go} />}
          {tab === "sales" && <EntriesTab api={api} kind="sale" monthOk={monthOk} categories={home.categories} onChanged={load} onAdd={() => setSheet("sale")} />}
          {tab === "expenses" && <EntriesTab api={api} kind="expense" monthOk={monthOk} categories={home.categories} onChanged={load} onAdd={() => setSheet("expense")} />}
          {tab === "stock" && <StockTab api={api} inventory={home.inventory} />}
          {tab === "owed" && <MoneyOwed api={api} onChanged={load} />}
          {tab === "pnl" && <ProfitLoss api={api} monthOk={monthOk} shop={home.shop.name} />}
          {tab === "import" && <ImportExport api={api} maxRows={home.access.importRows} inventory={home.inventory} />}
        </main>
      </div>
      {sheet === "sale" && <RecordSale api={api} today={home.today} onClose={() => setSheet(null)} onSaved={load} />}
      {sheet === "expense" && <AddExpense api={api} today={home.today} categories={home.categories} onClose={() => setSheet(null)} onSaved={load} />}
    </div>
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
