"use client";
import { Suspense, useEffect, useState } from "react";
import LoginForm from "@/components/LoginForm";
import SignupFlow from "@/components/SignupFlow";

// Sign in or sign up on the Nana AI address itself (Firebase sign-in belongs to one address, so it can't happen on the main site),
// like Exam Prep. It's a NotesApp account: the same one works across NotesApp. Afterwards back to ?next (the studio by default).
export default function NanaSignIn() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get("auth") === "signup") setMode("signup");
    if (!q.get("next")) { q.set("next", window.location.pathname.startsWith("/nana-studio") ? "/nana-studio" : "/"); window.history.replaceState(null, "", `${window.location.pathname}?${q}`); }
  }, []);
  return (
    <main data-theme-off="" style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, background: "#f7f0e7", color: "#2d1a22" }}>
      <div style={{ width: "min(100%, 440px)", background: "#fffaf3", border: "1px solid #e7d8d1", borderRadius: 16, padding: 28, boxShadow: "0 16px 48px #332d1712" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/nana/nana-sm.webp" alt="" width={48} height={48} style={{ objectFit: "contain" }} />
        <p style={{ color: "#9a3657", letterSpacing: 1.25, fontSize: 10, fontWeight: 700, margin: "12px 0 6px" }}>NANA AI · PORTRAIT STUDIO</p>
        <h1 style={{ font: "500 28px/1.15 Georgia, 'Times New Roman', serif", letterSpacing: -0.8, margin: 0 }}>{mode === "signin" ? "Sign in with NotesApp" : "Create your free NotesApp account"}</h1>
        <p style={{ color: "#826d72", fontSize: 13, lineHeight: 1.6, margin: "10px 0 18px" }}>One NotesApp account for Nana AI and everything on NotesApp.</p>
        <Suspense>{mode === "signin" ? <LoginForm embedded onSwitch={() => setMode("signup")} /> : <SignupFlow embedded onSwitch={() => setMode("signin")} />}</Suspense>
      </div>
    </main>
  );
}
