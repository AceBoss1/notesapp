"use client";

import { useState } from "react";
import { auth } from "@/lib/firebase";
import type { OrcidLink, Publication } from "@/lib/site-kits";

// The Publications section's import (lib/publications-import.ts): a BibTeX file (Google Scholar's export), a DOI, or an ORCID iD, with
// ORCID's daily sync. What comes in is added to the list below (never twice); the member checks it and saves the section.
const small = "rounded-full border border-rule px-3 py-1 text-xs font-semibold text-ink hover:border-crimson disabled:opacity-40";
const field = "rounded-lg border border-rule bg-card px-2 py-1.5 text-sm outline-none focus:border-crimson";
async function post(body: unknown) {
  const u = auth.currentUser;
  if (!u) throw new Error("Sign in again.");
  const res = await fetch("/api/site/publications", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${await u.getIdToken()}` }, body: JSON.stringify(body) });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error || "Couldn't import that.");
  return j;
}

export default function ImportPublications({ onAdd, orcid, onOrcid }: { onAdd: (items: Publication[]) => number; orcid: OrcidLink | null; onOrcid: (o: OrcidLink | null) => void }) {
  const [doi, setDoi] = useState("");
  const [id, setId] = useState(orcid?.id ?? "");
  const [sync, setSync] = useState(orcid?.sync ?? true);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  async function run(what: string, body: Record<string, unknown>) {
    setBusy(what); setMsg("");
    try {
      const { items } = await post({ action: "preview", ...body });
      const added = onAdd(items);
      setMsg(added ? `${added} added below. Check them, then save the section.` : "Nothing new: those are already in your list.");
      return true;
    } catch (e) { setMsg(e instanceof Error ? e.message : "Couldn't import that."); return false; }
    finally { setBusy(null); }
  }
  return (
    <div className="mt-3 rounded-xl border border-dashed border-rule p-3 text-xs text-slate">
      <p className="font-ui text-sm font-bold text-ink">Import</p>
      <div className="mt-2 grid gap-3 sm:grid-cols-3">
        <div>
          <p className="font-semibold text-ink">From Google Scholar or a .bib file</p>
          <p className="mt-0.5">On your Google Scholar profile, tick the box above your list (select all), then Export → BibTeX, and upload the file here. Zotero and Mendeley exports work too.</p>
          <label className={`${small} mt-2 inline-block cursor-pointer`}>{busy === "bib" ? "Reading…" : "Upload .bib file"}
            <input type="file" accept=".bib,.bibtex,.txt,application/x-bibtex,text/plain" className="sr-only" onChange={async (e) => { const f = e.target.files?.[0]; if (f) await run("bib", { source: "bibtex", text: await f.text() }); e.target.value = ""; }} />
          </label>
        </div>
        <div>
          <p className="font-semibold text-ink">By DOI</p>
          <p className="mt-0.5">One paper&apos;s details, filled in from its DOI.</p>
          <span className="mt-2 flex gap-2"><input value={doi} onChange={(e) => setDoi(e.target.value)} placeholder="10.1038/nature14539" className={`${field} min-w-0 flex-1`} aria-label="DOI" />
            <button className={small} disabled={!doi.trim() || !!busy} onClick={async () => { if (await run("doi", { source: "doi", doi })) setDoi(""); }}>{busy === "doi" ? "…" : "Add"}</button></span>
        </div>
        <div>
          <p className="font-semibold text-ink">From ORCID</p>
          <p className="mt-0.5">Your public works on ORCID. Keep in sync adds new ones every day.</p>
          <span className="mt-2 flex gap-2"><input value={id} onChange={(e) => setId(e.target.value)} placeholder="0000-0002-1825-0097" className={`${field} min-w-0 flex-1`} aria-label="ORCID iD" />
            <button className={small} disabled={!id.trim() || !!busy} onClick={async () => {
              if (!(await run("orcid", { source: "orcid", orcid: id }))) return;
              try { onOrcid((await post({ action: "orcid", orcid: id, sync })).orcid); } catch (e) { setMsg(e instanceof Error ? e.message : "Couldn't link it."); }
            }}>{busy === "orcid" ? "…" : "Import"}</button></span>
          <label className="mt-1.5 flex items-center gap-1.5"><input type="checkbox" checked={sync} onChange={(e) => setSync(e.target.checked)} /> Keep in sync</label>
          {orcid && <p className="mt-1">Linked: {orcid.id}{orcid.sync ? " · syncing daily" : ""}{orcid.lastSyncAt ? ` · last ${new Date(orcid.lastSyncAt).toDateString()}` : ""} · <button className="text-crimson underline" onClick={() => post({ action: "orcid", orcid: null }).then(() => onOrcid(null)).catch(() => {})}>Unlink</button></p>}
        </div>
      </div>
      {msg && <p className="mt-2 text-sm text-ink" role="status">{msg}</p>}
    </div>
  );
}
