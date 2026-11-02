import { COMPANY_INFO } from "@/lib/site";
import { headers } from "next/headers";
import { mainSiteUrl } from "@/lib/host";
import { LEGAL_CONTACT } from "@/lib/legal";

// The "powered by #NotesApp" block at the foot of a member site's legal pages (Business and Enterprise alike).
// The links go to the main site of the domain being viewed, or the primary address on a member's own domain (lib/host.ts mainSiteUrl).
export default function PoweredBy({ name }: { name: string }) {
  const main = mainSiteUrl(headers().get("host"));
  return (
    <aside className="mt-12 border-t border-rule pt-6 text-sm text-slate">
      <p>
        <strong className="text-ink">{name}</strong> is powered by{" "}
        <a href={main} className="font-semibold text-crimson underline">#NotesApp</a>, a platform operated by {COMPANY_INFO.legalName} (RC {COMPANY_INFO.rcNumber}). Accounts, bookings, payments and shop orders on this site run on #NotesApp, whose{" "}
        <a href={`${main}/terms`} className="text-crimson underline">Terms of Service</a> and{" "}
        <a href={`${main}/privacy`} className="text-crimson underline">Privacy Policy</a> also apply to them. For anything about the platform itself, contact {LEGAL_CONTACT}.
      </p>
    </aside>
  );
}
