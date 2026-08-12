import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "./firebase";
import { SocialLinks } from "./admin";

export type SiteSettings = {
  email: string;
  whatsapp: string;
  social: SocialLinks;
};

const DOC_REF = () => doc(db, "settings", "site");

// Fallback values — what the site shows until an admin saves real
// settings for the first time via /admin/settings.
export const DEFAULT_SETTINGS: SiteSettings = {
  email: "info@precheks.com.ng",
  whatsapp: "https://wa.me/+447918285805",
  social: {
    linkedin: "https://www.linkedin.com/in/chimdinma-onwuegbu",
    facebook: "https://www.facebook.com/chymdy.achi",
    instagram: "https://www.instagram.com/chymdy_kay",
    twitter: "https://x.com/chymdytwoo",
  },
};

export async function getSiteSettings(): Promise<SiteSettings> {
  try {
    const snap = await getDoc(DOC_REF());
    if (!snap.exists()) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...(snap.data() as Partial<SiteSettings>) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function updateSiteSettings(data: SiteSettings): Promise<void> {
  await setDoc(DOC_REF(), data);
}
