"use client";
import { Suspense, useEffect, useState } from "react";
import LoginForm from "@/components/LoginForm";
import SignupFlow from "@/components/SignupFlow";
import { PREP_NAME } from "@/lib/exam-prep";
import { card } from "@/components/exam-prep/ui";

// Sign in or sign up on the Exam Prep address itself (sign-in belongs to one address, so it can't happen on the main site).
// It's a NotesApp account: the same one works across NotesApp. Afterwards back to ?next.
export default function PrepSignIn() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get("auth") === "signup") setMode("signup");
    // Always somewhere in Exam Prep afterwards (the sign-in forms default to the NotesApp journal).
    if (!q.get("next")) { q.set("next", window.location.pathname.startsWith("/exam-prep") ? "/exam-prep" : "/"); window.history.replaceState(null, "", `${window.location.pathname}?${q}`); }
  }, []);
  return (
    <div className="mx-auto max-w-md">
      <div className={card}>
        <h1 className="font-display text-2xl font-bold">{mode === "signin" ? `Sign in to ${PREP_NAME}` : "Create your free account"}</h1>
        <p className="mt-1 text-sm text-[#0F2747]/70">It's a NotesApp account: one account for {PREP_NAME} and everything on NotesApp. Your progress and packs stay with it.</p>
        <div className="mt-4">
          <Suspense>{mode === "signin" ? <LoginForm embedded onSwitch={() => setMode("signup")} /> : <SignupFlow embedded young onSwitch={() => setMode("signin")} />}</Suspense>
        </div>
      </div>
    </div>
  );
}
