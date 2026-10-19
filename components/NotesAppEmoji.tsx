import { Fragment } from "react";
import { NOTESAPP_EMOJI, NOTESAPP_EMOJI_RE, isNotesAppEmoji } from "@/lib/messages-rules";

// One emoji: ours (:na:, :academy:, :football:) as a small picture the size of the text around it, any other as itself.
export function Emoji({ e, className = "" }: { e: string; className?: string }) {
  if (!isNotesAppEmoji(e)) return <span className={className}>{e}</span>;
  const x = NOTESAPP_EMOJI[e];
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
