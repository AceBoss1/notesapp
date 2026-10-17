import type { Firestore } from "firebase-admin/firestore";
import { CHANGELOG, type Release } from "./changelog";
import { setting } from "@/lib/config";
import { SITE_URL } from "@/lib/host";

// New releases in the changelog are posted to the #announcements channel of the #NotesApp Discord, through a channel webhook
// (DISCORD_CHANGELOG_WEBHOOK_URL). The cron job checks every run; each version is posted once (announcements/discord_<version> records
// it, created before posting so two runs can't both post). The very first run posts only the newest release, not the whole history.
export const MAX_PER_RUN = 3;
const KIND = { added: "✨ Added", changed: "🔄 Changed", fixed: "🛠 Fixed" } as const;

export const isDiscordWebhook = (u: string) => /^https:\/\/(?:discord\.com|discordapp\.com|ptb\.discord\.com|canary\.discord\.com)\/api\/webhooks\/\d+\/[\w-]+$/.test(u);

// One message per release: the version as the title (linking to /changelog), each line under its kind, in the brand colour.
export function releaseMessage(r: Release, site = SITE_URL) {
  let description = r.changes.map((c) => `**${KIND[c.kind]}:** ${c.text}`).join("\n\n");
  if (description.length > 3900) description = `${description.slice(0, 3880).replace(/\s+\S*$/, "")}…\n\nRead the rest on the changelog.`;
  const day = new Date(`${r.date}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  return {
    username: "Changelog Bot",
    allowed_mentions: { parse: [] as string[] }, // never pings anyone
    embeds: [{ title: `#NotesApp ${r.version}`, url: `${site}/changelog`, description, color: 0x7a0328, footer: { text: `Released ${day}` } }],
  };
}

export type DiscordPost = (url: string, body: unknown) => Promise<void>;
const realPost: DiscordPost = async (url, body) => {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`Discord answered ${r.status}`);
};

export async function announceReleases(db: Firestore, post: DiscordPost = realPost, list: Release[] = CHANGELOG, url = setting("DISCORD_CHANGELOG_WEBHOOK_URL") ?? ""): Promise<string[]> {
  if (!url || !isDiscordWebhook(url) || !list.length) return [];
  const state = db.doc("announcements/discord");
  const last = String((await state.get()).data()?.version ?? "");
  const at = list.findIndex((r) => r.version === last);
  // Newest first in the changelog: everything above the last one posted, oldest of those first. Nothing posted yet (or it's gone): just the newest.
  const due = (at === -1 ? list.slice(0, 1) : list.slice(0, at)).slice(-MAX_PER_RUN).reverse(); // the oldest few not yet posted
  const posted: string[] = [];
  for (const r of due) {
    const mark = db.doc(`announcements/discord_${r.version.replace(/[^\w.-]/g, "_")}`);
    try { await mark.create({ version: r.version, at: new Date().toISOString() }); } catch { continue; } // another run has it
    try { await post(url, releaseMessage(r)); }
    catch (e) { await mark.delete().catch(() => {}); throw e; } // try again next run
    await state.set({ version: r.version, at: new Date().toISOString() });
    posted.push(r.version);
  }
  return posted;
}
