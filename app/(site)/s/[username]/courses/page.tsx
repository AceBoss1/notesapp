import type { Metadata } from "next";
import SiteCourses from "@/components/site/SiteCourses";
import { requireSiteSection } from "@/lib/site-sections-server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Courses" };

// The courses the member teaches on Notes Academy. Not linked from the site while Notes Academy is switched off (COURSES_LIVE in
// lib/site-settings.ts).
export default async function Page({ params }: { params: { username: string } }) {
  await requireSiteSection(params.username, "courses");
  return <SiteCourses />;
}
