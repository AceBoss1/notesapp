// Nana's avatar maker (docs/AVATAR_MAKER.md; owner, 17 Nov 2026): a member gives a photo of themselves and gets a flat illustrated portrait
// to use as their profile picture, with the "Made with Nana AI" mark on it. The picture is made by an image model (OpenAI or Google,
// whichever is set up: lib/avatar-providers.ts); Claude does not make pictures. Pure and client-safe; the server part is
// lib/avatar-maker-server.ts.
//
// Gate: only the #NotesApp team on the staff test pass (Admin → Limits) until AVATAR_MAKER_FOR_EVERYONE is switched on here.
export const AVATAR_MAKER_FOR_EVERYONE = false;
export const AVATAR_CLOSED = "Nana's avatar maker is being tested by the #NotesApp team and opens to everyone soon.";
export const AVATAR_NOT_SET_UP = "The avatar maker isn't set up yet: it needs an image model's key.";

export const AVATAR_PER_DAY = 10; // while it is team-only; a price or a plan limit comes with opening it
export const AVATAR_PHOTO_MAX = 8 * 1024 * 1024;
export const AVATAR_SIZE = 1024;
export const AVATAR_MARK = "Made with Nana AI";
export const AVATAR_FOLDER = "avatars";

export const AVATAR_PROVIDERS = ["openai", "gemini"] as const;
export type AvatarProvider = (typeof AVATAR_PROVIDERS)[number];
export const isAvatarProvider = (v: unknown): v is AvatarProvider => typeof v === "string" && (AVATAR_PROVIDERS as readonly string[]).includes(v);
// The model each provider uses unless AVATAR_IMAGE_MODEL names another.
export const AVATAR_MODEL: Record<AvatarProvider, string> = { openai: "gpt-image-1", gemini: "gemini-2.5-flash-image" };

export class AvatarError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

// What the image model is asked for. The look the owner approved (17 Nov 2026): flat editorial illustration, warm and friendly.
export const AVATAR_PROMPT = [
  "Redraw the person in this photo as a flat vector-style illustrated portrait, head and shoulders, facing the viewer.",
  "Style: modern African editorial illustration. Clean confident shapes, soft cel shading with two or three tones on the skin, simple expressive eyes, the same expression they have in the photo (do not add a smile they are not showing), hair drawn as bold shapes with a little texture.",
  "Keep them recognisable: the same skin tone, face shape, hair style and hairline, any beard or moustache in the shape they wear it, glasses, headwrap or cap, and the colours and pattern of their clothes. Draw jewellery as it is in the photo, with the same pendant shape, and add nothing they are not wearing.",
  "Background: one solid, vivid colour that suits their clothes. Square picture, the face centred in the upper two thirds, the shoulders running off the bottom edge.",
  "Proportions: copy the person's real proportions from the photo and do not change their build. Measure in the photo how wide the neck is against the jaw and how wide the shoulders are against the head, and draw the same ratios. A real neck is thick: nearly as wide as the jaw (at least three quarters of the face's width at the cheeks), with its sides dropping almost straight down from just inside the ears, never a narrow column under the chin. Keep the neck short, with the chin close to the collar. Do not widen or enlarge the shoulders or body beyond what the photo shows.",
  "No text, no logo, no watermark, no border, no other people. Leave the bottom left corner free of important detail.",
].join(" ");

export type PhotoType = "image/jpeg" | "image/png" | "image/webp";
// What the bytes really are, whatever the upload said.
export function photoType(b: Uint8Array): PhotoType | null {
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b.length > 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return "image/webp";
  return null;
}
export function checkPhoto(b: Uint8Array): PhotoType {
  if (!b.length) throw new AvatarError("Choose a photo first.");
  if (b.length > AVATAR_PHOTO_MAX) throw new AvatarError("That photo is too large. Choose one under 8 MB.");
  const t = photoType(b);
  if (!t) throw new AvatarError("Choose a JPEG, PNG or WebP photo.");
  return t;
}

// The day the count belongs to: Lagos time, like the other daily limits.
export const avatarDay = (now: Date) => new Date(now.getTime() + 3_600_000).toISOString().slice(0, 10);
export type AvatarStatus = { open: boolean; ready: boolean; limit: number; used: number; left: number; closed?: string };
