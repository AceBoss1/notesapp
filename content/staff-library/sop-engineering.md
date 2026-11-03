# SOP: Engineering

**Purpose:** build and ship the platform safely: every change measured, secured, documented and reversible. **Owner:** the CTO (today the founder) or the Engineering team lead. Engineering is a department of its own; it works side by side with Product & tech, which decides what we build and why. Read the Engineering Guide (docs/ENGINEERING\_GUIDE.md) and HANDOVER.md in your first week; this SOP is the day-to-day version of both.

## Routines

- **Daily:** your tasks on the work board; errors and the status page; the push list of finished work waiting for a pull request.
- **Weekly:** the dashboard card "When to grow the infrastructure" (the five numbers that start each stage); dependency and security updates.
- **Monthly:** rotate any key that's due; review who has access to Vercel, GitHub, Google Cloud, Firebase, Cloudflare, Paystack and Paylony.
- **Quarterly:** a restore drill from backups, with Legal for the breach plan.

## Procedures

### From task to merged change

1. Work on a branch named push/\<what it is>, one finished item per branch. The push list (docs/PUSH\_LIST1.md and/or docs/PUSH\_LIST2.md) gets a row.
2. No pull request until the owner asks. When asked to "open the PR and merge": bring the branch onto the current main, start the Firestore emulator, clear .next, run next build with the emulator settings, and confirm "Compiled successfully" and the middleware line; then open the PR, squash-merge it, and reset the branch to main.
3. Commits and pull requests are authored as the owner asks (HANDOVER §3): no AI or tool names, model names or session links anywhere.
4. Run the checks: npx tsc --noEmit, and the npm run test:\* scripts for what you touched. Add tests where there's server logic.

### What ships with every change

- A changelog entry (Added, Changed or Fixed, with a version bump) and a build-log entry.
- The help article, the public pages that describe the area (home, About, pricing, the feature's page, roadmap, status, footer), README and HANDOVER, in the same push.
- Settings only through lib/config.ts, never read straight from the environment; links to our sites through lib/host.ts, never a written-in domain.
- Major UI: phone and desktop screenshots from the real code for approval before it ships. Notes Life features: mockups first.

### Data changes and deploys

1. Firestore rules deploy only from CI after the rules tests pass.
2. A backfill needs a ticked backup and its dry-run plan; it keeps before-images and can be undone from Admin → Maintenance.
3. Anything the owner must do outside the code (keys, plans, consoles) goes in docs/OWNER\_SETUP.md and on the work board.

### An incident

1. Confirm it on the status page and the error log; post in the team hub to Engineering and Customer care.
2. Fix forward or roll back, whichever is faster and safe; every change can be undone.
3. Update the status page while it's open and when it's resolved.
4. Within 2 working days, a short write-up: what happened, why, and what stops it happening again. If member data was involved, Legal is told within the hour.

### Security

- Security keys (passkeys) on every account that touches production; never share a login.
- Secrets only in the hosting settings, marked sensitive; never in code, chats or screenshots. Gitleaks runs on every change.
- Staff access is removed the day someone leaves.

## Measures

- Pages and the feed under 1 second at the 95th percentile.
- Incidents with a write-up within 2 working days (target: all).
- Releases with their changelog, help and public pages in the same push (target: all).

## When to escalate

- A number on the infrastructure card crosses its line: to the CTO, to start the next stage.
- Any suspected breach or leaked secret: the CTO and Legal, at once.
