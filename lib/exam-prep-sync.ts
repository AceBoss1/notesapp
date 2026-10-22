"use client";
import type { Progress } from "@/lib/exam-prep";
import { prepApi } from "@/lib/exam-prep-client";
import { keepProgress, localProgress } from "@/lib/exam-prep-local";
import { auth } from "@/lib/firebase";

// This phone's progress merged with the account's (signed in and online only). Returns what's kept here afterwards.
export async function syncProgress(): Promise<Progress> {
  const local = await localProgress();
  if (!auth.currentUser || !navigator.onLine) return local;
  try {
    const merged = await prepApi<Progress>("progress", { body: { progress: local } });
    await keepProgress(merged);
    return merged;
  } catch { return local; }
}
