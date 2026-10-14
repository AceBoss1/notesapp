import type { Firestore } from "firebase-admin/firestore";
import type { Status } from "./team";

// Work items the founder asked to be put on the team hub board, assigned to Engineering and Product & tech. Added once: each has a
// seedKey, and a seed never adds an item whose key is already on the board (teamSeeds/{name} records that a seed has run).
type Seed = { key: string; title: string; detail: string; status: Status; horizon: "today" | "week" | "later" };
const ENG = ["engineering", "product"];
export const ENGINEERING_BACKLOG: Seed[] = [
  { key: "eng-trim-reads", title: "Trim whole-collection Firestore reads (notes, users, etc.)", detail: "Replace full-collection reads with indexed queries, counts and cached summaries to cut Firestore costs.", status: "todo", horizon: "week" },
  { key: "eng-legal-drafts", title: "Legal draft set: counsel pack, fixed docs 1.2–3.2, equity plan, five-director consent", detail: "Word and PDF, logo on the first page. Drafts stay with the founder until counsel has reviewed them.", status: "todo", horizon: "week" },
  { key: "eng-follow-lists", title: "Follow lists, @na-notesapp control, online/last seen", detail: "Shipped.", status: "done", horizon: "later" },
  { key: "eng-library-hub", title: "Staff library + message hub, payment assignee/deadline, Payroll", detail: "Shipped.", status: "done", horizon: "later" },
  { key: "eng-msg-header", title: "Message header with avatar/menu; group avatar, send lock, bans, mute", detail: "Shipped.", status: "done", horizon: "later" },
  { key: "eng-calls", title: "Free 1:1 voice/video calls in Messages (WebRTC) + Notes Life plan scaffold", detail: "Shipped. Cloudflare TURN key still to be fixed (see /status).", status: "done", horizon: "later" },
  { key: "eng-wallet", title: "NotesApp Credit wallet: top-up, bonus, pay with wallet, activity, refunds", detail: "Shipped. Still to do: one real ₦1,000 top-up test.", status: "done", horizon: "later" },
  { key: "eng-life-playable", title: "Notes Life first playable: rules/catalogue, server economy, 3D scenes, UI, saves, docs", detail: "Shipped, with invites, NEPA, itel Energy, generators and residents.", status: "done", horizon: "later" },
  { key: "eng-life-sound", title: "Notes Life sound not heard on phone: fix audibility + test button", detail: "Sounds now use frequencies phone speakers can play, a compressor lifts them, and Settings has Test sound. Check on a real phone.", status: "doing", horizon: "today" },
  { key: "eng-pins-typing", title: "Messages: pin messages (max 3/chat), pin chats (max 3), typing indicator", detail: "Shipped.", status: "done", horizon: "later" },
  { key: "eng-edit-consent", title: "Edit/delete messages: free while unread, consent of reader once read; requests expire 30 days", detail: "Shipped. Requests are wiped by the daily cron after 30 days.", status: "done", horizon: "later" },
  { key: "eng-12h", title: "12-hour clock across the app", detail: "Shipped.", status: "done", horizon: "later" },
  { key: "eng-call-ringing", title: "Video call: drag/swap self view, front/back camera; ringing on installed app when closed", detail: "Shipped. Check on a phone with the app installed and notifications on.", status: "doing", horizon: "today" },
  { key: "eng-team-legal-library", title: "Team access: Legal & compliance; Staff library upload while adding + 👁 who opened it", detail: "Shipped.", status: "done", horizon: "later" },
];

export async function seedOnce(db: Firestore, name: string, items: Seed[], byUid: string, now = new Date()): Promise<number> {
  const mark = db.doc(`teamSeeds/${name}`);
  if ((await mark.get()).exists) return 0;
  const have = new Set((await db.collection("teamItems").where("seedKey", "in", items.map((i) => i.key).slice(0, 30)).get()).docs.map((d) => String(d.data().seedKey)));
  const at = now.toISOString();
  const batch = db.batch();
  let n = 0;
  for (const i of items) {
    if (have.has(i.key)) continue;
    batch.set(db.collection("teamItems").doc(), { title: i.title, detail: i.detail, ownerUid: "", depts: ENG, status: i.status, horizon: i.horizon, due: "", blockedReason: "", decisionQuestion: "", decidedNote: "", createdByUid: byUid, createdAt: at, updatedAt: at, doneAt: i.status === "done" ? at : "", seedKey: i.key });
    n++;
  }
  batch.set(mark, { at, byUid, count: n });
  await batch.commit();
  return n;
}
