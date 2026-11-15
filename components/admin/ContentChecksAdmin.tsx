"use client";

import { useCallback, useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { CATEGORY_TAG, KIND_LABEL, itemWords, type CheckSettings, type ContentKind, type Finding, type FoundCategory } from "@/lib/content-checks";

// Admin → Reports → Content checks (screen 3 of the approved mockups): today's numbers, the review queue (held by the check, or appealed)
// with Restore / Keep blocked, this week's strikes, the figures (super admins), and for the Legal team the child-safety queue.
type Row = {
  id: string; username: string; kind: ContentKind; label: string; status: string; strike: boolean; teen: boolean; finding: Finding | null;
  where: { cid?: string; href?: string } | null; createdAt: string; appeal: { text: string } | null; items: { name: string; url?: string; text?: string }[]; legal: boolean;
};
type Data = {
  today: { checked: number; blocked: number; held: number; queued: number }; week: { strikes: number; suspended: number; banned: number; overturned: number };
  waitingRecheck: number; queue: Row[]; legal: { id: string; uid: string; kind?: string; ban: boolean; createdAt: string }[] | null; settings: CheckSettings;
  canEditSettings: boolean; legalTeam: boolean;
};
const TAG_COLOUR: Partial<Record<FoundCategory, string>> = { sexual: "bg-[#FBD3DC] text-[#8c0026]", violence: "bg-[#FDE68A] text-[#7a4b00]", gore: "bg-[#FDE68A] text-[#7a4b00]", hate: "bg-[#E9D5FF] text-[#5b21b6]" };
const ago = (iso: string) => {
  const h = (Date.now() - Date.parse(iso)) / 3_600_000;
  return h < 1 ? `${Math.max(1, Math.round(h * 60))} min ago` : h < 48 ? `${Math.round(h)} h ago` : `${Math.round(h / 24)} days ago`;
};
const FIELDS: { k: keyof CheckSettings; label: string; step?: string }[] = [
  { k: "blockAt", label: "Block at (sure, 0–1)", step: "0.01" }, { k: "reviewAt", label: "Send to review at", step: "0.01" },
  { k: "teenBlockAt", label: "Teens: block at", step: "0.01" }, { k: "teenReviewAt", label: "Teens: review at", step: "0.01" },
  { k: "csamBanAt", label: "Child safety: ban at", step: "0.01" }, { k: "strikesToSuspend", label: "Strikes before a suspension" },
  { k: "windowDays", label: "Days a strike counts" }, { k: "suspendDays", label: "Days posting is paused" }, { k: "communityStrikes", label: "Community: strikes before a warning" },
];

export default function ContentChecksAdmin({ user }: { user: User }) {
  const [d, setD] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [form, setForm] = useState<Record<string, string>>({});
  const [ref, setRef] = useState<Record<string, string>>({});
  const call = useCallback(async (init?: RequestInit) => {
    const r = await fetch("/api/admin/content-checks", { ...init, headers: { Authorization: `Bearer ${await user.getIdToken()}`, "Content-Type": "application/json" }, cache: "no-store" });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || "Something went wrong");
    return j;
  }, [user]);
  const load = useCallback(() => { call().then((j: Data) => { setD(j); setForm(Object.fromEntries(Object.entries(j.settings).map(([k, v]) => [k, String(v)]))); }, (e) => setError(e.message)); }, [call]);
  useEffect(() => { load(); }, [load]);
  async function act(key: string, body: Record<string, unknown>) {
    setBusy(key); setError("");
    try { await call({ method: "POST", body: JSON.stringify(body) }); load(); } catch (e) { setError(e instanceof Error ? e.message : "Something went wrong"); } finally { setBusy(""); }
  }
  if (!d) return error ? <p className="mt-6 text-sm text-red-700" role="alert">{error}</p> : <p className="mt-6 text-slate">Loading…</p>;
  const pct = d.today.checked ? ` (${((d.today.blocked / d.today.checked) * 100).toFixed(1)}%)` : "";
  return (
    <div className="mt-6 grid gap-6">
      {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[[d.today.checked.toLocaleString("en-NG"), "checked today"], [`${d.today.blocked}`, `blocked${pct}`], [`${d.today.held}`, "sent to review today"], [`${d.waitingRecheck}`, "waiting for a re-check"]].map(([n, l]) => (
          <div key={l} className="rounded-2xl border border-rule bg-card p-3"><b className="block font-display text-2xl text-ink">{n}</b><span className="text-xs text-slate">{l}</span></div>
        ))}
      </div>

      <section>
        <h2 className="font-ui text-sm font-bold text-ink">Waiting for review · {d.queue.length}</h2>
        {!d.queue.length && <p className="mt-2 text-sm text-slate">Nothing waiting. Held and appealed posts show here.</p>}
        <ul className="mt-2 grid gap-3">
          {d.queue.map((r) => {
            const f = r.finding;
            const tag = f && f.category !== "none" ? CATEGORY_TAG[f.category] : r.kind === "community" ? "Community" : "Re-check";
            return (
              <li key={r.id} className="rounded-xl border border-rule bg-card p-3 text-sm">
                <p className="text-ink">
                  <span className={`mr-1.5 inline-block rounded-md px-1.5 py-px text-[11px] font-bold ${(f && TAG_COLOUR[f.category]) ?? "bg-field text-ink"}`}>{tag}</span>
                  @{r.username || "member"} · {KIND_LABEL[r.kind] ?? r.kind}{r.where?.cid ? ` in “${r.where.cid}”` : ""} · {ago(r.createdAt)}{r.teen ? " · teen" : ""}
                  {r.status === "appealed" && <span className="ml-1.5 rounded-md bg-amber-500/15 px-1.5 py-px text-[11px] font-bold">Appeal</span>}
                </p>
                <p className="mt-1 text-slate">“{r.label}”{f ? ` · AI: ${f.context !== "none" ? `${f.context} ${f.item.startsWith("picture") ? "photo" : "item"}, ` : ""}${f.confidence.toFixed(2)} sure, ${itemWords(f.item)}` : ""}{f?.reason ? ` · ${f.reason}` : ""}</p>
                {r.appeal?.text && <p className="mt-1 text-slate">Their appeal: “{r.appeal.text}”</p>}
                <div className="mt-2 flex flex-wrap gap-2">
                  {r.items.filter((i) => i.url).slice(0, 6).map((i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <a key={i.url} href={i.url} target="_blank" rel="noreferrer" title={i.name}><img src={i.url} alt={i.name} className={`h-20 w-20 rounded-lg object-cover ${f?.item === i.name ? "ring-2 ring-crimson" : ""}`} /></a>
                  ))}
                </div>
                {r.items.find((i) => i.text) && <details className="mt-1"><summary className="cursor-pointer text-xs text-slate">The text</summary><p className="mt-1 whitespace-pre-wrap text-xs text-ink">{r.items.find((i) => i.text)!.text}</p></details>}
                {r.where?.href && <a href={r.where.href} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs text-crimson underline">Where it was posted</a>}
                <div className="mt-2 flex flex-wrap gap-2">
                  <button disabled={!!busy} onClick={() => act(r.id, { action: "restore", id: r.id })} className="rounded-full border border-rule px-3 py-1 text-xs font-semibold text-ink hover:border-crimson disabled:opacity-40">{r.strike ? "Restore and clear strike" : "Restore"}</button>
                  <button disabled={!!busy} onClick={() => act(r.id, { action: "keep", id: r.id })} className="rounded-full bg-crimson px-3 py-1 text-xs font-semibold text-white disabled:opacity-40">Keep blocked</button>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section>
        <h2 className="font-ui text-sm font-bold text-ink">Strikes this week</h2>
        <div className="mt-2 rounded-2xl border border-rule bg-card px-4 text-sm">
          {[["New strikes", d.week.strikes], ["Posting paused", d.week.suspended], ["Accounts closed", d.week.banned], ["Overturned on review", d.week.overturned]].map(([l, n], i) => (
            <div key={String(l)} className={`flex justify-between py-2 ${i ? "border-t border-rule" : ""}`}><span>{l}</span><b>{n}</b></div>
          ))}
        </div>
      </section>

      {d.legal && (
        <section>
          <h2 className="font-ui text-sm font-bold text-ink">Legal team: child safety · {d.legal.length}</h2>
          <p className="mt-1 text-xs text-slate">Never open or share these files outside the reporting process. Report to NCMEC (CyberTipline) and the Nigerian authorities as set out in docs/CONTENT_CHECKS.md, then record the reference here.</p>
          <ul className="mt-2 grid gap-2">
            {d.legal.map((l) => (
              <li key={l.id} className="rounded-xl border border-rule bg-card p-3 text-sm">
                <p className="text-ink">{l.ban ? "Account closed" : "Held for Legal"} · {KIND_LABEL[(l.kind ?? "") as ContentKind] ?? "post"} · {ago(l.createdAt)} · member {l.uid}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <input value={ref[l.id] ?? ""} onChange={(e) => setRef({ ...ref, [l.id]: e.target.value })} placeholder="Report reference" className="min-w-0 flex-1 rounded border border-rule px-2 py-1 text-xs" />
                  <button disabled={!!busy} onClick={() => act(l.id, { action: "legal", id: l.id, step: "reported", reference: ref[l.id] ?? "" })} className="rounded-full bg-crimson px-3 py-1 text-xs font-semibold text-white disabled:opacity-40">Reported</button>
                  {!l.ban && <button disabled={!!busy} onClick={() => act(l.id, { action: "legal", id: l.id, step: "keep" })} className="rounded-full border border-rule px-3 py-1 text-xs font-semibold disabled:opacity-40">Keep blocked</button>}
                  <button disabled={!!busy} onClick={() => act(l.id, { action: "legal", id: l.id, step: "not_csam" })} className="rounded-full border border-rule px-3 py-1 text-xs font-semibold disabled:opacity-40">Not child abuse: restore</button>
                </div>
              </li>
            ))}
            {!d.legal.length && <li className="text-sm text-slate">Nothing open.</li>}
          </ul>
        </section>
      )}

      <section>
        <h2 className="font-ui text-sm font-bold text-ink">The figures</h2>
        <p className="mt-1 text-xs text-slate">Help text never prints these. Teens&apos; levels must be the same or lower (stricter). {d.canEditSettings ? "" : "Only super admins change them."}</p>
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <label className="flex items-center gap-2 text-sm sm:col-span-3"><input type="checkbox" disabled={!d.canEditSettings} checked={form.enabled === "true"} onChange={(e) => setForm({ ...form, enabled: String(e.target.checked) })} /> Content checks on</label>
          {FIELDS.map((x) => (
            <label key={x.k} className="text-xs text-slate">{x.label}
              <input type="number" step={x.step ?? "1"} disabled={!d.canEditSettings} value={form[x.k] ?? ""} onChange={(e) => setForm({ ...form, [x.k]: e.target.value })} className="mt-1 w-full rounded border border-rule bg-card px-2 py-1 text-sm text-ink" />
            </label>
          ))}
        </div>
        {d.canEditSettings && <button disabled={!!busy} onClick={() => act("settings", { action: "settings", settings: { ...Object.fromEntries(FIELDS.map((x) => [x.k, Number(form[x.k])])), enabled: form.enabled === "true" } })} className="btn-primary mt-3 disabled:opacity-50">{busy === "settings" ? "Saving…" : "Save the figures"}</button>}
      </section>
    </div>
  );
}
