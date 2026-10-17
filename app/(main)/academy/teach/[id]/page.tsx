import type { Metadata } from "next";
import { notFound } from "next/navigation";
import CourseEditor from "@/components/academy/CourseEditor";
import { ACADEMY_LIVE } from "@/lib/courses";

export const metadata: Metadata = { title: "Course editor", robots: { index: false } };

// The course editor (components/academy/CourseEditor.tsx); the teacher's own courses only, checked by the server.
export default function CourseEditorPage({ params }: { params: { id: string } }) {
  if (!ACADEMY_LIVE) notFound();
  return <CourseEditor courseId={params.id} />;
}
