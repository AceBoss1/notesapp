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
// Then, when there are any, "From Notes Market" and "From Notes Academy": four each, two to a row, the week's most viewed on
// the reader's interests. Up to three sponsored slots (Admin → Ads): after the 2nd journal a boosted journal, after the 6th an
// advert, and near the end, before the interests box, a boosted store item or an advert; each in the 1200 × 628 frame.
// The #NotesApp mark leads the title ("Weekly Digest" drops to its own line on phones), and the logo the other emails carry
// sits above the interests box.
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
  views?: number;
  premium: boolean;
};
// A store item or a course in the Market and Academy sections.
export type DigestItem = { title: string; href: string; image: string | null; price: string; by: string; why: string };
// A sponsored slot: a boosted journal or store item ("Promoted") or an advert ("Sponsored: NotesApp Ads"). href goes through
// /api/digest/go so the click is counted.
export type DigestSponsored = { slot: 1 | 2 | 3; kind: "post" | "item" | "ad"; id: string; title: string; text?: string; image: string | null; href: string; label: string };
export type DigestReader = { name: string; username: string; avatar: string };
export type DigestEmail = {
  reader: DigestReader;
  stories: DigestStory[];
  market?: DigestItem[]; // Notes Market: most viewed and most bought, when there are any
  courses?: DigestItem[]; // Notes Academy: the same, once courses exist
  sponsored?: DigestSponsored[]; // up to three, by slot
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
    s.views ? `${count(s.views)} views` : "",
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

function itemCell(it: DigestItem): string {
  const img = it.image
    ? `<img src="${esc(it.image)}" width="260" height="150" alt="" style="display:block;width:100%;max-width:260px;height:150px;object-fit:cover;border:0;border-radius:6px;">`
    : `<div style="width:100%;height:150px;border-radius:6px;background:${C.paper};"></div>`;
  return `<a href="${esc(it.href)}">${img}</a>
<a href="${esc(it.href)}" style="display:block;margin-top:8px;text-decoration:none;color:${C.ink};font-family:${SANS};font-size:15px;font-weight:700;line-height:1.3;">${esc(it.title)}</a>
<p style="margin:3px 0 0;font-family:${SANS};font-size:13px;color:${C.body};">${esc(it.price)} &middot; ${esc(it.by)}</p>
<p style="margin:2px 0 0;font-family:${SANS};font-size:12px;color:${C.muted};">${esc(it.why)}</p>`;
}
// Two to a row (each cell half the width), which mail apps keep side by side even on a phone.
function itemSection(title: string, items: DigestItem[] | undefined, more: { href: string; label: string }): string {
  if (!items?.length) return "";
  const rows: string[] = [];
  for (let i = 0; i < items.length; i += 2) {
    rows.push(`<tr>${[items[i], items[i + 1]].map((it, j) => `<td width="50%" style="width:50%;vertical-align:top;padding:14px ${j ? "0 0 0 8px" : "8px 0 0"};">${it ? itemCell(it) : ""}</td>`).join("")}</tr>`);
  }
  return `<tr><td bgcolor="#ffffff" style="background:#ffffff;padding:4px 24px 22px;border-left:1px solid ${C.rule};border-right:1px solid ${C.rule};">
  <p style="margin:0;padding:12px 0;border-top:1px solid ${C.ink};border-bottom:1px solid ${C.rule};font-family:${SANS};font-size:15px;font-weight:800;letter-spacing:1px;color:${C.ink};">${title}</p>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows.join("")}</table>
  <p style="margin:12px 0 0;font-family:${SANS};font-size:14px;"><a href="${esc(more.href)}" style="color:${C.link};font-weight:600;text-decoration:none;">${more.label}&nbsp;&raquo;</a></p>
</td></tr>`;
}
// A sponsored slot inside the white column: the picture (an advert's is already 1.91 : 1; a boosted post's or item's own
// picture is cut to a band), the title, the words and the label.
function sponsoredBlock(x: DigestSponsored | undefined): string {
  if (!x) return "";
  const img = x.image ? `<a href="${esc(x.href)}"><img src="${esc(x.image)}" width="550" alt="" style="display:block;width:100%;${x.kind === "ad" ? "height:auto" : "height:220px;object-fit:cover"};border:0;border-radius:6px 6px 0 0;"></a>` : "";
  return `<tr><td style="padding:18px 0;border-bottom:1px solid ${C.rule};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${C.rule};border-radius:8px;"><tr><td>${img}
<div style="padding:12px 14px;"><a href="${esc(x.href)}" style="text-decoration:none;color:${C.ink};font-family:${SANS};font-size:16px;font-weight:700;line-height:1.3;">${esc(x.title)}</a>
${x.text ? `<p style="margin:4px 0 0;font-family:${SANS};font-size:14px;line-height:1.45;color:${C.body};">${esc(x.text)}</p>` : ""}
<p style="margin:6px 0 0;font-family:${SANS};font-size:11px;letter-spacing:.5px;text-transform:uppercase;color:${C.muted};">${esc(x.label)}</p></div>
</td></tr></table></td></tr>`;
}

const slot = (d: DigestEmail, n: 1 | 2 | 3) => d.sponsored?.find((x) => x.slot === n);

export function renderDigestHtml(d: DigestEmail): string {
  const r = d.reader;
  const button = (href: string, label: string, bg: string) =>
    `<table role="presentation" cellpadding="0" cellspacing="0" align="center"><tr><td bgcolor="${bg}" style="background:${bg};border-radius:999px;"><a href="${esc(href)}" style="display:inline-block;padding:12px 28px;font-family:${SANS};font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;">${label}</a></td></tr></table>`;
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>#NotesApp Weekly Digest</title>
<style>@media only screen and (max-width:480px){.na-title-line{display:block !important;}}</style></head>
<body style="margin:0;padding:0;background:${C.paper};">
<div style="display:none;max-height:0;overflow:hidden;">${esc(d.stories.map((s) => s.title).slice(0, 3).join(" · "))}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${C.paper}" style="background:${C.paper};"><tr><td align="center" style="padding:20px 10px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">
<tr><td bgcolor="#ffffff" style="background:#ffffff;padding:24px 24px 4px;border:1px solid ${C.rule};border-bottom:0;border-radius:8px 8px 0 0;">
  <table role="presentation" cellpadding="0" cellspacing="0"><tr>
    <td style="padding-right:10px;vertical-align:middle;"><img src="${esc(r.avatar)}" width="36" height="36" alt="" style="display:block;width:36px;height:36px;border-radius:50%;object-fit:cover;border:0;"></td>
    <td style="vertical-align:middle;font-family:${SANS};font-size:14px;line-height:1.35;color:${C.ink};">Stories for <strong>${esc(r.name)}</strong><br><span style="color:${C.muted};font-size:13px;">@${esc(r.username)} &middot; <a href="${esc(d.interestsUrl)}" style="color:${C.link};text-decoration:none;">Choose your interests</a></span></td>
  </tr></table>
  <p style="margin:22px 0 14px;font-family:${SERIF};font-size:34px;line-height:1.1;color:${C.ink};"><img src="${esc(d.site)}/images/brand/icon-192.png" width="34" height="34" alt="#" style="display:inline-block;width:34px;height:34px;border:0;border-radius:8px;vertical-align:-5px;margin-right:8px;"><strong style="color:${C.crimson};">NotesApp</strong> <span class="na-title-line" style="display:inline;">Weekly Digest</span></p>
  <p style="margin:0;padding:12px 0;border-top:1px solid ${C.ink};border-bottom:1px solid ${C.rule};font-family:${SANS};font-size:15px;font-weight:800;letter-spacing:1px;color:${C.ink};">THIS WEEK&rsquo;S HIGHLIGHTS</p>
</td></tr>
<tr><td bgcolor="#ffffff" style="background:#ffffff;padding:0 24px;border-left:1px solid ${C.rule};border-right:1px solid ${C.rule};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${d.stories.map((s, i) => story(s, i === d.stories.length - 1) + (i === 1 ? sponsoredBlock(slot(d, 1)) : i === 5 ? sponsoredBlock(slot(d, 2)) : "")).join("")}${d.stories.length < 2 ? sponsoredBlock(slot(d, 1)) : ""}${d.stories.length >= 2 && d.stories.length < 6 ? sponsoredBlock(slot(d, 2)) : ""}</table>
</td></tr>
<tr><td bgcolor="#ffffff" style="background:#ffffff;padding:8px 24px 28px;border-left:1px solid ${C.rule};border-right:1px solid ${C.rule};">${button(`${d.site}/journals`, "Read more in your feed", C.crimson)}</td></tr>
${itemSection("FROM NOTES MARKET", d.market, { href: `${d.site}/shop`, label: "Browse Notes Market" })}
${itemSection("FROM NOTES ACADEMY", d.courses, { href: `${d.site}/academy`, label: "Browse Notes Academy" })}
${slot(d, 3) ? `<tr><td bgcolor="#ffffff" style="background:#ffffff;padding:0 24px 8px;border-left:1px solid ${C.rule};border-right:1px solid ${C.rule};"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${sponsoredBlock(slot(d, 3))}</table></td></tr>` : ""}
<tr><td bgcolor="${C.paper}" style="background:${C.paper};padding:28px 24px;border-left:1px solid ${C.rule};border-right:1px solid ${C.rule};text-align:center;">
  <a href="${esc(d.site)}" style="text-decoration:none;"><img src="${esc(d.site)}/images/brand/email-logo.png" width="160" alt="#NotesApp" style="display:block;margin:0 auto 18px;border:0;height:auto;width:160px;"></a>
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
    lines.push(`${s.title}`, `${s.writerName}${s.inName ? ` in ${s.inName}` : ""} · ${s.readMinutes} min read${s.views ? ` · ${count(s.views)} views` : ""}${s.premium ? " · Members only" : ""}`, s.summary, `Read more: ${s.href}`, "");
  }
  for (const x of d.sponsored ?? []) lines.push(`${x.label}: ${x.title}${x.text ? ` — ${x.text}` : ""}: ${x.href}`, "");
  for (const [title, items] of [["From Notes Market", d.market], ["From Notes Academy", d.courses]] as const) {
    if (!items?.length) continue;
    lines.push(`${title}:`, ...items.map((it) => `- ${it.title} · ${it.price} · ${it.by} (${it.why}): ${it.href}`), "");
  }
  lines.push(`Read more in your feed: ${d.site}/journals`, `Choose your interests: ${d.interestsUrl}`, "", `Unsubscribe from the weekly digest: ${d.unsubscribeUrl}`, `Sent by #NotesApp · ${d.company}`);
  return lines.join("\n");
}

// ---- choosing the stories (pure, so it can be tested) ----
export type PoolStory = DigestStory & { id: string; authorUid: string; authorUsername: string; tags: string[]; publishedAt: string };

// Up to `max` stories for one reader, the reader's interests first (the hashtags they choose; `interests` on their profile),
// with people they follow mixed in, each ranked by views this week; then the week's most viewed fill any gaps. Never their own.
export function pickStories(pool: PoolStory[], reader: { uid: string; follows: Set<string>; interests: string[] }, max = 10): PoolStory[] {
  const wanted = new Set(reader.interests.map(norm));
  const score = (s: PoolStory) =>
    s.tags.filter((t) => wanted.has(norm(t))).length * 1000 +
    (reader.follows.has(s.authorUsername) ? 600 : 0) +
    Math.log1p(s.views ?? 0) * 40 + Math.log1p(s.likes) * 8 + Math.log1p(s.comments) * 10 +
    (Date.parse(s.publishedAt) || 0) / 86_400_000 / 7; // newer by a hair, as a tie-break
  return pool.filter((s) => s.authorUid !== reader.uid).sort((a, b) => score(b) - score(a)).slice(0, max);
}
const norm = (t: string) => t.toLowerCase().replace(/^#/, "");

// A Market item or course with what it's about and how much it was looked at, for picking per reader.
export type PoolItem = DigestItem & { id: string; tags: string[]; heat: number; ownerUid?: string };
// Up to `max`, the most viewed on the reader's interests first, then the most viewed of the rest. Never their own.
export function pickItems(pool: PoolItem[], reader: { uid?: string; interests: string[] }, max = 4): DigestItem[] {
  const wanted = new Set(reader.interests.map(norm));
  const hits = (i: PoolItem) => i.tags.filter((t) => wanted.has(norm(t))).length;
  return pool
    .filter((i) => !reader.uid || i.ownerUid !== reader.uid)
    .sort((a, b) => (hits(b) > 0 ? 1 : 0) - (hits(a) > 0 ? 1 : 0) || b.heat - a.heat)
    .slice(0, max)
    .map(({ id: _id, tags: _t, heat: _h, ownerUid: _o, ...item }) => item);
}

// The sponsored slots for one reader. Candidates come in best first (paid adverts before house ones); boosts on the reader's
// interests go first. Slot 1: a boosted journal, else an advert. Slot 2: an advert, else a boosted journal. Slot 3: a boosted
// store item, else an advert. A slot with nothing left is left out, and nothing shows twice. `slots` (0–3) is Admin → Ads.
export type SlotCandidate = Omit<DigestSponsored, "slot"> & { tags?: string[]; ownerUid?: string; paid?: boolean; target?: string }; // target: where it leads, to skip a story already in the email
export function fillSlots(c: { posts: SlotCandidate[]; items: SlotCandidate[]; ads: SlotCandidate[] }, reader: { uid: string; interests: string[]; storyHrefs?: Set<string> }, slots = 3): DigestSponsored[] {
  const wanted = new Set(reader.interests.map(norm));
  const fit = (x: SlotCandidate) => (x.tags ?? []).some((t) => wanted.has(norm(t)));
  const order = (list: SlotCandidate[]) => list.filter((x) => x.ownerUid !== reader.uid).map((x, i) => ({ x, i })).sort((a, b) => Number(fit(b.x)) - Number(fit(a.x)) || Number(!!b.x.paid) - Number(!!a.x.paid) || a.i - b.i).map((o) => o.x);
  const used = new Set<string>();
  const take = (...lists: SlotCandidate[][]) => {
    for (const list of lists) for (const x of order(list)) if (!used.has(`${x.kind}:${x.id}`) && !(x.target && reader.storyHrefs?.has(x.target))) { used.add(`${x.kind}:${x.id}`); return x; }
    return undefined;
  };
  const plan: [1 | 2 | 3, SlotCandidate[][]][] = [[1, [c.posts, c.ads]], [2, [c.ads, c.posts]], [3, [c.items, c.ads]]];
  const out: DigestSponsored[] = [];
  for (const [slot, lists] of plan.slice(0, Math.max(0, Math.min(3, slots)))) {
    const x = take(...lists);
    if (x) { const { tags: _t, ownerUid: _o, paid: _p, target: _g, ...rest } = x; out.push({ ...rest, slot }); }
  }
  return out;
}
