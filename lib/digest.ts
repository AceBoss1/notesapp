// The #NotesApp Weekly Digest email (pure: no Firestore; the server side is lib/digest-server.ts).
//
// The look takes the best of two digests:
//   from Medium: "Stories for <name>" with the reader's own picture and @username at the top, a big serif title, a
//     "This week's highlights" heading, and for each story the writer's picture and name ("in" their organisation), a bold
//     title, a grey summary and a quiet row with reading time, likes and comments; then a box to choose what you see, and a
//     dark footer with the app;
//   from Quora: the story's picture sits at the right and the words wrap around it (img align="right", which every mail app,
//     Outlook included, honours), a longer opening of the story with an inline "Read more »", and a "Read more in your feed"
//     button.
// Built with tables and inline styles only (mail apps ignore stylesheets); 600px wide on a computer, full width on a phone.

export type DigestStory = {
  title: string;
  summary: string;
  href: string; // absolute
  image: string | null; // absolute
  writerName: string;
  writerAvatar: string; // absolute
  inName?: string; // the organisation the writer posted for, shown as "Ada in Precheks"
  readMinutes: number;
  likes: number;
  comments: number;
  premium: boolean;
};
export type DigestReader = { name: string; username: string; avatar: string };
export type DigestEmail = {
  reader: DigestReader;
  stories: DigestStory[];
  site: string; // https://www.<root>
  appUrl: string; // where "Install #NotesApp" goes
  unsubscribeUrl: string;
  interestsUrl: string; // /interests
  settingsUrl?: string; // Account settings → Emails
  company: string; // "NOTESAPP TECHNOLOGIES LTD · RC 9825642"
};

const C = { ink: "#1A1210", body: "#3B302C", muted: "#6B5E5A", rule: "#E8DDD6", paper: "#FBF6F2", crimson: "#7A0328", link: "#A6093D", dark: "#1A1210" };
const SANS = "-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const SERIF = "Georgia,'Times New Roman',serif";
const esc = (v: string) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const count = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1).replace(/\.0$/, "")}k` : String(n));

export const digestSubject = (d: Pick<DigestEmail, "stories">) =>
  d.stories.length ? `${d.stories[0].title} | #NotesApp Weekly Digest` : "#NotesApp Weekly Digest";

function story(s: DigestStory, last: boolean): string {
  const by = `${esc(s.writerName)}${s.inName ? ` <span style="color:${C.muted};">in</span> ${esc(s.inName)}` : ""}`;
  const meta = [
    s.premium ? `<span style="color:#C9A227;">&#10022;</span>&nbsp;Members only` : "",
    `${s.readMinutes} min read`,
    s.likes ? `&#9829;&nbsp;${count(s.likes)}` : "",
    s.comments ? `&#128172;&nbsp;${count(s.comments)}` : "",
  ].filter(Boolean).join(`<span style="color:${C.rule};">&nbsp;&nbsp;&middot;&nbsp;&nbsp;</span>`);
  const img = s.image
    ? `<a href="${esc(s.href)}"><img src="${esc(s.image)}" width="112" height="84" align="right" alt="" style="float:right;width:112px;height:84px;object-fit:cover;border:0;border-radius:4px;margin:2px 0 8px 14px;"></a>`
    : "";
  return `<tr><td style="padding:22px 0;${last ? "" : `border-bottom:1px solid ${C.rule};`}">
<table role="presentation" cellpadding="0" cellspacing="0"><tr>
<td style="padding-right:8px;vertical-align:middle;"><img src="${esc(s.writerAvatar)}" width="22" height="22" alt="" style="display:block;width:22px;height:22px;border-radius:50%;object-fit:cover;border:0;"></td>
<td style="vertical-align:middle;font-family:${SANS};font-size:14px;color:${C.ink};">${by}</td>
</tr></table>
<div style="margin-top:10px;">${img}<a href="${esc(s.href)}" style="text-decoration:none;color:${C.ink};"><span style="display:block;font-family:${SANS};font-size:21px;line-height:1.25;font-weight:800;color:${C.ink};">${esc(s.title)}</span></a>
<p style="margin:8px 0 0;font-family:${SANS};font-size:15px;line-height:1.55;color:${C.muted};">${esc(s.summary)} <a href="${esc(s.href)}" style="color:${C.link};font-weight:600;text-decoration:none;white-space:nowrap;">Read more&nbsp;&raquo;</a></p></div>
<p style="clear:both;margin:12px 0 0;font-family:${SANS};font-size:13px;color:${C.muted};">${meta}</p>
</td></tr>`;
}

export function renderDigestHtml(d: DigestEmail): string {
  const r = d.reader;
  const button = (href: string, label: string, bg: string) =>
    `<table role="presentation" cellpadding="0" cellspacing="0" align="center"><tr><td bgcolor="${bg}" style="background:${bg};border-radius:999px;"><a href="${esc(href)}" style="display:inline-block;padding:12px 28px;font-family:${SANS};font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;">${label}</a></td></tr></table>`;
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>#NotesApp Weekly Digest</title></head>
<body style="margin:0;padding:0;background:${C.paper};">
<div style="display:none;max-height:0;overflow:hidden;">${esc(d.stories.map((s) => s.title).slice(0, 3).join(" · "))}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${C.paper}" style="background:${C.paper};"><tr><td align="center" style="padding:20px 10px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">
<tr><td bgcolor="#ffffff" style="background:#ffffff;padding:24px 24px 4px;border:1px solid ${C.rule};border-bottom:0;border-radius:8px 8px 0 0;">
  <table role="presentation" cellpadding="0" cellspacing="0"><tr>
    <td style="padding-right:10px;vertical-align:middle;"><img src="${esc(r.avatar)}" width="36" height="36" alt="" style="display:block;width:36px;height:36px;border-radius:50%;object-fit:cover;border:0;"></td>
    <td style="vertical-align:middle;font-family:${SANS};font-size:14px;line-height:1.35;color:${C.ink};">Stories for <strong>${esc(r.name)}</strong><br><span style="color:${C.muted};font-size:13px;">@${esc(r.username)} &middot; <a href="${esc(d.interestsUrl)}" style="color:${C.link};text-decoration:none;">Choose your interests</a></span></td>
  </tr></table>
  <p style="margin:22px 0 14px;font-family:${SERIF};font-size:34px;line-height:1.1;color:${C.ink};"><strong style="color:${C.crimson};">#NotesApp</strong> Weekly Digest</p>
  <p style="margin:0;padding:12px 0;border-top:1px solid ${C.ink};border-bottom:1px solid ${C.rule};font-family:${SANS};font-size:15px;font-weight:800;letter-spacing:1px;color:${C.ink};">THIS WEEK&rsquo;S HIGHLIGHTS</p>
</td></tr>
<tr><td bgcolor="#ffffff" style="background:#ffffff;padding:0 24px;border-left:1px solid ${C.rule};border-right:1px solid ${C.rule};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${d.stories.map((s, i) => story(s, i === d.stories.length - 1)).join("")}</table>
</td></tr>
<tr><td bgcolor="#ffffff" style="background:#ffffff;padding:8px 24px 28px;border-left:1px solid ${C.rule};border-right:1px solid ${C.rule};">${button(`${d.site}/journals`, "Read more in your feed", C.crimson)}</td></tr>
<tr><td bgcolor="${C.paper}" style="background:${C.paper};padding:28px 24px;border-left:1px solid ${C.rule};border-right:1px solid ${C.rule};text-align:center;">
  <p style="margin:0 0 16px;font-family:${SERIF};font-size:20px;line-height:1.35;color:${C.ink};">See more of what you like and less of what you don&rsquo;t.</p>
  ${button(d.interestsUrl, "Choose your interests", "#1F7A4D")}
</td></tr>
<tr><td bgcolor="${C.dark}" style="background:${C.dark};padding:26px 24px;border-radius:0 0 8px 8px;">
  <p style="margin:0 0 12px;font-family:${SANS};font-size:17px;font-weight:700;color:#ffffff;">Read from anywhere.</p>
  <table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="border:1px solid #6B5E5A;border-radius:8px;"><a href="${esc(d.appUrl)}" style="display:inline-block;padding:9px 16px;font-family:${SANS};font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">&#11015;&nbsp; Install #NotesApp on your phone or computer</a></td></tr></table>
  <p style="margin:18px 0 0;padding-top:16px;border-top:1px solid #3B302C;font-family:${SANS};font-size:12px;line-height:1.7;color:#BFB3AE;">Sent by #NotesApp &middot; ${esc(d.company)}<br>
  You get this because you have a #NotesApp account. <a href="${esc(d.unsubscribeUrl)}" style="color:#ffffff;">Unsubscribe from the weekly digest</a> &middot; <a href="${esc(d.settingsUrl ?? d.interestsUrl)}" style="color:#BFB3AE;">Email settings</a> &middot; <a href="${esc(d.site)}/help" style="color:#BFB3AE;">Help</a></p>
</td></tr>
</table></td></tr></table></body></html>`;
}

export function renderDigestText(d: DigestEmail): string {
  const lines = [`Stories for ${d.reader.name} (@${d.reader.username})`, "", "#NotesApp Weekly Digest: this week's highlights", ""];
  for (const s of d.stories) {
    lines.push(`${s.title}`, `${s.writerName}${s.inName ? ` in ${s.inName}` : ""} · ${s.readMinutes} min read${s.premium ? " · Members only" : ""}`, s.summary, `Read more: ${s.href}`, "");
  }
  lines.push(`Read more in your feed: ${d.site}/journals`, `Choose your interests: ${d.interestsUrl}`, "", `Unsubscribe from the weekly digest: ${d.unsubscribeUrl}`, `Sent by #NotesApp · ${d.company}`);
  return lines.join("\n");
}

// ---- choosing the stories (pure, so it can be tested) ----
export type PoolStory = DigestStory & { id: string; authorUid: string; authorUsername: string; tags: string[]; publishedAt: string };

// Up to `max` stories for one reader: people they follow first, then stories matching their interests (the hashtags they
// choose; `interests` on their profile), then what most people liked this week. Never their own.
export function pickStories(pool: PoolStory[], reader: { uid: string; follows: Set<string>; interests: string[] }, max = 5): PoolStory[] {
  const wanted = new Set(reader.interests.map((t) => t.toLowerCase().replace(/^#/, "")));
  const score = (s: PoolStory) =>
    (reader.follows.has(s.authorUsername) ? 1000 : 0) +
    s.tags.filter((t) => wanted.has(t.toLowerCase().replace(/^#/, ""))).length * 120 +
    Math.log1p(s.likes) * 12 + Math.log1p(s.comments) * 18 +
    (Date.parse(s.publishedAt) || 0) / 86_400_000 / 7; // newer by a hair, as a tie-break
  return pool.filter((s) => s.authorUid !== reader.uid).sort((a, b) => score(b) - score(a)).slice(0, max);
}
