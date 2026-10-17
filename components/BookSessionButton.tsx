"use client";

import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

// "Book a session" on a profile: shown when the publisher takes bookings (publisherSettings/{uid}.session.enabled), and takes the
// visitor to the booking card further down the page (#book).
export default function BookSessionButton({ publisherUid }: { publisherUid?: string }) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (!publisherUid) return;
    getDoc(doc(db, "publisherSettings", publisherUid)).then((s) => setOn(!!s.data()?.session?.enabled)).catch(() => setOn(false));
  }, [publisherUid]);
  if (!on) return null;
  return <a href="#book" className="btn-primary">📅 Book a session</a>;
}
