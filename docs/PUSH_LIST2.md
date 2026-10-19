# Push list

Finished work waiting for a pull request (owner's instruction, 19 Oct 2026). Every finished item has its own `push/<topic>` branch:
`main` plus that item only (or plus the item it builds on, named under "Needs"). Nothing opens a pull request until the owner asks;
a pull request then carries only the items the owner names, and only those are merged. This list lives on the working branch
(`claude/brave-rubin-2us7bh`) and is never part of an item's branch.

| Item | Branch | What | Needs | Status |
|---|---|---|---|---|
| Shipments | `push/shipments` | Shipments and a Track page for logistics businesses (v0.55.0): book shipments for your own customers, the services you offer, rider hand-off links, the Track section on Your site, the default picture on member sites | — | Finished, waiting |
| Logistics network | `push/logistics-network` | The logistics network (v0.56.0): providers list coverage (states), areas, services and a rate card; stores browse `/logistics/network`, message a provider and choose a delivery partner; buyers pay the partner's price at checkout and track on the store's own Track page; #NotesApp's commission only from the provider's delivery earnings (10%, at least ₦100); the logistics add-on for Free Basic and Pro (₦4,500 a month, 30-day trial without a card); item weights | Shipments (the branch includes it) | Finished, waiting |

Merged (in the changelog, kept here for one round): v0.54.0 Paylony CardTap (#171).

Later, not started: provider API and webhooks on Enterprise; Nana suggesting delivery rates (waits for the AI work).
