# 🧭 Nana Jobs: your own AI, a daily shortlist

A new tab in `/jobs`. A member connects their own AI. Nana then collects openings from Notes Jobs and public job boards, cuts the ones
that don't fit, scores the rest against what the member has actually done, and gives a short ranked list. Each job comes with why it
fits and the strongest reason they might not get it. **It finds and ranks. It never applies on anyone's behalf.** The owner asked for it
on 12 Nov 2026, adopting Shortlist (github.com/vicintel/shortlist-engine). **Status: mockups awaiting the owner's approval. Nothing has
been built yet.**

Shortlist is MIT-licensed (© 2026 Victor Dickson), so its approach and code may be adapted. Any file that takes code from it keeps the
MIT notice in a header comment and in `THIRD_PARTY_NOTICES`.

## The mockups

All screens on one sheet: [all-screens.webp](mockups/nana-jobs/all-screens.webp). HTML source: [mockups.html](mockups/nana-jobs/mockups.html).

1. /jobs → Nana Jobs, set up in four steps ([1-jobs-tab](mockups/nana-jobs/1-jobs-tab.webp))
2. Connect your AI: Gemini (free), Groq (free), Claude, OpenAI-compatible ([2-connect-ai](mockups/nana-jobs/2-connect-ai.webp))
3. Your scoring profile ([3-scoring-profile](mockups/nana-jobs/3-scoring-profile.webp))
4. Where to look ([4-sources](mockups/nana-jobs/4-sources.webp))
5. Today's shortlist ([5-shortlist](mockups/nana-jobs/5-shortlist.webp))
6. Daily run and alerts ([6-daily-run](mockups/nana-jobs/6-daily-run.webp))

## How it will work

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
  - Openings are collected **once a day for everyone** into a shared cache (`jobPool/{hash}`), so each board is asked once, not once
    per member.
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
- **Private.** The scoring profile (`nanaJobsProfiles/{uid}`) and results (`nanaJobsRuns/{uid}`) are server-only and never shown to
  firms. Firms still see only what the member chooses to share in "I need a job".
- **Alerts.** A daily run at the member's chosen time, plus on demand. Bell on and email off by default. The number of jobs read by AI
  each day is the member's own setting.
- **Cover note.** Nana writes from the "shipped" list only, so it never claims experience the member doesn't have.

## Build order (after approval)

1. Multi-provider AI connect, with tests for each provider's check and the pacing.
2. Sources, shared pool, filters and prescore (pure, tested with Shortlist's fixtures adapted), then the scorer and the verifier.
3. The `/jobs` tab, setup, shortlist and statuses, the daily run, and bells and email.
4. Public page, help article, changelog, HANDOVER and BUILD_LOG.
