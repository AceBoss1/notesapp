import { User } from "firebase/auth";

// Browser side of a Paystack checkout: ask the server to start one,
// then send the buyer to Paystack's hosted page.
export async function startCheckout(
  user: User,
  body: { kind: "booking"; username: string; date: string; slot: string } | { kind: "subscription"; username: string }
): Promise<void> {
  const res = await fetch("/api/paystack/initialize", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${await user.getIdToken()}` },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Couldn't start payment.");
  window.location.href = json.authorizationUrl;
}
