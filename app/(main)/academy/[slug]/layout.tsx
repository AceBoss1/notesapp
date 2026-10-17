import type { Metadata } from "next";
import { courseMetadata } from "@/lib/og";

// The course page is a client component (it shows the signed-in learner's own progress), so its share card (cover, title,
// summary) is set here. Lesson pages share it.
export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  return courseMetadata(params.slug);
}

export default function CourseLayout({ children }: { children: React.ReactNode }) {
  return children;
}
