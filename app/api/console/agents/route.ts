import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { consoleMember, consoleRoute, HttpError } from "@/lib/console-auth";
import { AgentAuthError, editGrant, listGrants, revokeGrant, setGrantStatus, usedToday } from "@/lib/agents/grants-server";
import { getOps, saveOps } from "@/lib/agents/jobs-server";
import { getAgentSettings, planLimit } from "@/lib/agents/config-server";
import { askSummary, scopeChips } from "@/lib/agents/scopes";
import { accessDayChoices, actionChoices, discountChoices } from "@/lib/agents/config";
import { FILTERS, RESULT_LABEL, describeCall, matches, resultOf, sparkline, toCsv, type Filter } from "@/lib/agents/activity";
import { agentUrls, requestHost } from "@/lib/agents/urls";
import type { ActionEntry } from "@/lib/mcp/log";

export const dynamic = "force-dynamic";

// Console → Connected agents (components/agents/ConnectedAgents.tsx).
//   GET ?days=7|30|90&agent=<grantId|nana>&filter=all|changes|waiting|blocked|declined[&format=csv] → the assistants, their 7-day activity,
//       the activity log (or the log as CSV), the MCP address for the domain being viewed, and Nana's card
//   PATCH { id, action: pause | resume | edit | renew, policy? } · PATCH { nana: "pause" | "resume" } · DELETE ?id= (disconnect)
const LOG_MAX = 2000;
const argsOf = (e: ActionEntry) => { try { return JSON.parse(e.args) as Record<string, unknown>; } catch { return {}; } };

export async function GET(req: NextRequest) {
  return consoleRoute("Couldn't load your connected agents", async () => {
    const m = await consoleMember(req);
    const db = getAdminDb();
    const now = new Date();
    const sp = req.nextUrl.searchParams;
    const days = [7, 30, 90, 365].includes(Number(sp.get("days"))) ? Number(sp.get("days")) : 7;
    const filter = (FILTERS.some((f) => f.id === sp.get("filter")) ? sp.get("filter") : "all") as Filter;
    const agent = sp.get("agent") || "";
    const since = new Date(now.getTime() - Math.max(days, 7) * 86_400_000).toISOString();
    const [grants, s, ops, operator, logSnap, waiting] = await Promise.all([
      listGrants(db, m.uid), getAgentSettings(db), getOps(db, m.uid), planLimit(db, m.uid, "nanaOperator"),
      db.collection("agentActions").where("uid", "==", m.uid).where("at", ">=", since).orderBy("at", "desc").limit(LOG_MAX).get(),
      db.collection("agentProposals").where("uid", "==", m.uid).where("status", "==", "pending").get(),
    ]);
    const all = logSnap.docs.map((d) => ({ id: d.id, ...(d.data() as ActionEntry) }));
    const week = all.filter((e) => e.at >= new Date(now.getTime() - 7 * 86_400_000).toISOString());
    const inRange = all.filter((e) => e.at >= new Date(now.getTime() - days * 86_400_000).toISOString() && (!agent || (agent === "nana" ? e.via === "nana" : e.grantId === agent)));
    const rows = inRange.map((e) => ({ id: e.id, at: e.at, agent: e.agent ?? "", grantId: e.grantId ?? (e.via === "nana" ? "nana" : ""), what: e.summary || describeCall(e.tool, argsOf(e), e.result), tool: e.tool, result: resultOf(e), proposalId: e.proposalId ?? "" }));
    if (sp.get("format") === "csv") {
      const csv = toCsv(rows.filter((r) => matches({ result: r.result, ok: true, tool: r.tool }, filter)).map((r) => ({ ...r, result: RESULT_LABEL[r.result] })));
      return new NextResponse(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="agent-activity-${days}d.csv"`, "Cache-Control": "no-store" } });
    }
    const live = grants.filter((g) => g.status !== "revoked").sort((a, b) => (b.lastActiveAt ?? b.createdAt).localeCompare(a.lastActiveAt ?? a.createdAt));
    const cards = await Promise.all(live.map(async (g) => {
      const mine = week.filter((e) => e.grantId === g.id);
      return {
        id: g.id, name: g.agentName, maker: g.maker, fromHost: g.fromHost, status: g.expiresAt <= now.toISOString() ? "expired" : g.status,
        createdAt: g.createdAt, expiresAt: g.expiresAt, lastActiveAt: g.lastActiveAt ?? null, pausedAt: g.pausedAt ?? null,
        chips: scopeChips(g.policy), policy: g.policy, asks: askSummary(g.policy), week: mine.length, spark: sparkline(mine.map((e) => e.at), now), today: await usedToday(db, g.id, now),
      };
    }));
    const nanaWeek = week.filter((e) => e.via === "nana");
    return NextResponse.json({
      agents: cards,
      disconnected: grants.filter((g) => g.status === "revoked").sort((a, b) => String(b.revokedAt).localeCompare(String(a.revokedAt))).slice(0, 5).map((g) => ({ id: g.id, name: g.agentName, revokedAt: g.revokedAt })),
      stats: { working: cards.filter((c) => c.status === "active").length, paused: cards.filter((c) => c.status === "paused").length, actions7d: week.length, waiting: waiting.docs.filter((d) => String(d.data().expiresAt) > now.toISOString()).length },
      log: rows.slice(0, 300), counts: Object.fromEntries(FILTERS.map((f) => [f.id, rows.filter((r) => matches({ result: r.result, ok: true, tool: r.tool }, f.id)).length])),
      nana: { operator: operator > 0, enabled: ops.enabled, paused: ops.paused, jobsOn: Object.values(ops.jobs).filter(Boolean).length, week: nanaWeek.length, spark: sparkline(nanaWeek.map((e) => e.at), now) },
      urls: agentUrls(requestHost(req.headers)),
      choices: { accessDays: accessDayChoices(s), actionsPerDay: actionChoices(s), discountNaira: discountChoices(s) }, logDays: s.logDays,
    }, { headers: { "Cache-Control": "no-store" } });
  });
}

export async function PATCH(req: NextRequest) {
  return consoleRoute("Couldn't change that", async () => {
    const m = await consoleMember(req);
    const db = getAdminDb();
    const b = await req.json().catch(() => ({}));
    try {
      if (b.nana === "pause" || b.nana === "resume") {
        if ((await planLimit(db, m.uid, "nanaOperator")) <= 0) throw new HttpError(403, "Nana's jobs come with Business and Enterprise.");
        await saveOps(db, m.uid, { paused: b.nana === "pause" });
        return NextResponse.json({ ok: true });
      }
      const id = String(b.id ?? "");
      if (b.action === "pause" || b.action === "resume") await setGrantStatus(db, m.uid, id, b.action === "pause" ? "paused" : "active");
      else if (b.action === "edit" || b.action === "renew") await editGrant(db, m.uid, id, b.policy, b.action === "renew");
      else throw new HttpError(400, "Choose pause, resume, edit or renew.");
      return NextResponse.json({ ok: true });
    } catch (e) {
      if (e instanceof AgentAuthError) throw new HttpError(e.status, e.message);
      throw e;
    }
  });
}

export async function DELETE(req: NextRequest) {
  return consoleRoute("Couldn't disconnect it", async () => {
    const m = await consoleMember(req);
    try { await revokeGrant(getAdminDb(), m.uid, String(req.nextUrl.searchParams.get("id") ?? "")); }
    catch (e) { if (e instanceof AgentAuthError) throw new HttpError(e.status, e.message); throw e; }
    return NextResponse.json({ ok: true });
  });
}
