"use client";

import { useEffect, useState } from "react";
import { addDoc, collection, deleteDoc, doc, getDocs, orderBy, query, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAdminAuth } from "@/lib/useAdminAuth";
import { uploadToR2 } from "@/lib/upload";
import { AD_FOOTER, AD_PLACEMENTS, AdCreative, AdPlacement } from "@/lib/ads";

type Row = AdCreative & { createdAt?: string };
const EMPTY = { title: "", text: "", image: "", href: "", placements: [] as AdPlacement[], weight: 5, active: true, startsAt: "", endsAt: "" };
const field = "mt-1 w-full border border-rule bg-card px-3 py-2 text-sm outline-none focus:border-crimson";

export default function AdminAdsPage() {
  const { user, loading } = useAdminAuth();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    const snap = await getDocs(query(collection(db, "adCreatives"), orderBy("createdAt", "desc")));
    setRows(snap.docs.map((d) => ({ ...(d.data() as Row), id: d.id })));
  }
  useEffect(() => {
    if (user) load().catch((e) => setError(e.message));
  }, [user]);

  function togglePlacement(p: AdPlacement) {
    setForm((f) => ({ ...f, placements: f.placements.includes(p) ? f.placements.filter((x) => x !== p) : [...f.placements, p] }));
  }

  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      setForm((f) => ({ ...f, image: "" }));
      const url = await uploadToR2(file, "journal");
      setForm((f) => ({ ...f, image: url }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!/^https:\/\//i.test(form.href.trim())) return setError("Link must start with https://");
    if (!form.title.trim()) return setError("Add a headline.");
    if (form.placements.length === 0) return setError("Pick at least one placement.");
    setBusy(true);
    try {
      const data = {
        title: form.title.trim(),
        text: form.text.trim(),
        image: form.image,
        href: form.href.trim(),
        placements: form.placements,
        weight: Math.max(1, Math.min(10, Math.round(form.weight) || 5)),
        active: form.active,
        provider: "notesapp",
        ...(form.startsAt ? { startsAt: new Date(form.startsAt).toISOString() } : {}),
        ...(form.endsAt ? { endsAt: new Date(`${form.endsAt}T23:59:59`).toISOString() } : {}),
      };
      if (editing) await updateDoc(doc(db, "adCreatives", editing), data);
      else await addDoc(collection(db, "adCreatives"), { ...data, createdAt: new Date().toISOString() });
      setForm(EMPTY);
      setEditing(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save");
    } finally {
      setBusy(false);
    }
  }

  function edit(r: Row) {
    setEditing(r.id);
    setForm({
      title: r.title, text: r.text ?? "", image: r.image ?? "", href: r.href, placements: r.placements, weight: r.weight, active: r.active,
      startsAt: r.startsAt ? r.startsAt.slice(0, 10) : "", endsAt: r.endsAt ? r.endsAt.slice(0, 10) : "",
    });
  }

  if (loading || !user) return <div className="px-6 py-24 text-center text-slate">Loading…</div>;
  return (
    <section className="mx-auto max-w-4xl px-4 py-14">
      <h1 className="font-display text-4xl">Ads</h1>
      <p className="mt-2 text-sm text-slate">
        House banners ({AD_FOOTER.notesapp}) rotate in the chosen placements. Changes reach visitors within ~5 minutes. Google, Meta and
        AdMob slots are not wired yet. Slots stay empty until an active ad exists.
      </p>
      {error && <p className="mt-4 text-sm text-crimson">{error}</p>}

      <form onSubmit={save} className="card mt-8 grid gap-3 p-5 sm:grid-cols-2">
        <label className="text-xs text-slate sm:col-span-2">Headline
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={field} maxLength={90} />
        </label>
        <label className="text-xs text-slate sm:col-span-2">Text (optional)
          <input value={form.text} onChange={(e) => setForm({ ...form, text: e.target.value })} className={field} maxLength={180} />
        </label>
        <label className="text-xs text-slate">Link (https://…)
          <input value={form.href} onChange={(e) => setForm({ ...form, href: e.target.value })} className={field} />
        </label>
        <div className="text-xs text-slate">Image (optional)
          <div className="mt-1 flex items-center gap-3">
            {form.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={form.image} alt="" className="h-10 w-16 object-cover" />
            )}
            <input type="file" accept="image/*" onChange={upload} />
          </div>
        </div>
        <fieldset className="sm:col-span-2">
          <legend className="text-xs text-slate">Placements</legend>
          <div className="mt-1 flex flex-wrap gap-4 text-sm">
            {(Object.keys(AD_PLACEMENTS) as AdPlacement[]).map((p) => (
              <label key={p} className="flex items-center gap-2">
                <input type="checkbox" checked={form.placements.includes(p)} onChange={() => togglePlacement(p)} />
                {AD_PLACEMENTS[p].label}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="text-xs text-slate">Weight (1–10, higher shows more)
          <input type="number" min={1} max={10} value={form.weight} onChange={(e) => setForm({ ...form, weight: Number(e.target.value) })} className={field} />
        </label>
        <label className="flex items-center gap-2 self-end text-sm">
          <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> Active
        </label>
        <label className="text-xs text-slate">Starts (optional)
          <input type="date" value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} className={field} />
        </label>
        <label className="text-xs text-slate">Ends (optional)
          <input type="date" value={form.endsAt} onChange={(e) => setForm({ ...form, endsAt: e.target.value })} className={field} />
        </label>
        <div className="flex gap-3 sm:col-span-2">
          <button disabled={busy} className="btn-primary !px-4 !py-2 text-xs">{editing ? "Save changes" : "Add ad"}</button>
          {editing && <button type="button" onClick={() => { setEditing(null); setForm(EMPTY); }} className="btn-ghost !px-4 !py-2 text-xs">Cancel</button>}
        </div>
      </form>

      <div className="mt-8 space-y-3">
        {rows === null ? (
          <p className="text-sm text-slate">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-slate">No ads yet.</p>
        ) : (
          rows.map((r) => (
            <div key={r.id} className="card flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
              <div>
                <p className="font-semibold text-ink">{r.title} <span className="font-mono text-[11px] text-slate">{r.active ? "active" : "paused"} · weight {r.weight}</span></p>
                <p className="text-xs text-slate">{r.placements.map((p) => AD_PLACEMENTS[p]?.label ?? p).join(" · ")}{r.endsAt ? ` · ends ${r.endsAt.slice(0, 10)}` : ""}</p>
              </div>
              <div className="flex gap-3 text-xs font-semibold">
                <button onClick={() => updateDoc(doc(db, "adCreatives", r.id), { active: !r.active }).then(load)} className="text-crimson">{r.active ? "Pause" : "Resume"}</button>
                <button onClick={() => edit(r)} className="text-crimson">Edit</button>
                <button onClick={() => confirm("Delete this ad?") && deleteDoc(doc(db, "adCreatives", r.id)).then(load)} className="text-slate hover:text-crimson">Delete</button>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
