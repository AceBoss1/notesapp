"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { getUserByUsername, getCommentsByUser, UserProfile, CommentActivity } from "@/lib/users";
import { getAllNotes, NoteWithComputed } from "@/lib/firestore-notes";
import { getRecentCommentsOnNotes, Comment } from "@/lib/engagement";
import { getFollowerCount } from "@/lib/follows";
import { submitAppeal } from "@/lib/moderation";
import Avatar from "@/components/Avatar";
import FollowButton from "@/components/FollowButton";
import SubscribeButton from "@/components/SubscribeButton";
import VerifiedBadge from "@/components/VerifiedBadge";
import JournalRow from "@/components/JournalRow";
import NotesAppPostRow from "@/components/NotesAppPostRow";
import { STORE_ITEMS } from "@/lib/store";
import { OFFICIAL_NOTESAPP_PROFILE, NA_NOTESAPP_PROFILE, SYNTHETIC_USERNAMES, VERIFIED_USERNAMES } from "@/lib/journals-directory";
import { NOTESAPP_POSTS } from "@/lib/notesapp-posts";

const SUSPENDED_AVATAR = "/images/brand/suspended-avatar.png";

const SLOTS = ["9:00 AM", "11:30 AM", "2:00 PM", "4:30 PM"];

// #NotesApp-only framing for the two founders — display text only,
// never written back into the shared `users` or `notes` documents.
const ROLE_LABELS: Record<string, string> = {
  emmanuel: "Founder & CEO, #NotesApp",
  chimdinma: "Co-Founder & COO, #NotesApp",
};

// Common shape both a real UserProfile and the synthetic @notesapp
// profile can be rendered from.
type DisplayProfile = {
  username: string;
  displayName: string;
  avatar: string;
  bio: string;
  roleLabel: string;
};

export default function ProfilePageClient({ params }: { params: { username: string } }) {
  const isOfficial = params.username === OFFICIAL_NOTESAPP_PROFILE.username;
  const isSocialChannel = params.username === NA_NOTESAPP_PROFILE.username;
  // Both are synthetic — no real Firebase Auth account, no `users`
  // doc — but only @notesapp skips the real /notes collection
  // entirely. @na-notesapp's entries are real, published notes.
  const synthetic = SYNTHETIC_USERNAMES.includes(params.username);

  const [realProfile, setRealProfile] = useState<UserProfile | null | undefined>(
    synthetic ? null : undefined
  );
  const [notes, setNotes] = useState<NoteWithComputed[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [followerCount, setFollowerCount] = useState<number | null>(null);
  const [followerCountUnavailable, setFollowerCountUnavailable] = useState(false);
  // "Activity" means different things for different accounts: for
  // anyone with real authored notes (a founder or @na-notesapp), it's
  // comments OTHERS left on their writing; for an ordinary reader,
  // it's the comments they personally posted elsewhere. @notesapp
  // gets neither — no real Firestore data to show at all.
  const [ownComments, setOwnComments] = useState<CommentActivity[]>([]);
  const [receivedComments, setReceivedComments] = useState<
    (Comment & { noteId: string; noteSlug: string; noteTitle: string })[]
  >([]);
  const [viewer, setViewer] = useState<User | null | undefined>(undefined);
  const [appealText, setAppealText] = useState("");
  const [submittingAppeal, setSubmittingAppeal] = useState(false);

  useEffect(() => onAuthStateChanged(auth, setViewer), []);

  useEffect(() => {
    if (synthetic) return;
    getUserByUsername(params.username)
      .then(setRealProfile)
      .catch(() => setRealProfile(null));
  }, [params.username, synthetic]);

  const profile: DisplayProfile | null | undefined = isOfficial
    ? {
        username: OFFICIAL_NOTESAPP_PROFILE.username,
        displayName: OFFICIAL_NOTESAPP_PROFILE.displayName,
        avatar: OFFICIAL_NOTESAPP_PROFILE.avatar,
        bio: OFFICIAL_NOTESAPP_PROFILE.bio,
        roleLabel: "Official Platform Journal",
      }
    : isSocialChannel
    ? {
        username: NA_NOTESAPP_PROFILE.username,
        displayName: NA_NOTESAPP_PROFILE.displayName,
        avatar: NA_NOTESAPP_PROFILE.avatar,
        bio: NA_NOTESAPP_PROFILE.bio,
        roleLabel: "Official Social Channel",
      }
    : realProfile
    ? {
        username: realProfile.username,
        displayName: realProfile.displayName,
        avatar: realProfile.avatar,
        bio: realProfile.bio,
        roleLabel: ROLE_LABELS[realProfile.username] || realProfile.role,
      }
    : realProfile === null
    ? null
    : undefined;

  useEffect(() => {
    if (!profile) return;
    getFollowerCount(profile.username)
      .then(setFollowerCount)
      .catch((err) => {
        // getCountFromServer occasionally fails with "unavailable".
        // A browser ad-blocker/privacy extension blocking the request
        // (RunAggregationQuery reads as a tracking call to some
        // blocklists) is one plausible, common cause — not a confirmed
        // diagnosis. Don't reach for that explanation by reflex if
        // this starts happening often with real users; check the
        // actual error in the console first. Not worth surfacing as a
        // user-facing error either way; the count just quietly
        // disappears instead of spinning forever.
        console.warn("Follower count unavailable:", err);
        setFollowerCountUnavailable(true);
      });
    // @notesapp has no notes of its own — it's a fully synthetic
    // account, nothing to filter for in the shared /notes collection.
    // @na-notesapp DOES have real notes (authored as "NotesApp" via
    // the toggle in NoteForm.tsx), so it still needs this fetch.
    if (isOfficial) return;
    // Notes are keyed by author display name, not username — same
    // shared /notes collection Precheks reads from, filtered here on
    // the UI side, not in Firestore.
    getAllNotes({ publishedOnly: true })
      .then((all) => setNotes(all.filter((n) => n.author === profile.displayName)))
      .catch(() => setNotes([]));
  }, [profile, isOfficial]);

  useEffect(() => {
    if (isOfficial) return; // @notesapp: no real Firestore data at all
    if (isSocialChannel || realProfile?.role === "admin") {
      getRecentCommentsOnNotes(
        notes.map((n) => n.id),
        5,
        10
      )
        .then(setReceivedComments)
        .catch((err) => {
          console.error("getRecentCommentsOnNotes failed:", err);
          setReceivedComments([]);
        });
    } else if (realProfile?.role === "reader") {
      getCommentsByUser(realProfile.uid, 10)
        .then(setOwnComments)
        .catch((err) => {
          console.error(`getCommentsByUser(${realProfile.uid}) failed:`, err);
          setOwnComments([]);
        });
    }
  }, [notes, isOfficial, isSocialChannel, realProfile]);

  if (profile === undefined) {
    return <div className="py-24 text-center text-sm text-slate">Loading…</div>;
  }

  if (!profile) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-24 text-center">
        <p className="font-display text-2xl text-ink">Profile not found</p>
      </div>
    );
  }

  const storeItems = STORE_ITEMS[profile.username] ?? [];
  const hasPremium = isOfficial || notes.some((n) => n.premium);
  const suspended = realProfile?.suspended === true;
  const verified = VERIFIED_USERNAMES.includes(profile.username) || !!realProfile?.verified;
  const isOwnProfile = !!(viewer && realProfile && viewer.uid === realProfile.uid);
  const canAppeal =
    suspended &&
    isOwnProfile &&
    (realProfile?.suspension?.appealStatus === "none" ||
      realProfile?.suspension?.appealStatus === "rejected");

  async function handleSubmitAppeal() {
    if (!realProfile || !appealText.trim()) return;
    setSubmittingAppeal(true);
    try {
      await submitAppeal(realProfile.uid, appealText.trim());
      const refreshed = await getUserByUsername(realProfile.username);
      setRealProfile(refreshed);
      setAppealText("");
    } finally {
      setSubmittingAppeal(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center">
        <Avatar
          src={suspended ? SUSPENDED_AVATAR : profile.avatar}
          alt={profile.displayName}
          size={88}
        />
        <div>
          <h1 className="flex items-center gap-2 font-display text-3xl text-ink">
            {profile.displayName}
            {verified && !suspended && <VerifiedBadge size={20} />}
          </h1>
          {suspended ? (
            <p className="font-mono text-xs uppercase tracking-eyebrow text-red-700">
              ⚠ Temporarily Suspended · @{profile.username}
            </p>
          ) : (
            <p className="font-mono text-xs uppercase tracking-eyebrow text-crimson-bright">
              {profile.roleLabel} · @{profile.username}
            </p>
          )}
          <p className="mt-2 max-w-lg text-sm text-slate">{profile.bio}</p>
          {!followerCountUnavailable && (
            <p className="mt-2 font-mono text-xs text-slate">
              {followerCount === null ? "…" : followerCount} follower
              {followerCount === 1 ? "" : "s"}
            </p>
          )}
        </div>
        <div className="ml-0 flex shrink-0 flex-wrap gap-3 sm:ml-auto">
          <FollowButton username={profile.username} />
          {hasPremium && <SubscribeButton username={profile.username} />}
          {storeItems.length > 0 && (
            <Link href={`/u/${profile.username}/store`} className="btn-ghost">
              Brand store
            </Link>
          )}
        </div>
      </div>

      {suspended && (
        <div className="card mt-8 border-red-200 bg-red-50 p-6">
          <p className="font-ui text-sm font-bold text-red-800">
            This account is temporarily suspended.
          </p>
          <p className="mt-1 text-sm text-red-700">
            Their posts and comments are hidden while under review.
          </p>
          {isOwnProfile && (
            <div className="mt-4 border-t border-red-200 pt-4">
              {realProfile?.suspension?.appealStatus === "pending" ? (
                <p className="text-sm text-red-700">
                  Your appeal was submitted{" "}
                  {realProfile.suspension.appealedAt &&
                    new Date(realProfile.suspension.appealedAt).toLocaleDateString("en-NG")}{" "}
                  and is awaiting review.
                </p>
              ) : canAppeal ? (
                <>
                  {realProfile?.suspension?.appealStatus === "rejected" && (
                    <p className="mb-3 text-sm text-red-700">
                      Your previous appeal wasn't upheld — status quo remains. You can submit a new one below.
                    </p>
                  )}
                  <textarea
                    rows={3}
                    value={appealText}
                    onChange={(e) => setAppealText(e.target.value)}
                    placeholder="Explain why this suspension should be lifted…"
                    className="w-full border border-red-200 bg-card px-4 py-3 font-body text-sm outline-none focus:border-red-400"
                  />
                  <button
                    onClick={handleSubmitAppeal}
                    disabled={submittingAppeal || !appealText.trim()}
                    className="mt-2 bg-red-800 text-paper font-ui text-sm font-semibold px-5 py-2 hover:bg-red-900 transition-colors disabled:opacity-50"
                  >
                    {submittingAppeal ? "Submitting…" : "Submit Appeal"}
                  </button>
                </>
              ) : null}
            </div>
          )}
        </div>
      )}

      {/* Native booking calendar — a #NotesApp profile-level feature,
          not tied to any per-note field. Not shown on either
          synthetic channel account — there's no one to book. */}
      {!synthetic && (
        <div className="card mt-12 p-7">
          <p className="eyebrow">Native booking calendar</p>
          <h2 className="mt-2 font-display text-2xl text-ink">Book a 1:1 session</h2>
          <p className="mt-2 text-sm text-slate">
            No Calendly redirect, no separate login — pick a time, pay
            inline, get a WhatsApp reminder.
          </p>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {SLOTS.map((slot) => (
              <button
                key={slot}
                onClick={() => setSelectedSlot(slot)}
                className={`rounded-xl2 border px-4 py-3 font-ui text-sm font-semibold transition-colors ${
                  selectedSlot === slot
                    ? "border-crimson bg-crimson text-paper"
                    : "border-rule text-ink hover:border-crimson hover:text-crimson"
                }`}
              >
                {slot}
              </button>
            ))}
          </div>
          {selectedSlot && (
            <div className="mt-6 flex flex-col items-start justify-between gap-4 rounded-xl2 border border-rule bg-paper p-5 sm:flex-row sm:items-center">
              <div>
                <p className="font-ui text-sm font-semibold text-ink">
                  {selectedSlot} · 45 min session
                </p>
                <p className="font-mono text-xs text-slate">₦15,000 · via Paystack / Flutterwave</p>
              </div>
              <span className="btn-primary !px-5 !py-2 text-xs">
                Confirm &amp; pay (demo)
              </span>
            </div>
          )}
        </div>
      )}

      {/* Brand store teaser */}
      {storeItems.length > 0 && (
        <div className="mt-14">
          <div className="flex items-center justify-between">
            <p className="eyebrow">From the brand store</p>
            <Link
              href={`/u/${profile.username}/store`}
              className="font-ui text-xs font-semibold text-crimson hover:text-crimson-bright"
            >
              View all →
            </Link>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3">
            {storeItems.slice(0, 3).map((item) => (
              // eslint-disable-next-line @next/next/no-img-element
              <a
                key={item.title}
                href={item.link}
                target="_blank"
                rel="noopener noreferrer"
                className="card overflow-hidden"
              >
                <img
                  src={item.image}
                  alt={item.title}
                  className="aspect-[3/4] w-full object-cover"
                />
                <p className="p-3 font-ui text-xs font-semibold leading-snug text-ink">
                  {item.title}
                </p>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Their public writing — same /notes documents Precheks shows,
          except for @notesapp, whose "journal" is 5 hardcoded
          explanatory posts (see lib/notesapp-posts.ts) — UI-only, no
          Firestore, same as the rest of this synthetic profile. */}
      {isOfficial ? (
        <div className="mt-14">
          <p className="eyebrow">Journal</p>
          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {NOTESAPP_POSTS.map((post) => (
              <NotesAppPostRow key={post.slug} post={post} />
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-14">
          <p className="eyebrow">Public journal</p>
          {suspended ? (
            <p className="mt-4 text-sm italic text-slate">
              Entries are hidden while this account is temporarily suspended.
            </p>
          ) : notes.length === 0 ? (
            <p className="mt-4 text-sm text-slate">No public entries yet.</p>
          ) : (
            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {notes.map((n) => (
                <JournalRow key={n.id} note={n} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Activity — @notesapp gets none of this, there's no real
          Firestore data behind it. */}
      {!isOfficial && (
        <div className="mt-14">
          <p className="eyebrow">
            {isSocialChannel || realProfile?.role === "admin"
              ? "Recent Comments on Their Notes"
              : "Recent Activity"}
          </p>
          {isSocialChannel || realProfile?.role === "admin" ? (
            receivedComments.length === 0 ? (
              <p className="mt-4 text-sm text-slate">No comments yet.</p>
            ) : (
              <div className="mt-5 divide-y divide-rule">
                {receivedComments.map((c) => (
                  <div key={c.id} className="flex gap-3 py-4 first:pt-0">
                    <Link href={`/u/${c.authorUsername}`} className="flex-shrink-0">
                      <Image
                        src={c.authorAvatar}
                        alt={c.authorDisplayName}
                        width={36}
                        height={36}
                        className="h-9 w-9 rounded-full object-cover"
                      />
                    </Link>
                    <div>
                      <p className="font-mono text-xs text-slate">
                        <Link
                          href={`/u/${c.authorUsername}`}
                          className="font-semibold text-ink hover:text-crimson-bright"
                        >
                          {c.authorDisplayName}
                        </Link>{" "}
                        commented on{" "}
                        <Link href={`/journals/${c.noteSlug}`} className="text-crimson-bright hover:text-ink">
                          {c.noteTitle}
                        </Link>
                      </p>
                      <p className="mt-1.5 text-sm text-ink font-body">
                        &ldquo;{c.content}&rdquo;
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : ownComments.length === 0 ? (
            <p className="mt-4 text-sm text-slate">No comments yet.</p>
          ) : (
            <div className="mt-5 divide-y divide-rule">
              {ownComments.map((c) => (
                <Link
                  key={c.id}
                  href={`/journals/${c.noteSlug}`}
                  className="block py-4 first:pt-0 group"
                >
                  <p className="font-mono text-xs text-slate">
                    Commented on{" "}
                    <span className="text-crimson-bright group-hover:text-ink">
                      {c.noteTitle}
                    </span>
                  </p>
                  <p className="mt-1.5 text-sm text-ink font-body">
                    &ldquo;{c.content}&rdquo;
                  </p>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
