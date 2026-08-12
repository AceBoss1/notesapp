// Identical in shape and content to Precheks' lib/admin.ts — same two
// Firebase Authentication accounts, same emails, same everything. This
// MUST match firestore.rules' isAdmin() list exactly (it already does;
// firestore.rules in this repo is byte-identical to Precheks' live rules).

export type SocialLinks = {
  linkedin?: string;
  facebook?: string;
  instagram?: string;
  twitter?: string;
  whatsapp?: string;
  website?: string;
};

export const ADMIN_PROFILES: Record<
  string,
  {
    username: string;
    displayName: string;
    avatar: string;
    bio: string;
    social: SocialLinks;
  }
> = {
  "ezurukam@gmail.com": {
    username: "emmanuel",
    displayName: "Emmanuel Adams",
    avatar: "/images/headshots/emmanuel-adams-1.jpeg",
    bio: "Business Development Lead at Precheks.",
    social: {
      linkedin: "https://www.linkedin.com/in/emmanuel-adams-27891354",
      facebook: "https://facebook.com/Mr.EmmanuelAdams",
      instagram: "https://instagram.com/itsemmanueladams",
      twitter: "https://x.com/TweetsbyAdams",
      whatsapp: "https://wa.me/+2347038688359",
    },
  },
  "precheks.info@gmail.com": {
    username: "chimdinma",
    displayName: "Chimdinma Onwuegbu",
    avatar: "/images/headshots/chimdinma-onwuegbu-2-professional.jpeg",
    bio: "Founder & Lead Consultant at Precheks.",
    social: {
      linkedin: "https://www.linkedin.com/in/chimdinma-onwuegbu",
      facebook: "https://www.facebook.com/chymdy.achi",
      instagram: "https://www.instagram.com/chymdy_kay",
      twitter: "https://x.com/chymdytwoo",
      whatsapp: "https://wa.me/+447918285805",
    },
  },
};

// Only addition vs. Precheks' file — a named constant so
// components/Avatar.tsx has one place to fall back to if a headshot
// file is ever missing on disk. Doesn't touch Firestore or the rules.
export const DEFAULT_AVATAR = "/images/headshots/default-avatar.png";

export function isAdminEmail(email?: string | null): boolean {
  return !!email && email in ADMIN_PROFILES;
}
