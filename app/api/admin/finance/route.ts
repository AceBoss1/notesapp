import { NextRequest, NextResponse } from "next/server";
import { friendlyMessage } from "@/lib/api-errors";
import { getAdminDb, verifyAdminAccess } from "@/lib/firebase-admin";
import { hasDept } from "@/lib/admin-access";
import { FinanceError } from "@/lib/finance";
import { attachReceipt, createEntry, editEntry, financeLog, importEntries, ledgerView, receiptLink, startReceipt, voidEntry, type Caller } from "@/lib/finance-server";
import { headObject, presignDownload, presignUpload, privateFilesConfigured } from "@/lib/private-files";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
const bearer = (req: NextRequest) => req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

async function caller(req: NextRequest): Promise<Caller> {
  const me = await verifyAdminAccess(bearer(req));
  const c = { uid: me.uid, email: me.email, owner: me.owner, finance: hasDept(me.access, "finance"), product: hasDept(me.access, "product") };
  if (!c.finance && !c.product) throw new FinanceError("The money ledger is for the finance and product teams.", 403);
  return c;
}
const fail = (err: unknown, fallback: string) => {
  if (err instanceof FinanceError) return NextResponse.json({ error: err.message }, { status: err.status });
  const f = friendlyMessage(err, fallback);
  return NextResponse.json({ error: f.message }, { status: f.status });
};

// Finance and product: GET → the ledger (entries, monthly totals, categories, what you may do).
//   GET ?receipt=<entry id>&i=<n> → a short-lived link to one receipt.
// POST { action: "create" | "void" | "edit" | "import" | "receiptStart" | "receiptAttach", … } → finance records; the owner alone enters
// older entries, edits and imports (rules in lib/finance.ts).
export async function GET(req: NextRequest) {
  try {
    const c = await caller(req);
    const db = getAdminDb();
    const rid = req.nextUrl.searchParams.get("receipt");
    if (rid) {
      if (!privateFilesConfigured()) throw new FinanceError("File storage isn't set up yet.", 503);
      return NextResponse.json(await receiptLink(db, c, rid, Number(req.nextUrl.searchParams.get("i") ?? 0), (key, name) => presignDownload(key, name)), { headers: { "Cache-Control": "no-store" } });
    }
    const [view, log] = await Promise.all([ledgerView(db, c), c.finance ? financeLog(db) : Promise.resolve([])]);
    return NextResponse.json({ ...view, log }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return fail(err, "Couldn't load the ledger");
  }
}

export async function POST(req: NextRequest) {
  try {
    const c = await caller(req);
    const limited = rateLimit(req, "finance", c.uid, 200, 3600);
    if (limited) return limited;
    const db = getAdminDb();
    const b = await req.json().catch(() => ({}));
    switch (b.action) {
      case "create": return NextResponse.json({ entry: await createEntry(db, c, b.entry ?? {}) });
      case "void": await voidEntry(db, c, b.id, b.reason); return NextResponse.json({ ok: true });
      case "edit": await editEntry(db, c, b.id, b.entry ?? {}); return NextResponse.json({ ok: true });
      case "import": return NextResponse.json(await importEntries(db, c, b.rows));
      case "receiptStart":
        if (!privateFilesConfigured()) throw new FinanceError("File storage isn't set up yet.", 503);
        return NextResponse.json(await startReceipt(db, c, b.id, b.file ?? {}, presignUpload));
      case "receiptAttach": await attachReceipt(db, c, b.id, b.file ?? {}, headObject); return NextResponse.json({ ok: true });
      default: throw new FinanceError("Unknown action.");
    }
  } catch (err) {
    return fail(err, "Couldn't save that");
  }
}
