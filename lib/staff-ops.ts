import { hasDept, isDept, isSuper, type Access, type Dept } from "./admin-access";

// Staff library and message hub: the shared rules, in one place for the server, the screens and the tests.
export class StaffOpsError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}

export const DOC_CATEGORIES = [
  { key: "sop", label: "SOP (standard operating procedure)" },
  { key: "handbook", label: "Employee handbook" },
  { key: "policy", label: "Policy" },
  { key: "template", label: "Template or form" },
  { key: "other", label: "Other staff material" },
] as const;
export type DocCategory = (typeof DOC_CATEGORIES)[number]["key"];
export const isDocCategory = (c: unknown): c is DocCategory => DOC_CATEGORIES.some((x) => x.key === c);

// Who can open a document: everyone on staff, one department, or named people. A personal document is sent to people as receivers (To), not copied (Cc).
export type DocScope = "all" | "dept" | "personal";
export const FILE_TYPES: Record<string, string> = {
  pdf: "application/pdf", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", txt: "text/plain", csv: "text/csv", md: "text/markdown",
};
export const FILE_MAX_BYTES = 25 * 1024 * 1024;
export const MAX_FILES = 10;
export const extOf = (name: string) => (name.split(".").pop() || "").toLowerCase();

export type StaffFile = { key: string; name: string; type: string; size: number };
export type StaffDoc = {
  id: string; title: string; category: DocCategory; description: string; version: number; scope: DocScope; dept?: Dept; receivers: string[];
  files: StaffFile[]; requiresAck: boolean; ackedBy: Record<string, string>; archived: boolean;
  createdAt: string; createdByUid: string; createdByName: string; updatedAt: string;
};

export type DocInput = { title?: unknown; category?: unknown; description?: unknown; scope?: unknown; dept?: unknown; receivers?: unknown; requiresAck?: unknown };
export function cleanDoc(input: DocInput): Pick<StaffDoc, "title" | "category" | "description" | "scope" | "receivers" | "requiresAck"> & { dept?: Dept } {
  const title = String(input.title ?? "").trim().slice(0, 140);
  if (!title) throw new StaffOpsError("Give the document a title.");
  if (!isDocCategory(input.category)) throw new StaffOpsError("Choose what kind of document it is.");
  const scope = input.scope === "dept" || input.scope === "personal" ? input.scope : "all";
  let dept: Dept | undefined;
  if (scope === "dept") { if (!isDept(input.dept)) throw new StaffOpsError("Choose the department that can open it."); dept = input.dept; }
  const receivers = scope === "personal" ? Array.from(new Set((Array.isArray(input.receivers) ? input.receivers : []).map(String).filter(Boolean))).slice(0, 20) : [];
  if (scope === "personal" && !receivers.length) throw new StaffOpsError("Add at least one receiver (To) for a personal document.");
  return { title, category: input.category, description: String(input.description ?? "").trim().slice(0, 1000), scope, ...(dept ? { dept } : {}), receivers, requiresAck: input.requiresAck === true };
}

export type Viewer = { uid: string; access: Access | null };
// Super admins see every shared document; a personal one is seen only by its receivers and whoever added it.
export function canSeeDoc(d: Pick<StaffDoc, "scope" | "dept" | "receivers" | "createdByUid">, v: Viewer): boolean {
  if (!v.access) return false;
  if (d.scope === "all") return true;
  if (d.scope === "dept") return isSuper(v.access) || (!!d.dept && hasDept(v.access, d.dept));
  return d.receivers.includes(v.uid) || d.createdByUid === v.uid;
}
export const canEditDocs = (a: Access | null) => isSuper(a) || hasDept(a, "support") || hasDept(a, "product"); // super admins, customer care and product maintain the library

export const pendingAck = (d: Pick<StaffDoc, "requiresAck" | "ackedBy" | "archived">, uid: string) => d.requiresAck && !d.archived && !d.ackedBy[uid];

export function checkFile(f: { name?: unknown; size?: unknown }): { name: string; type: string; size: number } {
  const name = String(f.name ?? "").trim();
  const size = Number(f.size);
  const type = FILE_TYPES[extOf(name)];
  if (!type) throw new StaffOpsError(`Files can be ${Object.keys(FILE_TYPES).join(", ")}.`);
  if (!Number.isFinite(size) || size <= 0 || size > FILE_MAX_BYTES) throw new StaffOpsError(`Each file can be up to ${FILE_MAX_BYTES / 1024 / 1024} MB.`);
  return { name, type, size };
}

// ---- message hub ----
export const MSG = { subject: 150, body: 5000, recipients: 50 };
export type HubMessage = {
  id: string; fromUid: string; fromName: string; to: string[]; cc: string[]; subject: string; body: string; alsoEmail: boolean; emailed: number;
  attachments: StaffFile[]; createdAt: string; readBy: Record<string, string>;
};
export type HubInput = { to?: unknown; cc?: unknown; subject?: unknown; body?: unknown; alsoEmail?: unknown };
export function cleanMessage(input: HubInput): { to: string[]; cc: string[]; subject: string; body: string; alsoEmail: boolean } {
  const ids = (v: unknown) => Array.from(new Set((Array.isArray(v) ? v : []).map(String).filter(Boolean)));
  const to = ids(input.to);
  const cc = ids(input.cc).filter((u) => !to.includes(u)); // someone in To is not also copied
  if (!to.length) throw new StaffOpsError("Add at least one person in To.");
  if (to.length + cc.length > MSG.recipients) throw new StaffOpsError(`A message can go to at most ${MSG.recipients} people.`);
  const subject = String(input.subject ?? "").trim().slice(0, MSG.subject);
  if (!subject) throw new StaffOpsError("Add a subject.");
  const body = String(input.body ?? "").trim().slice(0, MSG.body);
  if (!body) throw new StaffOpsError("Write a message.");
  return { to, cc, subject, body, alsoEmail: input.alsoEmail === true };
}
// The sender and the people in To can open attachments; people in Cc get the message and are told the files are for the To recipients.
export const canOpenAttachments = (m: Pick<HubMessage, "fromUid" | "to">, uid: string) => m.fromUid === uid || m.to.includes(uid);
export const canSeeMessage = (m: Pick<HubMessage, "fromUid" | "to" | "cc">, uid: string) => m.fromUid === uid || m.to.includes(uid) || m.cc.includes(uid);
