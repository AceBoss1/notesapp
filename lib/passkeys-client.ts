import { signInWithCustomToken, type User } from "firebase/auth";
import { browserSupportsWebAuthn, startAuthentication, startRegistration } from "@simplewebauthn/browser";
import { auth } from "./firebase";
import type { PasskeyRow } from "./passkeys";

// Browser side of passkeys (lib/passkeys.ts): add one to the signed-in account, list and remove them, and sign in with one.

export const passkeysSupported = () => typeof window !== "undefined" && browserSupportsWebAuthn();

async function post<T>(url: string, body: unknown, token?: string): Promise<T> {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || "Something went wrong");
  return j as T;
}

// The browser's own "cancelled" and "not allowed" errors read as a plain sentence.
function friendly(err: unknown): Error {
  const name = (err as { name?: string })?.name;
  if (name === "NotAllowedError" || name === "AbortError") return new Error("Cancelled. Try again when you're ready.");
  if (name === "InvalidStateError") return new Error("This device already has a passkey for your account.");
  return err instanceof Error ? err : new Error("Something went wrong");
}

export async function addPasskey(user: User, name?: string): Promise<PasskeyRow> {
  const token = await user.getIdToken();
  const { options, challengeId } = await post<{ options: Parameters<typeof startRegistration>[0]["optionsJSON"]; challengeId: string }>("/api/passkeys/register", { step: "options" }, token);
  let response;
  try { response = await startRegistration({ optionsJSON: options }); } catch (e) { throw friendly(e); }
  const { passkey } = await post<{ passkey: PasskeyRow }>("/api/passkeys/register", { step: "verify", challengeId, response, name }, token);
  return passkey;
}

export async function listMyPasskeys(user: User): Promise<PasskeyRow[]> {
  const r = await fetch("/api/passkeys", { headers: { Authorization: `Bearer ${await user.getIdToken()}` }, cache: "no-store" });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || "Couldn't load your passkeys");
  return j.passkeys as PasskeyRow[];
}

export async function removeMyPasskey(user: User, id: string): Promise<void> {
  const r = await fetch("/api/passkeys", { method: "DELETE", headers: { "Content-Type": "application/json", Authorization: `Bearer ${await user.getIdToken()}` }, body: JSON.stringify({ id }) });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Couldn't remove that passkey");
}

// Signs in with a passkey the device offers; returns the signed-in user.
export async function signInWithPasskey(): Promise<User> {
  const { options, challengeId } = await post<{ options: Parameters<typeof startAuthentication>[0]["optionsJSON"]; challengeId: string }>("/api/passkeys/login", { step: "options" });
  let response;
  try { response = await startAuthentication({ optionsJSON: options }); } catch (e) { throw friendly(e); }
  const { token } = await post<{ token: string }>("/api/passkeys/login", { step: "verify", challengeId, response });
  return (await signInWithCustomToken(auth, token)).user;
}
