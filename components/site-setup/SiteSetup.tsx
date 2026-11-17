"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { User } from "firebase/auth";
import { KITS, kitAllowed, kitOf, BLOCKS, BUTTON_KINDS, type ServiceItem, type Qa } from "@/lib/site-kits";
import { SITE_PALETTES, SITE_THEMES, themeAllowed, tierName, tierRank } from "@/lib/site-themes";
import { NANA_BUTTONS, PART_NAME, REDO_PARTS, SKIPPED, partHas, type Draft, type Part } from "@/lib/site-nana";
import { siteNana, type SetupView } from "./api";

// Nana sets up your site (docs/SITE_NANA.md): the interview, Nana's suggestion, her draft section by section, then a preview with what
// will change before anything reaches the site. Everything is saved on the server as it goes, so it can be left and picked up later.
type Stage = "choice" | "words" | "preview";
const rgb = (c: readonly number[]) => `rgb(${c.join(" ")})`;
const pal = (id: string) => SITE_PALETTES.find((p) => p.id === id) ?? SITE_PALETTES[0];

export default function SiteSetup({ user }: { user: User }) {
  const [v, setV] = useState<SetupView | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState<string>("");
  const [stage, setStage] = useState<Stage>("choice");
  const [done, setDone] = useState(false);

  useEffect(() => { siteNana<SetupView>(user).then(setV).catch((e) => setErr(e.message)); }, [user]);
  async function act(name: string, body: Record<string, unknown>, after?: (n: SetupView) => void) {
    setBusy(name); setErr("");
    try { const n = await siteNana<SetupView>(user, body); setV(n); after?.(n); if (n.notice) setErr(n.notice); }
    catch (e) { setErr(e instanceof Error ? e.message : "Something went wrong."); }
    finally { setBusy(""); }
  }

  if (!v) return <p className="py-16 text-center text-slate" role="status">{err || "Loading…"}</p>;
  const msg = err && <p className="mt-3 rounded-xl bg-[#FFF4D6] px-4 py-3 text-sm text-[#5a4300]" role="alert">{err}</p>;

  if (done) return <Done v={v} user={user} msg={msg} onUndo={() => act("undo", { action: "putback" }, () => setDone(false))} busy={busy} />;
  if (!v.draft) return <Interview v={v} busy={busy} msg={msg} act={act} />;
  const d = v.draft;
  const save = (next: Draft) => act("edit", { action: "edit", draft: next });
  if (stage === "choice") return <Choice v={v} d={d} busy={busy} msg={msg} save={save} next={() => setStage("words")} restart={() => act("restart", { action: "restart" })} />;
  if (stage === "words") return <Words d={d} busy={busy} msg={msg} save={save} redo={(part) => act(`redo-${part}`, { action: "redo", part })} back={() => setStage("choice")} next={() => setStage("preview")} />;
  return <Preview v={v} d={d} busy={busy} msg={msg} back={() => setStage("words")} apply={(replace) => act("apply", { action: "apply", replace }, () => setDone(true))} />;
}

// ── 1. The interview ──────────────────────────────────────────────────────────────────────────────────────────────────────────
function Interview({ v, busy, msg, act }: { v: SetupView; busy: string; msg: React.ReactNode; act: (n: string, b: Record<string, unknown>) => Promise<void> }) {
  const [text, setText] = useState("");
  const end = useRef<HTMLDivElement>(null);
  const q = v.next >= 0 ? v.questions[v.next] : null;
  useEffect(() => { end.current?.scrollIntoView({ block: "nearest" }); }, [v.next]);
  const send = async (answer: string) => { await act("answer", { action: "answer", q: q!.id, text: answer }); setText(""); };
  const total = v.questions.length;
  return (
    <section className="card p-5 sm:p-6">
      <div className="flex items-center justify-between text-sm"><span className="font-ui font-bold text-ink">Nana sets up your site</span><span className="text-slate">{Math.min(v.answered + 1, total)} of {total}</span></div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-rule"><i className="block h-full rounded-full bg-crimson" style={{ width: `${(v.answered / total) * 100}%` }} /></div>
      <ol className="mt-5 flex flex-col gap-3" aria-live="polite">
        {v.questions.slice(0, v.next >= 0 ? v.next : total).map((x) => (
          <li key={x.id} className="flex flex-col gap-2">
            <Bubble>{x.q}</Bubble>
            <p className={`max-w-[85%] self-end rounded-2xl rounded-br-md px-3.5 py-2.5 text-sm ${v.answers[x.id] === SKIPPED ? "bg-rule text-slate italic" : "bg-crimson text-paper"}`}>{v.answers[x.id] === SKIPPED ? "Skipped" : v.answers[x.id]}</p>
          </li>
        ))}
        {q && <li><Bubble>{q.q}{q.hint && <span className="mt-1 block text-xs text-slate">{q.hint}</span>}</Bubble></li>}
      </ol>
      <div ref={end} />
      {q ? (
        <div className="mt-4">
          {q.chips && (
            <div className="mb-3 flex flex-wrap gap-2">
              {q.chips.map((c) => <button key={c} type="button" disabled={!!busy} onClick={() => send(c)} className="rounded-full border border-rule bg-card px-3 py-1.5 text-xs font-semibold text-ink hover:border-crimson">{c}</button>)}
            </div>
          )}
          {q.id !== "use" && (
            <form onSubmit={(e) => { e.preventDefault(); if (text.trim()) send(text); }} className="flex gap-2">
              <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} maxLength={1200} aria-label={q.q} placeholder="Type your answer…"
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (text.trim()) send(text); } }}
                className="min-w-0 flex-1 resize-none rounded-2xl border border-rule bg-card px-4 py-2.5 text-sm text-ink" />
              <button type="submit" disabled={!!busy || !text.trim()} className="btn-primary !rounded-full !px-4 text-sm disabled:opacity-50" aria-label="Send">{busy === "answer" ? "…" : "➤"}</button>
            </form>
          )}
          <p className="mt-2 text-center text-xs text-slate">
            <button type="button" className="underline" disabled={!!busy} onClick={() => act("answer", { action: "answer", q: q.id, skip: true })}>Skip this question</button>
            {" · "}<Link href="/profile/site" className="underline">Stop and finish later</Link>
            {v.canDraft && <>{" · "}<button type="button" className="font-semibold text-crimson underline" disabled={!!busy} onClick={() => act("draft", { action: "draft" })}>Draft my site with what I&apos;ve said</button></>}
          </p>
        </div>
      ) : (
        <div className="mt-5 text-center">
          {v.canDraft ? <p className="text-sm text-slate">That&apos;s everything. Nana will choose a kit and look, and draft your words. Nothing goes on your site yet.</p>
            : <p className="text-sm text-slate">Nana needs to know what you do, and one more answer, to draft your site.</p>}
          {v.canDraft && <button type="button" disabled={!!busy} onClick={() => act("draft", { action: "draft" })} className="btn-primary mt-3 !px-5 !py-2.5 text-sm">{busy === "draft" ? "Nana is writing…" : "Draft my site"}</button>}
          <p className="mt-3 text-xs text-slate"><button type="button" className="underline" disabled={!!busy} onClick={() => act("restart", { action: "restart" })}>Start the questions again</button></p>
          {v.undo && <p className="mt-2 text-xs text-slate">Nana&apos;s last draft went on your site on {new Date(v.undo.at).toLocaleDateString("en-GB", { day: "numeric", month: "long" })}. <button type="button" className="font-semibold text-crimson underline" disabled={!!busy} onClick={() => act("undo", { action: "putback" })}>Put my old site back</button></p>}
        </div>
      )}
      {busy === "draft" && <p className="mt-3 text-center text-sm text-slate" role="status">Nana is choosing and writing. This takes about half a minute.</p>}
      {msg}
      <p className="mt-4 text-center text-xs text-slate">The questions are free. Nana&apos;s draft uses your Nana allowance.</p>
    </section>
  );
}
function Bubble({ children }: { children: React.ReactNode }) {
  return <p className="max-w-[88%] rounded-2xl rounded-bl-md border border-[#f0cbd6] bg-gradient-to-br from-card to-[#fbeff3] px-3.5 py-2.5 text-sm text-ink"><span className="block text-[11px] font-bold text-crimson">NANA</span>{children}</p>;
}

// ── 2. Nana's suggestion ──────────────────────────────────────────────────────────────────────────────────────────────────────
function Choice({ v, d, busy, msg, save, next, restart }: { v: SetupView; d: Draft; busy: string; msg: React.ReactNode; save: (d: Draft) => Promise<void>; next: () => void; restart: () => void }) {
  const kit = kitOf(d.kit)!;
  const look = SITE_THEMES.find((t) => t.id === d.theme)!;
  const [edit, setEdit] = useState<"" | "kit" | "look" | "button">("");
  const box = "rounded-2xl border border-rule bg-card p-4";
  const small = "text-[11px] font-bold uppercase tracking-wide text-slate";
  const wantedKit = d.wanted?.kit ? kitOf(d.wanted.kit) : null;
  const wantedLook = d.wanted?.theme ? SITE_THEMES.find((t) => t.id === d.wanted!.theme) : null;
  return (
    <section className="card p-5 sm:p-6">
      <h2 className="font-display text-2xl text-ink">Here&apos;s what I&apos;d choose</h2>
      <div className="mt-4 flex flex-col gap-3">
        <div className={box}>
          <p className={small}>Kit</p>
          <p className="mt-1 font-ui text-sm font-bold text-ink">{kit.emoji} {kit.name}</p>
          {d.why.kit && <p className="mt-0.5 text-sm text-slate">{d.why.kit}</p>}
          {edit === "kit" ? (
            <select className="mt-2 w-full rounded-xl border border-rule bg-card px-3 py-2 text-sm" value={d.kit} onChange={(e) => { setEdit(""); save({ ...d, kit: e.target.value, theme: kitOf(e.target.value)!.theme }); }} aria-label="Kit">
              {KITS.filter((k) => kitAllowed(k, v.tier)).map((k) => <option key={k.id} value={k.id}>{k.emoji} {k.name}</option>)}
            </select>
          ) : <button type="button" onClick={() => setEdit("kit")} className="mt-2 rounded-full border border-rule px-3 py-1 text-xs font-semibold">Change</button>}
        </div>
        <div className={box}>
          <p className={small}>Look and colours</p>
          <p className="mt-1 font-ui text-sm font-bold text-ink">{look.name}, on {pal(d.palette).name}</p>
          {d.why.look && <p className="mt-0.5 text-sm text-slate">{d.why.look}</p>}
          <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label="Colour set">
            {SITE_PALETTES.map((p) => (
              <button key={p.id} type="button" role="radio" aria-checked={p.id === d.palette} aria-label={p.name} onClick={() => p.id !== d.palette && save({ ...d, palette: p.id })}
                className={`h-7 w-7 rounded-full ${p.id === d.palette ? "ring-2 ring-ink ring-offset-2" : ""}`} style={{ background: rgb(p.base) }} />
            ))}
          </div>
          {edit === "look" ? (
            <select className="mt-2 w-full rounded-xl border border-rule bg-card px-3 py-2 text-sm" value={d.theme} onChange={(e) => { setEdit(""); save({ ...d, theme: e.target.value as Draft["theme"] }); }} aria-label="Look">
              {SITE_THEMES.filter((t) => themeAllowed(t.id, v.tier)).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          ) : <button type="button" onClick={() => setEdit("look")} className="mt-2 rounded-full border border-rule px-3 py-1 text-xs font-semibold">Change the look</button>}
        </div>
        <div className={box}>
          <p className={small}>Main button</p>
          <p className="mt-1 font-ui text-sm font-bold text-ink">{d.button.label} → {buttonGoes(d.button.kind)}</p>
          {d.second && <p className="text-sm text-slate">Second button: {d.second.label}.</p>}
          {d.why.button && <p className="mt-0.5 text-sm text-slate">{d.why.button}</p>}
          {edit === "button" ? (
            <div className="mt-2 flex flex-wrap gap-2">
              <select className="rounded-xl border border-rule bg-card px-3 py-2 text-sm" value={d.button.kind} aria-label="Where the button goes"
                onChange={(e) => save({ ...d, button: { kind: e.target.value as Draft["button"]["kind"], label: BUTTON_KINDS.find((k) => k.id === e.target.value)!.label, value: "" } })}>
                {NANA_BUTTONS.filter((k) => (k !== "book" || v.can.book) && (k !== "shop" || v.can.shop)).map((k) => <option key={k} value={k}>{buttonGoes(k)}</option>)}
              </select>
              <LabelField value={d.button.label} onSave={(label) => { setEdit(""); return save({ ...d, button: { ...d.button, label } }); }} />
            </div>
          ) : <button type="button" onClick={() => setEdit("button")} className="mt-2 rounded-full border border-rule px-3 py-1 text-xs font-semibold">Change</button>}
        </div>
        <div className={box}>
          <p className={small}>Sections, in order</p>
          <p className="mt-1 text-sm text-ink">{d.order.map((id) => BLOCKS.find((b) => b.id === id)?.name).filter(Boolean).join(" · ")}</p>
        </div>
        {(wantedKit || wantedLook) && (
          <p className="rounded-xl border border-[#F3C8A2] bg-[#FFF1E6] px-4 py-3 text-sm text-[#5a2e00]">
            🔒 I&apos;d have chosen {[wantedKit && `the ${wantedKit.name} kit`, wantedLook && `the ${wantedLook.name} look`].filter(Boolean).join(" and ")}, which {wantedKit && wantedLook ? "need" : "needs"} {kitTierNote(wantedKit, wantedLook)}. On {tierName(v.tier === "standard" ? "basic" : v.tier)} I&apos;ve used {kit.name} with the {look.name} look. <Link href="/pricing" className="font-semibold underline">See the plans</Link>
          </p>
        )}
      </div>
      {msg}
      <button type="button" onClick={next} disabled={!!busy} className="btn-primary mt-5 w-full !py-3 text-sm">Looks right: show me the words</button>
      <p className="mt-3 text-center text-xs text-slate"><button type="button" className="underline" onClick={restart} disabled={!!busy}>Start again</button> · <Link href="/profile/site" className="underline">Pick a kit myself</Link></p>
    </section>
  );
}
// The plan Nana's first choice needs: the higher of the kit's and the look's.
function kitTierNote(k: { minTier: string } | null, t: { minTier: string } | null | undefined): string {
  const tiers = [k?.minTier, t?.minTier].filter((x): x is string => !!x).sort((a, b) => tierRank(b) - tierRank(a));
  return tierName(tiers[0] ?? "pro");
}
const buttonGoes = (k: string) => ({ book: "your booking calendar", shop: "your shop", call: "a phone call", contact: "your Contact page", services: "your price list" } as Record<string, string>)[k] ?? k;
function LabelField({ value, onSave }: { value: string; onSave: (v: string) => Promise<void> }) {
  const [x, setX] = useState(value);
  return (
    <span className="flex gap-2">
      <input value={x} onChange={(e) => setX(e.target.value)} maxLength={30} aria-label="Button words" className="w-40 rounded-xl border border-rule bg-card px-3 py-2 text-sm" />
      <button type="button" disabled={!x.trim()} onClick={() => onSave(x.trim())} className="btn-primary !px-3 !py-2 text-xs">Save</button>
    </span>
  );
}

// ── 3. The draft, part by part ────────────────────────────────────────────────────────────────────────────────────────────────
function Words({ d, busy, msg, save, redo, back, next }: { d: Draft; busy: string; msg: React.ReactNode; save: (d: Draft) => Promise<void>; redo: (p: Part) => void; back: () => void; next: () => void }) {
  const parts = (["hero", "services", "faq", "info", "about"] as Part[]).filter((p) => partHas(d, p));
  const kept = parts.filter((p) => d.keep[p]).length;
  const [open, setOpen] = useState<Part | "">("");
  const keep = (p: Part, on: boolean) => save({ ...d, keep: { ...d.keep, [p]: on } });
  return (
    <section className="card p-5 sm:p-6">
      <div className="flex items-baseline justify-between"><h2 className="font-display text-2xl text-ink">Your draft</h2><span className="text-sm text-slate">{kept} of {parts.length} kept</span></div>
      <p className="mt-1 text-sm text-slate">Keep, edit or skip each part. Nana only used what you told her: where you gave no price, it says &ldquo;Add a price&rdquo;.</p>
      <div className="mt-4 flex flex-col gap-3">
        {parts.map((p) => (
          <div key={p} className={`rounded-2xl border bg-card p-4 ${d.keep[p] ? "border-rule" : "border-dashed border-rule opacity-70"}`}>
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate">{PART_NAME[p]}</p>
            {open === p ? <PartEditor p={p} d={d} onSave={async (n) => { await save(n); setOpen(""); }} onCancel={() => setOpen("")} /> : <PartView p={p} d={d} onPrice={(i, price) => save({ ...d, services: d.services.map((s, j) => (j === i ? { ...s, price } : s)) })} />}
            {open !== p && (
              <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
                <button type="button" disabled={!!busy} onClick={() => keep(p, !d.keep[p])} aria-pressed={d.keep[p]}
                  className={`rounded-full border px-3 py-1 ${d.keep[p] ? "border-[#0F8B8D] bg-[#0F8B8D] text-white" : "border-rule"}`}>{d.keep[p] ? "✓ Kept" : "Keep"}</button>
                <button type="button" disabled={!!busy} onClick={() => setOpen(p)} className="rounded-full border border-rule px-3 py-1">Edit</button>
                {REDO_PARTS.includes(p) && <button type="button" disabled={!!busy} onClick={() => redo(p)} className="rounded-full border border-rule px-3 py-1">{busy === `redo-${p}` ? "Writing…" : "Try another"}</button>}
                {d.keep[p] && <button type="button" disabled={!!busy} onClick={() => keep(p, false)} className="rounded-full border border-rule px-3 py-1">Skip</button>}
              </div>
            )}
          </div>
        ))}
        <div className="rounded-2xl border border-rule bg-card p-4">
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate">What customers say</p>
          <p className="mt-1 text-sm text-slate">Nana doesn&apos;t write reviews for you. Add real ones from customers under Testimonials on Your site.</p>
        </div>
      </div>
      {msg}
      <button type="button" onClick={next} disabled={!!busy || kept === 0} className="btn-primary mt-5 w-full !py-3 text-sm">See it before it goes on my site</button>
      <p className="mt-3 text-center text-xs text-slate"><button type="button" className="underline" onClick={back}>Back to the kit and look</button></p>
    </section>
  );
}
function PartView({ p, d, onPrice }: { p: Part; d: Draft; onPrice: (i: number, price: string) => void }) {
  if (p === "hero") return (<>{d.hero.eyebrow && <p className="mt-1 text-xs uppercase tracking-wide text-slate">{d.hero.eyebrow}</p>}<p className="mt-1 font-display text-lg leading-snug text-ink">{d.hero.headline}</p><p className="mt-1 text-sm text-slate">{d.hero.subline}</p></>);
  if (p === "services") return (
    <ul className="mt-1 divide-y divide-dashed divide-rule text-sm">
      {d.services.map((s, i) => (
        <li key={i} className="flex items-center justify-between gap-3 py-1.5">
          <span className="text-ink">{s.name}{s.group && <span className="text-xs text-slate"> · {s.group}</span>}</span>
          {s.price ? <b className="shrink-0">{s.price}</b> : <PriceField onSave={(x) => onPrice(i, x)} />}
        </li>
      ))}
    </ul>
  );
  if (p === "faq") return <ul className="mt-1 space-y-2 text-sm">{d.faq.map((f, i) => <li key={i}><b className="text-ink">{f.q}</b><br /><span className="text-slate">{f.a}</span></li>)}</ul>;
  if (p === "info") return <ul className="mt-1 space-y-0.5 text-sm text-ink">{d.info.hours && <li>🕘 {d.info.hours}</li>}{d.info.address && <li>📍 {d.info.address}</li>}{d.info.phone && <li>📞 {d.info.phone}</li>}{d.info.whatsapp && <li>💬 {d.info.whatsapp}</li>}{d.info.email && <li>✉️ {d.info.email}</li>}<li className="text-xs text-slate">Fills only the hours and contacts you haven&apos;t filled in.</li></ul>;
  return <p className="mt-1 whitespace-pre-line text-sm text-ink">{d.about}</p>;
}
function PriceField({ onSave }: { onSave: (v: string) => void }) {
  const [on, setOn] = useState(false);
  const [x, setX] = useState("");
  if (!on) return <button type="button" onClick={() => setOn(true)} className="shrink-0 font-bold text-[#8c4a00]">Add a price</button>;
  return <form className="flex shrink-0 gap-1" onSubmit={(e) => { e.preventDefault(); if (x.trim()) onSave(x.trim()); }}><input autoFocus value={x} onChange={(e) => setX(e.target.value)} placeholder="₦…" aria-label="Price" maxLength={40} className="w-28 rounded-lg border border-rule px-2 py-1 text-sm" /><button className="btn-primary !px-2 !py-1 text-xs">Save</button></form>;
}
function PartEditor({ p, d, onSave, onCancel }: { p: Part; d: Draft; onSave: (d: Draft) => Promise<void>; onCancel: () => void }) {
  const [x, setX] = useState<Draft>(structuredClone(d));
  const field = "w-full rounded-xl border border-rule bg-card px-3 py-2 text-sm";
  const body = (() => {
    if (p === "hero") return (<div className="mt-2 space-y-2">
      <input className={field} value={x.hero.eyebrow} maxLength={40} placeholder="Small line above (optional)" aria-label="Small line above the headline" onChange={(e) => setX({ ...x, hero: { ...x.hero, eyebrow: e.target.value } })} />
      <input className={field} value={x.hero.headline} maxLength={90} aria-label="Headline" onChange={(e) => setX({ ...x, hero: { ...x.hero, headline: e.target.value } })} />
      <textarea className={field} rows={2} value={x.hero.subline} maxLength={240} aria-label="Line under the headline" onChange={(e) => setX({ ...x, hero: { ...x.hero, subline: e.target.value } })} />
    </div>);
    if (p === "services") return (<div className="mt-2 space-y-2">
      {x.services.map((s, i) => (
        <div key={i} className="flex gap-2">
          <input className={field} value={s.name} maxLength={80} aria-label={`Item ${i + 1}`} onChange={(e) => setX({ ...x, services: x.services.map((y, j): ServiceItem => (j === i ? { ...y, name: e.target.value } : y)) })} />
          <input className={`${field} !w-32`} value={s.price} maxLength={40} placeholder="₦…" aria-label={`Price of item ${i + 1}`} onChange={(e) => setX({ ...x, services: x.services.map((y, j): ServiceItem => (j === i ? { ...y, price: e.target.value } : y)) })} />
          <button type="button" aria-label={`Remove item ${i + 1}`} onClick={() => setX({ ...x, services: x.services.filter((_, j) => j !== i) })} className="px-2 text-slate">✕</button>
        </div>
      ))}
      <button type="button" onClick={() => setX({ ...x, services: [...x.services, { name: "", price: "", note: "" }] })} className="text-xs font-semibold text-crimson">+ Add an item</button>
    </div>);
    if (p === "faq") return (<div className="mt-2 space-y-3">
      {x.faq.map((f, i) => (
        <div key={i} className="space-y-1">
          <input className={field} value={f.q} maxLength={160} aria-label={`Question ${i + 1}`} onChange={(e) => setX({ ...x, faq: x.faq.map((y, j): Qa => (j === i ? { ...y, q: e.target.value } : y)) })} />
          <textarea className={field} rows={2} value={f.a} maxLength={800} aria-label={`Answer ${i + 1}`} onChange={(e) => setX({ ...x, faq: x.faq.map((y, j): Qa => (j === i ? { ...y, a: e.target.value } : y)) })} />
          <button type="button" onClick={() => setX({ ...x, faq: x.faq.filter((_, j) => j !== i) })} className="text-xs text-slate underline">Remove</button>
        </div>
      ))}
    </div>);
    if (p === "info") return (<div className="mt-2 grid gap-2 sm:grid-cols-2">
      {(["hours", "address", "phone", "whatsapp", "email"] as const).map((k) => <input key={k} className={field} value={x.info[k]} placeholder={k === "whatsapp" ? "WhatsApp" : k[0].toUpperCase() + k.slice(1)} aria-label={k} onChange={(e) => setX({ ...x, info: { ...x.info, [k]: e.target.value } })} />)}
    </div>);
    return <textarea className={`${field} mt-2`} rows={8} value={x.about} maxLength={2500} aria-label="About page" onChange={(e) => setX({ ...x, about: e.target.value })} />;
  })();
  return (<>{body}<div className="mt-3 flex gap-2 text-xs font-semibold"><button type="button" onClick={() => onSave({ ...x, keep: { ...x.keep, [p]: true } })} className="btn-primary !px-3 !py-1.5 text-xs">Save</button><button type="button" onClick={onCancel} className="rounded-full border border-rule px-3 py-1">Cancel</button></div></>);
}

// ── 4. See it first ───────────────────────────────────────────────────────────────────────────────────────────────────────────
function Preview({ v, d, busy, msg, back, apply }: { v: SetupView; d: Draft; busy: string; msg: React.ReactNode; back: () => void; apply: (r: Partial<Record<Part, boolean>>) => void }) {
  const [tab, setTab] = useState<"now" | "draft">("draft");
  const [replace, setReplace] = useState<Partial<Record<Part, boolean>>>(() => Object.fromEntries(v.changes.filter((c) => c.kind === "replace").map((c) => [c.part, v.replace[c.part]])));
  const p = pal(d.palette);
  const cur = v.current.site.blocks;
  const showing = tab === "draft"
    ? { eyebrow: d.keep.hero ? d.hero.eyebrow : "", headline: d.keep.hero && (replace.hero ?? true) ? d.hero.headline : cur.hero.headline || d.hero.headline, button: d.button.label, second: d.second?.label, services: d.keep.services && (replace.services ?? true) ? d.services : cur.services.items }
    : { eyebrow: cur.hero.eyebrow ?? "", headline: cur.hero.headline, button: cur.hero.button?.label, second: cur.hero.second?.label, services: cur.services.items };
  const fills = v.changes.filter((c) => c.kind === "fill");
  const reps = v.changes.filter((c) => c.kind === "replace");
  return (
    <section className="card p-5 sm:p-6">
      <h2 className="font-display text-2xl text-ink">Before it goes on your site</h2>
      <div className="mt-4 flex rounded-full bg-field p-1 text-sm font-bold" role="tablist">
        {(["now", "draft"] as const).map((t) => <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`flex-1 rounded-full py-1.5 ${tab === t ? "bg-card text-crimson shadow" : "text-slate"}`}>{t === "now" ? "Now" : "With Nana's draft"}</button>)}
      </div>
      <div className="mt-3 overflow-hidden rounded-2xl border border-rule bg-card">
        <div className="flex min-h-[130px] flex-col justify-end p-4 text-white" style={{ background: `linear-gradient(135deg, ${rgb(p.bright)}, ${rgb(p.deep)})` }}>
          {showing.eyebrow && <span className="text-[11px] uppercase tracking-wide opacity-90">{showing.eyebrow}</span>}
          <b className="font-display text-lg leading-snug">{showing.headline || "(no headline)"}</b>
          <div className="mt-2 flex gap-2 text-xs font-bold">
            {showing.button && <span className="rounded-full bg-white px-3 py-1" style={{ color: rgb(p.base) }}>{showing.button}</span>}
            {showing.second && <span className="rounded-full border border-white/70 px-3 py-1">{showing.second}</span>}
          </div>
        </div>
        {showing.services.length > 0 && (
          <ul className="p-3 text-sm">{showing.services.slice(0, 4).map((s, i) => <li key={i} className="flex justify-between gap-2 py-0.5"><span>{s.name}</span><b>{s.price || "—"}</b></li>)}</ul>
        )}
      </div>
      <div className="mt-4 rounded-2xl border border-rule bg-card p-4 text-sm">
        <p className="font-ui font-bold text-ink">What will change</p>
        <p className="mt-1 text-slate">The {kitOf(d.kit)!.name} kit, the {SITE_THEMES.find((t) => t.id === d.theme)!.name} look and {p.name}.</p>
        {fills.length > 0 && <p className="mt-1">➕ {fills.length} part{fills.length === 1 ? "" : "s"} filled in that {fills.length === 1 ? "was" : "were"} empty: {fills.map((c) => c.label).join(", ")}.</p>}
        {reps.map((c) => (
          <div key={c.part} className="mt-3">
            <label className="flex items-center justify-between gap-3">
              <span>✏️ Replace my {c.label.toLowerCase()}</span>
              <input type="checkbox" role="switch" checked={replace[c.part] === true} onChange={(e) => setReplace({ ...replace, [c.part]: e.target.checked })} className="h-5 w-5 accent-[rgb(var(--c-crimson))]" />
            </label>
            <p className="mt-1.5 rounded-lg border border-[#f3c6cf] bg-[#fff1f3] px-3 py-1.5 text-xs text-[#6b2a37] line-through">{c.was}</p>
            <p className="mt-1 rounded-lg border border-[#b9e2d1] bg-[#e9f7f1] px-3 py-1.5 text-xs font-semibold text-[#17694a]">{c.now}</p>
          </div>
        ))}
        {reps.length > 0 && <p className="mt-3 text-xs text-slate">Words you wrote yourself are kept unless you switch them on here.</p>}
      </div>
      {msg}
      <button type="button" disabled={!!busy} onClick={() => apply(replace)} className="btn-primary mt-5 w-full !py-3 text-sm">{busy === "apply" ? "Putting it on…" : "Put it on my site"}</button>
      <p className="mt-2 text-center text-xs text-slate">You can put your site back as it was for 30 days. <button type="button" className="underline" onClick={back}>Back to the words</button></p>
    </section>
  );
}

// ── 5. Done ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────
function Done({ v, msg, onUndo, busy }: { v: SetupView; user: User; msg: React.ReactNode; onUndo: () => void; busy: string }) {
  return (
    <section className="card p-6 text-center">
      <p className="text-4xl" aria-hidden>🎉</p>
      <h2 className="mt-2 font-display text-2xl text-ink">Your site is updated</h2>
      <p className="mt-2 text-sm text-slate">Add a photo and anything Nana left for you to fill in, then see what&apos;s still holding visitors back.</p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        <a href={`/s/${v.current.username}`} target="_blank" rel="noopener noreferrer" className="btn-primary !px-4 !py-2 text-sm">View my site</a>
        <Link href="/profile/site/review" className="rounded-full border border-rule px-4 py-2 text-sm font-semibold">Review my site</Link>
        <Link href="/profile/site" className="rounded-full border border-rule px-4 py-2 text-sm font-semibold">Back to Your site</Link>
      </div>
      {v.undo && <p className="mt-4 text-xs text-slate">Changed your mind? <button type="button" disabled={!!busy} onClick={onUndo} className="font-semibold text-crimson underline">{busy === "undo" ? "Putting it back…" : "Put my old site back"}</button></p>}
      {msg}
    </section>
  );
}
