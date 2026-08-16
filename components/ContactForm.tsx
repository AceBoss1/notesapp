"use client";

import { useState } from "react";
import { submitLead, LeadCategory } from "@/lib/leads";

const CATEGORIES: { value: LeadCategory; label: string }[] = [
  { value: "partnership", label: "Partnership" },
  { value: "press", label: "Press" },
  { value: "investment", label: "Investment" },
  { value: "support", label: "Support" },
  { value: "bug", label: "Bug report" },
  { value: "other", label: "Other" },
];

export default function ContactForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [category, setCategory] = useState<LeadCategory>("other");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSending(true);
    try {
      await submitLead({ name, email, category, message });
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong — try again.");
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <div className="card mt-8 p-8 text-center">
        <p className="font-display text-2xl text-ink">Message sent.</p>
        <p className="mt-2 text-sm text-slate">
          It's landed directly with the team — we'll get back to you at{" "}
          <span className="font-mono text-crimson-bright">{email}</span>.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="card mt-8 grid gap-5 p-7">
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block">
          <span className="eyebrow">Name</span>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-2 w-full border border-rule bg-paper px-4 py-3 font-body focus:border-crimson outline-none"
          />
        </label>
        <label className="block">
          <span className="eyebrow">Email</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-2 w-full border border-rule bg-paper px-4 py-3 font-body focus:border-crimson outline-none"
          />
        </label>
      </div>

      <label className="block">
        <span className="eyebrow">What's this about?</span>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as LeadCategory)}
          className="mt-2 w-full border border-rule bg-paper px-4 py-3 font-body focus:border-crimson outline-none"
        >
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="eyebrow">Message</span>
        <textarea
          required
          rows={5}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="mt-2 w-full border border-rule bg-paper px-4 py-3 font-body focus:border-crimson outline-none"
        />
      </label>

      {error && <p className="text-sm text-red-700">{error}</p>}

      <button
        type="submit"
        disabled={sending}
        className="bg-crimson text-paper font-ui font-semibold px-6 py-3 hover:bg-crimson-bright transition-colors disabled:opacity-50"
      >
        {sending ? "Sending…" : "Send Message"}
      </button>
    </form>
  );
}
