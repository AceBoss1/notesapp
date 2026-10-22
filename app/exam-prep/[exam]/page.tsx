import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EXAMS, isExamId } from "@/lib/exam-prep";
import ExamHub from "@/components/exam-prep/ExamHub";

export function generateMetadata({ params }: { params: { exam: string } }): Metadata {
  if (!isExamId(params.exam)) return {};
  const e = EXAMS[params.exam];
  return { title: `${e.short} practice questions`, description: `Free ${e.name} practice questions with explanations, timed mocks and an offline pack.` };
}
export default function ExamPage({ params }: { params: { exam: string } }) {
  if (!isExamId(params.exam)) notFound();
  return <ExamHub exam={params.exam} />;
}
