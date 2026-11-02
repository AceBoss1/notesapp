import type { ActionEntry, LogResult } from "@/lib/mcp/log";

// Console → Connected agents: the activity log in plain words, its filters and the CSV download. Pure.

const q = (v: unknown, n = 70) => {
  const s = String(v ?? "").replace(/\s+/g, " ").trim();
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
};
// "What it did", from the tool and what was asked (never the content: titles and names only).
export function describeCall(tool: string, a: Record<string, unknown> = {}, result?: LogResult): string {
  const title = a.title ? `"${q(a.title)}"` : "a journal";
  switch (tool) {
    case "my_profile": return "Read your profile";
    case "my_posts": return a.status === "draft" ? "Read your drafts" : "Read your journals";
    case "my_bookings": return "Read your bookings";
    case "my_orders": return a.kind === "digital" ? "Read your download sales" : "Read your orders";
    case "my_earnings": return result === "blocked" ? "Tried to read your earnings" : "Read your earnings";
    case "my_messages": return result === "blocked" ? "Tried to read your messages" : "Read your recent messages";
    case "get_open_slots": return `Looked at ${a.username ? `@${q(a.username, 30)}'s` : "your"} open times`;
    case "get_booking_link": return "Got a booking link";
    case "search_creators": return "Searched creators";
    case "search_journals": return "Searched journals";
    case "search_store": return "Searched Notes Market";
    case "search_courses": return "Searched Notes Academy";
    case "get_creator": return `Looked at ${a.username ? `@${q(a.username, 30)}` : "a creator"}`;
    case "connect_account": return "Asked to connect";
    case "create_draft": return result === "waiting" ? `Asked to save the draft ${title}` : `Saved the draft ${title}`;
    case "publish_post": return `Asked to publish ${title}`;
    case "reply_booking": return a.action === "confirm" ? "Confirmed a paid booking" : a.action === "decline" ? "Declined a booking request" : a.action === "offer_time" ? "Offered another time for a booking" : "Replied to a booking request";
    case "update_store_item": return `${result === "waiting" ? "Asked to change" : "Changed"} a store item${a.price_naira !== undefined ? " (price)" : ""}`;
    case "mark_shipped": return `${result === "waiting" ? "Asked to mark" : "Marked"} an order shipped`;
    default: return tool.replace(/_/g, " ");
  }
}

export type Filter = "all" | "changes" | "waiting" | "blocked" | "declined";
export const FILTERS: { id: Filter; label: string }[] = [{ id: "all", label: "All" }, { id: "changes", label: "Changes" }, { id: "waiting", label: "Waiting" }, { id: "blocked", label: "Blocked" }, { id: "declined", label: "Declined" }];
const CHANGE_TOOLS = new Set(["create_draft", "publish_post", "reply_booking", "update_store_item", "mark_shipped"]);
export const resultOf = (e: Pick<ActionEntry, "result" | "ok" | "tool">): LogResult => e.result ?? (e.ok ? (CHANGE_TOOLS.has(e.tool) ? "done" : "read") : "failed");
export function matches(e: Pick<ActionEntry, "result" | "ok" | "tool">, f: Filter): boolean {
  const r = resultOf(e);
  if (f === "all") return true;
  if (f === "changes") return CHANGE_TOOLS.has(e.tool) && ["done", "approved", "undone"].includes(r);
  if (f === "waiting") return r === "waiting";
  if (f === "blocked") return r === "blocked" || r === "failed";
  return r === "declined" || r === "expired";
}
export const RESULT_LABEL: Record<LogResult, string> = {
  read: "Read", done: "Done", waiting: "Waiting for you", blocked: "Blocked · not allowed", approved: "Approved by you", declined: "Declined by you",
  undone: "Undone", expired: "Expired", failed: "Didn't work",
};

// Seven bars for the last seven Lagos days (oldest first): calls per day.
export function sparkline(times: string[], now: Date, days = 7): number[] {
  const out = new Array(days).fill(0);
  const DAY = 86_400_000, lagos = (t: number) => Math.floor((t + 3_600_000) / DAY);
  const today = lagos(now.getTime());
  for (const t of times) {
    const d = today - lagos(new Date(t).getTime());
    if (d >= 0 && d < days) out[days - 1 - d]++;
  }
  return out;
}

const cell = (v: unknown) => {
  const s = String(v ?? "");
  // Spreadsheet formula injection: a cell that starts with = + - @ is prefixed so it's read as text.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};
export function toCsv(rows: { at: string; agent: string; what: string; tool: string; result: string }[]): string {
  return ["When (UTC),Agent,What it did,Tool,Result", ...rows.map((r) => [r.at, r.agent, r.what, r.tool, r.result].map(cell).join(","))].join("\n") + "\n";
}
