import { NextResponse } from "next/server";
import { listBanks } from "@/lib/paystack";

export const revalidate = 86400; // bank list barely changes

export async function GET() {
  try {
    const banks = await listBanks();
    return NextResponse.json({ banks: banks.map((b) => ({ name: b.name, code: b.code })) });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Couldn't load banks" }, { status: 500 });
  }
}
