"use client";
import { useEffect, useState } from "react";
import { prepApi, useMe } from "@/lib/exam-prep-client";
import { btnGo, card, input, Note } from "./ui";

// "Have a class code?" A student joins their school class (schools, lib/prep-schools.ts) so their teacher sees their practice.
export default function ClassCode() {
  const me = useMe();
  const [joined, setJoined] = useState<{ id: string; name: string; school: string }[] | null>(null);
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  useEffect(() => { if (me) prepApi<{ joined: { id: string; name: string; school: string }[] }>("schools").then((d) => setJoined(d.joined)).catch(() => setJoined([])); }, [me]);
  if (!me || joined === null) return null;
  const join = async (e: React.FormEvent) => {
    e.preventDefault(); setMsg(null);
    try { const r = await prepApi<{ className: string; school: string }>("schools", { body: { action: "join", code } }); setMsg({ tone: "ok", text: `You've joined ${r.className} at ${r.school}. Your teacher sees your practice, by your first name and initial.` }); setCode(""); setJoined((await prepApi<{ joined: typeof joined }>("schools")).joined); }
    catch (err) { setMsg({ tone: "error", text: (err as Error).message }); }
  };
  return (
    <div className={`${card} mt-5`}>
      <p className="font-semibold">{joined.length ? "Your classes" : "Have a class code?"}</p>
      {joined.map((c) => <p key={c.id} className="mt-1 text-sm">{c.name} · {c.school}</p>)}
      {msg && <div className="mt-2"><Note tone={msg.tone}>{msg.text}</Note></div>}
      <form onSubmit={join} className="mt-2 flex flex-col gap-2 sm:flex-row">
        <input className={input} value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="For example GFC-SS3G-7KQ" aria-label="Class code" />
        <button className={btnGo}>Join</button>
      </form>
    </div>
  );
}
