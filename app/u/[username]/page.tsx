"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getUserByUsername, UserProfile } from "@/lib/users";
import { getAllNotes, NoteWithComputed } from "@/lib/firestore-notes";
import { getFollowerCount } from "@/lib/follows";
import Avatar from "@/components/Avatar";
import FollowButton from "@/components/FollowButton";
import SubscribeButton from "@/components/SubscribeButton";
import JournalRow from "@/components/JournalRow";
import { STORE_ITEMS } from "@/lib/store";
import { OFFICIAL_NOTESAPP_PROFILE } from "@/lib/journals-directory";

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

export default function ProfilePage({ params }: { params: { username: string } }) {
  const isOfficial = params.username === OFFICIAL_NOTESAPP_PROFILE.username;

  const [realProfile, setRealProfile] = useState<UserProfile | null | undefined>(
    isOfficial ? null : undefined
  );
  const [notes, setNotes] = useState<NoteWithComputed[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [followerCount, setFollowerCount] = useState<number | null>(null);

  useEffect(() => {
    if (isOfficial) return;
    getUserByUsername(params.username)
      .then(setRealProfile)
      .catch(() => setRealProfile(null));
  }, [params.username, isOfficial]);

  const profile: DisplayProfile | null = isOfficial
    ? {
        username: OFFICIAL_NOTESAPP_PROFILE.username,
        displayName: OFFICIAL_NOTESAPP_PROFILE.displayName,
        avatar: OFFICIAL_NOTESAPP_PROFILE.avatar,
        bio: OFFICIAL_NOTESAPP_PROFILE.bio,
        roleLabel: "Official Platform Journal",
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
    getFollowerCount(profile.username).then(setFollowerCount);
    // @notesapp has no notes of its own — it's a platform account, not
    // an author in the shared /notes collection.
    if (isOfficial) return;
    // Notes are keyed by author display name, not username — same
    // shared /notes collection Precheks reads from, filtered here on
    // the UI side, not in Firestore.
    getAllNotes({ publishedOnly: true })
      .then((all) => setNotes(all.filter((n) => n.author === profile.displayName)))
      .catch(() => setNotes([]));
  }, [profile, isOfficial]);

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
  const hasPremium = notes.some((n) => n.premium);

  return (
    <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center">
        <Avatar src={profile.avatar} alt={profile.displayName} size={88} />
        <div>
          <h1 className="font-display text-3xl text-ink">{profile.displayName}</h1>
          <p className="font-mono text-xs uppercase tracking-eyebrow text-crimson-bright">
            {profile.roleLabel} · @{profile.username}
          </p>
          <p className="mt-2 max-w-lg text-sm text-slate">{profile.bio}</p>
          <p className="mt-2 font-mono text-xs text-slate">
            {followerCount === null ? "…" : followerCount} follower
            {followerCount === 1 ? "" : "s"}
          </p>
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

      {/* Native booking calendar — a #NotesApp profile-level feature,
          not tied to any per-note field. Not shown on the official
          platform account — there's no one to book. */}
      {!isOfficial && (
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

      {/* Their public writing — same /notes documents Precheks shows */}
      {!isOfficial && (
        <div className="mt-14">
          <p className="eyebrow">Public journal</p>
          {notes.length === 0 ? (
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
    </div>
  );
}
