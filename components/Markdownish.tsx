import Link from "next/link";
import { safeHref } from "@/lib/kb";

// Renders the small formatting our help articles and Nana's replies use: paragraphs, "- " bullets, **bold** and [links](/path). Nothing
// else is interpreted and no HTML is ever inserted, so staff-written text and model output can't add markup or scripts. A link that
// doesn't point at one of our own pages is shown as plain text.
function inline(text: string, keyBase: string, linkClass: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const re = /\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g;
  let last = 0, i = 0, m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1] !== undefined) out.push(<strong key={`${keyBase}b${i++}`}>{m[1]}</strong>);
    else {
      const href = safeHref(m[3]);
      out.push(href ? <Link key={`${keyBase}l${i++}`} href={href} className={linkClass}>{m[2]}</Link> : m[2]);
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export default function Markdownish({ text, className = "", linkClass = "font-semibold text-crimson underline underline-offset-2" }: { text: string; className?: string; linkClass?: string }) {
  const blocks = text.replace(/\r\n/g, "\n").split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  return (
    <div className={className}>
      {blocks.map((b, bi) => {
        const lines = b.split("\n");
        if (lines.every((l) => /^- /.test(l.trim()))) {
          return <ul key={bi} className="mt-2 list-disc space-y-1 pl-5 first:mt-0">{lines.map((l, li) => <li key={li}>{inline(l.trim().slice(2), `${bi}-${li}`, linkClass)}</li>)}</ul>;
        }
        // A paragraph that starts with text and then lists bullets: keep the lead line, then the list.
        const bulletStart = lines.findIndex((l) => /^- /.test(l.trim()));
        if (bulletStart > 0) {
          const lead = lines.slice(0, bulletStart).join(" ");
          const items = lines.slice(bulletStart);
          return (
            <div key={bi} className="mt-2 first:mt-0">
              <p>{inline(lead, `${bi}p`, linkClass)}</p>
              <ul className="mt-1 list-disc space-y-1 pl-5">{items.map((l, li) => <li key={li}>{inline(l.replace(/^\s*- /, ""), `${bi}-${li}`, linkClass)}</li>)}</ul>
            </div>
          );
        }
        return <p key={bi} className="mt-2 first:mt-0">{inline(lines.join(" "), `${bi}p`, linkClass)}</p>;
      })}
    </div>
  );
}
