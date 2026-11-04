import type { GiftMotif } from "@/lib/gift-catalogue";

// The animated gifts' drawings (lib/gift-catalogue.ts): original #NotesApp designs, African-inspired, drawn in SVG and moved with CSS
// transforms and opacity only (cheap on a phone, a few kilobytes in all, no image files). `motion`: "loop" for the gift sheet and the
// bell, "once" for the full-screen play, "still" when the viewer prefers reduced motion. The styles are in GIFT_ART_CSS, added once.

const GOLD = "#E8B23A", GOLD_D = "#B9831A", RED = "#A6093D", RED_D = "#7A0328", GREEN = "#1F7A4D", INDIGO = "#2B3A8C", CLAY = "#C8562B", CREAM = "#FBF3E4", BROWN = "#6B3E1F", INK = "#2A1A12";

export const GIFT_ART_CSS = `
.ga{overflow:visible}
.ga *{transform-box:fill-box;transform-origin:center}
.ga-loop .ga-bob{animation:ga-bob 2.4s ease-in-out infinite}
.ga-loop .ga-spin{animation:ga-spin 9s linear infinite}
.ga-loop .ga-rise{animation:ga-rise 2.2s ease-in infinite}
.ga-loop .ga-rise.d1{animation-delay:.7s}.ga-loop .ga-rise.d2{animation-delay:1.4s}
.ga-loop .ga-pulse{animation:ga-pulse 1.6s ease-out infinite}
.ga-loop .ga-pulse.d1{animation-delay:.8s}
.ga-loop .ga-tw{animation:ga-tw 1.8s ease-in-out infinite}
.ga-loop .ga-tw.d1{animation-delay:.6s}.ga-loop .ga-tw.d2{animation-delay:1.2s}
.ga-loop .ga-sway{animation:ga-sway 2.6s ease-in-out infinite}
.ga-loop .ga-shine{animation:ga-shine 2.8s ease-in-out infinite}
.ga-loop .ga-open-l{animation:ga-open-l 2.4s ease-in-out infinite;transform-origin:right bottom}
.ga-loop .ga-open-r{animation:ga-open-r 2.4s ease-in-out infinite;transform-origin:left bottom}
.ga-loop .ga-sun{animation:ga-sun 3.2s ease-in-out infinite}
.ga-loop .ga-trot{animation:ga-trot .8s ease-in-out infinite}
.ga-loop .ga-grow{animation:ga-grow 3s ease-in-out infinite;transform-origin:center bottom}
.ga-once .ga-bob{animation:ga-bob 1.2s ease-in-out 3}
.ga-once .ga-spin{animation:ga-spin 4s linear 1}
.ga-once .ga-rise{animation:ga-rise 1.6s ease-in 3}
.ga-once .ga-rise.d1{animation-delay:.5s}.ga-once .ga-rise.d2{animation-delay:1s}
.ga-once .ga-pulse{animation:ga-pulse 1.1s ease-out 4}
.ga-once .ga-pulse.d1{animation-delay:.55s}
.ga-once .ga-tw{animation:ga-tw 1.2s ease-in-out 4}
.ga-once .ga-tw.d1{animation-delay:.4s}.ga-once .ga-tw.d2{animation-delay:.8s}
.ga-once .ga-sway{animation:ga-sway 1.3s ease-in-out 3}
.ga-once .ga-shine{animation:ga-shine 1.6s ease-in-out 3}
.ga-once .ga-open-l{animation:ga-open-l 1.4s ease-in-out 2 both;transform-origin:right bottom}
.ga-once .ga-open-r{animation:ga-open-r 1.4s ease-in-out 2 both;transform-origin:left bottom}
.ga-once .ga-sun{animation:ga-sun-once 2.6s ease-out 1 both}
.ga-once .ga-trot{animation:ga-trot .6s ease-in-out 6}
.ga-once .ga-grow{animation:ga-grow-once 1.6s ease-out 1 both;transform-origin:center bottom}
@keyframes ga-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-6%)}}
@keyframes ga-spin{to{transform:rotate(360deg)}}
@keyframes ga-rise{0%{transform:translateY(0) scale(.6);opacity:0}25%{opacity:1}100%{transform:translateY(-140%) scale(1.1);opacity:0}}
@keyframes ga-pulse{0%{transform:scale(.7);opacity:.9}100%{transform:scale(1.6);opacity:0}}
@keyframes ga-tw{0%,100%{transform:scale(.4) rotate(0);opacity:.2}50%{transform:scale(1.1) rotate(45deg);opacity:1}}
@keyframes ga-sway{0%,100%{transform:rotate(-8deg)}50%{transform:rotate(8deg)}}
@keyframes ga-shine{0%{transform:translateX(-120%) skewX(-20deg);opacity:0}30%{opacity:.85}60%,100%{transform:translateX(220%) skewX(-20deg);opacity:0}}
@keyframes ga-open-l{0%,15%,100%{transform:rotate(0)}45%,75%{transform:rotate(-16deg)}}
@keyframes ga-open-r{0%,15%,100%{transform:rotate(0)}45%,75%{transform:rotate(16deg)}}
@keyframes ga-sun{0%,100%{transform:translateY(10%)}50%{transform:translateY(-6%)}}
@keyframes ga-sun-once{0%{transform:translateY(55%)}100%{transform:translateY(-4%)}}
@keyframes ga-trot{0%,100%{transform:translateY(0) rotate(0)}50%{transform:translateY(-4%) rotate(-2deg)}}
@keyframes ga-grow{0%,100%{transform:scale(.94)}50%{transform:scale(1.04)}}
@keyframes ga-grow-once{0%{transform:scale(.2);opacity:0}100%{transform:scale(1);opacity:1}}
@media (prefers-reduced-motion:reduce){.ga *{animation:none!important}}
`;

const Sparkles = ({ c = GOLD }: { c?: string }) => (
  <g fill={c}>
    <path className="ga-tw" d="M14 22l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" />
    <path className="ga-tw d1" d="M104 18l1.6 4 4 1.6-4 1.6-1.6 4-1.6-4-4-1.6 4-1.6z" />
    <path className="ga-tw d2" d="M100 92l1.4 3.4 3.4 1.4-3.4 1.4-1.4 3.4-1.4-3.4-3.4-1.4 3.4-1.4z" />
  </g>
);

function Art({ id }: { id: GiftMotif }) {
  switch (id) {
    case "gardenegg":
      return (
        <>
          <ellipse cx="60" cy="102" rx="28" ry="5" fill="#E2D4B8" />
          <g className="ga-bob">
            <ellipse cx="60" cy="68" rx="26" ry="30" fill="#F1EEDC" stroke="#CFCBAE" strokeWidth="2" />
            <path d="M44 56c4-10 12-14 20-14" stroke="#fff" strokeWidth="4" fill="none" strokeLinecap="round" opacity=".8" />
            <ellipse cx="74" cy="80" rx="6" ry="9" fill="#E3E0C6" />
            <path d="M44 40c4-6 10-8 16-6 6-2 12 0 16 6-6 0-10 2-16 6-6-4-10-6-16-6z" fill={GREEN} />
            <path d="M60 34V22" stroke={GREEN} strokeWidth="4" strokeLinecap="round" />
          </g>
          <Sparkles />
        </>
      );
    case "kola":
      return (
        <>
          <ellipse cx="60" cy="96" rx="40" ry="9" fill={BROWN} />
          <ellipse cx="60" cy="92" rx="40" ry="9" fill={CLAY} />
          <g className="ga-open-l"><path d="M60 88c-18 0-26-12-24-26 2-12 12-20 24-20z" fill={RED} /><path d="M58 50c-8 3-13 10-13 18" stroke="#F5B7C6" strokeWidth="3" fill="none" strokeLinecap="round" /></g>
          <g className="ga-open-r"><path d="M60 88c18 0 26-12 24-26-2-12-12-20-24-20z" fill={CREAM} /><path d="M62 50c8 3 13 10 13 18" stroke="#E7D3AE" strokeWidth="3" fill="none" strokeLinecap="round" /></g>
          <Sparkles />
        </>
      );
    case "zobo":
      return (
        <>
          <g className="ga-bob">
            <path d="M52 14h16v14c0 4 12 10 12 24v46c0 6-4 10-10 10H50c-6 0-10-4-10-10V52c0-14 12-20 12-24z" fill="#F4E9F0" stroke="#D9C2D0" strokeWidth="2" />
            <path d="M42 56h36v42c0 4-3 7-7 7H49c-4 0-7-3-7-7z" fill={RED_D} />
            <path d="M42 56h36v6H42z" fill={RED} />
            <rect x="50" y="8" width="20" height="8" rx="2" fill={GREEN} />
            <rect x="44" y="68" width="32" height="18" rx="3" fill={CREAM} />
            <path d="M50 77h20" stroke={RED} strokeWidth="3" strokeLinecap="round" />
            <circle cx="56" cy="72" r="2" fill={GREEN} /><circle cx="64" cy="72" r="2" fill={GREEN} />
            <g clipPath="url(#ga-zobo-clip)"><rect className="ga-shine" x="40" y="10" width="10" height="100" fill="#fff" opacity=".5" /></g>
            <clipPath id="ga-zobo-clip"><path d="M52 14h16v14c0 4 12 10 12 24v46c0 6-4 10-10 10H50c-6 0-10-4-10-10V52c0-14 12-20 12-24z" /></clipPath>
          </g>
          <circle className="ga-rise" cx="52" cy="96" r="2.6" fill="#F5B7C6" />
          <circle className="ga-rise d1" cx="62" cy="98" r="2.2" fill="#F5B7C6" />
          <circle className="ga-rise d2" cx="68" cy="94" r="1.8" fill="#F5B7C6" />
        </>
      );
    case "jollof":
      return (
        <>
          <g fill="none" stroke="#CFC6BC" strokeWidth="4" strokeLinecap="round">
            <path className="ga-rise" d="M46 50c-6-6 6-10 0-18" />
            <path className="ga-rise d1" d="M60 46c-6-6 6-10 0-18" />
            <path className="ga-rise d2" d="M74 50c-6-6 6-10 0-18" />
          </g>
          <ellipse cx="60" cy="80" rx="50" ry="18" fill={CREAM} stroke="#D8CBB4" strokeWidth="2" />
          <ellipse cx="60" cy="78" rx="38" ry="12" fill="none" stroke={GOLD} strokeWidth="1.6" strokeDasharray="3 4" />
          <path d="M30 76c2-14 16-22 30-22s28 8 30 22c-10 6-50 6-60 0z" fill="#E2622A" />
          <g fill="#F5A04A"><circle cx="44" cy="70" r="2" /><circle cx="56" cy="64" r="2" /><circle cx="70" cy="68" r="2" /><circle cx="62" cy="74" r="2" /><circle cx="50" cy="76" r="1.8" /></g>
          <circle cx="52" cy="68" r="2.6" fill={GREEN} /><circle cx="76" cy="72" r="2.6" fill={GREEN} />
          <path d="M80 74c6-6 14-4 16 2-6 4-12 4-16-2z" fill="#C9852E" />
          <ellipse cx="38" cy="80" rx="7" ry="3.4" fill="#F2C14E" transform="rotate(-12 38 80)" />
        </>
      );
    case "drum":
      return (
        <>
          <g fill="none" stroke={GOLD}><circle className="ga-pulse" cx="60" cy="60" r="34" strokeWidth="3" /><circle className="ga-pulse d1" cx="60" cy="60" r="34" strokeWidth="3" /></g>
          <g className="ga-sway">
            <path d="M36 26h48c-8 12-12 22-12 34s4 22 12 34H36c8-12 12-22 12-34s-4-22-12-34z" fill={CLAY} />
            <ellipse cx="60" cy="26" rx="24" ry="6" fill={CREAM} stroke={BROWN} strokeWidth="2" />
            <ellipse cx="60" cy="94" rx="24" ry="6" fill={CREAM} stroke={BROWN} strokeWidth="2" />
            <g stroke={BROWN} strokeWidth="1.6">{[40, 48, 56, 64, 72, 80].map((x) => <path key={x} d={`M${x} 29 L${x < 60 ? x + 8 : x - 8} 91`} />)}</g>
            <path d="M49 60h22" stroke={GOLD} strokeWidth="5" strokeLinecap="round" />
          </g>
          <path d="M92 20q10 14 2 30" stroke={BROWN} strokeWidth="4" fill="none" strokeLinecap="round" />
        </>
      );
    case "adire":
      return (
        <>
          <rect x="56" y="72" width="8" height="36" rx="3" fill={BROWN} />
          <g className="ga-spin">
            <circle cx="60" cy="56" r="40" fill={INDIGO} />
            <g fill="none" stroke="#9FB0E8" strokeWidth="2.5"><circle cx="60" cy="56" r="30" strokeDasharray="5 5" /><circle cx="60" cy="56" r="18" /></g>
            <g fill="#C9D3F4">{Array.from({ length: 8 }, (_, i) => { const a = (i * Math.PI) / 4; return <circle key={i} cx={60 + 24 * Math.cos(a)} cy={56 + 24 * Math.sin(a)} r="3" />; })}</g>
            <path d="M60 46l4 10-4 10-4-10z" fill="#C9D3F4" />
          </g>
          <circle cx="60" cy="56" r="40" fill="none" stroke={GOLD} strokeWidth="3" />
          <Sparkles c="#C9D3F4" />
        </>
      );
    case "gele":
      return (
        <>
          <circle cx="60" cy="74" r="20" fill={BROWN} />
          <clipPath id="ga-gele-clip"><path d="M24 62c-4-22 14-40 36-40s40 18 36 40c-10-6-22-8-36-8s-26 2-36 8z" /></clipPath>
          <g className="ga-bob">
            <path d="M24 62c-4-22 14-40 36-40s40 18 36 40c-10-6-22-8-36-8s-26 2-36 8z" fill={GOLD} />
            <g fill="none" stroke={GOLD_D} strokeWidth="2.5"><path d="M32 50c10-14 46-14 56 0" /><path d="M38 38c8-8 36-8 44 0" /><path d="M60 22v32" /></g>
            <path d="M90 40c12-4 18 4 16 12-6-4-10-4-16 0z" fill={GOLD} stroke={GOLD_D} strokeWidth="2" />
            <g clipPath="url(#ga-gele-clip)"><rect className="ga-shine" x="30" y="10" width="16" height="70" fill="#FFF3C8" /></g>
          </g>
          <Sparkles />
        </>
      );
    case "kente":
      return (
        <>
          <g className="ga-bob">
            <path d="M22 88l6-48 18 18 14-26 14 26 18-18 6 48z" fill={GOLD} stroke={GOLD_D} strokeWidth="2" />
            <rect x="22" y="78" width="76" height="14" fill={GREEN} />
            {[0, 1, 2, 3, 4, 5].map((i) => <rect key={i} x={24 + i * 12.4} y="78" width="6" height="14" fill={i % 2 ? RED : GOLD} />)}
            <path d="M22 78h76" stroke={INK} strokeWidth="2" />
            <circle cx="28" cy="40" r="4" fill={RED} /><circle cx="60" cy="32" r="5" fill={GREEN} /><circle cx="92" cy="40" r="4" fill={RED} />
          </g>
          <Sparkles />
        </>
      );
    case "baobab":
      return (
        <>
          <g className="ga-grow">
            <path d="M48 104c4-18 4-36 2-48h20c-2 12-2 30 2 48z" fill={BROWN} />
            <path d="M50 60c-10-6-18-8-26-6M70 60c10-6 18-8 26-6M58 56V40" stroke={BROWN} strokeWidth="6" strokeLinecap="round" fill="none" />
            <g fill={GREEN}><ellipse cx="26" cy="48" rx="16" ry="9" /><ellipse cx="94" cy="48" rx="16" ry="9" /><ellipse cx="60" cy="32" rx="22" ry="12" /></g>
          </g>
          <g fill={GOLD}>
            <ellipse className="ga-rise" cx="36" cy="64" rx="3" ry="5" style={{ animationDirection: "reverse" }} />
            <ellipse className="ga-rise d1" cx="84" cy="64" rx="3" ry="5" style={{ animationDirection: "reverse" }} />
          </g>
          <ellipse cx="60" cy="106" rx="34" ry="5" fill="#E2D4B8" />
          <Sparkles />
        </>
      );
    case "champagne":
      return (
        <>
          <g className="ga-sway" style={{ transformOrigin: "60px 104px" }}>
            <path d="M54 8h12v24c0 6 10 10 10 22v46c0 4-3 6-6 6H50c-3 0-6-2-6-6V54c0-12 10-16 10-22z" fill="#1D4D3A" stroke={INK} strokeWidth="2" />
            <path d="M54 8h12v16H54z" fill={GOLD} />
            <path d="M44 62h32v26H44z" fill={CREAM} />
            <path d="M44 62h32v4H44zM44 84h32v4H44z" fill={GOLD} />
            <text x="60" y="80" textAnchor="middle" fontSize="13" fontWeight="700" fontFamily="Georgia, serif" fill={RED}>C</text>
            <clipPath id="ga-champ-clip"><path d="M54 8h12v24c0 6 10 10 10 22v46c0 4-3 6-6 6H50c-3 0-6-2-6-6V54c0-12 10-16 10-22z" /></clipPath>
            <g clipPath="url(#ga-champ-clip)"><rect className="ga-shine" x="44" y="0" width="8" height="110" fill="#fff" opacity=".45" /></g>
          </g>
          <g fill={GOLD}>
            <circle className="ga-rise" cx="56" cy="6" r="3" /><circle className="ga-rise d1" cx="64" cy="4" r="2.4" /><circle className="ga-rise d2" cx="60" cy="8" r="2" />
            <circle className="ga-rise d1" cx="50" cy="10" r="1.8" /><circle className="ga-rise d2" cx="70" cy="10" r="1.8" />
          </g>
          <Sparkles />
        </>
      );
    case "argungu":
      return (
        <>
          <path d="M4 70c12-6 22 6 34 0s22-6 34 0 24 6 44 0v46H4z" fill="#3D6EA8" />
          <path d="M4 82c12-6 22 6 34 0s22-6 34 0 24 6 44 0" stroke="#9CC3EA" strokeWidth="3" fill="none" />
          <g className="ga-bob">
            <path d="M30 62a30 22 0 0 1 60 0z" fill="none" stroke={BROWN} strokeWidth="3" />
            <path d="M34 62l26-20 26 20M46 62l14-20 14 20" stroke={BROWN} strokeWidth="1.4" fill="none" />
            <circle cx="60" cy="30" r="7" fill={BROWN} /><path d="M52 26c4-8 12-8 16 0z" fill={CREAM} />
            <path d="M54 38h12l4 20H50z" fill={INDIGO} />
          </g>
          <g className="ga-trot">
            <path d="M68 46c10-8 26-8 34 0-8 8-24 8-34 0z" fill={GOLD} stroke={GOLD_D} strokeWidth="2" />
            <path d="M100 46l10-8v16z" fill={GOLD} stroke={GOLD_D} strokeWidth="2" />
            <circle cx="76" cy="44" r="2.2" fill={INK} />
          </g>
          <g fill="#CFE3F6"><circle className="ga-rise" cx="34" cy="74" r="2.4" /><circle className="ga-rise d1" cx="84" cy="76" r="2" /><circle className="ga-rise d2" cx="62" cy="72" r="2.2" /></g>
          <Sparkles />
        </>
      );
    case "durbar":
      return (
        <>
          <g className="ga-trot">
            <path d="M28 66c0-12 10-18 24-18h22c8 0 12-6 16-14l8 2-2 12c-2 8-6 12-10 14v20H76V70H46v12h-8V70c-6 0-10-2-10-4z" fill="#F4ECE0" stroke={INK} strokeWidth="2" />
            <path d="M96 36c4-2 8 0 8 4l-6 2z" fill={INK} />
            <path d="M42 50h30v20H42z" fill={RED} /><path d="M42 50h30v6H42z" fill={GOLD} />
            <g fill={GREEN}>{[46, 54, 62, 70].map((x) => <path key={x} d={`M${x - 3} 70h6l-3 6z`} />)}</g>
            <path d="M54 50V30h10l2 6" fill={INDIGO} />
            <circle cx="60" cy="24" r="6" fill={BROWN} /><path d="M52 20c4-8 12-8 16 0z" fill="#fff" />
            <path d="M68 32l14-20" stroke={GOLD_D} strokeWidth="2.5" /><path className="ga-sway" d="M82 12l14 4-14 6z" fill={RED} />
          </g>
          <path d="M14 98h92" stroke="#E2D4B8" strokeWidth="4" strokeLinecap="round" />
          <Sparkles />
        </>
      );
    case "ijele":
      return (
        <>
          <g className="ga-trot">
            <path d="M18 104c2-24 8-40 20-48h44c12 8 18 24 20 48z" fill={RED} />
            {[0, 1, 2, 3, 4, 5, 6].map((i) => <path key={i} d={`M${22 + i * 12.6} 104l6-30 6 30z`} fill={i % 2 ? GOLD : GREEN} />)}
            <path d="M30 56h60l-6-10H36z" fill={GOLD} stroke={GOLD_D} strokeWidth="2" />
            <rect x="34" y="34" width="52" height="12" rx="3" fill={INDIGO} />
            {[0, 1, 2, 3, 4].map((i) => <circle key={i} cx={40 + i * 10} cy="40" r="3" fill={CREAM} />)}
            <path d="M42 34c0-12 8-20 18-20s18 8 18 20z" fill={CLAY} />
            <circle cx="52" cy="26" r="3" fill={INK} /><circle cx="68" cy="26" r="3" fill={INK} />
            <path d="M56 32h8" stroke={INK} strokeWidth="2" strokeLinecap="round" />
          </g>
          <g className="ga-sway" style={{ transformOrigin: "60px 14px" }}>
            <path d="M60 14V2" stroke={GOLD_D} strokeWidth="2" />
            <path d="M48 8l12-8 12 8" stroke={GOLD} strokeWidth="3" fill="none" />
          </g>
          <Sparkles />
        </>
      );
    case "sunrise":
      return (
        <>
          <g className="ga-spin" style={{ transformOrigin: "60px 62px" }}>
            {Array.from({ length: 12 }, (_, i) => <rect key={i} x="58" y="4" width="4" height="22" rx="2" fill={GOLD} opacity=".55" transform={`rotate(${i * 30} 60 62)`} />)}
          </g>
          <circle className="ga-sun" cx="60" cy="62" r="24" fill={GOLD} />
          <path d="M6 100l30-34 12 10 14-22 18 18 10-8 24 36z" fill={INDIGO} />
          <path d="M48 76l14-22 18 18-10-2-8 8-6-6z" fill="#fff" />
          <path d="M6 100h108" stroke={GREEN} strokeWidth="6" />
          <Sparkles />
        </>
      );
  }
}

export default function GiftArt({ id, size = 64, motion = "loop", title }: { id: GiftMotif; size?: number; motion?: "loop" | "once" | "still"; title?: string }) {
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} className={`ga ga-${motion}`} role={title ? "img" : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      <Art id={id} />
    </svg>
  );
}

// The style sheet, once per page.
export function GiftArtStyles() {
  return <style dangerouslySetInnerHTML={{ __html: GIFT_ART_CSS }} />;
}
