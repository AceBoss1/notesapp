"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { capi } from "@/components/community/api";

// Whether this viewer sees the 🔴 Go live button: #NotesApp team accounts while the staff test pass is on (Admin → Limits). Asked once
// per signed-in account per page load and shared by every button on the page.
let asked: { uid: string; show: Promise<boolean> } | null = null;
// null while it is being asked.
export function useGoLive(): boolean | null {
  const [show, setShow] = useState<boolean | null>(null);
  useEffect(() => onAuthStateChanged(auth, (u) => {
    if (!u) { setShow(false); return; }
    if (!asked || asked.uid !== u.uid) asked = { uid: u.uid, show: capi<{ show: boolean }>("/api/lives?golive=1").then((r) => r.show === true).catch(() => false) };
    asked.show.then(setShow);
  }), []);
  return show;
}
