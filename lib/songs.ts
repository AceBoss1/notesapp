// NotesApp Sounds (owner, 5 Nov 2026): songs members can put on a Media post or a moment, a host can play into a live, and Notes Life
// plays softly at the hotel (where the residents talk about them). Each song has its own page (/sounds/<id>) with everything made with it.
//
// Two kinds of song:
// - House songs (below): the owner's own songs, built into the site (files in public/songs/). Credited to the owner's profile.
// - Artist songs: uploaded by verified artists (Sounds → Are you an artist?), checked by the team, then everyone can use them. They live
//   in Firestore (`sounds/{id}`, lib/sounds-server.ts) with the files in our bucket.
// Artists earn a royalty in ad share: each month a share of the ad revenue (Admin → Sounds, the pool) is split over every song's plays.
//
// To add a house song: put the MP3 (128 kbps) and a square WebP cover in public/songs/, then add a line below. `hook` is where a moment or
// a post starts playing it (the catchiest part, in seconds). Keep `id` forever: posts, moments and play counts store it.
// `talk`: a few lines for the Notes Life residents to say about it (without them they use the general ones).

export type Song = {
  id: string; title: string; artist: string;
  ownerUsername: string; // whose profile the song credits (and whose analytics and royalties its plays count towards)
  src: string; cover: string;
  durationSec: number; hook: number;
  talk?: string[];
  house?: boolean; // built in (public/songs/); artist songs are uploaded
};

const OWNER = { artist: "Emmanuel Adams", ownerUsername: "emmanuel", house: true } as const;
const house = (id: string, title: string, durationSec: number, hook: number, talk?: string[]): Song =>
  ({ id, title, ...OWNER, src: `/songs/${id}.mp3`, cover: `/songs/${id}.webp`, durationSec, hook, ...(talk ? { talk } : {}) });

export const SONGS: Song[] = [
  house("leave-am", "Leave Am", 169, 74, [
    "Leave Am! Na my song be that. When people dey stress you, just leave am.",
    "Emmanuel Adams sing am well. I don put Leave Am for my moment.",
    "Anytime they play Leave Am for Candellux, I dey shake my head small.",
    "If wahala come your side, the answer dey inside the song: leave am!",
    "Leave Am don enter my head. I dey hum am since morning.",
  ]),
  house("nobody-clapped-until-i-won", "Nobody Clapped Until I Won", 183, 39, [
    "Nobody Clapped Until I Won. Na true talk! When I dey hustle, nobody send me.",
    "That song na for everybody wey dey grind quietly. Your time go reach.",
  ]),
  house("never-giving-up", "Never Giving Up", 356, 295, [
    "Never Giving Up! I play am every morning before I open my shop.",
    "When business slow, I remember that song. Never giving up!",
  ]),
  house("life-no-balance", "Life No Balance", 143, 68, [
    "Life No Balance… the song talk am well. Some days you up, some days you down.",
    "Emmanuel Adams talk say life no balance, but we go balance am ourselves!",
  ]),
  house("are-you-that-girl", "Are You That Girl", 174, 75, [
    "Are You That Girl… I dedicate am to my wife every evening.",
    "When that song play for the VIP bar, everybody dey look their partner.",
  ]),
  house("youre-all-ill-ever-need", "You're All I'll Ever Need", 186, 110, [
    "You're All I'll Ever Need. Na love song wey sweet pass jollof.",
  ]),
  house("my-spec", "My Spec", 155, 72, [
    "My Spec! If you see my spec, you go know am.",
  ]),
  house("onye-ose-photo", "Onye Ose Photo", 173, 138, [
    "Onye Ose Photo! The Igbo vibe for that song, e dey make me dance.",
  ]),
  house("onye-ose-photo-1st", "Onye Ose Photo (1st version)", 164, 128),
  house("highlife-beats-1", "Highlife Beats 1", 96, 11, [
    "These highlife beats remind me of my papa's old records.",
  ]),
  house("highlife-beats-2", "Highlife Beats 2", 34, 0),
];

// House songs only (the ones that are always there, with no network). For artist songs as well, ask the server (lib/sounds-client.ts).
export const SONG = (id: unknown): Song | undefined => (typeof id === "string" ? SONGS.find((s) => s.id === id) : undefined);
export const isSongId = (v: unknown): v is string => !!SONG(v);
export const songLabel = (s: Pick<Song, "title" | "artist">) => `${s.title} · ${s.artist}`;
export const soundPath = (id: string) => `/sounds/${encodeURIComponent(id)}`;
export const isSoundIdShape = (v: unknown): v is string => typeof v === "string" && /^[a-z0-9][a-z0-9-]{1,63}$/.test(v);

// Where a song is played, for the counts and the artist's analytics.
export const SOUND_SOURCES = ["media", "moment", "live", "life"] as const;
export type SoundSource = (typeof SOUND_SOURCES)[number];
export const SOUND_SOURCE_LABEL: Record<SoundSource, string> = { media: "Media posts", moment: "Moments", live: "Lives", life: "Notes Life" };
// What counts as one play: a member's first view of a post or a moment with the song, everyone listening when a host starts it in a
// live, and a player hearing it at the hotel (once a day per song).
export type PlayCounts = Record<SoundSource, number> & { total: number };
export const emptyPlays = (): PlayCounts => ({ media: 0, moment: 0, live: 0, life: 0, total: 0 });

// Artist songs: uploads and checks.
export const SOUND_MAX_BYTES = 15 * 1024 * 1024; // an MP3 up to 15 MB (about 15 minutes at 128 kbps)
export const SOUND_MAX_SECONDS = 15 * 60;
export const SOUND_TITLE_MAX = 80;
export const SOUND_TYPES: Record<string, "mp3" | "m4a"> = { "audio/mpeg": "mp3", "audio/mp3": "mp3", "audio/mp4": "m4a", "audio/x-m4a": "m4a" };
// What the first bytes say it is: MP3 (an ID3 tag, or an MPEG audio frame) or MP4 audio (an `ftyp` box).
export function sniffSong(b: Uint8Array): boolean {
  if (b.length < 12) return false;
  if (b[0] === 0x49 && b[1] === 0x44 && b[2] === 0x33) return true; // "ID3"
  if (b[0] === 0xff && (b[1] & 0xe0) === 0xe0) return true; // an MPEG frame sync
  return String.fromCharCode(b[4], b[5], b[6], b[7]) === "ftyp";
}
export type SongStatus = "pending" | "approved" | "rejected" | "removed";
export const SONG_STATUS_LABEL: Record<SongStatus, string> = { pending: "Waiting for review", approved: "Live: anyone can use it", rejected: "Not approved", removed: "Taken down" };

// Artists: who may upload. Verified by the team from the application (name, links to their music, and that they own the rights).
export type ArtistStatus = "pending" | "verified" | "rejected";
export type ArtistApplication = {
  uid: string; username: string; stageName: string; links: string[]; about: string; ownsRights: true;
  status: ArtistStatus; appliedAt: string; decidedAt?: string; note?: string;
};
export const ARTIST_LINKS_MAX = 5;

// Royalties (ad share): the default part of a month's ad revenue that goes to artists, split by plays. Admin → Sounds changes it.
export const SOUNDS_POOL_DEFAULT_PERCENT = 10;
export const ROYALTY_NOTE = "Each month a share of the ad revenue #NotesApp receives goes to artists, split by how many times each song was played. It's added to your ad share statement and paid with it.";

// What the residents of Notes Life say about the songs, when there's no line of the song's own.
export const SONG_TALK_GENERAL = [
  "You hear the song wey dey play? {song} by {artist}. E sweet die.",
  "{song}! Who no like this song? {artist} try.",
  "I first heard {song} for the hotel lobby. Now e dey my playlist.",
  "{artist} dey make better music. {song} na my favourite.",
];

// One line about a song, for a resident (the same seed says the same line on the same day, so it doesn't jump around).
export function songTalk(seed: string, day = new Date().toISOString().slice(0, 10), songId?: string): { song: Song; line: string } | null {
  if (!SONGS.length) return null;
  let h = 0;
  for (const ch of seed + day) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const song = SONG(songId) ?? SONGS[h % SONGS.length];
  const pool = [...(song.talk ?? []), ...SONG_TALK_GENERAL];
  const line = pool[(h >>> 4) % pool.length].replaceAll("{song}", song.title).replaceAll("{artist}", song.artist);
  return { song, line };
}
