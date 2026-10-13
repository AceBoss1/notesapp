import { User } from "firebase/auth";
import { PAY_EVENT, WALLET_LIVE, isWalletKind, type PayAsk } from "./wallet";

// Ask "wallet or card?" when the member has anything in their wallet and this can be paid from it; card otherwise.
async function choosePayment(user: User, kind: string, amountKobo?: number): Promise<"wallet" | "card" | null> {
  if (!WALLET_LIVE || !isWalletKind(kind)) return "card";
  const w = await fetch("/api/wallet?brief=1", { headers: { Authorization: `Bearer ${await user.getIdToken()}` } }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  if (!w || (w.creditKobo <= 0 && w.bonusKobo <= 0)) return "card";
  return new Promise((resolve) => {
    window.dispatchEvent(new CustomEvent<PayAsk & { resolve: typeof resolve }>(PAY_EVENT, { detail: { kind, amountKobo, creditKobo: w.creditKobo, bonusKobo: w.bonusKobo, resolve } }));
  });
}

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
    | { kind: "boost"; itemId: string; packageId: string }
    | { kind: "digital"; itemId: string; acceptFinal: boolean }
    | { kind: "tier"; tier: "pro" | "business"; interval: "monthly" | "annually" }
    | { kind: "badge" }
    | { kind: "gold_deposit" }
    | { kind: "gold" }
    | { kind: "ad"; packageId: string; advertiserName: string; title: string; text: string; image: string; href: string; placements: string[]; agreed: boolean }
    | { kind: "store"; itemId: string; quantity: number; variant?: string[]; address: import("./merch").DeliveryAddress }
    | { kind: "merch"; itemId: string; logoId: string; size?: string; quantity: number; address: import("./merch").DeliveryAddress }
    | { kind: "gift"; username: string; amountNaira: number; noteId?: string; message?: string; anonymous?: boolean }
    | { kind: "wallet_topup"; amountNaira: number },
  opts: { amountKobo?: number } = {},
): Promise<void> {
  const how = await choosePayment(user, body.kind, opts.amountKobo);
  if (!how) throw new Error(""); // closed the chooser: nothing to show
  const sent: object = how === "wallet" ? { ...body, payWith: "wallet" } : body;
  let { res, json } = await post(user, sent);
  if (res.status === 403 && json.code === "consent_required") {
    const ok = window.confirm(
      "Before paying, please confirm you agree to the Terms of Service (/terms) and Privacy Policy (/privacy)."
    );
    if (!ok) throw new Error("You need to accept the Terms and Privacy Policy to pay.");
    const c = await fetch("/api/consent", { method: "POST", headers: { Authorization: `Bearer ${await user.getIdToken()}` } });
    if (!c.ok) throw new Error("Couldn't record your acceptance. Try again.");
    ({ res, json } = await post(user, sent));
  }
  if (!res.ok) throw new Error(json.error || "Couldn't start payment.");
  window.location.href = json.authorizationUrl;
}
