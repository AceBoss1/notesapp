// The NotesApp Partner Network (owner, 9 Nov 2026: "notesapp only has Affiliate, referral, and ventures, but has no partner programs …
// set plan and build all"). Affiliates and referrals are one person bringing another; Ventures is an idea built together. Partners are
// organisations (or committed people) who sell, deliver, build on or bring whole communities to #NotesApp, under one network with seven
// tracks and three tiers. Client-safe: the rules shared by /partners, the directory, partner pages, the portal, the API
// (lib/partner-network-server.ts) and Admin → Partners.
//
// How money works: a partner's code is their username, so their link is the usual /r/<username> and members they bring are recorded as
// referrals (lib/referrals-server.ts). While the partner is active, their tier sets the share of those members' plan payments and for how
// long (instead of the member referral's 20% for 12 months). Earnings, holds and payouts are the referral ones: nothing new to pay out.
//
// Privacy (NDPA): a workplace or association never sees what a member booked, bought or wrote. Workplaces see only how many staff joined;
// associations see who asked to be verified as their member, nothing else.

export const NETWORK_NAME = "NotesApp Partner Network";
export const PARTNERS_PATH = "/partners";
export const DIRECTORY_PATH = "/partners/directory";
export const PORTAL_PATH = "/partners/portal";
export const partnerPath = (slug: string) => `/partners/${slug}`;

// ── Tracks ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
export const TRACKS = ["solutions", "associations", "workplace", "technology", "channel", "media", "chapters"] as const;
export type Track = (typeof TRACKS)[number];
export const isTrack = (v: unknown): v is Track => TRACKS.includes(v as Track);

// Members: tracks whose partners have people attached to them. Associations verify their members (a badge on the member's profile);
// chapters list their members (a badge too); workplaces count their staff (never shown anywhere, and never who booked what).
export type MemberKind = "verified-member" | "chapter-member" | "staff";
export type TrackInfo = {
  label: string; short: string; emoji: string;
  who: string; // who it's for
  you: string[]; // what the partner does
  get: string[]; // what the partner gets
  reachLabel: string; reachHint: string; // the "how many" question on the application
  members?: { kind: MemberKind; join: string; badge?: (org: string) => string; refLabel: string; refHint: string };
  directory: string; // the heading partners of this track are listed under
};

export const TRACK: Record<Track, TrackInfo> = {
  solutions: {
    label: "Solutions partners", short: "Agencies and experts", emoji: "🛠️",
    who: "Agencies, web designers, virtual assistants, consultants and freelancers who set up and run #NotesApp for coaches, consultants, therapists, creators and small businesses.",
    you: ["Set up members' sites, booking calendars, payments, shops, courses and custom domains", "Answer the requests members send you from the directory within two working days", "Keep your listing honest: services you really offer, and prices you'll honour"],
    get: ["A listing in Find an expert, with members' requests sent to you", "A partner badge, and Certified once you've done the training and delivered for members", "A share of the plan payments of every member you bring, for longer as your tier rises", "Your own fees for your work, agreed between you and the member"],
    reachLabel: "Clients you serve today", reachHint: "Roughly how many clients you work with in a year.",
    directory: "Find an expert",
  },
  associations: {
    label: "Associations and professional bodies", short: "Associations", emoji: "🏛️",
    who: "Professional associations, councils, guilds, federations and alumni networks: coaches, counsellors and therapists, lawyers, consultants, accountants, health workers, teachers and more.",
    you: ["Confirm who is really your member when they ask to be verified", "Tell your members about #NotesApp, and remove members who leave", "Agree group terms for your members with the partnerships team"],
    get: ["A \"Verified member\" badge on each confirmed member's profile, naming your association", "A page on #NotesApp listing your verified members (those who allow it)", "Group terms for your members, agreed with the partnerships team", "A share of the plan payments of members who join through your code"],
    reachLabel: "Members", reachHint: "How many members your association has.",
    members: { kind: "verified-member", join: "I'm a member", badge: (org) => `Verified member of ${org}`, refLabel: "Your membership number", refHint: "As your association knows you, so they can find you on their register." },
    directory: "Associations and professional bodies",
  },
  workplace: {
    label: "Workplace wellbeing", short: "Workplaces", emoji: "💼",
    who: "Employers, HR teams and benefits providers who want their staff to reach coaches, therapists, mentors and courses on #NotesApp.",
    you: ["Share your workplace code with your staff", "Choose practitioners you recommend to them", "Agree how sessions are paid (a budget or invoice) with the partnerships team"],
    get: ["A page for your staff with the practitioners you recommend", "How many of your staff have joined (never who, and never what anyone booked: that stays private)", "A partnerships contact for budgets and invoicing"],
    reachLabel: "Staff", reachHint: "How many people work for you.",
    members: { kind: "staff", join: "I work here", refLabel: "Your workplace code", refHint: "Your employer gives you this code." },
    directory: "Workplaces",
  },
  technology: {
    label: "Technology and integrations", short: "Technology", emoji: "🔌",
    who: "Payment, accounting, calendar, video, HR and AI tools, and developers building on the NotesApp API, Connect NotesApp or Nana.",
    you: ["Build and look after a working integration with #NotesApp", "Keep members' data safe and use only what members agree to share", "Tell us before changes that affect members"],
    get: ["A listing in the integrations directory, with a link to set it up", "API access and help from the team (see API Docs)", "Co-marketing when your integration launches", "A share of the plan payments of members who join through your code"],
    reachLabel: "Customers or users", reachHint: "How many people use your product.",
    directory: "Integrations",
  },
  channel: {
    label: "Channel and resellers", short: "Channel", emoji: "📦",
    who: "Banks, fintechs, telcos, co-working spaces, business hubs and incubators that bundle #NotesApp into what they already offer.",
    you: ["Offer #NotesApp to your customers or members, with your partner code", "Use the brand as the brand guide says", "Agree bundles and offers with the partnerships team before launching them"],
    get: ["A listing under Get NotesApp through", "The highest plan shares as your tier rises", "Co-branded offers and launch support"],
    reachLabel: "Customers or members", reachHint: "How many customers or members you could tell about #NotesApp.",
    directory: "Get NotesApp through",
  },
  media: {
    label: "Media, music and content", short: "Media", emoji: "🎙️",
    who: "Record labels and distributors, podcast networks, publishers, broadcasters and event organisers.",
    you: ["Bring your artists, shows, writers or events to #NotesApp", "Make sure you hold the rights to what you publish", "Run campaigns with us, like the ones for national teams and launches"],
    get: ["Featured placement for your catalogue and campaigns", "Help getting your artists verified on NotesApp Sounds, with royalties in ad share", "A listing among media partners", "A share of the plan payments of members who join through your code"],
    reachLabel: "Audience", reachHint: "Followers, listeners or readers across your channels.",
    directory: "Media partners",
  },
  chapters: {
    label: "Campus and community chapters", short: "Chapters", emoji: "🎓",
    who: "Student societies, campus clubs, creator communities, faith and community groups: a lead who runs a #NotesApp chapter where they are.",
    you: ["Run at least one chapter event a quarter", "Welcome new members and help them get started", "Keep your chapter friendly and safe"],
    get: ["A chapter page, and a \"Chapter member\" badge for your members", "A share of the plan payments of members who join through your code", "Event support and NotesApp merch for active chapters", "A path to the Campus Ambassador role at #NotesApp"],
    reachLabel: "Community size", reachHint: "How many people are in your society, campus or community.",
    members: { kind: "chapter-member", join: "Join this chapter", badge: (org) => `Member of ${org}`, refLabel: "How you're part of it (optional)", refHint: "Your course, year or role, if you'd like the lead to know." },
    directory: "Chapters",
  },
};

// Services a solutions partner offers (Find an expert filters by these).
export const SERVICES = ["setup", "design", "payments", "booking", "shop", "courses", "content", "domains", "migration", "training", "marketing", "ai"] as const;
export type Service = (typeof SERVICES)[number];
export const SERVICE_LABEL: Record<Service, string> = {
  setup: "Full setup", design: "Site and brand design", payments: "Payments and payouts", booking: "Booking calendar", shop: "Shop and products",
  courses: "Courses", content: "Writing and content", domains: "Custom domains", migration: "Moving from another platform", training: "Training your team",
  marketing: "Marketing and audience", ai: "Nana and AI tools",
};
export const isService = (v: unknown): v is Service => SERVICES.includes(v as Service);

// ── Tiers ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
export const TIERS = ["registered", "certified", "premier"] as const;
export type Tier = (typeof TIERS)[number];
export const isTier = (v: unknown): v is Tier => TIERS.includes(v as Tier);
export const TIER_LABEL: Record<Tier, string> = { registered: "Registered", certified: "Certified", premier: "Premier" };
export type TierTerms = { percent: number; months: number };
// Plan share for members a partner brings: percent of each plan payment, for `months` from that member's first payment. A super admin
// changes these in Admin → Limits → Partner Network (settings/partners); members already brought keep earning on the terms of the day.
export const DEFAULT_TERMS: Record<Tier, TierTerms> = {
  registered: { percent: 20, months: 12 },
  certified: { percent: 25, months: 18 },
  premier: { percent: 30, months: 24 },
};
export const SHARE_MIN = 5, SHARE_MAX = 50, MONTHS_MIN = 1, MONTHS_MAX = 36;
export const isTierTerms = (v: unknown): v is TierTerms => {
  const t = v as TierTerms;
  return !!t && Number.isInteger(t.percent) && t.percent >= SHARE_MIN && t.percent <= SHARE_MAX && Number.isInteger(t.months) && t.months >= MONTHS_MIN && t.months <= MONTHS_MAX;
};
// How a partner moves up. Certified is requested from the portal once the progress shown there is met; Premier is by invitation.
export const CERTIFY_PAYING = 5; // paying members brought
export const CERTIFY_MEMBERS = 25; // or verified members / chapter members (associations, chapters)
export const TIER_NEED: Record<Tier, string> = {
  registered: "Your application is approved.",
  certified: `Finish the partner training, and bring ${CERTIFY_PAYING} paying members (associations and chapters: or ${CERTIFY_MEMBERS} verified members). Then ask for it in your portal.`,
  premier: "By invitation, for partners who bring members steadily over a year and are rated well by them.",
};
// The partner training (Certified): what a partner ticks off in the portal.
export const TRAINING = [
  "Read the partner terms and the brand guide",
  "Set up a complete NotesApp profile: photo, bio and a published note",
  "Take a payment and a booking end to end on a test account",
  "Read the help articles on plans, payouts and members' privacy",
] as const;

// ── Applications and partners ───────────────────────────────────────────────────────────────────────────────────────────────────────
export const APP_STATUSES = ["received", "reviewing", "approved", "declined", "withdrawn"] as const;
export type AppStatus = (typeof APP_STATUSES)[number];
export const isAppStatus = (v: unknown): v is AppStatus => APP_STATUSES.includes(v as AppStatus);
export const APP_STATUS_LABEL: Record<AppStatus, string> = {
  received: "Received", reviewing: "Being reviewed", approved: "Approved: welcome to the network", declined: "Not approved", withdrawn: "Withdrawn",
};
export const OPEN_APP: AppStatus[] = ["received", "reviewing"];

export const LIMITS = { orgName: 80, website: 200, country: 120, about: 1200, plan: 1200, blurb: 400, feedback: 2000, notes: 2000, services: 8, recommended: 30, message: 1000, ref: 60 };

export type Application = {
  id: string; uid: string; username: string; name: string;
  track: Track; orgName: string; website: string; countries: string; reach: number; about: string; plan: string; services: Service[];
  status: AppStatus; createdAt: string; updatedAt: string;
  feedback?: string; // shown to the applicant
  notes?: string; // the team's own
  partnerId?: string; // the partner made when it was approved
};
export type MyApplication = Pick<Application, "id" | "track" | "orgName" | "status" | "createdAt" | "feedback" | "partnerId">;

export type PartnerStatus = "active" | "suspended";
export type Partner = {
  id: string; // the slug: /partners/<id>
  uid: string; username: string; track: Track; name: string; tier: Tier; status: PartnerStatus; listed: boolean;
  blurb: string; website: string; countries: string; services: Service[];
  code?: string; // workplaces: the code staff join with
  recommended?: string[]; // workplaces: usernames of practitioners they recommend
  training?: number[]; // indexes of TRAINING done
  tierRequestedAt?: string; createdAt: string; updatedAt: string; notes?: string;
};
// What anyone may see of a partner.
export type PublicPartner = Pick<Partner, "id" | "username" | "track" | "name" | "tier" | "blurb" | "website" | "countries" | "services"> & { members?: number; recommended?: string[] };
export const toPublic = (p: Partner, members?: number): PublicPartner => ({
  id: p.id, username: p.username, track: p.track, name: p.name, tier: p.tier, blurb: p.blurb, website: p.website, countries: p.countries, services: p.services,
  ...(members !== undefined && p.track !== "workplace" ? { members } : {}),
  ...(p.track === "workplace" && p.recommended?.length ? { recommended: p.recommended } : {}),
});

// A partner's slug, from its name: lowercase words joined by dashes.
export const slugOf = (name: string) => name.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "partner";

// ── Requests to solutions partners (Find an expert) ─────────────────────────────────────────────────────────────────────────────────
export const LEAD_STATUSES = ["new", "contacted", "won", "lost"] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];
export const isLeadStatus = (v: unknown): v is LeadStatus => LEAD_STATUSES.includes(v as LeadStatus);
export const LEAD_STATUS_LABEL: Record<LeadStatus, string> = { new: "New", contacted: "Contacted", won: "Working together", lost: "Didn't go ahead" };
export const BUDGETS = ["under-50k", "50k-200k", "200k-500k", "over-500k", "unsure"] as const;
export type Budget = (typeof BUDGETS)[number];
export const BUDGET_LABEL: Record<Budget, string> = { "under-50k": "Under ₦50,000", "50k-200k": "₦50,000 to ₦200,000", "200k-500k": "₦200,000 to ₦500,000", "over-500k": "Over ₦500,000", unsure: "Not sure yet" };
export const isBudget = (v: unknown): v is Budget => BUDGETS.includes(v as Budget);
export const LEADS_PER_DAY = 5; // requests one member can send a day
export type Lead = {
  id: string; partnerId: string; partnerUid: string; fromUid: string; fromUsername: string; fromName: string;
  service: Service; budget: Budget; message: string; status: LeadStatus; createdAt: string; updatedAt: string;
};

// ── Members of associations, chapters and workplaces ───────────────────────────────────────────────────────────────────────────────
export const MEMBER_STATUSES = ["pending", "verified", "declined", "removed", "left"] as const;
export type MemberStatus = (typeof MEMBER_STATUSES)[number];
export type Membership = {
  id: string; // <partnerId>_<uid>
  partnerId: string; partnerUid: string; partnerName: string; track: Track; kind: MemberKind;
  uid: string; username: string; name: string; ref: string; status: MemberStatus; createdAt: string; decidedAt?: string;
};
// A badge on a member's profile: a verified association membership, a chapter, or being a NotesApp partner.
export type ProfileBadge = { label: string; href: string; kind: "member" | "partner"; tier?: Tier };
export const partnerBadge = (p: Pick<Partner, "tier" | "track" | "id">): ProfileBadge => ({
  label: `${TIER_LABEL[p.tier]} NotesApp partner · ${TRACK[p.track].short}`, href: partnerPath(p.id), kind: "partner", tier: p.tier,
});

// The terms an applicant agrees to (shown beside the form).
export const PARTNER_TERMS = [
  "You apply for yourself or for an organisation you're allowed to represent. The partnerships team may ask for proof.",
  "Approval, tiers and listings are decided by people on the partnerships team. Either side can end the partnership at any time; earnings already made stay yours unless they came from refunded or fraudulent payments.",
  "Members you bring earn you a share of their plan payments, at your tier's rate and for your tier's period, paid like referral earnings (after the usual hold, as cash or NotesApp Credit). Bundles, group terms and budgets are agreed in writing with the team.",
  "Members' privacy comes first. You never see what a member books, buys or writes, and you only use what they choose to share with you.",
  "Represent #NotesApp honestly: no promises we haven't made, no spam, and the brand used as the brand guide says. Breaking this ends the partnership.",
] as const;
export const AGREE_TEXT = "I've read the partner terms. I'm 18 or over and allowed to apply for this organisation.";
