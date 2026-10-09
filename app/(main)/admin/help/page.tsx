"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAdminAuth } from "@/lib/useAdminAuth";
import { KB_BODY_MAX, slugify } from "@/lib/kb";

type Cat = string;
type Built = { slug: string; title: string; category: Cat; body: string };
type Staff = Built & { id: string; published: boolean; updatedAt: string; updatedByEmail?: string };
type ChatRow = { id: string; name: string; email: string; signedIn: boolean; count: number; startedAt: string; lastAt: string; handoff: boolean; gap: boolean; handled: boolean; lastGapQuestion: string | null };
type Chat = { id: string; name: string; email: string; transcript: { role: string; text: string; at: string }[]; handled?: boolean; handoff?: boolean; gap?: boolean };
type Draft = { slug: string; title: string; category: Cat; body: string; published: boolean; slugTouched: boolean };

const field = "mt-1 block w-full border border-rule bg-card px-3 py-2 text-sm";
const btn = "bg-crimson px-4 py-2 font-ui text-xs font-semibold text-paper hover:bg-crimson-bright disabled:opacity-50";
const ghost = "border border-rule px-3 py-1.5 font-ui text-xs font-semibold hover:border-crimson disabled:opacity-50";
const when = (iso: string) => new Date(iso).toLocaleString("en-NG", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

// The help centre and Nana's brain. Articles here are what visitors read at /help and what Nana answers from. A staff article with the
// same address (slug) as a built-in one replaces it; take it down and the built-in text returns. Chats are what people asked Nana.
export default function AdminHelpPage() {
  const { user, loading } = useAdminAuth();
  const [tab, setTab] = useState<"articles" | "chats">("articles");
  const [cats, setCats] = useState<Cat[]>([]);
  const [built, setBuilt] = useState<Built[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [chats, setChats] = useState<ChatRow[] | null>(null);
  const [chat, setChat] = useState<Chat | null>(null);
  const [filter, setFilter] = useState<"all" | "person" | "gap" | "open">("open");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const call = useCallback(async (body?: Record<string, unknown>, qs = "") => {
    const token = await user!.getIdToken();
    const r = await fetch(`/api/admin/help${qs}`, body ? { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(body) } : { headers: { Authorization: `Bearer ${token}` } });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || "Something went wrong");
    return j;
  }, [user]);
  const loadArticles = useCallback(() => call().then((j) => { setCats(j.categories); setBuilt(j.builtIn); setStaff(j.staff); }).catch((e) => setError(e.message)), [call]);
  const loadChats = useCallback(() => call(undefined, "?view=chats").then((j) => setChats(j.chats)).catch((e) => setError(e.message)), [call]);
  useEffect(() => { if (user) { loadArticles(); loadChats(); } }, [user, loadArticles, loadChats]);

  async function run(fn: () => Promise<string | void>) {
    setBusy(true); setError(""); setNote("");
    try { const m = await fn(); if (m) setNote(m); await Promise.all([loadArticles(), loadChats()]); }
    catch (e) { setError(e instanceof Error ? e.message : "Something went wrong"); }
    finally { setBusy(false); }
  }
  const overridden = useMemo(() => new Set(staff.filter((s) => s.published).map((s) => s.slug)), [staff]);
  const edit = (a: Built, published = true) => { setDraft({ slug: a.slug, title: a.title, category: a.category, body: a.body, published, slugTouched: true }); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const save = () => run(async () => { await call({ action: "save", article: { slug: draft!.slug, title: draft!.title, category: draft!.category, body: draft!.body, published: draft!.published } }); setDraft(null); return "Saved. It is live on the help centre and Nana knows it within a minute."; });
  async function open(id: string) { try { setChat((await call(undefined, `?chat=${id}`)).chat); } catch (e) { setError(e instanceof Error ? e.message : "Couldn't open that chat"); } }

  const shown = (chats ?? []).filter((c) => filter === "all" || (filter === "person" && c.handoff) || (filter === "gap" && c.gap) || (filter === "open" && (c.handoff || c.gap) && !c.handled));

  if (loading) return <p className="p-8 text-slate">Loading…</p>;
  if (!user) return <p className="p-8 text-slate">Admins only.</p>;
  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="font-display text-4xl text-ink">Help &amp; Nana</h1>
      <p className="mt-2 max-w-3xl text-sm text-slate">The help centre at <Link href="/help" className="text-crimson underline">/help</Link> and what Nana AI knows are the same articles. Write or correct them here, and check what people ask Nana, especially the questions she couldn&apos;t answer.</p>
      {error && <p className="mt-4 text-sm text-red-700" role="alert">{error}</p>}
      {note && <p className="mt-4 text-sm text-green-700" role="status">{note}</p>}

      <div className="mt-6 flex gap-2">
        {([["articles", "Articles"], ["chats", `Chats${chats ? ` (${chats.filter((c) => (c.handoff || c.gap) && !c.handled).length} to look at)` : ""}`]] as const).map(([id, label]) => (
          <button key={id} type="button" onClick={() => setTab(id)} aria-pressed={tab === id} className={`border px-4 py-2 font-ui text-xs font-semibold ${tab === id ? "border-ink bg-ink text-paper" : "border-rule hover:border-crimson"}`}>{label}</button>
        ))}
      </div>

      {tab === "articles" && (
        <>
          {draft ? (
            <section className="card mt-6 p-5">
              <h2 className="font-display text-xl text-ink">{staff.some((s) => s.slug === draft.slug) ? "Edit article" : "New article"}</h2>
              <label className="mt-3 block text-xs text-slate">Title<input value={draft.title} maxLength={120} onChange={(e) => setDraft({ ...draft, title: e.target.value, slug: draft.slugTouched ? draft.slug : slugify(e.target.value) })} className={field} /></label>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="block text-xs text-slate">Web address (/help/…)<input value={draft.slug} onChange={(e) => setDraft({ ...draft, slug: slugify(e.target.value), slugTouched: true })} className={`${field} font-mono`} /></label>
                <label className="block text-xs text-slate">Category<select value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} className={field}>{cats.map((c) => <option key={c}>{c}</option>)}</select></label>
              </div>
              {built.some((b) => b.slug === draft.slug) && <p className="mt-2 text-xs text-amber-800">This address belongs to a built-in article. Saving replaces it on the help centre and for Nana until you take your version down.</p>}
              <label className="mt-3 block text-xs text-slate">Text<textarea value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} rows={12} className={`${field} font-mono`} /></label>
              <p className="mt-1 text-xs text-slate">Blank line between paragraphs · start a line with &quot;- &quot; for bullets · **bold** · [link text](/pricing) for a page on #NotesApp · {draft.body.length}/{KB_BODY_MAX} characters. State plain facts and say when something is not live yet: Nana repeats what you write here.</p>
              <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.published} onChange={(e) => setDraft({ ...draft, published: e.target.checked })} /> Published</label>
              <div className="mt-4 flex gap-2"><button type="button" disabled={busy} onClick={save} className={btn}>{busy ? "Saving…" : "Save article"}</button><button type="button" onClick={() => setDraft(null)} className={ghost}>Cancel</button></div>
            </section>
          ) : (
            <button type="button" onClick={() => setDraft({ slug: "", title: "", category: cats[0] ?? "Getting started", body: "", published: true, slugTouched: false })} className={`${btn} mt-6`}>Write a new article</button>
          )}

          <h2 className="mt-10 font-display text-xl text-ink">Written by the team</h2>
          <ul className="mt-3 divide-y divide-rule border border-rule">
            {staff.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 p-4">
                <div className="min-w-0"><p className="text-sm font-semibold text-ink">{a.title} {!a.published && <span className="ml-1 rounded-full border border-rule px-2 py-0.5 font-ui text-xs font-normal text-slate">hidden</span>}</p>
                  <p className="text-xs text-slate">/help/{a.slug} · {a.category} · {when(a.updatedAt)}{a.updatedByEmail ? ` · ${a.updatedByEmail}` : ""}{built.some((b) => b.slug === a.slug) ? " · replaces a built-in article" : ""}</p></div>
                <div className="flex gap-2">
                  <Link href={`/help/${a.slug}`} className={ghost}>View</Link>
                  <button type="button" onClick={() => edit(a, a.published)} className={ghost}>Edit</button>
                  <button type="button" disabled={busy} onClick={() => run(async () => { await call({ action: "publish", slug: a.slug, published: !a.published }); })} className={ghost}>{a.published ? "Hide" : "Publish"}</button>
                  <button type="button" disabled={busy} onClick={() => { if (confirm(`Delete “${a.title}”?`)) run(async () => { await call({ action: "delete", slug: a.slug }); return "Deleted."; }); }} className={`${ghost} text-red-700`}>Delete</button>
                </div>
              </li>
            ))}
            {!staff.length && <li className="p-4 text-sm text-slate">Nothing yet. Everything below is built in.</li>}
          </ul>

          <h2 className="mt-10 font-display text-xl text-ink">Built in</h2>
          <p className="mt-1 text-xs text-slate">Written from the real prices and rules in the code, so they stay right when those change. To correct or extend one, make your own version.</p>
          <ul className="mt-3 divide-y divide-rule border border-rule">
            {built.map((a) => (
              <li key={a.slug} className="flex flex-wrap items-center justify-between gap-2 p-4">
                <div className="min-w-0"><p className="text-sm font-semibold text-ink">{a.title} {overridden.has(a.slug) && <span className="ml-1 rounded-full border border-rule px-2 py-0.5 font-ui text-xs font-normal text-slate">replaced by the team</span>}</p><p className="text-xs text-slate">/help/{a.slug} · {a.category}</p></div>
                <div className="flex gap-2"><Link href={`/help/${a.slug}`} className={ghost}>View</Link><button type="button" onClick={() => edit(a)} className={ghost}>Make our own version</button></div>
              </li>
            ))}
          </ul>
        </>
      )}

      {tab === "chats" && (
        <>
          <div className="mt-6 flex flex-wrap gap-2 text-xs">
            {([["open", "To look at"], ["person", "Wanted a person"], ["gap", "Nana couldn't answer"], ["all", "All chats"]] as const).map(([id, label]) => (
              <button key={id} type="button" onClick={() => setFilter(id)} aria-pressed={filter === id} className={`border px-3 py-1.5 font-ui font-semibold ${filter === id ? "border-ink bg-ink text-paper" : "border-rule hover:border-crimson"}`}>{label}</button>
            ))}
          </div>
          {!chats ? <p className="mt-6 text-slate">Loading…</p> : (
            <ul className="mt-4 divide-y divide-rule border border-rule">
              {shown.map((c) => (
                <li key={c.id} className="p-4">
                  <button type="button" onClick={() => (chat?.id === c.id ? setChat(null) : open(c.id))} className="block w-full text-left">
                    <p className="text-sm font-semibold text-ink">{c.name} <span className="font-normal text-slate">· {c.email}{c.signedIn ? " · member" : " · visitor"}</span>
                      {c.handoff && <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 font-ui text-xs font-semibold text-amber-900">wants a person</span>}
                      {c.gap && <span className="ml-2 rounded-full bg-sky-100 px-2 py-0.5 font-ui text-xs font-semibold text-sky-900">gap</span>}
                      {c.handled && <span className="ml-2 rounded-full border border-rule px-2 py-0.5 font-ui text-xs text-slate">followed up</span>}</p>
                    <p className="text-xs text-slate">{c.count} message{c.count === 1 ? "" : "s"} · last {when(c.lastAt)}</p>
                    {c.lastGapQuestion && <p className="mt-1 text-sm text-ink">Couldn&apos;t answer: “{c.lastGapQuestion}”</p>}
                  </button>
                  {chat?.id === c.id && (
                    <div className="mt-3 border-t border-rule pt-3">
                      <ul className="space-y-2 text-sm">
                        {chat.transcript.map((m, i) => <li key={i} className={m.role === "user" ? "text-ink" : "text-slate"}><span className="font-semibold">{m.role === "user" ? chat.name : "Nana"}:</span> {m.text}</li>)}
                      </ul>
                      <div className="mt-3 flex gap-2">
                        <a href={`mailto:${chat.email}?subject=${encodeURIComponent("Your question to #NotesApp")}`} className={ghost}>Email them</a>
                        <button type="button" disabled={busy} onClick={() => run(async () => { await call({ action: "handled", id: c.id, handled: !c.handled }); })} className={ghost}>{c.handled ? "Mark as not followed up" : "Mark as followed up"}</button>
                        <button type="button" onClick={() => { setTab("articles"); setDraft({ slug: "", title: c.lastGapQuestion ?? "", category: cats[0] ?? "Getting started", body: "", published: true, slugTouched: false }); window.scrollTo({ top: 0 }); }} className={ghost}>Write an article about it</button>
                      </div>
                    </div>
                  )}
                </li>
              ))}
              {!shown.length && <li className="p-4 text-sm text-slate">Nothing here.</li>}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
