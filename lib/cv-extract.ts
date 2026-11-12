// Reading a CV in the browser, so only its text is sent to us (Nana Jobs, step 2). A PDF is read with pdfjs-dist, as components/PdfViewer.tsx
// and the books import already do. A Word file (.docx) is a zip: we find word/document.xml and unpack it with the browser's own
// DecompressionStream, so no new package is needed. Old .doc files aren't supported: save as .docx or PDF, or paste the text.

const u16 = (b: Uint8Array, i: number) => b[i] | (b[i + 1] << 8);
const u32 = (b: Uint8Array, i: number) => (b[i] | (b[i + 1] << 8) | (b[i + 2] << 16) | (b[i + 3] << 24)) >>> 0;

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

// One file out of a zip, by name, from the central directory (sizes there are right even when the local header defers them).
export async function unzipEntry(zip: Uint8Array, name: string): Promise<Uint8Array | null> {
  let eocd = -1;
  for (let i = zip.length - 22; i >= Math.max(0, zip.length - 65_557); i--) if (u32(zip, i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) return null;
  const count = u16(zip, eocd + 10);
  let p = u32(zip, eocd + 16);
  for (let n = 0; n < count && p + 46 <= zip.length; n++) {
    if (u32(zip, p) !== 0x02014b50) return null;
    const method = u16(zip, p + 10), size = u32(zip, p + 20), nameLen = u16(zip, p + 28), extra = u16(zip, p + 30), comment = u16(zip, p + 32), local = u32(zip, p + 42);
    const entry = new TextDecoder().decode(zip.subarray(p + 46, p + 46 + nameLen));
    if (entry === name) {
      const start = local + 30 + u16(zip, local + 26) + u16(zip, local + 28);
      const body = zip.subarray(start, start + size);
      if (method === 0) return body;
      if (method === 8) return inflateRaw(body);
      return null;
    }
    p += 46 + nameLen + extra + comment;
  }
  return null;
}

const decodeXml = (s: string) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d)).replace(/&amp;/g, "&");
// The text of a Word document: one line per paragraph, tabs and breaks kept as spaces and new lines.
export function docxXmlText(xml: string): string {
  return decodeXml(xml
    .replace(/<w:instrText[^>]*>[\s\S]*?<\/w:instrText>/g, "").replace(/<w:tab\/>/g, " ").replace(/<w:br[^>]*\/>/g, "\n").replace(/<\/w:p>/g, "\n")
    .replace(/<[^>]+>/g, ""))
    .split("\n").map((l) => l.replace(/[ \t]+/g, " ").trim()).filter((l, i, a) => l || (i > 0 && a[i - 1])).join("\n").trim();
}
export async function docxText(bytes: Uint8Array): Promise<string> {
  const xml = await unzipEntry(bytes, "word/document.xml");
  if (!xml) throw new Error("That Word file couldn't be read. Save it as .docx or PDF, or paste the text.");
  return docxXmlText(new TextDecoder().decode(xml));
}

export async function pdfText(bytes: Uint8Array): Promise<string> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/legacy/build/pdf.worker.min.js", import.meta.url).toString();
  const doc = await pdfjs.getDocument({ data: bytes }).promise;
  const out: string[] = [];
  for (let n = 1; n <= Math.min(doc.numPages, 12); n++) {
    const tc = await (await doc.getPage(n)).getTextContent();
    const rows = new Map<number, { x: number; s: string }[]>();
    for (const it of tc.items as { str?: string; transform?: number[] }[]) {
      if (!it.str?.trim() || !it.transform) continue;
      const y = Math.round(it.transform[5] / 3);
      rows.set(y, [...(rows.get(y) ?? []), { x: it.transform[4], s: it.str.trim() }]);
    }
    [...rows.entries()].sort((a, b) => b[0] - a[0]).forEach(([, parts]) => out.push(parts.sort((a, b) => a.x - b.x).map((p) => p.s).join(" ")));
    out.push("");
  }
  doc.destroy();
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

// A file the member picked → its text. PDF and .docx; a .txt is read as it is.
export async function cvFileText(f: File): Promise<string> {
  const name = f.name.toLowerCase();
  if (f.size > 8 * 1024 * 1024) throw new Error("That file is over 8 MB. Upload a smaller one, or paste the text.");
  const bytes = new Uint8Array(await f.arrayBuffer());
  if (name.endsWith(".pdf") || f.type === "application/pdf") {
    const t = await pdfText(bytes);
    if (t.length < 100) throw new Error("That PDF has no text we can read (it may be a scan). Paste the text instead.");
    return t;
  }
  if (name.endsWith(".docx")) return docxText(bytes);
  if (name.endsWith(".txt") || name.endsWith(".md")) return new TextDecoder().decode(bytes);
  throw new Error("Upload a PDF or a Word (.docx) file, or paste the text.");
}
