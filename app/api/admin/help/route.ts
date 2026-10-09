import { NextRequest, NextResponse } from "next/server";
import { friendlyMessage } from "@/lib/api-errors";
import { getAdminDb, verifyAdminAccess } from "@/lib/firebase-admin";
import { hasAnyDept } from "@/lib/admin-access";
import { KB_CATEGORIES, KbError } from "@/lib/kb";
import { builtInArticles } from "@/lib/kb-articles";
import { deleteArticle, saveArticle, setPublished, staffArticles } from "@/lib/kb-server";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
const bearer = (req: NextRequest) => req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

async function staff(req: NextRequest) {
  const me = await verifyAdminAccess(bearer(req));
  if (!hasAnyDept(me.access, ["support", "product"])) throw new KbError("The help centre and Nana are for the customer care and product teams.", 403);
  return me;
}
const fail = (err: unknown, fallback: string) => {
  if (err instanceof KbError) return NextResponse.json({ error: err.message }, { status: err.status });
  const f = friendlyMessage(err, fallback);
  return NextResponse.json({ error: f.message }, { status: f.status });
};

// Support and product: GET → the help articles (built-in and staff), GET ?view=chats → recent Nana chats, GET ?chat=<id> → one transcript.
// POST { action: "save" | "publish" | "delete" | "handled", … } → write articles; mark a chat as followed up.
export async function GET(req: NextRequest) {
  try {
    await staff(req);
    const db = getAdminDb();
    const q = req.nextUrl.searchParams;
    if (q.get("chat")) {
      const d = await db.doc(`nanaChats/${q.get("chat")}`).get();
      if (!d.exists) throw new KbError("That chat wasn't found.", 404);
      return NextResponse.json({ chat: { id: d.id, ...d.data() } }, { headers: { "Cache-Control": "no-store" } });
    }
    if (q.get("view") === "chats") {
      const snap = await db.collection("nanaChats").orderBy("lastAt", "desc").limit(150).get();
      const chats = snap.docs.map((d) => {
        const c = d.data();
        return { id: d.id, name: c.name, email: c.email, signedIn: !!c.uid, count: c.count, startedAt: c.startedAt, lastAt: c.lastAt, handoff: !!c.handoff, gap: !!c.gap, handled: !!c.handled, lastGapQuestion: c.lastGapQuestion ?? null };
      });
      return NextResponse.json({ chats }, { headers: { "Cache-Control": "no-store" } });
    }
    const mine = await staffArticles(db);
    return NextResponse.json({
      categories: KB_CATEGORIES,
      builtIn: builtInArticles().map((a) => ({ slug: a.slug, title: a.title, category: a.category, body: a.body })),
      staff: mine,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return fail(err, "Couldn't load the help centre");
  }
}

export async function POST(req: NextRequest) {
  try {
    const me = await staff(req);
    const limited = rateLimit(req, "admin-help", me.uid, 120, 3600);
    if (limited) return limited;
    const db = getAdminDb();
    const b = await req.json().catch(() => ({}));
    switch (b.action) {
      case "save": return NextResponse.json({ slug: await saveArticle(db, me.email, b.article ?? {}) });
      case "publish": await setPublished(db, String(b.slug), b.published === true, me.email); return NextResponse.json({ ok: true });
      case "delete": await deleteArticle(db, String(b.slug)); return NextResponse.json({ ok: true });
      case "handled": await db.doc(`nanaChats/${String(b.id)}`).update({ handled: b.handled !== false, handledBy: me.email }); return NextResponse.json({ ok: true });
      default: throw new KbError("Unknown action.");
    }
  } catch (err) {
    return fail(err, "Couldn't save that");
  }
}
