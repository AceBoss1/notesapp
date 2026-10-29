import { Fragment } from "react";
import { NOTESAPP_EMOJI, NOTESAPP_EMOJI_RE, isNotesAppEmoji } from "@/lib/messages-rules";
import { AFRICA_DRAWINGS } from "@/lib/africa-drawings";

// One emoji: ours (:na:, :academy:, :football:) as a small picture the size of the text around it; a pack emoji (:x-talking-drum:, :x-grin:)
// drawn in one colour, maroon crimson by Day and warm ivory by Night (`.na-emoji` in app/globals.css); any other as itself.
export function Emoji({ e, className = "" }: { e: string; className?: string }) {
  if (!isNotesAppEmoji(e)) return <span className={className}>{e}</span>;
  const x = NOTESAPP_EMOJI[e];
  const drawing = x.drawing ? AFRICA_DRAWINGS[x.drawing] : undefined;
  if (drawing) return <svg viewBox="0 0 100 100" role="img" aria-label={x.label} className={`na-emoji inline-block h-[1.2em] w-[1.2em] align-[-0.25em] ${className}`}><title>{x.label}</title><g fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: drawing }} /></svg>;
  if (x.flag) return <span role="img" aria-label={x.label} title={x.label} className={`na-emoji-flag ${className}`}>{x.glyph}</span>;
  if (x.glyph) return <span role="img" aria-label={x.label} title={x.label} className={`na-emoji na-emoji-glyph ${className}`}>{x.glyph}</span>;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={x.src} alt={x.label} title={x.label} draggable={false} className={`inline-block h-[1.2em] w-[1.2em] align-[-0.25em] ${className}`} />;
}

// Text with our emojis drawn in it.
export function EmojiText({ text }: { text: string }) {
  if (!text.includes(":")) return <>{text}</>;
  const out: React.ReactNode[] = [];
  let last = 0;
  for (const m of Array.from(text.matchAll(NOTESAPP_EMOJI_RE))) {
    if (m.index! > last) out.push(text.slice(last, m.index));
    out.push(<Emoji key={m.index} e={m[0]} />);
    last = m.index! + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return <>{out.map((x, k) => <Fragment key={k}>{x}</Fragment>)}</>;
}
