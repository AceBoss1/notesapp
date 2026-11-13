// Referral milestones (owner, 12 Nov 2026: "see how they did this gamification … make referrals gamified like this on NotesApp and reward
// bonus credits"). On top of the referral share (lib/referrals.ts), bringing friends who become real members unlocks milestones, each
// paying Bonus Credits into your NotesApp wallet once, claimed with a tap. Pure: the server is lib/referral-milestones-server.ts.
//
// A friend counts once they're a real member: they joined through your link or code, verified their email, chose a username, aren't a
// child profile and aren't suspended. Bonus Credits are spent on #NotesApp only and last as long as any Bonus Credits (lib/wallet.ts).

export type Milestone = { id: string; name: string; need: number; bonusKobo: number; icon: "first" | "squad" | "crowd" | "viral"; blurb: string };
export const MILESTONES: Milestone[] = [
  { id: "first", name: "First friend", need: 1, bonusKobo: 300_00, icon: "first", blurb: "Invite a friend who joins as a real member" },
  { id: "squad", name: "Squad", need: 5, bonusKobo: 1_000_00, icon: "squad", blurb: "Invite 5 friends" },
  { id: "crowd", name: "Crowd", need: 25, bonusKobo: 5_000_00, icon: "crowd", blurb: "Invite 25 friends" },
  { id: "viral", name: "Viral", need: 100, bonusKobo: 20_000_00, icon: "viral", blurb: "Invite 100 friends" },
];
export const isMilestoneId = (v: unknown): v is string => MILESTONES.some((m) => m.id === v);

export type MilestoneState = Milestone & { progress: number; reached: boolean; claimed: boolean };
export function milestoneStates(qualified: number, claimed: Record<string, unknown>): MilestoneState[] {
  return MILESTONES.map((m) => ({ ...m, progress: Math.min(qualified, m.need), reached: qualified >= m.need, claimed: !!claimed[m.id] }));
}
export const nextMilestone = (states: MilestoneState[]) => states.find((s) => !s.reached) ?? null;
