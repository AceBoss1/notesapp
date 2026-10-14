"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useAdminAuth } from "@/lib/useAdminAuth";
import { putFile, useAdminCall } from "@/lib/useAdminCall";
import { DEPARTMENTS } from "@/lib/admin-access";
import { DOC_CATEGORIES, FILE_MAX_BYTES, type StaffDoc } from "@/lib/staff-ops";

type Doc = StaffDoc & { acked: boolean; ackCount: number; openCount: number };
type Data = { docs: Doc[]; canEdit: boolean; people: { uid: string; name: string }[]; names: Record<string, string>; filesReady: boolean };
const field = "mt-1 block w-full rounded-lg border border-rule bg-card px-2 py-1.5 text-sm";
const btn = "rounded-full bg-crimson px-4 py-2 font-ui text-xs font-semibold text-paper hover:bg-crimson-bright disabled:opacity-50";
const ghost = "rounded-full border border-rule px-3 py-1.5 font-ui text-xs font-semibold hover:border-crimson disabled:opacity-50";
const blank = { title: "", category: "sop", description: "", scope: "all", dept: "support", receivers: [] as string[], requiresAck: false };
const catLabel = (k: string) => DOC_CATEGORIES.find((c) => c.key === k)?.label ?? k;
const size = (n: number) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

// The staff library: SOPs, the employee handbook, policies, templates and other staff material. Open to everyone on staff, one department, or named
// people (a personal document goes to receivers in To, not copied). Handbook and policies can ask everyone to confirm they have read them; a new
// version clears the confirmations. Super admins, customer care, product and legal maintain it: files are uploaded while adding a document
// (or later with Upload a file), and 👁 shows who has opened it and who hasn't.
export default function LibraryPage() {
  const { user, loading } = useAdminAuth();
  const call = useAdminCall(user, "/api/admin/staff-library");
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [cat, setCat] = useState("");
  const [form, setForm] = useState<(typeof blank & { id?: string }) | null>(null);
  const [acks, setAcks] = useState<{ id: string; read: { uid: string; name: string; at: string }[]; waiting: { uid: string; name: string }[]; opened: { uid: string; name: string; at: string }[]; notOpened: { uid: string; name: string }[] } | null>(null);
  const [newFiles, setNewFiles] = useState<File[]>([]); // chosen while adding a document; uploaded once it exists
  const pickRef = useRef<HTMLInputElement>(null);
  const [uploadFor, setUploadFor] = useState<string | null>(null);

  const load = useCallback(() => call().then(setData).catch((e) => setError(e.message)), [call]);
  useEffect(() => { if (user) load(); }, [user, load]);
  const run = async (body: Record<string, unknown>, ok: string) => {
    setBusy(true); setError(""); setNote("");
    try { const r = await call(body); setNote(ok); await load(); return r; } catch (e) { setError((e as Error).message); return null; } finally { setBusy(false); }
  };
  const open = async (id: string, i: number) => {
    try { const r = await call(undefined, `?file=${encodeURIComponent(id)}&i=${i}`); window.open(r.url, "_blank", "noopener"); } catch (e) { setError((e as Error).message); }
  };
  async function upload(id: string, files: FileList | File[] | null) {
    if (!files?.length) return;
    setBusy(true); setError(""); setNote("");
    try {
      for (const f of Array.from(files)) {
        if (f.size > FILE_MAX_BYTES) throw new Error(`${f.name} is larger than ${FILE_MAX_BYTES / 1024 / 1024} MB.`);
        const s = await call({ action: "fileStart", id, file: { name: f.name, size: f.size } });
        await putFile(s.uploadUrl, s.contentType, f);
        await call({ action: "fileAttach", id, file: { key: s.key, name: f.name } });
      }
      setNote("File added."); await load();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); if (pickRef.current) pickRef.current.value = ""; }
  }

  const shown = useMemo(() => (data?.docs ?? []).filter((d) => !cat || d.category === cat), [data, cat]);
  if (loading || !user) return <div className="px-6 py-24 text-center text-slate">Loading…</div>;
  const waiting = (data?.docs ?? []).filter((d) => d.requiresAck && !d.acked);

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <Link href="/admin/team" className="font-ui text-xs font-semibold text-crimson">← Team hub</Link>
      <h1 className="mt-2 font-display text-4xl text-ink">Staff library</h1>
      <p className="mt-2 max-w-3xl text-sm text-slate">SOPs, the employee handbook, policies, templates and other staff material. Some documents ask you to confirm you have read them. For material meant for one person, use the <Link href="/admin/team/messages" className="text-crimson underline">message hub</Link> and put them in To.</p>
      {error && <p className="mt-4 whitespace-pre-line text-sm text-red-700" role="alert">{error}</p>}
      {note && <p className="mt-4 text-sm text-green-700" role="status">{note}</p>}
      {!data ? <p className="mt-8 text-slate">Loading…</p> : (
        <>
          {waiting.length > 0 && <p className="mt-6 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-ink">You have {waiting.length} document{waiting.length === 1 ? "" : "s"} to read and confirm: {waiting.map((d) => d.title).join(", ")}.</p>}
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              {[{ key: "", label: "All" }, ...DOC_CATEGORIES].map((c) => <button key={c.key} onClick={() => setCat(c.key)} className={`rounded-full border px-3 py-1 font-ui text-xs font-semibold ${cat === c.key ? "border-crimson bg-crimson text-paper" : "border-rule text-ink hover:border-crimson"}`}>{c.key ? c.label.split(" (")[0] : c.label}</button>)}
            </div>
            {data.canEdit && !form && <button className={ghost} onClick={() => setForm({ ...blank })}>Add a document</button>}
          </div>

          {form && (
            <form className="mt-4 grid gap-3 rounded-xl bg-paper p-4 sm:grid-cols-2" onSubmit={async (e) => {
              e.preventDefault();
              const { id, ...doc } = form;
              const r = await run(id ? { action: "update", id, doc } : { action: "create", doc }, id ? "Saved." : newFiles.length ? "Added. Uploading…" : "Added.");
              if (r) { setForm(null); if (!id && newFiles.length && r.doc?.id) { await upload(r.doc.id, newFiles); } setNewFiles([]); }
            }}>
              <label className="text-xs sm:col-span-2">Title<input className={field} required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
              <label className="text-xs">Kind<select className={field} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{DOC_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}</select></label>
              <label className="text-xs">Who can open it<select className={field} value={form.scope} onChange={(e) => setForm({ ...form, scope: e.target.value })}><option value="all">Everyone on staff</option><option value="dept">One department</option><option value="personal">Named people (personal)</option></select></label>
              {form.scope === "dept" && <label className="text-xs">Department<select className={field} value={form.dept} onChange={(e) => setForm({ ...form, dept: e.target.value })}>{DEPARTMENTS.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}</select></label>}
              {form.scope === "personal" && (
                <fieldset className="text-xs sm:col-span-2"><legend>Receivers (To)</legend>
                  <div className="mt-1 flex flex-wrap gap-3">{data.people.map((p) => <label key={p.uid} className="inline-flex items-center gap-1.5"><input type="checkbox" checked={form.receivers.includes(p.uid)} onChange={(e) => setForm({ ...form, receivers: e.target.checked ? [...form.receivers, p.uid] : form.receivers.filter((x) => x !== p.uid) })} />{p.name}</label>)}</div>
                </fieldset>
              )}
              <label className="text-xs sm:col-span-2">Short description<input className={field} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
              {!form.id && (
                <label className="text-xs sm:col-span-2">Files (PDF, Word, Excel, PowerPoint, pictures; up to {FILE_MAX_BYTES / 1024 / 1024} MB each)
                  <input type="file" multiple disabled={!data.filesReady} onChange={(e) => setNewFiles(Array.from(e.target.files ?? []))} className="mt-1 block w-full rounded-lg border border-dashed border-rule bg-card px-2 py-3 text-sm file:mr-3 file:rounded-full file:border-0 file:bg-crimson file:px-3 file:py-1.5 file:font-ui file:text-xs file:font-semibold file:text-paper" />
                  {!data.filesReady && <span className="mt-1 block text-red-700">File storage isn&apos;t set up yet, so files can&apos;t be uploaded.</span>}
                  {newFiles.length > 0 && <span className="mt-1 block text-slate">{newFiles.map((f) => `${f.name} (${size(f.size)})`).join(", ")}</span>}
                </label>
              )}
              <label className="inline-flex items-center gap-2 text-xs sm:col-span-2"><input type="checkbox" checked={form.requiresAck} onChange={(e) => setForm({ ...form, requiresAck: e.target.checked })} /> Ask people to confirm they have read it</label>
              <div className="flex gap-2 sm:col-span-2"><button className={btn} disabled={busy}>{form.id ? "Save" : "Add"}</button><button type="button" className={ghost} onClick={() => setForm(null)}>Cancel</button></div>
            </form>
          )}

          <ul className="mt-6 space-y-4">
            {shown.map((d) => (
              <li key={d.id} className="card p-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-display text-xl text-ink">{d.title} <span className="font-ui text-xs font-normal text-slate">v{d.version}</span></p>
                    <p className="text-xs text-slate">{catLabel(d.category)} · {d.scope === "all" ? "everyone on staff" : d.scope === "dept" ? DEPARTMENTS.find((x) => x.key === d.dept)?.label : `personal: ${d.receivers.map((u) => data.names[u] ?? "someone").join(", ")}`}</p>
                  </div>
                  {d.requiresAck && (d.acked ? <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 font-ui text-[11px] font-semibold text-emerald-800">you confirmed</span> : <span className="rounded-full bg-amber-100 px-2.5 py-0.5 font-ui text-[11px] font-semibold text-amber-900">to confirm</span>)}
                </div>
                {d.description && <p className="mt-2 text-sm text-slate">{d.description}</p>}
                <ul className="mt-3 space-y-1 text-sm">
                  {d.files.map((f, i) => (
                    <li key={f.key} className="flex flex-wrap items-center gap-3"><button onClick={() => open(d.id, i)} className="text-crimson underline">{f.name}</button><span className="text-xs text-slate">{size(f.size)}</span>
                      {data.canEdit && <button className="text-xs text-slate underline" onClick={() => { if (confirm(`Remove ${f.name}?`)) run({ action: "fileRemove", id: d.id, index: i }, "Removed."); }}>remove</button>}
                    </li>
                  ))}
                  {d.files.length === 0 && <li className="text-xs text-slate">No file attached yet.</li>}
                </ul>
                <div className="mt-3 flex flex-wrap gap-2">
                  {d.requiresAck && !d.acked && <button className={btn} disabled={busy} onClick={() => run({ action: "ack", id: d.id }, "Thank you. Your confirmation is recorded.")}>I have read this</button>}
                  {data.canEdit && (
                    <>
                      <button className={btn} disabled={busy || !data.filesReady} title={data.filesReady ? "" : "File storage isn't set up yet"} onClick={() => { setUploadFor(d.id); pickRef.current?.click(); }}>⬆ Upload a file</button>
                      <button className={ghost} onClick={() => setForm({ id: d.id, title: d.title, category: d.category, description: d.description, scope: d.scope, dept: d.dept ?? "support", receivers: d.receivers, requiresAck: d.requiresAck })}>Edit</button>
                      <button className={ghost} disabled={busy} onClick={() => { if (confirm(`Publish v${d.version + 1}? ${d.requiresAck ? "Everyone will be asked to confirm again." : ""}`)) run({ action: "update", id: d.id, doc: { newVersion: true } }, `Version ${d.version + 1} is live.`); }}>New version</button>
                      <button className={ghost} onClick={async () => { if (acks?.id === d.id) return setAcks(null); try { setAcks({ id: d.id, ...(await call(undefined, `?acks=${d.id}`)) }); } catch (e) { setError((e as Error).message); } }}>👁 Who has read it ({d.requiresAck ? `${d.ackCount} confirmed · ` : ""}{d.openCount} opened)</button>
                      <button className={ghost} disabled={busy} onClick={() => run({ action: "update", id: d.id, doc: { archived: true } }, "Archived.")}>Archive</button>
                    </>
                  )}
                </div>
                {acks?.id === d.id && (
                  <div className="mt-3 space-y-1 rounded-lg bg-paper p-3 text-xs">
                    <p><span className="font-semibold">👁 Opened ({acks.opened.length}):</span> {acks.opened.map((p) => `${p.name} (${new Date(p.at).toLocaleString("en-NG", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true })})`).join(", ") || "no one yet"}</p>
                    <p><span className="font-semibold">Not opened yet ({acks.notOpened.length}):</span> {acks.notOpened.map((p) => p.name).join(", ") || "no one"}</p>
                    {d.requiresAck && <>
                      <p><span className="font-semibold">✔ Confirmed ({acks.read.length}):</span> {acks.read.map((p) => p.name).join(", ") || "no one yet"}</p>
                      <p><span className="font-semibold">Still to confirm ({acks.waiting.length}):</span> {acks.waiting.map((p) => p.name).join(", ") || "no one"}</p>
                    </>}
                  </div>
                )}
              </li>
            ))}
            {shown.length === 0 && <li className="text-sm text-slate">Nothing here yet.</li>}
          </ul>
          <input ref={pickRef} type="file" multiple className="hidden" onChange={(e) => uploadFor && upload(uploadFor, e.target.files)} />
        </>
      )}
    </div>
  );
}
