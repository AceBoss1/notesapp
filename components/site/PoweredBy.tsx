import { COMPANY_INFO } from "@/lib/site";
import { MAIN_HOST } from "@/lib/host";
import { LEGAL_CONTACT } from "@/lib/legal";

// The "powered by #NotesApp" block at the foot of a member site's legal pages (Business and Enterprise alike).
export default function PoweredBy({ name }: { name: string }) {
  return (
    <aside className="mt-12 border-t border-rule pt-6 text-sm text-slate">
      <p>
        <strong className="text-ink">{name}</strong> is powered by{" "}
        <a href={`https://${MAIN_HOST}`} className="font-semibold text-crimson underline">#NotesApp</a>, a platform operated by {COMPANY_INFO.legalName} (RC {COMPANY_INFO.rcNumber}). Accounts, bookings, payments and shop orders on this site run on #NotesApp, whose{" "}
        <a href={`https://${MAIN_HOST}/terms`} className="text-crimson underline">Terms of Service</a> and{" "}
        <a href={`https://${MAIN_HOST}/privacy`} className="text-crimson underline">Privacy Policy</a> also apply to them. For anything about the platform itself, contact {LEGAL_CONTACT}.
      </p>
    </aside>
  );
}
