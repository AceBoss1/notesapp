// Notes Life: the 3D world (three.js, low-poly). One renderer and camera; show() swaps the scene: your room (built from what you own),
// the street (getting around), Chef Adams, itel Energy, and Candellux (front and pool). Residents (computer players) stand around each
// place, and real players who are at the same place right now (`others`) appear too. Tags (points of interest) are projected to the screen every
// frame so the page can draw tappable labels over them. Built from the approved mockups.
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RESIDENT, RESIDENTS_AT } from "@/lib/life/catalog";

// Power in your room: from NEPA (grid), none (a blackout), the Power GO, or a generator.
export type Power = "grid" | "out" | "go" | "gen" | "tank";
export type Mine = { kind: string; owner: string };
export type Other = { uid: string; outfit: string };
export type SceneSpec =
  | { id: "room"; owned: string[]; rug: string; outfit: string; night: boolean; ringing: boolean; at: RoomSpot; sleeping: boolean; power: Power }
  | { id: "itel"; outfit: string; night: boolean; others: Other[]; mine?: Mine[] }
  | { id: "street"; outfit: string; night: boolean; riding: string | null; others: Other[] }
  | { id: "chef"; outfit: string; night: boolean; others: Other[]; mine?: Mine[] }
  | { id: "hotel"; outfit: string; others: Other[] }
  | { id: "pool"; outfit: string };
export type RoomSpot = "rug" | "bed" | "desk" | "bath" | "wc" | "wardrobe" | "cooker" | "phone";
export type Tag = { key: string; x: number; y: number; visible: boolean };

const ROOM_SPOTS: Record<RoomSpot, [number, number, number]> = {
  rug: [2.45, 1.75, 0.2], bed: [-2.6, -1.2, -1.6], desk: [0.6, -3.0, Math.PI], bath: [3.9, -3.3, 0.3], wc: [2.95, -3.75, 0.2],
  wardrobe: [-3.6, 1.6, -1.6], cooker: [3.85, -1.05, Math.PI], phone: [-3.9, -0.4, -1.4],
};
const BR = { coral: "#FF8F83", red: "#E53935", char: "#292929", cream: "#FFF9F0", gold: "#F2B544" };
const CL = { navy: "#262b6b", gold: "#e3b23c" };
const IMG = (n: string) => `/images/life/${n}`;

export function createWorld(canvas: HTMLCanvasElement) {
  const r = new THREE.WebGLRenderer({ antialias: true, canvas, powerPreference: "high-performance" });
  r.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap; r.outputColorSpace = THREE.SRGBColorSpace;
  const cam = new THREE.PerspectiveCamera(36, 1, 0.1, 250);
  const controls = new OrbitControls(cam, canvas);
  controls.enablePan = false; controls.enableDamping = true; controls.dampingFactor = 0.12;
  controls.minPolarAngle = 0.35; controls.maxPolarAngle = 1.3;
  let scene = new THREE.Scene();
  let anchors: { key: string; v: THREE.Vector3 }[] = [];
  let player: THREE.Group | null = null;
  let tween: { from: THREE.Vector3; to: THREE.Vector3; rot: number; t0: number; ms: number } | null = null;
  let disposed = false;
  let listeners: ((tags: Tag[]) => void)[] = [];
  const texCache = new Map<string, Promise<HTMLImageElement | null>>();

  const mat = (c: string, o: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.82, ...o });
  function box(w: number, h: number, d: number, c: string, x: number, y: number, z: number, o?: THREE.MeshStandardMaterialParameters) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c, o)); m.position.set(x, y + h / 2, z); m.castShadow = m.receiveShadow = true; scene.add(m); return m; }
  function cyl(rt: number, h: number, c: string, x: number, y: number, z: number, rb = rt, seg = 20) { const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat(c)); m.position.set(x, y + h / 2, z); m.castShadow = m.receiveShadow = true; scene.add(m); return m; }
  function plane(w: number, h: number, tex: THREE.Texture, x: number, y: number, z: number, rx = 0, ry = 0, basic = false) { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), basic ? new THREE.MeshBasicMaterial({ map: tex }) : new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 })); m.position.set(x, y, z); m.rotation.set(rx, ry, 0); m.receiveShadow = true; scene.add(m); return m; }
  function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void) { const cv = document.createElement("canvas"); cv.width = w; cv.height = h; draw(cv.getContext("2d")!, w, h); const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }
  const loadImg = (src: string) => { if (!texCache.has(src)) texCache.set(src, new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ok(null); i.src = src; })); return texCache.get(src)!; };
  const fit = (g: CanvasRenderingContext2D, im: HTMLImageElement | null, x: number, y: number, w: number, h: number) => { if (!im) return; const k = Math.min(w / im.width, h / im.height); g.drawImage(im, x + (w - im.width * k) / 2, y + (h - im.height * k) / 2, im.width * k, im.height * k); };
  const tag = (key: string, x: number, y: number, z: number) => anchors.push({ key, v: new THREE.Vector3(x, y, z) });
  function lights(day = 1) {
    scene.add(new THREE.HemisphereLight("#ffffff", "#9a8a76", 1.15 * day));
    const sun = new THREE.DirectionalLight("#fff4e0", 1.5 * day); sun.position.set(7, 14, 8); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16 }); scene.add(sun);
  }
  function person(x: number, z: number, shirt: string, rot = 0, y = 0, skin = "#6b3f22", legs = "#1f2937", dress = false, hair = "#111") {
    const g = new THREE.Group();
    const add = (geo: THREE.BufferGeometry, c: string, px: number, py: number, pz: number) => { const m = new THREE.Mesh(geo, mat(c)); m.position.set(px, py, pz); m.castShadow = true; g.add(m); };
    if (dress) { add(new THREE.CylinderGeometry(0.22, 0.38, 0.85, 14), shirt, 0, 0.45, 0); add(new THREE.CylinderGeometry(0.06, 0.06, 0.1, 8), skin, -0.12, 0.03, 0); add(new THREE.CylinderGeometry(0.06, 0.06, 0.1, 8), skin, 0.12, 0.03, 0); }
    else { add(new THREE.CylinderGeometry(0.11, 0.1, 0.8, 10), legs, -0.13, 0.4, 0); add(new THREE.CylinderGeometry(0.11, 0.1, 0.8, 10), legs, 0.13, 0.4, 0); }
    add(new THREE.BoxGeometry(0.55, 0.7, 0.3), shirt, 0, 1.15, 0);
    add(new THREE.CylinderGeometry(0.07, 0.07, 0.6, 8), skin, -0.36, 1.12, 0); add(new THREE.CylinderGeometry(0.07, 0.07, 0.6, 8), skin, 0.36, 1.12, 0);
    add(new THREE.SphereGeometry(0.24, 20, 14), skin, 0, 1.75, 0); add(new THREE.SphereGeometry(0.245, 20, 14, 0, Math.PI * 2, 0, 1.2), hair, 0, 1.78, 0);
    if (dress) { const gele = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.09, 8, 16), mat(shirt === "#ffffff" ? "#e53935" : shirt)); gele.rotation.x = Math.PI / 2.4; gele.position.set(0, 1.98, -0.02); g.add(gele); }
    add(new THREE.BoxGeometry(0.2, 0.08, 0.32), "#f8fafc", -0.13, 0.04, 0.04); add(new THREE.BoxGeometry(0.2, 0.08, 0.32), "#f8fafc", 0.13, 0.04, 0.04);
    g.position.set(x, y, z); g.rotation.y = rot; scene.add(g); return g;
  }
  // A roadside billboard: two posts, a dark frame, the advert lit like a backlit board (a tag sits on it so it can be tapped).
  async function billboard(key: string, src: string, x: number, z: number, w: number, h: number, ry = 0, up = 2.2) {
    const im = await loadImg(src);
    const g = new THREE.Group(); g.position.set(x, 0.14, z); g.rotation.y = ry; scene.add(g);
    const part = (geo: THREE.BufferGeometry, m: THREE.Material, px: number, py: number, pz: number) => { const o = new THREE.Mesh(geo, m); o.position.set(px, py, pz); o.castShadow = true; g.add(o); };
    for (const dx of [-w * 0.3, w * 0.3]) part(new THREE.BoxGeometry(0.16, up, 0.16), mat("#374151"), dx, up / 2, -0.12);
    part(new THREE.BoxGeometry(w + 0.24, h + 0.24, 0.18), mat("#111827"), 0, up + h / 2, -0.12);
    if (im) { const tex = canvasTex(Math.round(im.width), Math.round(im.height), (c) => c.drawImage(im, 0, 0)); part(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex }), 0, up + h / 2, 0); }
    part(new THREE.BoxGeometry(w + 0.3, 0.08, 0.5), mat("#4b5563"), 0, up - 0.05, 0.1);
    const v = new THREE.Vector3(0, up + h + 0.35, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), ry); tag(key, x + v.x, v.y + 0.14, z + v.z);
  }
  const BB = { itelSun: "billboards/itel-sun-is-free.webp", itelTank: "billboards/itel-power-tank-fridge.webp", itelInverter: "billboards/itel-inverter-power-tank.webp", chef: "billboards/chef-adams-menu.webp" };
  const CHALLENGE = "/images/challenge/challenge-banner.webp";
  function chefMan(x: number, z: number, rot = 0) { const g = person(x, z, "#ffffff", rot); const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.16, 0.32, 16), mat("#ffffff")); hat.position.set(0, 2.12, 0); g.add(hat); return g; }
  // Residents (computer players): their look from the catalogue, a tag the page draws as their name with 🤖.
  function npc(id: string, x: number, z: number, rot = 0, y = 0) { const r = RESIDENT(id); if (!r) return; const [sh, sk, lg, dr] = r.look; person(x, z, sh, rot, y, sk, lg, dr); tag("npc:" + id, x, y + 2.35, z); }
  function residents(where: keyof typeof RESIDENTS_AT, spots: [number, number, number, number][]) { (RESIDENTS_AT[where] ?? []).forEach((id, i) => { const p = spots[i]; if (p) npc(id, p[0], p[1], p[2], p[3]); }); }
  // Real players here now: their outfit, a tag the page draws with their name.
  function others(list: Other[], spots: [number, number, number, number][]) { list.slice(0, spots.length).forEach((o, i) => { const [x, z, rot, y] = spots[i]; person(x, z, /^#[0-9a-f]{6}$/i.test(o.outfit) ? o.outfit : "#64748b", rot, y); tag("player:" + o.uid, x, y + 2.35, z); }); }
  function tree(x: number, z: number, s = 1) { cyl(0.12 * s, 1.2 * s, "#6d4c41", x, 0, z); const c = new THREE.Mesh(new THREE.SphereGeometry(0.75 * s, 14, 10), mat("#3f8f4f")); c.position.set(x, 1.7 * s, z); c.castShadow = true; scene.add(c); }
  function plant(x: number, z: number) { cyl(0.2, 0.35, "#b45309", x, 0, z, 0.15); const c = new THREE.Mesh(new THREE.IcosahedronGeometry(0.33, 0), mat("#2f855a")); c.position.set(x, 0.65, z); c.castShadow = true; scene.add(c); }
  function wheel(x: number, y: number, z: number, rad = 0.33) { const t = new THREE.Mesh(new THREE.TorusGeometry(rad, 0.045, 8, 24), mat("#111827")); t.position.set(x, y, z); t.castShadow = true; scene.add(t); }
  function rod(a: THREE.Vector3, b: THREE.Vector3, c = "#dc2626", t = 0.03) { const v = new THREE.Vector3().subVectors(b, a); const m = new THREE.Mesh(new THREE.CylinderGeometry(t, t, v.length(), 6), mat(c)); m.position.copy(a).add(b).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v.clone().normalize()); m.castShadow = true; scene.add(m); }
  function bicycle(x: number, z: number, frame = "#dc2626", battery = false) {
    const V = (a: number, b: number) => new THREE.Vector3(x + a, b, z);
    wheel(x - 0.55, 0.36, z); wheel(x + 0.55, 0.36, z);
    rod(V(-0.55, 0.36), V(0, 0.4), frame); rod(V(0, 0.4), V(0.45, 0.82), frame); rod(V(-0.55, 0.36), V(-0.15, 0.85), frame); rod(V(-0.15, 0.85), V(0.45, 0.82), frame); rod(V(0.55, 0.36), V(0.45, 0.82), frame); rod(V(0.45, 0.82), V(0.5, 1.05), "#111827");
    box(0.06, 0.03, 0.5, "#111827", x + 0.5, 1.04, z); box(0.24, 0.05, 0.12, "#111827", x - 0.15, 0.86, z);
    if (battery) box(0.34, 0.16, 0.12, "#16a34a", x - 0.05, 0.55, z);
  }
  function wheelsAt(pts: [number, number][], r0 = 0.3) { for (const [x, z] of pts) { const w = new THREE.Mesh(new THREE.CylinderGeometry(r0, r0, 0.18, 16), mat("#111827")); w.rotation.x = Math.PI / 2; w.position.set(x, r0, z); w.castShadow = true; scene.add(w); } }
  const sign = (txt: string, bg: string, fg: string, w: number, h: number, x: number, y: number, z: number, size = 90) => plane(w, h, canvasTex(1024, Math.round(1024 * h / w), (g, cw, ch) => { g.fillStyle = bg; g.fillRect(0, 0, cw, ch); g.fillStyle = fg; g.font = `bold ${size}px sans-serif`; g.textAlign = "center"; g.textBaseline = "middle"; txt.split("\n").forEach((l, i, a) => g.fillText(l, cw / 2, ch / 2 + (i - (a.length - 1) / 2) * size * 1.15)); }), x, y, z, 0, 0, true);

  // ---------- the room ----------
  async function notesRug() {
    const icon = await loadImg("/images/brand/icon-192.png");
    return canvasTex(1024, 732, (g, w, h) => {
      g.fillStyle = "#6d0124"; g.fillRect(0, 0, w, h);
      g.strokeStyle = "#f3d9a4"; g.lineWidth = 8; g.strokeRect(30, 30, w - 60, h - 60); g.strokeStyle = "#a3123f"; g.lineWidth = 26; g.strokeRect(60, 60, w - 120, h - 120); g.strokeStyle = "#f3d9a4"; g.lineWidth = 5; g.strokeRect(84, 84, w - 168, h - 168);
      const s = 240; if (icon) { g.save(); g.beginPath(); g.roundRect(w / 2 - s / 2, h / 2 - s / 2 - 30, s, s, 50); g.clip(); g.drawImage(icon, w / 2 - s / 2, h / 2 - s / 2 - 30, s, s); g.restore(); }
      g.fillStyle = "#f3d9a4"; g.font = "bold 62px sans-serif"; g.textAlign = "center"; g.fillText("NotesApp", w / 2, h / 2 + 170);
    });
  }
  const ankaraRug = () => canvasTex(1024, 732, (g, w, h) => {
    g.fillStyle = "#1e3a5f"; g.fillRect(0, 0, w, h); const cols = ["#f59e0b", "#0d9488", "#facc15", "#be123c", "#f97316"];
    for (let y = 0, row = 0; y < h + 100; y += 100, row++) for (let x = row % 2 ? 50 : 0; x < w + 100; x += 100) { g.fillStyle = cols[((x / 50 + row) | 0) % cols.length]; g.beginPath(); g.moveTo(x, y - 44); g.lineTo(x + 44, y); g.lineTo(x, y + 44); g.lineTo(x - 44, y); g.closePath(); g.fill(); g.fillStyle = "#1e3a5f"; g.beginPath(); g.arc(x, y, 20, 0, Math.PI * 2); g.fill(); }
    g.strokeStyle = "#facc15"; g.lineWidth = 20; g.strokeRect(22, 22, w - 44, h - 44);
  });
  const juteRug = () => canvasTex(1024, 732, (g, w, h) => { g.fillStyle = "#c8a46a"; g.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 14) { g.fillStyle = y % 28 ? "#b8925a" : "#d4b27a"; g.fillRect(0, y, w, 7); } g.strokeStyle = "#8a6a3a"; g.lineWidth = 24; g.strokeRect(20, 20, w - 40, h - 40); });

  async function room(s: Extract<SceneSpec, { id: "room" }>) {
    const has = (id: string) => s.owned.includes(id);
    const out = s.power !== "grid", backup = s.power === "go" || s.power === "gen" || s.power === "tank", dark = out && s.night; // by day the sun still shines
    scene.background = new THREE.Color(dark ? "#0b1020" : s.night ? "#1b2440" : "#cfe8f3");
    lights(dark ? 0.13 : s.night ? 0.35 : 1);
    for (let i = -5; i < 5; i += 0.5) { const t = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.1, 10), mat(Math.round(i * 2) % 2 ? "#e4cda6" : "#d8bf96")); t.position.set(i + 0.25, -0.05, 0); t.receiveShadow = true; scene.add(t); }
    box(10, 3, 0.2, "#a7c4a0", 0, 0, -5.1); box(0.2, 3, 10, "#97b690", -5.1, 0, 0); box(10, 0.18, 0.06, "#fafafa", 0, 0, -4.98); box(0.06, 0.18, 10, "#fafafa", -4.98, 0, 0);
    box(0.08, 2.15, 0.95, "#7c4a2a", -4.98, 0, 3.9);
    box(2.0, 1.35, 0.06, "#fafafa", 0.7, 1.15, -4.97);
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.15), new THREE.MeshStandardMaterial({ color: dark ? "#0b1222" : s.night ? "#1e2a4a" : "#9fd3f0", emissive: dark ? "#050a18" : s.night ? "#0b1530" : "#8fd0f5", emissiveIntensity: 0.55 })); glass.position.set(0.7, 1.825, -4.93); scene.add(glass);
    box(0.05, 1.15, 0.04, "#fafafa", 0.7, 1.25, -4.92); box(1.8, 0.05, 0.04, "#fafafa", 0.7, 1.8, -4.92); box(2.2, 0.06, 0.22, "#fafafa", 0.7, 1.12, -4.88);
    box(0.4, 1.9, 0.06, "#f1c27d", -0.55, 0.85, -4.9); box(0.4, 1.9, 0.06, "#f1c27d", 1.95, 0.85, -4.9); box(2.9, 0.06, 0.06, "#8d6e63", 0.7, 2.75, -4.9);
    const rugId = has(s.rug) ? s.rug : "rug_notesapp";
    const rugTex = rugId === "rug_ankara" ? ankaraRug() : rugId === "rug_jute" ? juteRug() : await notesRug();
    box(3.5, 0.02, 2.5, rugId === "rug_ankara" ? "#1e3a5f" : rugId === "rug_jute" ? "#b8925a" : "#6d0124", 0.2, 0, 0.6);
    plane(3.5, 2.5, rugTex, 0.2, 0.025, 0.6, -Math.PI / 2);
    box(0.12, 1.05, 1.75, "#7c4a2a", -4.94, 0, -2.2); box(2.15, 0.38, 1.65, "#8d5a3b", -3.95, 0, -2.2); box(2.05, 0.22, 1.55, "#f8fafc", -3.95, 0.38, -2.2);
    box(1.45, 0.08, 1.6, has("ac") ? "#0f766e" : "#2563eb", -3.6, 0.6, -2.2); box(0.42, 0.14, 1.2, "#ffffff", -4.6, 0.62, -2.2);
    for (const z of [-3.4, -1.0]) box(0.52, 0.55, 0.52, "#a0714f", -4.62, 0, z);
    cyl(0.11, 0.05, "#d6d3d1", -4.62, 0.55, -3.4); cyl(0.025, 0.42, "#a8a29e", -4.62, 0.6, -3.4);
    const lit = !out || backup;
    const shade = cyl(0.13, 0.26, has("lamp_led") ? "#fef9c3" : "#fde68a", -4.62, 1.0, -3.4, 0.22); shade.material.emissive = new THREE.Color("#fde68a"); shade.material.emissiveIntensity = !lit ? 0 : s.night ? 1 : 0.5;
    if (lit) { const lamp = new THREE.PointLight("#ffd27a", out ? 6 : s.night ? 4 : 1.2, out ? 8 : s.night ? 7 : 4); lamp.position.set(-4.5, 1.1, -3.3); scene.add(lamp); }
    if (s.night && !out) { const ceil = new THREE.PointLight("#fff1d6", 3, 14); ceil.position.set(0, 2.8, 0); scene.add(ceil); }
    if (dark) { const moon = new THREE.PointLight("#7aa2ff", 1.4, 6); moon.position.set(0.7, 2, -4.2); scene.add(moon); }
    if (has("power_go")) { // the Power GO Pro beside the desk; in a blackout its ring glows and it runs the lamp, the fan and the laptop
      const PX = 1.95, PZ = -3.75;
      box(0.42, 0.56, 0.26, "#f8fafc", PX, 0, PZ); box(0.4, 0.05, 0.22, "#1f2937", PX, 0.56, PZ);
      const h = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.025, 8, 20, Math.PI), mat("#c9a26b")); h.position.set(PX, 0.6, PZ); scene.add(h);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.012, 8, 16), new THREE.MeshBasicMaterial({ color: s.power === "go" ? "#a855f7" : "#64748b" })); ring.rotation.x = -Math.PI / 2; ring.position.set(PX + 0.12, 0.62, PZ); scene.add(ring);
      const dot = new THREE.Mesh(new THREE.CircleGeometry(0.05, 16), mat("#e11d48")); dot.position.set(PX, 0.25, PZ + 0.135); scene.add(dot);
      if (s.power === "go") { const glow = new THREE.PointLight("#c084fc", 1.2, 1.6); glow.position.set(PX, 0.8, PZ + 0.2); scene.add(glow); }
      if (has("solar_panel")) { const pn = box(0.9, 0.04, 0.6, "#1e3a8a", 0.7, 1.85, -5.0); pn.rotation.x = 0.5; } // on the window ledge outside
      rod(new THREE.Vector3(PX - 0.2, 0.15, PZ), new THREE.Vector3(1.0, 0.05, -4.2), "#111827", 0.012);
      tag("powergo", PX, 1.15, PZ);
    }
    if (dark && backup) { const scr = new THREE.PointLight("#9bd4ff", 1.6, 2.5); scr.position.set(0.7, 1.4, -4.0); scene.add(scr); }
    const gen = has("gen_big") ? "gen_big" : has("gen_small") ? "gen_small" : null;
    if (gen) { // the generator by the door: red and small, or yellow and big; it shakes a little light out when it runs
      const big = gen === "gen_big", GX = -2.5, GZ = 4.3;
      box(big ? 0.9 : 0.6, big ? 0.6 : 0.42, big ? 0.6 : 0.4, big ? "#eab308" : "#dc2626", GX, 0, GZ); box(big ? 0.94 : 0.64, 0.06, big ? 0.64 : 0.44, "#111827", GX, big ? 0.6 : 0.42, GZ);
      cyl(0.04, 0.12, "#6b7280", GX + 0.2, big ? 0.66 : 0.48, GZ - 0.1);
      if (s.power === "gen") { const g = new THREE.PointLight("#fde68a", 0.8, 1.5); g.position.set(GX, 0.8, GZ); scene.add(g); }
      tag("gen", GX, big ? 1.2 : 1.0, GZ);
    }
    box(0.34, 0.08, 0.24, "#111827", -4.62, 0.55, -1.0); box(0.3, 0.07, 0.09, s.ringing ? "#dc2626" : has("phone_smart") ? "#2563eb" : "#1f2937", -4.62, 0.63, -1.06);
    if (s.ringing) { const g = new THREE.PointLight("#ef4444", 2.5, 2.2); g.position.set(-4.4, 0.9, -1.0); scene.add(g); }
    box(0.7, 2.25, 1.55, "#9a6a46", -4.62, 0, 1.6); box(0.02, 2.0, 0.02, "#5d4037", -4.26, 0.12, 1.6); box(0.03, 0.2, 0.04, "#d4af37", -4.25, 1.05, 1.5); box(0.03, 0.2, 0.04, "#d4af37", -4.25, 1.05, 1.7); box(0.74, 0.08, 1.6, "#7c4a2a", -4.62, 2.25, 1.6);
    if (has("ac")) { box(0.3, 0.36, 1.25, "#f8fafc", -4.83, 2.25, -2.2); box(0.02, 0.05, 1.0, "#94a3b8", -4.67, 2.3, -2.2); plant(-2.4, -4.5); }
    else {
      cyl(0.22, 0.04, "#334155", -2.35, 0, -4.4); cyl(0.03, 1.15, "#64748b", -2.35, 0.04, -4.4);
      const head = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.12, 20), mat("#e2e8f0")); head.rotation.set(Math.PI / 2, 0, 0.5); head.position.set(-2.35, 1.38, -4.36); head.castShadow = true; scene.add(head);
    }
    box(1.75, 0.06, 0.8, "#b7865f", 0.7, 0.74, -4.45); for (const [a, b] of [[-0.1, -4.8], [1.5, -4.8], [-0.1, -4.1], [1.5, -4.1]]) box(0.06, 0.74, 0.06, "#7c4a2a", a, 0, b);
    if (has("pc_aio") || has("pc_laptop")) {
      if (has("pc_aio")) { box(0.9, 0.55, 0.04, "#111827", 0.5, 1.05, -4.6); const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.84, 0.46), new THREE.MeshStandardMaterial({ color: "#1e293b", emissive: "#38bdf8", emissiveIntensity: 0.55 })); scr.position.set(0.5, 1.32, -4.575); scene.add(scr); box(0.06, 0.25, 0.06, "#cbd5e1", 0.5, 0.8, -4.62); }
      if (has("pc_laptop")) { box(0.5, 0.02, 0.34, "#94a3b8", 1.25, 0.8, -4.3); const lid = box(0.5, 0.32, 0.02, "#94a3b8", 1.25, 0.81, -4.47); lid.rotation.x = -0.25; }
    } else {
      box(0.78, 0.62, 0.62, "#e7dcc3", 0.4, 0.8, -4.55);
      const crt = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.46), new THREE.MeshStandardMaterial({ color: "#1f3b2b", emissive: "#14532d", emissiveIntensity: 0.6 })); crt.position.set(0.4, 1.12, -4.235); scene.add(crt);
      box(0.26, 0.6, 0.62, "#e2d6bb", 1.2, 0.8, -4.55); box(0.62, 0.03, 0.2, "#d6ccb2", 0.45, 0.8, -4.1);
    }
    box(0.5, 0.06, 0.5, "#1f2937", 0.6, 0.45, -3.55); box(0.5, 0.55, 0.06, "#1f2937", 0.6, 0.5, -3.28); cyl(0.04, 0.45, "#6b7280", 0.6, 0, -3.55);
    box(0.12, 1.4, 2.8, "#e2e8f0", 2.4, 0, -3.6); box(1.75, 1.4, 0.12, "#e2e8f0", 4.13, 0, -2.2); box(0.12, 2.0, 0.12, "#cbd5e1", 3.3, 0, -2.2);
    for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) { const t = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.02, 0.54), mat((i + j) % 2 ? "#bfdbfe" : "#dbeafe")); t.position.set(2.7 + i * 0.5, 0.01, -4.75 + j * 0.54); scene.add(t); }
    box(2.54, 1.4, 0.04, "#dbeafe", 3.73, 0.15, -4.97);
    box(0.85, 0.55, 1.7, "#f8fafc", 4.5, 0, -4.05); const water = new THREE.Mesh(new THREE.PlaneGeometry(0.65, 1.5), mat("#7dd3fc", { roughness: 0.2 })); water.rotation.x = -Math.PI / 2; water.position.set(4.5, 0.56, -4.05); scene.add(water);
    cyl(0.2, 0.38, "#ffffff", 2.95, 0, -4.4, 0.16); box(0.42, 0.06, 0.48, "#f1f5f9", 2.95, 0.38, -4.35); box(0.42, 0.45, 0.18, "#ffffff", 2.95, 0.4, -4.78);
    if (has("cooker")) {
      box(1.15, 0.85, 0.55, "#f8fafc", 3.85, 0, -1.84); box(1.15, 0.04, 0.58, "#a0714f", 3.85, 0.85, -1.84); box(0.62, 0.02, 0.38, "#111827", 3.7, 0.89, -1.84);
      cyl(0.14, 0.18, "#cbd5e1", 3.55, 0.91, -1.84); tag("cooker", 3.85, 1.45, -1.84);
    }
    if (has("fridge") || has("microwave")) { // the kitchen corner: fridge, microwave on top (or on a small stand), by the cooker
      const FX = 4.55, FZ = -0.55;
      if (has("fridge")) {
        box(0.75, 1.75, 0.7, "#e5e7eb", FX, 0, FZ); box(0.02, 0.5, 0.04, "#94a3b8", FX - 0.39, 1.0, FZ - 0.2); box(0.02, 0.3, 0.04, "#94a3b8", FX - 0.39, 1.4, FZ - 0.2); box(0.77, 0.02, 0.72, "#cbd5e1", FX, 1.2, FZ);
        tag("fridge", FX, 2.4, FZ);
      } else { box(0.7, 0.8, 0.6, "#a0714f", FX, 0, FZ); tag("fridge", FX, 1.6, FZ); }
      if (has("microwave")) { const y = has("fridge") ? 1.75 : 0.8; box(0.6, 0.34, 0.45, "#1f2937", FX, y, FZ); const w = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.22), new THREE.MeshStandardMaterial({ color: "#0f172a", emissive: "#f59e0b", emissiveIntensity: out && !backup ? 0 : 0.25 })); w.position.set(FX - 0.31, y + 0.17, FZ - 0.05); w.rotation.y = -Math.PI / 2; scene.add(w); }
    }
    if (has("power_tank")) { // the itel Power Tank 1000: a white cube with a round blue screen, by the fridge
      const TX = 4.55, TZ = 0.45;
      box(0.62, 0.62, 0.5, "#f8fafc", TX, 0, TZ); box(0.64, 0.06, 0.52, "#111827", TX, 0.62, TZ);
      const scr = new THREE.Mesh(new THREE.CircleGeometry(0.1, 24), new THREE.MeshBasicMaterial({ color: s.power === "tank" ? "#38bdf8" : "#1e3a8a" })); scr.rotation.y = -Math.PI / 2; scr.position.set(TX - 0.32, 0.42, TZ); scene.add(scr);
      const lg = new THREE.Mesh(new THREE.CircleGeometry(0.035, 16), new THREE.MeshBasicMaterial({ color: "#e8173f" })); lg.rotation.y = -Math.PI / 2; lg.position.set(TX - 0.32, 0.18, TZ); scene.add(lg);
      if (s.power === "tank") { const glow = new THREE.PointLight("#7dd3fc", 1.2, 1.8); glow.position.set(TX - 0.5, 0.7, TZ); scene.add(glow); }
      for (const [k, x] of [["solar_650", -1.4], ["solar_650b", -2.9]] as const) if (has(k)) { const pn = box(1.3, 0.04, 0.8, "#1e3a8a", x, 2.95, -5.25); pn.rotation.x = 0.55; }
      tag("tank", TX, 1.25, TZ);
    }
    plant(-0.95, -4.55); plant(-3.9, 3.0);
    const [px, pz, pr] = s.sleeping ? [-3.8, -2.2, 0] : ROOM_SPOTS[s.at] ?? ROOM_SPOTS.rug;
    player = person(px, pz, s.outfit, pr);
    if (s.sleeping) { player.rotation.set(-Math.PI / 2, 0, Math.PI / 2); player.position.set(-3.1, 0.75, -2.2); }
    tag("bed", -3.8, 1.05, -2.2); tag("lamp", -4.62, 1.45, -3.4); tag("phone", -4.62, 0.95, -1.0); tag("wardrobe", -4.62, 2.5, 1.6);
    tag("bath", 4.3, 1.6, -3.9); tag("wc", 2.95, 1.25, -4.4); tag("desk", 0.7, 1.75, -4.3); tag("cool", has("ac") ? -4.75 : -2.35, has("ac") ? 2.75 : 1.85, has("ac") ? -2.2 : -4.4); tag("rug", 0.2, 0.05, 2.05); tag("door", -4.9, 2.4, 3.9);
    const phone = innerWidth < 700;
    cam.position.set(...(phone ? [12.5, 17, 14.5] : [9.5, 10.5, 10.5]) as [number, number, number]); controls.target.set(phone ? 0.2 : -0.1, phone ? 0 : 0.5, -0.6);
    controls.minDistance = 8; controls.maxDistance = 30;
  }

  // ---------- the street ----------
  async function street(s: Extract<SceneSpec, { id: "street" }>) {
    scene.background = new THREE.Color(s.night ? "#16203a" : "#bfe3f5"); lights(s.night ? 0.35 : 1);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), mat("#9ccc65")); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
    box(70, 0.02, 5, "#4b5563", 0, 0, 2.2); for (let i = -8; i < 9; i++) box(1.3, 0.03, 0.14, "#f9fafb", i * 4, 0.01, 2.2);
    box(70, 0.14, 2.6, "#d6d3d1", 0, 0, -1.6); box(70, 0.03, 0.9, "#16a34a", 0, 0.14, -0.55);
    box(3.4, 0.08, 1.3, "#0f766e", -7, 2.3, -2.2); for (const dx of [-1.6, 1.6]) box(0.08, 2.3, 0.08, "#334155", -7 + dx, 0.14, -2.7); box(2.6, 0.08, 0.45, "#a16207", -7, 0.6, -2.5);
    sign("WUSE\nBus stop", "#0f766e", "#ffffff", 1.4, 0.8, -7, 1.7, -2.84, 120);
    box(6.2, 1.8, 1.7, "#0f766e", -4.5, 0.3, 3.2); box(6.2, 0.55, 1.72, "#0b1324", -4.5, 1.2, 3.2); box(6.22, 0.12, 1.72, "#f8fafc", -4.5, 0.95, 3.2);
    sign("METRO · Garki", "#0f766e", "#ffffff", 3.2, 0.42, -5.0, 0.65, 4.06, 120); wheelsAt([[-6.6, 2.35], [-2.2, 2.35], [-6.6, 4.05], [-2.2, 4.05]], 0.34);
    box(1.5, 0.75, 1.0, "#facc15", 6.2, 0.35, 3.0); box(1.6, 0.06, 1.1, "#111827", 6.2, 1.55, 3.0); box(0.5, 0.45, 0.9, "#16a34a", 7.0, 0.35, 3.0); wheelsAt([[5.7, 2.45], [5.7, 3.55], [7.25, 3.0]], 0.24);
    const ride = s.riding;
    if (ride === "ebike") bicycle(1.6, -0.5, "#16a34a", true); else bicycle(1.6, -0.5);
    player = person(0.5, -0.9, s.outfit, 0.4, 0.14);
    box(0.35, 1.3, 0.3, "#16a34a", 11, 0.14, -2.2); box(2.4, 0.6, 1.2, "#e2e8f0", 11.8, 0.32, 0.3); box(1.4, 0.5, 1.1, "#0ea5e9", 11.7, 0.92, 0.3); wheelsAt([[11.0, -0.3], [12.6, -0.3], [11.0, 0.9], [12.6, 0.9]], 0.28);
    box(4, 3, 2, "#f1f5f9", 16.5, 0.14, -4.0); sign("Green Wheels\nE-bikes · EVs", "#065f46", "#ffffff", 3.6, 1.0, 16.5, 2.6, -2.98, 92);
    for (const x of [-12, -3, 6, 15]) { cyl(0.06, 4, "#475569", x, 0.14, -0.1); const p = box(0.8, 0.05, 0.5, "#1d4ed8", x, 4.15, -0.1); p.rotation.x = 0.35; }
    [-14, -9.5, -4, 4, 8.5, 20, -22, -17, 12, 25].forEach((x, i) => tree(x, i > 5 ? -7 : -4.4, i > 5 ? 1.4 : 1.1));
    await Promise.all([billboard("bb:challenge", CHALLENGE, -6.5, -8.2, 5.0, 2.81, 0, 1.4), billboard("bb:itel", IMG(BB.itelSun), 1.2, -8.6, 2.3, 2.88, 0, 1.4), billboard("bb:chef", IMG(BB.chef), 8.8, -8.2, 5.0, 2.8, 0, 1.4)]);
    const phone = innerWidth < 700;
    cam.position.set(...(phone ? [0, 8, 22] : [2, 12, 24]) as [number, number, number]); controls.target.set(phone ? 0 : 2, phone ? 1.2 : 0.5, -0.5);
    controls.minDistance = 10; controls.maxDistance = 45;
    residents("street", [[-8.2, -1.6, 0.3, 0.14], [3.8, -1.4, -0.4, 0.14], [-1.6, -2.0, 0.2, 0.14], [8.6, -1.3, -0.8, 0.14]]);
    others(s.others, [[-3.2, -1.5, 0.2, 0.14], [5.4, -2.0, -0.3, 0.14], [-10, -1.4, 0.4, 0.14]]);
    tag("bike", 1.2, 1.6, -0.6); tag("bus", -4.5, 2.6, 3.2); tag("keke", 6.2, 2.0, 3.0); tag("ev", 11.8, 1.9, 0.3); tag("shop", 16.5, 3.4, -3.0); tag("stop", -7, 2.9, -2.3);
  }

  // ---------- Chef Adams (partner) ----------
  async function chef(s: Extract<SceneSpec, { id: "chef" }>) {
    const [emblem, word, lockup] = await Promise.all([loadImg(IMG("partners/chef-emblem.webp")), loadImg(IMG("partners/chef-wordmark.webp")), loadImg(IMG("partners/chef-lockup.webp"))]);
    scene.background = new THREE.Color(s.night ? "#16203a" : "#bfe3f5"); lights(s.night ? 0.45 : 1);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), mat("#9ccc65")); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
    box(70, 0.02, 5, "#4b5563", 0, 0, 2.6); for (let i = -8; i < 9; i++) box(1.3, 0.03, 0.14, "#f9fafb", i * 4, 0.01, 2.6);
    box(70, 0.14, 3.6, "#d6d3d1", 0, 0, -1.9); box(70, 0.03, 0.9, "#16a34a", 0, 0.14, -0.4);
    const X = -2.2, Z = -6.0, FZ = -4.2;
    box(7.6, 3.8, 3.6, BR.char, X, 0.14, Z);
    plane(7.4, 1.25, canvasTex(1536, 260, (g, w, h) => { g.fillStyle = BR.char; g.fillRect(0, 0, w, h); fit(g, emblem, 30, 8, 250, 244); fit(g, word, 320, 22, w - 360, h - 44); }), X, 3.32, FZ + 0.01, 0, 0, true);
    box(8.0, 0.14, 1.3, BR.red, X, 2.55, FZ + 0.6); box(8.04, 0.07, 0.07, BR.gold, X, 2.55, FZ + 1.25);
    plane(6.2, 1.4, canvasTex(1400, 316, (g, w, h) => {
      g.fillStyle = "#3b2f2a"; g.fillRect(0, 0, w, h);
      [["JOLLOF RICE", "#e2582b"], ["FRIED RICE", "#d9a441"], ["NATIVE RICE", "#b5542a"], ["MOI MOI", "#e8a96b"]].forEach(([t, c], i) => { const x = 30 + i * 342; g.fillStyle = "#111"; g.fillRect(x, 20, 312, 196); g.fillStyle = "#f5f5f4"; g.beginPath(); g.ellipse(x + 156, 100, 100, 54, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = c; g.beginPath(); g.ellipse(x + 156, 96, 76, 38, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = BR.cream; g.font = "bold 32px sans-serif"; g.textAlign = "center"; g.fillText(t, x + 156, 196); });
      g.fillStyle = "#9ca3af"; g.fillRect(0, 234, w, 82);
    }), X, 1.95, FZ + 0.01, 0, 0, true);
    box(6.6, 1.05, 0.5, "#a0714f", X, 0.14, FZ + 0.45); box(6.8, 0.06, 0.62, "#3b2a20", X, 1.19, FZ + 0.45);
    plane(2.8, 0.8, canvasTex(1050, 300, (g, w, h) => { g.fillStyle = BR.char; g.fillRect(0, 0, w, h); fit(g, emblem, 14, 14, 250, 272); fit(g, word, 290, 46, w - 310, h - 92); }), X + 0.6, 0.68, FZ + 0.71, 0, 0, true);
    for (const dx of [-3.55, 3.55]) box(0.5, 3.8, 0.12, "#b7865f", X + dx, 0.14, FZ);
    plane(3.6, 3.8, canvasTex(600, 633, (g, w, h) => { g.fillStyle = BR.red; g.fillRect(0, 0, w, h); g.fillStyle = BR.char; g.fillRect(0, 0, 90, h); fit(g, emblem, 150, 60, 350, 350); }), X + 3.81, 2.04, Z, 0, Math.PI / 2);
    for (const sx of [X - 2.9, X - 2.1, X - 1.3]) { cyl(0.03, 0.75, "#1f2937", sx, 0.14, FZ + 1.05); cyl(0.2, 0.06, "#111827", sx, 0.89, FZ + 1.05); }
    for (const px of [X - 4.3, X + 4.3]) { cyl(0.32, 0.7, "#9ca3af", px, 0.14, FZ + 0.6, 0.25); const c = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 0), mat("#2f855a")); c.position.set(px, 1.35, FZ + 0.6); scene.add(c); }
    chefMan(X + 1.6, FZ - 0.35, 0);
    residents("chef", [[X - 2.1, FZ + 1.3, Math.PI, 0.14], [4.3 + 0.2, -1.0, Math.PI - 0.4, 0.14]]);
    others(s.others, [[X + 0.9, FZ + 1.4, Math.PI, 0.14], [X - 3.3, FZ + 1.5, Math.PI + 0.3, 0.14], [2.8, -0.9, Math.PI, 0.14]]);
    player = person(X - 0.4, FZ + 1.3, s.outfit, Math.PI, 0.14);
    const KX = 4.3, KZ = -2.6;
    box(2.3, 1.05, 1.4, BR.red, KX, 0.14, KZ); box(2.36, 0.08, 1.46, BR.cream, KX, 1.19, KZ);
    plane(1.7, 0.78, canvasTex(760, 350, (g, w, h) => { g.fillStyle = BR.cream; g.fillRect(0, 0, w, h); fit(g, emblem, 14, 14, 230, 322); g.fillStyle = BR.char; g.font = "bold 70px sans-serif"; g.fillText("TAKEAWAY", 260, 160); g.fillStyle = BR.red; g.font = "bold 44px sans-serif"; g.fillText("Jollof · Fried rice", 260, 236); }), KX, 0.68, KZ + 0.711, 0, 0, true);
    for (const [a, b] of [[-1.05, -0.6], [1.05, -0.6], [-1.05, 0.6], [1.05, 0.6]]) box(0.08, 1.4, 0.08, BR.char, KX + a, 1.27, KZ + b);
    box(2.6, 0.25, 1.75, BR.char, KX, 2.67, KZ); box(2.62, 0.05, 1.77, BR.gold, KX, 2.62, KZ);
    plane(2.0, 1.05, canvasTex(980, 514, (g, w, h) => { g.fillStyle = BR.char; g.fillRect(0, 0, w, h); fit(g, lockup, 20, 14, w - 40, h - 28); }), KX, 3.55, KZ + 0.4, 0, 0, true);
    chefMan(KX + 0.5, KZ - 0.2, 0.2);
    const RX = -3.6, RZ = 1.9; bicycle(RX, RZ, "#111827", true);
    const bag = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.6, 0.6), new THREE.MeshStandardMaterial({ map: canvasTex(400, 400, (g, w, h) => { g.fillStyle = BR.red; g.fillRect(0, 0, w, h); fit(g, lockup, 24, 24, w - 48, h - 48); }) })); bag.position.set(RX - 0.75, 1.35, RZ); bag.castShadow = true; scene.add(bag);
    person(RX - 0.1, RZ, BR.red, Math.PI / 2, 0.32);
    [-16, 13.5, 19].forEach((x) => tree(x, -5.5, 1.15));
    await billboard("bb:chef", IMG(BB.chef), -11.5, -7.2, 5.2, 2.92, 0.15);
    for (const m of s.mine ?? []) { // the player's own outlets, staffed by residents, with their name on the sign
      const owner = m.owner.toUpperCase().slice(0, 18);
      if (m.kind === "chef_kiosk") {
        const MX = 7.7, MZ = -2.4;
        box(2.3, 1.05, 1.4, BR.red, MX, 0.14, MZ); box(2.36, 0.08, 1.46, BR.cream, MX, 1.19, MZ);
        for (const [a, b] of [[-1.05, -0.6], [1.05, -0.6], [-1.05, 0.6], [1.05, 0.6]]) box(0.08, 1.4, 0.08, BR.char, MX + a, 1.27, MZ + b);
        box(2.6, 0.25, 1.75, BR.char, MX, 2.67, MZ); box(2.62, 0.05, 1.77, BR.gold, MX, 2.62, MZ);
        plane(2.2, 0.75, canvasTex(900, 300, (g, w, h) => { g.fillStyle = BR.char; g.fillRect(0, 0, w, h); fit(g, emblem, 10, 10, 280, 280); g.fillStyle = BR.gold; g.font = "bold 64px sans-serif"; g.fillText(`${owner}'S`, 300, 120, w - 310); g.fillStyle = "#ffffff"; g.font = "bold 70px sans-serif"; g.fillText("CHEF ADAMS", 300, 210, w - 310); }), MX, 3.35, MZ + 0.4, 0, 0, true);
        person(MX + 0.4, MZ - 0.2, BR.red, 0.1, 0.14); tag("mine:chef_kiosk", MX, 4.0, MZ + 0.4);
      }
      if (m.kind === "chef_shop") {
        const SX = 13.2, SZ = -6.0;
        box(5.2, 3.2, 3.2, BR.char, SX, 0.14, SZ); box(5.6, 0.14, 1.1, BR.red, SX, 2.4, SZ + 2.0); box(4.4, 1.7, 0.06, "#dbeafe", SX, 0.6, SZ + 1.62);
        plane(5.0, 0.95, canvasTex(1300, 250, (g, w, h) => { g.fillStyle = BR.char; g.fillRect(0, 0, w, h); fit(g, emblem, 10, 10, 230, 230); g.fillStyle = "#ffffff"; g.font = "bold 82px sans-serif"; g.fillText("CHEF ADAMS DINE-IN", 260, 120, w - 270); g.fillStyle = BR.gold; g.font = "bold 58px sans-serif"; g.fillText(`by ${owner}`, 260, 205, w - 270); }), SX, 2.85, SZ + 1.62, 0, 0, true);
        person(SX - 1.2, SZ + 2.3, "#ffffff", Math.PI, 0.14); tag("mine:chef_shop", SX, 4.0, SZ + 1.6);
      }
    }
    const phone = innerWidth < 700;
    cam.position.set(...(phone ? [0.3, 13.5, 28.5] : [-0.5, 7.5, 17.5]) as [number, number, number]); controls.target.set(phone ? 0.3 : -0.5, phone ? 1 : 1.7, phone ? -1.6 : -2.6);
    controls.minDistance = 8; controls.maxDistance = 40;
    tag("dinein", X, 4.25, FZ); tag("kiosk", KX, 4.35, KZ + 0.4); tag("rider", RX - 0.5, 2.25, RZ); tag("home", -10, 1.5, 1.0);
  }

  // ---------- itel Energy (partner): a solar shop on the Wuse street ----------
  async function itel(s: Extract<SceneSpec, { id: "itel" }>) {
    const [go, logoSvg] = await Promise.all([loadImg(IMG("partners/itel-powergo.webp")), loadImg(IMG("partners/itel-logo.svg"))]);
    const RED = "#e8173f";
    scene.background = new THREE.Color(s.night ? "#16203a" : "#bfe3f5"); lights(s.night ? 0.45 : 1);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), mat("#9ccc65")); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
    box(70, 0.02, 5, "#4b5563", 0, 0, 2.6); for (let i = -8; i < 9; i++) box(1.3, 0.03, 0.14, "#f9fafb", i * 4, 0.01, 2.6);
    box(70, 0.14, 3.6, "#d6d3d1", 0, 0, -1.9); box(70, 0.03, 0.9, "#16a34a", 0, 0.14, -0.4);
    const X = -1.5, Z = -6.2, FZ = -4.3;
    // an open shop front: back and side walls, roof, a light floor, so you see inside through the glass
    box(9, 3.6, 0.25, "#f4f4f5", X, 0.14, Z - 1.8); for (const dx of [-4.4, 4.4]) box(0.25, 3.6, 3.8, "#ececee", X + dx, 0.14, Z);
    box(9.2, 0.3, 4.0, "#e4e4e7", X, 3.74, Z); box(8.6, 0.04, 3.6, "#fafafa", X, 0.14, Z);
    box(8.6, 0.6, 0.06, "#e8173f", X, 2.9, Z - 1.66); // red band inside, like the booth
    const inner = new THREE.PointLight("#ffffff", 3, 9); inner.position.set(X, 3.2, Z); scene.add(inner);
    box(9.2, 0.9, 0.5, RED, X, 3.0, FZ + 0.1); // red fascia
    plane(4.2, 0.72, canvasTex(1300, 223, (g, w, h) => { g.fillStyle = RED; g.fillRect(0, 0, w, h); g.fillStyle = "#ffffff"; g.font = "bold 150px sans-serif"; g.textBaseline = "middle"; g.textAlign = "center"; g.beginPath(); g.ellipse(250, h / 2, 222, 104, -0.12, 0, Math.PI * 2); g.fill(); if (logoSvg) fit(g, logoSvg, 30, 6, 440, 211); else { g.fillStyle = RED; g.font = "italic bold 130px sans-serif"; g.fillText("itel", 250, h / 2 + 6); } g.fillStyle = "#ffffff"; g.font = "italic bold 150px sans-serif"; g.fillText("Energy", 820, h / 2 + 8); }), X, 3.45, FZ + 0.36, 0, 0, true);
    // glass front with products on display
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(7.6, 2.2), new THREE.MeshStandardMaterial({ color: "#dbeafe", transparent: true, opacity: 0.35, roughness: 0.05 })); glass.position.set(X, 1.35, FZ + 0.02); scene.add(glass);
    box(7.8, 0.12, 0.2, "#d4d4d8", X, 0.14, FZ + 0.05); box(7.8, 0.1, 0.2, "#d4d4d8", X, 2.46, FZ + 0.05);
    for (const dx of [-2.6, 2.6]) box(0.12, 2.4, 0.22, "#d4d4d8", X + dx, 0.14, FZ + 0.05);
    for (let i = 0; i < 3; i++) { // wall inverters (IP66 series) on the back wall
      const ix = X - 3.0 + i * 1.05; box(0.7, 0.95, 0.18, "#fafafa", ix, 1.25, Z - 1.6); const sc = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.2), new THREE.MeshBasicMaterial({ color: "#1f2937" })); sc.position.set(ix, 1.95, Z - 1.5); scene.add(sc);
      const lg = new THREE.Mesh(new THREE.CircleGeometry(0.06, 16), new THREE.MeshBasicMaterial({ color: RED })); lg.position.set(ix, 1.55, Z - 1.5); scene.add(lg);
      box(0.6, 0.7, 0.45, "#f5f5f5", ix, 0.14, Z - 1.3);
    }
    sign("IP66 SERIES", "#ffffff", "#9ca3af", 2.6, 0.3, X - 2.0, 2.45, Z - 1.66, 120);
    box(2.6, 0.75, 1.0, "#fafafa", X + 2.2, 0.14, FZ - 1.0); box(2.62, 0.08, 1.02, RED, X + 2.2, 0.82, FZ - 1.0); // display counter with Power GO units
    const goTex = canvasTex(256, 360, (g, w, h) => { g.fillStyle = "#ffffff"; g.fillRect(0, 0, w, h); fit(g, go, 0, 0, w, h); });
    for (const dx of [-0.8, 0, 0.8]) {
      const u = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.56, 0.26), [mat("#f8fafc"), mat("#f8fafc"), mat("#1f2937"), mat("#f8fafc"), new THREE.MeshStandardMaterial({ map: goTex }), mat("#f8fafc")]);
      u.position.set(X + 2.2 + dx, 0.9 + 0.28, FZ - 1.0); u.castShadow = true; scene.add(u);
      const hd = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.025, 8, 20, Math.PI), mat("#c9a26b")); hd.position.set(X + 2.2 + dx, 1.47, FZ - 1.0); scene.add(hd);
    }
    // outside: a small-home solar kit on a stand
    const panelTex = canvasTex(256, 384, (g, w, h) => { g.fillStyle = "#1e3a8a"; g.fillRect(0, 0, w, h); g.strokeStyle = "#93c5fd"; g.lineWidth = 3; for (let x = 0; x <= w; x += 42) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); } for (let y = 0; y <= h; y += 42) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); } });
    const SX = X + 5.6, SZ = -2.7;
    for (const dx of [-0.6, 0.6]) { const pnl = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.05, 1.6), [mat("#cbd5e1"), mat("#cbd5e1"), new THREE.MeshStandardMaterial({ map: panelTex, roughness: 0.3, metalness: 0.3 }), mat("#cbd5e1"), mat("#cbd5e1"), mat("#cbd5e1")]); pnl.position.set(SX + dx, 1.4, SZ); pnl.rotation.x = 0.6; pnl.castShadow = true; scene.add(pnl); }
    for (const dx of [-1.1, 1.1]) box(0.06, 1.2, 0.06, "#94a3b8", SX + dx, 0.14, SZ + 0.3);
    box(0.7, 0.9, 0.3, "#fafafa", SX, 0.14, SZ - 0.9); box(0.8, 0.5, 0.5, "#e5e7eb", SX + 1.0, 0.14, SZ - 0.9);
    sign("SMALL HOME\nSOLAR KIT", RED, "#ffffff", 1.6, 0.6, SX, 2.6, SZ - 0.2, 110);
    // the roof: panels that power the shop itself
    for (let i = 0; i < 5; i++) { const pnl = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.05, 1.0), [mat("#cbd5e1"), mat("#cbd5e1"), new THREE.MeshStandardMaterial({ map: panelTex, roughness: 0.3, metalness: 0.3 }), mat("#cbd5e1"), mat("#cbd5e1"), mat("#cbd5e1")]); pnl.position.set(X - 3.2 + i * 1.6, 3.95, Z - 0.5); pnl.rotation.x = -0.35; scene.add(pnl); }
    residents("itel", [[X + 0.6, FZ - 1.6, 0.2, 0.14], [X + 2.8, FZ + 0.9, Math.PI + 0.3, 0.14], [SX - 0.4, SZ + 1.2, Math.PI - 0.5, 0.14]]); // Mr Dauda (staff), Aisha, Chinedu
    others(s.others, [[X - 2.6, FZ + 1.3, Math.PI, 0.14], [X + 4.6, FZ + 1.6, Math.PI, 0.14]]);
    player = person(X - 1.2, FZ + 1.4, s.outfit, Math.PI, 0.14);
    [-16, 19].forEach((x) => tree(x, -5.5, 1.15));
    await Promise.all([billboard("bb:itel", IMG(BB.itelTank), -9.6, -6.6, 2.5, 3.12, 0.2), billboard("bb:itel2", IMG(BB.itelInverter), 13.6, -6.8, 2.5, 3.12, -0.2)]);
    const logo = logoSvg;
    for (const m of s.mine ?? []) {
      const owner = m.owner.toUpperCase().slice(0, 18), mall = m.kind === "itel_mall";
      if (m.kind !== "itel_home" && !mall) continue;
      const HX = mall ? -13.5 : 9.4, HZ = mall ? -2.4 : -2.0, W = mall ? 4.4 : 2.8;
      box(W, mall ? 3.0 : 2.3, 2.0, "#f4f4f5", HX, 0.14, HZ - 1.0); box(W + 0.2, 0.55, 0.3, RED, HX, mall ? 2.6 : 1.9, HZ + 0.05);
      box(W - 0.5, mall ? 1.6 : 1.3, 0.05, "#dbeafe", HX, 0.4, HZ + 0.02);
      plane(W, 0.5, canvasTex(1000, 125, (g, w, h) => { g.fillStyle = RED; g.fillRect(0, 0, w, h); fit(g, logo, 8, 6, 230, 113); g.fillStyle = "#ffffff"; g.font = "bold 50px sans-serif"; g.textBaseline = "middle"; g.fillText(`${mall ? "Mall Store" : "Home Store"} · ${owner}`, 250, h / 2, w - 260); }), HX, mall ? 2.88 : 2.18, HZ + 0.21, 0, 0, true);
      person(HX + 0.5, HZ + 0.6, RED, Math.PI, 0.14); tag(`mine:${m.kind}`, HX, mall ? 3.8 : 3.0, HZ);
    }
    const phone = innerWidth < 700;
    cam.position.set(...(phone ? [2.2, 7.5, 21] : [0.5, 7.5, 17.5]) as [number, number, number]); controls.target.set(phone ? 1.6 : 0.5, phone ? 1.6 : 1.7, phone ? -3.2 : -2.6);
    controls.minDistance = 8; controls.maxDistance = 40;
    tag("shop", X, 4.3, FZ); tag("go", X + 2.2, 1.95, FZ - 1.0); tag("kit", SX, 3.1, SZ - 0.2); tag("inverter", X - 2.0, 2.9, Z - 1.6);
  }

  // ---------- Candellux Imperial (partner) ----------
  function crown(g: CanvasRenderingContext2D, cx: number, cy: number, r0: number) {
    g.save(); g.translate(cx, cy); g.fillStyle = CL.gold;
    for (let i = -3; i <= 3; i++) { g.save(); g.rotate(i * 0.36); g.fillRect(-r0 * 0.07, -r0 * 1.55, r0 * 0.14, r0 * 0.45); g.restore(); }
    g.beginPath(); g.moveTo(-r0 * 0.75, r0 * 0.45); g.lineTo(-r0 * 0.85, -r0 * 0.45); g.lineTo(-r0 * 0.4, -r0 * 0.05); g.lineTo(0, -r0 * 0.6); g.lineTo(r0 * 0.4, -r0 * 0.05); g.lineTo(r0 * 0.85, -r0 * 0.45); g.lineTo(r0 * 0.75, r0 * 0.45); g.closePath(); g.fill(); g.fillRect(-r0 * 0.8, r0 * 0.55, r0 * 1.6, r0 * 0.22); g.restore();
  }
  const stoneTex = (c1: string, c2: string, rows: number, cols: number) => canvasTex(256, 256, (g, w, h) => { g.fillStyle = c2; g.fillRect(0, 0, w, h); const rh = h / rows; for (let r0 = 0; r0 < rows; r0++) { const off = r0 % 2 ? w / cols / 2 : 0; for (let c = -1; c < cols + 1; c++) { const v = (r0 * 7 + c * 13) % 5; g.fillStyle = v < 2 ? c1 : v < 4 ? "#cdc4b1" : "#e1d9c9"; g.fillRect(off + c * (w / cols) + 2, r0 * rh + 2, w / cols - 4, rh - 4); } } });
  async function hotel(s: Extract<SceneSpec, { id: "hotel" }>) {
    scene.background = new THREE.Color("#3e5f8f"); lights(0.35);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), mat("#59616c", { roughness: 0.35, metalness: 0.2 })); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
    box(60, 0.02, 5, "#2f343b", 0, 0, 6.5); box(20, 0.12, 1.2, "#3f8f3f", 3.5, 0, -1.6);
    const dark = stoneTex("#4a4f5a", "#3a3e47", 10, 8); dark.wrapS = dark.wrapT = THREE.RepeatWrapping; dark.repeat.set(4, 3);
    const bm = new THREE.Mesh(new THREE.BoxGeometry(18, 9.5, 7), new THREE.MeshStandardMaterial({ map: dark, roughness: 0.9 })); bm.position.set(1, 4.75, -10); bm.castShadow = bm.receiveShadow = true; scene.add(bm);
    box(18.2, 0.5, 7.2, "#9aa0aa", 1, 9.5, -10);
    for (let f = 0; f < 3; f++) for (let k = 0; k < 8; k++) { const lit = (f * 3 + k) % 4 === 0; const wv = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 1.1), new THREE.MeshBasicMaterial({ color: lit ? "#ffd58a" : "#1f2430" })); wv.position.set(-6.5 + k * 2.1, 3.3 + f * 2.4, -6.48); scene.add(wv); }
    box(8, 5, 4.5, "#353a44", 4.5, 0, -5.6);
    plane(6.5, 1.1, canvasTex(1040, 176, (g, w, h) => { g.fillStyle = "#1c2030"; g.fillRect(0, 0, w, h); g.fillStyle = "#f8fafc"; g.font = "italic bold 78px serif"; g.textAlign = "center"; g.fillText("Candellux", w / 2, 86); g.font = "bold 42px sans-serif"; g.fillText("IMPERIAL HOTEL AND SUITES", w / 2, 152); }), 1.5, 11.0, -7.0, 0, 0, true);
    const st = stoneTex("#d8d0bf", "#c4bba7", 8, 6); st.wrapS = st.wrapT = THREE.RepeatWrapping; st.repeat.set(3, 1);
    const lamps: number[] = [];
    for (const [x0, x1] of [[-8, -2.4], [0.6, 11]]) {
      const len = x1 - x0; const wm = new THREE.Mesh(new THREE.BoxGeometry(len, 1.7, 0.5), new THREE.MeshStandardMaterial({ map: st, roughness: 0.9 })); wm.position.set((x0 + x1) / 2, 0.85, -2.6); wm.castShadow = wm.receiveShadow = true; scene.add(wm);
      for (let x = x0; x <= x1 + 0.01; x += len / Math.max(1, Math.round(len / 2.6))) { box(0.8, 2.3, 0.8, "#ddd5c4", x, 0, -2.6); box(0.95, 0.15, 0.95, "#5b616b", x, 2.3, -2.6); lamps.push(x); }
    }
    for (let i = 0; i < 9; i++) box(0.06, 2.0, 0.06, "#1f2937", -2.2 + i * 0.33, 0, -2.6);
    for (const x of lamps) { const l = box(0.22, 0.28, 0.12, "#fff7d6", x, 1.15, -2.17); l.material.emissive = new THREE.Color("#ffcf7a"); l.material.emissiveIntensity = 1.2; const pl = new THREE.PointLight("#ffbf5e", 3, 4.5); pl.position.set(x, 1.3, -1.8); scene.add(pl); }
    const face = new THREE.MeshBasicMaterial({ map: canvasTex(480, 920, (g, w, h) => {
      g.fillStyle = "#1c2030"; g.fillRect(0, 0, w, h); g.fillStyle = "#22c55e"; g.fillRect(0, 0, 10, h); crown(g, w / 2, 120, 56);
      g.textAlign = "center"; g.fillStyle = CL.gold; g.font = "italic bold 74px serif"; g.fillText("Candellux", w / 2, 264);
      g.fillStyle = "#fff"; g.font = "bold 37px sans-serif"; g.fillText("IMPERIAL HOTEL", w / 2, 316); g.fillStyle = CL.gold; g.font = "bold 29px sans-serif"; g.fillText("& SUITES", w / 2, 352); g.font = "italic 24px serif"; g.fillText("...We Strive for the Best", w / 2, 388);
      ["LUXURY ACCOMMODATION", "24HOURS RESTAURANT", "CONFERENCE FACILITIES", "SWIMMING POOL", "VIP BAR", "GYM", "LAUNDRY", "BARBING SALOON", "BUSINESS CENTRE"].forEach((t, i) => { g.fillStyle = i % 2 ? CL.gold : "#fff"; g.font = "bold 27px sans-serif"; g.fillText(t, w / 2, 456 + i * 51); });
    }) });
    const dk = mat("#1c2030");
    const sg = new THREE.Mesh(new THREE.BoxGeometry(2.4, 4.6, 0.3), [dk, dk, dk, dk, face, dk]); sg.position.set(-6.2, 3.0, 1.6); sg.rotation.y = 0.35; sg.castShadow = true; scene.add(sg);
    box(0.3, 0.8, 0.3, "#111", -6.2, 0, 1.6);
    box(4, 0.7, 1.8, "#11574d", -3.5, 0.25, -5.0); box(2.2, 0.6, 1.7, "#0e4a41", -3.6, 0.95, -5.0); wheelsAt([[-4.8, -5.95], [-2.2, -5.95], [-4.8, -4.05], [-2.2, -4.05]], 0.32);
    player = person(-0.9, 0.6, s.outfit, Math.PI);
    residents("hotel", [[2.6, 0.2, Math.PI - 0.3, 0], [4.0, 0.9, Math.PI + 0.4, 0]]);
    others(s.others, [[-2.6, 0.9, Math.PI, 0], [0.9, 1.4, Math.PI, 0]]);
    const phone = innerWidth < 700;
    cam.position.set(...(phone ? [-9, 6, 30] : [-15, 5.2, 21]) as [number, number, number]); controls.target.set(phone ? -0.5 : 0, phone ? 4.2 : 4.4, -4);
    controls.minDistance = 10; controls.maxDistance = 45;
    tag("sign", -6.2, 5.6, 1.6); tag("gate", -0.9, 2.5, -2.6); tag("pool", 6, 2.6, -3.5);
  }
  async function pool(s: Extract<SceneSpec, { id: "pool" }>) {
    scene.background = new THREE.Color("#e8f1f8"); lights(1);
    const turf = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), mat("#3fae3f")); turf.rotation.x = -Math.PI / 2; turf.receiveShadow = true; scene.add(turf);
    const st = stoneTex("#d9d0bd", "#bfb5a0", 12, 10); st.wrapS = st.wrapT = THREE.RepeatWrapping; st.repeat.set(3, 2);
    const wing = new THREE.Mesh(new THREE.BoxGeometry(18, 9, 2), new THREE.MeshStandardMaterial({ map: st, roughness: 0.95 })); wing.position.set(0, 4.5, -7); wing.castShadow = wing.receiveShadow = true; scene.add(wing);
    for (let f = 0; f < 2; f++) for (let k = 0; k < 5; k++) { const x = -6.5 + k * 3.2, y = 4.2 + f * 2.6; box(1.1, 1.7, 0.08, "#e5e7eb", x, y, -5.97); box(0.75, 0.45, 0.35, "#f1f5f9", x + 1.2, y + 0.9, -5.8); }
    for (let k = 0; k < 5; k++) box(0.9, 2.0, 0.08, k % 2 ? "#8a5a3b" : "#2b2f36", -6.5 + k * 3.2, 0, -5.97);
    for (let i = 0; i <= 30; i++) box(0.04, 1.0, 0.04, "#cbd5e1", -8.5 + i * 0.57, 0, -4.9);
    box(10.4, 0.12, 5.4, "#f3efe6", -0.6, 0, -0.3);
    const mosaic = canvasTex(256, 128, (g, w, h) => { const cols = ["#1d4ed8", "#2563eb", "#1e40af", "#3b82f6"]; for (let y = 0; y < h; y += 8) for (let x = 0; x < w; x += 8) { g.fillStyle = cols[((x * 7 + y * 3) / 8) % 4 | 0]; g.fillRect(x + 0.5, y + 0.5, 7, 7); } });
    plane(9.6, 4.6, mosaic, -0.6, 0.125, -0.3, -Math.PI / 2);
    const water = new THREE.Mesh(new THREE.PlaneGeometry(9.6, 4.6), new THREE.MeshStandardMaterial({ color: "#38bdf8", transparent: true, opacity: 0.45, roughness: 0.05 })); water.rotation.x = -Math.PI / 2; water.position.set(-0.6, 0.14, -0.3); scene.add(water);
    for (let i = 0; i < 4; i++) box(0.8, 2.6, 0.8, "#2f7d32", 8.3, 0, -4 + i * 2.6);
    box(4.5, 0.12, 2.4, "#0f766e", -8.6, 2.7, -3.6); for (const [a, b] of [[-10.6, -4.6], [-6.6, -4.6], [-10.6, -2.6], [-6.6, -2.6]]) box(0.1, 2.7, 0.1, "#0f766e", a, 0, b);
    box(2.4, 0.5, 1.0, "#1f2937", -8.4, 0, 3.0); box(2.4, 0.6, 0.25, "#1f2937", -8.4, 0.5, 3.4);
    for (const x of [5.6, 7.0]) { box(0.75, 0.25, 2.0, "#f8fafc", x, 0.3, 3.3); const back = box(0.75, 0.6, 0.12, "#f8fafc", x, 0.5, 2.35); back.rotation.x = -0.6; }
    cyl(0.04, 2.4, "#78716c", 6.3, 0, 1.6); const umb = new THREE.Mesh(new THREE.ConeGeometry(1.6, 0.6, 16), mat("#e3b23c")); umb.position.set(6.3, 2.5, 1.6); umb.castShadow = true; scene.add(umb);
    player = person(5.6, 3.1, s.outfit, 0); player.rotation.set(-Math.PI / 2, 0, 0); player.position.set(5.6, 0.72, 2.45);
    person(7.0, 2.0, "#26a69a", -0.6); person(-2.5, 3.4, "#ec4899", 0.4);
    box(1.6, 1.1, 0.7, "#3b2a20", -4.5, 0, -4.2); box(1.7, 0.06, 0.8, CL.gold, -4.5, 1.1, -4.2);
    const phone = innerWidth < 700;
    cam.position.set(...(phone ? [2, 17, 27] : [4, 12.5, 23]) as [number, number, number]); controls.target.set(-0.5, phone ? 0.5 : 2, phone ? -1 : -1.5);
    controls.minDistance = 10; controls.maxDistance = 40;
    tag("pool", -0.6, 1.0, -0.3); tag("bar", -4.5, 2.2, -4.2); tag("suites", -3.3, 8.2, -6); tag("gym", 3.1, 2.6, -6); tag("front", -8.4, 1.6, 3.0);
  }

  // ---------- running it ----------
  function clear() {
    scene.traverse((o) => { const m = o as THREE.Mesh; if (m.geometry) m.geometry.dispose(); const mm = m.material as THREE.Material | THREE.Material[] | undefined; (Array.isArray(mm) ? mm : mm ? [mm] : []).forEach((x) => { (x as THREE.MeshStandardMaterial).map?.dispose(); x.dispose(); }); });
    scene = new THREE.Scene(); anchors = []; player = null; tween = null;
  }
  let current = "";
  async function show(s: SceneSpec) {
    // Moving around the room is a walk, not a new scene: the spot isn't part of what the scene is built from.
    const { at, ...rest } = s as SceneSpec & { at?: RoomSpot };
    const key = JSON.stringify(rest);
    if (key === current) { if (s.id === "room" && at && !s.sleeping) walkTo(at); return; }
    current = key;
    clear();
    if (s.id === "room") await room(s); else if (s.id === "itel") await itel(s); else if (s.id === "street") await street(s); else if (s.id === "chef") await chef(s); else if (s.id === "hotel") await hotel(s); else await pool(s);
    controls.update(); resize();
  }
  function walkTo(spot: RoomSpot) { if (!player) return; const [x, z, rot] = ROOM_SPOTS[spot]; const to = new THREE.Vector3(x, player.position.y, z); if (to.distanceTo(player.position) < 0.05) return; tween = { from: player.position.clone(), to, rot, t0: performance.now(), ms: 550 }; }
  function resize() {
    const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight;
    r.setSize(w, h, false); cam.aspect = w / h; cam.fov = w < 700 ? 44 : 34; cam.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize); ro.observe(canvas);
  function frame() {
    if (disposed) return;
    controls.update();
    if (tween && player) { const k = Math.min(1, (performance.now() - tween.t0) / tween.ms); player.position.lerpVectors(tween.from, tween.to, k); if (k >= 1) { player.rotation.y = tween.rot; tween = null; } }
    r.render(scene, cam);
    if (listeners.length) {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      const tags = anchors.map(({ key, v }) => { const p = v.clone().project(cam); return { key, x: ((p.x + 1) / 2) * w, y: ((1 - p.y) / 2) * h, visible: p.z < 1 && p.x > -1.1 && p.x < 1.1 && p.y > -1.1 && p.y < 1.1 }; });
      listeners.forEach((f) => f(tags));
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  return {
    show,
    // Walks the player to a spot in the room (the next show() with the new spot then matches).
    walk: walkTo,
    onTags(f: (tags: Tag[]) => void) { listeners.push(f); return () => { listeners = listeners.filter((x) => x !== f); }; },
    dispose() { disposed = true; ro.disconnect(); controls.dispose(); clear(); r.dispose(); },
  };
}
export type World = ReturnType<typeof createWorld>;
