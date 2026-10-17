import type { Metadata } from "next";
import { storeItemMetadata } from "@/lib/og";
import ShopItemView from "@/components/ShopItemView";
import { requireSiteSection } from "@/lib/site-sections-server";

// A store item inside the member's own site (the same page as /shop/<id>; middleware only lets their own items through).
export async function generateMetadata({ params }: { params: { itemId: string } }): Promise<Metadata> {
  return storeItemMetadata(params.itemId);
}

export default async function Page({ params }: { params: { username: string } }) {
  await requireSiteSection(params.username, "shop");
  return <ShopItemView />;
}
