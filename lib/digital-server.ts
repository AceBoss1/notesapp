import { getAdminDb } from "./firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { presignDownload, privateFilesConfigured } from "./private-files";

export class DigitalFail extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

export type DigitalPurchase = {
  reference: string;
  buyerUid: string;
  buyerEmail: string;
  itemId: string;
  itemTitle: string;
  sellerUid: string;
  sellerUsername: string;
  amountKobo: number;
  createdAt: string;
  firstDownloadAt?: string;
  downloads?: number;
};

// Hands the buyer a one-minute signed link to the file. The first download makes the sale final
// (no refunds from then on); the counter lets the seller and support see it was used.
export async function createDownloadLink(uid: string, reference: string): Promise<{ url: string; fileName: string }> {
  if (!privateFilesConfigured()) throw new DigitalFail("Downloads aren't available right now. Try again soon.", 503);
  const db = getAdminDb();
  const ref = db.doc(`digitalPurchases/${reference}`);
  const p = (await ref.get()).data() as DigitalPurchase | undefined;
  if (!p || p.buyerUid !== uid) throw new DigitalFail("Purchase not found.", 404);
  const file = (await db.doc(`storeFiles/${p.itemId}`).get()).data() as { key: string; name: string; access?: string } | undefined;
  if (file?.access === "view") throw new DigitalFail("This one is view-only — open it from My orders instead of downloading.", 409);
  if (!file?.key) throw new DigitalFail("The seller hasn't attached the file yet — contact support with your reference.", 409);
  const url = await presignDownload(file.key, file.name);
  const now = new Date().toISOString();
  await ref.update({ downloads: FieldValue.increment(1), ...(p.firstDownloadAt ? {} : { firstDownloadAt: now }), lastDownloadAt: now });
  return { url, fileName: file.name };
}
