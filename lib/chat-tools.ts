// Finding things in Messages: the inbox's search box and filter chips, and search inside one conversation. Pure, so it is tested
// without a browser (tests/messages/chat-tools.test.ts).
import { stripFormat } from "./message-format";

export const INBOX_TABS = [
  { key: "all", label: "All" },
  { key: "unread", label: "Unread" },
  { key: "groups", label: "Groups" },
  { key: "bookings", label: "Bookings" },
  { key: "orders", label: "Orders" },
] as const;
export type InboxTab = (typeof INBOX_TABS)[number]["key"];

// Lower case without accents, so "Chidi" finds "chídí" and "ADA" finds "Ada".
export const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

type InboxRow = { lastText: string; unread: number; with: { uid: string; username: string; displayName: string }; group?: { title: string } };
export type Contexts = { bookings: string[]; orders: string[] };

// The chats to show: the tab first (Bookings and Orders are one-to-one chats with someone you have a booking or an order with), then the
// search, which matches the name, the @handle, a group's title or the last message.
export function filterInbox<R extends InboxRow>(rows: R[], q: string, tab: InboxTab, contexts: Contexts | null): R[] {
  const want = fold(q.trim().replace(/^@/, ""));
  return rows.filter((r) => {
    if (tab === "unread" && r.unread <= 0) return false;
    if (tab === "groups" && !r.group) return false;
    if (tab === "bookings" && (r.group || !contexts?.bookings.includes(r.with.uid))) return false;
    if (tab === "orders" && (r.group || !contexts?.orders.includes(r.with.uid))) return false;
    if (!want) return true;
    const hay = r.group ? [r.group.title, r.lastText] : [r.with.displayName, r.with.username, r.lastText];
    return hay.some((h) => fold(stripFormat(h || "")).includes(want));
  });
}

// How many in each tab, for the chips ("Unread 3").
export function tabCounts<R extends InboxRow>(rows: R[], contexts: Contexts | null): Record<InboxTab, number> {
  return Object.fromEntries(INBOX_TABS.map((t) => [t.key, filterInbox(rows, "", t.key, contexts).length])) as Record<InboxTab, number>;
}

type Searchable = { id: string; text: string; deleted?: unknown; removed?: unknown; call?: unknown; attachments?: { name: string }[] };
// Search inside a conversation: the ids of the messages whose words (or file names) contain what was typed, oldest first.
export function searchThread(messages: Searchable[], q: string): string[] {
  const want = fold(q.trim());
  if (want.length < 2) return [];
  return messages.filter((m) => !m.deleted && !m.removed && !m.call && (fold(stripFormat(m.text || "")).includes(want) || (m.attachments ?? []).some((a) => fold(a.name).includes(want)))).map((m) => m.id);
}

// The file card's label: "PDF", "DOCX", "ZIP"… from the file name.
export const fileBadge = (name: string) => (name.includes(".") ? name.split(".").pop()!.slice(0, 4).toUpperCase() : "FILE");
