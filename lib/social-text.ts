// The words that go with a post when it is shared: an excerpt and a link back to the full journal on #NotesApp. Pure functions, so the limits
// are testable. No AI here: it is the title and the opening of the post, trimmed to each network's limit.
export type PostSource = { title: string; excerpt: string; url: string };

// What a post body looks like as plain words: HTML tags, Markdown images and links, entities and runs of blanks removed.
export function plainText(content: string): string {
  return content
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<\/(p|div|h[1-6]|li|br)>|<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[#*_`>~]+/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

// Cuts at a word boundary and adds an ellipsis; returns the text unchanged if it already fits.
export function clipWords(text: string, max: number): string {
  if (max <= 0) return "";
  const t = text.trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, Math.max(0, max - 1));
  const at = cut.lastIndexOf(" ");
  return `${(at > max * 0.5 ? cut.slice(0, at) : cut).replace(/[\s,;:.\-–—]+$/, "")}…`;
}

// X counts every link as 23 characters, and some characters (emoji, many scripts) as 2.
export const X_LIMIT = 280;
export const X_LINK_LENGTH = 23;
const wide = (cp: number) => (cp >= 0x1100 && cp <= 0x11ff) || (cp >= 0x2e80 && cp <= 0xa4cf) || (cp >= 0xac00 && cp <= 0xd7a3) || (cp >= 0xf900 && cp <= 0xfaff) || (cp >= 0xfe30 && cp <= 0xfe6f) || (cp >= 0xff00 && cp <= 0xff60) || (cp >= 0x1f000 && cp <= 0x1faff) || (cp >= 0x20000 && cp <= 0x3fffd);
export function xWeight(text: string): number {
  let n = 0;
  for (const ch of text.replace(/https?:\/\/\S+/g, "x".repeat(X_LINK_LENGTH))) n += wide(ch.codePointAt(0)!) ? 2 : 1;
  return n;
}
// Clips by X weight rather than by length.
function clipX(text: string, max: number): string {
  if (max <= 0) return "";
  if (xWeight(text) <= max) return text.trim();
  const words = text.trim().split(" ");
  let out = "";
  for (const w of words) {
    const next = out ? `${out} ${w}` : w;
    if (xWeight(`${next}…`) > max) break;
    out = next;
  }
  if (!out) { const cps = Array.from(text); let o = ""; for (const c of cps) { if (xWeight(`${o}${c}…`) > max) break; o += c; } out = o; }
  return `${out.replace(/[\s,;:.\-–—]+$/, "")}…`;
}

// "Title", a short excerpt, and the link: within 280 on X however long the post is.
export function xText(s: PostSource): string {
  const link = s.url;
  const fixed = xWeight(`\n\n${link}`);
  const room = X_LIMIT - fixed;
  const title = clipX(s.title.trim(), room);
  const left = room - xWeight(title) - 2; // a blank line between title and excerpt
  const excerpt = left >= 20 ? clipX(s.excerpt.trim(), left) : "";
  return [title, excerpt].filter(Boolean).join("\n\n") + `\n\n${link}`;
}

// For X's share window (x.com/intent/tweet), which takes the words and the link separately and adds the link itself.
export function xIntentText(s: { title: string; excerpt: string }): string {
  const placeholder = "https://t.co/xxxxxxxxxx".padEnd(X_LINK_LENGTH, "x");
  return xText({ ...s, url: placeholder }).replace(new RegExp(`\\n\\n${placeholder}$`), "");
}

// LinkedIn: the title, the opening of the post and a line pointing at the link card the post carries. (3,000 characters is the limit.)
export const LINKEDIN_LIMIT = 3000;
export function linkedinText(s: PostSource): string {
  const body = [s.title.trim(), clipWords(s.excerpt, 600), "Read the full journal on #NotesApp:"].filter(Boolean).join("\n\n");
  return body.slice(0, LINKEDIN_LIMIT);
}

// LinkedIn's post text treats these characters as markup; a backslash in front shows them as typed.
export function escapeLinkedIn(text: string): string {
  return text.replace(/[\\|{}@[\]()<>#*_~]/g, (c) => `\\${c}`);
}
