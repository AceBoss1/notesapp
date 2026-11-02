import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAdminDb } from "@/lib/firebase-admin";
import { publicAnnouncement } from "@/lib/announcements-server";
import { bodyHtml, personalise, type BodyStyle } from "@/lib/announcements";
import PageHero from "@/components/PageHero";

export const dynamic = "force-dynamic";

// An announcement as a page (Admin → Announcements; the bell links here). Only once it's been sent. "{name}" reads "there" here: the
// page is the same for everyone.
const STYLE: BodyStyle = { p: "", h: "", ul: "", li: "", a: "" };
const load = (id: string) => (/^[\w-]{1,64}$/.test(id) ? publicAnnouncement(getAdminDb(), id) : Promise.resolve(null));

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const a = await load(params.id);
  return a ? { title: a.title, robots: { index: false } } : { title: "Announcement" };
}

export default async function AnnouncementPage({ params }: { params: { id: string } }) {
  const a = await load(params.id);
  if (!a) notFound();
  const html = bodyHtml(personalise(a.body, "there"), STYLE).replace(/ style=""/g, "");
  return (
    <>
      <PageHero eyebrow={`From #NotesApp · ${new Date(a.sentAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}`} title={<>{a.title}</>} />
      <article className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        <div className="prose-announcement space-y-4 font-body text-[17px] leading-relaxed text-ink [&_a]:font-semibold [&_a]:text-crimson [&_a]:underline [&_a]:break-words [&_h2]:mt-8 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:text-crimson [&_li]:mt-2 [&_ul]:list-disc [&_ul]:pl-6" dangerouslySetInnerHTML={{ __html: html }} />
        {a.linkUrl && <p className="mt-8"><a href={a.linkUrl} className="btn-primary">{a.linkLabel}</a></p>}
        <p className="mt-10 text-sm text-slate"><Link href="/changelog" className="text-crimson underline">Everything we&apos;ve shipped</Link> · <Link href="/roadmap" className="text-crimson underline">What&apos;s next</Link></p>
      </article>
    </>
  );
}
