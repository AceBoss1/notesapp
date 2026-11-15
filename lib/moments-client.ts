import { auth } from "./firebase";
import { apiError } from "./content-checks";

// Calls our own Moments / Messages API as the signed-in member.
export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const user = auth.currentUser;
  if (!user) throw new Error("Sign in first.");
  const res = await fetch(path, {
    method: init.method ?? (init.body === undefined ? "GET" : "POST"),
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${await user.getIdToken()}` },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw apiError(data, "Something went wrong.");
  return data as T;
}
