import SiteShop from "@/components/site/SiteShop";
import { requireSiteSection } from "@/lib/site-sections-server";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: { username: string } }) {
  await requireSiteSection(params.username, "shop");
  return <SiteShop />;
}
