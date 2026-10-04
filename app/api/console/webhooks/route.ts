import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { WEBHOOK_EVENTS, WebhookEndpoint, WebhookEvent, checkWebhookUrl, deliverWebhook, newWebhookSecret } from "@/lib/webhooks";
import { HttpError, consoleMember, consoleRoute, needApi } from "@/lib/console-auth";

export const dynamic = "force-dynamic";
const MAX_ENDPOINTS = 5;

async function own(uid: string, id: string) {
  const ref = getAdminDb().doc(`webhookEndpoints/${id}`);
  const ep = (await ref.get()).data() as WebhookEndpoint | undefined;
  if (!ep || ep.uid !== uid) throw new HttpError(404, "Endpoint not found.");
  return { ref, ep };
}

export async function GET(req: NextRequest) {
  return consoleRoute("Couldn't load webhooks", async () => {
    const m = await consoleMember(req);
    if (!m.apiAccess) return NextResponse.json({ endpoints: [], deliveries: [], events: WEBHOOK_EVENTS });
    const db = getAdminDb();
    const [eps, dels] = await Promise.all([
      db.collection("webhookEndpoints").where("uid", "==", m.uid).get(),
      db.collection("webhookDeliveries").where("uid", "==", m.uid).limit(300).get(),
    ]);
    const endpoints = eps.docs.map((d) => { const e = d.data() as WebhookEndpoint; return { id: d.id, url: e.url, events: e.events, active: e.active, createdAt: e.createdAt }; })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const deliveries = dels.docs
      .map((d) => { const x = d.data(); return { id: d.id, endpointId: x.endpointId, url: x.url, event: x.event, ok: x.ok, status: x.status ?? null, error: x.error || "", durationMs: x.durationMs, at: x.at }; })
      .sort((a, b) => b.at.localeCompare(a.at))
      .slice(0, 30);
    return NextResponse.json({ endpoints, deliveries, events: WEBHOOK_EVENTS });
  });
}

// create | test | resend | toggle
export async function POST(req: NextRequest) {
  return consoleRoute("Couldn't update webhooks", async () => {
    const m = await consoleMember(req);
    needApi(m);
    const body = await req.json().catch(() => ({}));
    const db = getAdminDb();
    const action = String(body.action || "create");

    if (action === "create") {
      const url = String(body.url || "").trim();
      const events: WebhookEvent[] = ((Array.isArray(body.events) ? body.events : []) as unknown[]).filter((e): e is WebhookEvent => WEBHOOK_EVENTS.includes(e as WebhookEvent));
      const problem = await checkWebhookUrl(url);
      if (problem) throw new HttpError(400, problem);
      if (!events.length) throw new HttpError(400, "Choose at least one event.");
      if ((await db.collection("webhookEndpoints").where("uid", "==", m.uid).get()).size >= MAX_ENDPOINTS) throw new HttpError(400, `You can have up to ${MAX_ENDPOINTS} endpoints.`);
      const secret = newWebhookSecret();
      const ref = await db.collection("webhookEndpoints").add({ uid: m.uid, url, events: Array.from(new Set(events)), secret, active: true, createdAt: new Date().toISOString() } satisfies WebhookEndpoint);
      return NextResponse.json({ id: ref.id, secret }); // shown once
    }
    if (action === "test") {
      const { ep } = await own(m.uid, String(body.id || ""));
      const r = await deliverWebhook(String(body.id), ep, "test", { message: "This is a test event from #NotesApp." });
      return NextResponse.json(r);
    }
    if (action === "toggle") {
      const { ref, ep } = await own(m.uid, String(body.id || ""));
      await ref.update({ active: !ep.active });
      return NextResponse.json({ ok: true, active: !ep.active });
    }
    if (action === "resend") {
      const d = (await db.doc(`webhookDeliveries/${String(body.deliveryId || "")}`).get()).data();
      if (!d || d.uid !== m.uid) throw new HttpError(404, "Delivery not found.");
      const { ep } = await own(m.uid, d.endpointId);
      const parsed = JSON.parse(d.body);
      return NextResponse.json(await deliverWebhook(d.endpointId, ep, d.event, parsed.data));
    }
    throw new HttpError(400, "Unknown action.");
  });
}

export async function DELETE(req: NextRequest) {
  return consoleRoute("Couldn't delete the endpoint", async () => {
    const m = await consoleMember(req);
    const { ref } = await own(m.uid, req.nextUrl.searchParams.get("id") || "");
    await ref.delete();
    return NextResponse.json({ ok: true });
  });
}
