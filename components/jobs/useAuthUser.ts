"use client";
import { useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase";

// The signed-in member for the Notes Jobs screens (undefined while loading, null when signed out), and an authorised fetch.
export function useAuthUser() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  useEffect(() => onAuthStateChanged(auth, setUser), []);
  return user;
}
export async function jobsApi<T>(user: User | null | undefined, url: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = body ? { "Content-Type": "application/json" } : {};
  if (user) headers.Authorization = `Bearer ${await user.getIdToken()}`;
  const r = await fetch(url, { method: body ? "POST" : "GET", headers, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || "Something went wrong");
  return j as T;
}
