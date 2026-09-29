// Server-only transactional email via Resend's HTTP API (no SDK needed).
// Without RESEND_API_KEY this logs and no-ops, so booking/payment
// flows never fail just because email isn't configured yet.
export async function sendEmail(params: { to: string; subject: string; text: string }): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn(`[email] RESEND_API_KEY not set — skipped "${params.subject}" to ${params.to}`);
    return false;
  }
  const from = process.env.EMAIL_FROM || "#NotesApp <onboarding@resend.dev>";
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: params.to, subject: params.subject, text: params.text }),
    });
    if (!res.ok) console.error("[email] Resend error", res.status, await res.text().catch(() => ""));
    return res.ok;
  } catch (err) {
    console.error("[email] send failed", err);
    return false;
  }
}
