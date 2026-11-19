// Merch in 3D (docs/MERCH_3D.md): the product models, built in code with three. No model files: each item is a few shapes, coloured
// from the chosen colour, with the logo (or a custom shirt's own picture) drawn onto a canvas and used as the texture.
// Loaded only on an item page (components/merch/Merch3D.tsx imports this file dynamically).
import * as THREE from "three";
import type { MerchDesign, MerchPattern, MerchPlace, MerchShape } from "@/lib/merch";

// pattern: one of the owner's pattern backgrounds: all over a cup, bag or pad (with the logo on top), or on the back of a shirt (with
// only the name on it).
export type Look = { shape: MerchShape | "design"; colour: string; logo?: string; place?: MerchPlace; name?: string; design?: MerchDesign; pattern?: MerchPattern | null };

const images = new Map<string, Promise<HTMLImageElement>>();
export function loadImage(src: string): Promise<HTMLImageElement> {
  if (!images.has(src)) {
    images.set(src, new Promise((ok, no) => { const i = new Image(); i.crossOrigin = "anonymous"; i.onload = () => ok(i); i.onerror = no; i.src = src; }));
  }
  return images.get(src)!;
}
const canvas = (w: number, h: number) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; };
const texture = (c: HTMLCanvasElement) => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };
// Text that reads on the colour behind it.
export function inkFor(hex: string): string {
  const n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 150 ? "#1A1210" : "#ffffff";
}
function drawLogo(ctx: CanvasRenderingContext2D, img: HTMLImageElement | null, cx: number, cy: number, w: number, aspect = 1) {
  if (!img) return;
  const h = (w * img.height) / img.width / aspect;
  ctx.drawImage(img, cx - w / 2, cy - h / 2, w, h);
}
// A picture covering the whole of a canvas area, cropped to fit (like CSS background-size: cover).
function cover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const k = Math.max(w / img.width, h / img.height), iw = img.width * k, ih = img.height * k;
  ctx.drawImage(img, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
}
// A pattern on everything already drawn on a canvas (it keeps the outline: only what is there is covered).
async function patternOver(ctx: CanvasRenderingContext2D, pattern: MerchPattern, tall: boolean) {
  const img = await loadImage(tall ? pattern.tall : pattern.wide).catch(() => null);
  if (!img) return;
  ctx.save(); ctx.globalCompositeOperation = "source-atop"; cover(ctx, img, 0, 0, ctx.canvas.width, ctx.canvas.height); ctx.restore();
}
function drawName(ctx: CanvasRenderingContext2D, name: string, cx: number, cy: number, width: number, ink: string) {
  if (!name) return;
  let size = width * 0.16;
  ctx.font = `800 ${size}px Inter, Arial, sans-serif`;
  while (ctx.measureText(name).width > width * 0.4 && size > 10) { size -= 2; ctx.font = `800 ${size}px Inter, Arial, sans-serif`; }
  ctx.fillStyle = ink; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(name, cx, cy);
}

// ── Shirts: two curved sheets, front and back, cut to the shirt's outline ─────────────────────────────────────────────────────
// The outline of a plain T-shirt (the same drawing as components/MerchMockup.tsx), in a 200 × 200 box.
const TEE_PATH = "M62 28 L90 18 Q100 34 110 18 L138 28 L178 62 L156 88 L140 76 L140 174 L60 174 L60 76 L44 88 L22 62 Z";
const TEE_BOX = { x: 22, y: 18, w: 156, h: 156 };

async function shirtCanvases(look: Look): Promise<{ front: HTMLCanvasElement; back: HTMLCanvasElement }> {
  const logo = look.logo ? await loadImage(look.logo).catch(() => null) : null;
  if (look.design) {
    const img = await loadImage(look.design.image);
    const W = img.width, H = img.height;
    const front = canvas(W, H), f = front.getContext("2d")!;
    f.drawImage(img, 0, 0);
    // The back: the same outline (mirrored), the sleeves and collar from the picture, the body in the shirt's main colour, the name.
    const back = canvas(W, H), b = back.getContext("2d")!;
    b.translate(W, 0); b.scale(-1, 1); b.drawImage(img, 0, 0); b.setTransform(1, 0, 0, 1, 0, 0);
    // No logo on the back of a shirt (owner, 19 Nov 2026): the shirt's main colour, or the chosen pattern, and the name.
    if (look.pattern) await patternOver(b, look.pattern, true);
    else {
      b.globalCompositeOperation = "source-atop";
      b.fillStyle = look.design.base; b.fillRect(W * 0.24, H * 0.115, W * 0.52, H); b.fillRect(W * 0.17, H * 0.42, W * 0.66, H);
      b.globalCompositeOperation = "source-over";
    }
    drawName(b, look.name ?? "", W / 2, H * 0.3, W, look.pattern ? look.pattern.ink : look.design.ink);
    return { front, back };
  }
  const W = 1024, H = 1024, s = W / TEE_BOX.w;
  const path = new Path2D(TEE_PATH);
  const sheet = (mirror: boolean) => {
    const c = canvas(W, H), x = c.getContext("2d")!;
    x.save();
    if (mirror) { x.translate(W, 0); x.scale(-1, 1); }
    x.scale(s, s); x.translate(-TEE_BOX.x, -TEE_BOX.y);
    x.fillStyle = look.colour; x.fill(path);
    x.strokeStyle = "rgba(0,0,0,.18)"; x.lineWidth = 1.2; x.beginPath(); x.moveTo(60, 76); x.quadraticCurveTo(100, 84, 140, 76); x.stroke();
    x.restore();
    return c;
  };
  const front = sheet(false), back = sheet(true);
  const f = front.getContext("2d")!, b = back.getContext("2d")!;
  const place = look.place ?? "front";
  if (place === "chest") drawLogo(f, logo, W * 0.62, H * 0.3, W * 0.12);
  else drawLogo(f, logo, W / 2, H * 0.4, W * 0.24);
  if (look.pattern) await patternOver(b, look.pattern, true);
  const ink = look.pattern ? look.pattern.ink : inkFor(look.colour);
  drawName(b, look.name ?? "", W / 2, H * 0.28, W, ink);
  if (place === "both" && !look.pattern) drawLogo(b, logo, W / 2, H * (look.name ? 0.5 : 0.42), W * 0.3);
  return { front, back };
}

function shirt(front: HTMLCanvasElement, back: HTMLCanvasElement): THREE.Group {
  const W = 2, H = (W * front.height) / front.width, depth = 0.24, torso = W * 0.26;
  const curve = (g: THREE.PlaneGeometry, sign: 1 | -1, mirrorU: boolean) => {
    const pos = g.attributes.position, uv = g.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      // A smooth round body that thins out towards the sleeves (no crease where the body meets them).
      pos.setZ(i, sign * (0.012 + depth * Math.exp(-((x / (torso * 1.08)) ** 4))));
      if (mirrorU) uv.setX(i, 1 - uv.getX(i));
    }
    g.computeVertexNormals();
    return g;
  };
  const mat = (c: HTMLCanvasElement) => new THREE.MeshStandardMaterial({ map: texture(c), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.85 });
  const g = new THREE.Group();
  g.add(new THREE.Mesh(curve(new THREE.PlaneGeometry(W, H, 64, 64), 1, false), mat(front)));
  g.add(new THREE.Mesh(curve(new THREE.PlaneGeometry(W, H, 64, 64), -1, true), mat(back)));
  return g;
}

// ── Mugs and cups: a turned body with the logo on a wrap-around texture ───────────────────────────────────────────────────────
async function wrap(look: Look, aspect: number): Promise<HTMLCanvasElement> {
  const W = 1024, H = Math.round(W / aspect), c = canvas(W, H), x = c.getContext("2d")!;
  x.fillStyle = look.pattern?.base ?? look.colour; x.fillRect(0, 0, W, H);
  if (look.pattern) await patternOver(x, look.pattern, false);
  const logo = look.logo ? await loadImage(look.logo).catch(() => null) : null;
  // The body's texture starts at the back (thetaStart -π), so the middle of the canvas faces the front.
  const at = look.place === "wrap" ? [0.125, 0.375, 0.625, 0.875] : [0.5];
  for (const u of at) drawLogo(x, logo, W * u, H * 0.5, W * 0.13, 1 / (aspect / Math.PI));
  return c;
}
function body(rTop: number, rBottom: number, h: number, map: THREE.Texture, colour: string) {
  const g = new THREE.Group();
  const side = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBottom, h, 72, 1, true, -Math.PI, Math.PI * 2), new THREE.MeshStandardMaterial({ map, roughness: 0.35, metalness: 0.05 }));
  const inside = new THREE.Mesh(new THREE.CylinderGeometry(rTop * 0.94, rBottom * 0.94, h * 0.98, 48, 1, true), new THREE.MeshStandardMaterial({ color: new THREE.Color(colour).multiplyScalar(0.7), side: THREE.BackSide, roughness: 0.5 }));
  const rim = new THREE.Mesh(new THREE.RingGeometry(rTop * 0.94, rTop, 72), new THREE.MeshStandardMaterial({ color: colour, side: THREE.DoubleSide, roughness: 0.4 }));
  rim.rotation.x = -Math.PI / 2; rim.position.y = h / 2;
  const bottom = new THREE.Mesh(new THREE.CircleGeometry(rBottom, 48), new THREE.MeshStandardMaterial({ color: colour }));
  bottom.rotation.x = Math.PI / 2; bottom.position.y = -h / 2;
  inside.position.y = 0.01;
  g.add(side, inside, rim, bottom);
  return g;
}
const handle = (radius: number, tube: number, colour: string, x: number, y = 0) => {
  const m = new THREE.Mesh(new THREE.TorusGeometry(radius, tube, 16, 40, Math.PI), new THREE.MeshStandardMaterial({ color: colour, roughness: 0.4 }));
  m.rotation.z = -Math.PI / 2; m.position.set(x, y, 0);
  return m;
};

// ── Flat items: a rounded slab with the logo on a decal in front ──────────────────────────────────────────────────────────────
function slab(w: number, h: number, d: number, colour: string, r = 0.12) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2 + r, -h / 2); s.lineTo(w / 2 - r, -h / 2); s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
  s.lineTo(w / 2, h / 2 - r); s.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2); s.lineTo(-w / 2 + r, h / 2);
  s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r); s.lineTo(-w / 2, -h / 2 + r); s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
  const g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 3 });
  g.translate(0, 0, -d / 2);
  return new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: colour, roughness: 0.8 }));
}
async function decal(src: string | undefined, size: number): Promise<THREE.Mesh | null> {
  if (!src) return null;
  const img = await loadImage(src).catch(() => null);
  if (!img) return null;
  const c = canvas(512, Math.round((512 * img.height) / img.width)); c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
  return new THREE.Mesh(new THREE.PlaneGeometry(size, (size * c.height) / c.width), new THREE.MeshStandardMaterial({ map: texture(c), transparent: true, roughness: 0.6 }));
}

// A pattern panel for the face of a slab, with the slab's rounded corners.
async function patternPanel(pattern: MerchPattern, w: number, h: number, r: number): Promise<THREE.Mesh | null> {
  const img = await loadImage(pattern.wide).catch(() => null);
  if (!img) return null;
  const W = 1024, H = Math.round((W * h) / w), R = (r / w) * W, c = canvas(W, H), x = c.getContext("2d")!;
  x.beginPath(); x.roundRect(0, 0, W, H, R); x.clip(); cover(x, img, 0, 0, W, H);
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: texture(c), transparent: true, roughness: 0.8 }));
}

// The product, centred on the origin, about 2 units across.
export async function buildProduct(look: Look): Promise<THREE.Group> {
  const g = new THREE.Group();
  // With a pattern, the parts it doesn't cover (handles, rims, edges) take the pattern's own colour.
  const c = look.pattern && look.shape !== "tshirt" && look.shape !== "design" ? look.pattern.base : look.colour;
  switch (look.shape) {
    case "design":
    case "tshirt": {
      const { front, back } = await shirtCanvases(look);
      g.add(shirt(front, back));
      break;
    }
    case "mug": case "coffeecup": {
      const cup = look.shape === "coffeecup";
      const [rT, rB, h] = cup ? [0.62, 0.46, 1.5] : [0.62, 0.62, 1.4];
      g.add(body(rT, rB, h, texture(await wrap(look, (2 * Math.PI * rT) / h)), c));
      if (cup) {
        const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.66, 0.14, 48), new THREE.MeshStandardMaterial({ color: "#2a2627", roughness: 0.6 }));
        lid.position.y = h / 2 + 0.06; g.add(lid);
      } else g.add(handle(0.36, 0.07, c, rT, 0));
      break;
    }
    case "stanley": {
      const h = 2.1;
      g.add(body(0.5, 0.36, h, texture(await wrap(look, (2 * Math.PI * 0.5) / h)), c));
      const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.53, 0.53, 0.16, 48), new THREE.MeshStandardMaterial({ color: c, roughness: 0.5 }));
      lid.position.y = h / 2 + 0.07;
      const straw = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.7, 16), new THREE.MeshStandardMaterial({ color: "#d9d4cf", roughness: 0.3 }));
      straw.position.set(0.12, h / 2 + 0.4, 0); straw.rotation.z = -0.15;
      g.add(lid, straw, handle(0.5, 0.075, c, 0.45, 0.25));
      g.scale.setScalar(0.85);
      break;
    }
    case "cap": {
      const m = new THREE.MeshStandardMaterial({ color: c, roughness: 0.8, side: THREE.DoubleSide });
      const dome = new THREE.Mesh(new THREE.SphereGeometry(0.8, 64, 32, 0, Math.PI * 2, 0, Math.PI / 2), m);
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.84, 0.84, 0.04, 48, 1, false, -Math.PI / 2, Math.PI), new THREE.MeshStandardMaterial({ color: new THREE.Color(c).multiplyScalar(0.85), roughness: 0.8 }));
      brim.scale.z = 1.3; brim.position.set(0, 0.02, 0.06);
      const button = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 12), m);
      button.position.y = 0.8;
      g.add(dome, brim, button);
      const logo = await decal(look.logo, 0.42);
      if (logo) { const a = (35 * Math.PI) / 180; logo.position.set(0, 0.8 * Math.sin(a) + 0.02, 0.8 * Math.cos(a) + 0.02); logo.rotation.x = -a; g.add(logo); }
      g.position.y = -0.35;
      break;
    }
    case "mousepad": {
      const pad = slab(2.2, 1.6, 0.06, c, 0.16);
      g.add(pad);
      const face = look.pattern ? await patternPanel(look.pattern, 2.2, 1.6, 0.16) : null;
      if (face) { face.position.z = 0.052; g.add(face); }
      const logo = await decal(look.logo, 0.6);
      if (logo) { logo.position.z = 0.06; g.add(logo); }
      g.rotation.x = -0.9;
      break;
    }
    case "laptopbag": {
      g.add(slab(2.1, 1.5, 0.3, c, 0.14));
      for (const side of look.pattern ? [1, -1] : []) {
        const face = await patternPanel(look.pattern!, 2.1, 1.5, 0.14);
        if (face) { face.position.z = 0.172 * side; if (side < 0) face.rotation.y = Math.PI; g.add(face); }
      }
      const strap = handle(0.32, 0.04, new THREE.Color(c).multiplyScalar(0.7).getStyle(), 0, 0.75);
      strap.rotation.z = 0; g.add(strap);
      const logo = await decal(look.logo, 0.5);
      if (logo) { logo.position.z = 0.2; g.add(logo); }
      break;
    }
  }
  return g;
}

export function disposeAll(o: THREE.Object3D) {
  o.traverse((x) => {
    const m = x as THREE.Mesh;
    if (!m.isMesh) return;
    m.geometry.dispose();
    for (const mat of Array.isArray(m.material) ? m.material : [m.material]) { (mat as THREE.MeshStandardMaterial).map?.dispose(); mat.dispose(); }
  });
}

// The stage: camera, lights, and a renderer on the given canvas. Turning is done by the caller (Merch3D.tsx).
export function makeStage(el: HTMLCanvasElement) {
  const renderer = new THREE.WebGLRenderer({ canvas: el, antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
  scene.add(new THREE.HemisphereLight(0xffffff, 0xd9c7bd, 1.6));
  const key = new THREE.DirectionalLight(0xffffff, 1.6); key.position.set(2.5, 3, 4); scene.add(key);
  const rim = new THREE.DirectionalLight(0xffffff, 0.7); rim.position.set(-3, 1, -3); scene.add(rim);
  const holder = new THREE.Group(); scene.add(holder);
  return { renderer, scene, camera, holder, THREE };
}
