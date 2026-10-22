// Notes Life on the rest of NotesApp (pure): the feed card's rhythm and who may be shown as a player.
// The card shows at most twice a day; ✕ hides it for a week (kept in the browser). Being shown as a player needs both people to
// follow each other (like online status), the player's own "Show that I play Notes Life" on, and neither of them in teen mode.
export const LIFE_CARD_PER_DAY = 2;
export const LIFE_CARD_HIDE_DAYS = 7;
export type CardState = { day: string; shown: number; hiddenUntil?: string };

export function cardTurn(s: CardState | null | undefined, nowIso: string): { show: boolean; next: CardState } {
  const day = nowIso.slice(0, 10);
  const cur: CardState = s && s.day === day ? { ...s } : { day, shown: 0, ...(s?.hiddenUntil ? { hiddenUntil: s.hiddenUntil } : {}) };
  if (cur.hiddenUntil && cur.hiddenUntil > nowIso) return { show: false, next: cur };
  if (cur.shown >= LIFE_CARD_PER_DAY) return { show: false, next: cur };
  return { show: true, next: { ...cur, shown: cur.shown + 1 } };
}
export const hideCard = (s: CardState | null | undefined, nowIso: string): CardState =>
  ({ day: s?.day ?? nowIso.slice(0, 10), shown: s?.shown ?? 0, hiddenUntil: new Date(new Date(nowIso).getTime() + LIFE_CARD_HIDE_DAYS * 86_400_000).toISOString() });

// A member's Notes Life privacy, from their profile: both switches on unless turned off; teen mode turns both off and keeps them off.
export type LifePrivacy = { lifeShow: boolean; lifeCard: boolean; teen: boolean };
export const lifePrivacyOf = (u: { lifeShow?: unknown; lifeCard?: unknown; teen?: unknown } | null | undefined): LifePrivacy => {
  const teen = u?.teen === true;
  return { teen, lifeShow: !teen && u?.lifeShow !== false, lifeCard: !teen && u?.lifeCard !== false };
};
export const canShowPlayer = (o: { viewer: LifePrivacy | null; player: LifePrivacy; mutual: boolean; plays: boolean }) =>
  !!o.viewer && !o.viewer.teen && o.player.lifeShow && o.mutual && o.plays;
