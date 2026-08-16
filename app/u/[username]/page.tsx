import type { Metadata } from "next";
import { getUserByUsername } from "@/lib/users";
import { OFFICIAL_NOTESAPP_PROFILE, NA_NOTESAPP_PROFILE } from "@/lib/journals-directory";
import ProfilePageClient from "@/components/ProfilePageClient";

export async function generateMetadata({
  params,
}: {
  params: { username: string };
}): Promise<Metadata> {
  // Both synthetic channels have no `users` doc — hardcode their
  // metadata rather than querying Firestore for something that
  // doesn't exist there.
  if (params.username === OFFICIAL_NOTESAPP_PROFILE.username) {
    return {
      title: OFFICIAL_NOTESAPP_PROFILE.displayName,
      description: OFFICIAL_NOTESAPP_PROFILE.bio,
      openGraph: { title: OFFICIAL_NOTESAPP_PROFILE.displayName, description: OFFICIAL_NOTESAPP_PROFILE.bio, type: "profile", images: [OFFICIAL_NOTESAPP_PROFILE.avatar] },
      twitter: { card: "summary_large_image", title: OFFICIAL_NOTESAPP_PROFILE.displayName, description: OFFICIAL_NOTESAPP_PROFILE.bio, images: [OFFICIAL_NOTESAPP_PROFILE.avatar] },
    };
  }
  if (params.username === NA_NOTESAPP_PROFILE.username) {
    return {
      title: NA_NOTESAPP_PROFILE.displayName + " (@na-notesapp)",
      description: NA_NOTESAPP_PROFILE.bio,
      openGraph: { title: NA_NOTESAPP_PROFILE.displayName, description: NA_NOTESAPP_PROFILE.bio, type: "profile", images: [NA_NOTESAPP_PROFILE.avatar] },
      twitter: { card: "summary_large_image", title: NA_NOTESAPP_PROFILE.displayName, description: NA_NOTESAPP_PROFILE.bio, images: [NA_NOTESAPP_PROFILE.avatar] },
    };
  }

  const profile = await getUserByUsername(params.username);
  if (!profile) return { title: "Profile Not Found" };

  const description = profile.bio || `${profile.displayName}'s journal on #NotesApp.`;

  return {
    title: `${profile.displayName} (@${profile.username})`,
    description,
    openGraph: {
      title: profile.displayName,
      description,
      type: "profile",
      images: [profile.avatar],
    },
    twitter: {
      card: "summary_large_image",
      title: profile.displayName,
      description,
      images: [profile.avatar],
    },
  };
}

export default function ProfilePage({ params }: { params: { username: string } }) {
  return <ProfilePageClient params={params} />;
}
