"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import PageHero from "@/components/PageHero";
import { startCheckout } from "@/lib/checkout";
import { formatNaira } from "@/lib/booking-time";
import DiscountCodeField from "@/components/DiscountCodeField";
import { MANUAL_REASONS, reasonLabel, stockState, toCsv, type ImportChange, type InventoryAccess, type InventoryDoc, type Move, type StockLine } from "@/lib/inventory";

// Inventory (lib/inventory.ts): every physical item and option with its stock, SKU, cost and low-stock level; restock or correct a count
// with a reason; the history of every change; spreadsheet export and import. Business and Enterprise; Free Basic and Pro with the add-on or its free trial.
type Data = {
  access: InventoryAccess; accounts: { uid: string; name: string }[]; tier?: string; price: string; trialDays: number;
  items?: { id: string; title: string; image: string; hasOptions: boolean }[]; inv?: Record<string, InventoryDoc>; lines?: StockLine[];
  summary?: { lines: number; units: number; costKobo: number; retailKobo: number; low: number; out: number };
};
type Filter = "all" | "low" | "out";
const field = "w-full rounded-lg border border-rule bg-card px-2 py-1.5 text-sm outline-none focus:border-crimson";
const small = "rounded-full border border-rule px-3 py-1 text-xs font-semibold text-ink hover:border-crimson disabled:opacity-40";
const option = (v?: string) => (v ? v.replace(/\|/g, " · ") : "");
const kobo = (price: string) => Math.round(Number(price.replace(/[^\d.]/g, "")) * 100) || 0; // "₦1,500" from the API

async function call(user: User, url: string, body?: unknown) {
  const res = await fetch(url, { method: body ? "POST" : "GET", headers: { "Content-Type": "application/json", Authorization: `Bearer ${await user.getIdToken()}` }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(j.error || "Something went wrong."), { data: j });
  return j;
}

export default function InventoryPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [owner, setOwner] = useState("");
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null); // the item whose details and history are open
  const [msg, setMsg] = useState("");
  const [disc, setDisc] = useState<{ code: string; discountKobo: number } | null>(null);

  const load = useCallback(async (u: User, o: string) => {
    try { setData(await call(u, `/api/inventory${o ? `?owner=${encodeURIComponent(o)}` : ""}`)); setError(""); }
    catch (e) { setError(e instanceof Error ? e.message : "Couldn't load your inventory."); }
  }, []);
  useEffect(() => onAuthStateChanged(auth, (u) => {
    if (!u) return router.replace("/login?next=/profile/inventory");
    setUser(u);
    const o = new URLSearchParams(window.location.search).get("owner") ?? "";
    setOwner(o);
    load(u, o);
  }), [router, load]);

  const lines = useMemo(() => (data?.lines ?? []).filter((l) => {
    const st = stockState(l.stock, l.lowAt);
    if (filter === "low" && st !== "low") return false;
    if (filter === "out" && st !== "out") return false;
    const s = q.trim().toLowerCase();
    return !s || l.title.toLowerCase().includes(s) || l.sku.toLowerCase().includes(s) || (l.variant ?? "").toLowerCase().includes(s);
  }), [data, filter, q]);

  if (!user || (!data && !error)) return <div className="mx-auto max-w-5xl px-4 py-16 text-sm text-slate">Loading…</div>;
  const reload = () => load(user, owner);
  const ownerParam = owner ? { owner } : {};

  return (
    <div>
      <PageHero compact max="max-w-5xl" eyebrow="My account" title={<>Inventory</>}>
        <p>Your stock in one place: what&apos;s left of every item and option, SKUs and cost prices, low-stock alerts, every change with its reason, and a spreadsheet in and out.</p>
      </PageHero>
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        {data && data.accounts.length > 1 && (
          <label className="mb-6 flex items-center gap-2 text-sm text-slate">Store:
            <select value={owner || user.uid} onChange={(e) => { const o = e.target.value === user.uid ? "" : e.target.value; setOwner(o); setData(null); load(user, o); }} className="rounded-lg border border-rule bg-card px-2 py-1.5 text-ink">
              {data.accounts.map((a) => <option key={a.uid} value={a.uid}>{a.name}</option>)}
            </select>
          </label>
        )}
        {error && <p className="card p-5 text-sm text-crimson" role="alert">{error}</p>}
        {data && !data.access.ok && <GetIt user={user} data={data} onDone={reload} />}
        {data?.access.ok && data.summary && (
          <>
            {data.access.via !== "plan" && data.access.until && <DiscountCodeField target="inventory_addon" subtotalKobo={kobo(data.price)} onChange={setDisc} className="mb-2" />}
            {data.access.via !== "plan" && data.access.until && (
              <p className="mb-4 text-xs text-slate">{data.access.via === "trial" ? "Free trial" : "Inventory add-on"} until {new Date(data.access.until).toDateString()}. <button onClick={() => startCheckout(user, { kind: "inventory_addon", ...(disc ? { code: disc.code } : {}) }).catch((e) => setMsg(e.message))} className="text-crimson underline">Add a month ({disc ? formatNaira(Math.max(0, kobo(data.price) - disc.discountKobo)) : data.price})</button></p>
            )}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {[["Items and options", data.summary.lines.toLocaleString()], ["Units in stock", data.summary.units.toLocaleString()], ["Stock value at cost", formatNaira(data.summary.costKobo)], ["Running low", String(data.summary.low)], ["Sold out", String(data.summary.out)]].map(([k, v]) => (
                <div key={k} className="card p-4"><p className="text-xs text-slate">{k}</p><p className="mt-1 font-display text-2xl text-ink">{v}</p></div>
              ))}
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-2">
              {(["all", "low", "out"] as Filter[]).map((f) => (
                <button key={f} onClick={() => setFilter(f)} className={`rounded-full border px-3 py-1 text-xs font-semibold ${filter === f ? "border-crimson bg-crimson text-paper" : "border-rule text-ink"}`}>{f === "all" ? "All" : f === "low" ? "Running low" : "Sold out"}</button>
              ))}
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, option or SKU" className={`${field} max-w-xs`} aria-label="Search" />
              <span className="flex-1" />
              <button className={small} onClick={() => { const blob = new Blob([toCsv(data.lines ?? [])], { type: "text/csv" }); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "inventory.csv"; a.click(); }}>Download spreadsheet</button>
              <ImportButton user={user} ownerParam={ownerParam} onDone={(n) => { setMsg(`${n} ${n === 1 ? "row" : "rows"} updated from your spreadsheet.`); reload(); }} />
            </div>
            {msg && <p className="mt-3 text-sm text-ink" role="status">{msg}</p>}
            {!data.lines?.length ? (
              <div className="card mt-6 p-6 text-sm text-slate">No physical items for sale yet. <Link href="/store-selling" className="text-crimson underline">Add one to your store</Link> and it shows here.</div>
            ) : (
              <ul className="mt-6 divide-y divide-rule rounded-2xl border border-rule bg-card">
                {lines.map((l) => {
                  const key = `${l.itemId}|${l.variant ?? ""}`;
                  const st = stockState(l.stock, l.lowAt);
                  return (
                    <li key={key} className="p-4">
                      <div className="flex flex-wrap items-center gap-3">
                        <button onClick={() => setOpen(open === l.itemId ? null : l.itemId)} className="min-w-0 basis-full text-left sm:basis-0 sm:flex-1">
                          <span className="block font-ui text-sm font-bold text-ink sm:truncate">{l.title}{l.variant && <span className="font-normal text-slate"> · {option(l.variant)}</span>}</span>
                          <span className="block text-xs text-slate">{l.sku ? `SKU ${l.sku} · ` : ""}{l.costKobo ? `cost ${formatNaira(l.costKobo)} · ` : ""}low at {l.lowAt}</span>
                        </button>
                        <span className={`rounded-full px-2.5 py-1 font-mono text-xs font-semibold ${st === "out" ? "bg-crimson text-paper" : st === "low" ? "bg-crimson/10 text-crimson" : "bg-rule/60 text-ink"}`}>{l.stock} left</span>
                        <Adjust user={user} ownerParam={ownerParam} line={l} onDone={reload} />
                      </div>
                      {/* The item's details and history, under its first line. */}
                      {open === l.itemId && lines.find((x) => x.itemId === l.itemId) === l && <Details user={user} ownerParam={ownerParam} itemId={l.itemId} inv={data.inv?.[l.itemId]} variants={(data.lines ?? []).filter((x) => x.itemId === l.itemId && x.variant).map((x) => x.variant!)} onDone={reload} />}
                    </li>
                  );
                })}
              </ul>
            )}
            <History user={user} owner={owner} />
          </>
        )}
      </div>
    </div>
  );
}

// Without inventory: the trial, the add-on, or Business.
function GetIt({ user, data, onDone }: { user: User; data: Data; onDone: () => void }) {
  const [err, setErr] = useState("");
  const [disc, setDisc] = useState<{ code: string; discountKobo: number } | null>(null);
  const a = data.access as { ok: false; canTrial: boolean };
  if (data.tier === "standard") return <div className="card p-6 text-sm text-slate">Inventory is for members who sell. <Link href="/profile/publishing" className="text-crimson underline">Start publishing on Free Basic</Link>, then add it.</div>;
  return (
    <div className="card p-6">
      <p className="font-display text-xl text-ink">Inventory comes with Business</p>
      <p className="mt-1 text-sm text-slate">On Free Basic and Pro, add it for {data.price} a month{a.canTrial ? `, after a free ${data.trialDays}-day trial (no card)` : ""}. Or move to Business, which includes it.</p>
      <DiscountCodeField target="inventory_addon" subtotalKobo={kobo(data.price)} onChange={setDisc} className="mt-3" />
      <div className="mt-4 flex flex-wrap gap-2">
        {a.canTrial && <button className="btn-primary !px-4 !py-2 text-xs" onClick={() => call(user, "/api/inventory", { action: "trial" }).then(onDone).catch((e) => setErr(e.message))}>Start the free trial</button>}
        <button className={a.canTrial ? small : "btn-primary !px-4 !py-2 text-xs"} onClick={() => startCheckout(user, { kind: "inventory_addon", ...(disc ? { code: disc.code } : {}) }).catch((e) => setErr(e.message))}>Add inventory · {disc ? formatNaira(Math.max(0, kobo(data.price) - disc.discountKobo)) : data.price}/month</button>
        <Link href="/pricing" className={small}>See Business</Link>
      </div>
      {err && <p className="mt-2 text-sm text-crimson" role="alert">{err}</p>}
    </div>
  );
}

// Restock (add), take off (a negative number) or set the count, with a reason.
function Adjust({ user, ownerParam, line, onDone }: { user: User; ownerParam: object; line: StockLine; onDone: () => void }) {
  const [on, setOn] = useState(false);
  const [mode, setMode] = useState<"add" | "set">("add");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("restock");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  if (!on) return <button className={small} onClick={() => setOn(true)}>Restock or correct</button>;
  async function save() {
    setBusy(true); setErr("");
    try { await call(user, "/api/inventory", { action: "adjust", ...ownerParam, itemId: line.itemId, variant: line.variant, mode, amount: Number(amount), reason, note }); setOn(false); setAmount(""); setNote(""); onDone(); }
    catch (e) { setErr(e instanceof Error ? e.message : "Couldn't save."); }
    finally { setBusy(false); }
  }
  return (
    <div className="mt-3 grid w-full gap-2 rounded-xl border border-rule p-3 sm:grid-cols-[auto,6rem,1fr,1fr,auto]">
      <select value={mode} onChange={(e) => { const m = e.target.value as "add" | "set"; setMode(m); setReason(m === "set" ? "count" : "restock"); }} className={field} aria-label="Add or set"><option value="add">Add (or take off with −)</option><option value="set">Set the count to</option></select>
      <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="numeric" placeholder={mode === "add" ? "+10" : String(line.stock)} className={field} aria-label="Amount" />
      <select value={reason} onChange={(e) => setReason(e.target.value)} className={field} aria-label="Reason">{MANUAL_REASONS.map((r) => <option key={r} value={r}>{reasonLabel(r)}</option>)}</select>
      <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="Note (optional), e.g. supplier invoice" className={field} aria-label="Note" />
      <span className="flex gap-2"><button className="btn-primary !px-3 !py-1.5 text-xs" disabled={busy || amount.trim() === "" || Number.isNaN(Number(amount))} onClick={save}>{busy ? "Saving…" : "Save"}</button><button className={small} onClick={() => setOn(false)}>Cancel</button></span>
      {err && <p className="text-xs text-crimson sm:col-span-5" role="alert">{err}</p>}
    </div>
  );
}

// The item's SKU (and each option's), cost price and low-stock level, and its history.
function Details({ user, ownerParam, itemId, inv, variants, onDone }: { user: User; ownerParam: object; itemId: string; inv?: InventoryDoc; variants: string[]; onDone: () => void }) {
  const [sku, setSku] = useState(inv?.sku ?? "");
  const [vsku, setVsku] = useState<Record<string, string>>(inv?.variantSku ?? {});
  const [cost, setCost] = useState(inv?.costKobo ? String(inv.costKobo / 100) : "");
  const [low, setLow] = useState(String(inv?.lowAt ?? 3));
  const [moves, setMoves] = useState<Move[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  useEffect(() => { call(user, `/api/inventory?history=${itemId}${"owner" in ownerParam ? `&owner=${(ownerParam as { owner: string }).owner}` : ""}`).then((d) => setMoves(d.moves)).catch(() => setMoves([])); }, [user, itemId, ownerParam]);
  async function save() {
    setBusy(true); setMsg("");
    try { await call(user, "/api/inventory", { action: "details", ...ownerParam, itemId, sku, variantSku: vsku, costKobo: Math.round(Number(cost || 0) * 100), lowAt: Number(low) }); setMsg("Saved."); onDone(); }
    catch (e) { setMsg(e instanceof Error ? e.message : "Couldn't save."); }
    finally { setBusy(false); }
  }
  return (
    <div className="mt-3 rounded-xl bg-paper p-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-xs text-slate">SKU<input value={sku} onChange={(e) => setSku(e.target.value)} maxLength={40} className={`${field} mt-1 uppercase`} placeholder="e.g. TOTE-BLK" /></label>
        <label className="text-xs text-slate">Cost price each, ₦ (private)<input value={cost} onChange={(e) => setCost(e.target.value)} inputMode="decimal" className={`${field} mt-1`} placeholder="0" /></label>
        <label className="text-xs text-slate">Alert me when this many are left<input value={low} onChange={(e) => setLow(e.target.value)} inputMode="numeric" className={`${field} mt-1`} /></label>
      </div>
      {variants.length > 0 && (
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {variants.map((v) => <label key={v} className="text-xs text-slate">SKU for {option(v)}<input value={vsku[v] ?? ""} onChange={(e) => setVsku({ ...vsku, [v]: e.target.value })} maxLength={40} className={`${field} mt-1 uppercase`} placeholder={sku ? `${sku}-${v.replace(/\|/g, "-")}`.toUpperCase() : ""} /></label>)}
        </div>
      )}
      <div className="mt-3 flex items-center gap-3"><button className="btn-primary !px-3 !py-1.5 text-xs" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save details"}</button>{msg && <span className="text-xs text-ink" role="status">{msg}</span>}</div>
      <p className="mt-5 font-ui text-xs font-bold text-ink">History</p>
      {moves === null ? <p className="mt-1 text-xs text-slate">Loading…</p> : !moves.length ? <p className="mt-1 text-xs text-slate">Nothing yet. Sales, refunds and your changes appear here.</p> : <Moves moves={moves} />}
    </div>
  );
}

function Moves({ moves }: { moves: Move[] }) {
  return (
    <ul className="mt-2 divide-y divide-rule text-xs">
      {moves.map((m) => (
        <li key={m.id} className="flex flex-wrap items-baseline gap-x-3 py-1.5">
          <span className="w-32 shrink-0 font-mono text-slate">{new Date(m.at).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" })}</span>
          <span className={`w-12 font-mono font-semibold ${m.delta < 0 ? "text-crimson" : "text-ink"}`}>{m.delta > 0 ? `+${m.delta}` : m.delta}</span>
          <span className="text-ink">{reasonLabel(m.reason)}{m.variant ? ` · ${option(m.variant)}` : ""}</span>
          <span className="text-slate">→ {m.after} left{m.note ? ` · ${m.note}` : ""}{m.orderRef ? ` · order ${m.orderRef.slice(-8)}` : ""}</span>
        </li>
      ))}
    </ul>
  );
}

// The latest changes across the store.
function History({ user, owner }: { user: User; owner: string }) {
  const [moves, setMoves] = useState<Move[] | null>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => { if (open) call(user, `/api/inventory?history=all${owner ? `&owner=${owner}` : ""}`).then((d) => setMoves(d.moves)).catch(() => setMoves([])); }, [open, user, owner]);
  return (
    <section className="card mt-8 p-5">
      <button onClick={() => setOpen(!open)} className="font-display text-xl text-ink">{open ? "▾" : "▸"} Recent changes</button>
      {open && (moves === null ? <p className="mt-2 text-sm text-slate">Loading…</p> : !moves.length ? <p className="mt-2 text-sm text-slate">Nothing yet.</p> : <Moves moves={moves} />)}
    </section>
  );
}

// Import: pick the spreadsheet (the downloaded one, edited), see what will change and any problems, then apply.
function ImportButton({ user, ownerParam, onDone }: { user: User; ownerParam: object; onDone: (n: number) => void }) {
  const [csv, setCsv] = useState<string | null>(null);
  const [plan, setPlan] = useState<{ changes: ImportChange[]; problems: string[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function pick(f: File | undefined) {
    if (!f) return;
    setErr(""); setPlan(null);
    const text = await f.text();
    setCsv(text);
    try { setPlan(await call(user, "/api/inventory", { action: "import", ...ownerParam, csv: text })); } catch (e) { setErr(e instanceof Error ? e.message : "Couldn't read that file."); }
  }
  async function apply() {
    if (!csv) return;
    setBusy(true);
    try { const r = await call(user, "/api/inventory", { action: "import", ...ownerParam, csv, apply: true }); setPlan(null); setCsv(null); onDone(r.applied); }
    catch (e) { setErr(e instanceof Error ? e.message : "Couldn't apply it."); }
    finally { setBusy(false); }
  }
  return (
    <>
      <label className={`${small} cursor-pointer`}>Upload spreadsheet<input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => pick(e.target.files?.[0])} /></label>
      {(plan || err) && (
        <div className="mt-3 w-full rounded-xl border border-rule bg-card p-4 text-sm">
          {err && <p className="text-crimson" role="alert">{err}</p>}
          {plan && <>
            <p className="text-ink">{plan.changes.length} {plan.changes.length === 1 ? "row changes" : "rows change"}{plan.problems.length ? `, ${plan.problems.length} with problems` : ""}.</p>
            {plan.problems.length > 0 && <ul className="mt-2 list-disc pl-5 text-xs text-crimson">{plan.problems.slice(0, 20).map((p) => <li key={p}>{p}</li>)}</ul>}
            <div className="mt-3 flex gap-2">
              <button className="btn-primary !px-3 !py-1.5 text-xs" disabled={busy || !plan.changes.length || plan.problems.length > 0} onClick={apply}>{busy ? "Applying…" : "Apply the changes"}</button>
              <button className={small} onClick={() => { setPlan(null); setCsv(null); setErr(""); }}>Cancel</button>
            </div>
          </>}
        </div>
      )}
    </>
  );
}
