import type { Metadata } from "next";
import { getUserByUsername } from "@/lib/users";
import { storeMetadata } from "@/lib/og";
import StorePageClient from "@/components/StorePageClient";

// Rendered on the first visit to each address, then served from Vercel's cache and refreshed in the background
// (see `revalidate`), instead of running a function on every view.
export const revalidate = 300;
export async function generateStaticParams() {
  return [];
}

export async function generateMetadata({
  params,
}: {
  params: { username: string };
}): Promise<Metadata> {
  const profile = await getUserByUsername(params.username);
  if (!profile) return { title: "Store Not Found" };

  return storeMetadata(profile.uid, profile.displayName, profile.avatar);
}

export default function BrandStorePage({ params }: { params: { username: string } }) {
  return <StorePageClient params={params} />;
}
