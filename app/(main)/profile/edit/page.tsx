"use client";

import WorkFields from "@/components/WorkFields";
import { cleanWork, type Work } from "@/lib/profile-work";
import MomentSettings from "@/components/moments/MomentSettings";
import SiteReminder from "@/components/SiteReminder";
import { canChooseSiteTheme } from "@/lib/site-themes";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { getUserByUid, updateProfile, UserProfile } from "@/lib/users";
import { uploadToR2 } from "@/lib/upload";
import { SocialLinks } from "@/lib/admin";
import { cleanSocial } from "@/lib/social-links";
import { notePictureChange } from "@/lib/profile-pictures-client";
import BadgeCard from "@/components/BadgeCard";
import PageHero from "@/components/PageHero";
import ScrollToHash from "@/components/ScrollToHash";
import { DROP_RING, useFileDrop } from "@/lib/useFileDrop";

// The address, a handle or (WhatsApp) a phone number all work: lib/social-links.ts turns them into links when you save.
const SOCIAL_FIELDS: { key: keyof SocialLinks; label: string; hint: string }[] = [
  { key: "linkedin", label: "LinkedIn", hint: "linkedin.com/in/yourname" },
  { key: "instagram", label: "Instagram", hint: "@yourname" },
  { key: "facebook", label: "Facebook", hint: "facebook.com/yourname" },
  { key: "twitter", label: "X / Twitter", hint: "@yourname" },
  { key: "tiktok", label: "TikTok", hint: "@yourname" },
  { key: "whatsapp", label: "WhatsApp", hint: "0803 123 4567" },
  { key: "website", label: "Website", hint: "yourwebsite.com" },
];

export default function ProfileEditPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null | undefined>(
    undefined
  );
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [avatar, setAvatar] = useState("");
  const [social, setSocial] = useState<SocialLinks>({});
  const [work, setWork] = useState<Work>({});
  const [uploading, setUploading] = useState(false);
  // A picture dropped on the form, or pasted into it, becomes the profile picture.
  const avatarDrop = useFileDrop((fs) => { const f = fs.find((x) => x.type.startsWith("image/")); if (f) void uploadAvatar(f); }, true);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [unreadable, setUnreadable] = useState<string[]>([]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace("/login");
        return;
      }
      const p = await getUserByUid(user.uid);
      setProfile(p);
      if (p) {
        setDisplayName(p.displayName);
        setBio(p.bio);
        setAvatar(p.avatar);
        setSocial(p.social || {});
        setWork({ industry: p.industry, jobTitle: p.jobTitle, workplace: p.workplace });
      }
    });
    return unsub;
  }, [router]);

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) await uploadAvatar(file);
  }
  async function uploadAvatar(file: File) {
    setUploading(true);
    setUploadError(null);
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error("Image must be under 5 MB.");
      const url = await uploadToR2(file, "avatar");
      setAvatar(url);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setSaving(true);
    setSaved(false);
    // Links are saved as full addresses so they show on the profile; what we can't read is kept as typed (and flagged) so
    // nothing is lost.
    const { clean, unreadable: bad } = cleanSocial(social);
    const kept: SocialLinks = { ...clean, ...Object.fromEntries(bad.map((k) => [k, social[k]])) };
    setSocial(kept);
    setUnreadable(bad.map((k) => SOCIAL_FIELDS.find((f) => f.key === k)?.label ?? k));
    await updateProfile(profile.uid, { displayName, bio, avatar, social: kept, ...cleanWork(profile.accountKind === "organisation" ? { industry: work.industry } : work) });
    if (avatar && avatar !== profile.avatar) { await notePictureChange(avatar, profile.avatar); setProfile({ ...profile, avatar }); }
    setSaving(false);
    setSaved(true);
  }

  if (profile === undefined) {
    return <div className="px-6 py-24 text-center text-slate">Loading…</div>;
  }
  if (profile === null) {
    return (
      <div className="px-6 py-24 text-center text-slate">
        Profile not found.
      </div>
    );
  }

  return (
    <>
      <ScrollToHash />
      <PageHero compact max="max-w-2xl" eyebrow={`@${profile.username}`} title={<>Edit Profile</>}>
        <p>Change your username, email or password in{" "}
        <Link href="/profile/account" className="text-crimson">Account settings</Link>.</p>
      </PageHero>
      <section className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8 py-10">

      <div className="mt-6">
        <BadgeCard />
      </div>
      <SiteReminder profile={profile} className="mt-6" />

      <form onSubmit={handleSubmit} className={`relative mt-8 grid grid-cols-[minmax(0,1fr)] gap-6 ${avatarDrop.dragging ? DROP_RING : ""}`} {...avatarDrop.bind}>
        {avatarDrop.dragging && <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded bg-paper/80 font-ui text-sm font-bold text-crimson">Drop to use as your profile picture</div>}
        <label className="block">
          <span className="eyebrow">Display Name</span>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="mt-2 w-full rounded-xl border border-rule bg-card px-4 py-3 font-body focus:border-gold outline-none"
          />
        </label>

        <label className="block">
          <span className="eyebrow">Bio</span>
          <textarea
            rows={3}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            className="mt-2 w-full rounded-xl border border-rule bg-card px-4 py-3 font-body focus:border-gold outline-none"
          />
        </label>

        <WorkFields value={work} onChange={setWork} orgOnly={profile?.accountKind === "organisation"} inputClass="mt-1 w-full rounded-xl border border-rule bg-card px-4 py-3 font-body focus:border-gold outline-none" />
        {profile && profile.accountKind !== "organisation" && (
          <p className="text-sm text-slate">
            Is this account for a company, NGO, church, school or club?{" "}
            <Link href="/organisation" className="text-crimson underline">Make it an organisation</Link>: you keep your username, posts and followers, and add your CAC registration number.
          </p>
        )}

        <label className="block">
          <span className="eyebrow">Avatar</span>
          <div className="mt-2 flex flex-wrap items-center gap-4">
            {avatar && (
              <Image
                src={avatar}
                alt="Avatar"
                width={64}
                height={64}
                className="rounded-full object-cover w-16 h-16"
              />
            )}
            <input type="file" accept="image/*" onChange={handleAvatarUpload} className="min-w-0 max-w-full" />
            <span className="text-[11px] text-slate">or drag a picture onto this page, or paste one</span>
          </div>
          {uploading && <p className="text-xs text-slate mt-1">Uploading…</p>}
          {uploadError && <p className="text-xs text-crimson mt-1">{uploadError}</p>}
        </label>

        <div id="links" className="scroll-mt-28">
          <p className="eyebrow">Social Links</p>
          <p className="mt-1 text-xs text-slate">Paste the address, or just your @handle; for WhatsApp, your phone number. They show as icons on your profile.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
            {SOCIAL_FIELDS.map(({ key, label, hint }) => (
              <label key={key} className="block">
                <span className="text-xs text-slate">{label}</span>
                <input
                  value={social[key] || ""}
                  onChange={(e) =>
                    setSocial((s) => ({ ...s, [key]: e.target.value }))
                  }
                  placeholder={hint}
                  className="mt-1 w-full border border-rule bg-card px-3 py-2 text-sm focus:border-gold outline-none"
                />
              </label>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            type="submit"
            disabled={saving || uploading}
            className="bg-gold text-ink font-ui font-semibold px-6 py-3 hover:bg-gold-deep hover:text-paper transition-colors disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save Profile"}
          </button>
          {saved && unreadable.length > 0 && (
            <p role="alert" className="text-sm text-crimson">We couldn&apos;t read your {unreadable.join(", ")} link, so it won&apos;t show on your profile. Paste the full address (or your @handle) and save again.</p>
          )}
          {saved && (
            <p className="text-sm text-slate">
              Saved — <Link href={`/u/${profile.username}`} className="text-crimson underline">view your public profile</Link>.
              Your profile page updates right away; lists and search can take a few minutes.
            </p>
          )}
        </div>
      </form>
      {canChooseSiteTheme(profile) && (
        <section className="card mt-10 p-6" aria-labelledby="site-h">
          <h2 id="site-h" className="font-display text-xl text-ink">Your site</h2>
          <p className="mt-1 text-sm text-slate">Your own website, with your profile, journals and shop: choose its theme and what it shows, and write its About and Contact pages.</p>
          <Link href="/profile/site" className="btn-primary mt-4 inline-block !px-4 !py-2 text-xs">Set up your site</Link>
        </section>
      )}
      <MomentSettings />
    </section>
    </>
  );
}
