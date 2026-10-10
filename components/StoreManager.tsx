"use client";

import { useRef, useState } from "react";
import { UserProfile } from "@/lib/users";
import { auth } from "@/lib/firebase";
import { uploadToR2 } from "@/lib/upload";
import { STORE_DELIVERY_MAX_KOBO, STORE_ITEM_MAX_KOBO, STORE_ITEM_MIN_KOBO } from "@/lib/orders";
import Link from "next/link";
import { addStoreItem, updateStoreItem, deleteStoreItem, StoreItem, MAX_IMAGES, MAX_VARIANTS, cleanOptions, variantKey, DEFAULT_STORE_IMAGE } from "@/lib/store";
import { attachDigitalFile, fmtSize } from "@/lib/store-files";
import LessonsEditor from "@/components/LessonsEditor";
import { canSellViewOnly } from "@/lib/tiers";
import { effectiveTier } from "@/lib/users";
import { DIGITAL_EXTENSIONS, DIGITAL_MAX_BYTES } from "@/lib/private-files-config";
import { STORE_CATEGORIES, SHIPS_FROM_MAX, cleanShipsFrom, shipsFromOk } from "@/lib/store-meta";

const field = "mt-1 w-full border border-rule bg-card px-3 py-2 font-body text-sm outline-none focus:border-gold";
const EMPTY = { title: "", subtitle: "", badge: "", priceNaira: "", deliveryNaira: "0", stock: "", category: "", shipsFrom: "" };
// Size/colour entries the seller has ticked ✔ so far: one row per saved combination, with how many pieces of it they have.
type VariantRow = { values: string[]; qty: number };
const EMPTY_DRAFT = { values: ["", ""], qty: "" };
const SIZE_HINTS = ["S", "M", "L", "XL", "2XL", "3XL"];

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
  // Digital only: a file to download, or view-only lessons (Pro and above), chosen when the item is added.
  const [access, setAccess] = useState<"download" | "view">("download");
  const [lessonsFor, setLessonsFor] = useState<string | null>(null);
  const viewOnlyOk = canSellViewOnly(effectiveTier(profile));
  const [progress, setProgress] = useState("");
  // Photos (the first is the main one), up to two options like Size/Colour, and stock per combination.
  const [images, setImages] = useState<string[]>([]);
  const [optNames, setOptNames] = useState<[string, string]>(["Size", ""]);
  const [rows, setRows] = useState<VariantRow[]>([]);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [variantNote, setVariantNote] = useState("");
  const firstValue = useRef<HTMLInputElement>(null);
  const resetVariants = () => { setOptNames(["Size", ""]); setRows([]); setDraft(EMPTY_DRAFT); setVariantNote(""); };
  const nameCount = optNames[1].trim() ? 2 : 1;
  // The options buyers see are built from the entries saved so far (in the order they were added).
  const options = rows.length === 0 ? [] : cleanOptions(Array.from({ length: nameCount }, (_, i) => ({ name: optNames[i], choices: rows.map((r) => r.values[i]) })));
  const totalPieces = rows.reduce((n, r) => n + r.qty, 0);
  const draftHasText = draft.values.some((v) => v.trim()) || draft.qty.trim() !== "";

  // The ✔: validates the entry being typed, adds it (or updates its quantity if that size/colour is already saved) and gets ready for the next.
  function saveDraft() {
    setError("");
    const values = draft.values.slice(0, nameCount).map((v) => v.replace(/\|/g, " ").trim().slice(0, 24));
    const qty = Number(draft.qty);
    if (!optNames[0].trim()) return setVariantNote("Name the option first, for example Size.");
    if (values.some((v) => !v)) return setVariantNote(`Fill in ${values.map((v, i) => (v ? "" : optNames[i].trim().toLowerCase())).filter(Boolean).join(" and ")}.`);
    if (draft.qty.trim() === "" || !Number.isInteger(qty) || qty < 0 || qty > 100000) return setVariantNote("Enter how many pieces you have (a whole number; 0 means sold out).");
    const key = variantKey(values);
    const at = rows.findIndex((r) => variantKey(r.values) === key);
    if (at < 0 && rows.length >= MAX_VARIANTS) return setVariantNote(`Up to ${MAX_VARIANTS} entries per item.`);
    setRows((rs) => (at >= 0 ? rs.map((r, i) => (i === at ? { values, qty } : r)) : [...rs, { values, qty }]));
    setVariantNote(at >= 0 ? `Updated ${values.join(" / ")} to ${qty}.` : `Saved ${values.join(" / ")}: ${qty}. Add the next one.`);
    setDraft(EMPTY_DRAFT);
    setTimeout(() => firstValue.current?.focus(), 0);
  }

  const sellable = items.filter((i) => i.id && i.sellable);
  const legacy = items.filter((i) => i.id && !i.sellable);
  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  function startEdit(item?: StoreItem) {
    setEditing(item ?? null);
    setKind(item?.kind === "digital" ? "digital" : "physical");
    setAccess(item?.access === "view" ? "view" : "download");
    setFile(null);
    setProgress("");
    setImages(item ? (item.images?.length ? item.images : item.image && item.image !== DEFAULT_STORE_IMAGE ? [item.image] : []) : []);
    resetVariants();
    if (item?.options?.length) {
      setOptNames([item.options[0].name, item.options[1]?.name ?? ""]);
      setRows(Object.entries(item.variantStock ?? {}).map(([k, q]) => ({ values: k.split("|"), qty: Number(q) || 0 })));
    }
    setForm(
      item
        ? { title: item.title, subtitle: item.subtitle ?? "", badge: item.badge ?? "", priceNaira: String((item.priceKobo ?? 0) / 100), deliveryNaira: String((item.deliveryKobo ?? 0) / 100), stock: String(item.stock ?? 0), category: item.category ?? "", shipsFrom: item.shipsFrom ?? "" }
        : EMPTY
    );
    setError("");
    setMsg("");
    setOpen(true);
  }

  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).slice(0, Math.max(0, MAX_IMAGES - images.length));
    e.target.value = "";
    if (files.length === 0) return;
    setBusy(true);
    setError("");
    try {
      const urls: string[] = [];
      for (const f of files) urls.push(await uploadToR2(f, "journal"));
      setImages((cur) => [...cur, ...urls].slice(0, MAX_IMAGES));
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
    const withOptions = !digital && rows.length > 0;
    const stock = digital ? 0 : withOptions ? totalPieces : Number(form.stock);
    if (!form.title.trim()) return setError("Add a title.");
    if (!form.category) return setError("Choose a category so buyers can find the item.");
    if (!digital && !shipsFromOk(form.shipsFrom)) return setError("Say where this item ships from (for example Lekki, Lagos). Buyers see it before they pay.");
    if (!Number.isFinite(priceKobo) || priceKobo < STORE_ITEM_MIN_KOBO || priceKobo > STORE_ITEM_MAX_KOBO) return setError("Price must be between ₦100 and ₦5,000,000.");
    if (!digital && (!Number.isFinite(deliveryKobo) || deliveryKobo < 0 || deliveryKobo > STORE_DELIVERY_MAX_KOBO)) return setError("Delivery fee must be between ₦0 and ₦50,000.");
    if (!withOptions && !digital && (form.stock.trim() === "" || !Number.isInteger(stock) || stock < 0 || stock > 100000)) return setError("Enter how many you have in stock (a whole number; 0 means sold out).");
    if (!digital && draftHasText) return setError("Tick ✔ to save the size you are typing, or clear it, before saving the item.");
    if (images.length > MAX_IMAGES) return setError(`Up to ${MAX_IMAGES} photos.`);
    const viewOnly = digital && access === "view";
    if (viewOnly && !editing && !viewOnlyOk) return setError("View-only items and courses are on the Pro plan and above.");
    if (digital && !viewOnly && !editing && !file) return setError("Choose the file buyers will download.");
    if (file && file.size > DIGITAL_MAX_BYTES) return setError(`The file is too big — the limit is ${DIGITAL_MAX_BYTES / 1024 / 1024} MB.`);
    const input = {
      title: form.title, subtitle: form.subtitle, badge: form.badge, image: images[0] ?? "", images, category: form.category, ...(digital ? {} : { shipsFrom: cleanShipsFrom(form.shipsFrom) }),
      ...(withOptions ? { options, variantStock: Object.fromEntries(rows.map((r) => [variantKey(r.values), r.qty])) } : {}),
      price: `₦${(priceKobo / 100).toLocaleString("en-NG")}`, link: "", cta: digital ? (viewOnly ? "Buy & view" : "Buy & download") : "Buy now",
      sellable: true, priceKobo, deliveryKobo: digital ? 0 : deliveryKobo, stock,
      ...(digital ? { kind: "digital" as const, ...(viewOnly ? { access: "view" as const } : {}) } : {}),
    };
    setBusy(true);
    try {
      const previousStock = editing?.stock ?? 0;
      // Stock counts as edited when it, or the options it's kept under, changed — otherwise the live numbers in the database win.
      const sameOptions = JSON.stringify(options) === JSON.stringify(editing?.options ?? []);
      const sameVariantStock = rows.length === Object.keys(editing?.variantStock ?? {}).length && rows.every((r) => (editing?.variantStock?.[variantKey(r.values)] ?? -1) === r.qty);
      const stockChanged = !editing || (withOptions ? !sameOptions || !sameVariantStock : stock !== previousStock || (editing.options?.length ?? 0) > 0);
      let id = editing?.id;
      if (editing?.id) await updateStoreItem(profile.uid, editing.id, input, stockChanged);
      else id = await addStoreItem(profile.uid, input);
      // A digital item's file goes to private storage after the listing exists (the server checks
      // the file and attaches it). If the upload fails the listing stays hidden from buyers until
      // a file is attached — the seller can retry with Edit.
      if (digital && !viewOnly && file && id && auth.currentUser) {
        try {
          await attachDigitalFile(auth.currentUser, id, file, setProgress);
        } catch (err) {
          setOpen(false);
          setEditing(null);
          setForm(EMPTY);
          setImages([]);
          resetVariants();
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
      setImages([]);
      resetVariants();
      setFile(null);
      setMsg(viewOnly && id && !editing ? "Saved — now add its lessons below. Buyers can't see it until it has one." : "Saved.");
      if (viewOnly && id) setLessonsFor(id);
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
            <li key={i.id} className="py-2 text-sm">
             <div className="flex items-center justify-between gap-3">
              <span className="truncate">{i.title} <span className="font-mono text-xs text-slate">· {i.price} · {i.kind === "digital" ? (i.access === "view" ? ((i.lessonCount ?? 0) > 0 ? `view only · ${i.lessonCount} lesson${i.lessonCount === 1 ? "" : "s"}` : "view only · NO LESSONS YET") : i.fileName ? `download · ${i.fileName}${i.fileSize ? ` (${fmtSize(i.fileSize)})` : ""}` : "download · NO FILE YET") : i.stock && i.stock > 0 ? `${i.stock} in stock${i.options?.length ? ` · ${i.options.map((o) => o.name).join(" × ")}` : ""}` : "sold out"}</span></span>
              <span className="flex shrink-0 gap-3 font-ui text-xs font-semibold">
                <Link href={`/boost/item/${i.id}`} className="text-crimson">Boost</Link>
                {i.access === "view" && <button onClick={() => setLessonsFor(lessonsFor === i.id ? null : i.id!)} className="text-crimson">Lessons</button>}
                <button onClick={() => startEdit(i)} className="text-crimson">{i.kind === "digital" ? (i.access === "view" ? "Edit" : "Edit / replace file") : "Edit / restock"}</button>
                <button onClick={() => remove(i.id!)} className="text-slate hover:text-crimson" disabled={busy}>Remove</button>
              </span>
             </div>
             {lessonsFor === i.id && auth.currentUser && <LessonsEditor key={i.id} user={auth.currentUser} item={i} onChanged={onChanged} />}
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
          {kind === "digital" && (
            <div className="sm:col-span-2 text-xs text-slate">
              How do buyers get it?
              <div className="mt-1 inline-flex overflow-hidden rounded-full border border-rule" role="group" aria-label="Delivery">
                {(["download", "view"] as const).map((a) => (
                  <button key={a} type="button" disabled={!!editing || (a === "view" && !viewOnlyOk)} onClick={() => setAccess(a)}
                    className={`px-4 py-1.5 text-xs font-semibold ${access === a ? "bg-crimson text-paper" : "text-ink hover:text-crimson"} disabled:cursor-not-allowed disabled:opacity-50`}>
                    {a === "download" ? "Download the file" : "View only — video & course"}
                  </button>
                ))}
              </div>
              {!viewOnlyOk && !editing && <span className="ml-2">View-only and courses are on <Link href="/pricing" className="text-crimson underline">Pro and above</Link>.</span>}
            </div>
          )}
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
              <label className="text-xs text-slate">Ships from (city or area, so buyers know)
                <input value={form.shipsFrom} maxLength={SHIPS_FROM_MAX} placeholder="Lekki, Lagos" onChange={set("shipsFrom")} className={field} required />
              </label>
              {rows.length === 0 && (
                <label className="text-xs text-slate">In stock
                  <input type="number" min={0} step={1} value={form.stock} onChange={set("stock")} className={field} required={rows.length === 0} />
                </label>
              )}
              <div className="sm:col-span-2 text-xs text-slate">
                <p className="font-bold text-ink">Sizes or colours (optional)</p>
                <p className="mt-0.5">Add one at a time: type the size and how many pieces you have, then tick ✔ to save it and add the next. Leave this empty if the item has no sizes.</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <label>Option name
                    <input value={optNames[0]} maxLength={20} placeholder="Size" onChange={(e) => setOptNames((n) => [e.target.value, n[1]])} className={field} />
                  </label>
                  <label>Second option, if any (for example Colour)
                    <input value={optNames[1]} maxLength={20} placeholder="Colour" onChange={(e) => setOptNames((n) => [n[0], e.target.value])} className={field} />
                  </label>
                </div>
                {rows.length > 0 && (
                  <ul className="mt-3 divide-y divide-rule border border-rule bg-card">
                    {rows.map((r, i) => (
                      <li key={variantKey(r.values)} className="flex items-center justify-between gap-3 px-3 py-1.5">
                        <span className="min-w-0 truncate text-ink"><span className="mr-1 text-moss">✔</span>{r.values.map((v, k) => `${optNames[k] || "Option"} ${v}`).join(" · ")}</span>
                        <span className="flex shrink-0 items-center gap-3">
                          <span className="font-mono text-ink">{r.qty} pc{r.qty === 1 ? "" : "s"}{r.qty === 0 ? " · sold out" : ""}</span>
                          <button type="button" className="text-crimson" onClick={() => { setDraft({ values: [r.values[0] ?? "", r.values[1] ?? ""], qty: String(r.qty) }); setVariantNote(`Editing ${r.values.join(" / ")}: change the number and tick ✔.`); setTimeout(() => firstValue.current?.focus(), 0); }}>Edit</button>
                          <button type="button" className="text-crimson" aria-label={`Remove ${r.values.join(" ")}`} onClick={() => setRows((rs) => rs.filter((_, k) => k !== i))}>Remove</button>
                        </span>
                      </li>
                    ))}
                    <li className="flex justify-between bg-paper px-3 py-1.5 font-bold text-ink"><span>Total in stock</span><span className="font-mono">{totalPieces}</span></li>
                  </ul>
                )}
                <div className="mt-3 flex flex-wrap items-end gap-2" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); saveDraft(); } }}>
                  {Array.from({ length: nameCount }, (_, i) => (
                    <label key={i} className="min-w-[6rem] flex-1">{optNames[i].trim() || (i === 0 ? "Size" : "Colour")}
                      <input ref={i === 0 ? firstValue : undefined} value={draft.values[i]} maxLength={24} placeholder={i === 0 ? "e.g. L" : "e.g. Red"} onChange={(e) => setDraft((d) => ({ ...d, values: d.values.map((v, k) => (k === i ? e.target.value : v)) }))} className={field} />
                    </label>
                  ))}
                  <label className="w-24">How many
                    <input type="number" min={0} step={1} value={draft.qty} placeholder="5" onChange={(e) => setDraft((d) => ({ ...d, qty: e.target.value }))} className={field} />
                  </label>
                  <button type="button" onClick={saveDraft} aria-label="Save this entry" title="Save this entry" className="mb-0 h-[2.4rem] border border-moss bg-moss px-4 text-base font-bold text-white hover:opacity-90">✔</button>
                </div>
                {optNames[0].trim().toLowerCase() === "size" && nameCount === 1 && (
                  <p className="mt-2 flex flex-wrap items-center gap-1.5">Quick sizes:
                    {SIZE_HINTS.map((h) => <button key={h} type="button" onClick={() => setDraft((d) => ({ ...d, values: [h, d.values[1]] }))} className="border border-rule bg-card px-2 py-0.5 text-ink hover:border-crimson">{h}</button>)}
                  </p>
                )}
                {variantNote && <p className="mt-2 text-ink" role="status">{variantNote}</p>}
              </div>
            </>
          ) : access === "view" ? (
            <div className="sm:col-span-2 text-xs text-slate">
              View-only: you&apos;ll add the video and PDF lessons right after saving. Buyers watch and read them here on #NotesApp, on up to 2 devices, and can&apos;t download them. A sale is final once they open it.
            </div>
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
          <label className="text-xs text-slate">Category (buyers can filter by it)
            <select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} className={field} required>
              <option value="">Choose…</option>
              {STORE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label className="text-xs text-slate">Tag (optional, e.g. Best Seller)
            <input value={form.badge} onChange={set("badge")} maxLength={24} className={field} />
          </label>
          <div className="sm:col-span-2 text-xs text-slate">
            {kind === "digital" ? <>Images (up to {MAX_IMAGES}; the first is the main one — for a book, add the front and back cover)</> : <>Photos (up to {MAX_IMAGES}; the first is the main one — 2 or 3 show your item best)</>}
            <div className="mt-1 flex flex-wrap items-center gap-3">
              {images.map((src, i) => (
                <span key={src} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="" className="h-20 w-16 object-cover" />
                  {i === 0 && <span className="absolute bottom-0 left-0 bg-ink/70 px-1 text-[10px] text-paper">Main</span>}
                  <button type="button" aria-label="Remove photo" onClick={() => setImages((cur) => cur.filter((_, j) => j !== i))} className="absolute -right-1.5 -top-1.5 h-5 w-5 rounded-full bg-crimson text-[11px] leading-5 text-paper">×</button>
                  {i > 0 && <button type="button" onClick={() => setImages((cur) => [cur[i], ...cur.filter((_, j) => j !== i)])} className="absolute bottom-0 right-0 bg-paper/90 px-1 text-[10px] text-crimson">Make main</button>}
                </span>
              ))}
              {images.length < MAX_IMAGES && <input type="file" accept="image/*" multiple onChange={upload} />}
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
