"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/moments-client";
import {
  MAX_PERCENT, NOTESAPP_TARGETS, PUBLISHER_TARGETS, TARGET_LABEL, describeCode, naira,
  type DiscountCode, type DiscountTarget,
} from "@/lib/discounts";

// Make and manage discount codes (lib/discounts.ts): a member's own, for their shop, downloads, courses and sessions, or #NotesApp's
// (owner "notesapp", from the admin). Shows how often each was used and how much it took off; never who used it.
type Use = { code: string; kind: DiscountTarget; discountKobo: number; paidKobo: number; at: string; overUsed: boolean };
type Form = {
  code: string; kind: "percent" | "amount"; percent: string; amountNaira: string; targets: DiscountTarget[]; items: string;
  maxUses: string; perBuyer: string; startsAt: string; endsAt: string; minNaira: string; firstOrderOnly: boolean;
};
const field = "w-full rounded-lg border border-rule bg-card px-3 py-2 text-sm text-ink outline-none focus:border-crimson";
const label = "mb-1 block font-ui text-xs font-semibold text-slate";

const blank = (targets: readonly DiscountTarget[]): Form => ({
  code: "", kind: "percent", percent: "10", amountNaira: "", targets: [...targets], items: "",
  maxUses: "", perBuyer: "1", startsAt: "", endsAt: "", minNaira: "", firstOrderOnly: false,
});
const fromCode = (c: DiscountCode): Form => ({
  code: c.code, kind: c.kind, percent: String(c.percent ?? ""), amountNaira: c.amountKobo ? String(c.amountKobo / 100) : "",
  targets: c.targets, items: (c.itemIds ?? []).join("\n"), maxUses: c.maxUses == null ? "" : String(c.maxUses), perBuyer: String(c.perBuyer ?? 1),
  startsAt: c.startsAt ? c.startsAt.slice(0, 10) : "", endsAt: c.endsAt ? c.endsAt.slice(0, 10) : "",
  minNaira: c.minOrderKobo ? String(c.minOrderKobo / 100) : "", firstOrderOnly: !!c.firstOrderOnly,
});
// A pasted link or an id: the last part of a product or course link is its id.
const itemIdsFrom = (s: string) => s.split(/[\s,]+/).map((x) => x.trim().replace(/[?#].*$/, "").replace(/\/+$/, "").split("/").pop() ?? "").filter(Boolean);

export default function DiscountCodesManager({ owner }: { owner: "me" | "notesapp" }) {
  const targets: readonly DiscountTarget[] = owner === "notesapp" ? NOTESAPP_TARGETS : PUBLISHER_TARGETS;
  const q = owner === "notesapp" ? "?owner=notesapp" : "";
  const [codes, setCodes] = useState<DiscountCode[] | null>(null);
  const [uses, setUses] = useState<Use[]>([]);
  const [form, setForm] = useState<Form | null>(null);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const r = await api<{ codes: DiscountCode[]; uses: Use[] }>(`/api/discounts${q}`);
      setCodes(r.codes); setUses(r.uses);
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn't load your codes."); setCodes([]); }
  }, [q]);
  useEffect(() => { void load(); }, [load]);

  async function save() {
    if (!form) return;
    setBusy(true); setError("");
    try {
      await api("/api/discounts", { body: {
        ...(owner === "notesapp" ? { owner: "notesapp" } : {}), action: "save", create: !editing,
        code: form.code, kind: form.kind, percent: form.kind === "percent" ? Number(form.percent) : undefined,
        amountKobo: form.kind === "amount" ? Math.round(Number(form.amountNaira) * 100) : undefined,
        targets: form.targets, itemIds: itemIdsFrom(form.items), maxUses: form.maxUses || null, perBuyer: form.perBuyer || 1,
        startsAt: form.startsAt || null, endsAt: form.endsAt ? `${form.endsAt}T23:59:59` : null,
        minOrderKobo: form.minNaira ? Math.round(Number(form.minNaira) * 100) : null, firstOrderOnly: form.firstOrderOnly,
      } });
      setForm(null); await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn't save that code."); }
    finally { setBusy(false); }
  }
  async function toggle(c: DiscountCode) {
    setError("");
    try { await api("/api/discounts", { body: { ...(owner === "notesapp" ? { owner: "notesapp" } : {}), action: "active", code: c.code, active: !c.active } }); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Couldn't change that code."); }
  }
  const set = (patch: Partial<Form>) => setForm((f) => (f ? { ...f, ...patch } : f));

  return (
    <div>
      {error && <p className="mb-3 rounded-lg bg-crimson/10 px-3 py-2 text-sm text-crimson" role="alert">{error}</p>}
      {!form && (
        <button type="button" onClick={() => { setEditing(false); setForm(blank(targets)); }} className="btn-primary !px-5 !py-2.5 text-sm">+ New code</button>
      )}

      {form && (
        <div className="card mt-2 p-5">
          <h3 className="font-display text-xl text-ink">{editing ? `Edit ${form.code}` : "New code"}</h3>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <span className={label}>Code (what buyers type)</span>
              <input value={form.code} disabled={editing} onChange={(e) => set({ code: e.target.value.toUpperCase().replace(/\s/g, "") })} maxLength={20} placeholder="e.g. WELCOME10" className={`${field} font-mono uppercase`} />
            </div>
            <div>
              <span className={label}>Discount</span>
              <div className="flex gap-2">
                <select value={form.kind} onChange={(e) => set({ kind: e.target.value as Form["kind"] })} className={`${field} !w-auto`}>
                  <option value="percent">% off</option>
                  <option value="amount">₦ off</option>
                </select>
                {form.kind === "percent"
                  ? <input type="number" min={1} max={MAX_PERCENT} value={form.percent} onChange={(e) => set({ percent: e.target.value })} className={field} aria-label="Percent off" />
                  : <input type="number" min={100} step={100} value={form.amountNaira} onChange={(e) => set({ amountNaira: e.target.value })} placeholder="Naira" className={field} aria-label="Naira off" />}
              </div>
            </div>
            <fieldset className="sm:col-span-2">
              <legend className={label}>Works on</legend>
              <div className="flex flex-wrap gap-2">
                {targets.map((t) => {
                  const on = form.targets.includes(t);
                  return (
                    <button key={t} type="button" aria-pressed={on} onClick={() => set({ targets: on ? form.targets.filter((x) => x !== t) : [...form.targets, t] })}
                      className={`rounded-full border px-3 py-1.5 font-ui text-xs font-semibold ${on ? "border-crimson bg-crimson/10 text-crimson" : "border-rule text-slate"}`}>{TARGET_LABEL[t]}</button>
                  );
                })}
              </div>
            </fieldset>
            {owner === "me" && (
              <div className="sm:col-span-2">
                <span className={label}>Only these items or courses (optional: paste their links, one per line)</span>
                <textarea value={form.items} onChange={(e) => set({ items: e.target.value })} rows={2} className={field} placeholder="Leave empty for everything above" />
              </div>
            )}
            <div>
              <span className={label}>Total uses (empty: no limit)</span>
              <input type="number" min={1} value={form.maxUses} onChange={(e) => set({ maxUses: e.target.value })} className={field} />
            </div>
            <div>
              <span className={label}>Uses per member</span>
              <input type="number" min={1} max={100} value={form.perBuyer} onChange={(e) => set({ perBuyer: e.target.value })} className={field} />
            </div>
            <div>
              <span className={label}>Starts (optional)</span>
              <input type="date" value={form.startsAt} onChange={(e) => set({ startsAt: e.target.value })} className={field} />
            </div>
            <div>
              <span className={label}>Ends (optional, at the end of that day)</span>
              <input type="date" value={form.endsAt} onChange={(e) => set({ endsAt: e.target.value })} className={field} />
            </div>
            <div>
              <span className={label}>Minimum order in ₦ (optional)</span>
              <input type="number" min={100} value={form.minNaira} onChange={(e) => set({ minNaira: e.target.value })} className={field} />
            </div>
            <label className="flex items-center gap-2 self-end pb-2 text-sm text-ink">
              <input type="checkbox" checked={form.firstOrderOnly} onChange={(e) => set({ firstOrderOnly: e.target.checked })} />
              Only for a first order {owner === "me" ? "from you" : "with #NotesApp"}
            </label>
          </div>
          <p className="mt-3 text-xs text-slate">A code never takes the price under ₦100, never touches delivery, and #NotesApp&apos;s commission is worked out on what the buyer actually pays.</p>
          <div className="mt-4 flex gap-2">
            <button type="button" onClick={save} disabled={busy} className="btn-primary !px-5 !py-2.5 text-sm">{busy ? "Saving…" : editing ? "Save changes" : "Create code"}</button>
            <button type="button" onClick={() => setForm(null)} className="btn-ghost !px-5 !py-2.5 text-sm">Cancel</button>
          </div>
        </div>
      )}

      <div className="mt-6">
        {codes === null ? <p className="text-sm text-slate">Loading…</p> : codes.length === 0 ? (
          <p className="text-sm text-slate">No codes yet. Make one and share it with your audience.</p>
        ) : (
          <ul className="space-y-3">
            {codes.map((c) => (
              <li key={c.id} className="card flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="flex items-center gap-2">
                    <b className="font-mono text-lg text-ink">{c.code}</b>
                    <span className={`rounded-full px-2 py-0.5 font-ui text-[11px] font-bold ${c.active ? "bg-moss/15 text-moss" : "bg-field text-slate"}`}>{c.active ? "ACTIVE" : "PAUSED"}</span>
                  </p>
                  <p className="mt-1 text-sm text-ink">{describeCode(c)} · {c.targets.map((t) => TARGET_LABEL[t]).join(", ")}{c.itemIds?.length ? ` · ${c.itemIds.length} item${c.itemIds.length > 1 ? "s" : ""}` : ""}</p>
                  <p className="mt-0.5 text-xs text-slate">
                    Used {c.uses}{c.maxUses != null ? ` of ${c.maxUses}` : ""} · took off {naira(c.discountGivenKobo)} · buyers paid {naira(c.revenueKobo)}
                    {c.endsAt ? ` · ends ${new Date(c.endsAt).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}` : ""}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => { setEditing(true); setForm(fromCode(c)); }} className="rounded-full border border-rule px-3 py-1.5 font-ui text-xs font-semibold text-ink hover:border-crimson">Edit</button>
                  <button type="button" onClick={() => toggle(c)} className="rounded-full border border-rule px-3 py-1.5 font-ui text-xs font-semibold text-ink hover:border-crimson">{c.active ? "Pause" : "Turn on"}</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {uses.length > 0 && (
        <div className="mt-8">
          <h3 className="font-display text-xl text-ink">Recent uses</h3>
          <ul className="mt-2 divide-y divide-rule text-sm">
            {uses.map((u, i) => (
              <li key={i} className="flex flex-wrap justify-between gap-2 py-2">
                <span><b className="font-mono">{u.code}</b> · {TARGET_LABEL[u.kind] ?? u.kind}{u.overUsed ? " · past its limit (two buyers at once)" : ""}</span>
                <span className="text-slate">−{naira(u.discountKobo)} · paid {naira(u.paidKobo)} · {new Date(u.at).toLocaleDateString("en-NG", { day: "numeric", month: "short" })}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
