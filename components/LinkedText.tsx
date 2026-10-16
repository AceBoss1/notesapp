import Link from "next/link";
import { linkTokens } from "@/lib/linkify";
import { parseFormat } from "@/lib/message-format";

// Text people typed, with web addresses as links (a new tab) and @username as a link to the profile (lib/linkify.ts).
// format: also show **bold**, _italic_ and __underline__ (messages). base: where profiles live when this isn't on NotesApp itself
// (Notes Life, a journal's own domain). React text only: never HTML.
export default function LinkedText({ text, format = false, base = "", linkClass = "font-semibold text-crimson underline decoration-crimson/40 underline-offset-2 hover:decoration-crimson" }: { text: string; format?: boolean; base?: string; linkClass?: string }) {
  return (
    <>
      {linkTokens(text).map((t, k) => {
        if (t.kind === "mention") {
          const href = `${base}/u/${t.username}`;
          return base ? <a key={k} href={href} target="_blank" rel="noopener" className={linkClass}>{t.text}</a> : <Link key={k} href={href} className={linkClass}>{t.text}</Link>;
        }
        if (t.kind === "url") return <a key={k} href={t.href} target="_blank" rel="noopener noreferrer nofollow ugc" className={`${linkClass} break-all`}>{t.text}</a>;
        if (!format) return <span key={k}>{t.text}</span>;
        return parseFormat(t.text).map((s, j) => {
          const cls = `${s.b ? "font-bold " : ""}${s.i ? "italic " : ""}${s.u ? "underline " : ""}`.trim();
          return <span key={`${k}.${j}`} className={cls || undefined}>{s.text}</span>;
        });
      })}
    </>
  );
}
