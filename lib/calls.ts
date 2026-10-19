// One-to-one audio and video calls in Messages: free, phone to phone (WebRTC), only between two people who follow each other.
// The server sets a call up and records how it ended; the two browsers exchange the connection details through calls/{id} and connect
// directly (or through a relay when a network blocks direct connections). Nothing of the call itself passes through or is kept by us.
export type CallKind = "audio" | "video";
export type CallStatus = "ringing" | "accepted" | "declined" | "missed" | "ended" | "failed";
export type CallEnd = "declined" | "missed" | "ended" | "failed";
export const CALL_RING_MS = 45_000; // a call nobody answers stops ringing after this
export const CALL_STALE_MS = 60_000; // a ringing call older than this is ignored (the caller closed their app)
export const isCallKind = (k: unknown): k is CallKind => k === "audio" || k === "video";
export const isCallEnd = (k: unknown): k is CallEnd => k === "declined" || k === "missed" || k === "ended" || k === "failed";

export type CallDoc = {
  callerUid: string; calleeUid: string; kind: CallKind; status: CallStatus; cid: string;
  callerName: string; callerAvatar: string; calleeName: string; calleeAvatar: string;
  createdAt: string; acceptedAt?: string; endedAt?: string; endedBy?: string; seconds?: number;
  offer?: { type: string; sdp: string }; answer?: { type: string; sdp: string };
};

export type CallLog = { kind: CallKind; outcome: CallEnd; seconds: number };

export const duration = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
const noun = (k: CallKind) => (k === "video" ? "video call" : "voice call");
// "Voice call · 3:12", "Missed video call", "Declined voice call", "Video call didn't connect".
export function callLogText(l: CallLog): string {
  if (l.outcome === "missed") return `Missed ${noun(l.kind)}`;
  if (l.outcome === "declined") return `Declined ${noun(l.kind)}`;
  if (l.outcome === "failed" && !l.seconds) return `${l.kind === "video" ? "Video" : "Voice"} call didn't connect`;
  return `${l.kind === "video" ? "Video" : "Voice"} call · ${duration(l.seconds)}`;
}

// What the end of a call is recorded as: a call that was never answered is "missed" (or "declined" by the person called).
export function settleEnd(status: CallStatus, asked: CallEnd, byCallee: boolean): CallEnd {
  if (status === "ringing") return asked === "declined" && byCallee ? "declined" : asked === "failed" ? "failed" : "missed";
  return asked === "failed" ? "failed" : "ended";
}

// ── The safety code (like WhatsApp's): proof that a call is end to end encrypted ──
// Each browser makes a fresh encryption certificate for every call, and the call's audio and video are encrypted with it (DTLS-SRTP). The
// certificate's fingerprint travels in the offer and the answer, which pass through our database; someone who could change them could sit
// in the middle. So both people are shown a code made from both fingerprints: if the two screens show the same code, nobody is in between.
// The certificates are new for each call, so 12 digits can't be forged in the seconds a call takes to connect.

// "a=fingerprint:sha-256 AB:CD:…" → "SHA-256 AB:CD:…" (the first one in the description), or null.
export function sdpFingerprint(sdp: string | undefined | null): string | null {
  const m = /^a=fingerprint:(\S+)\s+([0-9A-Fa-f:]+)\s*$/m.exec(sdp ?? "");
  return m ? `${m[1].toUpperCase()} ${m[2].toUpperCase()}` : null;
}

// The same 12 digits on both phones, whichever side each fingerprint is ("482 913 207 551").
export async function safetyCode(a: string, b: string): Promise<string> {
  const bytes = new Uint8Array(await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode([a, b].sort().join("|"))));
  let n = BigInt(0);
  for (const x of bytes.slice(0, 8)) n = (n << BigInt(8)) + BigInt(x);
  return (n % BigInt(10 ** 12)).toString().padStart(12, "0").replace(/(\d{3})(?=\d)/g, "$1 ");
}
