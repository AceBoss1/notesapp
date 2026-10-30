import type { Firestore } from "firebase-admin/firestore";
import { FieldValue } from "firebase-admin/firestore";
import { randomBytes } from "crypto";
import { effectiveTier, type UserProfile } from "./users";
import { orgVerified } from "./org";
import { notifyBell } from "./email";
import { GROUP_MEMBERS_MAX } from "./messages-rules";
import { DEFAULT_FUNDS, UNVERIFIED_GIFT_CAP_KOBO } from "./giving";
import { isDiscoverable, trendScore,
  DEFAULT_PUBLIC, UNVERIFIED_COMMUNITY_NOTICE, atLeast, can, canActOn, canGiveRole, canPostIn, circlesAllowed, cleanAnswers, cleanComment,
  cleanPost, cleanSettings, cleanSlug, effectiveRole, isPublicPost, isRole, memberLimit, readableChannels, roleName, slowWait, tabsFor,
  type Community, type Role,
} from "./community";

// Communities on the server (the rules are lib/community.ts). Every read and write comes through here, so each person sees and does only
// what their role allows; firestore.rules keeps the collections server-only.
export class CommunityError extends Error { constructor(public status: number, message: string) { super(message); } }

export type Member = { cid: string; uid: string; username: string; displayName: string; avatar: string; role: Role; status: "active" | "pending" | "banned"; answers?: string[]; joinedAt: string; lastPostAt?: string };
export type Post = { id: string; cid: string; channel: string; authorUid: string; authorName: string; authorUsername: string; authorAvatar: string; text: string; image: string; pinned: boolean; likes: number; comments: number; public: boolean; createdAt: string };
export type Comment = { id: string; postId: string; cid: string; authorUid: string; authorName: string; authorUsername: string; authorAvatar?: string; text: string; createdAt: string };

const MAX_OWNED = 5;
const userOf = async (db: Firestore, uid: string) => (await db.doc(`users/${uid}`).get()).data() as UserProfile | undefined;
const tierOf = (p: UserProfile) => effectiveTier({ username: p.username ?? "", role: p.role ?? "reader", accountTier: p.accountTier ?? "standard" });
const isVerified = (p: UserProfile | undefined) => !!p && (orgVerified(p) || p.verified === true || !!p.goldBadge);
// A community counts as verified when #NotesApp verified it (communities/{id}.verified) or the account that owns it is: an organisation
// whose registration is confirmed (org.rcStatus "verified"), a verified account, or a gold badge. Giving is capped until then.
export async function communityVerified(db: Firestore, c: Pick<Community, "verified" | "ownerUid">): Promise<boolean> {
  return !!c.verified || isVerified(await userOf(db, c.ownerUid));
}

export async function readCommunity(db: Firestore, cid: string): Promise<Community> {
  const c = (await db.doc(`communities/${cid}`).get()).data() as Community | undefined;
  if (!c) throw new CommunityError(404, "That community wasn't found.");
  return { ...c, id: cid, publicView: { ...DEFAULT_PUBLIC, ...(c.publicView ?? {}) }, spaces: c.spaces ?? [], questions: c.questions ?? [] };
}
const memberRef = (db: Firestore, cid: string, uid: string) => db.doc(`communityMembers/${cid}_${uid}`);
export async function memberOf(db: Firestore, cid: string, uid: string | null): Promise<Member | null> {
  if (!uid) return null;
  return ((await memberRef(db, cid, uid).get()).data() as Member | undefined) ?? null;
}
export const activeRole = (m: Member | null): Role | null => (m && m.status === "active" ? m.role : null);
async function actor(db: Firestore, cid: string, uid: string): Promise<{ c: Community; me: Member; role: Role }> {
  const [c, me] = await Promise.all([readCommunity(db, cid), memberOf(db, cid, uid)]);
  if (!me || me.status !== "active") throw new CommunityError(403, "Join the community first.");
  return { c, me, role: me.role };
}

// ---- Starting one ----
export async function createCommunity(db: Firestore, uid: string, raw: { name?: unknown; id?: unknown; tagline?: unknown; about?: unknown }, now = new Date()): Promise<Community> {
  const p = await userOf(db, uid);
  if (!p) throw new CommunityError(404, "Your account wasn't found.");
  if (p.suspended) throw new CommunityError(403, "Your account can't do that right now.");
  const s = cleanSettings({ name: raw.name, tagline: raw.tagline, about: raw.about });
  if (!s.name || s.name.length < 3) throw new CommunityError(400, "Give the community a name (3 letters or more).");
  const id = cleanSlug(raw.id || s.name);
  if (!id) throw new CommunityError(400, "Choose an address with letters and numbers, 3 or more (for example grace-chapel-lekki).");
  const owned = await db.collection("communities").where("ownerUid", "==", uid).get();
  if (owned.size >= MAX_OWNED) throw new CommunityError(409, `You can run up to ${MAX_OWNED} communities.`);
  const at = now.toISOString();
  const c: Community = {
    id, name: s.name, ownerUid: uid, tagline: s.tagline ?? "", about: s.about ?? "", contact: "", avatar: p.avatar ?? "", cover: "",
    joinMode: "open", questions: [], publicView: DEFAULT_PUBLIC, slowModeSec: 0, spaces: [{ id: "updates", name: "Updates", visibility: "public", whoPosts: "admins" }, { id: "members", name: "Members' corner", visibility: "members", whoPosts: "members" }],
    inviteCode: randomBytes(6).toString("base64url"), memberCount: 1, verified: isVerified(p), createdAt: at,
  };
  await db.runTransaction(async (t) => {
    if ((await t.get(db.doc(`communities/${id}`))).exists) throw new CommunityError(409, "That address is taken. Try another.");
    t.set(db.doc(`communities/${id}`), c);
    t.set(memberRef(db, id, uid), { cid: id, uid, username: p.username ?? "", displayName: p.displayName ?? "", avatar: p.avatar ?? "", role: "owner", status: "active", joinedAt: at } satisfies Member);
  });
  return c;
}

// ---- What a viewer gets ----
export async function viewCommunity(db: Firestore, cid: string, viewerUid: string | null, asked?: unknown) {
  const c = await readCommunity(db, cid);
  const me = await memberOf(db, cid, viewerUid);
  const real = activeRole(me);
  const role = effectiveRole(real, asked);
  const owner = await userOf(db, c.ownerUid);
  const member = !!role;
  return {
    community: {
      id: c.id, name: c.name, tagline: c.tagline, avatar: c.avatar, cover: c.cover, joinMode: c.joinMode, questions: c.questions,
      memberCount: c.memberCount, verified: c.verified || isVerified(owner), slowModeSec: c.slowModeSec, spaces: c.spaces.filter((s) => member || s.visibility === "public"),
      about: member || c.publicView.about ? c.about : "", contact: member || c.publicView.contact ? c.contact : "",
      ownerName: owner?.displayName ?? "", ownerUsername: owner?.username ?? "",
      ...(can(role, "settings") ? { publicView: c.publicView, allSpaces: c.spaces } : {}),
      ...(can(role, "invite") ? { inviteCode: c.inviteCode } : {}),
      circlesAllowed: circlesAllowed(owner ? tierOf(owner) : "standard"),
      memberLimit: Number.isFinite(memberLimit(owner ? tierOf(owner) : "standard")) ? memberLimit(owner ? tierOf(owner) : "standard") : null,
    },
    notice: c.verified || isVerified(owner) ? "" : UNVERIFIED_COMMUNITY_NOTICE,
    // Giving (lib/giving.ts): who may give (members, and signed-in visitors when the community is discoverable), the funds, and the cap
    // on each gift until the community is verified. Admins also get the settings.
    giving: c.giving?.enabled ? {
      funds: c.giving.funds?.length ? c.giving.funds : DEFAULT_FUNDS,
      capKobo: c.verified || isVerified(owner) ? null : UNVERIFIED_GIFT_CAP_KOBO,
      canGive: !!viewerUid && me?.status !== "banned" && (!!real || isDiscoverable(c)),
    } : null,
    ...(can(role, "giving") ? { givingSettings: { enabled: !!c.giving?.enabled, funds: c.giving?.funds?.length ? c.giving.funds : DEFAULT_FUNDS } } : {}),
    role, realRole: real, status: me?.status ?? null, viewingAs: role !== real,
    tabs: tabsFor(c, role),
    channels: readableChannels(c, role).map((id) => ({ id, name: id === "general" ? "General" : c.spaces.find((s) => s.id === id)!.name, canPost: canPostIn(c, role, id) })),
    canJoin: !real && me?.status !== "banned" && me?.status !== "pending" && (c.publicView.join || c.joinMode === "invite"),
  };
}

// ---- Settings ----
export async function updateSettings(db: Firestore, uid: string, cid: string, raw: unknown, now = new Date()) {
  const { role } = await actor(db, cid, uid);
  if (!can(role, "settings")) throw new CommunityError(403, "Only admins can change the community's settings.");
  const s = cleanSettings(raw);
  if (s.name !== undefined && s.name.length < 3) throw new CommunityError(400, "The name needs 3 letters or more.");
  await db.doc(`communities/${cid}`).update({ ...s, updatedAt: now.toISOString() });
  return readCommunity(db, cid);
}
export async function rotateInvite(db: Firestore, uid: string, cid: string) {
  const { role } = await actor(db, cid, uid);
  if (!can(role, "settings")) throw new CommunityError(403, "Only admins can change the invite link.");
  const inviteCode = randomBytes(6).toString("base64url");
  await db.doc(`communities/${cid}`).update({ inviteCode });
  return inviteCode;
}

// ---- Joining and leaving ----
async function adminsOf(db: Firestore, cid: string): Promise<Member[]> {
  const snap = await db.collection("communityMembers").where("cid", "==", cid).where("status", "==", "active").get();
  return snap.docs.map((d) => d.data() as Member).filter((m) => atLeast(m.role, "moderator"));
}
export async function join(db: Firestore, uid: string, cid: string, raw: { answers?: unknown; invite?: unknown }, now = new Date()): Promise<Member> {
  const [c, p, cur] = await Promise.all([readCommunity(db, cid), userOf(db, uid), memberOf(db, cid, uid)]);
  if (!p || p.suspended) throw new CommunityError(403, "Your account can't do that right now.");
  if (cur?.status === "active") return cur;
  if (cur?.status === "banned") throw new CommunityError(403, "You can't join this community.");
  if (cur?.status === "pending") return cur;
  const invited = typeof raw.invite === "string" && raw.invite === c.inviteCode;
  if (c.joinMode === "invite" && !invited) throw new CommunityError(403, "This community is by invitation. Ask a member for the invite link.");
  const owner = await userOf(db, c.ownerUid);
  const limit = memberLimit(owner ? tierOf(owner) : "standard");
  const answers = cleanAnswers(raw.answers, c.questions);
  if (c.joinMode === "approval" && !invited && c.questions.length && answers.some((a) => !a)) throw new CommunityError(400, "Answer the questions to ask to join.");
  const status: Member["status"] = c.joinMode === "approval" && !invited ? "pending" : "active";
  const m: Member = { cid, uid, username: p.username ?? "", displayName: p.displayName ?? "", avatar: p.avatar ?? "", role: "member", status, ...(c.questions.length ? { answers } : {}), joinedAt: now.toISOString() };
  await db.runTransaction(async (t) => {
    const cref = db.doc(`communities/${cid}`);
    const count = Number((await t.get(cref)).data()?.memberCount ?? 0);
    if (status === "active" && count >= limit) throw new CommunityError(409, `This community is full (${limit} members on the free plan). Its admins can move to Business for no limit.`);
    t.set(memberRef(db, cid, uid), m);
    if (status === "active") t.update(cref, { memberCount: FieldValue.increment(1) });
  });
  if (status === "pending") {
    for (const a of (await adminsOf(db, cid)).slice(0, 20)) await notifyBell({ uid: a.uid, type: "community", linkHref: `/c/${cid}?tab=admin`, message: `${m.displayName} asked to join ${c.name}.` }).catch(() => {});
  }
  return m;
}
export async function leave(db: Firestore, uid: string, cid: string) {
  const me = await memberOf(db, cid, uid);
  if (!me) return;
  if (me.role === "owner") throw new CommunityError(409, "You own this community. Give it to another admin first.");
  const batch = db.batch();
  batch.delete(memberRef(db, cid, uid));
  if (me.status === "active") batch.update(db.doc(`communities/${cid}`), { memberCount: FieldValue.increment(-1) });
  await batch.commit();
  await leaveCircles(db, cid, uid);
}
// Out of the community, out of its Circles: a private chat is for members only.
async function leaveCircles(db: Firestore, cid: string, uid: string) {
  const snap = await db.collection("conversations").where("communityId", "==", cid).get();
  const mine = snap.docs.filter((d) => ((d.data().participants as string[] | undefined) ?? []).includes(uid));
  if (!mine.length) return;
  const { syncMembers } = await import("./groups-server");
  for (const d of mine) {
    const keep = (d.data().participants as string[]).filter((u) => u !== uid);
    if (keep.length) await syncMembers(db, d.id, keep); else await d.ref.update({ participants: [], adminUids: [] });
  }
}
// Approving or declining a request to join.
export async function decide(db: Firestore, uid: string, cid: string, targetUid: string, approve: boolean, now = new Date()) {
  const { c, role } = await actor(db, cid, uid);
  if (!can(role, "approve")) throw new CommunityError(403, "Only admins and moderators can approve members.");
  const ref = memberRef(db, cid, targetUid);
  if (!approve) {
    const m = (await ref.get()).data() as Member | undefined;
    if (m?.status === "pending") await ref.delete();
    return;
  }
  const owner = await userOf(db, c.ownerUid);
  const limit = memberLimit(owner ? tierOf(owner) : "standard");
  await db.runTransaction(async (t) => {
    const m = (await t.get(ref)).data() as Member | undefined;
    if (!m || m.status !== "pending") return;
    const count = Number((await t.get(db.doc(`communities/${cid}`))).data()?.memberCount ?? 0);
    if (count >= limit) throw new CommunityError(409, `The community is full (${limit} members on the free plan).`);
    t.update(ref, { status: "active", joinedAt: now.toISOString() });
    t.update(db.doc(`communities/${cid}`), { memberCount: FieldValue.increment(1) });
  });
  await notifyBell({ uid: targetUid, type: "community", linkHref: `/c/${cid}`, message: `You're in: welcome to ${c.name}.` }).catch(() => {});
}
export async function setRole(db: Firestore, uid: string, cid: string, targetUid: string, to: unknown) {
  const { role } = await actor(db, cid, uid);
  if (!isRole(to) || !canGiveRole(role, to)) throw new CommunityError(403, "You can't give that role.");
  const them = await memberOf(db, cid, targetUid);
  if (!them || them.status !== "active") throw new CommunityError(404, "That member wasn't found.");
  if (!canActOn(role, them.role) && !(role === "owner" && them.role !== "owner")) throw new CommunityError(403, "You can't change that member's role.");
  await memberRef(db, cid, targetUid).update({ role: to });
}
// Removing someone (they can ask or be invited again) or banning them (they can't come back until unbanned).
export async function removeMember(db: Firestore, uid: string, cid: string, targetUid: string, ban: boolean) {
  const { role } = await actor(db, cid, uid);
  if (!can(role, ban ? "ban" : "remove_member")) throw new CommunityError(403, "Only admins and moderators can do that.");
  const them = await memberOf(db, cid, targetUid);
  if (!them) { if (ban) await memberRef(db, cid, targetUid).set({ cid, uid: targetUid, username: "", displayName: "", avatar: "", role: "member", status: "banned", joinedAt: new Date().toISOString() }); return; }
  if (!canActOn(role, them.role)) throw new CommunityError(403, `You can't remove ${roleName(them.role).toLowerCase()}s.`);
  const batch = db.batch();
  if (ban) batch.update(memberRef(db, cid, targetUid), { status: "banned", role: "member" }); else batch.delete(memberRef(db, cid, targetUid));
  if (them.status === "active") batch.update(db.doc(`communities/${cid}`), { memberCount: FieldValue.increment(-1) });
  await batch.commit();
  await leaveCircles(db, cid, targetUid);
}
export async function unban(db: Firestore, uid: string, cid: string, targetUid: string) {
  const { role } = await actor(db, cid, uid);
  if (!can(role, "ban")) throw new CommunityError(403, "Only admins and moderators can do that.");
  const them = await memberOf(db, cid, targetUid);
  if (them?.status === "banned") await memberRef(db, cid, targetUid).delete();
}
// Members (active, by role then name), and for moderators and above the requests and the banned.
export async function listMembers(db: Firestore, viewerUid: string | null, cid: string, asked: unknown, status: "active" | "pending" | "banned" = "active") {
  const c = await readCommunity(db, cid);
  const role = effectiveRole(activeRole(await memberOf(db, cid, viewerUid)), asked);
  if (status === "active" ? !(role || c.publicView.members) : !can(role, "approve")) throw new CommunityError(403, "Members only.");
  const snap = await db.collection("communityMembers").where("cid", "==", cid).where("status", "==", status).limit(2000).get();
  const order = { owner: 0, admin: 1, moderator: 2, member: 3 } as Record<string, number>;
  return snap.docs.map((d) => d.data() as Member)
    .sort((a, b) => order[a.role] - order[b.role] || a.displayName.localeCompare(b.displayName))
    .map((m) => ({ uid: m.uid, username: m.username, displayName: m.displayName, avatar: m.avatar, role: m.role, joinedAt: m.joinedAt, ...(status === "pending" ? { answers: m.answers ?? [] } : {}) }));
}

// ---- Posts, comments and likes ----
export async function listPosts(db: Firestore, viewerUid: string | null, cid: string, channel: string, asked: unknown): Promise<{ posts: (Post & { liked: boolean })[] }> {
  const c = await readCommunity(db, cid);
  const role = effectiveRole(activeRole(await memberOf(db, cid, viewerUid)), asked);
  if (!readableChannels(c, role).includes(channel)) throw new CommunityError(403, "Members only.");
  const q = db.collection("communityPosts").where("cid", "==", cid).where("channel", "==", channel);
  let docs;
  try { docs = (await q.orderBy("createdAt", "desc").limit(100).get()).docs; }
  catch (e) { if ((e as { code?: number }).code !== 9) throw e; docs = (await q.get()).docs.sort((a, b) => String(b.data().createdAt).localeCompare(String(a.data().createdAt))).slice(0, 100); }
  const posts = docs.map((d) => ({ ...(d.data() as Post), id: d.id }));
  const liked = viewerUid && posts.length ? await db.getAll(...posts.map((p) => db.doc(`communityLikes/${p.id}_${viewerUid}`))) : [];
  return { posts: posts.map((p, i) => ({ ...p, liked: !!liked[i]?.exists })).sort((a, b) => Number(b.pinned) - Number(a.pinned)) };
}
export async function createPost(db: Firestore, uid: string, cid: string, channel: string, raw: unknown, now = new Date()): Promise<Post> {
  const { c, me, role } = await actor(db, cid, uid);
  if (!canPostIn(c, role, channel)) throw new CommunityError(403, channel === "general" ? "Only admins post in General; members react and comment." : "Only admins post in this Space.");
  const wait = slowWait(role, me.lastPostAt, c.slowModeSec, now);
  if (wait) throw new CommunityError(429, `Slow mode is on: you can post again in ${wait < 60 ? `${wait} seconds` : `${Math.ceil(wait / 60)} minutes`}.`);
  const body = cleanPost(raw);
  if (!body) throw new CommunityError(400, "Write something, or add a picture.");
  const ref = db.collection("communityPosts").doc();
  const post: Post = { id: ref.id, cid, channel, authorUid: uid, authorName: me.displayName, authorUsername: me.username, authorAvatar: me.avatar, ...body, pinned: false, likes: 0, comments: 0, public: isPublicPost(c, channel), createdAt: now.toISOString() };
  const batch = db.batch();
  batch.set(ref, post);
  batch.update(memberRef(db, cid, uid), { lastPostAt: post.createdAt });
  await batch.commit();
  // An announcement in General: every member's bell (in batches, the first 2,000).
  if (channel === "general") {
    const members = await db.collection("communityMembers").where("cid", "==", cid).where("status", "==", "active").limit(2000).get();
    const text = body.text ? body.text.slice(0, 90) : "a picture";
    for (const d of members.docs) if (d.data().uid !== uid) await notifyBell({ uid: d.data().uid, type: "community", linkHref: `/c/${cid}?tab=general`, message: `${c.name}: ${text}` }).catch(() => {});
  }
  return post;
}
async function postOf(db: Firestore, postId: string): Promise<Post> {
  const p = (await db.doc(`communityPosts/${postId}`).get()).data() as Post | undefined;
  if (!p) throw new CommunityError(404, "That post wasn't found.");
  return { ...p, id: postId };
}
export async function removePost(db: Firestore, uid: string, postId: string) {
  const p = await postOf(db, postId);
  const { role } = await actor(db, p.cid, uid);
  if (p.authorUid !== uid && !can(role, "remove_post")) throw new CommunityError(403, "Only the author, moderators and admins can remove a post.");
  const comments = await db.collection("communityComments").where("postId", "==", postId).get();
  const batch = db.batch();
  batch.delete(db.doc(`communityPosts/${postId}`));
  comments.docs.slice(0, 450).forEach((d) => batch.delete(d.ref));
  await batch.commit();
}
export async function pinPost(db: Firestore, uid: string, postId: string, pinned: boolean) {
  const p = await postOf(db, postId);
  const { role } = await actor(db, p.cid, uid);
  if (!can(role, "pin")) throw new CommunityError(403, "Only moderators and admins can pin posts.");
  await db.doc(`communityPosts/${postId}`).update({ pinned });
}
export async function like(db: Firestore, uid: string, postId: string, on: boolean) {
  const p = await postOf(db, postId);
  await actor(db, p.cid, uid);
  const ref = db.doc(`communityLikes/${postId}_${uid}`);
  await db.runTransaction(async (t) => {
    const had = (await t.get(ref)).exists;
    if (had === on) return;
    if (on) t.set(ref, { postId, uid, cid: p.cid }); else t.delete(ref);
    t.update(db.doc(`communityPosts/${postId}`), { likes: FieldValue.increment(on ? 1 : -1) });
  });
}
export async function listComments(db: Firestore, viewerUid: string | null, postId: string, asked: unknown): Promise<Comment[]> {
  const p = await postOf(db, postId);
  const c = await readCommunity(db, p.cid);
  const role = effectiveRole(activeRole(await memberOf(db, p.cid, viewerUid)), asked);
  if (!readableChannels(c, role).includes(p.channel)) throw new CommunityError(403, "Members only.");
  const snap = await db.collection("communityComments").where("postId", "==", postId).limit(300).get();
  return snap.docs.map((d) => ({ ...(d.data() as Comment), id: d.id })).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}
export async function addComment(db: Firestore, uid: string, postId: string, raw: unknown, now = new Date()): Promise<Comment> {
  const p = await postOf(db, postId);
  const { c, me, role } = await actor(db, p.cid, uid);
  if (!can(role, "comment")) throw new CommunityError(403, "Members only.");
  const wait = slowWait(role, me.lastPostAt, c.slowModeSec, now);
  if (wait) throw new CommunityError(429, `Slow mode is on: you can comment again in ${wait < 60 ? `${wait} seconds` : `${Math.ceil(wait / 60)} minutes`}.`);
  const text = cleanComment(raw);
  if (!text) throw new CommunityError(400, "Write a comment.");
  const ref = db.collection("communityComments").doc();
  const cm: Comment = { id: ref.id, postId, cid: p.cid, authorUid: uid, authorName: me.displayName, authorUsername: me.username, authorAvatar: me.avatar ?? "", text, createdAt: now.toISOString() };
  const batch = db.batch();
  batch.set(ref, cm);
  batch.update(db.doc(`communityPosts/${postId}`), { comments: FieldValue.increment(1) });
  batch.update(memberRef(db, p.cid, uid), { lastPostAt: cm.createdAt });
  await batch.commit();
  if (p.authorUid !== uid) await notifyBell({ uid: p.authorUid, type: "community", linkHref: `/c/${p.cid}?post=${postId}`, message: `${me.displayName} commented on your post in ${c.name}.` }).catch(() => {});
  return cm;
}
export async function removeComment(db: Firestore, uid: string, commentId: string) {
  const cm = (await db.doc(`communityComments/${commentId}`).get()).data() as Comment | undefined;
  if (!cm) return;
  const { role } = await actor(db, cm.cid, uid);
  if (cm.authorUid !== uid && !can(role, "remove_post")) throw new CommunityError(403, "Only the author, moderators and admins can remove a comment.");
  const batch = db.batch();
  batch.delete(db.doc(`communityComments/${commentId}`));
  batch.update(db.doc(`communityPosts/${cm.postId}`), { comments: FieldValue.increment(-1) });
  await batch.commit();
}

// ---- Circles: private rooms inside the community, each a group chat (Business; up to 50 people, the group-chat limit) ----
export async function listCircles(db: Firestore, uid: string, cid: string) {
  const { role } = await actor(db, cid, uid);
  const snap = await db.collection("conversations").where("communityId", "==", cid).get();
  return snap.docs.map((d) => ({ id: d.id, title: String(d.data().title ?? ""), members: (d.data().participants as string[]).length, mine: (d.data().participants as string[]).includes(uid) }))
    .filter((x) => x.mine || can(role, "circles"));
}
export async function createCircle(db: Firestore, uid: string, cid: string, raw: { title?: unknown; memberUids?: unknown }, now = new Date()) {
  const { c, role } = await actor(db, cid, uid);
  if (!can(role, "circles")) throw new CommunityError(403, "Only admins set up Circles.");
  const owner = await userOf(db, c.ownerUid);
  if (!circlesAllowed(owner ? tierOf(owner) : "standard")) throw new CommunityError(402, "Circles come with Business.");
  const title = String(raw.title ?? "").replace(/\s+/g, " ").trim().slice(0, 60);
  if (title.length < 2) throw new CommunityError(400, "Give the Circle a name.");
  const wanted = Array.from(new Set((Array.isArray(raw.memberUids) ? raw.memberUids : []).map(String).filter((u) => u && u !== uid)));
  if (wanted.length + 1 > GROUP_MEMBERS_MAX) throw new CommunityError(413, `A Circle can have up to ${GROUP_MEMBERS_MAX} people for now.`);
  // Only members of this community.
  const docs = wanted.length ? await db.getAll(...wanted.map((u) => memberRef(db, cid, u))) : [];
  const members = docs.filter((d) => d.exists && (d.data() as Member).status === "active").map((d) => (d.data() as Member).uid);
  const everyone = [uid, ...members];
  const at = now.toISOString();
  const ref = db.collection("conversations").doc(`circle_${cid}_${randomBytes(5).toString("hex")}`);
  await ref.set({ kind: "group", scope: "public", communityId: cid, title, participants: everyone, adminUids: [uid], createdBy: uid, createdAt: at, lastMessageAt: at, unread: Object.fromEntries(everyone.map((u) => [u, 0])) });
  return { id: ref.id, title, members: everyone.length };
}
// Adding or removing people in a Circle (community admins).
export async function setCircleMembers(db: Firestore, uid: string, cid: string, circleId: string, memberUids: unknown) {
  const { role } = await actor(db, cid, uid);
  if (!can(role, "circles")) throw new CommunityError(403, "Only admins manage Circles.");
  const ref = db.doc(`conversations/${circleId}`);
  const conv = (await ref.get()).data();
  if (!conv || conv.communityId !== cid) throw new CommunityError(404, "That Circle wasn't found.");
  const wanted = Array.from(new Set((Array.isArray(memberUids) ? memberUids : []).map(String)));
  if (wanted.length > GROUP_MEMBERS_MAX) throw new CommunityError(413, `A Circle can have up to ${GROUP_MEMBERS_MAX} people for now.`);
  const docs = wanted.length ? await db.getAll(...wanted.map((u) => memberRef(db, cid, u))) : [];
  const keep = docs.filter((d) => d.exists && (d.data() as Member).status === "active").map((d) => (d.data() as Member).uid);
  if (!keep.length) throw new CommunityError(400, "A Circle needs at least one person.");
  const { syncMembers } = await import("./groups-server");
  await syncMembers(db, circleId, keep);
}

// The communities someone runs (owner or admin), for "Your site" (link one to the site) and anywhere else that needs them.
export async function communitiesIRun(db: Firestore, uid: string) {
  const mine = await db.collection("communityMembers").where("uid", "==", uid).get();
  const run = mine.docs.map((d) => d.data() as Member).filter((m) => m.status === "active" && (m.role === "owner" || m.role === "admin"));
  if (!run.length) return [];
  const docs = await db.getAll(...run.map((m) => db.doc(`communities/${m.cid}`)));
  return docs.filter((d) => d.exists).map((d) => {
    const c = d.data() as Community;
    return { id: d.id, name: c.name, avatar: c.avatar, memberCount: c.memberCount, role: run.find((m) => m.cid === d.id)!.role };
  });
}

// ---- Insights (admins) ----
export async function insights(db: Firestore, uid: string, cid: string, now = new Date()) {
  const { c, role } = await actor(db, cid, uid);
  if (!can(role, "insights")) throw new CommunityError(403, "Only admins see insights.");
  const [members, posts, comments] = await Promise.all([
    db.collection("communityMembers").where("cid", "==", cid).limit(5000).get(),
    db.collection("communityPosts").where("cid", "==", cid).limit(5000).get(),
    db.collection("communityComments").where("cid", "==", cid).limit(20000).get(),
  ]);
  const since = (days: number) => new Date(now.getTime() - days * 86_400_000).toISOString();
  const ms = members.docs.map((d) => d.data() as Member);
  const active = ms.filter((m) => m.status === "active");
  const ps = posts.docs.map((d) => d.data() as Post), cs = comments.docs.map((d) => d.data() as Comment);
  const by = new Map<string, number>();
  for (const x of [...ps.filter((p) => p.createdAt >= since(30)), ...cs.filter((x) => x.createdAt >= since(30))]) by.set(x.authorName, (by.get(x.authorName) ?? 0) + 1);
  return {
    members: active.length, pending: ms.filter((m) => m.status === "pending").length, banned: ms.filter((m) => m.status === "banned").length,
    joined7: active.filter((m) => m.joinedAt >= since(7)).length, joined30: active.filter((m) => m.joinedAt >= since(30)).length,
    posts30: ps.filter((p) => p.createdAt >= since(30)).length, comments30: cs.filter((x) => x.createdAt >= since(30)).length,
    activeMembers30: new Set([...ps, ...cs].filter((x) => x.createdAt >= since(30)).map((x) => x.authorUid)).size,
    topContributors: [...by.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, n]) => ({ name, n })),
    name: c.name,
  };
}

// ---- Directory ----
export async function directory(db: Firestore, viewerUid: string | null) {
  const all = await db.collection("communities").orderBy("memberCount", "desc").limit(60).get().catch(() => db.collection("communities").limit(60).get());
  const mine = viewerUid ? await db.collection("communityMembers").where("uid", "==", viewerUid).get() : null;
  const myIds = new Map((mine?.docs ?? []).map((d) => [String(d.data().cid), String(d.data().status)]));
  // Invite-only communities are private: listed only for their own members.
  return all.docs.filter((d) => isDiscoverable(d.data() as Community) || myIds.has(d.id)).map((d) => {
    const c = d.data() as Community;
    return { id: d.id, name: c.name, tagline: c.tagline, avatar: c.avatar, memberCount: c.memberCount, verified: !!c.verified, joinMode: c.joinMode, status: myIds.get(d.id) ?? null };
  });
}

// Trending communities (Trending → Communities): the discoverable ones with the most going on in the last `days` days, by new members,
// posts and comments (lib/community.ts trendScore). Each query is on one field, so no extra index is needed.
export async function trendingCommunities(db: Firestore, days: number, now = new Date()) {
  const d = [1, 7, 30].includes(days) ? days : 7;
  const since = new Date(now.getTime() - d * 86_400_000).toISOString();
  const [posts, comments, joined] = await Promise.all([
    db.collection("communityPosts").where("createdAt", ">=", since).limit(3000).get(),
    db.collection("communityComments").where("createdAt", ">=", since).limit(5000).get(),
    db.collection("communityMembers").where("joinedAt", ">=", since).limit(5000).get(),
  ]);
  const act = new Map<string, { posts: number; comments: number; joined: number }>();
  const add = (cid: unknown, k: "posts" | "comments" | "joined") => { const id = String(cid ?? ""); if (!id) return; const a = act.get(id) ?? { posts: 0, comments: 0, joined: 0 }; a[k]++; act.set(id, a); };
  posts.docs.forEach((x) => add(x.data().cid, "posts"));
  comments.docs.forEach((x) => add(x.data().cid, "comments"));
  joined.docs.forEach((x) => { const m = x.data(); if (m.status === "active" && m.role !== "owner") add(m.cid, "joined"); });
  const ids = [...act.keys()];
  const snaps = ids.length ? await db.getAll(...ids.slice(0, 300).map((id) => db.doc(`communities/${id}`))) : [];
  return snaps.filter((x) => x.exists && isDiscoverable(x.data() as Community)).map((x) => {
    const c = x.data() as Community, a = act.get(x.id)!;
    return { id: x.id, name: c.name, tagline: c.tagline, avatar: c.avatar, memberCount: c.memberCount, verified: !!c.verified, joinMode: c.joinMode, ...a, score: trendScore(a) };
  }).sort((a, b) => b.score - a.score || b.memberCount - a.memberCount).slice(0, 30);
}
