"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { remark } from "remark";
import html from "remark-html";
import RichTextEditor from "@/components/RichTextEditor";
import { remarkLinkify } from "@/lib/linkify";
import { useMember } from "@/lib/member-client";
import { api } from "@/lib/moments-client";
import { accessLabel, invitePath } from "@/lib/invite-terms";
import type { SharedDraft } from "@/lib/coauthors-server";

// /write/<id>/shared: a journal's draft for its co-authors (GET/POST /api/coauthors/draft). "Can view" reads it, read-only; "Can view
// and edit" also edits its title and text and saves straight into the draft. Everything else about the post (address, topics, picture,
// publishing, the split) stays in the lead's editor. Once the post is published it's locked and this page points to it.
export default function SharedDraftPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useMember();
  const [d, setD] = useState<SharedDraft | null>(null);
  const [error, setError] = useState("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [preview, setPreview] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  const load = () => api<SharedDraft>(`/api/coauthors/draft?noteId=${encodeURIComponent(id)}`).then((r) => { setD(r); setTitle(r.note.title); setContent(r.note.content); }).catch((e) => setError(e.message));
  useEffect(() => { if (user) void load(); }, [user, id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!d || d.access === "edit") return;
    let alive = true;
    remark().use(remarkLinkify).use(html).process(d.note.content).then((f) => alive && setPreview(String(f))).catch(() => alive && setPreview("<p>Couldn't show the draft.</p>"));
    return () => { alive = false; };
  }, [d]);

  async function save() {
    if (!d) return;
    setBusy(true);
    setError("");
    setNote("");
    try {
      const r = await api<{ version: string }>("/api/coauthors/draft", { body: { noteId: id, title, content, version: d.version } });
      setD({ ...d, version: r.version, note: { ...d.note, title, content } });
      setNote(`Saved into the draft. ${d.leadName} sees your changes when they next open it.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save.");
    } finally {
      setBusy(false);
    }
  }

  if (user === null) return <Shell><p className="text-sm text-slate"><Link href={`/login?next=/write/${id}/shared`} className="font-semibold text-crimson">Sign in</Link> to open the draft.</p></Shell>;
  if (error && !d) return <Shell><p className="text-sm text-crimson">{error}</p><p className="mt-3 text-sm"><Link href="/invites" className="text-crimson underline">Your co-author invites</Link></p></Shell>;
  if (!d) return <Shell><p className="text-sm text-slate">Loading the draft…</p></Shell>;
  if (d.access === "lead") return <Shell><p className="text-sm text-slate">This is your own post. <Link href={`/write/${id}/edit`} className="font-semibold text-crimson">Open it in the editor</Link></p></Shell>;

  const published = d.note.status === "published";
  const edit = d.access === "edit" && !published;
  const dirty = title !== d.note.title || content !== d.note.content;
  return (
    <Shell>
      <Link href="/invites" className="block font-ui text-xs font-semibold uppercase tracking-wideish text-crimson-bright">← Co-author invites</Link>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-amber-100 px-3 py-1 font-mono text-[11px] uppercase tracking-eyebrow text-amber-900">Co-author · {accessLabel(d.access)}</span>
        <span className="rounded-full bg-rule px-3 py-1 font-mono text-[11px] uppercase tracking-eyebrow text-slate">{published ? "Published" : "Draft"}</span>
      </div>
      <p className="mt-3 text-sm text-slate">
        {published
          ? <>This post is published, so the draft is locked. <Link href={`/notes/${d.note.slug}`} className="font-semibold text-crimson">Read it</Link></>
          : edit
            ? <>You can edit the title and text of {d.leadName}&apos;s draft. Your changes save straight into it. The address, topics, picture and publishing stay with {d.leadName}.</>
            : <>Read-only: you can review {d.leadName}&apos;s draft before it&apos;s published and send them your comments. You can&apos;t edit it.</>}
        {" "}{d.inviteId && <Link href={invitePath("journal", d.inviteId)} className="underline">Your terms</Link>}
      </p>
      {d.note.coEditedAt && <p className="mt-1 text-xs text-slate">Last edited by a co-author{d.note.coEditedByName ? ` (${d.note.coEditedByName})` : ""} on {new Date(d.note.coEditedAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}.</p>}

      {edit ? (
        <div className="mt-6 grid gap-5">
          <label className="block"><span className="eyebrow">Title</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} className="mt-2 w-full border border-rule bg-card px-4 py-3 font-body outline-none focus:border-crimson" />
          </label>
          <div><span className="eyebrow">Text</span><RichTextEditor value={content} onChange={setContent} mark={{ noteId: id }} /></div>
          {error && <p className="text-sm text-crimson">{error}</p>}
          {note && <p className="text-sm text-emerald-800">{note}</p>}
          <div className="flex flex-wrap items-center gap-3">
            <button onClick={save} disabled={busy || !dirty || !title.trim()} className="btn-primary !px-6 !py-2.5 disabled:opacity-50">{busy ? "Saving…" : "Save into the draft"}</button>
            {dirty && <span className="text-xs text-slate">Unsaved changes</span>}
          </div>
        </div>
      ) : (
        <article className="mt-6">
          {d.note.featured_image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={d.note.featured_image} alt="" className="mb-6 aspect-video w-full object-cover" />
          )}
          <h1 className="font-display text-4xl text-ink">{d.note.title}</h1>
          <p className="mt-1 text-sm text-slate">by {d.note.author}</p>
          <div className="prose prose-lg mt-6 max-w-none font-body text-ink prose-headings:font-display prose-a:text-crimson-bright" dangerouslySetInnerHTML={{ __html: preview }} />
        </article>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <section className="mx-auto max-w-3xl px-4 py-10 sm:px-6">{children}</section>;
}
