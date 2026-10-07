import { parseFormat } from "@/lib/message-format";

// A message's text with **bold**, _italic_ and __underline__ shown (see lib/message-format.ts). Plain React text: no HTML.
export default function FormattedText({ text }: { text: string }) {
  return (
    <>
      {parseFormat(text).map((s, k) => {
        const cls = `${s.b ? "font-bold " : ""}${s.i ? "italic " : ""}${s.u ? "underline " : ""}`.trim();
        return cls ? <span key={k} className={cls}>{s.text}</span> : <span key={k}>{s.text}</span>;
      })}
    </>
  );
}
