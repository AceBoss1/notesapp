"use client";

// A 9:16 tile on a creator's Media and in the studio (the approved mockups, media-creator-*.png): the picture or video poster, or the
// #NotesApp African pattern when there is none (owner, 3 Nov 2026), a label at the top left (Pinned, Album, Replay…), what kind it is at the
// top right, and a figure at the bottom left.

const path = {
  play: "M8 5.5v13l11-6.5z",
  eye: "M12 5C6.5 5 2.7 9.4 1.5 12c1.2 2.6 5 7 10.5 7s9.3-4.4 10.5-7C21.3 9.4 17.5 5 12 5zm0 11a4 4 0 110-8 4 4 0 010 8z",
  layers: "M12 3 2 8l10 5 10-5-10-5zm-8.4 9.3L12 16.5l8.4-4.2L22 13l-10 5-10-5z",
  image: "M5 4h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2zm0 2v9.6l3.6-3.6 3 3 4-4.5L19 14V6H5zm3.5 1.5a1.5 1.5 0 110 3 1.5 1.5 0 010-3z",
  pin: "M14 3l7 7-3 1-3 3 .5 4.5L14 20l-4-4-5 5-1-1 5-5-4-4 1.5-1.5L11 10l3-3z",
  head: "M12 4a8 8 0 00-8 8v5a2 2 0 002 2h2v-6H6v-1a6 6 0 0112 0v1h-2v6h2a2 2 0 002-2v-5a8 8 0 00-8-8z",
};
export function Icon({ name, className = "h-3.5 w-3.5" }: { name: keyof typeof path; className?: string }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="currentColor"><path d={path[name]} fillRule="evenodd" /></svg>;
}

export function Pattern({ className = "" }: { className?: string }) {
  return <div className={`na-pattern na-pattern-cover absolute inset-0 ${className}`} aria-hidden="true" />;
}

export type TileProps = {
  image?: string; alt: string; onClick?: () => void; square?: boolean;
  label?: { text: string; tone?: "pin" | "live" | "plain" }; kind?: "layers" | "image" | null;
  figure?: { icon: "play" | "eye" | "image" | "head"; text: string } | null; dim?: boolean; children?: React.ReactNode;
};

export default function MediaTile({ image, alt, onClick, square, label, kind, figure, dim, children }: TileProps) {
  return (
    <button type="button" onClick={onClick} aria-label={alt}
      className={`group relative block w-full overflow-hidden rounded-[14px] bg-[#1a0b10] text-left text-paper ${square ? "aspect-square" : "aspect-[9/16]"} focus:outline-none focus-visible:ring-2 focus-visible:ring-crimson`}>
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt="" loading="lazy" className={`absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03] ${dim ? "opacity-40 grayscale" : ""}`} />
      ) : <Pattern className={dim ? "opacity-40" : ""} />}
      <span className="absolute inset-0 bg-gradient-to-t from-[rgba(20,13,11,.65)] via-transparent to-transparent" aria-hidden="true" />
      {label && (
        <span className="absolute left-[7px] top-[7px] z-[2]">
          <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-ui text-[10.5px] font-extrabold ${label.tone === "live" ? "bg-crimson text-paper" : "bg-paper text-crimson"}`}>
            {label.tone === "pin" && <Icon name="pin" className="h-2.5 w-2.5" />}{label.tone === "live" && <span className="h-1.5 w-1.5 rounded-full bg-current" />}{label.text}
          </span>
        </span>
      )}
      {kind && <span className="absolute right-[7px] top-[7px] z-[2] inline-flex h-[22px] w-[22px] items-center justify-center rounded-[7px] bg-black/35 backdrop-blur"><Icon name={kind} className="h-3 w-3" /></span>}
      {figure && <span className="absolute bottom-[7px] left-2 z-[2] flex items-center gap-1 font-ui text-xs font-bold [text-shadow:0_1px_3px_rgba(0,0,0,.5)]"><Icon name={figure.icon} className="h-3 w-3" />{figure.text}</span>}
      {children}
    </button>
  );
}
