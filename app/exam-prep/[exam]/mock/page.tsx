import { notFound } from "next/navigation";
import { isExamId } from "@/lib/exam-prep";
import Mock from "@/components/exam-prep/Mock";

export const metadata = { title: "Timed mock" };
export default function MockPage({ params }: { params: { exam: string } }) {
  if (!isExamId(params.exam)) notFound();
  return <Mock exam={params.exam} />;
}
