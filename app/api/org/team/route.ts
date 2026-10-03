import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { friendlyMessage } from "@/lib/api-errors";
import { getAdminApp, getAdminDb, getUserEmail, verifySignedInRequest } from "@/lib/firebase-admin";
import { rateLimit } from "@/lib/rate-limit";
import { sendEmail } from "@/lib/email";
import { canHaveTeam, seatLimit, OrgInvite, OrgMember, OrgRole } from "@/lib/org";

export const dynamic = "force-dynamic";
const site = () => process.env.NEXT_PUBLIC_SITE_URL || "https://www.notesapp.name.ng";
const bearer = (req: NextRequest) => req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
const mid = (orgUid: string, memberUid: string) => `${orgUid}_${memberUid}`;
class Fail extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

// The caller's role in an organisation: owner (the org account itself), admin or writer.
async function roleIn(orgUid: string, uid: string): Promise<OrgRole | null> {
  const db = getAdminDb();
  if (orgUid === uid) {
    const u = (await db.doc(`users/${uid}`).get()).data();
    return u?.accountKind === "organisation" ? "owner" : null;
  }
  const m = (await db.doc(`orgMembers/${mid(orgUid, uid)}`).get()).data();
  return m ? (m.role as OrgRole) : null;
}

async function seatsUsed(orgUid: string) {
  const db = getAdminDb();
  const [m, i] = await Promise.all([
    db.collection("orgMembers").where("orgUid", "==", orgUid).get(),
    db.collection("orgInvites").where("orgUid", "==", orgUid).where("status", "==", "pending").get(),
  ]);
  return { members: m.docs.map((d) => d.data() as OrgMember), invites: i.docs.map((d) => d.data() as OrgInvite), used: 1 + m.size + i.size };
}

// GET ?mine=1 → organisations I belong to + invitations for me.
// GET ?org=<uid> (default: my own org) → that team (owner / admin only).
export async function GET(req: NextRequest) {
  try {
    const me = await verifySignedInRequest(bearer(req)).catch(() => null);
    if (!me) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
    const db = getAdminDb();
    if (req.nextUrl.searchParams.get("mine")) {
      const [ms, is] = await Promise.all([
        db.collection("orgMembers").where("memberUid", "==", me.uid).get(),
        db.collection("orgInvites").where("inviteeUid", "==", me.uid).where("status", "==", "pending").get(),
      ]);
      const orgs = (
        await Promise.all(
          ms.docs.map(async (d) => {
            const m = d.data() as OrgMember;
            const o = (await db.doc(`users/${m.orgUid}`).get()).data();
            if (!o || o.suspended === true) return null;
            return { uid: m.orgUid, username: o.username, displayName: o.displayName, avatar: o.avatar, accountTier: o.accountTier, role: m.role, canPublish: canHaveTeam(o.accountTier), store: m.store === true };
          })
        )
      ).filter(Boolean);
      return NextResponse.json({ orgs, invites: is.docs.map((d) => d.data()) });
    }
    const orgUid = req.nextUrl.searchParams.get("org") || me.uid;
    const role = await roleIn(orgUid, me.uid);
    if (role !== "owner" && role !== "admin") return NextResponse.json({ error: "Only the owner and admins can see the team." }, { status: 403 });
    const org = (await db.doc(`users/${orgUid}`).get()).data();
    const { members, invites, used } = await seatsUsed(orgUid);
    return NextResponse.json({ role, accountTier: org?.accountTier, teamEnabled: canHaveTeam(org?.accountTier), seatLimit: seatLimit(org?.accountTier), seatsUsed: used, members, invites });
  } catch (err) {
    const f = friendlyMessage(err, "Couldn't load the team");
    return NextResponse.json({ error: f.message }, { status: f.status });
  }
}

export async function POST(req: NextRequest) {
  try {
    const me = await verifySignedInRequest(bearer(req)).catch(() => null);
    if (!me) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
    const limited = rateLimit(req, "org-team", me.uid, 30, 3600);
    if (limited) return limited;
    const body = await req.json();
    const { action } = body;
    const db = getAdminDb();
    const now = new Date().toISOString();

    // ---- invitee actions ----
    if (action === "accept" || action === "decline") {
      const ref = db.doc(`orgInvites/${String(body.inviteId)}`);
      const inv = (await ref.get()).data() as OrgInvite | undefined;
      if (!inv || inv.inviteeUid !== me.uid || inv.status !== "pending") throw new Fail("That invitation isn't available.", 404);
      if (action === "decline") {
        await ref.update({ status: "declined", resolvedAt: now });
        return NextResponse.json({ ok: true });
      }
      const org = (await db.doc(`users/${inv.orgUid}`).get()).data();
      if (!org || org.suspended === true) throw new Fail("This organisation isn't available.", 409);
      const mine = (await db.doc(`users/${me.uid}`).get()).data();
      if (mine?.suspended === true) throw new Fail("This account is suspended.", 403);
      const batch = db.batch();
      batch.set(db.doc(`orgMembers/${mid(inv.orgUid, me.uid)}`), {
        orgUid: inv.orgUid, memberUid: me.uid, memberUsername: mine?.username || inv.inviteeUsername, memberName: mine?.displayName || "", role: inv.role, joinedAt: now,
      });
      batch.update(ref, { status: "accepted", resolvedAt: now });
      await batch.commit();
      return NextResponse.json({ ok: true });
    }
    if (action === "leave") {
      await db.doc(`orgMembers/${mid(String(body.orgUid), me.uid)}`).delete();
      return NextResponse.json({ ok: true });
    }

    // ---- owner / admin actions ----
    const orgUid = String(body.orgUid || me.uid);
    const role = await roleIn(orgUid, me.uid);
    if (role !== "owner" && role !== "admin") throw new Fail("Only the owner and admins can manage the team.", 403);
    const org = (await db.doc(`users/${orgUid}`).get()).data();
    if (!org) throw new Fail("Organisation not found.", 404);

    if (action === "invite") {
      const wantRole = body.role === "admin" ? "admin" : "writer";
      if (wantRole === "admin" && role !== "owner") throw new Fail("Only the owner can add admins.", 403);
      if (!canHaveTeam(org.accountTier)) throw new Fail("Team members need the Business or Enterprise plan. Start the free trial or upgrade first.", 403);
      const idf = String(body.identifier || "").trim().replace(/^@/, "").toLowerCase();
      if (!idf) throw new Fail("Enter a @username or email address.");
      let uid: string | null = null;
      if (idf.includes("@")) {
        uid = await getAuth(getAdminApp()).getUserByEmail(idf).then((u) => u.uid).catch(() => null);
      } else {
        uid = ((await db.doc(`usernames/${idf}`).get()).data()?.uid as string) || null;
      }
      if (!uid) throw new Fail("We couldn't find a #NotesApp account for that. They need to sign up first.", 404);
      if (uid === orgUid) throw new Fail("That's the organisation itself.");
      const invitee = (await db.doc(`users/${uid}`).get()).data();
      if (!invitee) throw new Fail("We couldn't find a #NotesApp account for that.", 404);
      if (invitee.accountKind === "organisation") throw new Fail("Organisation accounts can't be team members — invite the person's own account.");
      if (invitee.suspended === true) throw new Fail("That account can't be invited right now.", 409);
      if ((await db.doc(`orgMembers/${mid(orgUid, uid)}`).get()).exists) throw new Fail("They're already on the team.", 409);
      const invId = mid(orgUid, uid);
      const existing = (await db.doc(`orgInvites/${invId}`).get()).data();
      if (existing?.status === "pending") throw new Fail("They already have a pending invitation.", 409);
      const { used } = await seatsUsed(orgUid);
      const limit = seatLimit(org.accountTier);
      if (limit !== null && used >= limit) throw new Fail(`All ${limit} seats on your plan are in use (the owner counts as one, pending invitations too). Remove someone, or ask us about Enterprise.`, 409);
      const invite: OrgInvite = {
        id: invId, orgUid, orgUsername: org.username, orgName: org.displayName, inviteeUid: uid, inviteeUsername: invitee.username,
        role: wantRole, status: "pending", invitedByUid: me.uid, createdAt: now,
      };
      await db.doc(`orgInvites/${invId}`).set(invite);
      const to = await getUserEmail(uid);
      if (to) {
        await sendEmail({ to, bell: { uid, type: "org", linkHref: "/invites" }, subject: `${org.displayName} invited you to write for them on #NotesApp`, text: `${org.displayName} invited you to join their team as ${wantRole === "admin" ? "an admin" : "a writer"}. Accept or decline at ${site()}/invites.\n\nPosts you write for them are published under the organisation's name (shown as "by @${invitee.username} for ${org.displayName}"), and anything those posts earn goes to the organisation, not to you.\n\n#NotesApp` }).catch(() => {});
      }
      return NextResponse.json({ ok: true });
    }

    if (action === "revoke") {
      const ref = db.doc(`orgInvites/${String(body.inviteId)}`);
      const inv = (await ref.get()).data() as OrgInvite | undefined;
      if (!inv || inv.orgUid !== orgUid || inv.status !== "pending") throw new Fail("No such invitation.", 404);
      if (inv.role === "admin" && role !== "owner") throw new Fail("Only the owner can revoke admin invitations.", 403);
      await ref.update({ status: "revoked", resolvedAt: now });
      return NextResponse.json({ ok: true });
    }

    if (action === "set_store_access") {
      // Only the owner decides who may run the organisation's store and orders.
      if (role !== "owner") throw new Fail("Only the owner can give store access.", 403);
      const mref = db.doc(`orgMembers/${mid(orgUid, String(body.memberUid))}`);
      if (!(await mref.get()).exists) throw new Fail("They're not on the team.", 404);
      await mref.update({ store: body.enabled === true });
      return NextResponse.json({ ok: true });
    }

    if (action === "remove" || action === "set_role") {
      const memberUid = String(body.memberUid);
      const mref = db.doc(`orgMembers/${mid(orgUid, memberUid)}`);
      const m = (await mref.get()).data() as OrgMember | undefined;
      if (!m) throw new Fail("They're not on the team.", 404);
      if (role !== "owner" && (m.role === "admin" || action === "set_role")) throw new Fail("Only the owner can change or remove admins.", 403);
      if (action === "remove") await mref.delete();
      else await mref.update({ role: body.role === "admin" ? "admin" : "writer" });
      return NextResponse.json({ ok: true });
    }

    throw new Fail("Unknown action.");
  } catch (err) {
    if (err instanceof Fail) return NextResponse.json({ error: err.message }, { status: err.status });
    const f = friendlyMessage(err, "Couldn't update the team");
    return NextResponse.json({ error: f.message }, { status: f.status });
  }
}
