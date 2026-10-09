import { NextResponse } from "next/server";
import { getAllUsers } from "@/lib/users";
import { friendlyMessage } from "@/lib/api-errors";

export const dynamic = "force-dynamic";

// Public profile fields only — never email, consent, appeal or plan data.
export async function GET() {
  try {
    const users = (await getAllUsers()).map((u) => ({
      uid: u.uid,
      username: u.username,
      displayName: u.displayName,
      bio: u.bio,
      industry: u.industry,
      jobTitle: u.jobTitle,
      workplace: u.workplace,
      avatar: u.avatar,
      social: u.social || {},
      role: u.role,
      accountTier: u.accountTier,
      verified: u.verified,
      badgeUntil: u.badgeUntil,
      goldBadge: u.goldBadge,
      // Organisation accounts: just what the directory and the ✔ rules need (the registration number stays private).
      accountKind: u.accountKind,
      org: u.org ? { rcStatus: u.org.rcStatus } : undefined,
      suspended: u.suspended === true,
      createdAt: u.createdAt,
    }));
    return NextResponse.json({ users }, { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=900" } });
  } catch (err) {
    const { message, status } = friendlyMessage(err);
    return NextResponse.json({ error: message }, { status });
  }
}
