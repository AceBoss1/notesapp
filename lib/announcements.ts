import { PREP_URL, SITE_URL } from "./host";
import { FEEDBACK_PATH } from "./feedback";
import { REVIEWERS_PATH } from "./prep-reviewers";

// Announcements to every member (Admin → Announcements, lib/announcements-server.ts). Pure: the shape, the checks, and how the body
// is written and turned into an email, shared by the composer and the server.
//
// One announcement = a bell to every member and an email to members whose email choices allow announcements (emailPrefs/{uid}:
// `announcements` not false; a member who switched the weekly digest off and never chose here is treated as "no" too). The body is
// plain text with a little markdown: "## " starts a heading, "- " a bullet, **bold**, and bare https:// links. "{name}" becomes the
// member's first name.

export type AnnouncementStatus = "draft" | "sending" | "sent";
export type Announcement = {
  id: string;
  title: string; // the heading on the web page and the admin list
  bell: string; // the bell's words (up to 280 characters)
  subject: string; // the email's subject
  preheader: string; // the grey line inboxes show after the subject
  body: string; // markdown-lite, above
  linkLabel: string; // the email's button and the page's button
  linkUrl: string; // where it goes (a path on #NotesApp or a full https:// link)
  status: AnnouncementStatus;
  createdAt: string; updatedAt: string; createdBy: string;
  seedKey?: string; // the anniversary draft is seeded once
  testSentAt?: string; testSentTo?: string;
  sendStartedAt?: string; sendStartedBy?: string; sentAt?: string;
  cursor?: string | null; // the last member id done, for the next batch
  counts?: { bells: number; emails: number; noEmail: number; skipped: number };
};

export const ANNOUNCEMENT_LIMITS = { title: 120, bell: 280, subject: 150, preheader: 200, body: 12000, linkLabel: 40, linkUrl: 500 };
export const ANNOUNCEMENT_BATCH = 150; // members per batch; the page sends batch after batch, the cron finishes one left half-done
export const announcementPath = (id: string) => `/announcements/${encodeURIComponent(id)}`;

const line = (v: unknown, max: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
export type AnnouncementInput = Pick<Announcement, "title" | "bell" | "subject" | "preheader" | "body" | "linkLabel" | "linkUrl">;
export function checkAnnouncement(raw: unknown): { ok: true; value: AnnouncementInput } | { ok: false; error: string } {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const L = ANNOUNCEMENT_LIMITS;
  const v: AnnouncementInput = {
    title: line(o.title, L.title), bell: line(o.bell, L.bell), subject: line(o.subject, L.subject), preheader: line(o.preheader, L.preheader),
    body: String(o.body ?? "").replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim().slice(0, L.body),
    linkLabel: line(o.linkLabel, L.linkLabel), linkUrl: line(o.linkUrl, L.linkUrl),
  };
  if (!v.title) return { ok: false, error: "Give it a title." };
  if (!v.bell) return { ok: false, error: "Write the bell's words." };
  if (!v.subject) return { ok: false, error: "Write the email's subject." };
  if (v.body.length < 20) return { ok: false, error: "Write the email." };
  if (v.linkUrl && !/^\/(?!\/)\S*$/.test(v.linkUrl) && !/^https:\/\/[^\s"'<>]+$/.test(v.linkUrl)) return { ok: false, error: "The link is a path on #NotesApp (/profile/referrals) or a full https:// address." };
  if (v.linkUrl && !v.linkLabel) return { ok: false, error: "Give the link's button some words." };
  return { ok: true, value: v };
}
export const absoluteUrl = (u: string, site = SITE_URL) => (u.startsWith("/") ? `${site.replace(/\/$/, "")}${u}` : u);

// The member's first name for "{name}" (or "there": "Hello there").
export const firstName = (displayName: unknown) => String(displayName ?? "").trim().split(/\s+/)[0]?.replace(/[^\p{L}\p{N}'-]/gu, "") || "there";
export const personalise = (s: string, name: string) => s.replace(/\{name\}/g, name);

// ---- the body as plain text (the email's text part, the bell page's fallback) ----
export function bodyText(body: string): string {
  return body.split("\n").map((l) => l.replace(/^##\s+/, "").replace(/\*\*(.+?)\*\*/g, "$1")).join("\n").trim();
}

// ---- the body as HTML (inside the branded email, and on /announcements/[id]) ----
const esc = (v: string) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
export type BodyStyle = { p: string; h: string; ul: string; li: string; a: string };
export const EMAIL_STYLE: BodyStyle = {
  p: "margin:0 0 16px;font-size:16px;line-height:1.6;color:#1A1210;",
  h: "margin:24px 0 10px;font-size:19px;line-height:1.3;color:#7A0328;font-weight:800;",
  ul: "margin:0 0 16px;padding-left:22px;",
  li: "margin:0 0 8px;font-size:16px;line-height:1.55;color:#1A1210;",
  a: "color:#A6093D;font-weight:600;text-decoration:underline;",
};
function inline(s: string, style: BodyStyle): string {
  return esc(s)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/https?:\/\/[^\s<]+/g, (m) => {
      const trail = m.match(/[.,;:!?)]+$/)?.[0] ?? "";
      const url = trail ? m.slice(0, -trail.length) : m;
      return `<a href="${url}" style="${style.a}">${url.replace(/^https?:\/\//, "")}</a>${trail}`;
    });
}
export function bodyHtml(body: string, style: BodyStyle = EMAIL_STYLE): string {
  const out: string[] = [];
  for (const block of body.trim().split(/\n{2,}/)) {
    const lines = block.split("\n");
    let para: string[] = [], list: string[] = [];
    const flush = () => {
      if (para.length) out.push(`<p style="${style.p}">${para.map((l) => inline(l, style)).join("<br>")}</p>`);
      if (list.length) out.push(`<ul style="${style.ul}">${list.map((l) => `<li style="${style.li}">${inline(l, style)}</li>`).join("")}</ul>`);
      para = []; list = [];
    };
    for (const l of lines) {
      if (/^##\s+/.test(l)) { flush(); out.push(`<h2 style="${style.h}">${inline(l.replace(/^##\s+/, ""), style)}</h2>`); }
      else if (/^-\s+/.test(l)) { if (para.length) { const p = para; para = []; out.push(`<p style="${style.p}">${p.map((x) => inline(x, style)).join("<br>")}</p>`); } list.push(l.replace(/^-\s+/, "")); }
      else { if (list.length) flush(); para.push(l); }
    }
    flush();
  }
  return out.join("\n");
}

// ---- The first draft: #NotesApp's one-month anniversary (owner, 1 Nov 2026) ----
// Facts from lib/changelog.ts (every release in October 2026 and 1 November), the rewards from lib/referrals.ts, what's coming from
// the roadmap's "not live" list. The 50 members with no ads is the owner's own figure.
export const ANNIVERSARY_SEED = "anniversary-2026-11";
export const ANNIVERSARY_DRAFT: AnnouncementInput = {
  title: "#NotesApp is one month old",
  bell: "#NotesApp is one month old today 🎉 50 of you found us with no ads. See what we built in October, what's coming in November, and how to help.",
  subject: "#NotesApp is one month old: thank you, and what's next",
  preheader: "50 members in our first month, with no ads. What we built in October, what's coming in November, and two ways to help.",
  linkLabel: "Get your referral link",
  linkUrl: "/profile/referrals",
  body: `Hello {name},

We launched #NotesApp on 1 October. Today we're one month old, and we want to say thank you.

In our first month, 50 of you joined. No ads, no marketing: just people finding us and telling a friend. That means a lot to us.

## What we built in October

- **Notes Market**: sell physical items and digital downloads, with a basket on your own site and reviews from verified buyers.
- **Notes Academy**: teach free or paid courses, add quizzes, and give learners certificates they can share on LinkedIn.
- **Naija Exam Prep**: free JAMB, WAEC and NECO practice questions with full explanations, timed mocks, and packs that work with no data.
- **Community**: a home for your church, school, NGO or club, with Spaces, private Circles and live audio rooms.
- **Events and giving**: paid tickets with a QR code for every guest, and giving in communities with a receipt for every gift.
- **Bookings**: people book and pay for a session with you, with reminders by email and the bell.
- **Messages**: group chats, voice notes, and free voice and video calls, including group calls of up to 6 people.
- **Your own site**: every plan now has one, with ready-made kits for your trade.
- **Discount codes and coupons** for your shop, downloads, courses and sessions, and Nana applies the best coupon for you at checkout.
- **Nana AI**, our helper on every page, for answers, writing help and course cover art, and **Notes Life**, our free life game set in Abuja.

## What's coming in November

This month we start advertising and marketing #NotesApp. Many more people are about to hear about us for the first time.

Before they do, invite the people you care about yourself:

- **Your referral link** is under Account → Referrals. A friend who joins with it gets their first month of a plan free (on a yearly plan, one month off). Your username is also your referral code: they can type it under "Have a discount code?" on the pricing page.
- **You earn 20%** of what they pay for their plan, for 12 months from their first payment.
- **Sell or teach?** Set an affiliate share of up to 50% on your items, downloads or courses, and they go on the affiliate marketplace for members to promote. Anyone can share a link from ${SITE_URL}/affiliates and earn that share of every sale.
- **Take your earnings** as cash to your bank account (from ₦2,000) or as NotesApp Credit with 10% more. Earnings wait 7 days (14 for delivered shop items) so payments can clear.

It isn't only about the rewards. When you invite a friend, a sister, a cousin or a colleague, you're giving them a place to sell, teach, learn and be found. You're doing them good.

And the honest bit: as the ads go out, your friends and family will find us anyway. If you don't invite them, someone else will, and they'll get the rewards. So share your link first.

On our roadmap, coming soon (not live yet):

- The #NotesApp apps for iOS and Android, being prepared now.
- Notes Life in a new pixel look, and an HD look with your own avatar.
- The #1MillionNairaNotesAppChallenge for influencers.
- WhatsApp reminders alongside email and the bell.
- **Business books** for sellers: record walk-in sales and expenses, track stock and money owed to you, see your profit, and import your existing records from Excel and other tools.

## Volunteers wanted: review Naija Exam Prep questions

Every Naija Exam Prep question is checked by a person before students see it. If you're a teacher, an examiner, a graduate in a subject or a strong student, we'd love your help. Choose your subjects and sign up: ${PREP_URL}${REVIEWERS_PATH}

Reviewers can also join the Naija Exam Prep Reviewers community, a private place to talk through questions with other reviewers. Joining is optional.

## Tell us how we did

You've had #NotesApp for a month. What do you love? What's missing or broken? It takes two minutes: ${SITE_URL}${FEEDBACK_PATH}

Thank you for being here at the start. We're only getting going.

Emmanuel Adams
Founder, #NotesApp`,
};
