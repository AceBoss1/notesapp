/* eslint-disable @next/next/no-img-element */
import type { MomentLink } from "@/lib/moments-rules";
import { creditLine } from "@/lib/share-targets";

// The card of something shared to Moments (and previewed in the compose sheet): cover, what it is, its title, and who made it.
// Opening it goes to the item itself; the click never reaches the moment viewer behind (which would skip to the next moment).
export default function ShareLinkCard({ link, compact = false, asLink = true }: { link: MomentLink; compact?: boolean; asLink?: boolean }) {
  const body = (
    <>
      {link.image && <img src={link.image} alt="" className={`w-full bg-paper object-cover ${compact ? "aspect-[2/1]" : "aspect-[16/9]"}`} />}
      <span className="block p-4">
        <span className="block font-mono text-[10px] uppercase tracking-eyebrow text-crimson">{link.label}</span>
        <span className={`mt-1 block font-display font-semibold leading-snug text-ink ${compact ? "text-lg" : "text-xl"}`}>{link.title}</span>
        <span className="mt-1.5 block text-xs text-slate">{creditLine(link)}{link.creatorUsername && link.creatorName ? ` · ${link.creatorName}` : ""}</span>
        {!compact && <span className="mt-3 inline-block rounded-full bg-crimson px-4 py-1.5 font-ui text-xs font-bold text-white">Open</span>}
      </span>
    </>
  );
  const cls = "block w-full overflow-hidden rounded-2xl border border-rule bg-card text-left shadow-lg";
  return asLink
    ? <a href={link.path} onClick={(e) => e.stopPropagation()} className={`${cls} max-w-sm`}>{body}</a>
    : <div className={cls}>{body}</div>;
}
