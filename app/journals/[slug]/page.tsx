import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { remark } from "remark";
import html from "remark-html";
import type { Metadata } from "next";
import { getNoteBySlug, getMoreNotes } from "@/lib/firestore-notes";
import { getAuthorProfile, getUserByUid, badgeLevel, goldKindOf, isTeamMember, roleLabelFor } from "@/lib/users";
import TeamBadge from "@/components/TeamBadge";
import BadgeToast from "@/components/BadgeToast";
import BoostNudge from "@/components/BoostNudge";
import VerifiedBadge from "@/components/VerifiedBadge";
import { NA_NOTESAPP_PROFILE } from "@/lib/journals-directory";
import SocialBar from "@/components/SocialBar";
import Comments from "@/components/Comments";
import PremiumGate from "@/components/PremiumGate";
import GiftButton from "@/components/GiftButton";
import AdSlot from "@/components/AdSlot";
import { UnverifiedOrgNotice } from "@/components/OrgNotice";

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

  const [processed, moreNotes, authorProfile, coProfiles] = await Promise.all([
    remark().use(html).process(note.content),
    getMoreNotes(note.slug, 4),
    getAuthorProfile(note),
    Promise.all((note.coAuthorUids || []).map((uid) => getUserByUid(uid).catch(() => null))),
  ]);
  const coAuthorProfiles = coProfiles.filter((u): u is NonNullable<typeof u> => !!u && !u.suspended);
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
              src={authorProfile?.avatar || note.author_avatar}
              alt={authorProfile?.displayName || note.author}
              width={44}
              height={44}
              className="h-11 w-11 flex-shrink-0 rounded-full border-2 border-crimson object-cover"
            />
            <div>
              <p className="font-ui text-sm font-semibold text-ink group-hover:text-crimson-bright">
                By {authorProfile?.displayName || note.author}{" "}
                {authorProfile && badgeLevel(authorProfile) && <VerifiedBadge size={14} level={badgeLevel(authorProfile)} goldKind={goldKindOf(authorProfile)} />}
                {authorProfile && isTeamMember(authorProfile) && <TeamBadge size={14} />}{" "}
                <span className="font-mono text-crimson-bright">
                  @{linkedUsername}
                </span>
              </p>
              <p className="mt-0.5 font-mono text-xs uppercase tracking-wide text-slate">
                {authorProfile ? roleLabelFor(authorProfile) : note.author_role}
              </p>
              {note.coAuthors && note.coAuthors.length > 0 && (
                <p className="mt-0.5 text-xs text-slate">with {note.coAuthors.join(", ")}</p>
              )}
            </div>
          </Link>
        ) : (
          <div className="flex items-center gap-3">
            <Image
              src={authorProfile?.avatar || note.author_avatar}
              alt={authorProfile?.displayName || note.author}
              width={44}
              height={44}
              className="h-11 w-11 flex-shrink-0 rounded-full border-2 border-crimson object-cover"
            />
            <div>
              <p className="font-ui text-sm font-semibold text-ink">By {authorProfile?.displayName || note.author}</p>
              <p className="mt-0.5 font-mono text-xs uppercase tracking-wide text-slate">
                {authorProfile ? roleLabelFor(authorProfile) : note.author_role}
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

      {note.writerUsername && note.writerUsername !== note.authorUsername && (
        <p className="mt-3 text-xs text-slate">
          Written by <Link href={`/u/${note.writerUsername}`} className="font-mono text-crimson-bright">@{note.writerUsername}</Link> for{" "}
          <Link href={`/u/${linkedUsername || note.authorUsername}`} className="font-semibold text-ink hover:text-crimson-bright">#{authorProfile?.displayName || note.author}</Link>
        </p>
      )}
      <UnverifiedOrgNotice profile={authorProfile} compact />

      {note.featured_image && (
        <Image
          src={note.featured_image}
          alt={note.title}
          width={900}
          height={520}
          className="mt-8 h-auto w-full object-cover"
        />
      )}

      {authorProfile?.suspended === true ? (
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

      {coAuthorProfiles.length > 0 && (
        <div className="card mt-10 p-6">
          <p className="font-ui text-sm font-bold text-ink">Co-authors — book a session with each</p>
          <p className="mt-1 text-xs text-slate">Sessions are personal: each author has their own calendar, price and payout.</p>
          <ul className="mt-3 space-y-2">
            {coAuthorProfiles.map((c) => (
              <li key={c.uid} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-ink">{c.displayName} <span className="font-mono text-xs text-crimson-bright">@{c.username}</span></span>
                <Link href={`/u/${c.username}`} className="text-xs font-semibold text-crimson underline">View calendar</Link>
              </li>
            ))}
          </ul>
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
          noteAuthor={note.author}
          initialViewCount={note.viewCount || 0}
          initialLikeCount={note.likeCount || 0}
          initialShareCount={note.shareCount || 0}
        />
        {authorProfile && linkedUsername && (
          <div className="mt-4">
            <GiftButton username={linkedUsername} publisherUid={authorProfile.uid} noteId={note.id} label="🎁 Gift this post" />
          </div>
        )}
      </div>

      <AdSlot placement="post" publisher={authorProfile ?? undefined} publisherUid={authorProfile?.uid} />

      <Comments noteId={note.id} slug={note.slug} title={note.title} noteAuthor={note.author} />

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
      <BadgeToast subjectUid={authorProfile?.uid} />
      <BoostNudge
        noteId={note.id}
        title={note.title}
        author={authorProfile?.displayName || note.author}
        authorAvatar={authorProfile?.avatar || note.author_avatar}
        authorUid={authorProfile?.uid}
        views={note.viewCount || 0}
        likes={note.likeCount || 0}
        shares={note.shareCount || 0}
      />
    </article>
  );
}
