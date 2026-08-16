import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { remark } from "remark";
import html from "remark-html";
import type { Metadata } from "next";
import { getNoteBySlug, getMoreNotes } from "@/lib/firestore-notes";
import { getUserByDisplayName } from "@/lib/users";
import { NA_NOTESAPP_PROFILE } from "@/lib/journals-directory";
import SocialBar from "@/components/SocialBar";
import Comments from "@/components/Comments";
import PremiumGate from "@/components/PremiumGate";

// Same note, same Firestore doc as precheks.com.ng/notes/{slug} — this
// route is #NotesApp's own reading UI over that exact shared content.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const note = await getNoteBySlug(params.slug);
  if (!note) return { title: "Journal Not Found" };

  // Premium entries still get a real OG card — the teaser/excerpt is
  // already public by design (PremiumGate only gates the full body),
  // so there's nothing sensitive in a share preview.
  const ogImage = note.featured_image || "/images/brand/og-default.jpg";

  return {
    title: note.title,
    description: note.excerpt,
    openGraph: {
      title: note.title,
      description: note.excerpt,
      type: "article",
      publishedTime: note.date,
      authors: [note.author],
      images: [ogImage],
    },
    twitter: {
      card: "summary_large_image",
      title: note.title,
      description: note.excerpt,
      images: [ogImage],
    },
  };
}

export default async function JournalDetail({
  params,
}: {
  params: { slug: string };
}) {
  const note = await getNoteBySlug(params.slug);
  if (!note) return notFound();

  const [processed, moreNotes, authorProfile] = await Promise.all([
    remark().use(html).process(note.content),
    getMoreNotes(note.slug, 4),
    getUserByDisplayName(note.author),
  ]);
  const contentHtml = processed.toString();

  // @na-notesapp has no `users` doc — getUserByDisplayName() can't
  // find it — but its notes are real and should still link to
  // /u/na-notesapp. Real people keep using authorProfile as before;
  // this only fills the gap for that one synthetic channel.
  const linkedUsername =
    note.author === NA_NOTESAPP_PROFILE.displayName
      ? NA_NOTESAPP_PROFILE.username
      : authorProfile?.username;

  return (
    <article className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
      <Link
        href="/journals"
        className="font-ui text-xs font-semibold uppercase tracking-wideish text-crimson-bright"
      >
        ← All Journals
      </Link>
      <p className="eyebrow mt-6">
        {note.categories[0] || "Journal"}
        {note.premium && (
          <span className="ml-2 rounded-full bg-crimson/10 px-2.5 py-0.5 text-crimson">
            🔒 Premium
          </span>
        )}
      </p>
      <h1 className="mt-3 font-display text-4xl leading-[1.05] text-ink sm:text-5xl">
        {note.title}
      </h1>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-y border-rule py-4">
        {linkedUsername ? (
          <Link href={`/u/${linkedUsername}`} className="group flex items-center gap-3">
            <Image
              src={note.author_avatar}
              alt={note.author}
              width={44}
              height={44}
              className="h-11 w-11 flex-shrink-0 rounded-full border-2 border-crimson object-cover"
            />
            <div>
              <p className="font-ui text-sm font-semibold text-ink group-hover:text-crimson-bright">
                By {note.author}{" "}
                <span className="font-mono text-crimson-bright">
                  @{linkedUsername}
                </span>
              </p>
              <p className="mt-0.5 font-mono text-xs uppercase tracking-wide text-slate">
                {note.author_role}
              </p>
            </div>
          </Link>
        ) : (
          <div className="flex items-center gap-3">
            <Image
              src={note.author_avatar}
              alt={note.author}
              width={44}
              height={44}
              className="h-11 w-11 flex-shrink-0 rounded-full border-2 border-crimson object-cover"
            />
            <div>
              <p className="font-ui text-sm font-semibold text-ink">By {note.author}</p>
              <p className="mt-0.5 font-mono text-xs uppercase tracking-wide text-slate">
                {note.author_role}
              </p>
            </div>
          </div>
        )}
        <p className="whitespace-nowrap font-mono text-xs text-slate">
          {note.date &&
            new Date(note.date).toLocaleDateString("en-NG", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}{" "}
          &nbsp;|&nbsp; {note.reading_time} min read
        </p>
      </div>

      {note.featured_image && (
        <Image
          src={note.featured_image}
          alt={note.title}
          width={900}
          height={520}
          className="mt-8 h-auto w-full object-cover"
        />
      )}

      {authorProfile?.status === "suspended" ? (
        <div className="mt-10 card border-red-200 bg-red-50 p-8 text-center">
          <p className="font-display text-xl text-red-800">
            This entry is temporarily hidden.
          </p>
          <p className="mt-2 text-sm text-red-700">
            {note.author}'s account is under review.
          </p>
        </div>
      ) : (
        <PremiumGate
          premium={!!note.premium}
          authorUsername={linkedUsername || ""}
          authorName={note.author}
          contentHtml={contentHtml}
        />
      )}

      {note.tags.length > 0 && (
        <div className="mt-10 flex flex-wrap gap-3 border-t border-rule pt-6">
          {note.tags.map((t) => (
            <span key={t} className="font-mono text-[11px] uppercase tracking-eyebrow text-slate">
              #{t}
            </span>
          ))}
        </div>
      )}

      {authorProfile && (
        <div className="card mt-10 flex flex-col items-start gap-4 p-7 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-ui text-base font-bold text-ink">
              Book a session with {note.author}
            </p>
            <p className="mt-1 text-sm text-slate">
              Native calendar, no redirect — payment collects inline.
            </p>
          </div>
          <Link href={`/u/${authorProfile.username}`} className="btn-primary shrink-0">
            View calendar
          </Link>
        </div>
      )}

      <div className="mt-8">
        <SocialBar
          noteId={note.id}
          slug={note.slug}
          title={note.title}
          initialViewCount={note.viewCount || 0}
          initialLikeCount={note.likeCount || 0}
          initialShareCount={note.shareCount || 0}
        />
      </div>

      <Comments noteId={note.id} slug={note.slug} title={note.title} />

      {moreNotes.length > 0 && (
        <div className="mt-16 border-t-2 border-ink pt-10">
          <p className="eyebrow">More journals</p>
          <div className="mt-6 grid grid-cols-1 gap-x-8 gap-y-8 sm:grid-cols-2">
            {moreNotes.map((n) => (
              <Link key={n.slug} href={`/journals/${n.slug}`} className="group">
                {n.featured_image && (
                  <Image
                    src={n.featured_image}
                    alt={n.title}
                    width={400}
                    height={260}
                    className="h-40 w-full object-cover"
                  />
                )}
                <p className="eyebrow mt-3">{n.categories[0] || "Journal"}</p>
                <h4 className="mt-1.5 font-display text-lg text-ink group-hover:text-crimson-bright">
                  {n.title}
                </h4>
              </Link>
            ))}
          </div>
        </div>
      )}
    </article>
  );
}
