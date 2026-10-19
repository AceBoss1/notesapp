# Push list

Finished work waiting for a pull request (owner's instruction, 19 Oct 2026). Every finished item has its own `push/<topic>` branch:
`main` plus that item only (or plus the item it builds on, named under "Needs"). Nothing opens a pull request until the owner asks;
a pull request then carries only the items the owner names, and only those are merged. Before any pull request, the branch is brought
onto the current `main` and checked again. This list lives on the working branch (`claude/brave-rubin-2us7bh`) and is never part of an
item's branch. Every release also updates Home, About, the desktop footer, the changelog, Status, the Roadmap, help articles, README and
HANDOVER.

| Item | Branch | What | Needs | Status |
|---|---|---|---|---|
| Calls: safety code and screen sharing | `push/call-safety-screen` | v0.58.0: a 12-digit code both people compare to prove a call is end-to-end encrypted (checked in real Chromium); screen sharing in video calls on computers | — | Finished, waiting |
| Group calls | `push/group-calls` | v0.59.0: free group calls from a group chat, phone to phone: up to 6 talking, 4 on video; Join card and notification, Join call in the chat, heartbeat, a call line; safety code per person (three-person call checked in real Chromium). Deploy: firestore rules + index | Calls: safety code and screen sharing (the branch includes it) | Finished, waiting |

Merged (in the changelog, kept here for one round): v0.57.1 paid courses wording and v0.57.2 Community & Events coming soon (#175); v0.56.0 Shipments and v0.57.0 the logistics network (#174).

Later, not started: provider API and webhooks on Enterprise; Nana suggesting delivery rates (waits for the AI work); Community phase 1.
