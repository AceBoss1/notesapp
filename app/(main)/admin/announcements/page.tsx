"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAdminAuth } from "@/lib/useAdminAuth";
import { useAdminCall } from "@/lib/useAdminCall";
import { ANNOUNCEMENT_LIMITS, type Announcement, type AnnouncementInput } from "@/lib/announcements";

const EMPTY: AnnouncementInput = { title: "", bell: "", subject: "", preheader: "", body: "", linkLabel: "", linkUrl: "" };
const pick = (a: AnnouncementInput): AnnouncementInput => ({ title: a.title, bell: a.bell, subject: a.subject, preheader: a.preheader, body: a.body, linkLabel: a.linkLabel, linkUrl: a.linkUrl });
const when = (iso?: string) => (iso ? new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Africa/Lagos" }) : "");
const field = "mt-1 w-full border border-rule bg-paper px-3 py-2 font-body text-sm focus:border-crimson outline-none";

// Admin → Announcements (lib/announcements-server.ts): write a message, see it as members will, send it to yourself, then to everyone:
// a bell to every member and an email to members whose email choices allow it. Owner and super admins only.
export default function AdminAnnouncementsPage() {
  const { user, loading } = useAdminAuth();
  const call = useAdminCall(user, "/api/admin/announcements");
  const [list, setList] = useState<Announcement[] | null>(null);
  const [ready, setReady] = useState<{ emailReady: boolean; linkSecret: boolean } | null>(null);
  const [current, setCurrent] = useState<Announcement | null>(null);
  const [form, setForm] = useState<AnnouncementInput>(EMPTY);
  const [preview, setPreview] = useState<{ html: string; subject: string; preheader: string } | null>(null);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  const run = useCallback(async (label: string, fn: () => Promise<void>) => {
    setBusy(label); setError(""); setMsg("");
    try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : "Something went wrong"); } finally { setBusy(""); }
  }, []);
  const open = (a: Announcement | null) => { setCurrent(a); setForm(a ? pick(a) : EMPTY); setPreview(null); };
  const load = useCallback(async (keep?: string) => {
    const j = await call();
    setList(j.announcements); setReady(j.ready);
    const a = (j.announcements as Announcement[]).find((x) => x.id === keep) ?? (j.announcements as Announcement[]).find((x) => x.status !== "sent") ?? j.announcements[0] ?? null;
    open(a);
  }, [call]);
  useEffect(() => { if (user) void run("load", () => load()); }, [user, load, run]);

  const showPreview = () => run("preview", async () => { const j = await call({ action: "preview", ...form }); setPreview(j); });
  // Show the draft as members will see it as soon as it opens.
  useEffect(() => { if (current && form.body && !preview && !busy) void showPreview(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [current?.id]);

  if (loading || !user) return <div className="px-6 py-24 text-center text-slate">Loading…</div>;
  const draft = !current || current.status === "draft";
  const dirty = !!current && JSON.stringify(pick(current)) !== JSON.stringify(form);
  const tested = !!current?.testSentAt && current.testSentAt >= current.updatedAt && !dirty;
  const save = () => run("save", async () => { const j = await call({ action: "save", id: current?.id, ...form }); await load(j.announcement.id); setMsg("Saved."); });

  async function sendAll() {
    if (!current) return;
    if (!confirm(`Send "${current.title}" to everyone now? Every member gets the bell, and members whose email choices allow it get the email. This can't be undone.`)) return;
    await run("send", async () => {
      await call({ action: "send_all", id: current.id });
      for (let i = 0; i < 400; i++) {
        const j = await call({ action: "send_batch", id: current.id });
        setMsg(`Sending… ${j.counts?.bells ?? 0} bells, ${j.counts?.emails ?? 0} emails so far.`);
        if (j.done) { setMsg(`Sent: ${j.counts?.bells ?? 0} bells and ${j.counts?.emails ?? 0} emails (${j.counts?.noEmail ?? 0} members without an email for it).`); break; }
      }
      await load(current.id);
    });
  }

  const count = (k: keyof typeof ANNOUNCEMENT_LIMITS) => <span className="float-right font-mono text-[10px] text-slate">{form[k].length}/{ANNOUNCEMENT_LIMITS[k]}</span>;
  return (
    <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
      <Link href="/admin" className="block font-ui text-xs font-semibold uppercase tracking-wideish text-crimson-bright">← Dashboard</Link>
      <h1 className="mt-4 font-display text-4xl">Announcements</h1>
      <p className="mt-2 max-w-3xl text-sm text-slate">A message to every member: a bell for everyone, and an email to members whose email choices allow announcements (they can unsubscribe from any email, or in Account settings). Send yourself a test after your last change, then send to everyone. Nothing goes out until you press Send to everyone.</p>
      {ready && (!ready.emailReady || !ready.linkSecret) && (
        <p className="mt-3 rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">{!ready.emailReady ? "Email isn't set up (RESEND_API_KEY), so tests and emails can't be sent. " : ""}{!ready.linkSecret ? "Unsubscribe links need EMAIL_LINK_SECRET (or CRON_SECRET) in Vercel." : ""}</p>
      )}
      {error && <p className="mt-4 text-sm text-red-700">{error}</p>}
      {msg && <p className="mt-4 text-sm text-emerald-800">{msg}</p>}

      <div className="mt-6 flex flex-wrap gap-2">
        {(list ?? []).map((a) => (
          <button key={a.id} onClick={() => open(a)} className={`rounded-full px-4 py-1.5 font-ui text-xs font-semibold ${current?.id === a.id ? "bg-crimson text-paper" : "border border-rule text-ink hover:border-crimson"}`}>
            {a.title} · {a.status === "sent" ? `sent ${when(a.sentAt)}` : a.status === "sending" ? "sending" : "draft"}
          </button>
        ))}
        <button onClick={() => open(null)} className="rounded-full border border-dashed border-rule px-4 py-1.5 font-ui text-xs font-semibold text-ink hover:border-crimson">+ New announcement</button>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-2">
        <div className="min-w-0 space-y-4">
          <label className="block text-sm font-semibold text-ink">Title {count("title")}<input className={field} disabled={!draft} value={form.title} maxLength={ANNOUNCEMENT_LIMITS.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
          <label className="block text-sm font-semibold text-ink">Bell {count("bell")}<textarea rows={2} className={field} disabled={!draft} value={form.bell} maxLength={ANNOUNCEMENT_LIMITS.bell} onChange={(e) => setForm({ ...form, bell: e.target.value })} /></label>
          <label className="block text-sm font-semibold text-ink">Email subject {count("subject")}<input className={field} disabled={!draft} value={form.subject} maxLength={ANNOUNCEMENT_LIMITS.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} /></label>
          <label className="block text-sm font-semibold text-ink">Preheader <span className="font-normal text-slate">(the grey line after the subject in an inbox)</span> {count("preheader")}<input className={field} disabled={!draft} value={form.preheader} maxLength={ANNOUNCEMENT_LIMITS.preheader} onChange={(e) => setForm({ ...form, preheader: e.target.value })} /></label>
          <label className="block text-sm font-semibold text-ink">Email <span className="font-normal text-slate">— &ldquo;## &rdquo; a heading, &ldquo;- &rdquo; a bullet, **bold**, links as https://…; {"{name}"} is the member&apos;s first name</span>
            <textarea rows={22} className={`${field} font-mono text-[13px] leading-relaxed`} disabled={!draft} value={form.body} maxLength={ANNOUNCEMENT_LIMITS.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm font-semibold text-ink">Button<input className={field} disabled={!draft} value={form.linkLabel} maxLength={ANNOUNCEMENT_LIMITS.linkLabel} onChange={(e) => setForm({ ...form, linkLabel: e.target.value })} placeholder="Get your referral link" /></label>
            <label className="block text-sm font-semibold text-ink">Button link<input className={field} disabled={!draft} value={form.linkUrl} maxLength={ANNOUNCEMENT_LIMITS.linkUrl} onChange={(e) => setForm({ ...form, linkUrl: e.target.value })} placeholder="/profile/referrals" /></label>
          </div>
          {draft ? (
            <div className="flex flex-wrap gap-2">
              <button disabled={!!busy} onClick={save} className="btn-ghost !px-4 !py-2 text-xs">{busy === "save" ? "Saving…" : current ? "Save changes" : "Save draft"}</button>
              <button disabled={!!busy} onClick={showPreview} className="btn-ghost !px-4 !py-2 text-xs">{busy === "preview" ? "Loading…" : "Preview"}</button>
              <button disabled={!!busy || !current || dirty} title={dirty ? "Save your changes first" : ""} onClick={() => run("test", async () => { const j = await call({ action: "send_test", id: current!.id }); await load(current!.id); setMsg(`Test sent to ${j.to}. Check your inbox (and spam).`); })} className="btn-ghost !px-4 !py-2 text-xs">{busy === "test" ? "Sending…" : "Send me a test"}</button>
              <button disabled={!!busy || !tested} title={tested ? "" : "Send yourself a test after your last change first"} onClick={sendAll} className="btn-primary !px-4 !py-2 text-xs">{busy === "send" ? "Sending…" : "Send to everyone"}</button>
            </div>
          ) : (
            <div className="card p-4 text-sm">
              <p className="font-semibold text-ink">{current?.status === "sent" ? `Sent ${when(current.sentAt)}` : "Sending…"}</p>
              <p className="mt-1 text-slate">{current?.counts?.bells ?? 0} bells · {current?.counts?.emails ?? 0} emails · {current?.counts?.noEmail ?? 0} without an email for it · {current?.counts?.skipped ?? 0} skipped (suspended, child profiles)</p>
              {current?.status === "sending" && <button disabled={!!busy} onClick={sendAll} className="btn-primary mt-3 !px-4 !py-2 text-xs">Continue sending</button>}
              {current && <p className="mt-2"><Link className="text-crimson underline" href={`/announcements/${current.id}`}>Open the page members see</Link></p>}
            </div>
          )}
          {current?.testSentAt && <p className="text-xs text-slate">Last test: {when(current.testSentAt)} to {current.testSentTo}{dirty ? " · changed since: save and send another test" : ""}</p>}
        </div>

        <div className="min-w-0">
          <p className="eyebrow">As members will see it</p>
          <div className="mt-3 rounded-lg border border-rule bg-white p-3">
            <p className="font-mono text-[10px] uppercase tracking-wideish text-slate">Bell</p>
            <p className="mt-1 flex gap-2 text-sm text-ink"><span aria-hidden>📢</span><span>{form.bell.replace(/\{name\}/g, (user.displayName || "there").split(" ")[0]) || "…"}</span></p>
          </div>
          <div className="mt-3 rounded-lg border border-rule bg-white p-3">
            <p className="font-mono text-[10px] uppercase tracking-wideish text-slate">Inbox</p>
            <p className="mt-1 truncate text-sm"><b className="text-ink">#NotesApp</b> · <span className="text-ink">{preview?.subject ?? form.subject}</span> <span className="text-slate">— {preview?.preheader ?? form.preheader}</span></p>
          </div>
          {preview ? <iframe title="Email preview" srcDoc={preview.html} sandbox="" className="mt-3 h-[1100px] w-full rounded border border-rule bg-white" />
            : <p className="mt-3 text-sm text-slate">Press Preview to see the email.</p>}
        </div>
      </div>
    </section>
  );
}
