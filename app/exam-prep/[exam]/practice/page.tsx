import { notFound } from "next/navigation";
import { isExamId } from "@/lib/exam-prep";
import Practice from "@/components/exam-prep/Practice";

export const metadata = { title: "Practice" };
export default function PracticePage({ params }: { params: { exam: string } }) {
  if (!isExamId(params.exam)) notFound();
  return <Practice exam={params.exam} />;
}
