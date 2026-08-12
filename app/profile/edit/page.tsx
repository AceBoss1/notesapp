"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { getUserByUid, updateProfile, UserProfile } from "@/lib/users";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { SocialLinks } from "@/lib/admin";

const SOCIAL_FIELDS: { key: keyof SocialLinks; label: string }[] = [
  { key: "linkedin", label: "LinkedIn URL" },
  { key: "instagram", label: "Instagram URL" },
  { key: "facebook", label: "Facebook URL" },
  { key: "twitter", label: "X / Twitter URL" },
  { key: "whatsapp", label: "WhatsApp URL" },
  { key: "website", label: "Website URL" },
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
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

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
      }
    });
    return unsub;
  }, [router]);

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadToCloudinary(file);
      setAvatar(url);
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setSaving(true);
    setSaved(false);
    await updateProfile(profile.uid, { displayName, bio, avatar, social });
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
    <section className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8 py-14">
      <p className="eyebrow">@{profile.username}</p>
      <h1 className="font-display text-4xl mt-3">Edit Profile</h1>

      <form onSubmit={handleSubmit} className="mt-8 grid gap-6">
        <label className="block">
          <span className="eyebrow">Display Name</span>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="mt-2 w-full border border-rule bg-card px-4 py-3 font-body focus:border-gold outline-none"
          />
        </label>

        <label className="block">
          <span className="eyebrow">Bio</span>
          <textarea
            rows={3}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            className="mt-2 w-full border border-rule bg-card px-4 py-3 font-body focus:border-gold outline-none"
          />
        </label>

        <label className="block">
          <span className="eyebrow">Avatar</span>
          <div className="mt-2 flex items-center gap-4">
            {avatar && (
              <Image
                src={avatar}
                alt="Avatar"
                width={64}
                height={64}
                className="rounded-full object-cover w-16 h-16"
              />
            )}
            <input type="file" accept="image/*" onChange={handleAvatarUpload} />
          </div>
          {uploading && <p className="text-xs text-slate mt-1">Uploading…</p>}
        </label>

        <div>
          <p className="eyebrow">Social Links</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
            {SOCIAL_FIELDS.map(({ key, label }) => (
              <label key={key} className="block">
                <span className="text-xs text-slate">{label}</span>
                <input
                  value={social[key] || ""}
                  onChange={(e) =>
                    setSocial((s) => ({ ...s, [key]: e.target.value }))
                  }
                  placeholder="https://…"
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
          {saved && <p className="text-sm text-slate">Saved.</p>}
        </div>
      </form>
    </section>
  );
}
