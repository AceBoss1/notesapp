import Link from "next/link";
import { UNVERIFIED_ORG_NOTICE, isOrganisation, orgVerified } from "@/lib/org";

type P = { accountKind?: string; org?: { rcStatus?: string } | null } | null | undefined;

// Small "Organisation" chip beside a channel's name.
export function OrgLabel({ profile }: { profile: P }) {
  if (!isOrganisation(profile)) return null;
  return (
    <span className="ml-2 inline-block rounded-full border border-rule px-2 py-0.5 align-middle font-mono text-[10px] uppercase tracking-wideish text-slate">
      Organisation
    </span>
  );
}

// Shown on an organisation's channel and under its posts until its CAC details are confirmed.
export function UnverifiedOrgNotice({ profile, compact = false }: { profile: P; compact?: boolean }) {
  if (!isOrganisation(profile) || orgVerified(profile)) return null;
  return (
    <p className={`${compact ? "mt-3 text-xs" : "mt-4 text-sm"} border-l-2 border-crimson bg-card px-3 py-2 text-slate`}>
      {UNVERIFIED_ORG_NOTICE}{" "}
      <Link href="/badges" className="text-crimson underline underline-offset-2">What the ✔ means</Link>
    </p>
  );
}
