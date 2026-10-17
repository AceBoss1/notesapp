import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { chatContexts } from "@/lib/messages-server";
import { authed, fail } from "@/lib/moments-api";

export const dynamic = "force-dynamic";

// GET → { bookings, orders }: the people you have sessions booked or store orders with, for the inbox's Bookings and Orders filters.
export async function GET(req: NextRequest) {
  try {
    const me = await authed(req, "messages");
    return NextResponse.json(await chatContexts(getAdminDb(), me.uid), { headers: { "Cache-Control": "private, max-age=60" } });
  } catch (err) {
    return fail(err, "Couldn't load your bookings and orders");
  }
}
