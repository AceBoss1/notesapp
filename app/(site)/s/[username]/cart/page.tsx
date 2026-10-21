import type { Metadata } from "next";
import SiteBasket from "@/components/site/SiteBasket";
import { requireSiteSection } from "@/lib/site-sections-server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your basket" };

// The basket of a member's shop (components/site/SiteBasket.tsx), at /cart on their own domain.
export default async function Page({ params }: { params: { username: string } }) {
  await requireSiteSection(params.username, "shop");
  return <SiteBasket />;
}
