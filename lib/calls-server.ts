import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { conversationId } from "./messages-rules";
import { MessageError } from "./messages-server";
import { notifyBell } from "./email";
import { sendPush, type PushPayload } from "./push-server";
import { callLogText, isCallKind, settleEnd, type CallDoc, type CallEnd, type CallKind } from "./calls";
import { setting } from "@/lib/config";
import { isAutoFollowed } from "./journals-directory";

export type CallDeps = { push: (uid: string, p: PushPayload) => Promise<number>; bell: typeof notifyBell };
const defaultDeps = (db: Firestore): CallDeps => ({ push: (uid, p) => sendPush(db, uid, p), bell: notifyBell });

// Address book for the two browsers: public STUN, plus a relay (TURN) when one is configured. Either set TURN_URLS (comma-separated),
// TURN_USERNAME and TURN_CREDENTIAL, or CLOUDFLARE_TURN_KEY_ID and CLOUDFLARE_TURN_API_TOKEN for short-lived Cloudflare relay credentials.
export async function iceServers(fetcher: typeof fetch = fetch): Promise<RTCIceServerLike[]> {
  const list: RTCIceServerLike[] = [{ urls: ["stun:stun.cloudflare.com:3478", "stun:stun.l.google.com:19302"] }];
  const urls = (setting("TURN_URLS") || "").split(",").map((u) => u.trim()).filter(Boolean);
  if (urls.length && setting("TURN_USERNAME") && setting("TURN_CREDENTIAL")) {
    list.push({ urls, username: setting("TURN_USERNAME"), credential: setting("TURN_CREDENTIAL") });
    return list;
  }
  const turn = await cloudflareTurn(fetcher);
  if (turn.server) list.push(turn.server);
  return list;
}
export type RTCIceServerLike = { urls: string | string[]; username?: string; credential?: string };

export const cloudflareTurnConfigured = () => !!((setting("CLOUDFLARE_TURN_KEY_ID") || "").trim() && (setting("CLOUDFLARE_TURN_API_TOKEN") || "").trim());

// Asks Cloudflare for short-lived TURN credentials (free; only relayed traffic is billed). On failure, why says what to fix in
// plain words for /status, never the key or token.
export async function cloudflareTurn(fetcher: typeof fetch = fetch, signal?: AbortSignal): Promise<{ server?: RTCIceServerLike; why?: string }> {
  const keyId = (setting("CLOUDFLARE_TURN_KEY_ID") || "").trim(), token = (setting("CLOUDFLARE_TURN_API_TOKEN") || "").trim();
  if (!keyId || !token) return { why: "not set up" };
  try {
    const r = await fetcher(`https://rtc.live.cloudflare.com/v1/turn/keys/${encodeURIComponent(keyId)}/credentials/generate`, {
      method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ ttl: 3600 }), signal, cache: "no-store",
    });
    const j = await r.json().catch(() => ({}));
    const s = j?.iceServers;
    if (r.ok && s?.urls && s.username && s.credential) return { server: { urls: s.urls, username: s.username, credential: s.credential } };
    const msg = String(j?.error ?? "").toLowerCase();
    if (msg.includes("cannot find") || r.status === 404) return { why: "Cloudflare can't find that TURN key: CLOUDFLARE_TURN_KEY_ID must be the Turn Token ID from Realtime → TURN Server" };
    if (r.status === 401 || r.status === 403) return { why: "Cloudflare refused the token: CLOUDFLARE_TURN_API_TOKEN must be the API token made with that same TURN key" };
    if (r.status >= 500) return { why: "Cloudflare's TURN service is having trouble" };
    return { why: `Cloudflare answered ${r.status}` };
  } catch {
    return { why: "could not reach Cloudflare in time" };
  }
}

async function person(db: Firestore, uid: string) {
  const u = (await db.doc(`users/${uid}`).get()).data();
  return u ? { uid, username: String(u.username ?? ""), name: String(u.displayName ?? "A member"), avatar: String(u.avatar ?? ""), suspended: u.suspended === true } : null;
}

// Free calls are for two people who follow each other and haven't blocked each other. A refusal never says which (so a block stays private).
export async function startCall(db: Firestore, callerUid: string, toUid: unknown, kind: unknown, now = new Date(), deps: CallDeps = defaultDeps(db)): Promise<{ id: string; cid: string }> {
  if (!isCallKind(kind)) throw new MessageError(400, "Choose a voice or video call.");
  const callee = String(toUid ?? "");
  if (!callee || callee === callerUid) throw new MessageError(400, "Choose someone to call.");
  const [me, them] = await Promise.all([person(db, callerUid), person(db, callee)]);
  if (!me || me.suspended) throw new MessageError(403, "Your account can't make calls right now.");
  if (!them || them.suspended) throw new MessageError(404, "That member wasn't found.");
  const [b1, b2, f1, f2] = await db.getAll(
    db.doc(`dmBlocks/${callee}_${callerUid}`), db.doc(`dmBlocks/${callerUid}_${callee}`),
    db.doc(`follows/${callerUid}_${them.username}`), db.doc(`follows/${callee}_${me.username}`),
  );
  if (b1.exists) throw new MessageError(404, "That member wasn't found.");
  if (b2.exists) throw new MessageError(403, "You've blocked this member. Unblock them to call.");
  if ((!f1.exists && !isAutoFollowed(them.username)) || (!f2.exists && !isAutoFollowed(me.username))) throw new MessageError(403, `Calls are for people who follow each other. You and ${them.name} need to follow each other first.`);
  const id = `${now.getTime()}_${randomBytes(5).toString("hex")}`;
  const cid = conversationId(callerUid, callee);
  const doc: CallDoc = { callerUid, calleeUid: callee, kind, status: "ringing", cid, callerName: me.name, callerAvatar: me.avatar, calleeName: them.name, calleeAvatar: them.avatar, createdAt: now.toISOString() };
  await db.doc(`calls/${id}`).set(doc);
  await deps.push(callee, { title: kind === "video" ? "Incoming video call" : "Incoming voice call", body: me.name, url: `/messages/${cid}?answer=${id}`, kind: "call", callId: id, token: ringToken(id), ttl: 45, urgency: "high" }).catch(() => 0);
  return { id, cid };
}

// Ends a call once (later calls are ignored) and writes a line into the conversation: "Voice call · 3:12", "Missed video call"…
export async function endCall(db: Firestore, uid: string, id: unknown, asked: unknown, now = new Date(), deps: CallDeps = defaultDeps(db)): Promise<{ outcome: CallEnd | null }> {
  const ref = db.doc(`calls/${String(id ?? "")}`);
  const res = await db.runTransaction(async (t) => {
    const s = await t.get(ref);
    const c = s.data() as CallDoc | undefined;
    if (!c || (c.callerUid !== uid && c.calleeUid !== uid)) throw new MessageError(404, "That call wasn't found.");
    if (c.status !== "ringing" && c.status !== "accepted") return null; // already over
    const outcome = settleEnd(c.status, (asked === "declined" || asked === "failed" || asked === "missed" ? asked : "ended") as CallEnd, uid === c.calleeUid);
    const seconds = c.status === "accepted" && c.acceptedAt ? Math.max(0, Math.round((now.getTime() - Date.parse(c.acceptedAt)) / 1000)) : 0;
    // The connection details the two devices swapped (they include network addresses) are only needed while the call is set up.
    t.update(ref, { status: outcome, endedAt: now.toISOString(), endedBy: uid, seconds, offer: FieldValue.delete(), answer: FieldValue.delete() });
    return { c, outcome, seconds };
  });
  if (!res) return { outcome: null };
  const { c, outcome, seconds } = res;
  if (res.c.status === "ringing") await deps.push(c.calleeUid, { title: "", body: "", url: "", kind: "call_end", callId: ref.id, ttl: 60, urgency: "high" }).catch(() => 0); // stops the ringing on their devices
  await clearCandidates(db, ref.id).catch(() => {});
  // The call line in the conversation (created if these two have never written to each other).
  const convRef = db.doc(`conversations/${c.cid}`);
  const text = `📞 ${callLogText({ kind: c.kind, outcome, seconds })}`;
  const at = now.toISOString();
  const messageId = `${String(now.getTime()).padStart(13, "0")}_${randomBytes(4).toString("hex")}`;
  const missed = outcome === "missed";
  await db.runTransaction(async (t) => {
    const conv = await t.get(convRef);
    if (!conv.exists) t.set(convRef, { participants: [c.callerUid, c.calleeUid].sort(), createdAt: at, unread: { [c.callerUid]: 0, [c.calleeUid]: 0 } });
    t.set(convRef.collection("messages").doc(messageId), { from: c.callerUid, text: "", call: { kind: c.kind, outcome, seconds }, createdAt: at });
    t.set(convRef, { lastMessage: { from: c.callerUid, text, at }, lastMessageAt: at, ...(missed ? { unread: { [c.calleeUid]: FieldValue.increment(1) } } : {}) }, { merge: true });
  });
  if (missed) {
    await deps.bell({ uid: c.calleeUid, type: "message", linkHref: `/messages/${c.cid}`, message: `Missed ${c.kind === "video" ? "video" : "voice"} call from ${c.callerName}` }).catch(() => {});
    await deps.push(c.calleeUid, { title: "Missed call", body: c.callerName, url: `/messages/${c.cid}` }).catch(() => 0);
  }
  return { outcome };
}

// The service worker answers a ringing notification's Decline (and checks whether it's still ringing) without a sign-in: it proves it got
// the push with this token, made from the call id and a server secret.
export function ringToken(id: string): string {
  const secret = setting("CALL_PUSH_SECRET") || setting("VAPID_PRIVATE_KEY") || "notesapp-call";
  return createHmac("sha256", secret).update(`ring:${id}`).digest("hex").slice(0, 32);
}
export const ringTokenOk = (id: string, token: unknown) => typeof token === "string" && token.length === 32 && timingSafeEqual(Buffer.from(token), Buffer.from(ringToken(id)));

// Removes both sides' connection candidates of a finished call (the rules stop new ones once it is over).
export async function clearCandidates(db: Firestore, id: string) {
  for (const sub of ["callerCandidates", "calleeCandidates"]) {
    const snap = await db.collection(`calls/${id}/${sub}`).limit(400).get();
    if (snap.empty) continue;
    const b = db.batch();
    snap.docs.forEach((d) => b.delete(d.ref));
    await b.commit();
  }
}

export type { CallKind };
