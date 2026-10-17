import { notFound } from "next/navigation";
import CourseView from "@/components/academy/CourseView";
import { ACADEMY_LIVE } from "@/lib/courses";

// Rendered on the first visit to each address, then served from Vercel's cache and refreshed in the background (the course
// itself is read in the browser, so a change shows at once).
export const revalidate = 300;
export async function generateStaticParams() {
  return [];
}

export default function Page({ params }: { params: { slug: string } }) {
  if (!ACADEMY_LIVE) notFound();
  return <CourseView slug={params.slug} />;
}
