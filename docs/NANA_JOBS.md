# 🧭 Nana Jobs: your own AI, a daily shortlist

A new tab in `/jobs`. A member connects their own AI. Nana then collects openings from Notes Jobs and public job boards, cuts the ones
that don't fit, scores the rest against what the member has actually done, and gives a short ranked list. Each job comes with why it
fits and the strongest reason they might not get it. **It finds and ranks. It never applies on anyone's behalf.** The owner asked for it
on 12 Nov 2026, adopting Shortlist (github.com/vicintel/shortlist-engine). **Status: built in v0.162.0** (mockups approved 12 Nov 2026,
with the CV review added by the owner when approving).

Shortlist is MIT-licensed (© 2026 Victor Dickson), so its approach and code may be adapted. Any file that takes code from it keeps the
MIT notice in a header comment and in `THIRD_PARTY_NOTICES`.

## The mockups

All screens on one sheet: [all-screens.webp](mockups/nana-jobs/all-screens.webp). HTML source: [mockups.html](mockups/nana-jobs/mockups.html).

1. /jobs → Nana Jobs, set up in four steps ([1-jobs-tab](mockups/nana-jobs/1-jobs-tab.webp))
2. Connect your AI: Gemini (free), Groq (free), Claude, OpenAI-compatible ([2-connect-ai](mockups/nana-jobs/2-connect-ai.webp))
7. Start from your CV, the owner's addition: upload or paste it, the AI's review, roles that fit and a profile to start from
   ([2b-cv-review](mockups/nana-jobs/2b-cv-review.webp), a screenshot of the real page; it sits between screens 2 and 3)
3. Your scoring profile ([3-scoring-profile](mockups/nana-jobs/3-scoring-profile.webp))
4. Where to look ([4-sources](mockups/nana-jobs/4-sources.webp))
5. Today's shortlist ([5-shortlist](mockups/nana-jobs/5-shortlist.webp))
6. Daily run and alerts ([6-daily-run](mockups/nana-jobs/6-daily-run.webp))

## How it works

- **Who.** Members 18 and up. Teens keep the normal job board. Free on every plan, because the member's own AI pays for the scoring.
  Without an AI connected they get the free keyword ranking, marked "~ rough".
- **Bring your own AI.** `lib/ai-connect.ts` today holds one Anthropic key per member, encrypted with `ACCOUNT_DATA_KEY`. It grows to
  several providers: `gemini`, `groq`, `anthropic`, and `openai` (any OpenAI-compatible base URL, such as OpenRouter or a reachable
  Ollama). Each is checked with a free call, only the last 4 characters are ever shown, and a paid provider is never chosen unless the
  member picks it. Requests to free tiers are paced to stay inside their rate limits.
- **Sources.**
  - Notes Jobs: always on, with the Apply on #NotesApp button kept.
  - Feeds: RemoteOK, Remotive, Himalayas and Arbeitnow.
  - Company boards: Greenhouse, Lever and Ashby public APIs, for companies the member adds. A board is checked before it's added.
  - Openings are collected **once a day for everyone** into a shared pool, so each board is asked once, not once per member. Each
    opening keeps its hash (company + title + location), but the pool is stored ~100 openings to a document (`jobPool/{day}-{n}`,
    with `nanaJobsMeta/pool` saying which day is current), so a member's run reads a handful of documents rather than thousands.
  - No LinkedIn or Indeed scraping. Forwarding LinkedIn alert emails to a personal Nana Jobs address is phase 2, once inbound email exists.
- **The funnel (from Shortlist).**
  1. Collect.
  2. Remove duplicates.
  3. Hard filters, free: freshness, title gate, deal-breakers, location eligibility including "remote, but only from X".
  4. Keyword prescore, free.
  5. AI rubric on the top N: domain 25, stack 25, seniority 15, location 20, signal 15, plus a reason and the strongest risk.
  6. Verify links: open each page and check that the job is still there. It fails open, so a timeout never hides a job.
  7. Store the list with its status (Interested, Applied, Not for me), and never overwrite a status the member set.
  8. Digest.
- **When an AI fails.** The list falls back to the prescore and shows the provider's real error. It is never quietly empty.
- **Private.** The scoring profile (`nanaJobsProfiles/{uid}`), results (`nanaJobsRuns/{uid}`), statuses (`nanaJobsStatuses/{uid}`) and
  CV (`nanaJobsCv/{uid}`) are server-only and never shown to firms. Firms still see only what the member chooses to share in "I need a job".
- **Alerts.** A daily run at the member's chosen time, plus on demand. Bell on and email off by default. The number of jobs read by AI
  each day is the member's own setting.
- **Cover note.** Nana writes from the "shipped" list only, so it never claims experience the member doesn't have.

## CV review

Added by the owner when approving (12 Nov 2026): "can the Nana jobs ask for cv, review it with connected ai then have something to start
with". Step 2 of the set-up starts with the CV, right after Connect your AI.

- **In.** Upload a PDF or a Word .docx, or paste the text. The browser reads the file and sends only the text: PDFs with `pdfjs-dist`
  (already used by the PDF viewer and the books import), .docx by unzipping `word/document.xml` with the browser's own
  `DecompressionStream` (`lib/cv-extract.ts`). No new package.
- **Kept.** The text is encrypted with `ACCOUNT_DATA_KEY` (AES-256-GCM, as the AI keys) in `nanaJobsCv/{uid}`, server-only. The review is
  encrypted beside it. **Delete my CV** removes both at once.
- **Reviewed by the member's own AI** (the same choice as the scoring: a free one if connected, a paid one only if chosen). It returns:
  a short honest review (what's strong, the gaps, quick fixes to the CV), the roles that fit, and a pre-filled scoring profile (roles,
  a "shipped" list, skills, cities and country, remote or not, level).
- **"Shipped" only from the CV.** Every suggested shipped line is checked against the CV text: most of its distinctive words, and every
  figure in it, must be in the CV, or it is dropped and the member is told how many were left out (`inCv` in `lib/nana-jobs-funnel.ts`).
- **Confirmed by the member.** "Use this to fill in my profile" merges it into the scoring profile, which they then edit and save. No AI
  connected yet: the CV is kept and reviewed once they connect one. They can also skip the CV and fill in the profile themselves.

## Where the code is (v0.162.0)

`lib/ai-providers.ts` (calling Gemini, Groq, Anthropic and OpenAI-compatible APIs, key checks, pacing), `lib/ai-connect.ts` (the keys),
`lib/nana-jobs.ts` (shapes and rules), `lib/nana-jobs-funnel.ts` (the funnel, link check, CV and cover-note guards),
`lib/nana-jobs-sources.ts` (feeds and company boards), `lib/nana-jobs-server.ts` (Firestore, the pool, runs, the daily run),
`lib/cv-extract.ts`, `app/api/jobs/nana/*`, `app/api/cron/nana-jobs` (daily pool, `vercel.json`) and the `nanaJobs` job in
`app/api/cron/reminders`, `components/jobs/NanaJobs.tsx`, `components/jobs/JobsSubTabs.tsx`, pages `/jobs/nana` and `/nana-jobs`.
Tests: `npm run test:nana-jobs` and `npm run test:nana-jobs-server`. Files that adapt Shortlist keep its MIT notice; the full notice is in
`THIRD_PARTY_NOTICES`.

## Build order (done in v0.162.0)

1. Multi-provider AI connect, with tests for each provider's check and the pacing.
2. Sources, shared pool, filters and prescore (pure, tested with Shortlist's fixtures adapted), then the scorer and the verifier.
3. The `/jobs` tab, setup, shortlist and statuses, the daily run, and bells and email.
4. Public page, help article, changelog, HANDOVER and BUILD_LOG.
