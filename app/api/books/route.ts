import { NextRequest, NextResponse } from "next/server";
import { friendlyMessage } from "@/lib/api-errors";
import { getAdminDb, verifySignedInRequest } from "@/lib/firebase-admin";
import { rateLimit } from "@/lib/rate-limit";
import { ensurePricing } from "@/lib/pricing-server";
import { headObject, presignGet, presignUpload, privateFilesConfigured } from "@/lib/private-files";
import { BOOKS_IMPORTS_PER_DAY, booksAccess } from "@/lib/books";
import { isImportKind, templateCsv } from "@/lib/books-import";
import { booksCaps } from "@/lib/pricing";
import { effectiveTier } from "@/lib/effective-tier";
import {
  BooksError, applyImport, attachPhoto, booksAccounts, catalog, context, entriesView, exportAll, homeView, importsView, owedView, photoLink,
  planImport, pnlView, recordExpense, recordPayment, recordSale, remind, saveParty, saveSettings, shareReceipt, startPhoto, supplierPaid, undoImport, voidEntry,
} from "@/lib/books-server";

// Business books (lib/books-server.ts). Only the seller, and an organisation's admins, may read or write a seller's books: every call
// is checked here (context → canUseBooks). owner defaults to the signed-in account; an organisation's admins pass the organisation's uid.
export const dynamic = "force-dynamic";
const bearer = (req: NextRequest) => req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
const noStore = { headers: { "Cache-Control": "no-store" } };
const fail = (err: unknown, what: string) => {
  if (err instanceof BooksError) return NextResponse.json({ error: err.message, ...(err.code ? { code: err.code } : {}) }, { status: err.status });
  const f = friendlyMessage(err, what);
  return NextResponse.json({ error: f.message }, { status: f.status });
};
const period = (v: string | null) => (v === "week" || v === "month" ? v : "day");

// GET ?view=home | pnl&period=day|week|month&back=n | entries&kind=sale|expense|all&period=&back= | owed | catalog | imports | export[&from&to]
//     | template&kind=stock|sales|expenses|customers ; ?photo=<entryId>&i=<n> → a short-lived link to one receipt photo.
export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    if (sp.get("view") === "template") {
      const kind = sp.get("kind");
      if (!isImportKind(kind)) return NextResponse.json({ error: "Unknown template." }, { status: 400 });
      return new NextResponse(templateCsv(kind), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="business-books-${kind}-template.csv"` } });
    }
    const me = await verifySignedInRequest(bearer(req)).catch(() => null);
    if (!me) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
    const db = getAdminDb();
    await ensurePricing();
    const owner = sp.get("owner") || me.uid;
    let c;
    try {
      c = await context(db, me.uid, owner);
    } catch (e) {
      // Not open to this account yet (a Free member who doesn't sell): say why, so the page can show the way in.
      if (e instanceof BooksError && e.status === 402 && owner === me.uid) {
        const p = (await db.doc(`users/${me.uid}`).get()).data() ?? {};
        return NextResponse.json({ access: booksAccess(effectiveTier({ username: p.username ?? "", role: p.role ?? "reader", accountTier: p.accountTier ?? "standard" }), booksCaps(), p.suspended === true), accounts: await booksAccounts(db, me.uid) }, noStore);
      }
      throw e;
    }
    const photo = sp.get("photo");
    if (photo) {
      if (!privateFilesConfigured()) throw new BooksError(503, "File storage isn't set up yet.");
      return NextResponse.json(await photoLink(c, photo, Number(sp.get("i") ?? 0), (key, name, type) => presignGet(key, name, type, true)), noStore);
    }
    const view = sp.get("view") ?? "home";
    const back = Number(sp.get("back") ?? 0);
    if (view === "home") return NextResponse.json({ ...(await homeView(c)), accounts: await booksAccounts(db, me.uid), owner }, noStore);
    if (view === "pnl") return NextResponse.json(await pnlView(c, period(sp.get("period")), back), noStore);
    if (view === "entries") { const k = sp.get("kind"); return NextResponse.json(await entriesView(c, k === "sale" || k === "expense" ? k : "all", period(sp.get("period")), back), noStore); }
    if (view === "owed") return NextResponse.json(await owedView(c), noStore);
    if (view === "catalog") return NextResponse.json({ items: await catalog(c), inventory: c.inventory }, noStore);
    if (view === "imports") return NextResponse.json({ imports: await importsView(c), access: c.access, inventory: c.inventory }, noStore);
    if (view === "export") return NextResponse.json({ files: await exportAll(c, sp.get("from") ?? undefined, sp.get("to") ?? undefined) }, noStore);
    return NextResponse.json({ error: "Unknown view." }, { status: 400 });
  } catch (err) {
    return fail(err, "Couldn't load your books");
  }
}

// POST { action, owner?, … }:
//   sale { clientId, lines: [{ ref } | { title, costKobo? }] + qty, unitKobo, method, owes?, paidKobo?, partyId? | party { name, phone?, username? }, dueOn?, note? }
//   expense { clientId, amountKobo, method, category, on?, note? }      photoStart { entryId, file { name, size } }   photoAttach { entryId, file { key, name } }
//   payment { clientId, partyId, amountKobo, method }                   void { id, reason }
//   party { id?, kind, name, phone?, username?, balanceKobo?, dueOn?, note? }   supplierPaid { partyId, amountKobo }
//   remind { partyId, channel: email|whatsapp, force? }                 receipt { entryId, channel: email|whatsapp, phone? }
//   settings { floatKobo?, categories? }
//   importPlan { kind, csv, mapping?, preset? }   importApply { … same, fileName }   importUndo { importId }
export async function POST(req: NextRequest) {
  try {
    const me = await verifySignedInRequest(bearer(req)).catch(() => null);
    if (!me) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
    const limited = await rateLimit(req, "books", me.uid, 600, 3600);
    if (limited) return limited;
    const db = getAdminDb();
    await ensurePricing();
    const b = await req.json().catch(() => ({}));
    const owner = typeof b.owner === "string" && b.owner ? b.owner : me.uid;
    const c = await context(db, me.uid, owner);
    switch (b.action) {
      case "sale": return NextResponse.json(await recordSale(c, b));
      case "expense": return NextResponse.json({ entry: await recordExpense(c, b) });
      case "payment": return NextResponse.json({ entry: await recordPayment(c, b) });
      case "void": return NextResponse.json({ entry: await voidEntry(c, String(b.id ?? ""), b.reason) });
      case "party": return NextResponse.json({ party: await saveParty(c, b) });
      case "supplierPaid": return NextResponse.json({ party: await supplierPaid(c, String(b.partyId ?? ""), b.amountKobo) });
      case "remind": {
        const l = await rateLimit(req, "books-remind", me.uid, 60, 3600);
        if (l) return l;
        return NextResponse.json(await remind(c, String(b.partyId ?? ""), b.channel === "email" ? "email" : "whatsapp", b.force === true));
      }
      case "receipt": {
        const l = await rateLimit(req, "books-receipt", me.uid, 120, 3600);
        if (l) return l;
        return NextResponse.json(await shareReceipt(c, String(b.entryId ?? ""), b.channel === "email" ? "email" : "whatsapp", b.phone));
      }
      case "settings": return NextResponse.json({ settings: await saveSettings(c, b) });
      case "photoStart":
        if (!privateFilesConfigured()) throw new BooksError(503, "Receipt photos need file storage, which isn't set up yet. The expense is saved without them.");
        return NextResponse.json(await startPhoto(c, String(b.entryId ?? ""), b.file ?? {}, presignUpload));
      case "photoAttach": await attachPhoto(c, String(b.entryId ?? ""), b.file ?? {}, headObject); return NextResponse.json({ ok: true });
      case "importPlan": {
        const l = await rateLimit(req, "books-import-plan", me.uid, 120, 3600);
        if (l) return l;
        return NextResponse.json((await planImport(c, b)).plan);
      }
      case "importApply": {
        const l = await rateLimit(req, "books-import", owner, BOOKS_IMPORTS_PER_DAY, 86_400);
        if (l) return NextResponse.json({ error: `Up to ${BOOKS_IMPORTS_PER_DAY} imports a day. Carry on tomorrow.` }, { status: 429 });
        return NextResponse.json(await applyImport(c, b));
      }
      case "importUndo": return NextResponse.json(await undoImport(c, String(b.importId ?? "")));
      default: return NextResponse.json({ error: "Unknown action." }, { status: 400 });
    }
  } catch (err) {
    return fail(err, "Couldn't save that");
  }
}
