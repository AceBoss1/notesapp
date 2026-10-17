import SiteNotes from "@/components/site/SiteNotes";
import { requireSiteSection } from "@/lib/site-sections-server";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: { username: string } }) {
  await requireSiteSection(params.username, "journals");
  return <SiteNotes />;
}
