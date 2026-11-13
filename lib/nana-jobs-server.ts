import type { Firestore } from "firebase-admin/firestore";
import { accountCryptoConfigured, decryptSecret, encryptSecret } from "./account-crypto";
import { providerAccount, providersStatus } from "./ai-connect";
import { PROVIDER_INFO, completeJson, modelOf, pickProvider, type Account, type AiProvider, type Fetch, type Sleep } from "./ai-providers";
import { listJobs } from "./jobs-server";
import { JOB_TYPE_LABEL, payText, placeText, type Job } from "./jobs";
import { SITE_URL } from "./host";
import {
  CV_MAX_CHARS, CV_MIN_CHARS, DEFAULT_PROFILE, DEFAULT_SETTINGS, MAX_COMPANIES, NanaJobsError, SHORTLIST, cleanProfile, cleanSettings, isJobStatus, nextRunAt,
  profileReady, whyNotAllowed, type Board, type CvReview, type Funnel, type JobStatus, type NjProfile, type NjRun, type NjSettings, type PoolJob, type ShortJob,
} from "./nana-jobs";
import {
  coverSystem, coverUser, cvSystem, dedupe, groundCoverNote, hardFilter, jobHash, pickShortlist, prescoreAll, scoringSystem, scoringUser, toShort,
  validateCvReview, validateVerdicts, verifyAll, type Candidate,
} from "./nana-jobs-funnel";
import { FEEDS, checkBoard, fetchBoards, fetchFeeds } from "./nana-jobs-sources";

// Nana Jobs on the server (docs/NANA_JOBS.md). Collections, all server-only (firestore.rules):
//   nanaJobsProfiles/{uid}   the scoring profile, sources, AI choice and alert settings; nextRunAt for the daily run
//   nanaJobsRuns/{uid}       the latest shortlist and its funnel (plus each listed job's text, for the cover note; never sent to browsers)
//   nanaJobsStatuses/{uid}   Interested / Applied / Not for me, per job. Only the member writes these: a run never overwrites them.
//   nanaJobsCv/{uid}         the member's CV text and its review, both encrypted with ACCOUNT_DATA_KEY. Deleted when they say so.
//   nanaJobsBoards/{ats_slug} the company boards members watch, fetched once a day for everyone
//   nanaJobsMeta/pool        which day's shared pool is current, and how many chunks it has
//   jobPool/{day}-{n}        the shared pool: every opening collected that day, ~100 to a document (a member's run reads a handful of
//                            documents, not thousands)
const PROFILES = "nanaJobsProfiles", RUNS = "nanaJobsRuns", STATUSES = "nanaJobsStatuses", CV = "nanaJobsCv", BOARDS = "nanaJobsBoards", META = "nanaJobsMeta", POOL = "jobPool";
const CHUNK = 100;
const BATCH = 5; // openings per AI request: 25 openings is 5 requests, which fits a free tier's per-minute limit
const lagosDay = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "Africa/Lagos" });

export type NjDeps = {
  fetch: Fetch; sleep?: Sleep; now?: () => Date;
  notify?: (b: { uid: string; message: string; linkHref: string }) => Promise<void>;
  email?: (uid: string, subject: string, text: string) => Promise<boolean>;
  account?: (db: Firestore, uid: string, p: AiProvider) => Promise<Account | null>;
  budgetMs?: number; // how long the AI may take in one run before the rest falls back to the keyword score
};
const nowOf = (d: NjDeps) => (d.now ? d.now() : new Date());

// ---- who ----
export async function assertAllowed(db: Firestore, uid: string): Promise<void> {
  const why = whyNotAllowed((await db.doc(`users/${uid}`).get()).data() ?? null);
  if (why) throw new NanaJobsError(why, 403);
}

// ---- profile and settings ----
type Doc = { profile: NjProfile; settings: NjSettings; steps: { sources: boolean; when: boolean }; setupDone: boolean; nextRunAt?: string | null };
async function readDoc(db: Firestore, uid: string): Promise<Doc & { exists: boolean }> {
  const d = (await db.doc(`${PROFILES}/${uid}`).get()).data();
  if (d) return { exists: true, profile: { ...DEFAULT_PROFILE, ...d.profile }, settings: { ...DEFAULT_SETTINGS, ...d.settings }, steps: { sources: !!d.steps?.sources, when: !!d.steps?.when }, setupDone: d.setupDone === true, nextRunAt: d.nextRunAt ?? null };
  // First visit: start from the profile and "I need a job" settings we already have.
  const [u, seeker] = await Promise.all([db.doc(`users/${uid}`).get(), db.doc(`jobSeekers/${uid}`).get()]);
  const city = String(seeker.data()?.city ?? "").trim();
  const title = String(u.data()?.jobTitle ?? "").trim();
  return { exists: false, profile: { ...DEFAULT_PROFILE, roles: title ? [title] : [], cities: city ? [city] : [] }, settings: { ...DEFAULT_SETTINGS }, steps: { sources: false, when: false }, setupDone: false, nextRunAt: null };
}

export type NjState = {
  profile: NjProfile; settings: NjSettings; steps: { ai: boolean; profile: boolean; sources: boolean; when: boolean }; setupDone: boolean; nextRunAt: string | null;
  providers: Awaited<ReturnType<typeof providersStatus>>; using: AiProvider | null;
  cv: { has: boolean; updatedAt?: string; chars?: number; fileName?: string; review: CvReview | null };
  run: NjRun | null;
};
export async function getState(db: Firestore, uid: string): Promise<NjState> {
  await assertAllowed(db, uid);
  const [doc, providers, cv, run, st] = await Promise.all([readDoc(db, uid), providersStatus(db, uid), db.doc(`${CV}/${uid}`).get(), db.doc(`${RUNS}/${uid}`).get(), db.doc(`${STATUSES}/${uid}`).get()]);
  const connected = providers.providers.filter((p) => p.connected).map((p) => p.provider);
  const c = cv.data();
  let review: CvReview | null = null;
  if (c?.review) { try { review = JSON.parse(decryptSecret(String(c.review))); } catch { review = null; } }
  const r = run.data();
  const statuses = (st.data()?.items ?? {}) as Record<string, { status: JobStatus }>;
  const runOut = r ? { ...(r as NjRun), jobs: ((r.jobs ?? []) as ShortJob[]).map((j) => ({ ...j, ...(statuses[j.hash] ? { status: statuses[j.hash].status } : {}) })) } : null;
  if (runOut) delete (runOut as Record<string, unknown>).details;
  return {
    profile: doc.profile, settings: doc.settings, setupDone: doc.setupDone, nextRunAt: doc.nextRunAt ?? null,
    steps: { ai: connected.length > 0, profile: profileReady(doc.profile), sources: doc.steps.sources, when: doc.steps.when },
    providers, using: pickProvider(connected, doc.settings.provider),
    cv: { has: !!c?.secret, ...(c ? { updatedAt: c.updatedAt, chars: c.chars, ...(c.fileName ? { fileName: c.fileName } : {}) } : {}), review },
    run: runOut,
  };
}

// Save any part of the set-up. `step` marks "Where to look" or "When to send it" as done; `finish` switches on the daily run.
export async function saveSetup(db: Firestore, uid: string, b: Record<string, unknown>, now = new Date()): Promise<void> {
  await assertAllowed(db, uid);
  const cur = await readDoc(db, uid);
  const profile = b.profile && typeof b.profile === "object" ? cleanProfile(b.profile as Record<string, unknown>, cur.profile) : cur.profile;
  const settings = b.settings && typeof b.settings === "object" ? cleanSettings(b.settings as Record<string, unknown>, cur.settings) : cur.settings;
  const steps = { ...cur.steps, ...(b.step === "sources" ? { sources: true } : {}), ...(b.step === "when" ? { when: true } : {}) };
  const setupDone = cur.setupDone || b.finish === true;
  if (b.finish === true && !profileReady(profile)) throw new NanaJobsError("Add at least one role you want, and where you can work, first.");
  const runAt = setupDone && (!cur.nextRunAt || settings.hour !== cur.settings.hour || !cur.setupDone) ? nextRunAt(settings.hour, now) : cur.nextRunAt ?? null;
  await db.doc(`${PROFILES}/${uid}`).set({ uid, profile, settings, steps, setupDone, nextRunAt: runAt, updatedAt: now.toISOString(), ...(cur.exists ? {} : { createdAt: now.toISOString() }) });
}

// ---- company boards ----
export async function addCompany(db: Firestore, uid: string, name: unknown, deps: Pick<NjDeps, "fetch">, now = new Date()): Promise<Board[]> {
  await assertAllowed(db, uid);
  const cur = await readDoc(db, uid);
  const n = String(name ?? "").replace(/\s+/g, " ").trim();
  if (n.length < 2) throw new NanaJobsError("Type the company's name.");
  if (cur.settings.companies.length >= MAX_COMPANIES) throw new NanaJobsError("You're watching as many companies as you can. Remove one first.");
  if (cur.settings.companies.some((c) => c.name.toLowerCase() === n.toLowerCase())) return cur.settings.companies;
  const board = await checkBoard(deps.fetch, n);
  if (board.ok && board.ats) await db.doc(`${BOARDS}/${board.ats}_${board.slug}`).set({ ats: board.ats, slug: board.slug, name: board.name, lastWantedAt: now.toISOString() }, { merge: true });
  const companies = [...cur.settings.companies, board];
  await db.doc(`${PROFILES}/${uid}`).set({ uid, profile: cur.profile, settings: { ...cur.settings, companies }, steps: cur.steps, setupDone: cur.setupDone, nextRunAt: cur.nextRunAt ?? null, updatedAt: now.toISOString() }, { merge: true });
  return companies;
}
export async function removeCompany(db: Firestore, uid: string, name: unknown): Promise<Board[]> {
  const cur = await readDoc(db, uid);
  const companies = cur.settings.companies.filter((c) => c.name.toLowerCase() !== String(name ?? "").toLowerCase());
  if (cur.exists) await db.doc(`${PROFILES}/${uid}`).update({ "settings.companies": companies });
  return companies;
}

// ---- the CV: kept encrypted, server-only, deletable; reviewed by the member's own AI ----
export async function saveCv(db: Firestore, uid: string, b: { text?: unknown; fileName?: unknown }, deps: NjDeps): Promise<{ review: CvReview | null; dropped: number; note: string }> {
  await assertAllowed(db, uid);
  if (!accountCryptoConfigured()) throw new NanaJobsError("Keeping a CV safely isn't set up yet. Please contact us.", 503);
  const text = String(b.text ?? "").replace(/\u0000/g, "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  if (text.length < CV_MIN_CHARS) throw new NanaJobsError("That's too short to be a CV. Paste all of it, or upload the PDF or Word file.");
  if (text.length > CV_MAX_CHARS) throw new NanaJobsError("That CV is very long. Please paste the main part (up to about 10 pages).");
  const now = nowOf(deps);
  const fileName = String(b.fileName ?? "").replace(/[^\w .()-]/g, "").slice(0, 80);
  await db.doc(`${CV}/${uid}`).set({ uid, secret: encryptSecret(text), chars: text.length, updatedAt: now.toISOString(), ...(fileName ? { fileName } : {}) });
  return reviewCv(db, uid, deps);
}
export async function reviewCv(db: Firestore, uid: string, deps: NjDeps): Promise<{ review: CvReview | null; dropped: number; note: string }> {
  const ref = db.doc(`${CV}/${uid}`);
  const c = (await ref.get()).data();
  if (!c?.secret) throw new NanaJobsError("Add your CV first.", 404);
  const ai = await chosenAccount(db, uid, deps);
  if (!ai) return { review: null, dropped: 0, note: "Your CV is saved. Connect your AI (step 1) and Nana will review it." };
  const cur = await readDoc(db, uid);
  let data: Record<string, unknown>;
  try { data = await completeJson(ai, cvSystem(cur.profile.country), `THE CV\n${decryptSecret(String(c.secret))}`, { fetch: deps.fetch, sleep: deps.sleep, maxTokens: 2000 }); }
  catch (e) { throw new NanaJobsError(`Your AI (${PROVIDER_INFO[ai.provider].label}) couldn't review it: "${e instanceof Error ? e.message : "no answer"}". Your CV is saved; try again in a moment.`, 502); }
  let v;
  try { v = validateCvReview(data, decryptSecret(String(c.secret)), cur.profile.country); }
  catch (e) { throw new NanaJobsError(`Your AI's review didn't come back right (${e instanceof Error ? e.message : "empty"}). Try again in a moment.`, 502); }
  const { dropped, ...rest } = v;
  const review: CvReview = { ...rest, provider: ai.provider, at: nowOf(deps).toISOString() };
  await ref.update({ review: encryptSecret(JSON.stringify(review)) });
  return { review, dropped, note: dropped ? `${dropped} "shipped" line${dropped === 1 ? "" : "s"} the AI suggested weren't in your CV, so we left them out.` : "" };
}
export async function deleteCv(db: Firestore, uid: string): Promise<void> {
  await db.doc(`${CV}/${uid}`).delete();
}

// ---- which AI ----
async function chosenAccount(db: Firestore, uid: string, deps: NjDeps): Promise<Account | null> {
  const [doc, st] = await Promise.all([readDoc(db, uid), providersStatus(db, uid)]);
  const p = pickProvider(st.providers.filter((x) => x.connected).map((x) => x.provider), doc.settings.provider);
  return p ? (deps.account ?? providerAccount)(db, uid, p) : null;
}

// ---- the shared pool, collected once a day for everyone ----
export function poolJobOfNotes(j: Job): PoolJob {
  const description = [j.summary, j.about, j.responsibilities.length ? `What you'll do:\n${j.responsibilities.map((r) => `• ${r}`).join("\n")}` : "", j.requirements.length ? `What they're looking for:\n${j.requirements.map((r) => `• ${r}`).join("\n")}` : ""].filter(Boolean).join("\n\n");
  const row = { company: j.orgName, title: j.title, location: placeText(j) };
  return { ...row, hash: jobHash(row), source: "notes", sourceLabel: "Notes Jobs", url: `${SITE_URL}/jobs/${j.id}`, postedAt: j.createdAt, description: description.slice(0, 6000), salaryText: payText(j), tags: [j.industry, ...j.topics, JOB_TYPE_LABEL[j.type]].filter(Boolean), remoteHint: j.mode === "remote", notesJobId: j.id };
}

export async function collectPool(db: Firestore, deps: NjDeps): Promise<{ day: string; total: number; counts: Record<string, number>; errors: Record<string, string> }> {
  const now = nowOf(deps);
  const day = lagosDay(now);
  const boardDocs = await db.collection(BOARDS).orderBy("lastWantedAt", "desc").limit(200).get();
  const boards = boardDocs.docs.map((d) => d.data()).map((b) => ({ ats: b.ats, slug: String(b.slug), name: String(b.name) }));
  const [feeds, fromBoards, notes] = await Promise.all([fetchFeeds(deps.fetch), fetchBoards(deps.fetch, boards), listJobs(db, null, now).then((r) => r.jobs.map(poolJobOfNotes)).catch(() => [] as PoolJob[])]);
  const jobs = dedupe([...notes, ...fromBoards.jobs, ...feeds.jobs]);
  const counts = { notes: notes.length, ...feeds.counts, ...fromBoards.counts };
  const errors = { ...feeds.errors, ...fromBoards.errors };
  const metaRef = db.doc(`${META}/pool`);
  const prev = (await metaRef.get()).data();
  const chunks = Math.ceil(jobs.length / CHUNK);
  for (let i = 0; i < chunks; i++) await db.doc(`${POOL}/${day}-${i}`).set({ day, n: i, jobs: jobs.slice(i * CHUNK, (i + 1) * CHUNK) });
  // counts: openings each source gave before repeats were removed (a member's run shows "Collected" from these).
  await metaRef.set({ day, chunks, total: jobs.length, counts, errors, at: now.toISOString() });
  // Yesterday's pool goes once today's is in place (and any chunks left over if today's is smaller).
  if (prev?.day) for (let i = prev.day === day ? chunks : 0; i < Number(prev.chunks ?? 0); i++) await db.doc(`${POOL}/${prev.day}-${i}`).delete().catch(() => {});
  return { day, total: jobs.length, counts, errors };
}

async function readPool(db: Firestore): Promise<{ jobs: PoolJob[]; counts: Record<string, number> }> {
  const meta = (await db.doc(`${META}/pool`).get()).data();
  if (!meta?.day) return { jobs: [], counts: {} };
  const snaps = await Promise.all(Array.from({ length: Number(meta.chunks ?? 0) }, (_, i) => db.doc(`${POOL}/${meta.day}-${i}`).get()));
  return { jobs: snaps.flatMap((s) => (s.data()?.jobs ?? []) as PoolJob[]), counts: (meta.counts ?? {}) as Record<string, number> };
}

// ---- one member's run ----
export async function runFor(db: Firestore, uid: string, deps: NjDeps, o: { manual?: boolean } = {}): Promise<NjRun> {
  await assertAllowed(db, uid);
  const now = nowOf(deps);
  const doc = await readDoc(db, uid);
  const { profile: p, settings: s } = doc;
  if (!profileReady(p)) throw new NanaJobsError("Add at least one role you want, and where you can work, first.");
  const [pool, live, st, providers] = await Promise.all([
    readPool(db), listJobs(db, null, now).then((r) => r.jobs.map(poolJobOfNotes)).catch(() => [] as PoolJob[]), db.doc(`${STATUSES}/${uid}`).get(), providersStatus(db, uid),
  ]);
  const watched = new Set(s.companies.filter((c) => c.ok && c.ats).map((c) => `${c.ats}:${c.slug}`));
  const uses = (src: string) => (s.feeds && src in FEEDS) || (s.boards && watched.has(src));
  const mine = [...live, ...pool.jobs.filter((j) => j.source !== "notes" && uses(j.source))];
  const unique = dedupe(mine);
  const collected = live.length + Object.entries(pool.counts).filter(([src]) => src !== "notes" && uses(src)).reduce((a, [, n]) => a + Number(n || 0), 0);
  const { kept, reasons } = hardFilter(unique, p, now.getTime());
  const statuses = (st.data()?.items ?? {}) as Record<string, { status: JobStatus }>;
  const hidden = new Set(Object.entries(statuses).filter(([, v]) => v.status === "not_for_me").map(([k]) => k));
  const ranked = prescoreAll(kept, p).filter((c) => !hidden.has(c.hash));
  const top: Candidate[] = ranked.slice(0, s.aiPerDay);
  const funnel: Funnel = { collected: Math.max(collected, mine.length), unique: unique.length, fit: kept.length, keywordTop: top.length, readByAi: 0, alive: 0 };

  // The member's AI reads the top N, a few openings per request, paced for free tiers. A failure keeps the keyword score and the real error.
  const connected = providers.providers.filter((x) => x.connected).map((x) => x.provider);
  const provider = pickProvider(connected, s.provider);
  const ai = provider ? await (deps.account ?? providerAccount)(db, uid, provider) : null;
  let error = "", note = "";
  if (!ai) note = s.provider && !connected.includes(s.provider) ? `The AI you chose isn't connected any more, so this is the free keyword ranking.` : "No AI connected yet, so this is the free keyword ranking.";
  else {
    const system = scoringSystem(p);
    const started = Date.now();
    let fails = 0;
    for (let i = 0; i < top.length; i += BATCH) {
      if (Date.now() - started > (deps.budgetMs ?? 100_000)) { note = "Your AI ran out of time today; the rest keep their keyword score."; break; }
      const batch = top.slice(i, i + BATCH);
      try {
        const data = await completeJson(ai, system, scoringUser(batch), { fetch: deps.fetch, sleep: deps.sleep, maxTokens: 400 * batch.length });
        const v = validateVerdicts(data, batch.length);
        v.forEach((verdict, k) => { batch[k].verdict = verdict; });
        funnel.readByAi += v.size;
        fails = 0;
      } catch (e) {
        if (!error) error = (e instanceof Error ? e.message : String(e)).slice(0, 200);
        if (++fails >= 2 && funnel.readByAi === 0) break; // the same error twice before anything worked: stop asking
      }
    }
  }

  // Check the links of the picks (and a few spares), drop the dead ones. Notes Jobs jobs are known to be open.
  // With an AI, the shortlist comes from what it read; without one, from the best of the keyword ranking.
  const picks = pickShortlist(ai ? top : ranked.slice(0, 40), hidden, SHORTLIST.max + 5);
  const toCheck = picks.filter((c) => !c.notesJobId);
  const states = await verifyAll(toCheck, { fetch: deps.fetch });
  const stateOf = new Map(toCheck.map((c, i) => [c.hash, states[i]]));
  const alive = picks.filter((c) => stateOf.get(c.hash)?.state !== "dead").slice(0, SHORTLIST.max);
  funnel.alive = alive.length;
  const jobs = alive.map((c) => toShort(c, c.notesJobId ? "live" : (stateOf.get(c.hash)?.state === "live" ? "live" : "unknown")));
  const run: NjRun = { at: now.toISOString(), provider: provider ?? "", model: ai ? modelOf(ai) : "", funnel, error, note, jobs, rejected: reasons };
  const details = Object.fromEntries(alive.map((c) => [c.hash, { description: c.description.slice(0, 3000), salaryText: c.salaryText }]));
  await db.doc(`${RUNS}/${uid}`).set({ ...run, uid, details });

  if (!o.manual && jobs.length) {
    const top3 = jobs.slice(0, 3).map((j) => `${j.title} at ${j.company}`).join("; ");
    if (s.bell) await (deps.notify ?? defaultNotify)({ uid, linkHref: "/jobs/nana", message: `🧭 Your Nana Jobs shortlist is ready: ${jobs.length} role${jobs.length === 1 ? "" : "s"}. Top: ${top3}.` }).catch(() => {});
    if (s.email) {
      const lines = jobs.map((j) => `${j.rough ? "~" : ""}${j.score} · ${j.title} · ${j.company}${j.location ? ` · ${j.location}` : ""}\n${j.reason ? `  ✓ ${j.reason}\n` : ""}${j.risk ? `  ⚠ ${j.risk}\n` : ""}  ${j.notesJobId ? `${SITE_URL}/jobs/${j.notesJobId}` : j.url}`);
      const text = `Hello,\n\nHere is today's Nana Jobs shortlist: ${jobs.length} role${jobs.length === 1 ? "" : "s"}, best first.${error ? `\n\nYour AI didn't answer for some of them ("${error}"), so those carry the rough keyword score, marked ~.` : ""}\n\n${lines.join("\n\n")}\n\nMark them Interested, Applied or Not for me, and get help with a cover note: ${SITE_URL}/jobs/nana\n\nNana finds and ranks. She never applies for you.\n\nNotesApp`;
      await (deps.email ?? defaultEmail)(uid, `Your Nana Jobs shortlist: ${jobs.length} role${jobs.length === 1 ? "" : "s"}`, text).catch(() => false);
    }
  }
  return { ...run, jobs: jobs.map((j) => ({ ...j, ...(statuses[j.hash] ? { status: statuses[j.hash].status } : {}) })) };
}

async function defaultNotify(b: { uid: string; message: string; linkHref: string }) {
  const { notifyBell } = await import("./email");
  await notifyBell({ uid: b.uid, type: "job", linkHref: b.linkHref, message: b.message });
}
async function defaultEmail(uid: string, subject: string, text: string): Promise<boolean> {
  const [{ sendEmail }, { getUserEmail }] = await Promise.all([import("./email"), import("./firebase-admin")]);
  const to = await getUserEmail(uid);
  return to ? sendEmail({ to, subject, text }) : false;
}

// The daily runs that are due (from the scheduled job every 15 minutes), a few at a time within a time budget. The next run is set before
// this one starts, so a run that fails is tried again tomorrow, not every 15 minutes.
export async function runDue(db: Firestore, deps: NjDeps, o: { max?: number; budgetMs?: number } = {}): Promise<number> {
  const now = nowOf(deps);
  const due = await db.collection(PROFILES).where("nextRunAt", "<=", now.toISOString()).orderBy("nextRunAt").limit(o.max ?? 5).get();
  const started = Date.now();
  let done = 0;
  for (const d of due.docs) {
    if (Date.now() - started > (o.budgetMs ?? 150_000)) break;
    const hour = Number(d.data().settings?.hour ?? DEFAULT_SETTINGS.hour);
    await d.ref.update({ nextRunAt: nextRunAt(hour, now) });
    try { await runFor(db, d.id, { ...deps, budgetMs: Math.min(deps.budgetMs ?? 100_000, 60_000) }); done++; }
    catch (e) { if (e instanceof NanaJobsError && e.status === 403) await d.ref.update({ nextRunAt: null }); else console.error("nana jobs run failed", d.id, e); }
  }
  return done;
}

// ---- statuses: set only by the member ----
export async function setStatus(db: Firestore, uid: string, hash: unknown, status: unknown, now = new Date()): Promise<void> {
  const h = String(hash ?? "");
  if (!/^[0-9a-f]{16}$/.test(h)) throw new NanaJobsError("Choose a job from your shortlist.");
  if (status !== null && !isJobStatus(status)) throw new NanaJobsError("Choose Interested, Applied or Not for me.");
  const run = (await db.doc(`${RUNS}/${uid}`).get()).data();
  const job = ((run?.jobs ?? []) as ShortJob[]).find((j) => j.hash === h);
  const ref = db.doc(`${STATUSES}/${uid}`);
  const items = { ...((await ref.get()).data()?.items ?? {}) } as Record<string, unknown>;
  if (!job && !items[h]) throw new NanaJobsError("That job isn't on your shortlist.", 404);
  if (status === null) delete items[h];
  else items[h] = { status, at: now.toISOString(), ...(job ? { title: job.title, company: job.company, url: job.url } : {}) };
  await ref.set({ uid, items });
}

// ---- the cover note: Nana writes only from the "shipped" list ----
export async function coverNote(db: Firestore, uid: string, hash: unknown, deps: NjDeps): Promise<{ note: string; provider: AiProvider }> {
  await assertAllowed(db, uid);
  const run = (await db.doc(`${RUNS}/${uid}`).get()).data();
  const job = ((run?.jobs ?? []) as ShortJob[]).find((j) => j.hash === String(hash ?? ""));
  if (!job) throw new NanaJobsError("Choose a job from your shortlist.", 404);
  const { profile } = await readDoc(db, uid);
  if (!profile.shipped.length) throw new NanaJobsError("Add what you've actually shipped to your profile first: Nana writes only from that list.");
  const ai = await chosenAccount(db, uid, deps);
  if (!ai) throw new NanaJobsError("Connect your AI first (step 1): the cover note is written by your own AI.", 409);
  const d = (run?.details?.[job.hash] ?? {}) as { description?: string };
  const full = { company: job.company, title: job.title, location: job.location, description: d.description ?? "" };
  let data: Record<string, unknown>;
  try { data = await completeJson(ai, coverSystem(), coverUser(full, profile), { fetch: deps.fetch, sleep: deps.sleep, maxTokens: 700 }); }
  catch (e) { throw new NanaJobsError(`Your AI couldn't write it just now: "${e instanceof Error ? e.message : "no answer"}".`, 502); }
  const note = groundCoverNote(String(data.note ?? ""), profile.shipped, `${full.title} ${full.company} ${full.description}`);
  if (note.length < 40) throw new NanaJobsError("Your AI's note didn't come back right. Try again in a moment.", 502);
  return { note, provider: ai.provider };
}
