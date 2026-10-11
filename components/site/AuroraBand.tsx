import type { ReactNode } from "react";

// The deep crimson band at the top of a page in the Aurora site theme. With children it is a page heading; without, just the band
// that a profile card overlaps.
export default function AuroraBand({ eyebrow, children }: { eyebrow?: string; children?: ReactNode }) {
  return (
    <div className="relative overflow-hidden text-paper" style={{ backgroundImage: "radial-gradient(50rem 20rem at 85% -30%, rgba(166,9,61,0.7), transparent 70%), linear-gradient(135deg, #4E0119 0%, #7A0328 100%)" }}>
      <div className={`mx-auto max-w-5xl px-4 sm:px-6 ${children ? "pb-14 pt-10" : "h-32 sm:h-40"}`}>
        {eyebrow && <p className="font-mono text-[11px] uppercase tracking-eyebrow text-paper/70">{eyebrow}</p>}
        {children}
      </div>
    </div>
  );
}
