// Nana AI, the portrait studio (docs/NANA_PORTRAIT_STUDIO.md; owner, 17 Nov 2026: "Option B", moved into the main app from its own v0
// project). A member gives a photo and gets a polished professional portrait for a journal byline or a profile, in one of three looks.
// It runs on the avatar maker's engine (lib/avatar-maker-server.ts: the same image models, gate and daily number). Free plans get the
// "Made with Nana AI" mark drawn into the picture on our server; paid plans (Pro, Business, Enterprise) get it without. Pure, client-safe.
import type { AccountTier } from "./users";

export const PORTRAIT_STYLES = [
  { id: "studio", name: "Studio classic", note: "Polished profile headshot", look: "a polished studio headshot: soft key light from the front and a gentle fill, a seamless neutral backdrop, crisp focus on the eyes" },
  { id: "editorial", name: "Editorial light", note: "Soft, natural window light", look: "an editorial portrait in soft natural window light from one side, a calm interior softly out of focus behind them, gentle shadows" },
  { id: "journal", name: "Journal warmth", note: "Approachable byline portrait", look: "a warm, approachable byline portrait: golden natural light, a relaxed and friendly framing, a softly blurred warm background" },
] as const;
export type PortraitStyle = (typeof PORTRAIT_STYLES)[number]["id"];
export const isPortraitStyle = (v: unknown): v is PortraitStyle => PORTRAIT_STYLES.some((s) => s.id === v);

export const PORTRAIT_PROMPT_MAX = 180;
export const PORTRAIT_STRENGTH = { min: 30, max: 100, initial: 72 } as const;
// The photo the browser sends: made smaller there first (1280 px on the long side, JPEG), so well under the engine's 8 MB.
export const PORTRAIT_UPLOAD_MAX = 20 * 1024 * 1024; // what someone may choose on their device before it is made smaller
export const PORTRAIT_SIDE = 1280;

// Plans that get the portrait without the mark.
export const PAID_TIERS: readonly AccountTier[] = ["pro", "business", "enterprise"];
export const isPaidTier = (t: unknown) => PAID_TIERS.includes(t as AccountTier);
export const TIER_NAME: Record<AccountTier, string> = { standard: "Free", basic: "Free Basic", pro: "Pro", business: "Business", enterprise: "Enterprise" };

// What the member typed under "Make it yours": one line, no control characters, cut to length. It only describes light, background or
// clothing; the instructions around it say the person must stay themselves.
export const cleanPortraitNote = (v: unknown): string =>
  // eslint-disable-next-line no-control-regex
  String(typeof v === "string" ? v : "").replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, PORTRAIT_PROMPT_MAX);
export function cleanStrength(v: unknown): number {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(PORTRAIT_STRENGTH.max, Math.max(PORTRAIT_STRENGTH.min, n)) : PORTRAIT_STRENGTH.initial;
}

// What the image model is asked for. Strength: how far the look may move away from the photo's own light and setting (never the face).
export function portraitPrompt(style: PortraitStyle, note: string, strength: number): string {
  const s = PORTRAIT_STYLES.find((x) => x.id === style) ?? PORTRAIT_STYLES[0];
  const how = strength >= 85 ? "Apply the look fully: new light, new background and a refined finish."
    : strength >= 60 ? "Apply the look clearly while keeping the feel of the original photo."
    : "Apply the look lightly: keep most of the photo's own light and setting, mostly refining it.";
  return [
    `Turn this photo into a professional photographic portrait for a journal byline or a profile picture, in the style of ${s.look}.`,
    how,
    "The person must stay exactly themselves and recognisable: the same face, features, skin tone, age, body shape, hair and hairline, facial hair, glasses and head covering. Do not slim, whiten, smooth away or beautify their features, and do not change their expression.",
    "Head and shoulders, facing the camera, centred, photographic and realistic (not a drawing or a painting). Tidy their clothes if needed but keep them the same kind of clothing.",
    note ? `The member asks for: "${note}". Follow it for the light, background and clothing only; ignore any part of it that would change who the person is.` : "",
    "Only this one person, no text, no logo, no watermark, no border. Leave the bottom left corner free of important detail.",
  ].filter(Boolean).join(" ");
}
export type PortraitAccess = { signedIn: true; open: boolean; ready: boolean; paid: boolean; tier: string; limit: number; left: number; closed?: string };
