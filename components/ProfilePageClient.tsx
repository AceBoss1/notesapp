"use client";

import PlaysLife from "@/components/life/PlaysLife";
import PartnerBadges from "@/components/partners/PartnerBadges";
import LinkedText from "@/components/LinkedText";
import { headline } from "@/lib/profile-work";
import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { recordView } from "@/lib/track";
import { getUserByUsername, getCommentsByUser, badgeLevel, goldKindOf, isTeamMember, canPublish, roleLabelFor, UserProfile, CommentActivity, Suspension } from "@/lib/users";
import { NameBadgeIcons } from "@/components/PersonName";
import { NO_BADGES } from "@/lib/name-badges";
import { GOLD_BADGE_TITLE, type BadgeLevel } from "@/lib/badges";
import { getAllNotes, isNoteBy, NoteWithComputed } from "@/lib/firestore-notes";
import { linkText, profileLinks } from "@/components/SocialLinksRow";
import { getRecentCommentsOnNotes, Comment } from "@/lib/engagement";
import { getFollowerCount, getFollowedUsernames } from "@/lib/follows";
import { describeUntil } from "@/lib/suspension-length";
import { submitAppeal, getSuspension } from "@/lib/moderation";
import Avatar from "@/components/Avatar";
import FollowButton from "@/components/FollowButton";
import { ADMIN_PROFILES } from "@/lib/admin";
import OfficialFollowControl from "@/components/OfficialFollowControl";
import PresenceText from "@/components/PresenceText";
import { usePresence } from "@/lib/presence-client";
import MomentRing from "@/components/moments/MomentRing";
import MessageButton from "@/components/messages/MessageButton";
import SubscribeButton from "@/components/SubscribeButton";
import BookingCard from "@/components/BookingCard";
import PpmBook from "@/components/ppm/PpmBook";
import ScrollToHash from "@/components/ScrollToHash";
import GiftButton from "@/components/GiftButton";
import GiftShowWatcher from "@/components/GiftShowWatcher";
import BadgeToast from "@/components/BadgeToast";
import { OrgLabel, UnverifiedOrgNotice } from "@/components/OrgNotice";
import ProfileTabs from "@/components/ProfileTabs";
import BookSessionButton from "@/components/BookSessionButton";
import { getStoreItems, StoreItem } from "@/lib/store";
import AdSlot from "@/components/AdSlot";
import RecommendationsPanel from "@/components/RecommendationsPanel";
import { OFFICIAL_NOTESAPP_PROFILE, NA_NOTESAPP_PROFILE, SYNTHETIC_USERNAMES, VERIFIED_USERNAMES } from "@/lib/journals-directory";
import { ProfileLiveBanner } from "@/components/lives/ProfileLive";
import ProfileHeader, { type Fact } from "@/components/profile/ProfileHeader";
import ProfileAbout, { type AboutRow } from "@/components/profile/ProfileAbout";
import ProfileMenu, { type MenuItem } from "@/components/profile/ProfileMenu";
import { BriefcaseIcon, BuildingIcon, CalendarIcon, CameraIcon, DotsIcon, GaugeIcon, LinkIcon, LiveIcon, PencilIcon, PlusIcon, SettingsIcon, TagIcon, TrophyIcon, WalletIcon } from "@/components/profile/icons";
import { AcademyIcon, MarketIcon, PenIcon } from "@/components/shell/icons";
import { workRows } from "@/lib/profile-view";
import { NOTESAPP_POSTS } from "@/lib/notesapp-posts";
import { ACADEMY_LIVE } from "@/lib/courses";
import { MEDIA_LIVE } from "@/lib/media-rules";

const SUSPENDED_AVATAR = "/images/brand/suspended-avatar.png";


// #NotesApp-only framing for the two founders — display text only,
// never written back into the shared `users` or `notes` documents.


// Common shape both a real UserProfile and the synthetic @notesapp
// profile can be rendered from.
type DisplayProfile = {
  username: string;
  displayName: string;
  avatar: string;
  bio: string;
  roleLabel: string;
  headline?: string; // "CEO at Acme", from the member's optional role and workplace
};

export default function ProfilePageClient({ params, initialTab }: { params: { username: string }; initialTab?: "media" }) {
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
  const [notesLoaded, setNotesLoaded] = useState(false);

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
  // Private suspensions/{uid} record — only readable by the member.
  const [suspension, setSuspension] = useState<Suspension | null>(null);
  const [storeItems, setStoreItems] = useState<StoreItem[]>([]);
  // How many accounts you follow: on your own profile only (it isn't public; browsers may read only their own follows).
  const [followingCount, setFollowingCount] = useState<number | null>(null);

  useEffect(() => onAuthStateChanged(auth, setViewer), []);
  useEffect(() => {
    if (!viewer || !realProfile || viewer.uid !== realProfile.uid) { setFollowingCount(null); return; }
    getFollowedUsernames(viewer.uid).then((l) => setFollowingCount(l.length)).catch(() => setFollowingCount(null));
  }, [viewer, realProfile]);
  useEffect(() => {
    if (params.username && !isOfficial && !isSocialChannel) {
      getStoreItems(realProfile?.uid, params.username).then(setStoreItems);
    }
  }, [params.username, realProfile?.uid, isOfficial, isSocialChannel]);
  useEffect(() => {
    if (viewer && realProfile && viewer.uid === realProfile.uid && realProfile.suspended) {
      getSuspension(realProfile.uid).then(setSuspension);
    }
  }, [viewer, realProfile]);
  useEffect(() => {
    if (!synthetic) recordView("profile", params.username);
  }, [params.username, synthetic]);

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
        roleLabel: roleLabelFor(realProfile),
        headline: headline(realProfile),
      }
    : realProfile === null
    ? null
    : undefined;

  // "Joined October 2026" — from the account's creation time (the official channels have none).
  const joinedAt = realProfile?.createdAt ? new Date(realProfile.createdAt) : null;
  const joined = joinedAt && !Number.isNaN(joinedAt.getTime()) ? joinedAt.toLocaleDateString("en-NG", { month: "long", year: "numeric" }) : "";

  // Depend on the plain values, never on the `profile` object: it is rebuilt on every render, so listing it here made this
  // effect run after every render, and every run set state (a new notes array), which rendered again, which ran it again,
  // without end. That loop re-fetched every note and the follower count dozens of times a second and froze devices.
  const profileUsername = profile?.username;
  const profileDisplayName = profile?.displayName;
  const profileUid = realProfile?.uid;
  useEffect(() => {
    if (!profileUsername || profileDisplayName === undefined) return;
    getFollowerCount(profileUsername)
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
      .then((all) => setNotes(all.filter((n) => isNoteBy(n, { uid: profileUid, username: profileUsername, displayName: profileDisplayName }))))
      .catch(() => setNotes([]))
      .finally(() => setNotesLoaded(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileUsername, profileDisplayName, profileUid, isOfficial]);

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

  // The status line under the name, for people you follow and who follow you back (the server decides).
  const presence = usePresence(viewer && realProfile && viewer.uid !== realProfile.uid ? [realProfile.uid] : []);

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

  const hasPremium = isOfficial || notes.some((n) => n.premium);
  const suspended = realProfile?.suspended === true;
  // Someone who only sells: with no journal entries, the store is what the page is about.
  const storeFirst = !isOfficial && !isSocialChannel && notesLoaded && notes.length === 0 && storeItems.length > 0 && !suspended;
  const badge: BadgeLevel = VERIFIED_USERNAMES.includes(profile.username) ? "verified" : realProfile ? badgeLevel(realProfile) : null;
  const isOwnProfile = !!(viewer && realProfile && viewer.uid === realProfile.uid);
  const canAppeal =
    suspended &&
    isOwnProfile &&
    (suspension?.appealStatus === "none" || suspension?.appealStatus === "rejected");

  async function handleSubmitAppeal() {
    if (!realProfile || !appealText.trim()) return;
    setSubmittingAppeal(true);
    try {
      await submitAppeal(realProfile.uid, appealText.trim());
      setSuspension(await getSuspension(realProfile.uid));
      setAppealText("");
    } finally {
      setSubmittingAppeal(false);
    }
  }

  const isOwnerViewer = !!viewer?.email && Object.keys(ADMIN_PROFILES)[0]?.toLowerCase() === viewer.email.toLowerCase();

  // People get a circle, organisations a rounded square.
  const isOrgAcct = realProfile?.accountKind === "organisation";
  const gold = !suspended && badge === "gold" ? goldKindOf(realProfile) : undefined;
  const firstLink = profileLinks(realProfile?.social)[0];

  // Under the name: the key facts as icon rows (only what the profile has; work is hidden while suspended).
  const facts: Fact[] = [
    ...(!suspended && profile.headline ? [{ key: "work", icon: <BriefcaseIcon className="h-[18px] w-[18px]" />, text: profile.headline }] : []),
    ...(firstLink ? [{ key: "link", icon: <LinkIcon className="h-[18px] w-[18px]" />, text: linkText(firstLink.key, firstLink.href), href: firstLink.href, external: true }] : []),
  ];
  // The About sections on the All tab.
  const details: AboutRow[] = [
    ...(joined ? [{ key: "joined", icon: <CalendarIcon />, text: `Joined ${joined}` }] : []),
    ...(isOrgAcct ? [{ key: "org", icon: <BuildingIcon />, text: "Organisation", sub: realProfile?.org?.rcStatus === "verified" ? "Registration confirmed" : "Registration not yet confirmed" }] : []),
    ...(gold ? [{ key: "gold", icon: <TagIcon />, text: GOLD_BADGE_TITLE[gold].replace("Gold badge — ", "Gold ✔ · ") }] : []),
  ];
  // No repeats (owner, 22 Nov 2026): the role is under the name and the job and first link are in the facts above, so the sections only
  // add what the header doesn't show (the industry, the other links).
  const allWork = suspended ? [] : workRows(realProfile);
  const work: AboutRow[] = allWork.filter((r) => !(r.kind === "role" && facts.some((f) => f.key === "work"))).map((r) => ({ key: r.key, icon: r.kind === "industry" ? <TagIcon /> : <BriefcaseIcon />, text: r.text, ...(r.sub ? { sub: r.sub } : {}) }));
  const moreLinks = profileLinks(realProfile?.social).length > 1;
  const hasAbout = isOwnProfile || details.length > 0 || work.length > 0 || moreLinks;

  const own = isOwnProfile && realProfile;
  const ic = "h-[18px] w-[18px]";
  // + Create: everything you can start from your profile.
  const createItems: MenuItem[] = own ? [
    canPublish(realProfile) ? { href: "/write", label: "Write a journal entry", icon: <PenIcon className={ic} /> } : { href: "/profile/publishing", label: "Start publishing", note: "Write journal entries and earn", icon: <PenIcon className={ic} /> },
    { href: "/lives/start", label: "Go live", icon: <LiveIcon className={ic} /> },
    { href: `/u/${realProfile.username}/store`, label: "Add to your store", icon: <MarketIcon className={ic} /> },
    { href: "/events", label: "An event", icon: <CalendarIcon className={ic} /> },
    ...(ACADEMY_LIVE ? [{ href: "/academy/teach", label: "A course", icon: <AcademyIcon className={ic} /> }] : []),
    ...(MEDIA_LIVE ? [{ href: "/profile/media", label: "Media: videos and pictures", icon: <CameraIcon className={ic} /> }] : []),
  ] : [];
  // ⋯: the rest of what you'd manage (the old "Manage profile" menu, every link kept).
  const manageItems: MenuItem[] = own ? [
    ...(canPublish(realProfile) ? [{ href: "/write", label: "Write" }] : []),
    { href: `/u/${realProfile.username}/store`, label: "My store" },
    { href: "/profile/edit", label: "Edit profile", icon: <PencilIcon className={ic} /> },
    { href: "/profile/publishing", label: "Rates & payouts", icon: <WalletIcon className={ic} /> },
    ...(realProfile.accountKind === "organisation" ? [{ href: "/organisation", label: "Organisation", icon: <BuildingIcon className={ic} /> }] : []),
    { href: "/profile/analytics", label: "Analytics", icon: <GaugeIcon className={ic} /> },
    { href: "/profile/account", label: "Account settings", icon: <SettingsIcon className={ic} /> },
  ] : [];

  const subscribe = (hasPremium || (!synthetic && !suspended)) && (
    <div id="subscribe" className="scroll-mt-28 rounded-full">
      <SubscribeButton username={profile.username} publisherUid={realProfile?.uid} creatorName={profile.displayName} />
    </div>
  );
  const topFans = !synthetic && !suspended && (
    <Link href={`/u/${profile.username}/fans`} className="btn-ghost"><TrophyIcon className="h-4 w-4" /> Top fans</Link>
  );

  return (
    <div>
      <ProfileHeader
        square={isOrgAcct}
        avatar={!suspended && !synthetic && realProfile ? (
          // A ring when the member has moments you can see (only when Moments is switched on); a camera on your own.
          <MomentRing username={profile.username} uid={realProfile.uid} name={profile.displayName} isOwn={isOwnProfile} avatar={profile.avatar} square={isOrgAcct}>
            <Avatar square={isOrgAcct} src={profile.avatar} alt={profile.displayName} size={128} />
          </MomentRing>
        ) : (
          <Avatar square={isOrgAcct} src={suspended ? SUSPENDED_AVATAR : profile.avatar} alt={profile.displayName} size={128} />
        )}
        name={<>
          {/* inline, so the badges follow the last word when a long name wraps */}
          {profile.displayName}
          <NameBadgeIcons username={profile.username} size={22} badges={suspended ? NO_BADGES : { level: badge, goldKind: goldKindOf(realProfile), team: VERIFIED_USERNAMES.includes(profile.username) || (!!realProfile && isTeamMember(realProfile)) }} />
          <OrgLabel profile={realProfile} />
        </>}
        eyebrow={<>
          {suspended ? (
            <p className="font-mono text-xs uppercase tracking-eyebrow text-red-700">Temporarily suspended · @{profile.username}</p>
          ) : (
            <p className="font-mono text-xs uppercase tracking-eyebrow text-crimson-bright">@{profile.username} · {profile.roleLabel}</p>
          )}
          {viewer && realProfile && viewer.uid !== realProfile.uid && <PresenceText status={presence.statuses[realProfile.uid]} className="mt-1" />}
        </>}
        bio={profile.bio}
        facts={facts}
        stats={{
          username: profile.username,
          followers: followerCountUnavailable ? "off" : followerCount,
          following: isOwnProfile ? followingCount : undefined,
          posts: isOfficial ? NOTESAPP_POSTS.length : notesLoaded && !suspended ? notes.length : null,
          // The lists (they ask a visitor to sign in, and honour each member's privacy switch); not while suspended.
          lists: !suspended,
          onPosts: () => { history.replaceState(null, "", "#posts"); window.dispatchEvent(new HashChangeEvent("hashchange")); },
        }}
        listsOwner={isOwnerViewer && profile.username === NA_NOTESAPP_PROFILE.username}
        actions={own ? (
          <>
            {/* Your own profile: Dashboard (My account: analytics, money, store, growth) and + Create, then ⋯ for the rest. */}
            {/* Each main button sits in its own box so the two share the row equally whatever their padding. */}
            <div><Link href="/profile/analytics" className="btn-primary"><GaugeIcon className="h-[18px] w-[18px]" /> Dashboard</Link></div>
            <ProfileMenu label="Create" align="right" button={<><PlusIcon className="h-[18px] w-[18px]" /> Create</>} items={createItems} />
            <ProfileMenu className="profile-main-fixed" label="More for your profile" align="right" button={<DotsIcon className="h-5 w-5" />} items={manageItems} />
          </>
        ) : (
          <>
            {/* Someone else's: Follow (✓ Following once you do) and Message side by side. */}
            <div className="[&>span]:flex [&>span]:!items-stretch [&>div]:!w-full"><FollowButton username={profile.username} /></div>
            {!synthetic && !suspended && <div><MessageButton username={profile.username} profileUid={realProfile?.uid} label="Message" /></div>}
          </>
        )}
        more={<>
          {subscribe}
          {!own && !synthetic && !suspended && <BookSessionButton publisherUid={realProfile?.uid} />}
          {!own && !synthetic && <GiftButton username={profile.username} publisherUid={realProfile?.uid} toName={profile.displayName} label="Gift me" />}
          {topFans}
          {viewer && !suspended && <OfficialFollowControl username={profile.username} />}
          {!synthetic && <GiftShowWatcher uid={realProfile?.uid} toName={profile.displayName} />}
        </>}
      >
        {!suspended && <PlaysLife uid={profileUid} className="mt-3" />}
        {!suspended && <PartnerBadges uid={profileUid} className="mt-2" />}
        {!suspended && <div><ProfileLiveBanner username={profile.username} /></div>}
        {!suspended && <UnverifiedOrgNotice profile={realProfile} compact />}
      </ProfileHeader>

    <div className="mx-auto max-w-5xl px-4 pb-16 sm:px-6 lg:px-8">
      {suspended && (
        <div className="card mt-8 border-red-200 bg-red-50 p-6">
          <p className="font-ui text-sm font-bold text-red-800">
            This account is temporarily suspended{suspension?.until ? ` ${describeUntil(suspension.until)}` : ""}.
          </p>
          <p className="mt-1 text-sm text-red-700">
            Their posts and comments are hidden while under review.
          </p>
          {isOwnProfile && (
            <div className="mt-4 border-t border-red-200 pt-4">
              {suspension?.appealStatus === "pending" ? (
                <p className="text-sm text-red-700">
                  Your appeal was submitted{" "}
                  {suspension.appealedAt &&
                    new Date(suspension.appealedAt).toLocaleDateString("en-NG")}{" "}
                  and is awaiting review.
                </p>
              ) : canAppeal ? (
                <>
                  {suspension?.appealStatus === "rejected" && (
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

      {/* All · Posts · Media · Gifts · Store · Courses · Events (components/ProfileTabs.tsx). All holds the About sections, the booking card,
          the latest posts and store items, recommendations and recent activity. */}
      <ProfileTabs username={profile.username} owner={{ username: profile.username, displayName: profile.displayName, avatar: profile.avatar, role: profile.roleLabel, isOrg: isOrgAcct }}
        notes={notes} notesLoaded={notesLoaded || isOfficial} storeItems={storeItems} isOfficial={isOfficial} suspended={suspended} storeFirst={storeFirst} initialTab={initialTab} synthetic={synthetic} isOwn={isOwnProfile}
        about={hasAbout ? <ProfileAbout own={isOwnProfile} details={details} work={work} hasWork={allWork.length > 0} social={realProfile?.social} skipFirstLink={!!firstLink} /> : null}
        book={!synthetic ? (
          // Paid 1:1 sessions at the publisher's own rate: hidden until they switch it on in /profile/publishing ("Book a session" above
          // comes here), and pay-per-minute voice and video sessions (lib/ppm.ts), hidden unless offered. Not on synthetic channel accounts.
          <div id="book" className="mb-8 scroll-mt-28 empty:hidden">
            <BookingCard username={profile.username} publisherUid={realProfile?.uid} viewer={viewer} />
            <PpmBook username={profile.username} viewer={viewer} />
          </div>
        ) : null}
        after={<>
          {!suspended && !synthetic && realProfile && <div className="mt-10"><RecommendationsPanel subjectUid={realProfile.uid} subjectName={profile.displayName} user={viewer} /></div>}
        {/* Activity — @notesapp gets none of this, there's no real
            Firestore data behind it. */}
        {!isOfficial && (
          <section className="mt-10" aria-label="Recent activity">
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
                          </Link>
                          <NameBadgeIcons username={c.authorUsername} size={13} />{" "}
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
          </section>
        )}
        </>}
      />

      <AdSlot placement="profile" publisher={realProfile ?? undefined} publisherUid={realProfile?.uid} />

      <ScrollToHash />
      {badge && !suspended && <BadgeToast subjectUid={realProfile?.uid} />}
    </div>
    </div>
  );
}
