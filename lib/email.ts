// Server-only transactional email via Resend's HTTP API (no SDK needed).
// Without RESEND_API_KEY this logs and no-ops, so booking/payment
// flows never fail just because email isn't configured yet.
//
// Callers pass plain `text`; every email is also sent as a branded HTML
// version (logo + #NotesApp colours) built from that text, so no caller
// needs its own template. The plain text stays as the fallback part.

// Brand tokens, mirrored from tailwind.config (email clients can't use Tailwind).
const BRAND = { ink: "#1A1210", paper: "#FBF6F2", crimson: "#7A0328", crimsonBright: "#A6093D", muted: "#6B5E5A", rule: "#E8DDD6" };

const esc = (v: string) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Escape first, then turn bare URLs into links (trailing punctuation stays outside the link).
function linkify(escaped: string): string {
  return escaped.replace(/https?:\/\/[^\s<]+/g, (m) => {
    const trail = m.match(/[.,;:!?)]+$/)?.[0] ?? "";
    const url = trail ? m.slice(0, -trail.length) : m;
    return `<a href="${url}" style="color:${BRAND.crimsonBright};font-weight:600;text-decoration:underline;">${url}</a>${trail}`;
  });
}

export type EmailAction = { label: string; url: string };

export function renderEmailHtml(text: string, action?: EmailAction): string {
  const site = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.notesapp.name.ng").replace(/\/$/, "");
  // The footer carries the #NotesApp sign-off, so drop a trailing one from the body.
  const body = text.replace(/\s*#NotesApp\s*$/, "").trim();
  const paragraphs = body
    .split(/\n{2,}/)
    .map((para) => `<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:${BRAND.ink};">${linkify(esc(para)).replace(/\n/g, "<br>")}</p>`)
    .join("");
  // Optional call-to-action button (e.g. "Track your parcel"), bulletproof for Outlook/Gmail.
  const button = action
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 12px;"><tr><td bgcolor="${BRAND.crimson}" style="background:${BRAND.crimson};border-radius:6px;"><a href="${esc(action.url)}" style="display:inline-block;padding:12px 22px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;">${esc(action.label)}</a></td></tr></table>`
    : "";
  return `<!doctype html><html><body style="margin:0;padding:0;background:${BRAND.paper};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${BRAND.paper}" style="background:${BRAND.paper};"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<tr><td height="6" bgcolor="${BRAND.crimson}" style="background:${BRAND.crimson};font-size:0;line-height:0;border-radius:6px 6px 0 0;">&nbsp;</td></tr>
<tr><td bgcolor="#ffffff" style="background:#ffffff;padding:28px 28px 8px;border-left:1px solid ${BRAND.rule};border-right:1px solid ${BRAND.rule};">
<a href="${site}" style="text-decoration:none;"><img src="${site}/images/brand/email-logo.png" width="180" alt="#NotesApp" style="display:block;border:0;height:auto;width:180px;"></a>
</td></tr>
<tr><td bgcolor="#ffffff" style="background:#ffffff;padding:20px 28px 12px;border-left:1px solid ${BRAND.rule};border-right:1px solid ${BRAND.rule};">${paragraphs}${button}</td></tr>
<tr><td bgcolor="#ffffff" style="background:#ffffff;padding:16px 28px 24px;border:1px solid ${BRAND.rule};border-top:1px solid ${BRAND.rule};border-radius:0 0 6px 6px;font-size:12px;line-height:1.5;color:${BRAND.muted};">
<strong style="color:${BRAND.crimson};">#NotesApp</strong> &middot; <a href="${site}" style="color:${BRAND.muted};">${site.replace(/^https?:\/\//, "")}</a><br>Replies to this address aren't monitored. Need help? <a href="${site}/contact" style="color:${BRAND.muted};">Contact us</a>.
</td></tr>
</table></td></tr></table></body></html>`;
}

export async function sendEmail(params: { to: string; subject: string; text: string; action?: EmailAction }): Promise<boolean> {
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
      body: JSON.stringify({ from, to: params.to, subject: params.subject, text: params.action && !params.text.includes(params.action.url) ? `${params.text}\n\n${params.action.label}: ${params.action.url}` : params.text, html: renderEmailHtml(params.text, params.action) }),
    });
    if (!res.ok) console.error("[email] Resend error", res.status, await res.text().catch(() => ""));
    return res.ok;
  } catch (err) {
    console.error("[email] send failed", err);
    return false;
  }
}
