import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import CourseView from "@/components/academy/CourseView";
import { MemberProvider } from "@/lib/member-client";
import { ACADEMY_LIVE } from "@/lib/courses";
import { isMainHost } from "@/lib/host";
import { courseMetadata } from "@/lib/og";
import { requireSiteSection } from "@/lib/site-sections-server";
import { getUserByUsername } from "@/lib/users";

export const dynamic = "force-dynamic";
export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  return courseMetadata(params.slug);
}

// One of the member's courses, inside their site (their header and footer), so a visitor never leaves it to read about the course.
// The page itself is Notes Academy's (components/academy/CourseView.tsx), shown only for a course they teach.
export default async function Page({ params }: { params: { username: string; slug: string } }) {
  if (!ACADEMY_LIVE) notFound();
  await requireSiteSection(params.username, "courses");
  const p = await getUserByUsername(params.username).catch(() => null);
  if (!p) notFound();
  const host = (headers().get("host") || "").toLowerCase().replace(/:\d+$/, "");
  const base = isMainHost(host) ? `/s/${params.username}` : "";
  return <MemberProvider><CourseView slug={params.slug} site={{ base, uid: p.uid }} /></MemberProvider>;
}
