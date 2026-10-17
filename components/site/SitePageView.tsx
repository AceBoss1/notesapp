import { notFound } from "next/navigation";
import { remark } from "remark";
import html from "remark-html";
import { getUserByUsername } from "@/lib/users";
import { remarkLinkify } from "@/lib/linkify";
import { SITE } from "@/lib/site";
import { isCrimsonTheme, siteThemeOf } from "@/lib/site-themes";
import { SITE_PAGES, type SitePageId } from "@/lib/site-settings";
import AuroraBand from "./AuroraBand";

// A member's About or Contact page, written in the journal editor (Markdown) on /profile/site. Rendered as journals are:
// remark-html sanitizes the output, and web addresses and @mentions become links (@mentions back to #NotesApp).
// Not written yet: there's no such page.
export default async function SitePageView({ username, page }: { username: string; page: SitePageId }) {
  const p = await getUserByUsername(username).catch(() => null);
  const markdown = p?.sitePages?.[page]?.trim();
  if (!p || p.suspended || p.uid.startsWith("admin:") || !markdown) notFound();
  const contentHtml = String(await remark().use(remarkLinkify, { base: SITE.url }).use(html).process(markdown));
  const title = SITE_PAGES.find((x) => x.id === page)!.name;
  const crimson = isCrimsonTheme(siteThemeOf(p));
  return (
    <div>
      {crimson && <AuroraBand eyebrow={p.displayName}><h1 className="mt-3 font-display text-4xl sm:text-5xl">{title}</h1></AuroraBand>}
      <article className={`mx-auto max-w-3xl px-4 sm:px-6 ${crimson ? "pb-16 pt-10" : "py-16"}`}>
        {!crimson && <><p className="eyebrow">{p.displayName}</p><h1 className="mt-2 font-display text-4xl text-ink">{title}</h1></>}
        <div className={`${crimson ? "" : "mt-8 "}prose prose-lg max-w-none font-body text-ink prose-headings:font-display prose-a:text-crimson-bright`} dangerouslySetInnerHTML={{ __html: contentHtml }} />
      </article>
    </div>
  );
}
