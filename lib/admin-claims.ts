import { User } from "firebase/auth";
import { accessFromClaims, Access } from "./admin-access";

// Client-side admin check: the `admin` custom claim. UI gating only —
// the real enforcement is firestore.rules + the API routes.
export async function isAdminUser(user: User | null | undefined): Promise<boolean> {
  if (!user) return false;
  try {
    const { claims } = await user.getIdTokenResult();
    return claims.admin === true;
  } catch {
    return false;
  }
}

// The signed-in person's staff role and departments (null when they aren't staff). UI gating only.
export async function adminAccess(user: User | null | undefined): Promise<Access | null> {
  if (!user) return null;
  try {
    const { claims } = await user.getIdTokenResult();
    return accessFromClaims(claims);
  } catch {
    return null;
  }
}
