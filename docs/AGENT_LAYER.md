# The agent layer, phase 1 (v0.123.0)

Nana as an operator who prepares the routine work and asks before anything that matters, and any outside AI assistant (Claude, ChatGPT,
others) working on a member's account with their permission through the NotesApp MCP server. Money never moves through an agent.

The scope is the staff library entry "Agent layer scope" (`lib/team-seed.ts` `AGENT_SCOPE_DOC`) and the board items in
`AGENT_LAYER_BACKLOG`. This document is what phase 1 built, the decisions behind it, and how to deploy it.

## Decisions (owner, 2 Nov 2026)

| Decision | Where it lives |
| --- | --- |
| Nana's operator (jobs and drafts) is for Business and Enterprise. Lower plans see a friendly upsell, never an error. | Plan flag `nanaOperator` in Admin → Limits (`lib/limits.ts`), default Business and Enterprise. |
| Requests from outside agents land in Nana's inbox, on every plan that may connect one. | Plan flag `agentConnect` (default all plans). |
| Nana's inbox is pinned in Messages under Nana's conversation, with Needs you / Done by Nana / Jobs, plus a direct route. | `/messages/nana/inbox`, `/nana/inbox` |
| Publishing and price changes always ask first and can't be switched off. | `lib/agents/scopes.ts` `decide()`, `cleanGrant()` |
| Money-moving actions are never allowed for any agent, Nana included; agents spend ₦0. | `decide()` refuses anything money-like; no money tool exists; proposals of kind `money` can't be approved. `AGENT_SPEND_KOBO = 0`. |
| Connect defaults: 90-day access, 100 actions a day (reset midnight Lagos), ₦2,000 discount cap, earnings and messages off. | Admin → Limits → "Nana and connected agents" (`lib/agents/config.ts`) |
| Undo: 2 minutes for a sent reply, 24 hours for Nana's automatic actions. Drafts expire after 48 hours. | Same settings |
| Console becomes tabbed with Connected agents. | `/console?tab=agents` |
| Activity log kept 12 months, storing what was asked, not content. | `agentActions`, `expireAt`; `lib/mcp/log.ts` `redactArgs` |
| No domain written in anywhere: the MCP address, Connect and link pages, emails follow the domain being viewed. | `lib/host.ts` `mcpOrigin`/`mcpServerUrl`, `lib/agents/urls.ts`; `tests/agents/domains.test.ts` |

Decisions made while building (please confirm or change):

- **Nana's jobs start switched off.** A Business member turns them on once in Nana's inbox ("Switch on"); the five jobs then start as the
  mockup shows (all on, confirmations going without asking). Nothing is sent for anyone who never opted in.
- **Booking confirmations** that "go without asking" are a thank-you message to someone who has already booked and paid, never a
  reply to a request. Replies to requests always wait for the member unless they choose otherwise.
- **Journal drafts from voice notes**: phase 1 takes the member's notes or a voice note's words pasted into Nana's inbox. Turning a
  voice note into words automatically is phase 2.
- **Standard (reader) accounts may connect an assistant** (`agentConnect` on for every plan): they have nothing to write, but an
  assistant can read their profile. Switch it off for Standard in Admin → Limits if that's not wanted.
- **An account tool called with no credential answers HTTP 401** with the OAuth discovery header (the MCP authorization spec), so an
  assistant that supports OAuth starts the Connect screen by itself. Anonymous reading tools keep working as before.
- **The pairing code is shown on every connect request**, OAuth ones too, so the member can check it matches what the assistant
  shows. The device flow (no browser on the assistant's side) is also an MCP tool, `connect_account`.
- **No refresh tokens.** A token lasts as long as the member chose (90 days by default); then the assistant connects again.
- **The activity log keeps titles and names** (`Asked to publish "Five questions…"`), never bodies: any `content`, `text`, `message`,
  `draft`, `description` argument is stored as its length.

## How it works

### Plans and settings
- `lib/limits.ts`: `nanaOperator` (flag), `nanaJobsPerDay` (job runs a day per member: Business 60, Enterprise 200), `agentConnect`
  (flag). Admin → Limits shows flags as tick boxes.
- `lib/agents/config.ts`: every number above plus link-code lifetime (10 min), shipping nudge (3 days), the summary's day and hour
  (Monday 07:00 Lagos), events per run. Saved in `serverConfig/agents`, cached 30 s.

### Connect NotesApp (outside assistants)
- OAuth 2.1, public clients, PKCE S256 only: discovery at `/.well-known/oauth-authorization-server` and
  `/.well-known/oauth-protected-resource` on every host (middleware rewrites them to `/api/agents/oauth/metadata`); registration
  `/api/agents/oauth/register`; authorization endpoint `https://mcp.<root>/connect`; token `/api/agents/oauth/token`; device
  authorization `/api/agents/oauth/device`. The issuer is the mcp. address of the family the request came to.
- `lib/agents/grants-server.ts`: `agentClients`, `agentAuthRequests` (10 minutes), `agentCodes/{CODE}` (8 characters without
  look-alikes, one live request per code), `agentGrants` (scopes, ask-first rules, limits, expiry, status, the token's SHA-256 only),
  `agentUsage/{grant}_{day}` (a transaction per call). Connecting the same assistant again replaces its earlier grant.
- The Connect screen (`app/connect`, `components/agents/ConnectNotesApp.tsx`) and `/link` (type a code) sit outside the site frame
  and are served on the mcp. address too (middleware), together with `/login` and `/signup`.
- The MCP server (`app/api/mcp/route.ts`) accepts `naa_` tokens beside API keys. Every call: token, plan, pause, `decide()` (scopes,
  abilities, money), today's limit, then the tool. Reading tools run through the `/api/v1` handlers marked internally
  (`AGENT_CALL` in `lib/api-keys.ts`), so agent tokens never work on the REST API directly. Changing tools (`lib/agents/catalog.ts`,
  `lib/agents/agent-tools-server.ts`): `create_draft`, `publish_post`, `reply_booking`, `update_store_item`, `mark_shipped`, plus
  `my_messages` (off by default) and `connect_account`.

### Proposals and Nana's inbox
- `agentProposals` (`lib/agents/proposals-server.ts`): id = hash(member, idempotency key), so a repeated job or retried agent call is
  one item. Approve (claimed in a transaction, then executed by `lib/agents/execute-server.ts` through the same code the member's own
  buttons use), edit, decline, dismiss, undo (inside its window), expiry. Each decision updates the log entry that asked.
- Executing: replies are messages from the member (`sendMessage`); undo deletes them (once read, the reader is asked, as for any
  message). Drafts are saved as drafts, never published. Publishing sets the journal live; undo puts it back to draft. Store edits keep
  the old values for undo. Marking shipped uses `dispatchWithCourier` (moved out of the orders route) and can't be undone.
- Prompt-injection safety: the job is decided in code before the AI sees anything (`classifyMessage`); the AI has no tools; the
  customer's words go in a `<member_text>` block the instructions call data (`memberText`, `MEMBER_TEXT_RULE`), with the closing
  marker stripped from their text; the UI labels them "Written by a member".

### Nana's jobs
- `app/api/cron/agents` runs `lib/agents/jobs-server.ts` `runAgentJobs`: expire, queued message events (`agentEvents`, queued by
  `sendMessage` for the first message of a burst to a member with the operator on), paid bookings of the last two days, orders paid
  N days ago and still unshipped, the Monday summary. Per-member runs are counted in `nanaOps/{uid}.jobsDay` against
  `nanaJobsPerDay`. Drafting (`lib/agents/drafts.ts`) uses the member's own AI account first, then ours metered from their Nana
  allowance (`lib/nana-meter.ts`), and falls back to a plain template.
- Voice ("Writes like you", `lib/agents/voice.ts`): counted from the member's own sent messages and journals, never anyone else's;
  editable; learnt again on request.
- Notifications: a `nana` bell and a push when something needs the member, and for the weekly summary.

### Console → Connected agents
`/api/console/agents` and `components/agents/ConnectedAgents.tsx`: stats, the MCP address for the domain being viewed, each assistant
(status, scope chips, 7-day sparkline, renew when access ends soon), Edit permissions, Pause/Resume, Disconnect (dismisses its waiting
requests), Nana's card with Pause all jobs, the activity log with filters and a CSV (formula-safe cells).

## Deploy steps
1. `firebase deploy --only firestore` (rules for the new server-only collections and three composite indexes:
   `agentProposals` uid+createdAt and status+expiresAt, `agentActions` uid+at).
2. Firestore TTL policies (Google Cloud console → Firestore → Time-to-live): `agentActions.expireAt` (already listed for phase 1),
   `agentProposals.purgeAt`, `agentUsage.expireAt`, `agentEvents.expireAt`.
3. Scheduled run: add a cron-job.org job `GET https://www.<root>/api/cron/agents` every 15 minutes with `Authorization: Bearer
   $CRON_SECRET` (same as the reminders job). `vercel.json` also runs it daily at 06:05 UTC (07:05 Lagos) through Vercel Cron, which
   sends the secret by itself.
4. Firebase → Authentication → Authorised domains: add `mcp.<root>` for each domain family we serve (sign-in on the Connect screen).
5. No new environment variables. Nana's drafting uses `ANTHROPIC_API_KEY` as before.
6. Admin → Limits: check the "Nana and connected agents" rows.

## Phase 2
- Voice notes turned into words automatically for journal drafts; availability, restock and pricing jobs; standing permissions in Nana.
- Discount codes created by an agent within its cap (phase 1 only checks a mentioned discount against the cap).
- Message drafting for group conversations; a reply suggestion inside the conversation itself.
- Security review (`agent-security-review`) and the legal wording (`agent-legal`) before the pilot; listing in agent directories.
- Refresh tokens, if pilot assistants ask for them.
