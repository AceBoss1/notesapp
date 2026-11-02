// Connected assistants end to end against the Firestore emulator: OAuth with PKCE, the pairing-code (device) flow, the MCP server with an
// agent token (scopes, ask-first rules, money refused, daily limit, pause, disconnect, the log), and Nana's inbox actions (approve, edit,
// decline, undo, expiry, double taps). Run: npm run test:agents-server → "AGENTS SERVER OK".
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
initializeApp({ projectId: "demo-notesapp" });
import { NextRequest } from "next/server";
import { POST } from "../../app/api/mcp/route";
import { approveRequest, countAction, denyRequest, editGrant, exchangeCode, listGrants, pollDevice, registerClient, revokeGrant, setGrantStatus, startDevice, startOAuth, viewRequest } from "../../lib/agents/grants-server";
import { act, createProposal, expireDue, listProposals, recordDone } from "../../lib/agents/proposals-server";
import { defaultGrant } from "../../lib/agents/scopes";
import { agentSettings } from "../../lib/agents/config";
import { formatCode } from "../../lib/agents/pairing";

const db = getFirestore();
const s = agentSettings();
let ip = 0;
async function mcp(body: unknown, headers: Record<string, string> = {}) {
  const res = await POST(new NextRequest("http://localhost/api/mcp", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json", "mcp-protocol-version": "2025-06-18", "x-forwarded-for": `10.1.0.${++ip % 200}`, ...headers } }));
  return { status: res.status, body: await res.json(), headers: res.headers };
}
const tool = async (token: string, name: string, args: object = {}) => {
  const r = await mcp({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }, { authorization: `Bearer ${token}` });
  return { status: r.status, ...(r.body.result ?? {}), error: r.body.error } as { status: number; isError: boolean; structuredContent: any; content: { text: string }[]; error?: any };
};
const settle = () => new Promise((ok) => setTimeout(ok, 250));

(async () => {
  const now = new Date().toISOString();
  const seed: [string, object][] = [
    ["users/u_ada", { username: "adaeze", displayName: "Adaeze Okafor", accountTier: "business", role: "publisher" }],
    ["users/u_tunde", { username: "tunde", displayName: "Tunde Bakare", accountTier: "standard" }],
    ["users/u_low", { username: "low", displayName: "Low Plan", accountTier: "standard" }],
    ["usernames/adaeze", { uid: "u_ada" }], ["usernames/tunde", { uid: "u_tunde" }],
    ["notes/n_draft", { title: "Five questions Lagos recruiters ask in 2026", slug: "five-questions", authorUid: "u_ada", authorUsername: "adaeze", status: "draft", date: now, content: "word ".repeat(820) }],
    ["bookings/bk1", { publisherUid: "u_ada", clientUid: "u_tunde", username: "adaeze", date: "2026-11-05", slot: "16:00", minutes: 45, status: "confirmed", amountKobo: 1500000, createdAt: now, startsAt: "2026-11-05T15:00:00.000Z" }],
    ["storeItems/it1", { ownerUid: "u_ada", title: "CV workbook", priceKobo: 750000, price: "₦7,500", stock: 10 }],
    ["serverConfig/limits", { overrides: { agentConnect: { standard: 0 } } }],
    ["ledger/l1", { publisherUid: "u_ada", netKobo: 100, status: "held", createdAt: now }],
  ];
  for (const [p, d] of seed) await db.doc(p).set(d);

  // ---------- OAuth: registration, the request, the member's yes, the code exchange with PKCE ----------
  const reg = await registerClient(db, { client_name: "Claude", redirect_uris: ["https://claude.example/api/mcp/auth_callback"], client_uri: "https://claude.example" });
  await assert.rejects(registerClient(db, { client_name: "x", redirect_uris: ["http://evil.example/cb"] }), /redirect_uris/);
  const verifier = "v".repeat(64), challenge = createHash("sha256").update(verifier).digest("base64url");
  const params = { client_id: reg.client_id, redirect_uri: "https://claude.example/api/mcp/auth_callback", response_type: "code", code_challenge: challenge, code_challenge_method: "S256", state: "st8" };
  await assert.rejects(startOAuth(db, { ...params, redirect_uri: "https://claude.example/other" }), /return address/);
  await assert.rejects(startOAuth(db, { ...params, code_challenge_method: "plain" }), /PKCE/);
  const req1 = await startOAuth(db, params);
  const view = await viewRequest(db, "u_ada", { code: req1.code.toLowerCase() });
  assert.equal(view.agentName, "Claude"); assert.equal(view.maker, "Anthropic"); assert.equal(view.fromHost, "claude.example"); assert.equal(view.code, formatCode(req1.code));
  assert.equal(view.connectedBefore, false);
  await assert.rejects(approveRequest(db, "u_low", req1.id, null), /plan/, "a plan without agentConnect can't connect (Admin → Limits)");
  const ok1 = await approveRequest(db, "u_ada", req1.id, defaultGrant(s));
  const back = new URL(ok1.redirect!);
  assert.equal(back.searchParams.get("state"), "st8");
  const code = back.searchParams.get("code")!;
  await assert.rejects(approveRequest(db, "u_ada", req1.id, null), /already answered/);
  await assert.rejects(exchangeCode(db, { grant_type: "authorization_code", code, code_verifier: "w".repeat(64), client_id: reg.client_id, redirect_uri: params.redirect_uri }), /verifier/);
  const tok = await exchangeCode(db, { grant_type: "authorization_code", code, code_verifier: verifier, client_id: reg.client_id, redirect_uri: params.redirect_uri });
  assert.match(tok.access_token, /^naa_[a-f0-9]{12}\./); assert.ok(tok.expires_in > 89 * 86400);
  await assert.rejects(exchangeCode(db, { grant_type: "authorization_code", code, code_verifier: verifier, client_id: reg.client_id, redirect_uri: params.redirect_uri }), /already used|isn't valid/, "a code works once");
  const token = tok.access_token;
  const grantId = token.slice(4, 16);
  const stored = (await db.doc(`agentGrants/${grantId}`).get()).data()!;
  assert.ok(stored.hash && !JSON.stringify(stored).includes(token.split(".")[1]), "only the hash is kept");
  assert.equal(stored.policy.limits.spendKobo, 0);

  // ---------- the pairing code (device) flow, also through the MCP tool ----------
  const dev = await startDevice(db, { agentName: "Ledgerly" });
  assert.deepEqual(await pollDevice(db, dev.deviceCode), { status: "waiting" });
  const dview = await viewRequest(db, "u_ada", { code: formatCode(dev.code) });
  await approveRequest(db, "u_ada", dview.id, { scopes: ["read:orders", "read:earnings"], abilities: { drafts: { on: false }, publish: { on: false }, bookings: { on: false } } });
  const got = await pollDevice(db, dev.deviceCode);
  assert.equal(got.status, "connected");
  await assert.rejects(pollDevice(db, dev.deviceCode), /already collected/);
  const dev2 = await startDevice(db, { agentName: "Spammy" });
  await denyRequest(db, (await viewRequest(db, null, { code: dev2.code })).id);
  assert.deepEqual(await pollDevice(db, dev2.deviceCode), { status: "denied" });
  const viaTool = await mcp({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "connect_account", arguments: { agent_name: "ChatGPT" } } });
  const sc = viaTool.body.result.structuredContent;
  assert.match(sc.code, /^[A-Z2-9]{4}-[A-Z2-9]{4}$/); assert.match(sc.link, /\/link$/); assert.ok(sc.device_id);
  assert.equal((await mcp({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "connect_account", arguments: { device_id: sc.device_id } } })).body.result.structuredContent.status, "waiting");

  // ---------- the MCP server with the token ----------
  const list = (await mcp({ jsonrpc: "2.0", id: 1, method: "tools/list" }, { authorization: `Bearer ${token}` })).body.result.tools.map((t: any) => t.name);
  for (const n of ["create_draft", "publish_post", "reply_booking", "update_store_item", "mark_shipped", "connect_account"]) assert.ok(list.includes(n), n);
  assert.ok(!list.some((n: string) => /refund|payout|withdraw/.test(n)), "no money tools at all");
  let r = await tool(token, "my_posts", { status: "draft" });
  assert.equal(r.isError, false, r.content?.[0]?.text); assert.deepEqual(r.structuredContent.data.map((p: any) => p.title), ["Five questions Lagos recruiters ask in 2026"]);
  r = await tool(token, "my_earnings"); assert.equal(r.isError, true); assert.match(r.content[0].text, /read:earnings/, "earnings are off by default");
  r = await tool(token, "my_messages"); assert.equal(r.isError, true);
  // a draft just saves (the default rule)
  r = await tool(token, "create_draft", { title: "Interview nerves", content: "Breathe. Prepare three stories.", topics: ["careers"] });
  assert.equal(r.structuredContent.status, "done"); const draftId = r.structuredContent.post_id;
  assert.equal((await db.doc(`notes/${draftId}`).get()).data()!.status, "draft", "never published");
  // publishing always asks
  r = await tool(token, "publish_post", { post_id: "n_draft" });
  assert.equal(r.structuredContent.status, "waiting_for_member"); const pubId = r.structuredContent.request_id;
  assert.equal((await db.doc("notes/n_draft").get()).data()!.status, "draft");
  const again = await tool(token, "publish_post", { post_id: "n_draft" });
  assert.equal(again.structuredContent.request_id, pubId, "asking twice makes one request");
  // a paid booking's confirmation goes without asking (the default rule); a new booking reply asks
  r = await tool(token, "reply_booking", { booking_id: "bk1", action: "confirm", message: "Thank you Tunde, see you Wednesday at 4pm." });
  assert.equal(r.structuredContent.status, "done");
  r = await tool(token, "reply_booking", { username: "tunde", action: "reply", message: "Saturday 10:00 works for me." });
  assert.equal(r.structuredContent.status, "waiting_for_member"); const replyId = r.structuredContent.request_id;
  r = await tool(token, "reply_booking", { username: "tunde", action: "reply", message: "20% off", discount_naira: 5000 });
  assert.equal(r.isError, true); assert.match(r.content[0].text, /discount/i, "over the ₦2,000 cap");
  r = await tool(token, "update_store_item", { item_id: "it1", stock: 5 }); assert.equal(r.isError, true, "store edits are off by default");
  r = await tool(token, "mark_shipped", { order_id: "x", courier: "GIG", tracking_number: "1" }); assert.equal(r.isError, true);
  // store edits switched on: wording goes, price asks
  await editGrant(db, "u_ada", grantId, { ...defaultGrant(s), abilities: { ...defaultGrant(s).abilities, store: { on: true, ask: "never" } } });
  r = await tool(token, "update_store_item", { item_id: "it1", stock: 5 }); assert.equal(r.structuredContent.status, "done");
  assert.equal((await db.doc("storeItems/it1").get()).data()!.stock, 5);
  r = await tool(token, "update_store_item", { item_id: "it1", price_naira: 9000 }); assert.equal(r.structuredContent.status, "waiting_for_member", "price changes always ask");
  assert.equal((await db.doc("storeItems/it1").get()).data()!.priceKobo, 750000);
  // an unknown (or money) tool is refused by the protocol
  const money = await mcp({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "refund_order", arguments: {} } }, { authorization: `Bearer ${token}` });
  assert.equal(money.body.error.code, -32602);

  // ---------- Nana's inbox: the requests are waiting; approve, edit, decline, undo ----------
  let inbox = await listProposals(db, "u_ada");
  assert.deepEqual(inbox.needs.map((p) => p.kind).sort(), ["booking_reply", "publish_post", "store_edit"]);
  assert.ok(inbox.done.some((p) => p.kind === "booking_confirm" && p.auto), "the confirmation is in Done");
  const confirm = inbox.done.find((p) => p.kind === "booking_confirm")!;
  assert.ok(confirm.undoUntil! > new Date(Date.now() + 23 * 3_600_000).toISOString(), "24 hours to undo what went automatically");
  // publish: approve → published; undo → back to draft; a second undo is refused
  const published = await act(db, "u_ada", pubId, "approve");
  assert.equal(published.status, "done"); assert.equal((await db.doc("notes/n_draft").get()).data()!.status, "published");
  await assert.rejects(act(db, "u_ada", pubId, "approve"), /already/, "a double tap doesn't run it twice");
  await act(db, "u_ada", pubId, "undo");
  assert.equal((await db.doc("notes/n_draft").get()).data()!.status, "draft");
  await assert.rejects(act(db, "u_ada", pubId, "undo"), /too late/);
  // the reply: edit, then approve sends the edited text; it can be undone for 2 minutes only
  await act(db, "u_ada", replyId, "edit", { draft: "Saturday 8 November at 10:00 works. Book here." });
  const sent = await act(db, "u_ada", replyId, "approve");
  const msg = (await db.doc(`conversations/${sent.result!.cid}/messages/${sent.result!.messageId}`).get()).data()!;
  assert.equal(msg.text, "Saturday 8 November at 10:00 works. Book here."); assert.equal(msg.from, "u_ada");
  assert.ok(new Date(sent.undoUntil!).getTime() - Date.now() <= 2 * 60_000 + 1000, "2 minutes for a sent reply");
  await assert.rejects(act(db, "u_ada", replyId, "undo", {}, new Date(Date.now() + 3 * 60_000)), /too late/);
  await act(db, "u_ada", replyId, "undo");
  assert.ok((await db.doc(`conversations/${sent.result!.cid}/messages/${sent.result!.messageId}`).get()).data()!.deleted, "unread, so deleted at once");
  // someone else can't touch it
  const priceId = inbox.needs.find((p) => p.kind === "store_edit")!.id;
  await assert.rejects(act(db, "u_tunde", priceId, "approve"), /wasn't found/);
  await act(db, "u_ada", priceId, "decline");
  assert.equal((await db.doc("storeItems/it1").get()).data()!.priceKobo, 750000);
  // money is never approved, only dismissed
  const { proposal: refund } = await createProposal(db, { uid: "u_ada", kind: "money", source: "nana", sourceName: "Nana", title: "Emeka wants ₦4,500 back", summary: "Bought twice.", idemKey: "refund:o1" }, new Date(), null);
  await assert.rejects(act(db, "u_ada", refund.id, "approve"), /Money never moves/);
  await act(db, "u_ada", refund.id, "dismiss");
  // expiry after 48 hours
  const { proposal: old } = await createProposal(db, { uid: "u_ada", kind: "customer_reply", source: "nana", sourceName: "Nana", title: "Old question", summary: "", idemKey: "q:old", draft: "x", payload: { toUid: "u_tunde" } }, new Date(Date.now() - 49 * 3_600_000), null);
  assert.equal(await expireDue(db), 1);
  await assert.rejects(act(db, "u_ada", old.id, "approve"), /already|expired/);
  // idempotent: the same key twice is one item
  const a1 = await recordDone(db, { uid: "u_ada", kind: "weekly_summary", source: "nana", sourceName: "Nana", title: "Weekly summary", summary: "x", idemKey: "weekly:2026-W45" });
  const a2 = await recordDone(db, { uid: "u_ada", kind: "weekly_summary", source: "nana", sourceName: "Nana", title: "Weekly summary", summary: "x", idemKey: "weekly:2026-W45" });
  assert.equal(a1.fresh, true); assert.equal(a2.fresh, false); assert.equal(a1.proposal.id, a2.proposal.id);
  inbox = await listProposals(db, "u_ada");
  assert.ok(inbox.declined.some((p) => p.status === "expired") && inbox.declined.some((p) => p.status === "declined"));

  // ---------- the daily limit, pause, disconnect ----------
  const lim = await countAction(db, "limtest00000", 2); await countAction(db, "limtest00000", 2);
  assert.equal(lim.ok, true); assert.equal((await countAction(db, "limtest00000", 2)).ok, false, "the third action of the day is refused");
  await setGrantStatus(db, "u_ada", grantId, "paused");
  r = await tool(token, "my_posts"); assert.equal(r.isError, true); assert.match(r.content[0].text, /paused/);
  await setGrantStatus(db, "u_ada", grantId, "active");
  r = await tool(token, "my_profile"); assert.equal(r.isError, false, r.content?.[0]?.text); assert.equal(r.structuredContent.username, "adaeze");
  // no credential on an account tool: 401 with the OAuth discovery header
  const anon = await mcp({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "create_draft", arguments: {} } });
  assert.equal(anon.status, 401); assert.match(anon.headers.get("www-authenticate") ?? "", /resource_metadata=".*\/\.well-known\/oauth-protected-resource"/);
  await revokeGrant(db, "u_ada", grantId);
  assert.equal((await mcp({ jsonrpc: "2.0", id: 1, method: "tools/list" }, { authorization: `Bearer ${token}` })).status, 401, "a disconnected token stops at once");
  assert.equal((await listGrants(db, "u_ada")).find((g) => g.id === grantId)!.status, "revoked");

  // ---------- the log: every call, the member's answers, never the content ----------
  await settle();
  const log = (await db.collection("agentActions").where("uid", "==", "u_ada").get()).docs.map((d) => d.data());
  assert.ok(log.length >= 12);
  assert.ok(log.some((l) => l.tool === "my_earnings" && l.result === "blocked" && l.summary === "Tried to read your earnings"));
  assert.ok(log.some((l) => l.tool === "create_draft" && l.result === "done" && l.summary === 'Saved the draft "Interview nerves"'));
  assert.ok(log.some((l) => l.tool === "publish_post" && l.result === "undone"), "the member's answer reaches the entry that asked");
  assert.ok(log.some((l) => l.tool === "update_store_item" && l.result === "declined"));
  assert.ok(log.every((l) => !String(l.args).includes("Breathe. Prepare")), "what was written is never logged");
  assert.ok(log.some((l) => /"content":"\[\d+ characters\]"/.test(l.args)));
  assert.ok(log.every((l) => l.expireAt && l.grantId !== undefined || l.via === "nana"));
  console.log("AGENTS SERVER OK");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
