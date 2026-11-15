// Referral milestones (owner, 12 Nov 2026: "see how they did this gamification … make referrals gamified like this on NotesApp and reward
// bonus credits"). On top of the referral share (lib/referrals.ts), bringing friends who become real members unlocks milestones, each
// paying Bonus Credits into your NotesApp wallet once, claimed with a tap. Pure: the server is lib/referral-milestones-server.ts.
//
// A friend counts once they're a real member: they joined through your link or code, or your Notes Life invite (owner, 14 Nov 2026), verified their email, chose a username, aren't a
// child profile and aren't suspended. Bonus Credits are spent on #NotesApp only and last as long as any Bonus Credits (lib/wallet.ts).

export type Milestone = { id: MilestoneId; name: string; need: number; bonusKobo: number; icon: "first" | "squad" | "crowd" | "viral"; blurb: string };
export const MILESTONE_IDS = ["first", "squad", "crowd", "viral"] as const;
export type MilestoneId = (typeof MILESTONE_IDS)[number];
// The defaults (owner, 14 Nov 2026). A super admin changes how many friends each needs and what it pays in Admin → Limits → Referral
// milestones (settings/referralMilestones), and can reset them to these.
export const MILESTONES: Milestone[] = [
  { id: "first", name: "First friend", need: 1, bonusKobo: 200_00, icon: "first", blurb: "Invite a friend who joins as a real member" },
  { id: "squad", name: "Squad", need: 5, bonusKobo: 1_100_00, icon: "squad", blurb: "Invite 5 friends" },
  { id: "crowd", name: "Crowd", need: 25, bonusKobo: 6_000_00, icon: "crowd", blurb: "Invite 25 friends" },
  { id: "viral", name: "Viral", need: 100, bonusKobo: 25_000_00, icon: "viral", blurb: "Invite 100 friends" },
];
export const isMilestoneId = (v: unknown): v is MilestoneId => MILESTONE_IDS.includes(v as MilestoneId);

// What an admin saved: per milestone, the friends it needs and its Bonus Credits. Limits keep it sane: 1 to 10,000 friends, ₦0 to
// ₦1,000,000, and each milestone needing more friends than the one before.
export type MilestoneSettings = Partial<Record<MilestoneId, { need?: number; bonusKobo?: number }>>;
export const MS_MAX_NEED = 10_000, MS_MAX_BONUS_KOBO = 1_000_000_00;
export function milestonesWith(saved: MilestoneSettings | null | undefined): Milestone[] {
  const out = MILESTONES.map((m) => {
    const x = saved?.[m.id];
    const need = Number.isInteger(x?.need) && x!.need! >= 1 && x!.need! <= MS_MAX_NEED ? x!.need! : m.need;
    const bonusKobo = Number.isInteger(x?.bonusKobo) && x!.bonusKobo! >= 0 && x!.bonusKobo! <= MS_MAX_BONUS_KOBO ? x!.bonusKobo! : m.bonusKobo;
    return { ...m, need, bonusKobo, blurb: need === 1 ? "Invite a friend who joins as a real member" : `Invite ${need.toLocaleString("en-NG")} friends` };
  });
  return out.every((m, i) => i === 0 || m.need > out[i - 1].need) ? out : MILESTONES;
}
export function cleanMilestoneSettings(b: unknown): MilestoneSettings | string {
  const o = (b && typeof b === "object" ? b : {}) as Record<string, { need?: unknown; bonusNaira?: unknown }>;
  const out: MilestoneSettings = {};
  let last = 0;
  for (const m of MILESTONES) {
    const x = o[m.id] ?? {};
    const need = Number(x.need), naira = Number(x.bonusNaira);
    if (!Number.isInteger(need) || need < 1 || need > MS_MAX_NEED) return `${m.name}: friends needed is a whole number from 1 to ${MS_MAX_NEED.toLocaleString("en-NG")}.`;
    if (need <= last) return `${m.name} must need more friends than the milestone before it.`;
    if (!Number.isFinite(naira) || naira < 0 || naira * 100 > MS_MAX_BONUS_KOBO) return `${m.name}: Bonus Credits from ₦0 to ₦1,000,000.`;
    out[m.id] = { need, bonusKobo: Math.round(naira * 100) };
    last = need;
  }
  return out;
}

export type MilestoneState = Milestone & { progress: number; reached: boolean; claimed: boolean };
export function milestoneStates(qualified: number, claimed: Record<string, unknown>, list: Milestone[] = MILESTONES): MilestoneState[] {
  return list.map((m) => ({ ...m, progress: Math.min(qualified, m.need), reached: qualified >= m.need, claimed: !!claimed[m.id] }));
}
export const nextMilestone = (states: MilestoneState[]) => states.find((s) => !s.reached) ?? null;
