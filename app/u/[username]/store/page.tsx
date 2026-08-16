import type { Metadata } from "next";
import { getUserByUsername } from "@/lib/users";
import { STORE_ITEMS } from "@/lib/store";
import StorePageClient from "@/components/StorePageClient";

export async function generateMetadata({
  params,
}: {
  params: { username: string };
}): Promise<Metadata> {
  const profile = await getUserByUsername(params.username);
  if (!profile) return { title: "Store Not Found" };

  const itemCount = STORE_ITEMS[profile.username]?.length ?? 0;
  const description = `${profile.displayName}'s brand store on #NotesApp — ${itemCount} item${itemCount === 1 ? "" : "s"}.`;
  const firstImage = STORE_ITEMS[profile.username]?.[0]?.image || profile.avatar;

  return {
    title: `${profile.displayName}'s Store`,
    description,
    openGraph: { title: `${profile.displayName}'s Store`, description, images: [firstImage] },
    twitter: { card: "summary_large_image", title: `${profile.displayName}'s Store`, description, images: [firstImage] },
  };
}

export default function BrandStorePage({ params }: { params: { username: string } }) {
  return <StorePageClient params={params} />;
}
