"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { effectiveTier, getUserByUid, UserProfile } from "@/lib/users";
import { MAIN_HOST } from "@/lib/host";
import { canHaveSite, meetsTier, siteThemeOf, tierName, type SiteThemeId } from "@/lib/site-themes";
import { SITE_PAGES, SITE_PAGE_MAX, SITE_SECTIONS, siteSectionsOf, type SitePageId, type SiteSections } from "@/lib/site-settings";
import { BLOCKS, SECTION_MIN_TIER, blockAllowed, emptyBlocks, DEFAULT_ORDER, type BlockId, type Blocks, type Kit, type SiteDoc } from "@/lib/site-kits";
import { getTierConfig } from "@/lib/tiers";
import PageHero from "@/components/PageHero";
import RichTextEditor from "@/components/RichTextEditor";
import SiteThemePicker from "@/components/SiteThemePicker";
import KitPicker from "@/components/site-settings/KitPicker";
import PalettePicker from "@/components/site-settings/PalettePicker";
import BlockEditors from "@/components/site-settings/BlockEditors";
import { missingPagesText } from "@/components/SiteReminder";

// "Your site" (Free Basic and above; docs/SITES.md): where the site lives, then five steps: start from a kit, the look and its colours, what
// shows (the page sections and the content sections, in order), the content, and the About and Contact pages. Everything saves through the
// server (/api/site/kit, /theme, /sections, /content, /pages), which checks the plan; what the plan doesn't include shows a 🔒.
type Domain = { host: string; status: "pending" | "active" };

async function call(user: User, url: string, body?: unknown) {
  const res = await fetch(url, { method: body === undefined ? "GET" : "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${await user.getIdToken()}` }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(d.error || "Couldn't save that.");
  return d;
}

export default function YourSitePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null | undefined>(undefined);
  const [domain, setDomain] = useState<Domain | null>(null);
  const [theme, setTheme] = useState<SiteThemeId>("legacy");
  const [site, setSite] = useState<SiteDoc | null>(null);
  const [blocks, setBlocks] = useState<Blocks>(emptyBlocks());
  const [order, setOrder] = useState<BlockId[]>(DEFAULT_ORDER);
  const [sections, setSections] = useState<SiteSections>(siteSectionsOf(null));
  const [sectionsMsg, setSectionsMsg] = useState("");
  const [contentMsg, setContentMsg] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [text, setText] = useState<Record<SitePageId, string>>({ about: "", contact: "" });
  const [saved, setSaved] = useState<Record<SitePageId, string>>({ about: "", contact: "" }); // what the site shows now
  const [pageMsg, setPageMsg] = useState<Record<SitePageId, string>>({ about: "", contact: "" });

  const applyDoc = (d: SiteDoc) => { setSite(d); setBlocks(d.blocks); setOrder(d.order); };
  useEffect(() => onAuthStateChanged(auth, async (u) => {
    if (!u) { router.replace("/login?next=/profile/site"); return; }
    setUser(u);
    const p = await getUserByUid(u.uid).catch(() => null);
    setProfile(p);
    if (!p) return;
    setTheme(siteThemeOf(p));
    setSections(siteSectionsOf(p));
    const pages = { about: p.sitePages?.about || "", contact: p.sitePages?.contact || "" };
    setText(pages);
    setSaved(pages);
    if (!canHaveSite(p)) return;
    call(u, "/api/site/content").then((d) => applyDoc(d.site)).catch(() => applyDoc({ kit: "", palette: { id: "crimson" }, blocks: emptyBlocks(), order: DEFAULT_ORDER }));
    if (getTierConfig(effectiveTier(p)).customDomain) {
      fetch("/api/console/domain", { headers: { Authorization: `Bearer ${await u.getIdToken()}` } })
        .then((r) => r.json()).then((d) => setDomain(d.domain || null)).catch(() => {});
    }
  }), [router]);

  async function applyKit(k: Kit) {
    if (!user) return;
    const d = await call(user, "/api/site/kit", { kit: k.id });
    applyDoc(d.site); setTheme(d.theme); setSections(d.sections);
  }

  async function saveSections() {
    if (!user) return;
    setBusy("sections"); setSectionsMsg("");
    try {
      await call(user, "/api/site/sections", { sections });
      const d = await call(user, "/api/site/content", { blocks, order });
      applyDoc(d.site);
      setSectionsMsg("Saved. Your site shows what you chose.");
    } catch (e) {
      setSectionsMsg(e instanceof Error ? e.message : "Couldn't save that.");
    } finally {
      setBusy(null);
    }
  }

  async function saveContent() {
    if (!user) return;
    setBusy("content"); setContentMsg("");
    try {
      const d = await call(user, "/api/site/content", { blocks });
      applyDoc(d.site);
      setContentMsg("Saved. Empty rows were left out.");
    } catch (e) {
      setContentMsg(e instanceof Error ? e.message : "Couldn't save that.");
    } finally {
      setBusy(null);
    }
  }

  async function savePage(page: SitePageId) {
    if (!user) return;
    setBusy(page); setPageMsg((m) => ({ ...m, [page]: "" }));
    try {
      const d = await call(user, "/api/site/pages", { page, markdown: text[page] });
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

  if (!canHaveSite(profile)) {
    return (
      <>
        <PageHero compact max="max-w-3xl" eyebrow={`@${profile.username}`} title={<>Your site</>} />
        <section className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="card border-l-4 border-crimson p-6 text-sm text-slate">
            <p>Your own website, with your profile, journals and more under your name, comes with <strong className="text-ink">Free Basic</strong>, which costs nothing: apply for it under <Link href="/profile/publishing" className="text-crimson underline">Rates &amp; payouts</Link>. Shops and services get more with Pro, and your own domain comes with Business.</p>
            <Link href="/pricing" className="btn-primary mt-4 inline-block !px-4 !py-2 text-xs">See the plans</Link>
          </div>
        </section>
      </>
    );
  }

  const tier = effectiveTier(profile);
  const ownDomain = getTierConfig(tier).customDomain;
  const preview = `/s/${profile.username}`;
  const live = domain?.status === "active";
  const siteHref = live ? `https://${domain.host}` : preview;
  const missing = SITE_PAGES.filter((x) => !saved[x.id].trim()).map((x) => x.id);
  const noneOn = !Object.values(sections).some(Boolean);
  const field = "rounded-2xl border border-rule p-4";
  const move = (id: BlockId, by: -1 | 1) => setOrder((o) => { const i = o.indexOf(id), j = i + by; if (j < 0 || j >= o.length) return o; const a = [...o]; [a[i], a[j]] = [a[j], a[i]]; return a; });

  return (
    <>
      <PageHero compact max="max-w-3xl" eyebrow={`@${profile.username}`} title={<>Your site</>}>
        <p>Your own website, under your name, with no #NotesApp menus around it: start from a kit, choose its look and colours, and put in your words, prices and pictures.</p>
      </PageHero>
      <section className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
        {missing.length > 0 && meetsTier(tier, "business") && (
          <div className="mb-8 border-l-4 border-crimson bg-crimson/[0.06] px-5 py-4 text-sm text-ink" role="status">
            <strong>{missingPagesText(missing)}</strong> Write {missing.length === 2 ? "them" : "it"} in step 5 below; once saved, {missing.length === 2 ? "each one" : "it"} is linked in your site&apos;s menu.
          </div>
        )}

        <div className="card p-6">
          <h2 className="font-display text-xl text-ink">Where your site is</h2>
          <ul className="mt-3 space-y-1 text-sm text-ink">
            <li>Your site: <a href={preview} target="_blank" rel="noopener noreferrer" className="font-mono text-crimson underline">{MAIN_HOST}{preview}</a></li>
            {ownDomain ? (domain ? (
              <li>
                Your domain: <a href={`https://${domain.host}`} target="_blank" rel="noopener noreferrer" className="font-mono text-crimson underline">{domain.host}</a>{" "}
                {live ? <span className="text-slate">(live)</span> : <span className="text-slate">(not connected yet: finish it in the <Link href="/console" className="text-crimson underline">Console</Link>)</span>}
              </li>
            ) : (
              <li className="text-slate">You can connect your own domain, such as notes.yourbrand.com, in the <Link href="/console" className="text-crimson underline">Console</Link>.</li>
            )) : <li className="text-slate">Your own domain (yourbrand.com) comes with Business. <Link href="/pricing" className="text-crimson underline">See plans</Link></li>}
          </ul>
          <p className="mt-3 text-sm text-slate">It updates by itself when you publish a journal or add something to your shop. Visitors can book you and pay without leaving it.</p>
          <a href={siteHref} target="_blank" rel="noopener noreferrer" className="btn-primary mt-4 inline-block !px-4 !py-2 text-xs">View your site</a>
        </div>

        <KitPicker tier={tier} current={site?.kit ?? ""} onApply={applyKit} />

        <SiteThemePicker key={theme} current={theme} username={profile.username} tier={tier} title="2. Choose its look and colours" onChange={setTheme}>
          {site && <PalettePicker key={`${site.palette.id}${site.palette.custom ?? ""}`} tier={tier} value={site.palette} onSave={async (palette) => { if (!user) return; const d = await call(user, "/api/site/content", { palette }); applyDoc(d.site); }} />}
        </SiteThemePicker>

        <section className="card mt-10 p-6" aria-labelledby="sections-h">
          <h2 id="sections-h" className="font-display text-xl text-ink">3. Choose what shows</h2>
          <p className="mt-1 text-sm text-slate">Pages: each gets its own page and a link in your site&apos;s menu, and a preview on Home. Keep at least one on.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {SITE_SECTIONS.map((s) => {
              const open = meetsTier(tier, SECTION_MIN_TIER[s.id]);
              return (
                <label key={s.id} className={`${field} flex items-start gap-3 ${open ? "cursor-pointer" : "opacity-60"} ${sections[s.id] && open ? "border-crimson" : ""}`}>
                  <input type="checkbox" checked={sections[s.id] && open} disabled={!open} onChange={(e) => setSections((cur) => ({ ...cur, [s.id]: e.target.checked }))} className="mt-1" />
                  <span>
                    <span className="block font-ui text-sm font-bold text-ink">{s.name}</span>
                    <span className="mt-1 block text-xs text-slate">{s.blurb}</span>
                    {!open && <span className="mt-1 block text-xs font-semibold text-slate">🔒 Comes with {tierName(SECTION_MIN_TIER[s.id])}</span>}
                    {open && s.id === "track" && <Link href="/shipments" className="mt-1 block text-xs text-crimson underline">Book and manage shipments</Link>}
                  </span>
                </label>
              );
            })}
          </div>
          <p className="mt-6 text-sm text-slate">Sections on Home, in this order (use the arrows). Fill them in at step 4.</p>
          <ol className="mt-3 space-y-2">
            {order.map((id, n) => {
              const b = BLOCKS.find((x) => x.id === id)!;
              const open = blockAllowed(id, tier);
              return (
                <li key={id} className={`${field} flex items-start gap-3 ${open ? "" : "opacity-60"} ${blocks[id].on && open ? "border-crimson" : ""}`}>
                  <input type="checkbox" aria-label={b.name} checked={blocks[id].on && open} disabled={!open} onChange={(e) => setBlocks((cur) => ({ ...cur, [id]: { ...cur[id], on: e.target.checked } }))} className="mt-1" />
                  <span className="flex-1">
                    <span className="block font-ui text-sm font-bold text-ink">{b.name}</span>
                    <span className="mt-1 block text-xs text-slate">{b.blurb}</span>
                    {!open && <span className="mt-1 block text-xs font-semibold text-slate">🔒 Comes with {tierName(b.minTier)}</span>}
                  </span>
                  <span className="flex shrink-0 flex-col gap-1">
                    <button type="button" aria-label={`Move ${b.name} up`} disabled={n === 0} onClick={() => move(id, -1)} className="rounded border border-rule px-2 text-xs disabled:opacity-30">↑</button>
                    <button type="button" aria-label={`Move ${b.name} down`} disabled={n === order.length - 1} onClick={() => move(id, 1)} className="rounded border border-rule px-2 text-xs disabled:opacity-30">↓</button>
                  </span>
                </li>
              );
            })}
          </ol>
          <div className="mt-4 flex flex-wrap items-center gap-4">
            <button type="button" onClick={saveSections} disabled={busy !== null || noneOn} className="btn-primary !px-4 !py-2 text-xs disabled:opacity-50">{busy === "sections" ? "Saving…" : "Save"}</button>
            {noneOn ? <p className="text-sm text-crimson">Switch on at least one page.</p> : sectionsMsg && <p className="text-sm text-ink" role="status">{sectionsMsg}</p>}
          </div>
        </section>

        <section className="card mt-10 p-6" aria-labelledby="content-h">
          <h2 id="content-h" className="font-display text-xl text-ink">4. Your words, prices and pictures</h2>
          <p className="mt-1 text-sm text-slate">What goes in each section you switched on. Only add what&apos;s true about you and your business.</p>
          <BlockEditors tier={tier} value={blocks} onChange={setBlocks} />
          <div className="mt-4 flex flex-wrap items-center gap-4">
            <button type="button" onClick={saveContent} disabled={busy !== null} className="btn-primary !px-4 !py-2 text-xs disabled:opacity-50">{busy === "content" ? "Saving…" : "Save"}</button>
            {contentMsg && <p className="text-sm text-ink" role="status">{contentMsg}</p>}
          </div>
        </section>

        <section className="mt-10" aria-labelledby="pages-h">
          <h2 id="pages-h" className="font-display text-xl text-ink">5. Write your About and Contact pages</h2>
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
