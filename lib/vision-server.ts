import type { Firestore } from "firebase-admin/firestore";
import { ADMIN_PROFILES } from "./admin";
import { FOUNDERS, isFounder, personFor, type Founders, type PersonKey } from "./vision";

// What the Vision model hands each person. The starting split and the staff option are served only to the people they concern, never shipped in the
// page's code: the three founders get the founders' split (the "bridge" case from the capital-structure registry); Nora Bawa gets her own option only.
//   Founders' split: Emmanuel 67% (the remainder), Chimdinma 10% (US$500), Akujuobi 8% (US$3,000), up to 15% for angels at 5% per US$10,000 with the
//   unsold part held as the FEBO reserve.  Option: 1.50% of fully diluted capital (150,000 of 10,000,000 shares).
const FOUNDER_BASE: Founders = { trackB: true, bridge: 10_000, cPct: 10, aPct: 8, cCash: 500, aCash: 3_000 };
const OPTION = { pct: 1.5, shares: 150_000, fullyDiluted: 10_000_000 };

export type Caller = { uid: string; email: string; owner: boolean };
export type VisionPayload = {
  viewer: PersonKey; real: PersonKey; canSwitch: boolean; people: PersonKey[];
  founders?: Founders; option?: typeof OPTION;
};

// The signed-in person: the VISION_PEOPLE email list first, then the owner (Emmanuel), then the name on their account.
export async function whoIs(db: Firestore, c: Caller): Promise<PersonKey | null> {
  const doc = await db.doc(`users/${c.uid}`).get();
  const name = String(doc.data()?.displayName || ADMIN_PROFILES[c.email.toLowerCase()]?.displayName || "");
  return personFor({ name, email: c.email, owner: c.owner }, process.env.VISION_PEOPLE);
}

// `as` lets the owner look at the model as another person to check what they see; anyone else's `as` is ignored.
export async function visionFor(db: Firestore, c: Caller, as?: string | null): Promise<VisionPayload | null> {
  const real = await whoIs(db, c);
  if (!real) return null;
  const viewer: PersonKey = c.owner && as && ([...FOUNDERS, "nora"] as string[]).includes(as) ? (as as PersonKey) : real;
  return {
    viewer, real, canSwitch: c.owner, people: c.owner ? [...FOUNDERS, "nora"] : [],
    ...(isFounder(viewer) ? { founders: FOUNDER_BASE } : { option: OPTION }),
  };
}
