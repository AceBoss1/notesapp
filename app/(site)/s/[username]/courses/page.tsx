import type { Metadata } from "next";
import SiteCourses from "@/components/site/SiteCourses";
import { requireSiteSection } from "@/lib/site-sections-server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Courses" };

// Courses on the member's site. Not linked from the site until courses open on #NotesApp (COURSES_LIVE in lib/site-settings.ts).
export default async function Page({ params }: { params: { username: string } }) {
  await requireSiteSection(params.username, "courses");
  return <SiteCourses />;
}
