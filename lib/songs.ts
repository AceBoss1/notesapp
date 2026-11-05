// NotesApp Sounds: the owner's own songs, built into the site (owner, 5 Nov 2026). Members can put one on a Media post or a moment, a
// host can play one during a live, and Notes Life plays them softly at the hotel (where the residents talk about them).
// They are the owner's own recordings, so no licence is needed. Everything else stays "Original sound" (lib/media-rules.ts).
//
// To add a song: put the MP3 (128 kbps is plenty) and a square WebP cover in public/songs/, then add a line below. `hook` is where a
// moment or a post starts playing it (the catchiest part, in seconds). Keep `id` forever: posts and moments store it.
// A song can also carry a few lines for the Notes Life residents to say about it (`talk`); without them they use the general ones.

export type Song = {
  id: string; title: string; artist: string;
  src: string; cover: string;
  durationSec: number; hook: number;
  talk?: string[];
};

export const SONGS: Song[] = [
  {
    id: "leave-am", title: "Leave Am", artist: "Emmanuel Adams",
    src: "/songs/leave-am.mp3", cover: "/songs/leave-am.webp", durationSec: 169, hook: 74,
    talk: [
      "Leave Am! Na my song be that. When people dey stress you, just leave am.",
      "Emmanuel Adams sing am well. I don put Leave Am for my moment.",
      "Anytime they play Leave Am for Candellux, I dey shake my head small.",
      "If wahala come your side, the answer dey inside the song: leave am!",
      "Leave Am don enter my head. I dey hum am since morning.",
    ],
  },
];

export const SONG = (id: unknown): Song | undefined => (typeof id === "string" ? SONGS.find((s) => s.id === id) : undefined);
export const isSongId = (v: unknown): v is string => !!SONG(v);
export const songLabel = (s: Song) => `${s.title} · ${s.artist}`;

// What the residents of Notes Life say about the songs, when there's no line of the song's own.
export const SONG_TALK_GENERAL = [
  "You hear the song wey dey play? {song} by {artist}. E sweet die.",
  "{song}! Who no like this song? {artist} try.",
  "I first heard {song} for the hotel lobby. Now e dey my playlist.",
  "{artist} dey make better music. {song} na my favourite.",
];

// One line about a song, for a resident (the same resident says the same line on the same day, so it doesn't jump around).
export function songTalk(seed: string, day = new Date().toISOString().slice(0, 10)): { song: Song; line: string } | null {
  if (!SONGS.length) return null;
  let h = 0;
  for (const ch of seed + day) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const song = SONGS[h % SONGS.length];
  const pool = [...(song.talk ?? []), ...SONG_TALK_GENERAL];
  const line = pool[(h >>> 4) % pool.length].replaceAll("{song}", song.title).replaceAll("{artist}", song.artist);
  return { song, line };
}
