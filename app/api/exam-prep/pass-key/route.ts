import { passPublicKey } from "@/lib/exam-prep-server";
import { ok } from "@/lib/exam-prep-api";

export const dynamic = "force-dynamic";
// GET → the public key that checks offline passes (null when offline saving of paid questions isn't switched on).
export async function GET() {
  return ok({ publicKey: passPublicKey() }, "public, max-age=3600");
}
