import { redirect } from "next/navigation";

// /notes was an early, since-abandoned route name — /journals is the
// only page actually maintained (see README's "The one rule this
// build follows"). Rather than keep two copies of the same page in
// sync forever — which is exactly how a /notes/[slug] build broke,
// silently drifting out of sync with SocialBar's props — this just
// forwards permanently.
export default function NotesRedirect() {
  redirect("/journals");
}
