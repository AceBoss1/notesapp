import { GetObjectCommand, HeadBucketCommand } from "@aws-sdk/client-s3";
import { getAdminDb } from "./firebase-admin";
import { getR2Client, R2_BUCKET } from "./r2";
import { pingStream, streamConfigured } from "./stream";
import { GOLD_KIND_LIVE } from "./badges";
import { privateBucket, privateFilesConfigured } from "./private-files";
import { paylonyConfigured, walletBalance } from "./paylony";
import { cardtapReady } from "./cardtap-topup-server";
import { cardtapHealth, type CardtapLast } from "./cardtap-topup";
import { pushConfigured, pushProblem } from "./push-server";
import { CALLS_LIVE, MESSAGES_LIVE, MOMENTS_LIVE } from "./moments-rules";
import { pingVercel, vercelConfigured } from "./domains";
import { whogohostConfigured, wgCredits } from "./whogohost";
import { PROVIDERS, providerConfigured } from "./social-server";
import { nanaConfigured } from "./nana-config";
import { cloudflareTurn, cloudflareTurnConfigured } from "./calls-server";
import { redis, sharedStoreConfigured } from "./shared-store";
import { SITE_URL } from "@/lib/host";
import { setting } from "@/lib/config";

// Server-only service health checks behind /status. Reports only
// up/slow/down + latency — never error details or config.
export type ServiceState = "operational" | "degraded" | "down" | "not_configured";
export type ServiceStatus = { id: string; name: string; description: string; state: ServiceState; latencyMs?: number };

const SLOW_MS = 2500;
const TIMEOUT_MS = 5000;
// The scheduler runs every ~15 min: late after 30, stopped after 60.
const CRON_SLOW_MIN = 30;
const CRON_DOWN_MIN = 60;

async function timed(fn: (signal: AbortSignal) => Promise<boolean>): Promise<{ ok: boolean; ms: number }> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  const start = Date.now();
  try {
    const ok = await fn(ctl.signal);
    return { ok, ms: Date.now() - start };
  } catch {
    return { ok: false, ms: Date.now() - start };
  } finally {
    clearTimeout(timer);
  }
}

function toStatus(id: string, name: string, description: string, r: { ok: boolean; ms: number }): ServiceStatus {
  return { id, name, description, state: !r.ok ? "down" : r.ms > SLOW_MS ? "degraded" : "operational", latencyMs: r.ms };
}

const notConfigured = (id: string, name: string, description: string): ServiceStatus => ({ id, name, description, state: "not_configured" });

// Any HTTP response (even 4xx) proves the service is reachable; only 5xx / network failure is "down".
const reachable = (url: string, init?: RequestInit) => async (signal: AbortSignal) => {
  const res = await fetch(url, { ...init, signal, cache: "no-store" });
  return res.status < 500;
};

export async function checkServices(): Promise<ServiceStatus[]> {
  const checks: Promise<ServiceStatus>[] = [];

  checks.push(Promise.resolve({ id: "web", name: "Website & API", description: "Pages, sign-in and API routes", state: "operational" as ServiceState, latencyMs: 0 }));

  checks.push(
    timed(async () => {
      await getAdminDb().collection("settings").limit(1).get();
      return true;
    }).then((r) => toStatus("database", "Database", "Journals, profiles, bookings, stores, courses, shipments, the logistics network, members' sites and analytics, communities and events (Firestore)", r))
  );

  const apiKey = setting("NEXT_PUBLIC_FIREBASE_API_KEY");
  checks.push(
    apiKey
      ? timed(reachable(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })).then((r) =>
          toStatus("auth", "Authentication", "Sign-in, password reset, email verification", r)
        )
      : Promise.resolve(notConfigured("auth", "Authentication", "Sign-in, password reset, email verification"))
  );

  checks.push(
    (setting("R2_ACCOUNT_ID") && setting("R2_ACCESS_KEY_ID")
      ? timed(async (signal) => {
          await getR2Client().send(new HeadBucketCommand({ Bucket: R2_BUCKET }), { abortSignal: signal });
          return true;
        })
      : Promise.resolve(null)
    ).then((r) => (r ? toStatus("storage", "Media uploads", "Image and avatar uploads (Cloudflare R2)", r) : notConfigured("storage", "Media uploads", "Image and avatar uploads (Cloudflare R2)")))
  );

  const media = setting("NEXT_PUBLIC_R2_PUBLIC_URL");
  checks.push(
    media
      ? timed(reachable(media, { method: "HEAD" })).then((r) => toStatus("media", "Media delivery", "Serving uploaded images (media domain)", r))
      : Promise.resolve(notConfigured("media", "Media delivery", "Serving uploaded images (media domain)"))
  );

  // Paid digital downloads live in a separate private bucket.
  checks.push(
    privateFilesConfigured()
      ? timed(async (signal) => {
          // Ask for an object that doesn't exist: "no such key" proves the bucket name, account and credentials all
          // work for reading — exactly what a download needs — without needing bucket-level (HeadBucket) permission.
          try {
            await getR2Client().send(new GetObjectCommand({ Bucket: privateBucket(), Key: "status-probe-does-not-exist" }), { abortSignal: signal });
            return true;
          } catch (err) {
            const e = err as { name?: string; $metadata?: { httpStatusCode?: number } };
            if (e.name === "NoSuchKey") return true;
            console.warn("[status] private downloads bucket check failed:", e.name, e.$metadata?.httpStatusCode);
            return false;
          }
        }).then((r) => toStatus("downloads", "Digital downloads", "Private file storage for paid downloads and files sent in messages (Cloudflare R2)", r))
      : Promise.resolve(notConfigured("downloads", "Digital downloads", "Private file storage for paid downloads and files sent in messages (Cloudflare R2)"))
  );

  // Video lessons of view-only items and courses (Cloudflare Stream).
  checks.push(
    streamConfigured()
      ? timed(() => pingStream()).then((r) => toStatus("video", "Video courses", "Video lessons for view-only items and courses (Cloudflare Stream)", r))
      : Promise.resolve(notConfigured("video", "Video courses", "Video lessons for view-only items and courses (Cloudflare Stream)"))
  );

  // The Enterprise API answers (a request without a key is refused with 401, which proves the route is up).
  const site = SITE_URL;
  checks.push(
    timed(reachable(`${site}/api/v1/me`)).then((r) => toStatus("api", "Developer API", "Enterprise API, Console and webhooks", r))
  );

  // Own-domain connections go through the Vercel API; only checked once it's configured.
  checks.push(
    vercelConfigured()
      ? timed(() => pingVercel()).then((r) => toStatus("domains", "Custom domains", "Connecting and verifying Business and Enterprise domains (Vercel)", r))
      : Promise.resolve(notConfigured("domains", "Custom domains", "Connecting and verifying Business and Enterprise domains (Vercel)"))
  );

  // Domain sales and DNS (Whogohost reseller API): only listed once its two settings exist. The credit read costs nothing.
  checks.push(
    whogohostConfigured()
      ? timed(async () => { await wgCredits(); return true; }).then((r) => toStatus("registrar", "Domain registration", "Domain sales and DNS management (Whogohost)", r))
      : Promise.resolve(notConfigured("registrar", "Domain registration", "Domain sales and DNS management (Whogohost)"))
  );

  // Shared limits (Upstash): without it each server keeps its own counts, which still works, so a failed ping is "slow", not "down".
  const sharedName = "Shared limits", sharedDesc = "Limits on how often things can be done, held across all our servers (Upstash)";
  checks.push(
    sharedStoreConfigured()
      ? timed(async () => (await redis([["PING"]])) !== null).then((r) => { const st = toStatus("shared", sharedName, sharedDesc, r); return st.state === "down" ? { ...st, state: "degraded" as ServiceState } : st; })
      : Promise.resolve(notConfigured("shared", sharedName, sharedDesc))
  );

  // Sharing to LinkedIn and X: only says whether the connections are set up (we don't post anything to test it).
  const social = PROVIDERS.filter(providerConfigured);
  checks.push(
    Promise.resolve(social.length
      ? ({ id: "social", name: "Sharing to LinkedIn and X", description: "Publishing a post's excerpt to connected LinkedIn and X accounts", state: "operational" } as ServiceStatus)
      : notConfigured("social", "Sharing to LinkedIn and X", "Publishing a post's excerpt to connected LinkedIn and X accounts"))
  );

  // Claude (Anthropic) writes Nana's replies and writing help when an AI key is set. The check lists models, which costs nothing.
  const claudeKey = (setting("ANTHROPIC_API_KEY") || "").trim();
  const claudeDesc = "Claude by Anthropic, the AI behind Nana AI's answers and writing help";
  checks.push(
    claudeKey
      ? (async () => {
          let why = "";
          const r = await timed(async (signal) => {
            const res = await fetch(`${(setting("ANTHROPIC_BASE_URL") || "https://api.anthropic.com").replace(/\/$/, "")}/v1/models?limit=1`, { headers: { "x-api-key": claudeKey, "anthropic-version": "2023-06-01" }, signal, cache: "no-store" });
            if (res.status === 401 || res.status === 403) why = " (Anthropic rejected our key: check ANTHROPIC_API_KEY in Vercel)";
            else if (res.status === 429) why = " (rate limited by Anthropic)";
            else if (res.status >= 500) why = " (Anthropic is having trouble)";
            else if (!res.ok) why = ` (Anthropic answered ${res.status})`;
            return res.ok;
          });
          if (!r.ok && !why) why = " (could not reach Anthropic in time)";
          return toStatus("claude", "Claude AI (Anthropic)", claudeDesc + why, r);
        })()
      : Promise.resolve(notConfigured("claude", "Claude AI (Anthropic)", `${claudeDesc} (not switched on; Nana answers from the help centre, and members can connect their own account)`))
  );

  // Nana AI, the chat helper: only says whether its AI key is set (we don't spend a request to test it).
  checks.push(
    Promise.resolve(({
      id: "nana", name: "Nana AI",
      description: nanaConfigured() ? "The chat helper that answers questions about #NotesApp, with AI switched on" : "The chat helper that answers questions about #NotesApp, from the help centre (AI is not switched on)",
      state: "operational",
    } as ServiceStatus))
  );

  const paystack = setting("PAYSTACK_SECRET_KEY");
  checks.push(
    paystack
      ? timed(async (signal) => {
          const res = await fetch("https://api.paystack.co/bank?perPage=1", { headers: { Authorization: `Bearer ${paystack}` }, signal, cache: "no-store" });
          return res.ok;
        }).then((r) => toStatus("payments", "Payments & payouts", "Paystack checkout, refunds and transfers", r))
      : Promise.resolve(notConfigured("payments", "Payments & payouts", "Paystack checkout, refunds and transfers"))
  );

  // Paylony (bank payouts and virtual accounts): only listed once its key is set. A wallet-balance read proves key + network.
  checks.push(
    paylonyConfigured()
      ? timed(async () => (await walletBalance()).ok).then((r) => toStatus("paylony", "Bank payouts (Paylony)", "Paylony transfers and virtual accounts", r))
      : Promise.resolve(notConfigured("paylony", "Bank payouts (Paylony)", "Paylony transfers and virtual accounts"))
  );

  // Wallet top-ups with Paylony CardTap (only listed once switched on): there is no free test call, so this reports how the
  // latest real top-up went, which startCardtap records; "down" names Paylony's reason (e.g. Invalid Merchant Authorization).
  const tapName = "Wallet top-ups (CardTap)", tapDesc = "Topping up NotesApp Credit by tapping a card with Paylony CardTap";
  checks.push(
    cardtapReady()
      ? getAdminDb().doc("paylonyConfig/cardtapLast").get().then((d) => {
          const h = cardtapHealth((d.data() as CardtapLast | undefined) ?? null);
          return { id: "cardtap", name: tapName, description: `${tapDesc} (${h.note})`, state: h.state } as ServiceStatus;
        }).catch(() => ({ id: "cardtap", name: tapName, description: tapDesc, state: "degraded" } as ServiceStatus))
      : Promise.resolve(notConfigured("cardtap", tapName, tapDesc))
  );

  // Messages and moments (only listed once switched on): the database that holds conversations answers. Expired moments are
  // removed by the scheduler job below, which reports through "Scheduled jobs".
  checks.push(
    MESSAGES_LIVE
      ? timed(async () => { await getAdminDb().collection("conversations").limit(1).get(); return true; }).then((r) => toStatus("messages", MOMENTS_LIVE ? "Messages & moments" : "Messages", "Direct messages, moments, their live updates and read ticks", r))
      : Promise.resolve(notConfigured("messages", "Messages & moments", "Direct messages, moments, their live updates and read ticks"))
  );
  // Free voice and video calls in Messages. The relay (TURN) carries calls on networks that block direct connections; this asks
  // Cloudflare for credentials exactly as a call does, so a wrong key shows here instead of in a failed call.
  const callsName = "Calls and audio rooms";
  const callsDesc = "Free one-to-one and group calls in Messages and audio rooms in Community (phone to phone), with the Cloudflare relay for networks that block direct connections";
  const ownTurn = !!((setting("TURN_URLS") || "").trim() && setting("TURN_USERNAME") && setting("TURN_CREDENTIAL"));
  checks.push(
    !CALLS_LIVE
      ? Promise.resolve(notConfigured("calls", callsName, callsDesc))
      : ownTurn
        ? Promise.resolve({ id: "calls", name: callsName, description: `${callsDesc} (using the TURN_URLS relay)`, state: "operational" } as ServiceStatus)
        : !cloudflareTurnConfigured()
          // Calls still connect on most home and office networks without a relay, so this is "slow", not "down".
          ? Promise.resolve({ id: "calls", name: callsName, description: `${callsDesc} (relay not set up: add CLOUDFLARE_TURN_KEY_ID and CLOUDFLARE_TURN_API_TOKEN in Vercel; some mobile networks can't connect without it)`, state: "degraded" } as ServiceStatus)
          : (async () => {
              let why = "";
              const r = await timed(async (signal) => { const t = await cloudflareTurn(fetch, signal); why = t.why ?? ""; return !!t.server; });
              // A relay problem is "slow", not "down": calls still connect directly on most networks.
              const st = toStatus("calls", callsName, why ? `${callsDesc} (${why})` : `${callsDesc} (relay ready)`, r);
              return st.state === "down" ? { ...st, state: "degraded" as ServiceState } : st;
            })()
  );
  // Device notifications need the three VAPID settings; this only confirms they are present.
  checks.push(
    Promise.resolve(pushConfigured()
      ? ({ id: "push", name: "Device notifications", description: "Notifications for new messages on phones and browsers", state: "operational" } as ServiceStatus)
      : pushProblem()
        // Set, but wrong: shown as down so it is noticed (the text says exactly what to fix; it never shows a key).
        ? ({ id: "push", name: "Device notifications", description: `Settings need fixing: ${pushProblem()}`, state: "down" } as ServiceStatus)
        : notConfigured("push", "Device notifications", "Notifications for new messages on phones and browsers"))
  );

  const resend = setting("RESEND_API_KEY");
  checks.push(
    resend
      ? timed(async (signal) => {
          const res = await fetch("https://api.resend.com/domains", { headers: { Authorization: `Bearer ${resend}` }, signal, cache: "no-store" });
          return res.status < 500; // a restricted send-only key returns 401 but proves the API is up
        }).then((r) => toStatus("email", "Email", "Booking confirmations, reminders, the Weekly Digest and the team's report alerts (Resend)", r))
      : Promise.resolve(notConfigured("email", "Email", "Booking confirmations, reminders, the Weekly Digest and the team's report alerts (Resend)"))
  );

  // Identity checks for the gold badge (Dojah hosted widget) — only once enabled.
  checks.push(
    GOLD_KIND_LIVE.identity
      ? timed(reachable("https://identity.dojah.io", { method: "HEAD" })).then((r) =>
          toStatus("identity", "Identity verification", "Gold badge identity checks (Dojah)", r)
        )
      : Promise.resolve(notConfigured("identity", "Identity verification", "Gold badge identity checks (Dojah)"))
  );

  // Scheduled jobs: /api/cron/reminders writes cronRuns/reminders after every run, so
  // this catches the scheduler silently stopping (escrow never released, trials never expiring).
  checks.push(
    getAdminDb().collection("cronRuns").doc("reminders").get().then((snap): ServiceStatus => {
      const id = "cron", name = "Scheduled jobs", description = "Session reminders, plan expiry, order releases, moment clean-up, the daily reports digest, the Sunday Weekly Digest and timed-suspension lifts";
      const d = snap.data();
      if (!d?.at) return notConfigured(id, name, description);
      const ageMin = (Date.now() - new Date(d.at).getTime()) / 60_000;
      const state: ServiceState = ageMin > CRON_DOWN_MIN ? "down" : ageMin > CRON_SLOW_MIN || d.ok === false ? "degraded" : "operational";
      return { id, name, description, state };
    }).catch(() => ({ id: "cron", name: "Scheduled jobs", description: "Session reminders, plan expiry, order releases, moment clean-up, the daily reports digest, the Sunday Weekly Digest and timed-suspension lifts", state: "down" as ServiceState }))
  );

  return Promise.all(checks);
}
