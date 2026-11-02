import { NextResponse } from "next/server";
import { publicPricing } from "@/lib/pricing";
import { loadLivePricing } from "@/lib/pricing-server";

export const dynamic = "force-dynamic";

// Public: the prices and rates in force (Admin → Pricing), for screens drawn in the browser (lib/useLivePricing.ts), which would otherwise
// show the built-in defaults bundled with the page.
export async function GET() {
  await loadLivePricing();
  return NextResponse.json({ config: publicPricing() }, { headers: { "Cache-Control": "public, max-age=0, s-maxage=30" } });
}
