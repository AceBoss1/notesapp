"use client";

import { useCallback } from "react";
import type { User } from "firebase/auth";

// Calls one of our /api/admin/... routes as the signed-in staff member: no body = GET, a body = POST.
export function useAdminCall(user: User | null | undefined, url: string) {
  return useCallback(async (body?: Record<string, unknown>, query = "") => {
    const r = await fetch(`${url}${query}`, body
      ? { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${await user!.getIdToken()}` }, body: JSON.stringify(body) }
      : { headers: { Authorization: `Bearer ${await user!.getIdToken()}` } });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || "Something went wrong");
    return j;
  }, [user, url]);
}

// Sends a file straight to the private bucket with the short-lived address the server gave us.
export async function putFile(uploadUrl: string, contentType: string, file: File): Promise<void> {
  const r = await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": contentType }, body: file });
  if (!r.ok) throw new Error(`Uploading ${file.name} failed. Try again.`);
}
