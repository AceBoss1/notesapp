import { FieldValue, Timestamp, type Firestore } from "firebase-admin/firestore";
import { getAdminApp } from "./firebase-admin";
import { setting } from "./config";
import { redis } from "./shared-store";
import { storedSnapshot } from "./stat-cache";
import { ROOM_LISTENERS_MAX_P2P } from "./rooms";
import { LINES, MAX_TIMING_MS, against, fmtInt, fmtMs, growth, percentile, worst, type Part, type Timing, type Trigger } from "./ops-metrics";

// Gathers the five stage-trigger numbers (lib/ops-metrics.ts) for the admin dashboard, at most every 30 minutes (statCache).
// Where each comes from:
//   timings        → samples in Upstash Redis, perf:<timing>:<day> (the newest 1,000 a day, kept 35 days); in memory without Redis
//   daily counters → opsDaily/<day>: scheduled-job starts and finishes, partner blocks, and the day's active members
//   ledger         → a count of ledger entries
//   active members → presence heartbeats in the last 24 hours (members who show when they're online, the default)
//   reads          → Google Cloud Monitoring, Firestore document reads per day (needs the Monitoring Viewer role)
//   rooms, video   → the biggest live room in 30 days (communityRooms.peak); Cloudflare Stream storage against the plan

const day = (d: Date) => d.toISOString().slice(0, 10);
const DAY_MS = 86_400_000;
const memory = new Map<string, number[]>();

// ---- timings ----
export async function recordTiming(metric: Timing, ms: number, now = new Date()): Promise<void> {
  if (!Number.isFinite(ms) || ms < 0 || ms > MAX_TIMING_MS) return;
  const key = `perf:${metric}:${day(now)}`;
  const v = Math.round(ms);
  const ok = await redis([["LPUSH", key, v], ["LTRIM", key, 0, 999], ["EXPIRE", key, 35 * 86_400]]);
  if (ok) return;
  const list = memory.get(key) ?? [];
  list.unshift(v);
  memory.set(key, list.slice(0, 1000));
}

export async function timings(metric: Timing, days: number, now = new Date()): Promise<number[]> {
  const keys = Array.from({ length: days }, (_, i) => `perf:${metric}:${day(new Date(now.getTime() - i * DAY_MS))}`);
  const r = await redis(keys.map((k) => ["LRANGE", k, 0, -1]));
  const lists = r ? (r as string[][]) : keys.map((k) => (memory.get(k) ?? []).map(String));
  return lists.flat().map(Number).filter(Number.isFinite);
}

// ---- daily counters ----
export type DailyCounter = "jobsStarted" | "jobsFinished" | "partnerBlocks";
export const bumpDaily = (db: Firestore, field: DailyCounter, now = new Date()) =>
  db.doc(`opsDaily/${day(now)}`).set({ [field]: FieldValue.increment(1) }, { merge: true }).catch(() => {});

// A scheduled job, counted when it starts and when it finishes: a start with no finish is a run the time limit cut off.
export async function trackJob<T>(db: Firestore, run: () => Promise<T>, now = () => new Date()): Promise<T> {
  await bumpDaily(db, "jobsStarted", now());
  const out = await run();
  await bumpDaily(db, "jobsFinished", now());
  return out;
}

// ---- Firestore reads per day, from Cloud Monitoring ----
type Reads = { byDay: Map<string, number> } | { error: string };
export async function firestoreReads(days: number, now = new Date()): Promise<Reads> {
  const project = setting("NEXT_PUBLIC_FIREBASE_PROJECT_ID");
  const cred = (() => { try { return getAdminApp().options.credential; } catch { return undefined; } })();
  if (!project || !cred) return { error: "Not connected here (no Google Cloud credentials)." };
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 5000);
  try {
    const token = (await Promise.race([cred.getAccessToken(), new Promise<never>((_, no) => setTimeout(() => no(new Error("timeout")), 5000))])).access_token;
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    for (const metric of ["firestore.googleapis.com/document/read_count", "firestore.googleapis.com/document/read_ops_count"]) {
      const q = new URLSearchParams({
        filter: `metric.type="${metric}"`,
        "interval.startTime": new Date(end.getTime() - days * DAY_MS).toISOString(),
        "interval.endTime": end.toISOString(),
        "aggregation.alignmentPeriod": "86400s",
        "aggregation.perSeriesAligner": "ALIGN_SUM",
        "aggregation.crossSeriesReducer": "REDUCE_SUM",
      });
      const res = await fetch(`https://monitoring.googleapis.com/v3/projects/${project}/timeSeries?${q}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store", signal: ctl.signal });
      if (res.status === 403) return { error: "Give the service account the Monitoring Viewer role in Google Cloud to see reads." };
      if (!res.ok) return { error: `Cloud Monitoring answered ${res.status}.` };
      const j = (await res.json()) as { timeSeries?: { points?: { interval: { endTime: string }; value: { int64Value?: string; doubleValue?: number } }[] }[] };
      const points = j.timeSeries?.[0]?.points ?? [];
      if (!points.length) continue;
      const byDay = new Map<string, number>();
      for (const p of points) byDay.set(day(new Date(new Date(p.interval.endTime).getTime() - 1)), Number(p.value.int64Value ?? p.value.doubleValue ?? 0));
      return { byDay };
    }
    return { error: "No reads reported yet." };
  } catch {
    return { error: "Cloud Monitoring didn't answer." };
  } finally {
    clearTimeout(timer);
  }
}

// ---- Cloudflare Stream storage against the plan ----
async function videoUse(): Promise<{ minutes: number; limit: number } | null> {
  const acct = setting("CLOUDFLARE_ACCOUNT_ID") || setting("R2_ACCOUNT_ID");
  const token = setting("CLOUDFLARE_STREAM_TOKEN");
  if (!acct || !token) return null;
  try {
    const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${acct}/stream/storage-usage`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store", signal: AbortSignal.timeout(5000) });
    const r = (await res.json().catch(() => ({})))?.result;
    return res.ok && r ? { minutes: Number(r.totalStorageMinutes) || 0, limit: Number(r.totalStorageMinutesLimit) || 0 } : null;
  } catch {
    return null;
  }
}

export type Triggers = { triggers: Trigger[]; asOf: string };

export async function gatherTriggers(db: Firestore, now = new Date()): Promise<Trigger[]> {
  const since = (d: number) => new Date(now.getTime() - d * DAY_MS);
  const dailyIds = Array.from({ length: 36 }, (_, i) => day(since(i)));
  const [daily, ledger, active, rooms, video, reads, page, feed, search, report] = await Promise.all([
    db.getAll(...dailyIds.map((id) => db.doc(`opsDaily/${id}`))),
    db.collection("ledger").count().get().then((s) => s.data().count),
    db.collection("presence").where("lastSeen", ">=", Timestamp.fromDate(since(1))).count().get().then((s) => s.data().count).catch(() => null),
    db.collection("communityRooms").where("createdAt", ">=", since(30).toISOString()).select("peak").get().then((s) => Math.max(0, ...s.docs.map((d) => Number(d.data().peak) || 0))),
    videoUse(),
    firestoreReads(36, now),
    timings("page", 7, now), timings("feed", 7, now), timings("search", 7, now), timings("report", 30, now),
  ]);
  const d = new Map(daily.map((s) => [s.id, s.data() ?? {}]));
  // Today's active members, kept so reads per member can be compared month on month.
  if (active !== null) await db.doc(`opsDaily/${day(now)}`).set({ activeMembers: active }, { merge: true }).catch(() => {});

  // Stage 1: runs cut off (the 30 days to yesterday; today's may still be running) and partner blocks (30 days).
  let cut = 0, blocks = 0;
  dailyIds.slice(0, 30).forEach((id, i) => {
    const x = d.get(id) ?? {};
    blocks += Number(x.partnerBlocks) || 0;
    if (i > 0) cut += Math.max(0, (Number(x.jobsStarted) || 0) - (Number(x.jobsFinished) || 0));
  });
  const hasJobs = dailyIds.slice(1, 30).some((id) => Number(d.get(id)?.jobsStarted) > 0);

  // Stage 3: reads per member, the last 7 days against the same 7 days a month ago.
  const perMember = (from: number): number | null => {
    if ("error" in reads) return null;
    let r = 0, m = 0, n = 0;
    for (let i = from; i < from + 7; i++) {
      const id = day(since(i));
      const members = Number(d.get(id)?.activeMembers) || 0;
      if (!reads.byDay.has(id) || !members) continue;
      r += reads.byDay.get(id)!; m += members; n++;
    }
    return n >= 3 ? r / m : null;
  };
  const nowPer = perMember(1), thenPer = perMember(29);
  const change = growth(nowPer, thenPer);
  const readsStatus = "error" in reads || nowPer === null ? "unknown" : change === null ? "ok" : change >= LINES.readsGrowth ? "crossed" : change > 0 ? "near" : "ok";

  const p95 = (xs: number[]) => percentile(xs, 95);
  const pageP = p95(page), feedP = p95(feed), searchP = p95(search);
  const slowest = report.length ? Math.max(...report) : null;
  const videoShare = video && video.limit > 0 ? video.minutes / video.limit : null;

  const t = (key: string, stage: Trigger["stage"], title: string, line: string, parts: Part[]): Trigger => ({ key, stage, title, line, parts, status: worst(parts.map((p) => p.status)) });
  return [
    t("limits", 1, "Jobs cut off by the time limit, and partners blocking our calls", "Any, repeatedly (3 or more in 30 days)", [
      { label: "Scheduled runs cut off, 30 days", value: hasJobs ? fmtInt(cut) : "not measured yet", status: hasJobs ? against(cut, LINES.stage1Events, 1 / LINES.stage1Events) : "unknown" },
      { label: "Partner calls blocked, 30 days", value: fmtInt(blocks), status: against(blocks, LINES.stage1Events, 1 / LINES.stage1Events), note: blocks ? "NKENNEAi's firewall" : undefined },
    ]),
    t("money", 2, "Ledger entries, and time to build the finance report", "About 50,000 entries, or a report over 30 seconds", [
      { label: "Ledger entries", value: fmtInt(ledger), status: against(ledger, LINES.ledgerEntries) },
      { label: "Slowest revenue report, 30 days", value: fmtMs(slowest), status: against(slowest, LINES.reportMs, 0.5) },
    ]),
    t("speed", 3, "Page and feed load time (95th percentile, 7 days)", "Over 1 second", [
      { label: "Pages (largest content shown)", value: fmtMs(pageP), status: against(pageP, LINES.loadP95Ms, 0.8), note: page.length ? `${fmtInt(page.length)} samples` : undefined },
      { label: "Journal feed", value: fmtMs(feedP), status: against(feedP, LINES.loadP95Ms, 0.8), note: feed.length ? `${fmtInt(feed.length)} samples` : undefined },
    ]),
    t("members", 3, "Daily active members, and Firestore reads per member", "About 10,000 a day, or reads per member rising month on month", [
      { label: "Active in the last 24 hours", value: active === null ? "not measured yet" : fmtInt(active), status: against(active, LINES.dailyMembers), note: "members who show when they're online" },
      { label: "Reads per member a day", value: nowPer === null ? ("error" in reads ? "not connected" : "not enough history yet") : fmtInt(Math.round(nowPer)), status: readsStatus,
        note: "error" in reads ? reads.error : change === null ? (nowPer === null ? undefined : "a month's history is needed to compare") : `${change >= 0 ? "up" : "down"} ${Math.abs(Math.round(change * 100))}% on a month ago` },
    ]),
    t("scale", 4, "Search speed, live-room size, video minutes", "Search over 500 ms, rooms past 20 people, or video near the plan's limit", [
      { label: "Search ready (95th percentile, 7 days)", value: fmtMs(searchP), status: against(searchP, LINES.searchP95Ms, 0.8) },
      { label: "Biggest live room, 30 days", value: rooms ? `${fmtInt(rooms)} people` : "no rooms yet", status: against(rooms, ROOM_LISTENERS_MAX_P2P) },
      { label: "Video stored", value: video ? `${fmtInt(Math.round(video.minutes))} of ${video.limit ? fmtInt(video.limit) : "?"} minutes` : "not connected", status: against(videoShare, LINES.videoShare, 0.7 / 0.9) },
    ]),
  ];
}

// The numbers as last gathered: at most every 30 minutes across every server instance, or now with fresh.
export async function storedTriggers(db: Firestore, fresh = false): Promise<Triggers> {
  const s = await storedSnapshot(db, "triggers", 30 * 60_000, () => gatherTriggers(db), { fresh });
  return { triggers: s.data, asOf: s.asOf };
}
