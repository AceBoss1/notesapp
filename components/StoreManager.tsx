"use client";

import { useState } from "react";
import { UserProfile } from "@/lib/users";
import { auth } from "@/lib/firebase";
import { uploadToR2 } from "@/lib/upload";
import { STORE_DELIVERY_MAX_KOBO, STORE_ITEM_MAX_KOBO, STORE_ITEM_MIN_KOBO } from "@/lib/orders";
import { addStoreItem, updateStoreItem, deleteStoreItem, StoreItem } from "@/lib/store";

const field = "mt-1 w-full border border-rule bg-card px-3 py-2 font-body text-sm outline-none focus:border-gold";
const EMPTY = { title: "", subtitle: "", badge: "", image: "", priceNaira: "", deliveryNaira: "0", stock: "" };

// Panel on /u/<username>/store for the store's owner — or, for an organisation's store, a
// team member the owner gave store access. Items are physical goods sold through
// #NotesApp checkout (buyer pays here; the money is held until delivery is confirmed)
// with a managed stock count. There are no link-out items.
export default function StoreManager({
  profile,
  items,
  onChanged,
}: {
  profile: UserProfile; // the STORE's owner (the organisation, for an org store)
  items: StoreItem[];
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<StoreItem | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  const sellable = items.filter((i) => i.id && i.sellable);
  const legacy = items.filter((i) => i.id && !i.sellable);
  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  function startEdit(item?: StoreItem) {
    setEditing(item ?? null);
    setForm(
      item
        ? { title: item.title, subtitle: item.subtitle ?? "", badge: item.badge ?? "", image: item.image, priceNaira: String((item.priceKobo ?? 0) / 100), deliveryNaira: String((item.deliveryKobo ?? 0) / 100), stock: String(item.stock ?? 0) }
        : EMPTY
    );
    setError("");
    setMsg("");
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
    const priceKobo = Math.round(Number(form.priceNaira) * 100);
    const deliveryKobo = Math.round(Number(form.deliveryNaira || 0) * 100);
    const stock = Number(form.stock);
    if (!form.title.trim()) return setError("Add a title.");
    if (!Number.isFinite(priceKobo) || priceKobo < STORE_ITEM_MIN_KOBO || priceKobo > STORE_ITEM_MAX_KOBO) return setError("Price must be between ₦100 and ₦5,000,000.");
    if (!Number.isFinite(deliveryKobo) || deliveryKobo < 0 || deliveryKobo > STORE_DELIVERY_MAX_KOBO) return setError("Delivery fee must be between ₦0 and ₦50,000.");
    if (form.stock.trim() === "" || !Number.isInteger(stock) || stock < 0 || stock > 100000) return setError("Enter how many you have in stock (a whole number; 0 means sold out).");
    const input = {
      title: form.title, subtitle: form.subtitle, badge: form.badge, image: form.image,
      price: `₦${(priceKobo / 100).toLocaleString("en-NG")}`, link: "", cta: "Buy now",
      sellable: true, priceKobo, deliveryKobo, stock,
    };
    setBusy(true);
    try {
      const previousStock = editing?.stock ?? 0;
      const stockChanged = !editing || stock !== previousStock;
      let id = editing?.id;
      if (editing?.id) await updateStoreItem(profile.uid, editing.id, input, stockChanged);
      else id = await addStoreItem(profile.uid, input);
      // Back above zero → tell the people waiting for it (their bell).
      if (id && stock > 0 && previousStock <= 0 && auth.currentUser) {
        fetch("/api/store/restock", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${await auth.currentUser.getIdToken()}` },
          body: JSON.stringify({ itemId: id }),
        }).catch(() => {});
      }
      setOpen(false);
      setEditing(null);
      setForm(EMPTY);
      setMsg("Saved.");
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save the item.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Remove this item from the store?")) return;
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
          <p className="font-ui text-sm font-bold text-ink">Manage the store</p>
          <p className="text-xs text-slate">
            Physical items sold through #NotesApp checkout: the buyer pays here and the money is held until they confirm delivery (or 7 days after you mark it delivered), minus our commission on the item price.
            You keep the delivery fee, arrange delivery and keep the parcel&apos;s tracking up to date under Orders. Payouts need a payout account under Rates &amp; payouts. Stock is counted down automatically; at 0 nobody can order, and people who asked get a bell alert when you restock.
          </p>
        </div>
        {!open && <button onClick={() => startEdit()} className="btn-primary !px-4 !py-2 text-xs">Add item</button>}
      </div>
      {msg && !open && <p className="mt-3 text-sm text-ink">{msg}</p>}

      {sellable.length > 0 && !open && (
        <ul className="mt-4 divide-y divide-rule border-t border-rule">
          {sellable.map((i) => (
            <li key={i.id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <span className="truncate">{i.title} <span className="font-mono text-xs text-slate">· {i.price} · {i.stock && i.stock > 0 ? `${i.stock} in stock` : "sold out"}</span></span>
              <span className="flex shrink-0 gap-3 font-ui text-xs font-semibold">
                <button onClick={() => startEdit(i)} className="text-crimson">Edit / restock</button>
                <button onClick={() => remove(i.id!)} className="text-slate hover:text-crimson" disabled={busy}>Remove</button>
              </span>
            </li>
          ))}
        </ul>
      )}
      {legacy.length > 0 && !open && (
        <div className="mt-4 border-t border-rule pt-3 text-xs text-slate">
          <p>These link-out items are no longer supported (stores sell through #NotesApp checkout only). Put links in your posts or your profile link instead, and remove them here:</p>
          <ul className="mt-2 space-y-1">
            {legacy.map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-3"><span className="truncate">{i.title}</span><button onClick={() => remove(i.id!)} className="font-semibold text-crimson" disabled={busy}>Remove</button></li>
            ))}
          </ul>
        </div>
      )}

      {open && (
        <form onSubmit={save} className="mt-4 grid gap-3 border-t border-rule pt-4 sm:grid-cols-2">
          <label className="sm:col-span-2 text-xs text-slate">Title
            <input value={form.title} onChange={set("title")} maxLength={120} className={field} required />
          </label>
          <label className="sm:col-span-2 text-xs text-slate">Description (optional)
            <textarea value={form.subtitle} onChange={set("subtitle")} maxLength={400} rows={3} className={field} />
          </label>
          <label className="text-xs text-slate">Price (₦)
            <input type="number" min={100} step={50} value={form.priceNaira} onChange={set("priceNaira")} className={field} required />
          </label>
          <label className="text-xs text-slate">Delivery fee (₦, yours)
            <input type="number" min={0} step={50} value={form.deliveryNaira} onChange={set("deliveryNaira")} className={field} />
          </label>
          <label className="text-xs text-slate">In stock
            <input type="number" min={0} step={1} value={form.stock} onChange={set("stock")} className={field} required />
          </label>
          <label className="text-xs text-slate">Tag (optional, e.g. Best Seller)
            <input value={form.badge} onChange={set("badge")} maxLength={24} className={field} />
          </label>
          <div className="sm:col-span-2 text-xs text-slate">
            Photo
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
            <button className="btn-primary !px-4 !py-2 text-xs" disabled={busy}>{busy ? "Saving…" : editing ? "Save changes" : "Add to store"}</button>
            <button type="button" onClick={() => setOpen(false)} className="btn-ghost !px-4 !py-2 text-xs">Cancel</button>
          </div>
        </form>
      )}
      {!open && error && <p className="mt-3 text-sm text-crimson">{error}</p>}
    </div>
  );
}
