"use client";

import { useEffect, useState } from "react";

function getGreeting(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return "Good morning";
  if (h >= 12 && h < 17) return "Good afternoon";
  if (h >= 17 && h < 21) return "Good evening";
  return "Good night";
}

export default function Greeting() {
  // Render nothing until mounted — this is what avoids the hydration
  // mismatch: the server has no idea what the visitor's local time is,
  // so it must never guess a value up front.
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    setText(getGreeting());
  }, []);

  return (
    <span className="hidden sm:inline" aria-live="polite">
      {text ?? "Welcome"}
    </span>
  );
}
