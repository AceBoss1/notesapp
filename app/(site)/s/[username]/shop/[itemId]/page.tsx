import type { Metadata } from "next";
import { storeItemMetadata } from "@/lib/og";
import ShopItemPage from "@/app/(main)/shop/[itemId]/page";

// A store item inside the member's own site (the same page as /shop/<id>; middleware only lets their own items through).
export async function generateMetadata({ params }: { params: { itemId: string } }): Promise<Metadata> {
  return storeItemMetadata(params.itemId);
}

export default function Page() {
  return <ShopItemPage />;
}
