// Where the Arcade keeps a player's wins, records and choices (owner, 20 Nov 2026): playing is free without signing in, but a guest's
// progress isn't saved, so every fresh page load starts afresh. Signing in with #NotesApp will save progress, sync N$, scores and
// referral bonus credit through the Notes Life wallet (not built yet: this is the one place to connect it). No game pays real naira.
// Same shape as localStorage so the games don't change when the account store arrives.
const memory = new Map<string, string>();

export const arcadeStore = {
  getItem(key: string): string | null {
    return memory.has(key) ? (memory.get(key) as string) : null;
  },
  setItem(key: string, value: string): void {
    memory.set(key, value);
  },
};
