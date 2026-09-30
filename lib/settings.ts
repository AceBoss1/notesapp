import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "./firebase";
import { SocialLinks } from "./admin";
import { SITE } from "./site";
import { ttlCache } from "./ttl-cache";

// #NotesApp's own site-wide contact details — shown in the footer, on the
// Contact page and on About. Edited in /admin/settings. (Stored in
// settings/notesapp-site; the old settings/site doc was Precheks' footer
// config from before the platforms were separated and is no longer read.)
export type SiteSettings = {
  email: string;
  whatsapp: string;
  social: SocialLinks;
};

const DOC_REF = () => doc(db, "settings", "notesapp-site");

// Shown until an admin saves settings for the first time.
export const DEFAULT_SETTINGS: SiteSettings = {
  email: SITE.email,
  whatsapp: "",
  social: {
    linkedin: SITE.linkedin,
    facebook: SITE.facebook,
    instagram: "",
    twitter: "",
    website: "",
  },
};

async function readSettings(): Promise<SiteSettings> {
  const snap = await getDoc(DOC_REF());
  if (!snap.exists()) return DEFAULT_SETTINGS;
  const data = snap.data() as Partial<SiteSettings>;
  return { ...DEFAULT_SETTINGS, ...data, social: { ...DEFAULT_SETTINGS.social, ...(data.social || {}) } };
}

// Admin form: always fresh.
export async function getSiteSettings(): Promise<SiteSettings> {
  try {
    return await readSettings();
  } catch {
    return DEFAULT_SETTINGS;
  }
}

// Footer / Contact / About (server-rendered on every request): one read a
// minute per server instance instead of one per page view. Falls back to
// the defaults if Firestore is unavailable, so the footer never breaks.
const cached = ttlCache(60_000, readSettings);
export async function getSiteSettingsCached(): Promise<SiteSettings> {
  try {
    return await cached();
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function updateSiteSettings(data: SiteSettings): Promise<void> {
  await setDoc(DOC_REF(), data);
}
