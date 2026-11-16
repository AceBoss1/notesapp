// Draws the banner that comes with the International organisations kit (lib/site-kits.ts "intl"): the world as dots on deep blue, with a
// few arcs between continents. Our own drawing, made from the same public-domain land data as the Talks globe (lib/globe-land.ts): it is
// not, and must not be made to look like, the emblem of the United Nations or of any other body.
// Writes public/images/sites/world-map.svg. Run: npx -y tsx scripts/site-art.ts
import { mkdirSync, writeFileSync } from "node:fs";
import { landGrid } from "../lib/globe-land";

const W = 1600, H = 900;
const g = landGrid();
// From 84° N to 60° S (no Antarctica), across the whole width, with room above and below for the words that sit over it.
const NORTH = 84, SOUTH = -60, TOP = 150, BOTTOM = 750;
const x = (lng: number) => ((lng + 180) / 360) * W;
const y = (lat: number) => TOP + ((NORTH - lat) / (NORTH - SOUTH)) * (BOTTOM - TOP);

let dots = "";
for (let r = 0; r < g.rows; r++) {
  const lat = 90 - g.step / 2 - r * g.step;
  if (lat > NORTH || lat < SOUTH) continue;
  for (let c = 0; c < g.cols; c++) if (g.land(r, c)) dots += `M${x(-180 + g.step / 2 + c * g.step).toFixed(1)} ${y(lat).toFixed(1)}h0`;
}
// Arcs between cities on different continents: "bridging nations".
const CITIES: Record<string, [number, number]> = { london: [51.5, -0.1], stockholm: [59.3, 18.1], lagos: [6.5, 3.4], nairobi: [-1.3, 36.8], delhi: [28.6, 77.2], manila: [14.6, 121], sydney: [-33.9, 151.2], saoPaulo: [-23.5, -46.6], newYork: [40.7, -74], mexico: [19.4, -99.1], cairo: [30, 31.2], tokyo: [35.7, 139.7] };
const LINKS: [string, string][] = [["london", "newYork"], ["london", "lagos"], ["stockholm", "delhi"], ["lagos", "saoPaulo"], ["cairo", "nairobi"], ["delhi", "manila"], ["manila", "sydney"], ["newYork", "mexico"], ["delhi", "tokyo"], ["london", "cairo"]];
const arc = ([a, b]: [string, string]) => {
  const [x1, y1, x2, y2] = [x(CITIES[a][1]), y(CITIES[a][0]), x(CITIES[b][1]), y(CITIES[b][0])];
  const lift = Math.min(160, Math.hypot(x2 - x1, y2 - y1) * 0.28);
  return `M${x1.toFixed(1)} ${y1.toFixed(1)}Q${((x1 + x2) / 2).toFixed(1)} ${(Math.min(y1, y2) - lift).toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`;
};
const points = Object.values(CITIES).map(([lat, lng]) => `<circle cx="${x(lng).toFixed(1)}" cy="${y(lat).toFixed(1)}" r="5"/>`).join("");

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice">
<defs><linearGradient id="sea" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#061f42"/><stop offset=".6" stop-color="#0d3f7c"/><stop offset="1" stop-color="#1563b0"/></linearGradient>
<radialGradient id="glow" cx=".5" cy=".42" r=".6"><stop offset="0" stop-color="#fff" stop-opacity=".1"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>
<rect width="${W}" height="${H}" fill="url(#sea)"/><rect width="${W}" height="${H}" fill="url(#glow)"/>
<path d="${dots}" fill="none" stroke="#cfe3ff" stroke-opacity=".5" stroke-width="5.2" stroke-linecap="round"/>
<g fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="1.6" stroke-dasharray="2 7" stroke-linecap="round">${LINKS.map((l) => `<path d="${arc(l)}"/>`).join("")}</g>
<g fill="#fff" fill-opacity=".9">${points}</g>
</svg>
`;
mkdirSync("public/images/sites", { recursive: true });
writeFileSync("public/images/sites/world-map.svg", svg);
console.log(`wrote public/images/sites/world-map.svg (${Math.round(svg.length / 1024)} KB)`);
