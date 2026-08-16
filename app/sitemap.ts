import type { MetadataRoute } from "next";
import { getAllNotes } from "@/lib/firestore-notes";
import { getAllUsers } from "@/lib/users";
import { CHANNEL_JOURNALS } from "@/lib/journals-directory";
import { NOTESAPP_POSTS } from "@/lib/notesapp-posts";
import { SITE } from "@/lib/site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages: MetadataRoute.Sitemap = [
    { url: `${SITE.url}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE.url}/journals`, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE.url}/booking`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE.url}/merchstore`, changeFrequency: "weekly", priority: 0.5 },
    { url: `${SITE.url}/brand`, changeFrequency: "monthly", priority: 0.4 },
    { url: `${SITE.url}/about`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE.url}/roadmap`, changeFrequency: "monthly", priority: 0.4 },
    { url: `${SITE.url}/advertise`, changeFrequency: "monthly", priority: 0.3 },
    { url: `${SITE.url}/contact`, changeFrequency: "yearly", priority: 0.5 },
  ];

  // @notesapp's 5 hardcoded posts — real URLs, not in Firestore, so
  // they need to be added by hand rather than via getAllNotes().
  const notesappPostPages: MetadataRoute.Sitemap = NOTESAPP_POSTS.map((p) => ({
    url: `${SITE.url}/u/notesapp/posts/${p.slug}`,
    changeFrequency: "yearly",
    priority: 0.3,
  }));

  let notePages: MetadataRoute.Sitemap = [];
  let profilePages: MetadataRoute.Sitemap = [];

  try {
    const notes = await getAllNotes({ publishedOnly: true });
    notePages = notes.map((n) => ({
      url: `${SITE.url}/journals/${n.slug}`,
      lastModified: n.date ? new Date(n.date) : undefined,
      changeFrequency: "monthly",
      priority: 0.7,
    }));
  } catch {
    // Firestore unreachable at build time — sitemap still ships with
    // static pages; /journals/[slug] pages are still crawlable via
    // /journals itself.
  }

  try {
    const users = await getAllUsers();
    const channelUsernames = new Set(CHANNEL_JOURNALS.map((c) => c.username));
    profilePages = [
      // Both synthetic channels — no `users` doc, so getAllUsers()
      // never returns them.
      ...CHANNEL_JOURNALS.map((c) => ({
        url: `${SITE.url}/u/${c.username}`,
        changeFrequency: "weekly" as const,
        priority: 0.5,
      })),
      ...users
        .filter((u) => !channelUsernames.has(u.username))
        .map((u) => ({
          url: `${SITE.url}/u/${u.username}`,
          changeFrequency: "monthly" as const,
          priority: 0.4,
        })),
    ];
  } catch {
    // same fallback as above
  }

  return [...staticPages, ...notesappPostPages, ...notePages, ...profilePages];
}
