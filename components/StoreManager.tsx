"use client";

import { useState } from "react";
import { UserProfile } from "@/lib/users";
import { uploadToR2 } from "@/lib/upload";
import { addStoreItem, updateStoreItem, deleteStoreItem, StoreItem, StoreItemInput } from "@/lib/store";

const field = "mt-1 w-full border border-rule bg-card px-3 py-2 font-body text-sm outline-none focus:border-gold";
const EMPTY: StoreItemInput = { title: "", subtitle: "", price: "", badge: "", link: "", image: "", cta: "Buy now" };

// Owner-only panel on /u/<username>/store: add, edit and remove listings.
// Items link out to wherever the buyer pays (Selar, Amazon, a payment link…).
export default function StoreManager({
  profile,
  items,
  onChanged,
}: {
  profile: UserProfile;
  items: StoreItem[];
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<StoreItemInput>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const mine = items.filter((i) => i.id);
  const set = (k: keyof StoreItemInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  function startEdit(item?: StoreItem) {
    setEditingId(item?.id ?? null);
    setForm(item ? { title: item.title, subtitle: item.subtitle ?? "", price: item.price, badge: item.badge ?? "", link: item.link, image: item.image, cta: item.cta } : EMPTY);
    setError("");
    setOpen(true);
  }

  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError("");
    try {
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
    if (!/^https:\/\//i.test(form.link.trim())) return setError("Link must start with https://");
    if (!form.title.trim() || !form.price.trim()) return setError("Title and price are required (use “Free” for free items).");
    setBusy(true);
    try {
      if (editingId) await updateStoreItem(profile.uid, editingId, form);
      else await addStoreItem(profile.uid, form);
      setOpen(false);
      setEditingId(null);
      setForm(EMPTY);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save the item.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Remove this item from your store?")) return;
    setBusy(true);
    try {
      await deleteStoreItem(id);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't remove the item.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card mt-8 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-ui text-sm font-bold text-ink">Manage your store</p>
          <p className="text-xs text-slate">Only you see this panel. Items link to wherever people pay (Selar, Amazon, a payment link…).</p>
        </div>
        {!open && <button onClick={() => startEdit()} className="btn-primary !px-4 !py-2 text-xs">Add item</button>}
      </div>

      {mine.length > 0 && !open && (
        <ul className="mt-4 divide-y divide-rule border-t border-rule">
          {mine.map((i) => (
            <li key={i.id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <span className="truncate">{i.title} <span className="font-mono text-xs text-slate">· {i.price}</span></span>
              <span className="flex shrink-0 gap-3 font-ui text-xs font-semibold">
                <button onClick={() => startEdit(i)} className="text-crimson">Edit</button>
                <button onClick={() => remove(i.id!)} className="text-slate hover:text-crimson" disabled={busy}>Remove</button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {open && (
        <form onSubmit={save} className="mt-4 grid gap-3 border-t border-rule pt-4 sm:grid-cols-2">
          <label className="sm:col-span-2 text-xs text-slate">Title
            <input value={form.title} onChange={set("title")} maxLength={120} className={field} required />
          </label>
          <label className="sm:col-span-2 text-xs text-slate">Description (optional)
            <textarea value={form.subtitle} onChange={set("subtitle")} maxLength={400} rows={3} className={field} />
          </label>
          <label className="text-xs text-slate">Price (shown as text, e.g. ₦6,000 or Free)
            <input value={form.price} onChange={set("price")} maxLength={24} className={field} required />
          </label>
          <label className="text-xs text-slate">Tag (optional, e.g. Best Seller)
            <input value={form.badge} onChange={set("badge")} maxLength={24} className={field} />
          </label>
          <label className="text-xs text-slate">Buy / download link (https://…)
            <input value={form.link} onChange={set("link")} maxLength={500} placeholder="https://" className={field} required />
          </label>
          <label className="text-xs text-slate">Button label
            <input value={form.cta} onChange={set("cta")} maxLength={30} className={field} />
          </label>
          <div className="sm:col-span-2 text-xs text-slate">
            Cover image (optional)
            <div className="mt-1 flex items-center gap-3">
              {form.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={form.image} alt="" className="h-16 w-12 object-cover" />
              )}
              <input type="file" accept="image/*" onChange={upload} />
            </div>
          </div>
          {error && <p className="sm:col-span-2 text-sm text-crimson">{error}</p>}
          <div className="sm:col-span-2 flex gap-3">
            <button className="btn-primary !px-4 !py-2 text-xs" disabled={busy}>{busy ? "Saving…" : editingId ? "Save changes" : "Add to store"}</button>
            <button type="button" onClick={() => setOpen(false)} className="btn-ghost !px-4 !py-2 text-xs">Cancel</button>
          </div>
        </form>
      )}
      {!open && error && <p className="mt-3 text-sm text-crimson">{error}</p>}
    </div>
  );
}
