"use client";

import { auth } from "@/lib/firebase";
import type { Subtopic, SubtopicKind } from "./subtopics";

// Saves the chosen subtopics (or subcategory) before a journal or Market item is saved, creating any that are new
// (POST /api/topics/subtopics). Returns them as saved; throws with the server's message if one is refused.
export async function ensureSubtopics(kind: SubtopicKind, items: { parent: string; label: string }[]): Promise<Subtopic[]> {
  if (!items.length) return [];
  const user = auth.currentUser;
  if (!user) throw new Error("Sign in first.");
  const r = await fetch("/api/topics/subtopics", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${await user.getIdToken()}` }, body: JSON.stringify({ kind, items }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || "Couldn't save the subtopics.");
  return j.items as Subtopic[];
}
