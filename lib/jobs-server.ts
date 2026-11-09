import type { Firestore } from "firebase-admin/firestore";
import { FieldValue } from "firebase-admin/firestore";
import { notifyBell } from "./email";
import { orgVerified } from "./org";
import { effectiveTier } from "./effective-tier";
import { headline } from "./profile-work";
import type { UserProfile } from "./users";
import {
  BELLS_PER_DAY, BELLS_PER_JOB, JOBS_BRAND, JOB_APP_STATUS_LABEL, JobsError, KEEP_DAYS, STRONG_MATCH, SUGGESTED_MAX, cleanJob, cleanJobApplication,
  isJobAppStatus, jobsForQuestion, matchScore, openingOfJob, type Opening, type WorkMode, matchingTier, type Job, type JobApplication, type Seeker,
} from "./jobs";
import type { CareerRole } from "./careers";

// Notes Jobs on the server (lib/jobs.ts has the rules). Collections, all server-only (firestore.rules):
//   jobs/{id}                      a job; status open | closed | removed (removed = taken down after a report)
//   jobApplications/{jobId}_{uid}  one application per member per job; TTL on purgeAt (6 months after the job closes)
//   jobSeekers/{uid}               the member's private job settings: "I need a job" (openToWork) and their city
//   jobInvites/{jobId}_{uid}       a firm's invitation to apply, so a member is invited to a job once
//   jobBells/{uid}_{day}           how many match bells a member got that day (BELLS_PER_DAY)

const JOBS = "jobs", APPS = "jobApplications", SEEKERS = "jobSeekers", INVITES = "jobInvites", BELLS = "jobBells";
type Me = { uid: string };
const toJob = (id: string, d: FirebaseFirestore.DocumentData) => ({ ...(d as Omit<Job, "id">), id }) as Job;
const toApp = (id: string, d: FirebaseFirestore.DocumentData) => { const { purgeAt: _p, ...rest } = d; return { ...(rest as Omit<JobApplication, "id">), id } as JobApplication; };
const lagosDay = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "Africa/Lagos" });
const isOpen = (j: Pick<Job, "status" | "closesAt">, now: Date) => j.status === "open" && j.closesAt > now.toISOString();

// Who may post and manage jobs for an organisation: the organisation account itself, or one of its admins (not writers). The
// organisation must be CAC-verified and not suspended (the owner's rule: verified organisations only, to keep job scams out).
// The organisation's hiring team (the owner, 9 Nov 2026): the organisation account, and the team members its owner gave the HR area
// (orgMembers.hr, set on the organisation's team page), whether admins or writers. They post and manage jobs, read the applications,
// move them on and reply to applicants (as HR, Nana-HR or themselves: lib/app-replies-server.ts), without the team hub.
export async function hiringTeamFor(db: Firestore, me: Me, orgUid: unknown): Promise<{ orgUid: string; org: UserProfile; role: "owner" | "hr" }> {
  const id = String(orgUid ?? "");
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(id)) throw new JobsError("Choose the organisation.");
  const org = (await db.doc(`users/${id}`).get()).data() as UserProfile | undefined;
  if (!org || org.accountKind !== "organisation") throw new JobsError("That isn't an organisation.", 404);
  if (id !== me.uid) {
    const m = (await db.doc(`orgMembers/${id}_${me.uid}`).get()).data();
    if (m?.hr !== true) throw new JobsError("Only the organisation and the team members its owner put in HR can handle its jobs and applicants.", 403);
  }
  if (org.suspended === true) throw new JobsError("This organisation's jobs are paused right now.", 403);
  return { orgUid: id, org, role: id === me.uid ? "owner" : "hr" };
}

export async function actingFor(db: Firestore, me: Me, orgUid: unknown): Promise<{ orgUid: string; org: UserProfile }> {
  const id = String(orgUid ?? "");
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(id)) throw new JobsError("Choose the organisation.");
  const org = (await db.doc(`users/${id}`).get()).data() as UserProfile | undefined;
  if (!org || org.accountKind !== "organisation") throw new JobsError("Only an organisation account can post jobs.", 403);
  if (id !== me.uid) {
    const m = (await db.doc(`orgMembers/${id}_${me.uid}`).get()).data();
    if (m?.hr !== true) throw new JobsError("Only the organisation and the team members its owner put in HR can manage its jobs.", 403);
  }
  if (org.suspended === true) throw new JobsError("This organisation can't post jobs right now.", 403);
  if (!orgVerified(org)) throw new JobsError(`Only CAC-verified organisations can post on ${JOBS_BRAND}. Verify the organisation first (Account → Organisation).`, 403);
  return { orgUid: id, org };
}

const seekerOf = async (db: Firestore, uid: string): Promise<Seeker & { openToWork: boolean }> => {
  const [u, s] = await Promise.all([db.doc(`users/${uid}`).get(), db.doc(`${SEEKERS}/${uid}`).get()]);
  const p = u.data() ?? {}, k = s.data() ?? {};
  return { industry: p.industry, jobTitle: p.jobTitle, interests: Array.isArray(p.interests) ? p.interests : [], city: k.city, openToWork: k.openToWork === true };
};

export async function postJob(db: Firestore, me: Me, orgUid: unknown, body: Record<string, unknown>, now = new Date()): Promise<Job> {
  const { orgUid: id, org } = await actingFor(db, me, orgUid);
  const { openDays, ...clean } = cleanJob(body);
  const ref = db.collection(JOBS).doc();
  const doc = {
    ...clean, orgUid: id, orgName: String(org.displayName || org.username), orgUsername: String(org.username), orgTier: effectiveTier(org),
    status: "open" as const, createdAt: now.toISOString(), updatedAt: now.toISOString(), closesAt: new Date(now.getTime() + openDays * 86_400_000).toISOString(),
    postedByUid: me.uid, applicationCount: 0,
  };
  await ref.set(doc);
  const job = toJob(ref.id, doc);
  if (matchingTier(job.orgTier)) await notifyMatches(db, job, now).catch((e) => console.error("job matches", ref.id, e));
  return job;
}

export async function updateJob(db: Firestore, me: Me, jobId: unknown, body: Record<string, unknown>, now = new Date()): Promise<Job> {
  const ref = db.doc(`${JOBS}/${String(jobId ?? "")}`);
  const cur = (await ref.get()).data();
  if (!cur) throw new JobsError("That job isn't there any more.", 404);
  await actingFor(db, me, cur.orgUid);
  if (cur.status === "removed") throw new JobsError("This job was taken down after a report; contact us if you think that's wrong.", 403);
  const { openDays, ...clean } = cleanJob(body);
  const closesAt = new Date(Date.parse(cur.createdAt) + openDays * 86_400_000).toISOString();
  await ref.update({ ...clean, ...(clean.applyUrl ? {} : { applyUrl: FieldValue.delete() }), closesAt, updatedAt: now.toISOString() });
  const { applyUrl: _old, ...rest } = cur ?? {};
  return toJob(ref.id, { ...(clean.applyUrl ? cur : rest), ...clean, closesAt });
}

// Closing stops applications and starts the 6-month clock on them. Deleting removes the job and its applications; anyone still in the
// running is told; a hired applicant's record stays.
export async function closeJob(db: Firestore, me: Me, jobId: unknown, now = new Date()): Promise<void> {
  const ref = db.doc(`${JOBS}/${String(jobId ?? "")}`);
  const cur = (await ref.get()).data();
  if (!cur) throw new JobsError("That job isn't there any more.", 404);
  await actingFor(db, me, cur.orgUid);
  if (cur.status !== "open") return;
  await ref.update({ status: "closed", closesAt: now.toISOString(), updatedAt: now.toISOString() });
  await startPurge(db, ref.id, now);
}
async function startPurge(db: Firestore, jobId: string, now: Date) {
  const purgeAt = new Date(now.getTime() + KEEP_DAYS * 86_400_000);
  const apps = await db.collection(APPS).where("jobId", "==", jobId).get();
  for (const a of apps.docs) if (a.data().status !== "hired") await a.ref.update({ purgeAt });
}
export async function deleteJob(db: Firestore, me: Me, jobId: unknown): Promise<{ removed: number }> {
  const ref = db.doc(`${JOBS}/${String(jobId ?? "")}`);
  const cur = (await ref.get()).data();
  if (!cur) throw new JobsError("That job isn't there any more.", 404);
  await actingFor(db, me, cur.orgUid);
  const apps = await db.collection(APPS).where("jobId", "==", ref.id).get();
  let removed = 0;
  for (const a of apps.docs) {
    const d = a.data();
    if (d.status === "hired") continue;
    if (["new", "reviewing", "interview", "offer"].includes(String(d.status))) {
      await notifyBell({ uid: String(d.uid), type: "job", linkHref: "/explore?tab=jobs", message: `${cur.orgName} has withdrawn the ${cur.title} job, so your application has closed. See ${JOBS_BRAND} for other jobs.` }).catch(() => {});
    }
    await a.ref.delete();
    await (await import("./app-replies-server")).deleteRepliesFor(db, "job", [a.id]); // loaded here: app-replies-server imports this file
    removed++;
  }
  await ref.delete();
  return { removed };
}

// ---- reading ----

export async function getJob(db: Firestore, jobId: string): Promise<Job | null> {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(jobId)) return null;
  const d = (await db.doc(`${JOBS}/${jobId}`).get()).data();
  return d ? toJob(jobId, d) : null;
}

// Every open job, newest first; for a signed-in member, the Business and Enterprise jobs that fit them come first as "Jobs for you".
export async function listJobs(db: Firestore, uid: string | null, now = new Date()): Promise<{ jobs: Job[]; forYou: (Job & { reasons: string[] })[] }> {
  const snap = await db.collection(JOBS).where("status", "==", "open").get();
  const jobs = snap.docs.map((d) => toJob(d.id, d.data())).filter((j) => isOpen(j, now)).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  if (!uid) return { jobs, forYou: [] };
  const me = await seekerOf(db, uid);
  const forYou = jobs.filter((j) => matchingTier(j.orgTier) && j.orgUid !== uid)
    .map((j) => ({ j, m: matchScore(j, me) })).filter((x) => x.m.score >= 3)
    .sort((a, b) => b.m.score - a.m.score || (a.j.createdAt < b.j.createdAt ? 1 : -1)).slice(0, 10)
    .map((x) => ({ ...x.j, reasons: x.m.reasons }));
  return { jobs, forYou };
}

// ---- applying ----

export async function applyToJob(db: Firestore, me: { uid: string }, jobId: unknown, body: Record<string, unknown>, now = new Date()): Promise<{ id: string }> {
  const job = await getJob(db, String(jobId ?? ""));
  if (!job || !isOpen(job, now)) throw new JobsError("This job isn't taking applications.", 404);
  if (job.applyWithNotesApp === false) throw new JobsError(`${job.orgName} takes applications on its own site for this job.`, 409);
  if (job.orgUid === me.uid) throw new JobsError("That's your own organisation's job.");
  const clean = cleanJobApplication(body);
  const user = (await db.doc(`users/${me.uid}`).get()).data();
  if (!user) throw new JobsError("Finish setting up your profile first.");
  if (user.suspended === true) throw new JobsError("Your account can't apply for jobs right now.", 403);
  const id = `${job.id}_${me.uid}`;
  const ref = db.doc(`${APPS}/${id}`);
  const prev = (await ref.get()).data();
  if (prev && prev.status !== "withdrawn") throw new JobsError("You've already applied for this job.", 409);
  await ref.set({
    jobId: job.id, jobTitle: job.title, orgUid: job.orgUid, uid: me.uid, name: String(user.displayName || user.username), username: String(user.username),
    ...clean, consentAt: now.toISOString(), status: "new", createdAt: now.toISOString(), updatedAt: now.toISOString(),
  });
  if (!prev) await db.doc(`${JOBS}/${job.id}`).update({ applicationCount: FieldValue.increment(1) });
  await notifyBell({ uid: job.orgUid, type: "job", linkHref: "/profile/jobs", message: `New application for ${job.title} from ${String(user.displayName || user.username)}.` }).catch(() => {});
  return { id };
}

export async function myApplications(db: Firestore, uid: string): Promise<JobApplication[]> {
  const snap = await db.collection(APPS).where("uid", "==", uid).get();
  // The applicant's own list: without the hiring team's Nana-HR summary.
  return snap.docs.map((d) => { const { summary: _s, ...a } = toApp(d.id, d.data()); return a as JobApplication; }).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export async function withdrawApplication(db: Firestore, uid: string, appId: unknown, now = new Date()): Promise<void> {
  const ref = db.doc(`${APPS}/${String(appId ?? "")}`);
  const a = (await ref.get()).data();
  if (!a || a.uid !== uid) throw new JobsError("That application isn't there any more.", 404);
  await ref.update({ status: "withdrawn", updatedAt: now.toISOString() });
}

// ---- the firm's side ----

export async function firmBoard(db: Firestore, me: Me, orgUid: unknown): Promise<{ jobs: Job[]; applications: (JobApplication & { headline: string; avatar: string })[]; matching: boolean; canManage: boolean }> {
  const { orgUid: id, org } = await hiringTeamFor(db, me, orgUid);
  const [jobs, apps] = await Promise.all([db.collection(JOBS).where("orgUid", "==", id).get(), db.collection(APPS).where("orgUid", "==", id).get()]);
  const applications = await Promise.all(apps.docs.map(async (d) => {
    const a = toApp(d.id, d.data());
    const p = (await db.doc(`users/${a.uid}`).get()).data() ?? {};
    return { ...a, headline: headline(p), avatar: String(p.avatar ?? "") };
  }));
  return {
    jobs: jobs.docs.map((d) => toJob(d.id, d.data())).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
    applications: applications.filter((a) => a.status !== "withdrawn").sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
    matching: matchingTier(effectiveTier(org)),
    canManage: orgVerified(org),
  };
}

const TELL: Partial<Record<keyof typeof JOB_APP_STATUS_LABEL, (job: string, org: string) => string>> = {
  interview: (j, o) => `Good news: ${o} would like to talk to you about ${j}. They'll message you on NotesApp to agree a time.`,
  offer: (j, o) => `${o} would like to offer you ${j}. They'll be in touch with the details.`,
  declined: (j, o) => `Thank you for applying for ${j} at ${o}. They won't be taking your application forward this time.`,
};
export async function setApplicationStatus(db: Firestore, me: Me, appId: unknown, status: unknown, now = new Date()): Promise<void> {
  if (!isJobAppStatus(status) || status === "withdrawn") throw new JobsError("Choose a status.");
  const ref = db.doc(`${APPS}/${String(appId ?? "")}`);
  const a = (await ref.get()).data();
  if (!a) throw new JobsError("That application isn't there any more.", 404);
  const { org } = await actingFor(db, me, a.orgUid);
  if (a.status === "withdrawn") throw new JobsError("The applicant withdrew this application.", 409);
  if (a.status === status) return;
  await ref.update({ status, updatedAt: now.toISOString() });
  const tell = TELL[status];
  if (tell) await notifyBell({ uid: String(a.uid), type: "job", linkHref: "/profile/applications", message: tell(String(a.jobTitle), String(org.displayName || org.username)) }).catch(() => {});
}

// Business and Enterprise: members who switched on "I need a job" and fit the job well, with why. Only public profile details are
// shown (never their email, phone or city); a member who switches it off disappears from every list at once.
export async function suggestedCandidates(db: Firestore, me: Me, jobId: unknown): Promise<{ uid: string; username: string; displayName: string; avatar: string; headline: string; reasons: string[]; invited: boolean }[]> {
  const job = await getJob(db, String(jobId ?? ""));
  if (!job) throw new JobsError("That job isn't there any more.", 404);
  const { org } = await actingFor(db, me, job.orgUid);
  if (!matchingTier(effectiveTier(org))) throw new JobsError("Suggested candidates come with the Business and Enterprise plans.", 403);
  const seekers = await db.collection(SEEKERS).where("openToWork", "==", true).limit(1000).get();
  const out: { uid: string; username: string; displayName: string; avatar: string; headline: string; reasons: string[]; invited: boolean; score: number }[] = [];
  const ids = seekers.docs.map((d) => d.id).filter((id) => id !== job.orgUid);
  // members who already applied are on the applications list, not suggested; profiles and applications are read in one go each
  const [profiles, apps] = ids.length
    ? await Promise.all([db.getAll(...ids.map((id) => db.doc(`users/${id}`))), db.getAll(...ids.map((id) => db.doc(`${APPS}/${job.id}_${id}`)))])
    : [[], []];
  const profileOf = new Map(profiles.map((d) => [d.id, d.data()]));
  const applied = new Set(apps.filter((d) => d.exists).map((d) => d.id.slice(job.id.length + 1)));
  for (const s of seekers.docs) {
    if (s.id === job.orgUid || applied.has(s.id)) continue;
    const p = profileOf.get(s.id);
    if (!p || p.suspended === true || p.accountKind === "organisation" || p.teen === true || !p.username) continue;
    const m = matchScore(job, { industry: p.industry, jobTitle: p.jobTitle, interests: p.interests ?? [], city: s.data().city });
    if (m.score < STRONG_MATCH) continue;
    out.push({ uid: s.id, username: String(p.username), displayName: String(p.displayName || p.username), avatar: String(p.avatar ?? ""), headline: headline(p), reasons: m.reasons.filter((r) => !r.startsWith("In ")).concat(m.reasons.some((r) => r.startsWith("In ")) ? ["Same city"] : []), invited: false, score: m.score });
  }
  out.sort((a, b) => b.score - a.score);
  const top = out.slice(0, SUGGESTED_MAX);
  const invites = top.length ? await db.getAll(...top.map((c) => db.doc(`${INVITES}/${job.id}_${c.uid}`))) : [];
  return top.map((c, i) => ({ uid: c.uid, username: c.username, displayName: c.displayName, avatar: c.avatar, headline: c.headline, reasons: c.reasons, invited: invites[i]?.exists ?? false }));
}

export async function inviteToApply(db: Firestore, me: Me, jobId: unknown, uid: unknown, now = new Date()): Promise<void> {
  const job = await getJob(db, String(jobId ?? ""));
  if (!job || !isOpen(job, now)) throw new JobsError("This job isn't open.", 404);
  const { org } = await actingFor(db, me, job.orgUid);
  if (!matchingTier(effectiveTier(org))) throw new JobsError("Inviting candidates comes with the Business and Enterprise plans.", 403);
  const who = String(uid ?? "");
  const seeker = (await db.doc(`${SEEKERS}/${who}`).get()).data();
  if (seeker?.openToWork !== true) throw new JobsError("This member isn't looking for a job right now.", 404);
  if ((await db.doc(`${APPS}/${job.id}_${who}`).get()).exists) throw new JobsError("They've already applied: see Applications.", 409);
  const ref = db.doc(`${INVITES}/${job.id}_${who}`);
  if ((await ref.get()).exists) throw new JobsError("You've already invited them to apply.", 409);
  await ref.set({ jobId: job.id, uid: who, orgUid: job.orgUid, byUid: me.uid, at: now.toISOString() });
  await notifyBell({ uid: who, type: "job", linkHref: `/jobs/${job.id}`, message: `${String(org.displayName || org.username)} invites you to apply for ${job.title} on ${JOBS_BRAND}.` }).catch(() => {});
}

// When a Business or Enterprise organisation posts a job: members who need a job and fit it strongly get a bell, at most
// BELLS_PER_DAY a day each and BELLS_PER_JOB for the job. Returns how many were told.
export async function notifyMatches(db: Firestore, job: Job, now = new Date()): Promise<number> {
  if (!matchingTier(job.orgTier)) return 0;
  const seekers = await db.collection(SEEKERS).where("openToWork", "==", true).limit(2000).get();
  const day = lagosDay(now);
  const fits: { uid: string; score: number }[] = [];
  for (const s of seekers.docs) {
    if (s.id === job.orgUid) continue;
    const p = (await db.doc(`users/${s.id}`).get()).data();
    if (!p || p.suspended === true || p.accountKind === "organisation" || p.teen === true) continue;
    const m = matchScore(job, { industry: p.industry, jobTitle: p.jobTitle, interests: p.interests ?? [], city: s.data().city });
    if (m.score >= STRONG_MATCH) fits.push({ uid: s.id, score: m.score });
  }
  fits.sort((a, b) => b.score - a.score);
  let told = 0;
  for (const f of fits) {
    if (told >= BELLS_PER_JOB) break;
    const ref = db.doc(`${BELLS}/${f.uid}_${day}`);
    const ok = await db.runTransaction(async (t) => {
      const n = Number((await t.get(ref)).data()?.n ?? 0);
      if (n >= BELLS_PER_DAY) return false;
      t.set(ref, { n: n + 1, expireAt: new Date(now.getTime() + 3 * 86_400_000) }, { merge: true });
      return true;
    });
    if (!ok) continue;
    await notifyBell({ uid: f.uid, type: "job", linkHref: `/jobs/${job.id}`, message: `A job that fits you: ${job.title} at ${job.orgName}. See it on ${JOBS_BRAND}.` }).catch(() => {});
    told++;
  }
  return told;
}

// ---- "I need a job" ----

export async function getSeeker(db: Firestore, uid: string): Promise<{ openToWork: boolean; city: string }> {
  const d = (await db.doc(`${SEEKERS}/${uid}`).get()).data();
  return { openToWork: d?.openToWork === true, city: String(d?.city ?? "") };
}
export async function setSeeker(db: Firestore, uid: string, b: Record<string, unknown>, now = new Date()): Promise<{ openToWork: boolean; city: string }> {
  const cur = await getSeeker(db, uid);
  const next = {
    openToWork: typeof b.openToWork === "boolean" ? b.openToWork : cur.openToWork,
    city: typeof b.city === "string" ? b.city.replace(/\s+/g, " ").trim().slice(0, 60) : cur.city,
  };
  if (next.openToWork) {
    const p = (await db.doc(`users/${uid}`).get()).data();
    if (p?.teen === true) throw new JobsError("Job matching is for members aged 18 and over.", 403);
    if (p?.accountKind === "organisation") throw new JobsError("\"I need a job\" is for personal accounts.", 403);
  }
  await db.doc(`${SEEKERS}/${uid}`).set({ ...next, updatedAt: now.toISOString() });
  return next;
}

// ---- reports (Trust & safety): a job taken down after a report ----
export async function removeJobAfterReport(db: Firestore, jobId: string, now = new Date()): Promise<void> {
  const ref = db.doc(`${JOBS}/${jobId}`);
  const cur = (await ref.get()).data();
  if (!cur || cur.status === "removed") return;
  await ref.update({ status: "removed", updatedAt: now.toISOString() });
  await startPurge(db, jobId, now);
  await notifyBell({ uid: String(cur.orgUid), type: "job", linkHref: "/profile/jobs", message: `Your job "${cur.title}" was taken down by #NotesApp after a report. Contact us if you think that's wrong.` }).catch(() => {});
}

// ---- Nana ----
// The openings that fit what someone asked Nana: Notes Jobs jobs and #NotesApp's own roles on /careers (lib/nana-prompt.ts jobsBlock).
export async function jobsForNana(db: Firestore, question: string, now = new Date()): Promise<{ matches: Opening[]; open: number; careers: number }> {
  const { openRoles } = await import("./careers-server"); // loaded here: careers-server reaches back to nana-server
  const [{ jobs }, roles] = await Promise.all([listJobs(db, null, now), openRoles(db).catch(() => [] as CareerRole[])]);
  const ours = roles.map((r) => ({
    r, title: r.title, summary: r.summary, requirements: r.requirements, industry: "", city: r.location, state: "",
    mode: (/remote/i.test(r.location) ? "remote" : /hybrid/i.test(r.location) ? "hybrid" : "onsite") as WorkMode, createdAt: r.openedAt || r.createdAt,
  }));
  const fromJobs = jobsForQuestion(question, jobs).map(openingOfJob);
  const fromUs = jobsForQuestion(question, ours, 3).map((x): Opening => ({ title: x.r.title, org: "#NotesApp (our own team)", place: x.r.location, kind: x.r.hours, pay: "", summary: x.r.summary, href: `/careers/${x.r.id}` }));
  return { matches: [...fromJobs, ...fromUs].slice(0, 6), open: jobs.length, careers: roles.length };
}
