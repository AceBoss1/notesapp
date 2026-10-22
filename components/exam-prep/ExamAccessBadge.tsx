"use client";
import { useEffect, useState } from "react";
import type { ExamId } from "@/lib/exam-prep";
import { loadCatalogue, useMe } from "@/lib/exam-prep-client";
import { Pill } from "./ui";

// "Pack: 300 days left" on an exam's card, for a signed-in student who has it.
export default function ExamAccessBadge({ exam }: { exam: ExamId }) {
  const me = useMe();
  const [days, setDays] = useState<number | null>(null);
  useEffect(() => {
    if (!me) return;
    loadCatalogue().then((c) => { const a = c.access[exam]; setDays(a?.active ? a.daysLeft : null); }).catch(() => undefined);
  }, [me, exam]);
  return days === null ? <Pill tone="green">Free questions</Pill> : <Pill tone="gold">Pack · {days} days left</Pill>;
}
