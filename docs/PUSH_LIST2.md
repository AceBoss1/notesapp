# Push list

Finished work waiting for a pull request (owner's instruction, 19 Oct 2026). Every finished item has its own `push/<topic>` branch:
`main` plus that item only (or plus the item it builds on, named under "Needs"). Nothing opens a pull request until the owner asks;
a pull request then carries only the items the owner names, and only those are merged. Before any pull request, the branch is brought
onto the current `main` and checked again. This list lives on the working branch (`claude/brave-rubin-2us7bh`) and is never part of an
item's branch. Every release also updates Home, About, the desktop footer, the changelog, Status, the Roadmap, help articles, README and
HANDOVER.

| Item | Branch | What | Needs | Status |
|---|---|---|---|---|
| Paid courses wording | `push/courses-wording` | v0.57.1: the front pages and help say paid courses are live; the not-live lists hold only quizzes and the Enterprise packages | — | In PR #175 |
| Community & Events (coming soon) | `push/community-soon` | v0.57.2: `/community` (Spaces, General, Circles, members, Join live, giving later) and `/events`; `docs/COMMUNITY.md` with the owner's decisions and the approved giving charges; footer links | Paid courses wording (same lines) | In PR #175 |
| Calls: safety code and screen sharing | `push/call-safety-screen` (when finished) | A 12-digit code both people compare to prove a call is end to end encrypted; screen sharing in video calls on computers | — | In progress |
| Group calls | `push/group-calls` (when finished) | Free group calls from a group chat, phone to phone: up to 6 talking, 4 on video; Join card, heartbeat, a call line in the chat | Calls: safety code and screen sharing | In progress |

Merged (in the changelog, kept here for one round): v0.56.0 Shipments and v0.57.0 the logistics network (#174); v0.54.0 Paylony CardTap (#171).

Later, not started: provider API and webhooks on Enterprise; Nana suggesting delivery rates (waits for the AI work); Community phase 1.
