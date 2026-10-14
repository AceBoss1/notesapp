import type { Firestore } from "firebase-admin/firestore";
import { FieldValue } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { getAdminApp } from "@/lib/firebase-admin";
import { notifyBell } from "@/lib/email";
import { grantBonus, walletDoc } from "@/lib/wallet-server";
import { BONUS_MONTHLY_CAP_KOBO, REFERRAL_BONUS_KOBO, REFERRAL_MAX_PER_MONTH } from "./catalog";

// Server-only. A friend you invited to Notes Life finished their first shift: you each get Bonus Credits in your NotesApp wallet.
// Paid once per friend (referralPaid), only for a friend with a verified email, at most REFERRAL_MAX_PER_MONTH per inviter a month,
// and never past the game's monthly Bonus Credits cap (lifeBonus/{YYYY-MM}). Returns what happened, for the friend's screen.
export async function awardReferral(db: Firestore, friendUid: string, inviterUid: string, now = new Date(), deps = { verified: async (uid: string) => (await getAuth(getAdminApp()).getUser(uid)).emailVerified === true }): Promise<"paid" | "skipped"> {
  if (!inviterUid || inviterUid === friendUid) return "skipped";
  if (!(await deps.verified(friendUid).catch(() => false))) return "skipped";
  const month = now.toISOString().slice(0, 7);
  const each = REFERRAL_BONUS_KOBO;
  const res = await db.runTransaction(async (t) => {
    const fRef = db.doc(`lifePlayers/${friendUid}`), iRef = db.doc(`lifePlayers/${inviterUid}`), capRef = db.doc(`lifeBonus/${month}`);
    const [f, i, cap, fw, iw] = await Promise.all([t.get(fRef), t.get(iRef), t.get(capRef), t.get(walletDoc(db, friendUid)), t.get(walletDoc(db, inviterUid))]);
    const fd = f.data(), id = i.data();
    if (!fd || fd.referralPaid === true || fd.referredBy !== inviterUid || !id) return "skipped" as const;
    const given = Number(cap.data()?.kobo) || 0;
    const inviterThisMonth = Number((id.invitesByMonth as Record<string, number> | undefined)?.[month]) || 0;
    if (given + 2 * each > BONUS_MONTHLY_CAP_KOBO || inviterThisMonth >= REFERRAL_MAX_PER_MONTH) { t.update(fRef, { referralPaid: true, referralNote: "cap reached" }); return "skipped" as const; }
    grantBonus(t, db, friendUid, fw.data(), each, "Welcome bonus: you joined Notes Life with a friend's invite", `life_ref_${friendUid}_joined`, now);
    grantBonus(t, db, inviterUid, iw.data(), each, `Invite bonus: @${fd.username} joined Notes Life`, `life_ref_${friendUid}_inviter`, now);
    t.update(fRef, { referralPaid: true });
    t.update(iRef, { invitesDone: FieldValue.increment(1), [`invitesByMonth.${month}`]: FieldValue.increment(1) });
    t.set(capRef, { kobo: FieldValue.increment(2 * each), updatedAt: now.toISOString() }, { merge: true });
    return "paid" as const;
  });
  if (res === "paid") {
    await notifyBell({ uid: inviterUid, type: "plan", linkHref: "/profile/wallet", message: `A friend you invited is playing Notes Life: ₦${each / 100} in Bonus Credits added to your wallet.` }).catch(() => {});
    await notifyBell({ uid: friendUid, type: "plan", linkHref: "/profile/wallet", message: `Welcome bonus: ₦${each / 100} in Bonus Credits added to your wallet.` }).catch(() => {});
  }
  return res;
}
