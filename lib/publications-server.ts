import type { Firestore } from "firebase-admin/firestore";
import { LIMITS, type Publication } from "./site-kits";
import { cleanDoi, cleanOrcid, fromBibtex, fromCrossref, fromOrcidBulk, mergePublications, orcidPutCodes } from "./publications-import";
import { SiteError, readSite } from "./site-server";
import { canHaveSite } from "./site-themes";

// Importing publications (lib/publications-import.ts): fetching from Crossref and ORCID's public API, and the daily ORCID sync. Server-only.
const CONTACT = "hello@notesapp.name.ng"; // Crossref asks callers to say who they are
async function getJson(url: string, accept = "application/json"): Promise<unknown> {
  const res = await fetch(url, { headers: { Accept: accept, "User-Agent": `NotesApp/1.0 (https://www.notesapp.name.ng; mailto:${CONTACT})` }, cache: "no-store", signal: AbortSignal.timeout(12_000) });
  if (res.status === 404) return null;
  if (!res.ok) throw new SiteError(502, "That service didn't answer. Try again in a minute.");
  return res.json();
}

export async function fromDoi(doi: unknown): Promise<Publication> {
  const d = cleanDoi(doi);
  if (!d) throw new SiteError(400, "Enter a DOI, like 10.1038/nature14539 or https://doi.org/10.1038/nature14539.");
  const p = fromCrossref(await getJson(`https://api.crossref.org/works/${encodeURIComponent(d)}`));
  if (!p) throw new SiteError(404, "No paper found with that DOI.");
  return p;
}

// Every public work on an ORCID record (the first 300).
export async function fromOrcid(orcid: unknown): Promise<Publication[]> {
  const id = cleanOrcid(orcid);
  if (!id) throw new SiteError(400, "Enter your ORCID iD, like 0000-0002-1825-0097 (it's on your ORCID page).");
  const works = await getJson(`https://pub.orcid.org/v3.0/${id}/works`);
  if (!works) throw new SiteError(404, "No ORCID record with that iD.");
  const codes = orcidPutCodes(works).slice(0, 300);
  const out: Publication[] = [];
  for (let i = 0; i < codes.length; i += 100) out.push(...fromOrcidBulk(await getJson(`https://pub.orcid.org/v3.0/${id}/works/${codes.slice(i, i + 100).join(",")}`)));
  return out;
}

// What an import would add, for the member to check before saving the section.
export async function previewImport(raw: { source?: unknown; text?: unknown; doi?: unknown; orcid?: unknown }): Promise<Publication[]> {
  if (raw.source === "bibtex") {
    const text = String(raw.text ?? "");
    if (text.length > 2_000_000) throw new SiteError(413, "That file is too big (2 MB at most).");
    const list = fromBibtex(text);
    if (!list.length) throw new SiteError(400, "No publications found in that file. Export it as BibTeX (.bib) and try again.");
    return list;
  }
  if (raw.source === "doi") return [await fromDoi(raw.doi)];
  if (raw.source === "orcid") return fromOrcid(raw.orcid);
  throw new SiteError(400, "Choose where to import from.");
}

// Linking an ORCID iD (or unlinking it): with sync on, new works are added to Publications every day.
export async function setOrcid(db: Firestore, uid: string, raw: { orcid?: unknown; sync?: unknown }, now = new Date()) {
  const p = (await db.doc(`users/${uid}`).get()).data();
  if (!p || !canHaveSite(p as Parameters<typeof canHaveSite>[0])) throw new SiteError(403, "Your own site comes with Free Basic and above.");
  if (raw.orcid === null || raw.orcid === "") { await db.doc(`sites/${uid}`).set({ orcid: null, uid }, { merge: true }); return null; }
  const id = cleanOrcid(raw.orcid);
  if (!id) throw new SiteError(400, "That isn't an ORCID iD (check the last character).");
  const link = { id, sync: raw.sync === true };
  await db.doc(`sites/${uid}`).set({ orcid: link, uid, updatedAt: now.toISOString() }, { merge: true });
  return link;
}

// The daily sync for one site: new works on the ORCID record are added to Publications (switched on), never twice, the member's edits kept.
export async function syncOrcidFor(db: Firestore, uid: string, now = new Date(), fetchWorks = fromOrcid): Promise<number> {
  const site = await readSite(db, uid);
  if (!site.orcid?.sync) return 0;
  const m = mergePublications(site.blocks.publications.items, await fetchWorks(site.orcid.id), LIMITS.publications);
  const update: Record<string, unknown> = { "orcid.lastSyncAt": now.toISOString() };
  if (m.added) { update["blocks.publications.items"] = m.items; update["blocks.publications.on"] = true; update.updatedAt = now.toISOString(); }
  await db.doc(`sites/${uid}`).update(update);
  return m.added;
}
// The cron: every site with sync on that hasn't synced for 20 hours, a few at a time.
export async function syncOrcidSites(db: Firestore, now = new Date(), fetchWorks = fromOrcid): Promise<number> {
  const snap = await db.collection("sites").where("orcid.sync", "==", true).limit(500).get();
  const due = snap.docs.filter((d) => !d.data().orcid?.lastSyncAt || now.getTime() - new Date(d.data().orcid.lastSyncAt).getTime() > 20 * 3_600_000).slice(0, 25);
  let n = 0;
  for (const d of due) n += await syncOrcidFor(db, d.id, now, fetchWorks).catch(() => 0);
  return n;
}
