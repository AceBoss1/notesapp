import { User } from "firebase/auth";

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
