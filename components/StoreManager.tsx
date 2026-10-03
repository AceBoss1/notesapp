"use client";

import { useState } from "react";
import { UserProfile } from "@/lib/users";
import { auth } from "@/lib/firebase";
import { uploadToR2 } from "@/lib/upload";
import { STORE_DELIVERY_MAX_KOBO, STORE_ITEM_MAX_KOBO, STORE_ITEM_MIN_KOBO } from "@/lib/orders";
import Link from "next/link";
import { addStoreItem, updateStoreItem, deleteStoreItem, StoreItem } from "@/lib/store";
import { attachDigitalFile, fmtSize } from "@/lib/store-files";
import { DIGITAL_EXTENSIONS, DIGITAL_MAX_BYTES } from "@/lib/private-files-config";

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
  // Physical or digital — chosen when the item is added, fixed afterwards.
  const [kind, setKind] = useState<"physical" | "digital">("physical");
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState("");

  const sellable = items.filter((i) => i.id && i.sellable);
  const legacy = items.filter((i) => i.id && !i.sellable);
  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  function startEdit(item?: StoreItem) {
    setEditing(item ?? null);
    setKind(item?.kind === "digital" ? "digital" : "physical");
    setFile(null);
    setProgress("");
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
    const digital = kind === "digital";
    const stock = digital ? 0 : Number(form.stock);
    if (!form.title.trim()) return setError("Add a title.");
    if (!Number.isFinite(priceKobo) || priceKobo < STORE_ITEM_MIN_KOBO || priceKobo > STORE_ITEM_MAX_KOBO) return setError("Price must be between ₦100 and ₦5,000,000.");
    if (!digital && (!Number.isFinite(deliveryKobo) || deliveryKobo < 0 || deliveryKobo > STORE_DELIVERY_MAX_KOBO)) return setError("Delivery fee must be between ₦0 and ₦50,000.");
    if (!digital && (form.stock.trim() === "" || !Number.isInteger(stock) || stock < 0 || stock > 100000)) return setError("Enter how many you have in stock (a whole number; 0 means sold out).");
    if (digital && !editing && !file) return setError("Choose the file buyers will download.");
    if (file && file.size > DIGITAL_MAX_BYTES) return setError(`The file is too big — the limit is ${DIGITAL_MAX_BYTES / 1024 / 1024} MB.`);
    const input = {
      title: form.title, subtitle: form.subtitle, badge: form.badge, image: form.image,
      price: `₦${(priceKobo / 100).toLocaleString("en-NG")}`, link: "", cta: digital ? "Buy & download" : "Buy now",
      sellable: true, priceKobo, deliveryKobo: digital ? 0 : deliveryKobo, stock,
      ...(digital ? { kind: "digital" as const } : {}),
    };
    setBusy(true);
    try {
      const previousStock = editing?.stock ?? 0;
      const stockChanged = !editing || stock !== previousStock;
      let id = editing?.id;
      if (editing?.id) await updateStoreItem(profile.uid, editing.id, input, stockChanged);
      else id = await addStoreItem(profile.uid, input);
      // A digital item's file goes to private storage after the listing exists (the server checks
      // the file and attaches it). If the upload fails the listing stays hidden from buyers until
      // a file is attached — the seller can retry with Edit.
      if (digital && file && id && auth.currentUser) {
        try {
          await attachDigitalFile(auth.currentUser, id, file, setProgress);
        } catch (err) {
          setOpen(false);
          setEditing(null);
          setForm(EMPTY);
          setFile(null);
          setError((err instanceof Error ? err.message : "The file didn't upload.") + " The item is saved but hidden from buyers — use Edit to attach the file again.");
          onChanged();
          return;
        }
      }
      // Back above zero → tell the people waiting for it (their bell).
      if (!digital && id && stock > 0 && previousStock <= 0 && auth.currentUser) {
        fetch("/api/store/restock", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${await auth.currentUser.getIdToken()}` },
          body: JSON.stringify({ itemId: id }),
        }).catch(() => {});
      }
      setOpen(false);
      setEditing(null);
      setForm(EMPTY);
      setFile(null);
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
            <strong>Physical items</strong> are sold through #NotesApp checkout: the buyer pays here and the money is held until they confirm delivery (or 7 days after you mark it delivered), minus our commission on the item price.
            You keep the delivery fee, arrange delivery and keep the parcel&apos;s tracking up to date under Orders. Stock is counted down automatically; at 0 nobody can order, and people who asked get a bell alert when you restock.
            {" "}<strong>Digital downloads</strong> are a file you upload: the buyer pays, downloads instantly, and the sale is final once downloaded (no refunds). Your share is paid after a 7-day dispute window. Commission is higher for downloads — see <Link href="/pricing" className="text-crimson underline">Pricing</Link>.
            Payouts need a payout account under Rates &amp; payouts.
          </p>
        </div>
        {!open && <button onClick={() => startEdit()} className="btn-primary !px-4 !py-2 text-xs">Add item</button>}
      </div>
      {msg && !open && <p className="mt-3 text-sm text-ink">{msg}</p>}

      {sellable.length > 0 && !open && (
        <ul className="mt-4 divide-y divide-rule border-t border-rule">
          {sellable.map((i) => (
            <li key={i.id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <span className="truncate">{i.title} <span className="font-mono text-xs text-slate">· {i.price} · {i.kind === "digital" ? (i.fileName ? `download · ${i.fileName}${i.fileSize ? ` (${fmtSize(i.fileSize)})` : ""}` : "download · NO FILE YET") : i.stock && i.stock > 0 ? `${i.stock} in stock` : "sold out"}</span></span>
              <span className="flex shrink-0 gap-3 font-ui text-xs font-semibold">
                <Link href={`/boost/item/${i.id}`} className="text-crimson">Boost</Link>
                <button onClick={() => startEdit(i)} className="text-crimson">{i.kind === "digital" ? "Edit / replace file" : "Edit / restock"}</button>
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
          <div className="sm:col-span-2 text-xs text-slate">
            What are you selling?
            <div className="mt-1 inline-flex overflow-hidden rounded-full border border-rule" role="group" aria-label="Item type">
              {(["physical", "digital"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  disabled={!!editing}
                  onClick={() => setKind(k)}
                  className={`px-4 py-1.5 text-xs font-semibold ${kind === k ? "bg-crimson text-paper" : "text-ink hover:text-crimson"} disabled:cursor-not-allowed`}
                >
                  {k === "physical" ? "Physical item" : "Digital download"}
                </button>
              ))}
            </div>
            {editing && <span className="ml-2">(can&apos;t be changed after adding)</span>}
          </div>
          <label className="sm:col-span-2 text-xs text-slate">Title
            <input value={form.title} onChange={set("title")} maxLength={120} className={field} required />
          </label>
          <label className="sm:col-span-2 text-xs text-slate">Description (optional)
            <textarea value={form.subtitle} onChange={set("subtitle")} maxLength={400} rows={3} className={field} />
          </label>
          <label className="text-xs text-slate">Price (₦)
            <input type="number" min={100} step={50} value={form.priceNaira} onChange={set("priceNaira")} className={field} required />
          </label>
          {kind === "physical" ? (
            <>
              <label className="text-xs text-slate">Delivery fee (₦, yours)
                <input type="number" min={0} step={50} value={form.deliveryNaira} onChange={set("deliveryNaira")} className={field} />
              </label>
              <label className="text-xs text-slate">In stock
                <input type="number" min={0} step={1} value={form.stock} onChange={set("stock")} className={field} required />
              </label>
            </>
          ) : (
            <div className="sm:col-span-2 text-xs text-slate">
              {editing ? "Replace the file (optional)" : "File buyers will download"}
              <input type="file" accept={DIGITAL_EXTENSIONS.map((e) => `.${e}`).join(",")} onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="mt-1 block text-sm" />
              <span className="mt-1 block">
                {editing?.fileName && !file ? `Current file: ${editing.fileName}${editing.fileSize ? ` (${fmtSize(editing.fileSize)})` : ""}. ` : ""}
                Up to {DIGITAL_MAX_BYTES / 1024 / 1024} MB — {DIGITAL_EXTENSIONS.join(", ")}. Stored privately: only people who pay can download it, and a sale is final once downloaded.
              </span>
            </div>
          )}
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
            <button className="btn-primary !px-4 !py-2 text-xs" disabled={busy}>{busy ? progress || "Saving…" : editing ? "Save changes" : "Add to store"}</button>
            <button type="button" onClick={() => setOpen(false)} className="btn-ghost !px-4 !py-2 text-xs">Cancel</button>
          </div>
        </form>
      )}
      {!open && error && <p className="mt-3 text-sm text-crimson">{error}</p>}
    </div>
  );
}
