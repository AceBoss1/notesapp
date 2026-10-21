// Importing publications into a site's Publications section (owner, 21 Oct 2026), instead of typing each one. Pure: the parsers and the
// merge; lib/publications-server.ts fetches and saves.
//
// - BibTeX: a .bib file from Google Scholar (profile → select all → Export → BibTeX), Zotero, Mendeley or any reference manager. Google
//   Scholar has no way for other sites to read a profile, so its own export is how Scholar lists come in.
// - ORCID: the researcher's public works, through ORCID's official public API; with "keep in sync" new works arrive by themselves daily.
// - DOI: one paper's details from Crossref.
// Nothing is saved until the member saves the section; the same paper is never added twice (matched by DOI or by title).
import type { Publication } from "./site-kits";

const squash = (s: string) => s.replace(/\s+/g, " ").trim();
// The few LaTeX accents and symbols that turn up in titles and names.
const ACCENTS: Record<string, Record<string, string>> = {
  "'": { a: "á", e: "é", i: "í", o: "ó", u: "ú", A: "Á", E: "É", I: "Í", O: "Ó", U: "Ú", c: "ć", n: "ń", y: "ý" },
  "`": { a: "à", e: "è", i: "ì", o: "ò", u: "ù", A: "À", E: "È" },
  '"': { a: "ä", e: "ë", i: "ï", o: "ö", u: "ü", A: "Ä", O: "Ö", U: "Ü" },
  "^": { a: "â", e: "ê", i: "î", o: "ô", u: "û" },
  "~": { a: "ã", n: "ñ", o: "õ", N: "Ñ" },
  c: { c: "ç", C: "Ç" },
};
export function delatex(s: string): string {
  return squash(
    s
      .replace(/\\([`'"^~c])\s*\{?\\?([a-zA-Z])\}?/g, (m, a: string, ch: string) => ACCENTS[a]?.[ch] ?? ch)
      .replace(/\\&/g, "&").replace(/\\%/g, "%").replace(/\\_/g, "_").replace(/\\\$/g, "$")
      .replace(/--/g, "–").replace(/\\(?:textit|textbf|emph|mathrm|text)\s*/g, "")
      .replace(/[{}]/g, "").replace(/\\\\/g, " "),
  );
}
// "Obi, Ada and Bello, Tunde" → "Ada Obi, Tunde Bello" (and "et al." for "others").
export function bibAuthors(raw: string): string {
  return raw.split(/\s+and\s+/i).map((a) => {
    const s = delatex(a);
    if (/^others$/i.test(s)) return "et al.";
    const [last, first] = s.split(/\s*,\s*/);
    return first ? `${first} ${last}` : s;
  }).filter(Boolean).join(", ");
}
export function cleanDoi(v: unknown): string {
  const s = String(v ?? "").trim().replace(/^(?:https?:\/\/)?(?:dx\.)?doi\.org\//i, "").replace(/^doi:\s*/i, "");
  return /^10\.\d{4,9}\/\S+$/.test(s) ? s : "";
}
const doiUrl = (doi: string) => (doi ? `https://doi.org/${doi}` : "");
const httpsOnly = (u: string) => (/^https:\/\/[^\s"'<>]+$/i.test(u) ? u : "");
const trim = (s: string, n: number) => squash(s).slice(0, n);
const pub = (p: Partial<Publication>): Publication => ({ title: trim(p.title ?? "", 300), authors: trim(p.authors ?? "", 600), venue: trim(p.venue ?? "", 200), year: trim(p.year ?? "", 20), url: httpsOnly(p.url ?? ""), note: "" });

// ---- BibTeX ----
type Entry = { type: string; fields: Record<string, string> };
// Reads @type{key, field = {value} | "value" | number, …} entries, with nested braces; @comment, @string and @preamble are skipped.
export function parseBibtex(text: string, max = 500): Entry[] {
  const out: Entry[] = [];
  let i = 0;
  while (out.length < max) {
    const at = text.indexOf("@", i);
    if (at < 0) break;
    const m = /^@\s*([a-zA-Z]+)\s*[{(]/.exec(text.slice(at, at + 40));
    if (!m) { i = at + 1; continue; }
    const type = m[1].toLowerCase();
    let p = at + m[0].length;
    // the whole entry, to its matching brace
    const open = m[0].trim().slice(-1), close = open === "{" ? "}" : ")";
    let depth = 1, end = p;
    for (; end < text.length && depth > 0; end++) { if (text[end] === open) depth++; else if (text[end] === close) depth--; }
    const body = text.slice(p, end - 1);
    i = end;
    if (["comment", "string", "preamble"].includes(type)) continue;
    const fields: Record<string, string> = {};
    p = body.indexOf(",") + 1; // after the citation key
    if (p <= 0) continue;
    while (p < body.length) {
      const fm = /^\s*([a-zA-Z_-]+)\s*=\s*/.exec(body.slice(p));
      if (!fm) break;
      p += fm[0].length;
      let value = "";
      if (body[p] === "{") {
        let d = 1, q = p + 1;
        for (; q < body.length && d > 0; q++) { if (body[q] === "{") d++; else if (body[q] === "}") d--; }
        value = body.slice(p + 1, q - 1); p = q;
      } else if (body[p] === '"') {
        const q = body.indexOf('"', p + 1);
        value = body.slice(p + 1, q < 0 ? body.length : q); p = q < 0 ? body.length : q + 1;
      } else {
        const q = /^[^,]*/.exec(body.slice(p))![0];
        value = q.trim(); p += q.length;
      }
      fields[fm[1].toLowerCase()] = value;
      const comma = body.indexOf(",", p);
      p = comma < 0 ? body.length : comma + 1;
    }
    out.push({ type, fields });
  }
  return out;
}
export function fromBibtex(text: string): Publication[] {
  return parseBibtex(text).map(({ type, fields: f }) => {
    const doi = cleanDoi(f.doi);
    const venue = f.journal || f.booktitle || f.publisher || f.school || f.institution || f.howpublished || (type === "phdthesis" ? "PhD thesis" : "");
    return pub({ title: delatex(f.title ?? ""), authors: bibAuthors(f.author ?? ""), venue: delatex(venue), year: delatex(f.year ?? ""), url: doiUrl(doi) || delatex(f.url ?? "") });
  }).filter((p) => p.title);
}

// ---- Crossref (DOI) ----
type CrossrefWork = { title?: string[]; author?: { given?: string; family?: string; name?: string }[]; "container-title"?: string[]; publisher?: string; issued?: { "date-parts"?: number[][] }; DOI?: string; URL?: string };
export function fromCrossref(json: unknown): Publication | null {
  const m = (json as { message?: CrossrefWork })?.message;
  if (!m?.title?.[0]) return null;
  const authors = (m.author ?? []).map((a) => a.name ?? [a.given, a.family].filter(Boolean).join(" ")).filter(Boolean);
  return pub({
    title: m.title[0], authors: authors.length > 12 ? `${authors.slice(0, 10).join(", ")}, et al.` : authors.join(", "),
    venue: m["container-title"]?.[0] || m.publisher || "", year: String(m.issued?.["date-parts"]?.[0]?.[0] ?? ""), url: doiUrl(cleanDoi(m.DOI)) || m.URL || "",
  });
}

// ---- ORCID ----
// An ORCID iD: 0000-0002-1825-0097 (four blocks; the last character is a checksum, ISO 7064 11,2). Accepts the orcid.org address too.
export function cleanOrcid(v: unknown): string {
  const s = String(v ?? "").trim().replace(/^https?:\/\/(www\.)?orcid\.org\//i, "").toUpperCase();
  if (!/^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/.test(s)) return "";
  const digits = s.replace(/-/g, "");
  let total = 0;
  for (const c of digits.slice(0, 15)) total = (total + Number(c)) * 2;
  const check = (12 - (total % 11)) % 11;
  return (check === 10 ? "X" : String(check)) === digits[15] ? s : "";
}
type OrcidValue = { value?: string } | null | undefined;
type OrcidWork = {
  title?: { title?: OrcidValue }; "journal-title"?: OrcidValue; "publication-date"?: { year?: OrcidValue } | null; url?: OrcidValue;
  "external-ids"?: { "external-id"?: { "external-id-type"?: string; "external-id-value"?: string }[] } | null;
  contributors?: { contributor?: { "credit-name"?: OrcidValue }[] } | null; citation?: { "citation-type"?: string; "citation-value"?: string } | null;
};
// The put-codes of the works in the public record (to fetch them in bulk, 100 at a time).
export function orcidPutCodes(json: unknown): number[] {
  const groups = (json as { group?: { "work-summary"?: { "put-code"?: number }[] }[] })?.group ?? [];
  return groups.map((g) => g["work-summary"]?.[0]?.["put-code"]).filter((n): n is number => typeof n === "number");
}
export function fromOrcidBulk(json: unknown): Publication[] {
  const bulk = (json as { bulk?: { work?: OrcidWork }[] })?.bulk ?? [];
  return bulk.map((b) => b.work).filter((w): w is OrcidWork => !!w).map((w) => {
    const doi = cleanDoi(w["external-ids"]?.["external-id"]?.find((e) => e["external-id-type"] === "doi")?.["external-id-value"]);
    // Authors and venue: from the work, or else from its BibTeX citation when it has one.
    const cite = w.citation?.["citation-type"] === "bibtex" && w.citation["citation-value"] ? fromBibtex(w.citation["citation-value"])[0] : undefined;
    const names = (w.contributors?.contributor ?? []).map((c) => c["credit-name"]?.value ?? "").filter(Boolean);
    return pub({
      title: w.title?.title?.value ?? cite?.title ?? "", authors: names.length ? names.join(", ") : cite?.authors ?? "",
      venue: w["journal-title"]?.value ?? cite?.venue ?? "", year: w["publication-date"]?.year?.value ?? cite?.year ?? "",
      url: doiUrl(doi) || w.url?.value || cite?.url || "",
    });
  }).filter((p) => p.title);
}

// ---- Merging ----
const titleKey = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "");
const doiOf = (u: string) => cleanDoi(u).toLowerCase();
// Adds the new ones (not already there by DOI or title) after the member's own, up to the section's limit; the member's edits stay.
export function mergePublications(existing: Publication[], incoming: Publication[], limit: number): { items: Publication[]; added: number; skipped: number } {
  const seen = new Set<string>();
  for (const p of existing) { seen.add(`t:${titleKey(p.title)}`); const d = doiOf(p.url); if (d) seen.add(`d:${d}`); }
  const items = [...existing];
  let added = 0, skipped = 0;
  for (const p of incoming) {
    const d = doiOf(p.url), t = `t:${titleKey(p.title)}`;
    if ((d && seen.has(`d:${d}`)) || seen.has(t) || !titleKey(p.title)) { skipped++; continue; }
    if (items.length >= limit) { skipped++; continue; }
    items.push(p); added++;
    seen.add(t); if (d) seen.add(`d:${d}`);
  }
  return { items, added, skipped };
}
