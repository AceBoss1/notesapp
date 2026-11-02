// Young members (docs/YOUNG_MEMBERS.md): the age rules shared by teen mode, kids mode and turning 18. Pure, client-safe.
// We keep a birth month and year only (never the day), on the server, never shown: enough to know when someone turns 13 or 18.
// A birthday counts from the first of its month.

export const TEEN_FROM = 13;
export const ADULT_AT = 18;

export class YoungError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}

export const isBirth = (b: unknown): b is string => typeof b === "string" && /^(19|20)\d{2}-(0[1-9]|1[0-2])$/.test(b);

// Age in whole years on a date (YYYY-MM-DD), from a birth month (YYYY-MM).
export function ageOn(birth: string, day: string): number {
  const [by, bm] = birth.split("-").map(Number), [y, m] = day.split("-").map(Number);
  return y - by - (m < bm ? 1 : 0);
}

// The first day of the month someone turns `age`.
export const turnsOn = (birth: string, age: number) => `${Number(birth.slice(0, 4)) + age}-${birth.slice(5, 7)}-01`;

export function cleanBirth(month: unknown, year: unknown): string {
  const m = Number(month), y = Number(year);
  if (!Number.isInteger(m) || m < 1 || m > 12 || !Number.isInteger(y) || y < 1900 || y > 2100) throw new YoungError("Choose the month and year you were born.");
  return `${y}-${String(m).padStart(2, "0")}`;
}

// Teen mode is for 13 to 17. Under 13, a parent sets up a child profile on their own account; 18 or over, it isn't needed.
export function teenBirth(month: unknown, year: unknown, today: string): string {
  const b = cleanBirth(month, year);
  const age = ageOn(b, today);
  if (age >= ADULT_AT) throw new YoungError("You're 18 or older, so teen mode isn't needed. You can use everything as you are.");
  if (age < TEEN_FROM) throw new YoungError("Under 13, a parent or guardian needs to set you up from their own NotesApp account, as a child profile.");
  return b;
}

export const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// ── Turning 18 (the graduation flow) ─────────────────────────────────────────────────────────────────────────────────────────────
// On their 18th birthday a teen gets a one-time screen. Everything stays as it was in teen mode until they switch it on; whatever
// they leave off is kept as a protection of their own (the keep* flags on users/{uid}), so nothing opens up without their say.
export const graduationDue = (birth: string | undefined | null, today: string) => !!birth && isBirth(birth) && ageOn(birth, today) >= ADULT_AT;
export type GraduationChoice = { search: boolean; messages: boolean; replies: boolean; realName: boolean; offers: boolean };
export const CHOICE_LABEL: Record<keyof GraduationChoice, string> = {
  search: "Show me in people search and the directory",
  messages: "Messages and group invites from anyone, not only people I follow",
  replies: "Replies and moments open to everyone, not only people I follow",
  realName: "My real name on the Exam Prep board, not my nickname",
  offers: "NotesApp's weekly digest, newsletters and offers",
};
export function cleanChoice(b: Record<string, unknown>): GraduationChoice {
  if (b.consent !== true) throw new YoungError("Agree to the Terms and Privacy Policy yourself to make the account yours.");
  return { search: b.search === true, messages: b.messages === true, replies: b.replies === true, realName: b.realName === true, offers: b.offers === true };
}
// What each choice left off keeps on the account.
export const keepFlags = (c: GraduationChoice) => ({ keepHidden: !c.search, keepDmFollowers: !c.messages, keepRepliesFollowers: !c.replies });

// ── Teen mode on Moments and Notes Life (v0.121.0) ──────────────────────────────────────────────────────────────────────────────
// The same rule as replies on journals (teenGate in lib/comments-server.ts): a teen hears only from people they follow. On turning
// 18 a member may keep it (users.keepRepliesFollowers). Kids' profiles carry teen: true too, so they're covered the same way.
export type YoungFlags = { teen?: unknown; keepRepliesFollowers?: unknown; [k: string]: unknown } | null | undefined;
export const hearsOnlyFromFollowed = (u: YoungFlags) => u?.teen === true || u?.keepRepliesFollowers === true;

// May `from` reply to, or @mention, this member? Always themselves; anyone, unless the member is protected; then only if the
// member follows them.
export const mayReach = (o: { target: YoungFlags; self: boolean; targetFollowsThem: boolean }) =>
  o.self || !hearsOnlyFromFollowed(o.target) || o.targetFollowsThem;

// Who sees a protected member's moments (and their row on the Notes Life Billionaires List): themselves, and people they follow
// back (both ways), the audience teen mode has had since v0.83.0. Never anyone signed out.
export const teenAudience = (o: { signedIn: boolean; self: boolean; viewerFollows: boolean; followsViewer: boolean }) =>
  o.signedIn && (o.self || (o.viewerFollows && o.followsViewer));

// A protected member's moment stays with their own audience: nobody can reshare it onto a ring that other people see.
export const mayReshare = (rootOwner: YoungFlags) => !hearsOnlyFromFollowed(rootOwner);

// The friendly words for the person who was stopped.
export const firstName = (u: { displayName?: unknown; username?: unknown } | null | undefined, fallback = "This member") =>
  String(u?.displayName || u?.username || fallback).split(" ")[0];
export const REPLY_BLOCKED = (name: string) => `Only people ${name} follows can reply to their moments. You can still like it.`;
export const MENTION_BLOCKED = (username: string) => `@${username} only hears from people they follow, so they can't be mentioned here. Take out the mention and share it again.`;
export const RESHARE_BLOCKED = "This moment stays with the people its owner follows back, so it can't be reshared.";

// Notes Life lists (the Billionaires List, the friends who joined from your invite link). Teen mode keeps a member out of people
// search and the directory (serverPublicUsers in lib/users.ts), and so does keepHidden after 18: the same goes for these lists.
export type ListFlags = { teen?: unknown; keepHidden?: unknown; [k: string]: unknown } | null | undefined;
export const keptOffLists = (u: ListFlags) => u?.teen === true || u?.keepHidden === true;

// A row on the Billionaires List: shown to the player themselves, and for a member kept off lists, to people they follow back.
export const lifeRowShown = (o: { user: ListFlags; self: boolean; viewerFollows: boolean; followsViewer: boolean }) =>
  !keptOffLists(o.user) || teenAudience({ signedIn: true, self: o.self, viewerFollows: o.viewerFollows, followsViewer: o.followsViewer });

// A friend who joined from your invite link and is kept off lists shows without their name, picture or account id unless they
// follow you (your invite still counts). `key` stands in for the id, so the list still has one per row.
export const TEEN_INVITEE = "A friend in teen mode";
export function inviteeShown<T extends { uid: string; username: string; name: string; avatar: string }>(row: T, invitee: ListFlags, followsInviter: boolean, key: string): T {
  return !keptOffLists(invitee) || followsInviter ? row : { ...row, uid: key, username: "", name: TEEN_INVITEE, avatar: "" };
}
