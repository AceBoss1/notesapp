import { NextResponse } from "next/server";
import { getMarket } from "@/lib/shop-directory";

export const dynamic = "force-dynamic";

// GET → { shops, items }: Notes Market (/shop). Every buyable item of every listed shop, with its seller, visits (lifetime and
// this week), favourites and topics; the page arranges them (lib/discovery.ts). Kept a minute on the server and at the edge.
export async function GET() {
  return NextResponse.json(await getMarket(), { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } });
}
