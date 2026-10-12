"use client";

import { useState, type InputHTMLAttributes } from "react";

// A password field with an eye button that shows or hides what was typed (sign up, log in, changing a password). Takes the same props as an input; any
// margin class (mt-1) moves to the wrapper so the button stays centred on the field.
export default function PasswordInput({ className = "", what = "password", ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & { what?: string }) {
  const [show, setShow] = useState(false);
  const margin = (className.match(/\bmt-\d+\b/g) ?? []).join(" ");
  const input = className.replace(/\bmt-\d+\b/g, "").trim();
  return (
    <span className={`relative block ${margin}`}>
      <input {...props} type={show ? "text" : "password"} className={input} style={{ paddingRight: "2.75rem" }} />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? `Hide ${what}` : `Show ${what}`}
        aria-pressed={show}
        title={show ? `Hide ${what}` : `Show ${what}`}
        className="absolute inset-y-0 right-0 flex items-center px-3 text-lg leading-none text-slate hover:text-crimson"
      >
        {show ? "🙈" : "👁"}
      </button>
    </span>
  );
}
