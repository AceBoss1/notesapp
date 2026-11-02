"use client";

import { useState } from "react";
import { EXPENSE_METHODS, MAX_RECEIPT_PHOTOS, type Method } from "@/lib/books";
import { Icon, Sheet, field, nairaInput, newClientId, type Api } from "./shared";

// Add an expense: the amount, the day, how it was paid, a category (or a new one) and a note, with up to 3 receipt photos kept privately.
export default function AddExpense({ api, today, categories, onClose, onSaved }: { api: Api; today: string; categories: { id: string; label: string }[]; onClose: () => void; onSaved: () => void }) {
  const [amount, setAmount] = useState("");
  const [on, setOn] = useState(today);
  const [method, setMethod] = useState<Method>("cash");
  const [category, setCategory] = useState("");
  const [newCat, setNewCat] = useState("");
  const [note, setNote] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [clientId] = useState(newClientId);

  const save = async () => {
    setErr("");
    const k = nairaInput(amount);
    if (!k) return setErr("Enter the amount.");
    if (!category) return setErr("Choose a category.");
    setBusy(true);
    try {
      const { entry } = await api<{ entry: { id: string } }>("", { action: "expense", clientId, amountKobo: k, on, method, category: category === "new" ? newCat : category, note });
      const failed: string[] = [];
      for (const f of files) {
        try {
          const s = await api<{ key: string; uploadUrl: string; contentType: string }>("", { action: "photoStart", entryId: entry.id, file: { name: f.name, size: f.size } });
          const put = await fetch(s.uploadUrl, { method: "PUT", headers: { "Content-Type": s.contentType }, body: f });
          if (!put.ok) throw new Error("The upload didn't go through.");
          await api("", { action: "photoAttach", entryId: entry.id, file: { key: s.key, name: f.name } });
        } catch (e) { failed.push((e as Error).message); }
      }
      onSaved();
      if (failed.length) { setErr(`The expense is saved. ${failed[0]}`); setBusy(false); return; }
      onClose();
    } catch (e) { setErr((e as Error).message); setBusy(false); }
  };

  return (
    <Sheet title="Add an expense" eyebrow="New entry · money out" onClose={onClose}>
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm font-semibold text-ink">Amount (₦)<input autoFocus value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="18,000" className={`${field} mt-1 text-lg`} /></label>
        <label className="block text-sm font-semibold text-ink">Day<input type="date" value={on} max={today} onChange={(e) => setOn(e.target.value)} className={`${field} mt-1`} /></label>
      </div>
      <p className="mt-4 text-sm font-semibold text-ink">Paid how?</p>
      <div className="mt-2 grid grid-cols-4 gap-2">
        {EXPENSE_METHODS.map((m) => <button key={m.id} onClick={() => setMethod(m.id)} className={`rounded-xl border px-2 py-3 font-ui text-sm font-semibold ${method === m.id ? "border-crimson bg-crimson/10 text-crimson" : "border-rule text-ink"}`}>{m.label}</button>)}
      </div>
      <label className="mt-4 block text-sm font-semibold text-ink">Category
        <select value={category} onChange={(e) => setCategory(e.target.value)} className={`${field} mt-1`}>
          <option value="">Choose…</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          <option value="new">＋ A new category</option>
        </select>
      </label>
      {category === "new" && <input value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder="For example: Generator repairs" aria-label="New category" className={`${field} mt-2`} />}
      <label className="mt-4 block text-sm font-semibold text-ink">Note<input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Diesel for the generator" className={`${field} mt-1`} /></label>
      <div className="mt-4">
        <p className="text-sm font-semibold text-ink">Receipt photos <span className="font-normal text-slate">(up to {MAX_RECEIPT_PHOTOS}, kept private)</span></p>
        <label className="mt-2 flex cursor-pointer items-center gap-2 rounded-2xl border border-dashed border-rule p-3 text-sm text-slate hover:border-crimson">
          <Icon name="camera" className="h-5 w-5" />{files.length ? files.map((f) => f.name).join(", ") : "Take a photo or choose one"}
          <input type="file" accept="image/*,application/pdf" multiple className="sr-only" onChange={(e) => setFiles(Array.from(e.target.files ?? []).slice(0, MAX_RECEIPT_PHOTOS))} />
        </label>
      </div>
      {err && <p className="mt-3 text-sm text-red-700" role="alert">{err}</p>}
      <button onClick={save} disabled={busy} className="btn-primary mt-5 w-full !py-4 !text-base">{busy ? "Saving…" : "Save expense"}</button>
    </Sheet>
  );
}
