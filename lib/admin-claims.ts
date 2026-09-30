import { User } from "firebase/auth";
import { isAdminEmail } from "./admin";

// Client-side admin check: the `admin` custom claim, with the legacy
// founder-email list as a fallback until the claims migration is
// finished (remove `isAdminEmail` here then). UI gating only — the
// real enforcement is firestore.rules + the API routes.
export async function isAdminUser(user: User | null | undefined): Promise<boolean> {
  if (!user) return false;
  try {
    const { claims } = await user.getIdTokenResult();
    if (claims.admin === true) return true;
  } catch {
    // fall through to the legacy check
  }
  return isAdminEmail(user.email);
}
