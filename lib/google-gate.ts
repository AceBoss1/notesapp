import { beforeAuthStateChanged, type Auth, type User } from "firebase/auth";

// "Continue with Google" is checked by our server (/api/auth/google) BEFORE the app hears about the sign-in. Firebase signs a Google
// account straight into an existing account with the same email (one account per email), and every onAuthStateChanged listener in
// the app used to see that user for the second or two our check took: pages loaded signed in and small writes went out (owner's HAR,
// 5 Nov 2026). beforeAuthStateChanged runs before Firebase sets the new user; if our check says "link-required" (or fails) it throws,
// Firebase keeps the previous state (signed out), and no listener ever sees that account.
//
// It only checks while a Google SIGN-IN is in flight: the pop-up (armed by armGoogleGate) or the page coming back from a Google
// sign-in redirect (the redirect flag reads "signin"). Linking Google to the signed-in account never goes through it: the server's
// "signin" check would take Google off an account that is being linked on purpose.

export type GoogleCheck = { status: "ok"; needsProfile: boolean } | { status: "link-required"; email: string; hasOtherWay: boolean };

export type GoogleGate = {
  arm(): void;
  disarm(): void;
  // What the check said for this user (once, so a second sign-in checks again); null when it didn't run for them.
  take(uid?: string): GoogleCheck | null;
  // The check refused the sign-in ("link-required"), or failed: what to tell the person. null when it didn't block anything.
  blocked(): { result: Extract<GoogleCheck, { status: "link-required" }> } | { error: unknown } | null;
};

// Should the gate check this user? Pure, for the tests.
export function gateApplies(o: { armed: boolean; redirectSignin: boolean; user: Pick<User, "uid" | "providerData"> | null; currentUid: string | null }): boolean {
  if (!o.user || !(o.armed || o.redirectSignin)) return false;
  if (o.currentUid && o.currentUid === o.user.uid) return false; // the same account refreshing or linking, not a new sign-in
  return o.user.providerData.some((p) => p.providerId === "google.com");
}

export function installGoogleGate(auth: Auth, check: (u: User) => Promise<GoogleCheck>, redirectSignin: () => boolean): GoogleGate {
  let armed = false;
  let last: { uid: string; result: GoogleCheck } | null = null;
  let failed: { error: unknown } | null = null;
  beforeAuthStateChanged(auth, async (u) => {
    if (!gateApplies({ armed, redirectSignin: redirectSignin(), user: u, currentUid: auth.currentUser?.uid ?? null })) return;
    failed = null;
    let r: GoogleCheck;
    try { r = await check(u!); }
    catch (e) { failed = { error: e }; throw e; } // couldn't check: don't let the sign-in through
    last = { uid: u!.uid, result: r };
    if (r.status === "link-required") throw new Error("Google sign-in held: this email has an account; sign in and link Google.");
  });
  return {
    arm() { armed = true; last = null; failed = null; },
    disarm() { armed = false; },
    take(uid) { const l = last; if (!l || (uid && l.uid !== uid)) return null; last = null; return l.result; },
    blocked() {
      if (failed) { const f = failed; failed = null; return f; }
      if (last && last.result.status === "link-required") { const result = last.result; last = null; return { result }; }
      return null;
    },
  };
}
