// Links and @mentions in text people type: web addresses (https://…, www.…, or a bare name.com) become links, and @username
// becomes a link to that profile, /u/username. Used for messages, comments, moment captions and Notes Life chat (rendered by
// components/LinkedText.tsx as React elements, never HTML), and for journals through remarkLinkify (Markdown → HTML).
export type LinkToken =
  | { kind: "text"; text: string }
  | { kind: "url"; text: string; href: string }
  | { kind: "mention"; text: string; username: string };

// Usernames: 2 to 30 of a–z, 0–9, _ and - (as at sign-up).
export const USERNAME_CHARS = "a-z0-9_-";
const TLDS = "com|ng|org|net|io|co|app|dev|ai|me|info|biz|edu|gov|tv|xyz|africa|uk|us|ca|gh|ke|za|name|store|shop|online|site|tech|blog|page|link|live|news|so|ly|gg|to|fm";
const URL_TAIL = `[^\\s<>"'\`]*`;
const RE = new RegExp(
  [
    `(https?:\\/\\/[^\\s<>"'\`]+)`, // 1: a full address
    `(www\\.[a-z0-9-]+(?:\\.[a-z0-9-]+)+${URL_TAIL})`, // 2: www.…
    `((?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\\.)+(?:${TLDS})(?![a-z0-9-])(?::\\d{2,5})?(?:[/?#]${URL_TAIL})?)`, // 3: name.com/…
    `@([${USERNAME_CHARS}]{2,30})(?![${USERNAME_CHARS}])`, // 4: @username
  ].join("|"),
  "gi",
);

// Punctuation that ends a sentence isn't part of the address; nor is a closing bracket that has no opening one in it.
function trimTail(s: string): string {
  let out = s.replace(/[.,!?;:'"…]+$/u, "");
  for (const [open, close] of [["(", ")"], ["[", "]"]]) {
    while (out.endsWith(close) && out.split(open).length < out.split(close).length) out = out.slice(0, -1).replace(/[.,!?;:'"…]+$/u, "");
  }
  return out;
}

export function linkTokens(text: string): LinkToken[] {
  const out: LinkToken[] = [];
  let last = 0;
  const push = (t: string) => { if (!t) return; const prev = out[out.length - 1]; if (prev?.kind === "text") prev.text += t; else out.push({ kind: "text", text: t }); };
  for (const m of text.matchAll(RE)) {
    const at = m.index ?? 0, before = text[at - 1];
    // not inside a word, an email address (ada@gmail.com) or a path
    if (!m[1] && before && /[\w@./-]/.test(before)) continue;
    if (m[4]) {
      push(text.slice(last, at));
      out.push({ kind: "mention", text: m[0], username: m[4].toLowerCase() });
      last = at + m[0].length;
      continue;
    }
    const raw = trimTail(m[0]);
    if (!raw) continue;
    push(text.slice(last, at));
    out.push({ kind: "url", text: raw, href: /^https?:\/\//i.test(raw) ? raw : `https://${raw}` });
    last = at + raw.length;
  }
  push(text.slice(last));
  return out;
}

// The first web address in some text (the one a chat message shows a preview for).
export const firstUrl = (text: string) => linkTokens(text).find((t): t is Extract<LinkToken, { kind: "url" }> => t.kind === "url")?.href ?? null;

// The @word being typed just before the caret, if any (for the mention picker): "Thanks @ad|" → { start: 7, query: "ad" }.
export function mentionAt(value: string, caret: number): { start: number; query: string } | null {
  const m = new RegExp(`(^|[\\s(])@([${USERNAME_CHARS}]{0,30})$`, "i").exec(value.slice(0, caret));
  return m ? { start: caret - m[2].length - 1, query: m[2].toLowerCase() } : null;
}

// ---- journals: the same, in Markdown (a remark plugin) ----
type MdNode = { type: string; value?: string; url?: string; title?: string | null; children?: MdNode[] };
const SKIP = new Set(["link", "linkReference", "code", "inlineCode", "html", "definition", "image", "imageReference"]);

// base: where @mentions point (empty on NotesApp itself; the full site address on a journal's own domain).
export function remarkLinkify(opts: { base?: string } = {}) {
  const base = opts.base ?? "";
  const walk = (node: MdNode) => {
    if (!node.children || SKIP.has(node.type)) return;
    const next: MdNode[] = [];
    for (const child of node.children) {
      if (child.type !== "text" || !child.value) { walk(child); next.push(child); continue; }
      for (const t of linkTokens(child.value)) {
        if (t.kind === "text") next.push({ type: "text", value: t.text });
        else next.push({ type: "link", url: t.kind === "url" ? t.href : `${base}/u/${t.username}`, title: null, children: [{ type: "text", value: t.text }] });
      }
    }
    node.children = next;
  };
  return (tree: unknown) => { walk(tree as MdNode); };
}
