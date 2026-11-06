// NotesApp Ventures and its open call, Rewrite the Playbook (owner, 6 Nov 2026). Applications are rolling, and the team picks up to 3 a
// quarter (owner, 6 Nov 2026: "owing to our current strength"); a super admin raises or lowers that in Admin → Limits, sitewide. Members pitch a feature, product or business they're
// sure the crowd would jump into; the ones picked are built with #NotesApp (engineers, platform, guidance) in exchange for equity and a
// board seat, on terms that fit each project. Only ideas and ventures for emerging markets are welcome. Every pitch is kept confidential
// (counsel, 6 Nov 2026: "kept confidential", never "NDA"). Every participant gets perks. Client-safe: the rules, shared by the page, the
// form, the API (lib/ventures-server.ts) and Admin → Ventures.

export const VENTURES_NAME = "NotesApp Ventures";
export const CALL_NAME = "Rewrite the Playbook";
export const VENTURES_PATH = "/ventures";

// Who it's for: people and businesses in emerging markets. One region is required; countries are free text.
export const REGIONS = [
  "africa", "mena", "south-asia", "southeast-asia", "latin-america", "caribbean", "central-asia", "eastern-europe", "pacific",
] as const;
export type Region = (typeof REGIONS)[number];
export const REGION_LABEL: Record<Region, string> = {
  africa: "Africa",
  mena: "Middle East and North Africa",
  "south-asia": "South Asia",
  "southeast-asia": "Southeast Asia",
  "latin-america": "Latin America",
  caribbean: "The Caribbean",
  "central-asia": "Central Asia",
  "eastern-europe": "Eastern Europe",
  pacific: "The Pacific islands",
};
export const isRegion = (v: unknown): v is Region => REGIONS.includes(v as Region);

export const STAGES = ["idea", "prototype", "live", "revenue"] as const;
export type Stage = (typeof STAGES)[number];
export const STAGE_LABEL: Record<Stage, string> = {
  idea: "An idea (nothing built yet)",
  prototype: "A prototype or mock-ups",
  live: "Live, with first users",
  revenue: "Live and making money",
};
export const isStage = (v: unknown): v is Stage => STAGES.includes(v as Stage);

export const KINDS = ["feature", "product", "business"] as const;
export type Kind = (typeof KINDS)[number];
export const KIND_LABEL: Record<Kind, string> = {
  feature: "A feature for #NotesApp",
  product: "A new product",
  business: "A business or venture",
};
export const isKind = (v: unknown): v is Kind => KINDS.includes(v as Kind);

export const SECTORS = [
  "fintech", "creator-economy", "education", "health", "agriculture", "commerce", "logistics", "energy", "media", "ai", "community", "other",
] as const;
export type Sector = (typeof SECTORS)[number];
export const SECTOR_LABEL: Record<Sector, string> = {
  fintech: "Money and payments", "creator-economy": "Creators", education: "Education", health: "Health", agriculture: "Farming and food",
  commerce: "Selling and shopping", logistics: "Delivery and logistics", energy: "Energy", media: "Media and entertainment", ai: "AI tools",
  community: "Communities, faith and NGOs", other: "Something else",
};
export const isSector = (v: unknown): v is Sector => SECTORS.includes(v as Sector);

// Where an application stands. People make every decision.
export const STATUSES = ["received", "reviewing", "shortlisted", "picked", "not-picked", "withdrawn"] as const;
export type Status = (typeof STATUSES)[number];
export const STATUS_LABEL: Record<Status, string> = {
  received: "Received",
  reviewing: "Being read",
  shortlisted: "Shortlisted: we'd like to talk",
  picked: "Picked: let's build it",
  "not-picked": "Not picked this round",
  withdrawn: "Withdrawn",
};
export const isStatus = (v: unknown): v is Status => STATUSES.includes(v as Status);
export const OPEN_STATUSES: Status[] = ["received", "reviewing", "shortlisted"];
// What the member is told in their notifications when the team moves an application on.
export const STATUS_NOTE: Partial<Record<Status, (title: string, picks: number) => string>> = {
  reviewing: (t) => `${CALL_NAME}: the team is reading "${t}".`,
  shortlisted: (t) => `${CALL_NAME}: "${t}" is shortlisted. We'll be in touch to talk it through.`,
  picked: (t) => `${CALL_NAME}: "${t}" is picked! We'd like to build it with you. We'll send the next steps and terms.`,
  "not-picked": (t, n) => `${CALL_NAME}: "${t}" wasn't one of the ${n} we picked this quarter. It's nothing personal: we receive many pitches and can only take on ${n} a quarter for now. Read the team's advice on the Ventures page, and pitch again next quarter.`,
};

export const LIMITS = {
  title: 80, oneLiner: 160, problem: 1500, solution: 1500, whyYou: 1000, traction: 800, countries: 120, links: 5, teamSize: 50,
  perQuarter: 3, // pitches one member can send in a quarter (withdrawn ones don't count)
  advice: 2000,
};

// Rolling: pitch any time. The team picks up to `picksPerQuarter` a quarter (enforced when a pitch is marked picked). The default is 3; a
// super admin changes it in Admin → Limits → NotesApp Ventures (settings/ventures), and the page, the form, the notifications and the cap
// all follow. Pitches are grouped by the quarter they're sent in, like "Q4 2026".
export const PICKS_PER_QUARTER = 3;
export const PICKS_MIN = 1, PICKS_MAX = 50;
export const isPicks = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v >= PICKS_MIN && v <= PICKS_MAX;
export const quarterOf = (d: Date) => `Q${Math.floor(d.getUTCMonth() / 3) + 1} ${d.getUTCFullYear()}`;
export const notPickedNote = (n: number) => `It's nothing personal. We receive many pitches and, with the team we have today, can only build ${n} a quarter. Read the team's advice, sharpen your pitch, and try again next quarter: several picks will be second tries.`;

// The call's terms, shown beside the form and agreed to with the tick box (counsel's wording: "kept confidential").
export const CONFIDENTIAL_TERMS = [
  "Your pitch is kept confidential. Only the NotesApp Ventures review team reads it, and we never share it outside #NotesApp without your permission, whether or not it's picked.",
  "#NotesApp builds many products, so we may already be working on, or later build, something similar on our own. Pitching doesn't stop us doing that, and it doesn't give either side rights over the other's work.",
  "If your idea is picked, we agree the terms with you before any work starts: what each side brings, the equity, the board seat, and who owns what. Terms differ from project to project. Nothing is binding until both sides sign.",
  "You must be 18 or over, and the idea must be yours to pitch (not your employer's or anyone else's).",
] as const;
export const AGREE_TEXT = "I've read the terms above. I'm 18 or over, this idea is mine to pitch, and it's for people or businesses in emerging markets.";

// Perks for everyone who pitches (owner, 6 Nov 2026: "we could give some perks to participants"). Shown on the page; the team sends them
// (Admin → Ventures → Perks sent), so nothing here is granted automatically.
export const PERKS = [
  "A month of NotesApp Business free, to build an audience around your idea",
  "Nana credit to research your market and draft your pitch",
  "A boost for your launch post on #NotesApp",
  "Invitations to Rewrite the Playbook sessions with the #NotesApp team",
] as const;

// The call: open for pitches or paused (Admin → Ventures), and how many are picked a quarter (Admin → Limits). settings/ventures. Rolling,
// so there are no rounds to name or close.
export type CallSettings = { open: boolean; picksPerQuarter: number };
export const DEFAULT_CALL: CallSettings = { open: true, picksPerQuarter: PICKS_PER_QUARTER };

export type Application = {
  id: string; uid: string; username: string; name: string;
  quarter: string; kind: Kind; sector: Sector; stage: Stage; region: Region; countries: string;
  title: string; oneLiner: string; problem: string; solution: string; whyYou: string; traction: string;
  teamSize: number; links: string[];
  status: Status; createdAt: string; updatedAt: string;
  advice?: string; // the team's advice to the member (shown to them, with any decision)
  pickedQuarter?: string; // the quarter it was picked in (up to PICKS_PER_QUARTER a quarter)
  notes?: string; perksSentAt?: string; // the team's own (never shown to the member)
};
// What the member sees of their own pitch.
export type MyApplication = Pick<Application, "id" | "quarter" | "title" | "oneLiner" | "status" | "createdAt" | "kind" | "region" | "advice">;
