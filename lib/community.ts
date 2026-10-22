// Community for organisations, churches, NGOs, schools and clubs (docs/COMMUNITY.md has the owner's decisions of 19 and 20 Oct 2026).
// Pure: names, limits, roles and what each can do, what a visitor sees, and cleaning what admins send. The server side is
// lib/community-server.ts; events are lib/events.ts.
//
// A community is communities/{id} (the id is its address: /c/<id>). Members are communityMembers/{id}_{uid}, posts
// communityPosts, comments communityComments, likes communityLikes/{postId}_{uid}. All server-only in firestore.rules: pages read through
// /api/community, which shows each person what their role allows.

export const COMMUNITY_LIVE = true;
// Free communities hold this many members; Business has no limit and adds private Circles.
export const COMMUNITY_FREE_MEMBERS = 200;
// Shown on a community until who runs it is verified (any account can start one).
export const UNVERIFIED_COMMUNITY_NOTICE = "This community hasn't been verified yet — #NotesApp has not confirmed who runs it.";

// Each part with a page of its own (/community/<page>, lib/community-features.ts) links to it.
export const COMMUNITY_PARTS = [
  { id: "general", page: "general", name: "General", blurb: "Every member is in it. An announcement channel: your admins post, members like, comment and share." },
  { id: "spaces", page: "spaces", name: "Spaces", blurb: "Public: posts anyone can read, on your profile and in Explore. Members only: posts only your members can see, never in Explore, search, share previews or the Weekly Digest." },
  { id: "circles", page: "circles", name: "Circles", blurb: "Private group chats your admins set up inside the community — the choir, the youth, ushers, the board — up to 50 people each, with group calls. On Business." },
  { id: "audio-rooms", page: "audio-rooms", name: "Audio rooms", blurb: "Live talks like Clubhouse: the host and up to 4 speakers on stage, members listening, raising hands and typing in the room's chat. Nothing recorded." },
  { id: "events", page: "events", name: "Events", blurb: "Services, meetings, outreaches and programmes, with Going and Interested, reminders, repeating events and a Join live link." },
  { id: "members", page: "", name: "Members", blurb: "Open to anyone, by approval or by invite link, with join questions (\"Which branch?\"). Owner, admins, moderators and members; the member list is for members only and never shows phone numbers." },
] as const;

export const COMMUNITY_PHASES = [
  { n: "1", title: "Community, Spaces and Events", body: "Members and roles, public and members-only Spaces, the General announcement channel, private Circles of up to 50 people on Business, Events for every account, and Join live links to YouTube Live, Facebook Live, Zoom or Google Meet." },
  { n: "2", title: "Bigger rooms, giving and tickets", body: "Circles with no member limit, giving (offerings, tithes and campaigns with a goal), and paid event tickets with check-in at the door." },
  { n: "3", title: "Our own live streaming, then group meetings", body: "Go live from your phone or studio and stream to your members on #NotesApp, with the replay kept in your members-only Space (a paid add-on). Then group video meetings." },
] as const;

// ---- Roles ----
export const ROLES = ["member", "moderator", "admin", "owner"] as const;
export type Role = (typeof ROLES)[number];
export const isRole = (v: unknown): v is Role => ROLES.includes(v as Role);
const RANK: Record<Role, number> = { member: 0, moderator: 1, admin: 2, owner: 3 };
export const atLeast = (role: Role | null | undefined, min: Role) => !!role && RANK[role] >= RANK[min];
export const roleName = (r: string) => ({ member: "Member", moderator: "Moderator", admin: "Admin", owner: "Owner" } as Record<string, string>)[r] ?? r;

// What each role may do (Facebook-group admin tools, made simpler): moderators keep order, admins run the community, the owner owns it.
export type Action =
  | "post_general" | "post_space" | "comment" | "pin" | "remove_post" | "approve" | "remove_member" | "ban" | "set_role" | "settings"
  | "events" | "circles" | "insights" | "invite" | "view_as" | "rooms";
const NEEDS: Record<Action, Role> = {
  post_general: "admin", post_space: "member", comment: "member", pin: "moderator", remove_post: "moderator", approve: "moderator",
  remove_member: "moderator", ban: "moderator", set_role: "admin", settings: "admin", events: "admin", circles: "admin", insights: "admin",
  invite: "member", view_as: "admin", rooms: "moderator", // audio rooms (lib/rooms.ts): moderators and up host them
};
export const can = (role: Role | null | undefined, action: Action) => atLeast(role, NEEDS[action]);
// Acting on another member: only on someone below you (an admin can't remove another admin; only the owner can), never on the owner.
export const canActOn = (me: Role | null | undefined, them: Role) => !!me && them !== "owner" && RANK[me] > RANK[them];
// Who may give which role: admins make moderators and members; only the owner makes admins (and there is one owner).
export const canGiveRole = (me: Role | null | undefined, to: Role) => to !== "owner" && (me === "owner" || (me === "admin" && RANK[to] < RANK.admin));

// ---- Settings ----
export const JOIN_MODES = [
  { id: "open", label: "Anyone can join" },
  { id: "approval", label: "Anyone can ask; an admin or moderator approves" },
  { id: "invite", label: "Only with an invite link" },
] as const;
export type JoinMode = (typeof JOIN_MODES)[number]["id"];
// Discoverable: shown in the directory, Explore and Trending. A community joined "only with an invite link" stays private: only its
// members see it listed.
export const isDiscoverable = (c: { joinMode: JoinMode }) => c.joinMode !== "invite";
// Trending communities: activity in the window. A new member counts most, then a post, then a comment.
export const trendScore = (a: { posts: number; comments: number; joined: number }) => a.joined * 4 + a.posts * 3 + a.comments * 2;
// What people who aren't members see (the admins choose; the home page, with the name, picture and a short description, always shows).
export type PublicView = { general: boolean; about: boolean; contact: boolean; events: boolean; members: boolean; join: boolean };
export const DEFAULT_PUBLIC: PublicView = { general: true, about: true, contact: true, events: true, members: false, join: true };
export const SLOW_MODES = [0, 30, 60, 300, 900, 3600] as const; // seconds between one member's comments or posts; 0 = off
export type Space = { id: string; name: string; visibility: "public" | "members"; whoPosts: "members" | "admins" };
export const SPACES_MAX = 20, QUESTIONS_MAX = 5;

export type Community = {
  id: string; name: string; ownerUid: string; tagline: string; about: string; contact: string; avatar: string; cover: string;
  joinMode: JoinMode; questions: string[]; publicView: PublicView; slowModeSec: number; spaces: Space[];
  inviteCode: string; memberCount: number; verified: boolean; createdAt: string; updatedAt?: string;
};

const t = (v: unknown, max: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
const para = (v: unknown, max: number) => String(v ?? "").replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim().slice(0, max);
const img = (v: unknown) => { const s = t(v, 600); return /^https:\/\/[^\s"'<>]+$/i.test(s) ? s : ""; };
// The address: lower-case letters, numbers and dashes. Some words are kept for our own pages.
const RESERVED = new Set(["new", "edit", "admin", "api", "events", "settings", "about", "help", "notesapp", "community", "communities", "join", "invite"]);
export function cleanSlug(v: unknown): string {
  const s = String(v ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
  return s.length >= 3 && !RESERVED.has(s) ? s : "";
}
export const cleanSpaceName = (v: unknown) => t(v, 40);
export function cleanSpaces(v: unknown): Space[] {
  const seen = new Set<string>();
  return (Array.isArray(v) ? v : []).slice(0, SPACES_MAX).map((x) => {
    const o = (x && typeof x === "object" ? x : {}) as Record<string, unknown>;
    const name = cleanSpaceName(o.name);
    const id = cleanSlug(o.id || name) || "";
    if (!name || !id || id === "general" || seen.has(id)) return null;
    seen.add(id);
    return { id, name, visibility: o.visibility === "members" ? "members" : "public", whoPosts: o.whoPosts === "admins" ? "admins" : "members" } as Space;
  }).filter((x): x is Space => !!x);
}
export function cleanPublicView(v: unknown): PublicView {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const b = (k: keyof PublicView) => (typeof o[k] === "boolean" ? (o[k] as boolean) : DEFAULT_PUBLIC[k]);
  return { general: b("general"), about: b("about"), contact: b("contact"), events: b("events"), members: b("members"), join: b("join") };
}
// What admins can change (the server keeps the id, owner, counts, invite code and verification).
export function cleanSettings(v: unknown) {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const name = t(o.name, 60);
  return {
    ...(o.name !== undefined ? { name } : {}),
    ...(o.tagline !== undefined ? { tagline: t(o.tagline, 140) } : {}),
    ...(o.about !== undefined ? { about: para(o.about, 4000) } : {}),
    ...(o.contact !== undefined ? { contact: para(o.contact, 1000) } : {}),
    ...(o.avatar !== undefined ? { avatar: img(o.avatar) } : {}),
    ...(o.cover !== undefined ? { cover: img(o.cover) } : {}),
    ...(o.joinMode !== undefined ? { joinMode: (JOIN_MODES.some((m) => m.id === o.joinMode) ? o.joinMode : "open") as JoinMode } : {}),
    ...(o.questions !== undefined ? { questions: (Array.isArray(o.questions) ? o.questions : []).map((q) => t(q, 200)).filter(Boolean).slice(0, QUESTIONS_MAX) } : {}),
    ...(o.publicView !== undefined ? { publicView: cleanPublicView(o.publicView) } : {}),
    ...(o.slowModeSec !== undefined ? { slowModeSec: SLOW_MODES.includes(Number(o.slowModeSec) as (typeof SLOW_MODES)[number]) ? Number(o.slowModeSec) : 0 } : {}),
    ...(o.spaces !== undefined ? { spaces: cleanSpaces(o.spaces) } : {}),
  };
}
export const memberLimit = (ownerTier: string) => (ownerTier === "business" || ownerTier === "enterprise" ? Infinity : COMMUNITY_FREE_MEMBERS);
export const circlesAllowed = (ownerTier: string) => ownerTier === "business" || ownerTier === "enterprise";

// ---- What a visitor sees ----
// The role the page is shown for: the viewer's own, or (for admins) the one they chose in "View as". A view never shows more than the
// viewer may see. null = not a member (signed out, not joined, waiting for approval or banned).
export type ViewAs = "nonmember" | "member" | "moderator" | "admin";
export function effectiveRole(real: Role | null, asked: unknown): Role | null {
  if (!can(real, "view_as") || typeof asked !== "string") return real;
  const want: Role | null = asked === "nonmember" ? null : isRole(asked) ? asked : real;
  if (want === null) return null;
  return RANK[want] <= RANK[real!] ? want : real;
}
export type Tab = "home" | "general" | "spaces" | "events" | "members" | "about" | "contact" | "circles" | "admin";
export function tabsFor(c: Pick<Community, "publicView" | "about" | "contact">, role: Role | null): Tab[] {
  const member = !!role;
  const tabs: Tab[] = ["home"];
  if (member || c.publicView.general) tabs.push("general");
  tabs.push("spaces");
  if (member || c.publicView.events) tabs.push("events");
  if (member || c.publicView.members) tabs.push("members");
  if ((member || c.publicView.about) && c.about) tabs.push("about");
  if ((member || c.publicView.contact) && c.contact) tabs.push("contact");
  if (member) tabs.push("circles");
  if (can(role, "settings") || can(role, "approve")) tabs.push("admin");
  return tabs;
}
// Which channels (General and Spaces) a viewer can read.
export function readableChannels(c: Pick<Community, "publicView" | "spaces">, role: Role | null): string[] {
  const member = !!role;
  return [...(member || c.publicView.general ? ["general"] : []), ...c.spaces.filter((s) => member || s.visibility === "public").map((s) => s.id)];
}
export function canPostIn(c: Pick<Community, "spaces">, role: Role | null, channel: string): boolean {
  if (channel === "general") return can(role, "post_general");
  const s = c.spaces.find((x) => x.id === channel);
  return !!s && (s.whoPosts === "admins" ? can(role, "settings") : can(role, "post_space"));
}
// Slow mode: how long a member still has to wait before commenting or posting again (moderators and above are never slowed).
export function slowWait(role: Role | null, lastAt: string | undefined, slowModeSec: number, now: Date): number {
  if (!slowModeSec || atLeast(role, "moderator") || !lastAt) return 0;
  const left = Math.ceil((new Date(lastAt).getTime() + slowModeSec * 1000 - now.getTime()) / 1000);
  return left > 0 ? left : 0;
}
// A members-only post never leaves the community (Explore, search, previews, the sitemap, the digest, Nana, MCP).
export const isPublicPost = (c: Pick<Community, "publicView" | "spaces">, channel: string) =>
  channel === "general" ? c.publicView.general : c.spaces.some((s) => s.id === channel && s.visibility === "public");

// ---- Posts ----
export const POST_MAX = 5000, COMMENT_MAX = 1000;
export function cleanPost(v: unknown): { text: string; image: string } | null {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const text = para(o.text, POST_MAX), image = img(o.image);
  return text || image ? { text, image } : null;
}
export const cleanComment = (v: unknown) => para(v, COMMENT_MAX);
export const cleanAnswers = (v: unknown, questions: string[]) => questions.map((_, i) => t(Array.isArray(v) ? v[i] : "", 300));
