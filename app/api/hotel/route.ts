import { NextRequest, NextResponse } from "next/server";
import { friendlyMessage } from "@/lib/api-errors";
import { getAdminDb, verifySignedInRequest } from "@/lib/firebase-admin";
import { rateLimit } from "@/lib/rate-limit";
import { ensurePricing } from "@/lib/pricing-server";
import { hotelSettings } from "@/lib/pricing";
import { ADDONS, addonOn, branchLimit, departmentLimit, hasFeature, reportCsv, FEATURE_TIER, type HotelTier } from "@/lib/hotel";
import {
  HotelError, addBranch, addIssue, boardView, bookingsView, cancelBooking, chatsView, checkIn, checkOut, closeIssue, context, housekeepingView, kitchenView, menuAt,
  moveOrder, myHotels, ownerView, removeMenuItem, reportView, roomsAt, saveDepartments, saveHotel, saveMenuItem, saveRoom, saveTill, setSoldOut, setStaff, setUnit,
  setupHotel, teamOf, tierOfProfile, tillsView, type Ctx,
} from "@/lib/hotel-server";
import { providers, rebookLate, refundLate, settleCounter } from "@/lib/hotel-pay-server";
import { moniepointConfigured, whatsappConfigured } from "@/lib/hotel-pos-server";

// The Hotel kit's staff side (lib/hotel-server.ts): the owner, organisation admins and the staff the owner gave a hotel role. Every call is
// checked here: who they are (context → roleAt), then what their role and the hotel's tier allow, inside each function.
// GET ?view=mine | home&h= | board&h= | kitchen&h=&dept= | bookings&h= | housekeeping&h= | owner&h= | report&h=&month=[&csv=1] | chats&h=
// POST { action, h, … }: setup | hotel | departments | branch | staff | room | menu | soldout | menu-remove | move | checkin | checkout |
//   cancel | settle | rebook | refund | till | unit | issue | issue-close | whatsapp-number
export const dynamic = "force-dynamic";
const bearer = (req: NextRequest) => req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
const noStore = { headers: { "Cache-Control": "no-store" } };
const fail = (err: unknown, what: string) => {
  if (err instanceof HotelError) return NextResponse.json({ error: err.message }, { status: err.status });
  const f = friendlyMessage(err, what);
  return NextResponse.json({ error: f.message }, { status: f.status });
};

async function home(c: Ctx) {
  const s = hotelSettings();
  const now = c.now;
  const [rooms, menu, team, tills, stock, owner] = await Promise.all([
    roomsAt(c.db, c.hotel.id), menuAt(c.db, c.hotel.id), c.role === "owner" ? teamOf(c.db, c.hotel.ownerUid) : [], hasFeature(c.tier, "tills") && (c.role === "owner" || c.role === "manager") ? tillsView(c) : [],
    hasFeature(c.tier, "inventory") ? c.db.collection("storeItems").where("ownerUid", "==", c.hotel.ownerUid).get().then((x) => x.docs.filter((d) => d.get("kind") !== "digital").map((d) => ({ id: d.id, title: String(d.get("title") ?? ""), stock: Number(d.get("stock")) || 0 }))) : [],
    c.db.doc(`users/${c.hotel.ownerUid}`).get(),
  ]);
  const tierOf = (f: keyof typeof FEATURE_TIER) => hasFeature(c.tier, f);
  return {
    hotel: { ...c.hotel, staffUids: undefined, orderSeq: undefined }, role: c.role, tier: c.tier as HotelTier,
    features: Object.fromEntries((Object.keys(FEATURE_TIER) as (keyof typeof FEATURE_TIER)[]).map((f) => [f, tierOf(f)])),
    limits: { departments: departmentLimit(c.tier, s.departmentsMax), branches: branchLimit(c.tier, s.branchesMax) },
    rooms, menu, team, tills, stock, username: String(owner.get("username") ?? ""),
    addons: ADDONS.map((a) => ({ id: a.id, name: a.name, emoji: a.emoji, blurb: a.blurb, priceKobo: s[a.priceKey], until: c.hotel.addons?.[a.id] ?? null, on: addonOn(c.hotel.addons, a.id, now) })),
    setupFromKobo: s.setupFromKobo,
    ready: { paystack: providers().paystack, paylony: providers().paylony, moniepoint: moniepointConfigured(), whatsapp: whatsappConfigured() },
  };
}

export async function GET(req: NextRequest) {
  try {
    const me = await verifySignedInRequest(bearer(req)).catch(() => null);
    if (!me) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
    const db = getAdminDb();
    await ensurePricing();
    const sp = req.nextUrl.searchParams;
    const view = sp.get("view") ?? "mine";
    if (view === "mine") {
      const p = (await db.doc(`users/${me.uid}`).get()).data();
      return NextResponse.json({ hotels: await myHotels(db, me.uid), tier: tierOfProfile(p ?? undefined) }, noStore);
    }
    const c = await context(db, me.uid, sp.get("h") || me.uid);
    if (view === "home") return NextResponse.json(await home(c), noStore);
    if (view === "board") return NextResponse.json(await boardView(c), noStore);
    if (view === "kitchen") return NextResponse.json(await kitchenView(c, sp.get("dept")), noStore);
    if (view === "bookings") return NextResponse.json(await bookingsView(c), noStore);
    if (view === "housekeeping") return NextResponse.json(await housekeepingView(c), noStore);
    if (view === "owner") return NextResponse.json(await ownerView(c), noStore);
    if (view === "chats") return NextResponse.json({ chats: await chatsView(c) }, noStore);
    if (view === "report") {
      const r = await reportView(c, sp.get("month"));
      if (sp.get("csv") === "1") return new NextResponse(reportCsv(r, r.branches), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="hotel-report-${r.month}.csv"` } });
      return NextResponse.json(r, noStore);
    }
    return NextResponse.json({ error: "Unknown view." }, { status: 400 });
  } catch (err) {
    return fail(err, "Couldn't load the hotel");
  }
}

export async function POST(req: NextRequest) {
  try {
    const me = await verifySignedInRequest(bearer(req)).catch(() => null);
    if (!me) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
    const l = await rateLimit(req, "hotel", me.uid, 240, 600);
    if (l) return l;
    const db = getAdminDb();
    await ensurePricing();
    const b = await req.json().catch(() => ({}));
    if (b.action === "setup") return NextResponse.json({ hotel: await setupHotel(db, me.uid, b) });
    const c = await context(db, me.uid, String(b.h || me.uid));
    switch (b.action) {
      case "hotel": return NextResponse.json({ hotel: await saveHotel(c, b) });
      case "departments": return NextResponse.json({ departments: await saveDepartments(c, b.departments) });
      case "branch": return NextResponse.json({ hotel: await addBranch(c, b) });
      case "staff": return NextResponse.json({ staff: await setStaff(c, b.uid, b.remove ? null : { role: b.role, depts: b.depts }) });
      case "room": return NextResponse.json({ room: await saveRoom(c, b) });
      case "menu": return NextResponse.json({ item: await saveMenuItem(c, b) });
      case "soldout": await setSoldOut(c, b.id, b.soldOut === true); return NextResponse.json({ ok: true });
      case "menu-remove": await removeMenuItem(c, b.id); return NextResponse.json({ ok: true });
      case "move": return NextResponse.json({ order: await moveOrder(c, b.id, b.to) });
      case "checkin": return NextResponse.json({ stay: await checkIn(c, b.id, b.unit) });
      case "checkout": await checkOut(c, b.id); return NextResponse.json({ ok: true });
      case "cancel": await cancelBooking(c, b.id); return NextResponse.json({ ok: true });
      case "settle": return NextResponse.json(await settleCounter(db, { ctx: c }, { target: b.target, id: b.id, method: b.method }));
      case "rebook": await rebookLate(c, b); return NextResponse.json({ ok: true });
      case "refund": return NextResponse.json(await refundLate(c, b));
      case "till": return NextResponse.json({ till: await saveTill(c, b) });
      case "unit": await setUnit(c, b.roomId, b.unit, b.status); return NextResponse.json({ ok: true });
      case "issue": return NextResponse.json(await addIssue(c, b));
      case "issue-close": await closeIssue(c, b.id); return NextResponse.json({ ok: true });
      case "whatsapp-number": {
        if (c.role !== "owner") throw new HotelError(403, "Only the owner connects WhatsApp.");
        if (!addonOn(c.hotel.addons, "whatsapp", c.now)) throw new HotelError(402, "WhatsApp ordering is an add-on.");
        const id = String(b.numberId ?? "").replace(/\D/g, "").slice(0, 20);
        if (id) {
          const taken = (await db.collection("hotels").where("whatsappNumberId", "==", id).limit(1).get()).docs[0];
          if (taken && taken.id !== c.hotel.id) throw new HotelError(409, "That WhatsApp number is connected to another hotel.");
        }
        await db.doc(`hotels/${c.hotel.id}`).update({ whatsappNumberId: id });
        return NextResponse.json({ ok: true });
      }
    }
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (err) {
    return fail(err, "Couldn't save that");
  }
}
