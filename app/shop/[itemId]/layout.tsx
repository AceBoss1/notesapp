import type { Metadata } from "next";
import { storeItemMetadata } from "@/lib/og";

// The item page is a client component, so its share card (the item's own photo, title and price) is set here.
export async function generateMetadata({ params }: { params: { itemId: string } }): Promise<Metadata> {
  return storeItemMetadata(params.itemId);
}

export default function ShopItemLayout({ children }: { children: React.ReactNode }) {
  return children;
}
