// Light formatting in messages, typed as plain text so it works everywhere and can't carry HTML:
//   **bold**   _italic_   __underline__   (they can be combined, e.g. **_both_**)
// Anything that doesn't pair up stays as typed. Rendered as React text (see FormattedText), never as HTML.
export type Span = { text: string; b?: boolean; i?: boolean; u?: boolean };

const alnum = (c: string | undefined) => !!c && /[A-Za-z0-9]/.test(c);

export function parseFormat(src: string, flags: Omit<Span, "text"> = {}): Span[] {
  const out: Span[] = [];
  let buf = "";
  const flush = () => { if (buf) { out.push({ text: buf, ...flags }); buf = ""; } };
  let p = 0;
  while (p < src.length) {
    const two = src.slice(p, p + 2);
    const marker = two === "**" || two === "__" ? two : src[p] === "_" && !alnum(src[p - 1]) ? "_" : "";
    if (marker) {
      const from = p + marker.length;
      const lineEnd = src.indexOf("\n", from);
      const limit = lineEnd === -1 ? src.length : lineEnd;
      let close = src.indexOf(marker, from);
      // An italic's closing underscore must end a word (so snake_case_names are left alone).
      while (marker === "_" && close !== -1 && close < limit && (src[close + 1] === "_" || alnum(src[close + 1]))) close = src.indexOf(marker, close + 1);
      const inner = close === -1 || close >= limit ? "" : src.slice(from, close);
      if (inner && inner.trim() === inner) {
        flush();
        out.push(...parseFormat(inner, { ...flags, ...(marker === "**" ? { b: true } : marker === "__" ? { u: true } : { i: true }) }));
        p = close + marker.length;
        continue;
      }
    }
    buf += src[p++];
  }
  flush();
  return out;
}

export const stripFormat = (src: string) => parseFormat(src).map((s) => s.text).join("");

// Wraps the selected text (or an empty pair, with the caret between) in a marker.
export function wrapSelection(value: string, start: number, end: number, marker: "**" | "_" | "__") {
  const picked = value.slice(start, end);
  const next = value.slice(0, start) + marker + picked + marker + value.slice(end);
  return { value: next, selStart: start + marker.length, selEnd: start + marker.length + picked.length };
}
