import { getAdminDb } from "./firebase-admin";
import { DnsRecord, dnsInstructions, isApexDomain } from "./host";

// Custom domains for Enterprise accounts (`customDomains/{host}`, server-only; one per account).
// The domain is registered on the Vercel project through its API when VERCEL_API_TOKEN and VERCEL_PROJECT_ID
// (and VERCEL_TEAM_ID for a team project) are set; otherwise it stays "pending" until an admin connects it.
export type DomainDoc = {
  host: string; uid: string; username: string;
  status: "pending" | "active"; home: "profile" | "store";
  note?: string; dns: DnsRecord[]; vercel: boolean; createdAt: string; verifiedAt?: string;
};

const api = () => {
  const token = process.env.VERCEL_API_TOKEN, project = process.env.VERCEL_PROJECT_ID;
  if (!token || !project) return null;
  const team = process.env.VERCEL_TEAM_ID ? `teamId=${encodeURIComponent(process.env.VERCEL_TEAM_ID)}` : "";
  return { token, project, team };
};
export const vercelConfigured = () => !!api();

async function vercel(path: string, init: RequestInit = {}): Promise<{ ok: boolean; status: number; body: any }> {
  const a = api()!;
  const sep = path.includes("?") ? "&" : "?";
  const res = await fetch(`https://api.vercel.com${path}${a.team ? `${sep}${a.team}` : ""}`, {
    ...init, headers: { Authorization: `Bearer ${a.token}`, "Content-Type": "application/json", ...(init.headers || {}) }, cache: "no-store",
  });
  return { ok: res.ok, status: res.status, body: await res.json().catch(() => ({})) };
}

// Adds the domain to the project. Returns DNS records to show the owner (plus any TXT verification Vercel wants).
export async function registerDomain(host: string): Promise<{ dns: DnsRecord[]; note?: string; vercel: boolean }> {
  const dns = dnsInstructions(host);
  if (!api()) return { dns, vercel: false, note: "Waiting for #NotesApp to connect this domain. We'll email you when it's live." };
  const r = await vercel(`/v10/projects/${api()!.project}/domains`, { method: "POST", body: JSON.stringify({ name: host }) });
  if (!r.ok && r.body?.error?.code !== "domain_already_in_use" && r.body?.error?.code !== "domain_already_exists") {
    throw new Error(r.body?.error?.message || "Couldn't register the domain.");
  }
  if (r.body?.error?.code === "domain_already_in_use") throw new Error("That domain is already connected to another project.");
  const verification = (r.body?.verification || []) as { type: string; domain: string; value: string }[];
  return { dns: [...dns, ...verification.map((v) => ({ type: "TXT" as const, name: v.domain, value: v.value }))], vercel: true };
}

// Asks Vercel whether DNS is pointing correctly (and runs ownership verification if needed).
export async function checkDomain(host: string): Promise<{ active: boolean; note?: string }> {
  if (!api()) return { active: false, note: "Waiting for #NotesApp to connect this domain." };
  const a = api()!;
  let d = await vercel(`/v9/projects/${a.project}/domains/${encodeURIComponent(host)}`);
  if (d.ok && d.body?.verified === false) d = await vercel(`/v9/projects/${a.project}/domains/${encodeURIComponent(host)}/verify`, { method: "POST" });
  const cfg = await vercel(`/v6/domains/${encodeURIComponent(host)}/config`);
  const verified = d.ok && d.body?.verified === true;
  const misconfigured = cfg.ok ? cfg.body?.misconfigured === true : true;
  if (verified && !misconfigured) return { active: true };
  return { active: false, note: !verified ? "We can't verify this domain yet — add the DNS records below, then check again (DNS can take a few minutes to hours)." : "DNS isn't pointing at #NotesApp yet — check the records below." };
}

// True when the token and project ID work (used by /status). Never throws.
export async function pingVercel(): Promise<boolean> {
  if (!api()) return false;
  try {
    return (await vercel(`/v9/projects/${api()!.project}`)).ok;
  } catch {
    return false;
  }
}

export async function removeDomain(host: string): Promise<void> {
  if (!api()) return;
  await vercel(`/v9/projects/${api()!.project}/domains/${encodeURIComponent(host)}`, { method: "DELETE" }).catch(() => {});
}

export async function domainForUid(uid: string): Promise<(DomainDoc & { id: string }) | null> {
  const snap = await getAdminDb().collection("customDomains").where("uid", "==", uid).limit(1).get();
  return snap.empty ? null : { id: snap.docs[0].id, ...(snap.docs[0].data() as DomainDoc) };
}
export { isApexDomain };
