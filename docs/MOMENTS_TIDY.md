# 🎬 Moments: tidy up and captions

Two helpers for video moments and voice-overs: **Trim the pauses** and **Captions** that show each word as it's spoken. Second in the
owner's order after Notes Planner (15 Nov 2026). **Status: built in v0.179.0 (16 Nov 2026)** from the approved mockups ("moments approved build"), **switched off** until
`NEXT_PUBLIC_MOMENT_TIDY_LIVE=true`. What was built, what changed and what still needs testing is at the end of this page.

The idea comes from Charlie Hills' article "5 things to build with Fable 5.2" (build 3, where one raw take is cut and every graphic
lands on its word). Only the idea is used. The article's full motion-graphics edit is left out: it takes several rounds per video and
costs too much to run for every member.

## The mockups

All screens on one sheet: [all-screens.webp](mockups/moments-tidy/all-screens.webp). HTML source: [mockups.html](mockups/moments-tidy/mockups.html).

1. In the composer: two switches, and what the trim saves ([1-in-the-composer](mockups/moments-tidy/1-in-the-composer.webp))
2. Check the trim on the sound wave ([2-check-the-trim](mockups/moments-tidy/2-check-the-trim.webp))
3. Check your captions, and choose a look ([3-check-your-captions](mockups/moments-tidy/3-check-your-captions.webp))
4. Watching: each word lights up; CC turns them off ([4-watching](mockups/moments-tidy/4-watching.webp))
5. Voice-overs too ([5-voice-overs](mockups/moments-tidy/5-voice-overs.webp))
6. Settings and limits ([6-settings-and-limits](mockups/moments-tidy/6-settings-and-limits.webp))

## Decisions for the owner

Each has a recommendation. The build follows it unless the owner says otherwise.

| Question | Recommendation |
|---|---|
| How the trim works | **Nothing is re-made.** A moment already plays one stretch of the uploaded video (`clipStart` to `clipEnd`). A trimmed moment keeps a list of stretches and the player skips the pauses between them. No new video processing, no extra storage, and the trim can be undone. |
| Where the trim runs | **On the member's device**, free, with no AI: the page reads the recording's sound and finds the silences. |
| What gets trimmed | **Silences only** in the first release. Taking out false starts and repeated lines needs the transcript and more judgement; it comes later, after captions prove reliable. |
| Who writes the captions | **Cloudflare's speech model (Whisper on Workers AI)**, since video, the live rooms and Nana Lite are already on Cloudflare. **To confirm before building:** that it returns a time for each word, and its price per minute. If it doesn't, the choice comes back to the owner. |
| Who gets captions | Every video moment and voice-over a plan already allows (2, 7, 14 or 30 video moments a week, 90 seconds each), so the cost has a ceiling. No separate caption limit. |
| Burnt in, or drawn by the player | **Drawn by the player.** They stay sharp, viewers can turn them off, and a wrong word can be fixed after sharing. |
| Languages | **English first.** Pidgin is offered but marked as less accurate. Yoruba, Igbo, Hausa and Kiswahili wait until they can be tested. |
| On by default | Both switches are **offered** on every video and remembered. Captions are never shared unseen: the check screen always comes first. |

## How it will work

- **Finding pauses.** The browser decodes the recording's sound and marks stretches quieter than speech for longer than the chosen
  length (¼, ½ or 1 second). A short margin is kept on each side so a word is never clipped. Very long files or unreadable sound
  skip the trim and say so.
- **Fewer moments.** The length after trimming decides how many moments a long video needs (`momentVideoParts`), so a 1:42 take
  trimmed to 1:21 is one moment, not two.
- **Captions.** Only the sound, made small on the device, goes to our server and on to the speech model. The words come back with
  their times. Nothing is kept except the caption the member approves, stored on the moment. Captions pass the same content checks
  as a moment's text (`docs/CONTENT_CHECKS.md`).
- **Editing.** Changing a word keeps its time. A line can be removed. Words the model was unsure of are underlined.
- **Playing.** The viewer draws the line and marks the current word. With a trim, caption times follow the skipped pauses. CC is
  remembered per viewer.
- **Voice-overs** (`components/moments/VoiceOverRecorder.tsx`) get both helpers. A moment with a song from NotesApp Sounds and no
  speech gets neither.
- **Teens** have the same helpers; their moments still go only to mutual follows.

## Risks to know about

- **Skipping on playback can stutter** on a slow connection, because the player has to jump ahead. If testing shows it does, the
  fallback is to trim only the start and end, or to re-make the video on the server (more cost and time).
- **Captions will make mistakes**, most of all with names, Pidgin and background noise. The check screen is the answer to that.
- **Cost isn't measured.** It is bounded by the weekly video moments, and measured on staging before release.

## Build order (after approval)

1. Confirm the speech model gives word times and its price. Report back if not.
2. `lib/moments-tidy.ts` (pure, tested): silences from sound levels, the stretches to play, length after trimming, caption lines from
   timed words, caption times after a trim, the checks on what is stored.
3. Server: the caption route (sound in, timed words out, rate limits, nothing kept), captions and stretches on a moment. Tests.
4. The composer's switches, the trim screen, the caption screen.
5. The viewer: skipping pauses, drawing captions, CC.
6. Voice-overs, settings, teens.
7. Phone and desktop screenshots from the real code. Then the help article, changelog and public pages.

## Not in the first release

- Removing false starts and repeated lines.
- Graphics that act out what is said.
- Captions on Media posts, lives and replays (the same parts could serve them later).
- Translating captions.

## Built in v0.179.0

- **Rules** `lib/moments-tidy.ts` (pure, tested): pauses from loudness, the stretches that play, long recordings as several
  moments, what the server keeps, where the player should be, caption lines, the word being said, corrections, the speech answer.
- **On the device** `lib/moments-tidy-client.ts`: reads the sound, makes the small WAV pieces, sends them, remembers her choices.
- **Server:** `spans`, `audioSpans` and `captions` on a moment (`lib/moments-server.ts`); `playSec` on `/api/video`; the caption
  route `/api/moments/captions` and `lib/moments-captions-server.ts`; the owner's "Remove captions".
- **Screens:** `components/moments/TidyPanel.tsx` in the composer (one for the video, one for a voice-over),
  `CaptionOverlay.tsx` and the CC button in the viewer, and the choices on Profile → Edit profile.
- **Screenshot from the real code** (a test video of tone bursts and silences): [built-phone.webp](mockups/moments-tidy/built-phone.webp).

## Changed from the mockups

- **One panel in the composer**, not separate screens: "Check the trim" and the captions open in place.
- **Captions are written when she taps "Write captions"**, not by a switch, so nothing is sent until she asks.
- **Settings are remembered on the device**, not on the account.
- **With a voice-over on a video**, captions are of the voice-over, since that is what is heard.
- **After sharing, captions can be removed, not edited.**

## Still to test before switching on

These could not be tested where this was built:

1. **Skipping pauses in Cloudflare Stream's player.** Verified on a plain video and on voice-overs only. On Stream it relies on
   Stream's player SDK. If it doesn't skip, the video plays its pauses and still ends in the right place.
2. **The real speech model:** its answer's shape, its accuracy on Nigerian English and Pidgin, and its cost.
3. **Phones:** reading the sound of a large video uses memory; files over 300 MB are not tidied.
