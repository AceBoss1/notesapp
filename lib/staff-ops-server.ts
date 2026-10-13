import type { Firestore } from "firebase-admin/firestore";
import { FieldValue } from "firebase-admin/firestore";
import type { Access } from "./admin-access";
import { safeFileName } from "./private-files";
import { notifyBell, sendEmail } from "./email";
import { listTeamPeople, type Person } from "./team-server";
import {
  FILE_MAX_BYTES, MAX_FILES, StaffOpsError, canEditDocs, canOpenAttachments, canSeeDoc, canSeeMessage, checkFile, cleanDoc, cleanMessage, extOf, FILE_TYPES,
  type DocInput, type HubInput, type HubMessage, type StaffDoc, type StaffFile,
} from "./staff-ops";

// Server side of the staff library (staffDocs) and the message hub (hubMessages). Both are server-only collections; only signed-in staff reach
// them, through /api/admin/staff-library and /api/admin/hub. Files live in the private bucket (staff/<doc id>/..., hub/<message id>/...).
export type Me = { uid: string; email: string; name: string; access: Access | null };
const DOCS = "staffDocs", MSGS = "hubMessages";
const need = (cond: boolean, msg: string, status = 403) => { if (!cond) throw new StaffOpsError(msg, status); };

export type Presign = (key: string, type: string, size: number) => Promise<string>;
export type Head = (key: string) => Promise<{ size: number } | null>;
export type Sign = (key: string, name: string) => Promise<string>;

const toDoc = (id: string, d: FirebaseFirestore.DocumentData): StaffDoc => ({ ...(d as Omit<StaffDoc, "id">), id, files: d.files ?? [], receivers: d.receivers ?? [], ackedBy: d.ackedBy ?? {}, archived: d.archived === true });
const toMsg = (id: string, d: FirebaseFirestore.DocumentData): HubMessage => ({ ...(d as Omit<HubMessage, "id">), id, to: d.to ?? [], cc: d.cc ?? [], attachments: d.attachments ?? [], readBy: d.readBy ?? {}, emailed: d.emailed ?? 0 });

// Names for the ids on a page.
async function nameMap(db: Firestore): Promise<Record<string, string>> {
  return Object.fromEntries((await listTeamPeople(db)).map((p) => [p.uid, p.name]));
}

// ------------------------------------------------------------------ library

export async function listDocs(db: Firestore, me: Me, includeArchived = false): Promise<{ docs: (StaffDoc & { acked: boolean; ackCount: number })[]; canEdit: boolean; people: { uid: string; name: string }[]; names: Record<string, string> }> {
  need(!!me.access, "The staff library is for staff.");
  const snap = await db.collection(DOCS).get();
  const docs = snap.docs.map((d) => toDoc(d.id, d.data()))
    .filter((d) => canSeeDoc(d, me) && (includeArchived || !d.archived))
    .sort((a, b) => a.title.localeCompare(b.title))
    // Everyone sees whether they have confirmed; who else has is for the people who maintain the library (ackStatus).
    .map((d) => ({ ...d, acked: !!d.ackedBy[me.uid], ackCount: Object.keys(d.ackedBy).length, ackedBy: {} }));
  const names = await nameMap(db);
  return { docs, canEdit: canEditDocs(me.access), people: Object.entries(names).map(([uid, name]) => ({ uid, name })), names };
}

export async function createDoc(db: Firestore, me: Me, input: DocInput, now = new Date()): Promise<StaffDoc> {
  need(canEditDocs(me.access), "Only super admins, customer care and product can add to the library.");
  const clean = cleanDoc(input);
  await assertStaff(db, clean.receivers);
  const ref = db.collection(DOCS).doc();
  const doc = { ...clean, version: 1, files: [], ackedBy: {}, archived: false, createdAt: now.toISOString(), createdByUid: me.uid, createdByName: me.name, updatedAt: now.toISOString() };
  await ref.set(doc);
  if (clean.scope === "personal") await tellReceivers(clean.receivers, me, `${me.name} added a personal document for you: ${clean.title}`);
  return toDoc(ref.id, doc);
}

// Edits the details. `newVersion: true` bumps the version and clears the acknowledgements, so everyone reads the new one.
export async function updateDoc(db: Firestore, me: Me, id: unknown, input: DocInput & { newVersion?: unknown; archived?: unknown }, now = new Date()): Promise<void> {
  need(canEditDocs(me.access), "Only super admins, customer care and product can change the library.");
  const ref = db.collection(DOCS).doc(String(id));
  const s = await ref.get();
  need(s.exists, "That document wasn't found.", 404);
  const cur = toDoc(s.id, s.data()!);
  if (input.archived !== undefined && Object.keys(input).length === 1) { await ref.update({ archived: input.archived === true, updatedAt: now.toISOString() }); return; }
  const clean = cleanDoc({ title: input.title ?? cur.title, category: input.category ?? cur.category, description: input.description ?? cur.description, scope: input.scope ?? cur.scope, dept: input.dept ?? cur.dept, receivers: input.receivers ?? cur.receivers, requiresAck: input.requiresAck ?? cur.requiresAck });
  await assertStaff(db, clean.receivers);
  const bump = input.newVersion === true;
  await ref.update({ ...clean, dept: clean.dept ?? FieldValue.delete(), ...(bump ? { version: cur.version + 1, ackedBy: {} } : {}), updatedAt: now.toISOString() });
  if (bump && clean.requiresAck) await tellScope(db, { ...cur, ...clean }, me, `${clean.title} has a new version (v${cur.version + 1}). Please read it and confirm.`);
}

export async function acknowledge(db: Firestore, me: Me, id: unknown, now = new Date()): Promise<void> {
  const ref = db.collection(DOCS).doc(String(id));
  const s = await ref.get();
  need(s.exists, "That document wasn't found.", 404);
  const d = toDoc(s.id, s.data()!);
  need(canSeeDoc(d, me), "You can't open that document.");
  need(d.requiresAck, "That document doesn't need a confirmation.", 400);
  await ref.update({ [`ackedBy.${me.uid}`]: now.toISOString() });
}

// People who still haven't confirmed a document: for the people who maintain the library.
export async function ackStatus(db: Firestore, me: Me, id: unknown): Promise<{ read: { uid: string; name: string; at: string }[]; waiting: { uid: string; name: string }[] }> {
  need(canEditDocs(me.access), "Only the people who maintain the library can see who has confirmed.");
  const s = await db.collection(DOCS).doc(String(id)).get();
  need(s.exists, "That document wasn't found.", 404);
  const d = toDoc(s.id, s.data()!);
  const people = await listTeamPeople(db);
  const audience = people.filter((p) => canSeeDoc(d, { uid: p.uid, access: accessOfPerson(p) }));
  return {
    read: audience.filter((p) => d.ackedBy[p.uid]).map((p) => ({ uid: p.uid, name: p.name, at: d.ackedBy[p.uid] })),
    waiting: audience.filter((p) => !d.ackedBy[p.uid]).map((p) => ({ uid: p.uid, name: p.name })),
  };
}
// Enough of an Access to test a department or "everyone": listTeamPeople gives departments; a person without any is an admin with none.
const accessOfPerson = (p: Person): Access => ({ role: "admin", depts: (p.depts ?? []) as Access["depts"] });

export async function startDocFile(db: Firestore, me: Me, id: string, file: { name?: unknown; size?: unknown }, presign: Presign, now = new Date()) {
  need(canEditDocs(me.access), "Only the people who maintain the library can add files.");
  const s = await db.collection(DOCS).doc(String(id)).get();
  need(s.exists, "That document wasn't found.", 404);
  need((s.data()!.files ?? []).length < MAX_FILES, `A document can hold ${MAX_FILES} files.`, 400);
  const f = checkFile(file);
  const key = `staff/${s.id}/${now.getTime()}-${safeFileName(f.name)}`;
  return { key, contentType: f.type, uploadUrl: await presign(key, f.type, f.size) };
}

export async function attachDocFile(db: Firestore, me: Me, id: string, file: { key?: unknown; name?: unknown }, head: Head): Promise<void> {
  need(canEditDocs(me.access), "Only the people who maintain the library can add files.");
  const key = String(file.key ?? "");
  need(key.startsWith(`staff/${id}/`) && !key.includes(".."), "That file doesn't belong to this document.", 400);
  const type = FILE_TYPES[extOf(key)];
  need(!!type, "That file type isn't allowed.", 400);
  const obj = await head(key);
  need(!!obj, "The upload didn't arrive. Try again.", 400);
  need(obj!.size <= FILE_MAX_BYTES, "That file is too large.", 400);
  const ref = db.collection(DOCS).doc(String(id));
  await db.runTransaction(async (t) => {
    const s = await t.get(ref);
    need(s.exists, "That document wasn't found.", 404);
    const files: StaffFile[] = s.data()!.files ?? [];
    need(files.length < MAX_FILES, `A document can hold ${MAX_FILES} files.`, 400);
    need(!files.some((f) => f.key === key), "Already attached.", 400);
    t.update(ref, { files: [...files, { key, name: String(file.name ?? "").slice(0, 120) || "file", type, size: obj!.size }] });
  });
}

export async function docFileLink(db: Firestore, me: Me, id: string, index: number, sign: Sign): Promise<{ url: string; name: string }> {
  const s = await db.collection(DOCS).doc(String(id)).get();
  need(s.exists, "That document wasn't found.", 404);
  const d = toDoc(s.id, s.data()!);
  need(canSeeDoc(d, me), "You can't open that document.");
  const f = d.files[index];
  need(!!f, "That file wasn't found.", 404);
  return { url: await sign(f.key, f.name), name: f.name };
}

export async function removeDocFile(db: Firestore, me: Me, id: string, index: number): Promise<void> {
  need(canEditDocs(me.access), "Only the people who maintain the library can remove files.");
  const ref = db.collection(DOCS).doc(String(id));
  const s = await ref.get();
  need(s.exists, "That document wasn't found.", 404);
  const files: StaffFile[] = s.data()!.files ?? [];
  need(!!files[index], "That file wasn't found.", 404);
  await ref.update({ files: files.filter((_, i) => i !== index), updatedAt: new Date().toISOString() });
}

// ------------------------------------------------------------------ message hub

async function assertStaff(db: Firestore, uids: string[]) {
  if (!uids.length) return;
  const known = new Set((await listTeamPeople(db)).map((p) => p.uid));
  need(uids.every((u) => known.has(u)), "Choose people from the team.", 400);
}
async function tellReceivers(uids: string[], me: Me, message: string) {
  await Promise.all(uids.filter((u) => u !== me.uid).map((uid) => notifyBell({ uid, type: "team", linkHref: "/admin/team/library", message }).catch(() => {})));
}
async function tellScope(db: Firestore, d: Pick<StaffDoc, "scope" | "dept" | "receivers" | "createdByUid">, me: Me, message: string) {
  const people = await listTeamPeople(db);
  const to = people.filter((p) => canSeeDoc(d as StaffDoc, { uid: p.uid, access: accessOfPerson(p) }));
  await tellReceivers(to.map((p) => p.uid), me, message);
}

export type HubList = { messages: (HubMessage & { unread: boolean; canOpenFiles: boolean; box: "inbox" | "cc" | "sent" })[]; people: { uid: string; name: string }[]; names: Record<string, string>; unread: number };

export async function listHub(db: Firestore, me: Me): Promise<HubList> {
  need(!!me.access, "The message hub is for staff.");
  const [a, b, c] = await Promise.all([
    db.collection(MSGS).where("to", "array-contains", me.uid).get(),
    db.collection(MSGS).where("cc", "array-contains", me.uid).get(),
    db.collection(MSGS).where("fromUid", "==", me.uid).get(),
  ]);
  const seen = new Map<string, HubMessage>();
  [...a.docs, ...b.docs, ...c.docs].forEach((d) => seen.set(d.id, toMsg(d.id, d.data())));
  const names = await nameMap(db);
  const messages = Array.from(seen.values()).sort((x, y) => y.createdAt.localeCompare(x.createdAt)).slice(0, 150).map((m) => ({
    ...m, readBy: {}, unread: m.fromUid !== me.uid && !m.readBy[me.uid], canOpenFiles: canOpenAttachments(m, me.uid),
    box: (m.fromUid === me.uid ? "sent" : m.to.includes(me.uid) ? "inbox" : "cc") as "inbox" | "cc" | "sent",
  }));
  return { messages, people: Object.entries(names).filter(([u]) => u !== me.uid).map(([uid, name]) => ({ uid, name })), names, unread: messages.filter((m) => m.unread).length };
}

// Step 1 of sending with files: an id for the message and a short-lived upload address for each file.
export async function prepareMessage(db: Firestore, me: Me, files: unknown, presign: Presign, now = new Date()) {
  need(!!me.access, "The message hub is for staff.");
  const list = Array.isArray(files) ? files : [];
  need(list.length <= MAX_FILES, `A message can hold ${MAX_FILES} files.`, 400);
  const id = db.collection(MSGS).doc().id;
  const uploads = await Promise.all(list.map(async (f: { name?: unknown; size?: unknown }, i: number) => {
    const c = checkFile(f);
    const key = `hub/${id}/${now.getTime()}-${i}-${safeFileName(c.name)}`;
    return { key, name: c.name, contentType: c.type, uploadUrl: await presign(key, c.type, c.size) };
  }));
  return { id, uploads };
}

export async function sendMessage(db: Firestore, me: Me, id: string, input: HubInput & { attachments?: unknown }, head: Head, now = new Date()): Promise<{ id: string; emailed: number }> {
  need(!!me.access, "The message hub is for staff.");
  const clean = cleanMessage(input);
  const people = await listTeamPeople(db);
  const byUid = new Map(people.map((p) => [p.uid, p]));
  need([...clean.to, ...clean.cc].every((u) => byUid.has(u)), "Choose people from the team.", 400);
  const ref = db.collection(MSGS).doc(String(id));
  need(!(await ref.get()).exists, "That message was already sent.", 409);
  const attachments: StaffFile[] = [];
  for (const a of Array.isArray(input.attachments) ? input.attachments : []) {
    const key = String(a?.key ?? "");
    need(key.startsWith(`hub/${id}/`) && !key.includes(".."), "A file doesn't belong to this message.", 400);
    const type = FILE_TYPES[extOf(key)];
    need(!!type, "That file type isn't allowed.", 400);
    const obj = await head(key);
    need(!!obj, "A file didn't arrive. Try sending again.", 400);
    need(obj!.size <= FILE_MAX_BYTES, "A file is too large.", 400);
    attachments.push({ key, name: String(a.name ?? "").slice(0, 120) || "file", type, size: obj!.size });
  }
  need(attachments.length <= MAX_FILES, `A message can hold ${MAX_FILES} files.`, 400);
  const doc = { fromUid: me.uid, fromName: me.name, ...clean, emailed: 0, attachments, createdAt: now.toISOString(), readBy: { [me.uid]: now.toISOString() } };
  await ref.create(doc);

  // The hub copy always stays. Bell for everyone; email too when asked.
  const everyone = [...clean.to, ...clean.cc].filter((u) => u !== me.uid);
  await Promise.all(everyone.map((uid) => notifyBell({ uid, type: "team", linkHref: "/admin/team/messages", message: `${me.name}: ${clean.subject}` }).catch(() => {})));
  let emailed = 0;
  if (clean.alsoEmail) {
    for (const uid of everyone) {
      const p = byUid.get(uid);
      if (!p?.email) continue;
      const ccNote = clean.cc.includes(uid) && attachments.length ? "\n\nAttachments went to the people in To; ask the sender if you need them." : "";
      const fileNote = attachments.length && !clean.cc.includes(uid) ? `\n\n${attachments.length} file${attachments.length === 1 ? " is" : "s are"} attached in the message hub.` : "";
      const ok = await sendEmail({ to: p.email, subject: clean.subject, text: `From ${me.name}:\n\n${clean.body}${fileNote}${ccNote}`, action: { label: "Open the message hub", url: "https://www.notesapp.name.ng/admin/team/messages" } }).catch(() => false);
      if (ok) emailed++;
    }
    await ref.update({ emailed });
  }
  return { id: ref.id, emailed };
}

export async function markRead(db: Firestore, me: Me, id: unknown, now = new Date()): Promise<void> {
  const ref = db.collection(MSGS).doc(String(id));
  const s = await ref.get();
  need(s.exists, "That message wasn't found.", 404);
  need(canSeeMessage(toMsg(s.id, s.data()!), me.uid), "That message isn't yours.");
  await ref.update({ [`readBy.${me.uid}`]: now.toISOString() });
}

export async function messageFileLink(db: Firestore, me: Me, id: string, index: number, sign: Sign): Promise<{ url: string; name: string }> {
  const s = await db.collection(MSGS).doc(String(id)).get();
  need(s.exists, "That message wasn't found.", 404);
  const m = toMsg(s.id, s.data()!);
  need(canSeeMessage(m, me.uid), "That message isn't yours.");
  need(canOpenAttachments(m, me.uid), "Files go to the people in To. You were copied (Cc) on this message.");
  const f = m.attachments[index];
  need(!!f, "That file wasn't found.", 404);
  return { url: await sign(f.key, f.name), name: f.name };
}
