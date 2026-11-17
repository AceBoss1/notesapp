# 🎬 Notes Live Studio: automatic subtitles

What each speaker says, written on the programme a few seconds later, with their name, in one of the three looks from Moments.
The owner asked for it on 17 Nov 2026 ("can't we use this same audio AI transcription from Cloudflare with 3 different layouts for
the live studio video") and put it before Themes and kits. **Status: mockups drawn, waiting for the owner's approval. Nothing is built.**

## The mockups

All screens on one sheet: [all-screens.webp](mockups/studio-subtitles/all-screens.webp). HTML source: [mockups.html](mockups/studio-subtitles/mockups.html).

1. The editor's switch and look picker ([1-editors-panel](mockups/studio-subtitles/1-editors-panel.webp))
2. Clean ([2-clean](mockups/studio-subtitles/2-clean.webp))
3. Bold word ([3-bold-word](mockups/studio-subtitles/3-bold-word.webp))
4. Colour word, and two people at once ([4-colour-word-two-speakers](mockups/studio-subtitles/4-colour-word-two-speakers.webp))
5. Several speakers: who writes what ([5-several-speakers](mockups/studio-subtitles/5-several-speakers.webp))
6. On stage, and watching ([6-on-stage-and-watching](mockups/studio-subtitles/6-on-stage-and-watching.webp))

## Decisions for the owner

Each has a recommendation. The build follows it unless the owner says otherwise.

| Question | Recommendation |
|---|---|
| Who writes down a voice | **Each speaker's own device, from its own microphone.** No device hears two people, so voices are never mixed, and the name on a line is the account that sent it. |
| How far behind | **About 4 seconds.** The speech model works on finished pieces of sound, so each device sends a short piece every few seconds. |
| Who switches it on | **The editor** (the `studio` permission), in the Subtitles card. Each speaker is told and **can turn their own off**. |
| The three looks | The same as Moments. **Bold word and Colour word move through the line at an even pace**, because word-exact timing a few seconds behind isn't dependable. Clean is the default. |
| Two people at once | **Up to two lines**, each with its own name. A third voice waits. |
| Nobody checks them first | Subtitles go out unchecked. The editor can **clear the line, switch a speaker off, or type a line by hand** (which takes over). Each line passes the same word checks as chat before it is shown. |
| What is kept | **Nothing.** Only the sound is sent, it isn't kept, and lines aren't stored after they leave the screen. They aren't in the recording (graphics aren't either, today). |
| Cost and limits | Cloudflare's price as reported is about $0.0005 a minute per speaker. A cap per live (say 3 hours of speech per speaker) guards against a stuck microphone. Not measured. |
| Who gets it | Wherever the studio is open: today, lives on the staff test pass. |

## How it will work

- **On each speaker's device:** while subtitles are on and the microphone is live, the page takes the microphone's own track (not
  the room's mix), keeps a few seconds at a time, skips silence (the same loudness check as Moments' trim), and sends each piece to
  the caption route. Reuses `lib/moments-tidy-client.ts` (`wavOf`) and `lib/moments-captions-server.ts`.
- **To the room:** the words come back to that device, which posts them as a subtitle line for that speaker
  (`POST /api/community/rooms { action: "studio", op: "say" }`). The server checks the sender is on stage with subtitles on,
  cleans the line and puts it in the studio object with the sender's name. Lines expire by themselves a few seconds later.
- **Drawing:** `ProgramFrame` draws up to two lines in the chosen look. A line typed by the editor replaces them while it stands.
- **Viewers** can hide subtitles on their own screen (CC), remembered on the device like Moments.

## To settle before building

- **The speech service has still not been run against the real model** (see `docs/MOMENTS_TIDY.md`). The Moments test on staging
  comes first: it tells us whether the service works and how it copes with Nigerian English and Pidgin.
- **How the room carries fast, short-lived lines.** The studio object is written through a transaction on the room's document;
  a line every few seconds from several speakers may be too many writes. The alternative is the room's live channel (the chat's
  route on the live-rooms worker). To be decided when reading `lib/rooms-server.ts` for the build.

## Not in the first release

- Translation of subtitles.
- Subtitles in the recording or the replay.
- Subtitles in ordinary audio rooms and calls without the studio.

## The order after this

Owner, 17 Nov 2026: Live Studio subtitles, then Themes and kits, then Merch last.
