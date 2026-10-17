import { notFound } from "next/navigation";
import LessonPlayer from "@/components/academy/LessonPlayer";
import { ACADEMY_LIVE } from "@/lib/courses";

// One lesson of a course (the player). Cached like the course page; the lesson is read in the browser.
export const revalidate = 300;
export async function generateStaticParams() {
  return [];
}

export default function Page({ params }: { params: { slug: string; lessonId: string } }) {
  if (!ACADEMY_LIVE) notFound();
  return <LessonPlayer slug={params.slug} lessonId={params.lessonId} />;
}
