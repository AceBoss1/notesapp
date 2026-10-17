import type { Note } from "./firestore-notes";
import type { UserProfile } from "./users";
import { resolveAuthorUsername } from "./journals-directory";

export type FeedAuthor = { avatar: string; username: string; role?: string; isOrg?: boolean };

// Who wrote a journal, for cards that link to the writer. Journals saved by the Precheks app, by the API before it set
// usernames, or by an admin writing as an official account may carry only the display name (or only the account id), so
// try, in order: the username, the account id, the official and founder names, then a display name only one member has.
// An empty username means "don't link": better than a link to /u that goes nowhere.
export function feedAuthorOf(n: Pick<Note, "author" | "author_avatar" | "author_role" | "authorUid" | "authorUsername">, users: UserProfile[]): FeedAuthor {
  const byName = users.filter((u) => u.displayName === n.author);
  const u =
    (n.authorUsername && users.find((x) => x.username === n.authorUsername)) ||
    (n.authorUid && users.find((x) => x.uid === n.authorUid)) ||
    undefined;
  const username =
    n.authorUsername || u?.username || resolveAuthorUsername(n.author) || (byName.length === 1 ? byName[0].username : "");
  const who = u || users.find((x) => x.username === username);
  return { avatar: who?.avatar || n.author_avatar, username, role: n.author_role || undefined, isOrg: who?.accountKind === "organisation" };
}
