import { NETWORK_NAME, TRACK, TRACKS } from "@/lib/partner-network";

// The /partners cover: the #NotesApp hub with the seven partner tracks around it, joined by lines that light up in turn, and members
// (the small dots) travelling along them to the hub. Drawn in SVG (nothing to download); still for people who prefer less motion.
export default function PartnersHero({ registered }: { registered: number }) {
  const R = 150, cx = 230, cy = 210;
  const nodes = TRACKS.map((t, i) => {
    const a = (-90 + (360 / TRACKS.length) * i) * (Math.PI / 180);
    return { t, x: cx + R * Math.cos(a), y: cy + R * Math.sin(a), i };
  });
  return (
    <section className="relative overflow-hidden bg-crimson-deep text-paper"
      style={{ backgroundImage: "radial-gradient(48rem 28rem at 85% 15%, rgba(244,184,96,0.22), transparent 62%), radial-gradient(56rem 32rem at 5% 110%, rgba(166,9,61,0.7), transparent 70%), linear-gradient(140deg, #2A000D 0%, #4E0119 45%, #7A0328 100%)" }}>
      <style>{`
        @keyframes ph-pulse { 0%,100% { opacity: .35 } 50% { opacity: 1 } }
        @keyframes ph-rise { from { opacity: 0; transform: translateY(6px) } to { opacity: 1; transform: none } }
        @keyframes ph-spin { to { transform: rotate(360deg) } }
        .ph-line { animation: ph-pulse 3.5s ease-in-out infinite; }
        .ph-up { opacity: 0; animation: ph-rise .7s ease-out .15s forwards; }
        .ph-ring { transform-origin: ${cx}px ${cy}px; animation: ph-spin 60s linear infinite; }
        @media (prefers-reduced-motion: reduce) { .ph-line, .ph-ring { animation: none; opacity: .8 } .ph-up { animation: none; opacity: 1 } .ph-dot { display: none } }
      `}</style>
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{ backgroundImage: "radial-gradient(#fff 1px, transparent 1px)", backgroundSize: "22px 22px" }} />
      <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[1.05fr,1fr] lg:px-8">
        <div className="ph-up">
          <span className="inline-flex items-center gap-2 rounded-full border border-paper/20 bg-paper/10 px-3 py-1 font-mono text-[11px] uppercase tracking-eyebrow text-paper/80">
            <span className="h-1.5 w-1.5 rounded-full bg-[#F4B860]" aria-hidden="true" />{NETWORK_NAME}
          </span>
          <h1 className="mt-5 font-display text-[2.6rem] leading-[1.02] text-paper sm:text-6xl">Grow with #NotesApp.</h1>
          <p className="mt-6 max-w-xl text-lg text-paper/85">
            Agencies and experts, associations, workplaces, technology companies, banks and hubs, media and music, campus and community
            chapters: bring #NotesApp to the people you serve, and grow with them.
          </p>
          <p className="mt-3 max-w-xl text-sm text-paper/70">Seven tracks, three tiers, a share of what the members you bring pay for their plans, and a portal to run it all. Members&apos; privacy always comes first.</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <a href="#apply" className="rounded-full bg-[#F4B860] px-6 py-3 font-ui text-sm font-bold text-crimson-deep shadow-lg shadow-black/20 hover:bg-[#f7c77e]">Become a partner</a>
            <a href="/partners/directory" className="rounded-full border border-paper/30 px-6 py-3 font-ui text-sm font-semibold text-paper hover:bg-paper/10">Find a partner</a>
          </div>
          {registered > 0 && <p className="mt-6 text-xs font-semibold text-paper/70">{registered} partner{registered === 1 ? "" : "s"} in the directory today</p>}
        </div>

        <figure className="relative mx-auto w-full max-w-[480px]" aria-label="The #NotesApp hub, joined to the seven partner tracks">
          <svg viewBox="0 0 460 420" className="h-auto w-full drop-shadow-[0_30px_40px_rgba(0,0,0,0.35)]" role="img" aria-hidden="true">
            <defs>
              <radialGradient id="ph-hub" cx=".45" cy=".4" r=".7"><stop offset="0" stopColor="#F4B860" /><stop offset="1" stopColor="#C8102E" /></radialGradient>
            </defs>
            <g className="ph-ring" fill="none" stroke="#FBF6F2" strokeOpacity=".12">
              <circle cx={cx} cy={cy} r={R} strokeDasharray="3 9" />
              <circle cx={cx} cy={cy} r={R - 60} strokeDasharray="2 12" />
            </g>
            {nodes.map((n) => (
              <g key={n.t}>
                <line x1={cx} y1={cy} x2={n.x} y2={n.y} stroke="#F4B860" strokeWidth="2" strokeLinecap="round" className="ph-line" style={{ animationDelay: `${n.i * 0.5}s` }} />
                <circle r="3" fill="#FBF6F2" className="ph-dot">
                  <animateMotion dur={`${3 + (n.i % 3)}s`} repeatCount="indefinite" path={`M${n.x},${n.y} L${cx},${cy}`} begin={`${n.i * 0.4}s`} />
                </circle>
              </g>
            ))}
            {nodes.map((n) => (
              <g key={`n-${n.t}`} transform={`translate(${n.x} ${n.y})`}>
                <circle r="30" fill="#2A000D" stroke="#F4B860" strokeWidth="2" />
                <text textAnchor="middle" dy="7" fontSize="22">{TRACK[n.t].emoji}</text>
                <text textAnchor="middle" y="46" fontSize="11" fontWeight="700" fill="#FBF6F2" fontFamily="ui-sans-serif, system-ui">{TRACK[n.t].short}</text>
              </g>
            ))}
            <circle cx={cx} cy={cy} r="48" fill="url(#ph-hub)" stroke="#FBF6F2" strokeOpacity=".5" strokeWidth="2" />
            <text x={cx} y={cy + 7} textAnchor="middle" fontSize="20" fontWeight="800" fill="#2A000D" fontFamily="ui-sans-serif, system-ui">#NA</text>
          </svg>
        </figure>
      </div>
    </section>
  );
}
