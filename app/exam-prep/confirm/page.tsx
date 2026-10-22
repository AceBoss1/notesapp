"use client";
import { useEffect, useState } from "react";
import { PREP_NAME } from "@/lib/exam-prep";
import { prepApi } from "@/lib/exam-prep-client";
import { card, Note, Spinner } from "@/components/exam-prep/ui";

// A parent or guardian confirming their child's teen-mode account, from the email link.
export default function ConfirmTeen() {
  const [state, setState] = useState<"busy" | "ok" | string>("busy");
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    prepApi("teen", { body: { confirm: { u: q.get("u"), t: q.get("t") } } }).then(() => setState("ok")).catch((e) => setState((e as Error).message));
  }, []);
  return (
    <div className="mx-auto max-w-md">
      {state === "busy" ? <Spinner label="Confirming…" /> : state === "ok" ? (
        <div className={card}>
          <h1 className="font-display text-2xl font-bold">Thank you, confirmed</h1>
          <p className="mt-2 text-[15px] text-[#0F2747]/80">Your child's {PREP_NAME} account is in teen mode: they don't appear in people search, only people they follow can message them, and the practice board shows only a nickname.</p>
          <p className="mt-2 text-sm text-[#0F2747]/65">Questions or worries? Reply to the email or write to us from the NotesApp contact page.</p>
        </div>
      ) : <Note tone="error">{state}</Note>}
    </div>
  );
}
