# Push list

Finished work waiting for a pull request (owner's instruction, 19 Oct 2026). Every finished item has its own `push/<topic>` branch:
`main` plus that item only (or plus the item it builds on, named under "Needs"). Nothing opens a pull request until the owner asks;
a pull request then carries only the items the owner names, and only those are merged. Before any pull request, the branch is brought
onto the current `main` and checked again. This list lives on the working branch (`claude/brave-rubin-2us7bh`) and is never part of an
item's branch. Every release also updates Home, About, the desktop footer, the changelog, Status, the Roadmap, help articles, README and
HANDOVER.

| Item | Branch | What | Needs | Status |
|---|---|---|---|---|
| Analytics (and the sites plan) | `push/analytics` | v0.62.0: My account → Analytics: earnings, orders and checkouts, average order, chart, best sellers, low stock, Sales/Orders/Products/Customers/Visits/Promotion; 7 days for all, 30/90 days + customers + download on Pro, visits by page and source on Business; organisation teammates. Plus `docs/SITES.md` (looks, kits, Community theme, the owner's decisions of 20 Oct 2026). Deploy: firestore rules + 4 indexes | — | Finished, waiting |

Merged (in the changelog, kept here for one round): v0.60.0 call safety code and screen sharing, v0.61.0 group calls (#177; deploy: `firebase deploy --only firestore` for the groupCalls rules and index); v0.57.3–v0.59.0 from the other session (#176); v0.57.1 and v0.57.2 (#175); v0.56.0 and v0.57.0 (#174).

Later, not started: provider API and webhooks on Enterprise; Nana suggesting delivery rates (waits for the AI work); Community phase 1.
