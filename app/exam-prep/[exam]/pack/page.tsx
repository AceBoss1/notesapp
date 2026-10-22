import { notFound } from "next/navigation";
import { EXAMS, isExamId } from "@/lib/exam-prep";
import PackPage from "@/components/exam-prep/PackPage";

export function generateMetadata({ params }: { params: { exam: string } }) {
  return isExamId(params.exam) ? { title: `${EXAMS[params.exam].short} pack` } : {};
}
export default function Pack({ params }: { params: { exam: string } }) {
  if (!isExamId(params.exam)) notFound();
  return <PackPage exam={params.exam} />;
}
