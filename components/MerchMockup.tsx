import type { MerchItem } from "@/lib/merch";

// Product picture with the chosen brand logo superimposed. Uses the real
// photo when `item.photo` is set, otherwise a drawn placeholder shape.
const STROKE = "#9a8f86";
const FILL = "#fdfbf8";

function Shape({ shape }: { shape: MerchItem["shape"] }) {
  const p = { fill: FILL, stroke: STROKE, strokeWidth: 2.5, strokeLinejoin: "round" as const };
  switch (shape) {
    case "tshirt":
      return <path {...p} d="M62 28 L90 18 Q100 34 110 18 L138 28 L178 62 L156 88 L140 76 L140 174 L60 174 L60 76 L44 88 L22 62 Z" />;
    case "cap":
      return (
        <>
          <path {...p} d="M38 122 Q38 52 100 52 Q162 52 162 122 Z" />
          <path {...p} d="M150 120 Q192 122 188 136 Q150 140 98 128 Z" />
          <circle cx="100" cy="54" r="4" fill={STROKE} />
        </>
      );
    case "mug":
      return (
        <>
          <path {...p} d="M52 54 H138 V142 Q138 156 124 156 H66 Q52 156 52 142 Z" />
          <path {...p} fill="none" d="M138 70 H158 Q176 70 176 92 Q176 114 158 114 H138" />
        </>
      );
    case "stanley":
      return (
        <>
          <path {...p} d="M70 44 H130 L124 168 Q100 178 76 168 Z" />
          <rect {...p} x="66" y="32" width="68" height="14" rx="6" />
          <path {...p} fill="none" d="M130 70 H152 Q166 70 166 92 Q166 116 146 116 H128" />
        </>
      );
    case "mousepad":
      return <rect {...p} x="22" y="56" width="156" height="96" rx="18" />;
    case "coffeecup":
      return (
        <>
          <path {...p} d="M56 58 H144 L132 168 H68 Z" />
          <rect {...p} x="50" y="44" width="100" height="16" rx="6" />
          <path d="M60 96 H140 L137 126 H63 Z" fill="#e7dccd" stroke={STROKE} strokeWidth={2} />
        </>
      );
    case "laptopbag":
      return (
        <>
          <path {...p} fill="none" d="M74 76 V60 Q74 42 100 42 Q126 42 126 60 V76" />
          <rect {...p} x="32" y="72" width="136" height="92" rx="14" />
        </>
      );
  }
}

export default function MerchMockup({ item, logoSrc, logoAlt }: { item: MerchItem; logoSrc: string; logoAlt: string }) {
  return (
    <div className="relative aspect-square w-full overflow-hidden bg-paper">
      {item.photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.photo} alt={item.name} className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <svg viewBox="0 0 200 200" className="absolute inset-0 h-full w-full" role="img" aria-label={item.name}>
          <ellipse cx="100" cy="184" rx="58" ry="6" fill="#00000012" />
          <Shape shape={item.shape} />
        </svg>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={logoSrc}
        alt={logoAlt}
        className="absolute object-contain mix-blend-multiply"
        style={{ left: `${item.print.left}%`, top: `${item.print.top}%`, width: `${item.print.size}%`, height: `${item.print.size}%` }}
      />
    </div>
  );
}
