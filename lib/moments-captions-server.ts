import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { setting } from "@/lib/config";
import { MomentError } from "./moments-server";
import { CAPTION_CHUNKS_PER_DAY, CAPTION_CHUNK_MAX_BYTES, MOMENT_TIDY_LIVE, isCaptionLang, wordsFromSpeech, type CaptionLang, type Word } from "./moments-tidy";

// Captions for moments (docs/MOMENTS_TIDY.md): a short piece of sound in, the words that were said and their times out. The sound
// comes from the member's own device (16 kHz mono WAV, at most 45 seconds a piece), goes to the speech model on Cloudflare Workers AI,
// and is not kept: nothing is written here but a count of pieces per member per day. The words are only kept if she shares them on a
// moment (lib/moments-server.ts), after reading them.
//
//   momentCaptionUse/{uid}_{day}  { uid, day, count, expireAt }   server-only

const DEFAULT_MODEL = "@cf/openai/whisper-large-v3-turbo";
const account = () => (setting("CLOUDFLARE_ACCOUNT_ID") || setting("R2_ACCOUNT_ID") || "").trim();
const token = () => (setting("CLOUDFLARE_AI_TOKEN") || "").trim();
export const captionsOn = () => MOMENT_TIDY_LIVE && !!account() && !!token();

export type SpeechDeps = { transcribe: (wav: Uint8Array, lang: CaptionLang) => Promise<unknown> };

// The model takes the sound as base64 in JSON and answers { result: { text, words: [{ word, start, end }], … } }.
const realTranscribe: SpeechDeps["transcribe"] = async (wav, lang) => {
  const model = (setting("MOMENT_CAPTIONS_MODEL") || "").trim() || DEFAULT_MODEL;
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account()}/ai/run/${model}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json" },
    // Pidgin has no code of its own in the model; English is the nearest, with a hint of how it is written.
    body: JSON.stringify({ audio: Buffer.from(wav).toString("base64"), task: "transcribe", language: "en", vad_filter: true, ...(lang === "pcm" ? { initial_prompt: "Nigerian Pidgin: abeg, wetin, dey, na, no be, wahala, oga, sabi." } : {}) }),
    signal: AbortSignal.timeout(50_000),
  });
  const j = (await res.json().catch(() => null)) as { result?: unknown; success?: boolean } | null;
  if (!res.ok || !j || j.success === false) throw new Error(`speech service answered ${res.status}`);
  return j.result ?? j;
};
export const realSpeech = (): SpeechDeps => ({ transcribe: realTranscribe });

// A WAV file starts "RIFF", four bytes of size, then "WAVE".
export const looksLikeWav = (b: Uint8Array) => b.length > 44 && String.fromCharCode(b[0], b[1], b[2], b[3]) === "RIFF" && String.fromCharCode(b[8], b[9], b[10], b[11]) === "WAVE";
const dayKey = (d: Date) => new Date(d.getTime() + 3_600_000).toISOString().slice(0, 10); // Lagos

export async function captionPiece(db: Firestore, uid: string, wav: Uint8Array, lang: unknown, deps: SpeechDeps = realSpeech(), now = new Date(), on = captionsOn()): Promise<{ words: Word[] }> {
  if (!on) throw new MomentError(503, "Captions aren't switched on yet. You can still trim the pauses.");
  if (!looksLikeWav(wav)) throw new MomentError(400, "We couldn't read that sound.");
  if (wav.length > CAPTION_CHUNK_MAX_BYTES) throw new MomentError(413, "That piece of sound is too long.");
  const ref = db.doc(`momentCaptionUse/${uid}_${dayKey(now)}`);
  await db.runTransaction(async (t) => {
    const used = ((await t.get(ref)).data()?.count as number | undefined) ?? 0;
    if (used >= CAPTION_CHUNKS_PER_DAY) throw new MomentError(429, "You've reached today's limit for captions. Try again tomorrow, or share without them.");
    t.set(ref, { uid, day: dayKey(now), count: used + 1, expireAt: new Date(now.getTime() + 3 * 86_400_000) }, { merge: true });
  });
  let result: unknown;
  try { result = await deps.transcribe(wav, isCaptionLang(lang) ? lang : "en"); } catch (e) {
    console.error("[moment captions]", e instanceof Error ? e.message : e);
    await ref.update({ count: FieldValue.increment(-1) }).catch(() => {}); // a piece that failed isn't counted
    throw new MomentError(502, "Captions couldn't be written just now. Try again, or share without them.");
  }
  return { words: wordsFromSpeech(result) };
}
