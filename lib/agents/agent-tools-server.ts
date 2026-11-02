import type { Firestore } from "firebase-admin/firestore";
import { decide, type Decision } from "./scopes";
import { createProposal, recordDone, type NewProposal } from "./proposals-server";
import { execute, ExecError, cleanStoreChanges } from "./execute-server";
import { sha256 } from "./pairing";
import { MEMBER_TEXT } from "@/lib/mcp/catalog";
import type { AgentCaller } from "./grants-server";
import type { Proposal } from "./proposals";
import type { LogResult } from "@/lib/mcp/log";
import { listConversations } from "@/lib/messages-server";
import { formatNaira, formatSlot } from "@/lib/booking-time";
import { mainSiteUrl } from "@/lib/host";

// A connected assistant's changing tools (lib/agents/catalog.ts). Each one: check the arguments, ask the member's rules (decide()), then
// do it at once, or put it in Nana's inbox for the member, or refuse. Text the assistant sends (a draft, a reply) is the assistant's
// proposal; the member sees it before anything that asks first.

export class AgentToolError extends Error {
  constructor(message: string, readonly result: LogResult = "failed") { super(message); }
}
export type ToolOutcome = { data: Record<string, unknown>; result: LogResult; proposalId?: string };
const str = (v: unknown, n = 200) => (typeof v === "string" ? v.replace(/\u0000/g, "").trim().slice(0, n) : "");

// The booking link the reply carries, on the member's own page, in the family of the address the assistant called (lib/host.ts).
export const bookingLink = (host: string, username: string, date?: string, slot?: string) => mainSiteUrl(host, `/u/${username}${date ? `?date=${date}${slot ? `&time=${slot}` : ""}` : ""}#book`);

async function plan(db: Firestore, c: AgentCaller, name: string, a: Record<string, unknown>, host: string): Promise<{ proposal: NewProposal; ctx: Parameters<typeof decide>[2] }> {
  const base = { uid: c.uid, source: c.grantId, sourceName: c.grant.agentName, idemKey: `agent:${c.grantId}:${name}:${sha256(JSON.stringify(a)).slice(0, 20)}` };
  switch (name) {
    case "create_draft": {
      const title = str(a.title, 200), content = typeof a.content === "string" ? a.content.slice(0, 100_000) : "";
      if (!title || !content.trim()) throw new AgentToolError("Give the draft a title and some text.");
      const words = content.split(/\s+/).filter(Boolean).length;
      const topics = Array.isArray(a.topics) ? a.topics.map((t) => str(t, 40)).filter(Boolean).slice(0, 5) : [];
      return { proposal: { ...base, kind: "journal_draft", title: `Save the draft "${title}"`, summary: `${words.toLocaleString("en-GB")} words${topics.length ? `, topics ${topics.join(", ")}` : ""}. Saved as a draft only.`, draft: content, payload: { title, topics }, trail: [`${c.grant.agentName} wrote a draft for you.`] }, ctx: {} };
    }
    case "publish_post": {
      const id = str(a.post_id, 40).replace(/\//g, "");
      const n = id ? (await db.doc(`notes/${id}`).get()).data() : undefined;
      if (!n || n.authorUid !== c.uid) throw new AgentToolError("That journal wasn't found on this account.");
      if (n.status === "published") throw new AgentToolError("That journal is already published.");
      const words = String(n.content ?? "").split(/\s+/).filter(Boolean).length;
      return { proposal: { ...base, kind: "publish_post", title: `Publish "${String(n.title).slice(0, 120)}"`, summary: `Your rule for ${c.grant.agentName}: publishing always asks you. ${words.toLocaleString("en-GB")} words${Array.isArray(n.topics) && n.topics.length ? `, topics ${n.topics.slice(0, 3).join(", ")}` : ""}.`, payload: { noteId: id }, trail: [`${c.grant.agentName} asked to publish it.`] }, ctx: {} };
    }
    case "reply_booking": {
      const action = ["confirm", "offer_time", "decline", "reply"].includes(String(a.action)) ? String(a.action) : "reply";
      const message = typeof a.message === "string" ? a.message.replace(/\u0000/g, "").trim().slice(0, 2000) : "";
      if (!message) throw new AgentToolError("Write the reply in message.");
      const me = (await db.doc(`users/${c.uid}`).get()).data() ?? {};
      let toUid = "", toName = "", facts: { label: string; value: string }[] = [], paid = false, date = "", slot = "";
      if (a.booking_id) {
        const b = (await db.doc(`bookings/${str(a.booking_id, 80).replace(/\//g, "")}`).get()).data();
        if (!b || b.publisherUid !== c.uid) throw new AgentToolError("That booking wasn't found on this account.");
        toUid = String(b.clientUid); date = String(b.date ?? ""); slot = String(b.slot ?? "");
        toName = String((await db.doc(`users/${toUid}`).get()).data()?.displayName ?? "your client");
        paid = b.status === "confirmed";
        facts = [{ label: "Session", value: `${date}, ${formatSlot(slot)}` }, { label: "Length", value: `${b.minutes} min` }, ...(b.amountKobo ? [{ label: "Paid", value: formatNaira(Number(b.amountKobo)) }] : [])];
      } else {
        const u = str(a.username, 40).replace(/^@/, "").toLowerCase();
        const snap = u ? await db.doc(`usernames/${u}`).get() : null;
        toUid = String(snap?.data()?.uid ?? "");
        if (!toUid || toUid === c.uid) throw new AgentToolError("Give a booking_id from my_bookings, or the person's username.");
        toName = String((await db.doc(`users/${toUid}`).get()).data()?.displayName ?? `@${u}`);
      }
      const confirmation = action === "confirm" && paid;
      const link = me.username ? bookingLink(host, String(me.username), action === "confirm" ? undefined : date || undefined, action === "confirm" ? undefined : slot || undefined) : "";
      const draft = action === "decline" || action === "confirm" || !link || message.includes(link) ? message : `${message}\n\n${link}`;
      return {
        proposal: { ...base, kind: confirmation ? "booking_confirm" : "booking_reply", title: `${confirmation ? "Confirm" : action === "decline" ? "Decline" : "Reply to"} ${toName}${confirmation ? "'s paid booking" : ""}`, summary: `${c.grant.agentName} wrote a reply${action === "offer_time" ? " offering another time" : ""}.`, facts, draft, payload: { toUid, toName, action }, trail: [`${c.grant.agentName} wrote a reply to ${toName}.`] },
        ctx: { confirmation, discountKobo: Number.isInteger(a.discount_naira) ? Number(a.discount_naira) * 100 : 0 },
      };
    }
    case "update_store_item": {
      const id = str(a.item_id, 40).replace(/\//g, "");
      const item = id ? (await db.doc(`storeItems/${id}`).get()).data() : undefined;
      if (!item || item.ownerUid !== c.uid) throw new AgentToolError("That store item wasn't found on this account.");
      const changes = cleanStoreChanges({ title: a.title, subtitle: a.description, stock: a.stock, priceKobo: a.price_naira !== undefined ? Number(a.price_naira) * 100 : undefined });
      if (!Object.keys(changes).length) throw new AgentToolError("Nothing to change: give a title, description, stock or price_naira.");
      const priceChange = changes.priceKobo !== undefined && changes.priceKobo !== item.priceKobo;
      const what = Object.keys(changes).map((k) => (k === "priceKobo" ? `price ${formatNaira(Number(item.priceKobo ?? 0))} → ${formatNaira(Number(changes.priceKobo))}` : k === "subtitle" ? "description" : k === "stock" ? `stock ${item.stock ?? "—"} → ${changes.stock}` : k)).join(", ");
      return { proposal: { ...base, kind: "store_edit", title: `Change "${String(item.title).slice(0, 80)}"`, summary: `${c.grant.agentName} wants to change: ${what}.${priceChange ? " Price changes always ask you." : ""}`, payload: { itemId: id, changes }, trail: [`${c.grant.agentName} asked to change a store item.`] }, ctx: { priceChange } };
    }
    case "mark_shipped": {
      const ref = str(a.order_id, 80).replace(/\//g, "");
      const o = ref ? (await db.doc(`storeOrders/${ref}`).get()).data() : undefined;
      if (!o || o.sellerUid !== c.uid) throw new AgentToolError("That order wasn't found on this account.");
      if (o.status !== "paid") throw new AgentToolError("That order has already been sent or closed.");
      const courier = str(a.courier, 60), trackingNumber = str(a.tracking_number, 60), trackingUrl = str(a.tracking_url, 300);
      if (!courier || !trackingNumber) throw new AgentToolError("Give the courier and the tracking number.");
      return { proposal: { ...base, kind: "mark_shipped", title: `Mark ${String(o.itemTitle).slice(0, 80)} shipped`, summary: `With ${courier}, tracking ${trackingNumber}. The buyer is told.`, facts: [{ label: "To", value: [o.address?.city, o.address?.state].filter(Boolean).join(", ") || "—" }], payload: { reference: ref, courier, trackingNumber, trackingUrl }, trail: [`${c.grant.agentName} asked to mark it shipped.`] }, ctx: {} };
    }
  }
  throw new AgentToolError(`Unknown tool: ${name}.`);
}

export async function agentWriteTool(db: Firestore, c: AgentCaller, name: string, a: Record<string, unknown>, host = "", now = new Date()): Promise<ToolOutcome> {
  const { proposal, ctx } = await plan(db, c, name, a, host);
  const decision: Decision = decide(c.grant.policy, name, ctx);
  if (decision.kind === "deny") throw new AgentToolError(decision.reason, "blocked");
  if (decision.kind === "ask") {
    const { proposal: p, fresh } = await createProposal(db, proposal, now);
    return { result: "waiting", proposalId: p.id, data: { status: p.status === "pending" ? "waiting_for_member" : p.status, request_id: p.id, why: decision.why, message: fresh ? "Sent to the member's Nana's inbox. Nothing happens until they approve it; requests they don't answer expire." : "You asked for this already; here is its status." } };
  }
  const draft = proposal.draft ?? "";
  const pending = { ...proposal, id: "", status: "pending", payload: proposal.payload ?? {}, trail: [], createdAt: now.toISOString(), expiresAt: now.toISOString() } as unknown as Proposal;
  let result: Record<string, unknown>;
  try { result = await execute(db, c.uid, pending, draft, now); }
  catch (e) { throw new AgentToolError(e instanceof ExecError ? e.message : "That didn't work.", "failed"); }
  const { proposal: done } = await recordDone(db, { ...proposal, title: proposal.title.replace(/^Save the draft/, "Saved the draft").replace(/^Confirm /, "Confirmed "), result }, now);
  return { result: "done", proposalId: done.id, data: { status: "done", ...pickPublic(result), undo: done.undoUntil ? `The member can undo this until ${done.undoUntil}.` : undefined } };
}
const pickPublic = (r: Record<string, unknown>) => Object.fromEntries(Object.entries(r).filter(([k]) => ["noteId", "slug", "itemId", "reference"].includes(k)).map(([k, v]) => [k === "noteId" ? "post_id" : k, v]));

// read:messages — the member's recent conversations; what others wrote is labelled.
export async function myMessages(db: Firestore, uid: string, limit: number) {
  const rows = (await listConversations(db, uid)).slice(0, Math.min(20, Math.max(1, limit || 10)));
  const names = await Promise.all(rows.map((r) => (r.kind === "direct" ? db.doc(`users/${r.withUid}`).get().then((d) => ({ name: String(d.data()?.displayName ?? ""), username: String(d.data()?.username ?? "") })) : Promise.resolve({ name: r.group?.title ?? "Group", username: "" }))));
  return { note: MEMBER_TEXT, conversations: rows.map((r, i) => ({ with: names[i].name, username: names[i].username || undefined, group: r.kind === "group", last_message: r.lastText, last_from_me: r.lastFromMe, at: r.lastAt, unread: r.unread })) };
}
