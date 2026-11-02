// "Writes like you": a short description of how a member writes, learnt from their own messages and journals and editable by them.
// Nana's drafts are written to it. Learning is plain counting (no AI, nothing leaves the server): spelling (British or American), how
// they greet and sign off, sentence length, warmth. The member can rewrite the description in their own words; their version wins
// until they ask Nana to learn again. Pure.

export type Voice = { text: string; signOff: string; samples: number; learnedAt: string; edited: boolean };
export const VOICE_MAX = 400;

const BRITISH = /\b(colour|favour|organis\w+|realis\w+|recognis\w+|centre|travelled|cancelled|programme|cheque|apologis\w+|behaviour|honour|labour|neighbour|whilst|licence)\b/gi;
const AMERICAN = /\b(color|favor|organiz\w+|realiz\w+|recogniz\w+|center|traveled|canceled|program|check|apologiz\w+|behavior|honor|labor|neighbor|license)\b/gi;
const WARM = /\b(thank(s| you)|please|well done|congrat\w*|happy|glad|lovely|great|wonderful|appreciate|cheers|God bless)\b|[!🙏😊❤️]/gi;
const GREET = /^(hi|hello|hey|good (morning|afternoon|evening)|dear)\b/i;

const count = (re: RegExp, s: string) => (s.match(re) || []).length;

// The last short line of a message, when it looks like a sign-off ("Adaeze", "— Ada", "Best, Ada").
function signOffOf(text: string): string {
  const lines = text.trim().split(/\n+/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return "";
  const last = lines[lines.length - 1].replace(/^[-–—~]\s*/, "");
  return /^[A-Z][\p{L}'’-]{1,20}( [A-Z][\p{L}'’-]{1,20})?$/u.test(last) ? last : "";
}

export function learnVoice(samples: string[], now = new Date()): Voice {
  const texts = samples.map((s) => String(s ?? "").trim()).filter((s) => s.length >= 12).slice(0, 200);
  const all = texts.join("\n");
  const words = all.split(/\s+/).filter(Boolean).length;
  const sentences = Math.max(1, (all.match(/[.!?](\s|$)/g) || []).length);
  const avg = words / sentences;
  const uk = count(BRITISH, all), us = count(AMERICAN, all);
  const warmth = count(WARM, all) / Math.max(1, texts.length);
  const greets = texts.filter((t) => GREET.test(t)).length / Math.max(1, texts.length);
  const signs = texts.map(signOffOf).filter(Boolean);
  const top = Object.entries(signs.reduce<Record<string, number>>((m, s) => ((m[s] = (m[s] ?? 0) + 1), m), {})).sort((a, b) => b[1] - a[1])[0];
  const signOff = top && top[1] >= 2 ? top[0] : "";
  const traits = [
    warmth >= 1 ? "Warm" : warmth >= 0.4 ? "Friendly" : "Matter-of-fact",
    avg <= 14 ? "direct" : avg <= 22 ? "clear" : "detailed",
    uk > us ? "British spelling" : us > uk ? "American spelling" : "",
    greets >= 0.5 ? "opens with a greeting" : "",
    signOff ? `signs off "${signOff}"` : "",
  ].filter(Boolean);
  const text = texts.length
    ? `${traits.join(", ")}. Learnt from ${texts.length} of your messages and journals.`
    : "Not learnt yet: Nana writes plainly and politely until she has read a few of your messages and journals.";
  return { text, signOff, samples: texts.length, learnedAt: now.toISOString(), edited: false };
}

// The member's own words win; kept short and free of control characters.
export function editVoice(prev: Voice | undefined, text: unknown, now = new Date()): Voice {
  const t = String(text ?? "").replace(/[\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim().slice(0, VOICE_MAX);
  return { text: t || (prev?.text ?? ""), signOff: prev?.signOff ?? "", samples: prev?.samples ?? 0, learnedAt: now.toISOString(), edited: true };
}
