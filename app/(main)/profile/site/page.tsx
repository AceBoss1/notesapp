"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { getUserByUid, UserProfile } from "@/lib/users";
import { MAIN_HOST } from "@/lib/host";
import { canChooseSiteTheme } from "@/lib/site-themes";
import { SITE_PAGES, SITE_PAGE_MAX, SITE_SECTIONS, siteSectionsOf, type SitePageId, type SiteSections } from "@/lib/site-settings";
import PageHero from "@/components/PageHero";
import RichTextEditor from "@/components/RichTextEditor";
import SiteThemePicker from "@/components/SiteThemePicker";
import { missingPagesText } from "@/components/SiteReminder";

// "Your site" (Business and Enterprise): what their own site is and where it lives, then the three things they set up there:
// the theme, which sections show (Journals, Shop, Courses) and the About and Contact pages. Everything saves through the server
// (/api/site/theme, /api/site/sections, /api/site/pages), which checks the plan.
type Domain = { host: string; status: "pending" | "active" };

async function post(user: User, url: string, body: unknown) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${await user.getIdToken()}` }, body: JSON.stringify(body) });
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(d.error || "Couldn't save that.");
  return d;
}

export default function YourSitePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null | undefined>(undefined);
  const [domain, setDomain] = useState<Domain | null>(null);
  const [sections, setSections] = useState<SiteSections>(siteSectionsOf(null));
  const [sectionsMsg, setSectionsMsg] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [text, setText] = useState<Record<SitePageId, string>>({ about: "", contact: "" });
  const [saved, setSaved] = useState<Record<SitePageId, string>>({ about: "", contact: "" }); // what the site shows now
  const [pageMsg, setPageMsg] = useState<Record<SitePageId, string>>({ about: "", contact: "" });

  useEffect(() => onAuthStateChanged(auth, async (u) => {
    if (!u) { router.replace("/login?next=/profile/site"); return; }
    setUser(u);
    const p = await getUserByUid(u.uid).catch(() => null);
    setProfile(p);
    if (!p) return;
    setSections(siteSectionsOf(p));
    const pages = { about: p.sitePages?.about || "", contact: p.sitePages?.contact || "" };
    setText(pages);
    setSaved(pages);
    if (canChooseSiteTheme(p)) {
      fetch("/api/console/domain", { headers: { Authorization: `Bearer ${await u.getIdToken()}` } })
        .then((r) => r.json()).then((d) => setDomain(d.domain || null)).catch(() => {});
    }
  }), [router]);

  async function saveSections() {
    if (!user) return;
    setBusy("sections"); setSectionsMsg("");
    try {
      await post(user, "/api/site/sections", { sections });
      setSectionsMsg("Saved. Your site shows what you chose.");
    } catch (e) {
      setSectionsMsg(e instanceof Error ? e.message : "Couldn't save that.");
    } finally {
      setBusy(null);
    }
  }

  async function savePage(page: SitePageId) {
    if (!user) return;
    setBusy(page); setPageMsg((m) => ({ ...m, [page]: "" }));
    try {
      const d = await post(user, "/api/site/pages", { page, markdown: text[page] });
      setSaved((s) => ({ ...s, [page]: d.markdown }));
      setText((t) => ({ ...t, [page]: d.markdown }));
      try { localStorage.removeItem(`notesapp:draft:site-${page}-${user.uid}`); } catch {}
      const name = page === "about" ? "About" : "Contact";
      setPageMsg((m) => ({ ...m, [page]: d.markdown ? `Saved. Your ${name} page is on your site.` : `Saved. Your site no longer has a ${name} page.` }));
    } catch (e) {
      setPageMsg((m) => ({ ...m, [page]: e instanceof Error ? e.message : "Couldn't save the page." }));
    } finally {
      setBusy(null);
    }
  }

  if (profile === undefined) return <div className="px-6 py-24 text-center text-slate">Loading…</div>;
  if (profile === null) return <div className="px-6 py-24 text-center text-slate">Profile not found.</div>;

  if (!canChooseSiteTheme(profile)) {
    return (
      <>
        <PageHero compact max="max-w-3xl" eyebrow={`@${profile.username}`} title={<>Your site</>} />
        <section className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="card border-l-4 border-crimson p-6 text-sm text-slate">
            <p>Your own website, with your profile, journals and shop under your name (and on your own domain if you like), is part of the Business and Enterprise plans. There you choose its look, what it shows, and write its About and Contact pages.</p>
            <Link href="/pricing" className="btn-primary mt-4 inline-block !px-4 !py-2 text-xs">See the plans</Link>
          </div>
        </section>
      </>
    );
  }

  const preview = `/s/${profile.username}`;
  const live = domain?.status === "active";
  const siteHref = live ? `https://${domain.host}` : preview;
  const missing = SITE_PAGES.filter((x) => !saved[x.id].trim()).map((x) => x.id);
  const noneOn = !Object.values(sections).some(Boolean);
  const field = "rounded-2xl border border-rule p-4";

  return (
    <>
      <PageHero compact max="max-w-3xl" eyebrow={`@${profile.username}`} title={<>Your site</>}>
        <p>Your own website: your profile, journals and shop under your name, with no #NotesApp menus around them.</p>
      </PageHero>
      <section className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
        {missing.length > 0 && (
          <div className="mb-8 border-l-4 border-crimson bg-crimson/[0.06] px-5 py-4 text-sm text-ink" role="status">
            <strong>{missingPagesText(missing)}</strong> Write {missing.length === 2 ? "them" : "it"} in step 3 below; once saved, {missing.length === 2 ? "each one" : "it"} is linked in your site&apos;s menu.
          </div>
        )}

        <div className="card p-6">
          <h2 className="font-display text-xl text-ink">How your site works</h2>
          <p className="mt-2 text-sm text-slate">
            Visitors see your profile, your journals and your shop, can book a session with you, and can sign in and pay without leaving it.
            It updates by itself when you publish a journal or add something to your shop.
          </p>
          <p className="mt-4 eyebrow">Where it is</p>
          <ul className="mt-2 space-y-1 text-sm text-ink">
            {domain ? (
              <li>
                Your domain: <a href={`https://${domain.host}`} target="_blank" rel="noopener noreferrer" className="font-mono text-crimson underline">{domain.host}</a>{" "}
                {live ? <span className="text-slate">(live)</span> : <span className="text-slate">(not connected yet: finish it in the <Link href="/console" className="text-crimson underline">Console</Link>)</span>}
              </li>
            ) : (
              <li className="text-slate">You haven&apos;t added your own domain. You can connect one, such as notes.yourbrand.com, in the <Link href="/console" className="text-crimson underline">Console</Link>.</li>
            )}
            <li>Preview{domain ? " (always works)" : ""}: <a href={preview} target="_blank" rel="noopener noreferrer" className="font-mono text-crimson underline">{MAIN_HOST}{preview}</a></li>
          </ul>
          <p className="mt-4 eyebrow">Set it up in three steps</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-ink">
            <li><strong>Choose a theme</strong>: the look of the whole site. You can switch at any time.</li>
            <li><strong>Choose what shows</strong>: Journals, Shop and Courses, each on or off. Home shows your profile and then what you chose.</li>
            <li><strong>Write your About and Contact pages</strong>: who you are and how to reach you, with the same editor as your journals.</li>
          </ol>
          <a href={siteHref} target="_blank" rel="noopener noreferrer" className="btn-primary mt-5 inline-block !px-4 !py-2 text-xs">View your site</a>
        </div>

        <SiteThemePicker current={profile.siteTheme} username={profile.username} title="1. Choose a theme" />

        <section className="card mt-10 p-6" aria-labelledby="sections-h">
          <h2 id="sections-h" className="font-display text-xl text-ink">2. Choose what shows</h2>
          <p className="mt-1 text-sm text-slate">Each section you switch on gets its own page and a link in your site&apos;s menu, and appears on Home right under your profile. A section you switch off disappears from the site. Keep at least one on.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {SITE_SECTIONS.map((s) => (
              <label key={s.id} className={`${field} flex cursor-pointer items-start gap-3 ${sections[s.id] ? "border-crimson" : ""}`}>
                <input type="checkbox" checked={sections[s.id]} onChange={(e) => setSections((cur) => ({ ...cur, [s.id]: e.target.checked }))} className="mt-1" />
                <span>
                  <span className="block font-ui text-sm font-bold text-ink">{s.name}</span>
                  <span className="mt-1 block text-xs text-slate">{s.blurb}</span>
                </span>
              </label>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-4">
            <button type="button" onClick={saveSections} disabled={busy !== null || noneOn} className="btn-primary !px-4 !py-2 text-xs disabled:opacity-50">{busy === "sections" ? "Saving…" : "Save"}</button>
            {noneOn ? <p className="text-sm text-crimson">Switch on at least one section.</p> : sectionsMsg && <p className="text-sm text-ink" role="status">{sectionsMsg}</p>}
          </div>
        </section>

        <section className="mt-10" aria-labelledby="pages-h">
          <h2 id="pages-h" className="font-display text-xl text-ink">3. Write your About and Contact pages</h2>
          <p className="mt-1 text-sm text-slate">Each page is linked in your site&apos;s menu once it has something in it. Leave one empty and save to take it off your site. Your writing is kept on this device as you type, until you save.</p>
          {SITE_PAGES.map((pg) => {
            const over = text[pg.id].length > SITE_PAGE_MAX;
            const changed = text[pg.id].trim() !== saved[pg.id].trim();
            return (
              <div key={pg.id} className="card mt-5 p-6">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="font-ui text-base font-bold text-ink">{pg.name}</h3>
                  {saved[pg.id].trim() && <a href={`${siteHref}/${pg.id}`} target="_blank" rel="noopener noreferrer" className="text-xs text-crimson underline">View the {pg.name} page</a>}
                </div>
                <p className="mt-1 text-sm text-slate">{pg.hint}</p>
                <div className="mt-4">
                  <RichTextEditor value={text[pg.id]} onChange={(v) => setText((t) => ({ ...t, [pg.id]: v }))} draftKey={`site-${pg.id}-${profile.uid}`} />
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-4">
                  <button type="button" onClick={() => savePage(pg.id)} disabled={busy !== null || over || !changed} className="btn-primary !px-4 !py-2 text-xs disabled:opacity-50">{busy === pg.id ? "Saving…" : `Save ${pg.name}`}</button>
                  <span className={`font-mono text-xs ${over ? "text-crimson" : "text-slate"}`}>{text[pg.id].length.toLocaleString("en-NG")} / {SITE_PAGE_MAX.toLocaleString("en-NG")}</span>
                  {pageMsg[pg.id] && <p className="text-sm text-ink" role="status">{pageMsg[pg.id]}</p>}
                </div>
              </div>
            );
          })}
        </section>

        <p className="mt-10 text-sm text-slate">
          All set? <a href={siteHref} target="_blank" rel="noopener noreferrer" className="font-semibold text-crimson underline">View your site</a>. Your name, picture and bio come from <Link href="/profile/edit" className="text-crimson underline">Edit profile</Link>.
        </p>
      </section>
    </>
  );
}
