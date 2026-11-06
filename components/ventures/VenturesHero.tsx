import Link from "next/link";
import { CALL_NAME, VENTURES_NAME } from "@/lib/ventures";

// The /ventures cover: "Rewrite the Playbook". An open playbook whose old rules are struck through in red ink and rewritten, with lines
// rising from its pages to a dot map of the emerging markets (Africa, Latin America, the Middle East, South and Southeast Asia) that
// light up. Drawn in SVG (no image to download); the pen strokes draw themselves once, and stay still for people who prefer less motion.
export default function VenturesHero() {
  return (
    <section className="relative overflow-hidden bg-crimson-deep text-paper"
      style={{ backgroundImage: "radial-gradient(52rem 30rem at 88% 8%, rgba(244,184,96,0.22), transparent 62%), radial-gradient(60rem 34rem at 10% 110%, rgba(166,9,61,0.75), transparent 70%), linear-gradient(140deg, #2A000D 0%, #4E0119 45%, #7A0328 100%)" }}>
      <style>{`
        @keyframes vh-draw { to { stroke-dashoffset: 0; } }
        @keyframes vh-glow { 0%,100% { opacity: .55 } 50% { opacity: 1 } }
        @keyframes vh-rise { from { opacity: 0; transform: translateY(6px) } to { opacity: 1; transform: none } }
        .vh-strike, .vh-pen { stroke-dasharray: 260; stroke-dashoffset: 260; animation: vh-draw 1.1s ease-out forwards; }
        .vh-pen { stroke-dasharray: 420; stroke-dashoffset: 420; }
        .vh-d1 { animation-delay: .35s } .vh-d2 { animation-delay: .7s } .vh-d3 { animation-delay: 1.05s }
        .vh-d4 { animation-delay: 1.5s } .vh-d5 { animation-delay: 1.85s } .vh-d6 { animation-delay: 2.2s }
        .vh-hot { animation: vh-glow 2.8s ease-in-out infinite; }
        .vh-up { opacity: 0; animation: vh-rise .7s ease-out .2s forwards; }
        @media (prefers-reduced-motion: reduce) {
          .vh-strike, .vh-pen { animation: none; stroke-dashoffset: 0; }
          .vh-hot { animation: none; opacity: 1; } .vh-up { animation: none; opacity: 1; }
        }
      `}</style>
      {/* A faint grid, like the squared paper of a notebook */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{ backgroundImage: "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)", backgroundSize: "28px 28px" }} />
      <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[1.05fr,1fr] lg:px-8">
        <div className="vh-up">
          <span className="inline-flex items-center gap-2 rounded-full border border-paper/20 bg-paper/10 px-3 py-1 font-mono text-[11px] uppercase tracking-eyebrow text-paper/80">
            <span className="h-1.5 w-1.5 rounded-full bg-[#F4B860]" aria-hidden="true" />{VENTURES_NAME}
          </span>
          <h1 className="mt-5 font-display text-[2.6rem] leading-[1.02] text-paper sm:text-6xl">
            Rewrite the{" "}
            <span className="relative inline-block whitespace-nowrap">
              <span className="relative z-10">Playbook.</span>
              <svg aria-hidden="true" viewBox="0 0 300 24" preserveAspectRatio="none" className="absolute -bottom-2 left-0 h-4 w-full">
                <path className="vh-pen vh-d2" d="M4 16 C 60 6, 120 22, 180 12 S 270 8, 296 14" fill="none" stroke="#F4B860" strokeWidth="5" strokeLinecap="round" />
              </svg>
            </span>
          </h1>
          <p className="mt-6 max-w-xl text-lg text-paper/85">
            Got a feature, product or business you&apos;re sure the crowd would jump into? Pitch it. If it&apos;s picked, #NotesApp builds it
            with you: our engineers, our platform, our guidance, for equity and a board seat on terms that fit your project.
          </p>
          <p className="mt-3 max-w-xl text-sm text-paper/70">For ideas and ventures built for emerging markets. Every pitch is kept confidential.</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <a href="#apply" className="rounded-full bg-[#F4B860] px-6 py-3 font-ui text-sm font-bold text-crimson-deep shadow-lg shadow-black/20 hover:bg-[#f7c77e]">Pitch your idea</a>
            <a href="#how" className="rounded-full border border-paper/30 px-6 py-3 font-ui text-sm font-semibold text-paper hover:bg-paper/10">How it works</a>
          </div>
          <ul className="mt-8 flex flex-wrap gap-2 text-xs font-semibold text-paper/85">
            {["Emerging markets only", "Kept confidential", "Built with #NotesApp", "Perks for every participant"].map((x) => (
              <li key={x} className="rounded-full bg-black/20 px-3 py-1.5 ring-1 ring-inset ring-paper/15">{x}</li>
            ))}
          </ul>
        </div>

        <figure className="relative mx-auto w-full max-w-[540px]" aria-label={`${CALL_NAME}: the old rules crossed out and rewritten, with new ventures rising to emerging markets`}>
          <svg viewBox="0 -6 540 490" className="h-auto w-full drop-shadow-[0_30px_40px_rgba(0,0,0,0.35)]" role="img" aria-hidden="true">
            <defs>
              <linearGradient id="vh-page" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#FFFBF6" /><stop offset="1" stopColor="#F3E7DE" /></linearGradient>
              <linearGradient id="vh-arc" x1="0" x2="1"><stop offset="0" stopColor="#F4B860" stopOpacity=".1" /><stop offset="1" stopColor="#F4B860" /></linearGradient>
              <radialGradient id="vh-globe" cx=".45" cy=".4" r=".7"><stop offset="0" stopColor="#7A0328" /><stop offset="1" stopColor="#2A000D" /></radialGradient>
            </defs>

            {/* The world: a globe of dots, with the emerging markets lit */}
            <g transform="translate(330 120)">
              <circle r="104" fill="url(#vh-globe)" stroke="#F4B860" strokeOpacity=".35" />
              <ellipse rx="104" ry="36" fill="none" stroke="#FBF6F2" strokeOpacity=".12" />
              <ellipse rx="52" ry="104" fill="none" stroke="#FBF6F2" strokeOpacity=".1" />
              {DOTS.map(([x, y, hot], i) => (
                <circle key={i} cx={x} cy={y} r={hot ? 3.2 : 1.8} fill={hot ? "#F4B860" : "#FBF6F2"} fillOpacity={hot ? 1 : 0.28}
                  className={hot ? "vh-hot" : undefined} style={hot ? { animationDelay: `${(i % 7) * 0.35}s` } : undefined} />
              ))}
            </g>
            <g fontFamily="ui-sans-serif, system-ui" fontSize="10" fontWeight="700" fill="#F4B860" letterSpacing=".08em">
              <text x="262" y="196" textAnchor="end">LATAM</text>
              <text x="330" y="8" textAnchor="middle">AFRICA &amp; MENA</text>
              <text x="442" y="134">SOUTH &amp;</text><text x="442" y="148">SE ASIA</text>
            </g>

            {/* Lines rising from the playbook to the markets */}
            <g fill="none" stroke="url(#vh-arc)" strokeWidth="2.2" strokeLinecap="round" strokeDasharray="2 7">
              <path d="M180 290 C 200 200, 260 160, 300 118" /><path d="M230 300 C 280 240, 330 220, 372 168" /><path d="M150 300 C 160 210, 210 120, 286 86" />
            </g>

            {/* The open playbook */}
            <g transform="translate(18 236) rotate(-4)">
              <path d="M0 18 Q 120 -6 240 18 L 240 214 Q 120 190 0 214 Z" fill="#1A1210" opacity=".35" transform="translate(6 10)" />
              <path d="M0 14 Q 60 2 118 14 L 118 210 Q 60 198 0 210 Z" fill="url(#vh-page)" />
              <path d="M122 14 Q 180 2 240 14 L 240 210 Q 180 198 122 210 Z" fill="url(#vh-page)" />
              <path d="M118 14 L 122 14 L 122 210 L 118 210 Z" fill="#E7DAD3" />
              {/* left page: the old rules, struck through */}
              <g fontFamily="Georgia, serif" fontSize="11" fill="#5C534E">
                <text x="14" y="40" fontWeight="700" fill="#1A1210" fontSize="12">The old playbook</text>
                <text x="14" y="70">Build it alone</text><text x="14" y="98">Fund it with what&apos;s left</text>
                <text x="14" y="126">Wait to be noticed</text><text x="14" y="154">Raise from abroad</text>
              </g>
              <g stroke="#C8102E" strokeWidth="2.4" strokeLinecap="round" fill="none">
                <path className="vh-strike vh-d1" d="M12 66 L 96 64" /><path className="vh-strike vh-d2" d="M12 94 L 112 92" />
                <path className="vh-strike vh-d3" d="M12 122 L 106 120" /><path className="vh-strike vh-d4" d="M12 150 L 104 148" />
              </g>
              {/* right page: the new playbook, in the pen's handwriting */}
              <g fontFamily="'Segoe Script','Bradley Hand','Comic Sans MS',cursive" fontSize="11.5" fill="#7A0328">
                <text x="134" y="40" fontFamily="Georgia, serif" fontWeight="700" fill="#1A1210" fontSize="12">Rewritten</text>
                <text x="134" y="70" className="vh-up" style={{ animationDelay: "1.2s" }}>Pitch it to us</text>
                <text x="134" y="98" className="vh-up" style={{ animationDelay: "1.5s" }}>Build it together</text>
                <text x="134" y="126" className="vh-up" style={{ animationDelay: "1.8s" }}>Launch it big</text>
                <text x="134" y="154" className="vh-up" style={{ animationDelay: "2.1s" }}>Grow from home</text>
              </g>
              <path className="vh-pen vh-d5" d="M134 174 C 156 168, 180 180, 210 170" fill="none" stroke="#F4B860" strokeWidth="3" strokeLinecap="round" />
              {/* the pen */}
              <g transform="translate(232 196) rotate(38)">
                <rect x="-5" y="-60" width="10" height="62" rx="3" fill="#1A1210" />
                <rect x="-5" y="-60" width="10" height="12" rx="3" fill="#F4B860" />
                <path d="M-5 2 L 0 14 L 5 2 Z" fill="#C8102E" />
              </g>
            </g>
          </svg>
        </figure>
      </div>
    </section>
  );
}

// Dots of a small world map on the globe (x, y relative to its centre; lit = an emerging market), drawn by hand to read at a glance:
// Latin America lower left, Africa and the Middle East in the middle, South and Southeast Asia to the right.
const DOTS: [number, number, boolean][] = [
  // the Americas
  [-78, -48, false], [-70, -40, false], [-62, -50, false], [-66, -30, false], [-58, -22, false],
  [-60, -6, true], [-54, 4, true], [-48, 14, true], [-52, 24, true], [-44, 30, true], [-46, 42, true], [-40, 54, true], [-36, 64, true],
  // Europe
  [-8, -62, false], [2, -66, false], [10, -58, false], [-2, -52, false], [16, -64, false],
  // Africa and the Middle East
  [-10, -36, true], [0, -34, true], [10, -30, true], [24, -32, true], [32, -24, true],
  [-14, -22, true], [-4, -18, true], [6, -16, true], [16, -12, true], [-10, -6, true], [0, -2, true], [10, 2, true],
  [-4, 12, true], [6, 16, true], [2, 28, true], [10, 30, true], [6, 42, true],
  // South and Southeast Asia
  [42, -14, true], [50, -6, true], [46, 4, true], [58, -10, true], [66, -2, true], [62, 10, true], [72, 8, true], [78, 18, true], [70, 24, true],
  // North Asia and Australia
  [40, -50, false], [56, -44, false], [70, -36, false], [84, -26, false], [74, 50, false], [86, 44, false],
];
