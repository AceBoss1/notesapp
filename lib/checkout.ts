import { User } from "firebase/auth";

async function post(user: User, body: unknown) {
  const res = await fetch("/api/paystack/initialize", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${await user.getIdToken()}` },
    body: JSON.stringify(body),
  });
  return { res, json: await res.json() };
}

// Browser side of a Paystack checkout: ask the server to start one,
// then send the buyer to Paystack's hosted page. Accounts created
// before consent was collected are asked to accept the Terms and
// Privacy Policy once, then the checkout is retried.
export async function startCheckout(
  user: User,
  body:
    | { kind: "booking"; username: string; date: string; slot: string }
    | { kind: "subscription"; username: string }
    | { kind: "boost"; noteId: string; packageId: string }
    | { kind: "tier"; tier: "pro" | "business"; interval: "monthly" | "annually" }
    | { kind: "gift"; username: string; amountNaira: number; noteId?: string; message?: string; anonymous?: boolean }
): Promise<void> {
  let { res, json } = await post(user, body);
  if (res.status === 403 && json.code === "consent_required") {
    const ok = window.confirm(
      "Before paying, please confirm you agree to the Terms of Service (/terms) and Privacy Policy (/privacy)."
    );
    if (!ok) throw new Error("You need to accept the Terms and Privacy Policy to pay.");
    const c = await fetch("/api/consent", { method: "POST", headers: { Authorization: `Bearer ${await user.getIdToken()}` } });
    if (!c.ok) throw new Error("Couldn't record your acceptance. Try again.");
    ({ res, json } = await post(user, body));
  }
  if (!res.ok) throw new Error(json.error || "Couldn't start payment.");
  window.location.href = json.authorizationUrl;
}
