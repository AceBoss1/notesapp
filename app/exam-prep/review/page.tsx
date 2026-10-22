"use client";
import { useCallback, useEffect, useState } from "react";
import type { Question } from "@/lib/exam-prep";
import { prepApi, useMe, usePrepHref } from "@/lib/exam-prep-client";
import ReviewCard from "@/components/exam-prep/ReviewCard";
import { Note, Spinner } from "@/components/exam-prep/ui";

// The review queue for invited reviewers (and content admins): questions waiting for review, nothing else.
export default function ReviewPage() {
  const me = useMe();
  const h = usePrepHref();
  const [qs, setQs] = useState<Question[] | null>(null);
  const [who, setWho] = useState("");
  const [mine, setMine] = useState<{ subjects: string[] | null; reviews: number }>({ subjects: null, reviews: 0 });
  const [err, setErr] = useState("");
  const load = useCallback(() => prepApi<{ me: { name: string; subjects: string[] | null; reviews: number }; questions: Question[] }>("review").then((r) => { setQs(r.questions); setWho(r.me.name); setMine({ subjects: r.me.subjects, reviews: r.me.reviews }); }).catch((e) => setErr((e as Error).message)), []);
  useEffect(() => { if (me) load(); }, [me, load]);
  if (me === null) return <Note>Reviewers: <a className="font-semibold underline" href={h(`/signin?next=${encodeURIComponent(h("/review"))}`)}>sign in</a> to see the queue.</Note>;
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="font-display text-2xl font-bold">Review queue</h1>
      {who && <p className="text-sm text-[#0F2747]/70">Signed in as {who}. Check the answer, the explanation and that the question is fair and clear. You can't review a question you wrote.</p>}
      {who && mine.subjects && <p className="mt-1 text-sm text-[#0F2747]/70">Your subjects: {mine.subjects.join(", ")} · {mine.reviews} reviewed so far. Thank you!</p>}
      {err && <div className="mt-3"><Note tone="error">{err}</Note></div>}
      {!qs && !err && <Spinner />}
      {qs && !qs.length && <div className="mt-3"><Note tone="ok">Nothing waiting. Thank you!</Note></div>}
      <div className="mt-4 space-y-3">
        {qs?.map((q) => <ReviewCard key={q.id} q={q} onReview={async (decision, note) => { await prepApi("review", { body: { id: q.id, decision, note } }); setQs((l) => l?.filter((x) => x.id !== q.id) ?? null); }} />)}
      </div>
    </div>
  );
}
