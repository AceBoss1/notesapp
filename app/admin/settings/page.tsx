"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAdminAuth } from "@/lib/useAdminAuth";
import { getSiteSettings, updateSiteSettings, SiteSettings } from "@/lib/settings";
import { SocialLinks } from "@/lib/admin";

const SOCIAL_FIELDS: { key: keyof SocialLinks; label: string }[] = [
  { key: "linkedin", label: "LinkedIn URL" },
  { key: "instagram", label: "Instagram URL" },
  { key: "facebook", label: "Facebook URL" },
  { key: "twitter", label: "X / Twitter URL" },
  { key: "website", label: "Website URL" },
];

export default function AdminSettingsPage() {
  const { user, loading } = useAdminAuth();
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (user) getSiteSettings().then(setSettings);
  }, [user]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!settings) return;
    setSaving(true);
    setSaved(false);
    await updateSiteSettings(settings);
    setSaving(false);
    setSaved(true);
  }

  if (loading || !user || !settings) {
    return <div className="px-6 py-24 text-center text-slate">Loading…</div>;
  }

  return (
    <section className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8 py-14">
      <Link
        href="/admin"
        className="font-ui text-xs font-semibold uppercase tracking-wideish text-crimson-bright"
      >
        ← Dashboard
      </Link>
      <p className="eyebrow mt-6">Site-Wide Settings</p>
      <h1 className="font-display text-4xl mt-3">Settings</h1>
      <p className="mt-3 text-sm text-slate">
        This is the same <code className="font-mono text-crimson-bright">settings/site</code>{" "}
        Firestore document Precheks' own footer reads from — saving
        here updates Precheks' live site. #NotesApp's own footer
        (below) is still hardcoded in <code className="font-mono text-crimson-bright">app/layout.tsx</code>,
        not wired to this doc yet — editing here won't change it.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 grid gap-6">
        <label className="block">
          <span className="eyebrow">Contact Email</span>
          <input
            type="email"
            value={settings.email}
            onChange={(e) => setSettings({ ...settings, email: e.target.value })}
            className="mt-2 w-full border border-rule bg-card px-4 py-3 font-body focus:border-crimson outline-none"
          />
        </label>

        <label className="block">
          <span className="eyebrow">WhatsApp Link</span>
          <input
            value={settings.whatsapp}
            onChange={(e) => setSettings({ ...settings, whatsapp: e.target.value })}
            placeholder="https://wa.me/+..."
            className="mt-2 w-full border border-rule bg-card px-4 py-3 font-body focus:border-crimson outline-none"
          />
        </label>

        <div>
          <p className="eyebrow">Social Links</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
            {SOCIAL_FIELDS.map(({ key, label }) => (
              <label key={key} className="block">
                <span className="text-xs text-slate">{label}</span>
                <input
                  value={settings.social[key] || ""}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      social: { ...settings.social, [key]: e.target.value },
                    })
                  }
                  placeholder="https://…"
                  className="mt-1 w-full border border-rule bg-card px-3 py-2 text-sm focus:border-crimson outline-none"
                />
              </label>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            type="submit"
            disabled={saving}
            className="bg-crimson text-paper font-ui font-semibold px-6 py-3 hover:bg-crimson-bright transition-colors disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save Settings"}
          </button>
          {saved && <p className="text-sm text-slate">Saved — live on the site now.</p>}
        </div>
      </form>
    </section>
  );
}
