# Push list

Finished work waiting for a pull request (owner's instruction, 19 Oct 2026). Every finished item has its own `push/<topic>` branch:
`main` plus that item only (or plus the item it builds on, named under "Needs"). Nothing opens a pull request until the owner asks;
a pull request then carries only the items the owner names, and only those are merged. Before any pull request, the branch is brought
onto the current `main` and checked again. This list lives on the working branch (`claude/brave-rubin-2us7bh`) and is never part of an
item's branch. Every release also updates Home, About, the desktop footer, the changelog, Status, the Roadmap, help articles, README and
HANDOVER.

| Item | Branch | What | Needs | Status |
|---|---|---|---|---|

Merged (in the changelog, kept here for one round): v0.77.0–v0.78.0 (#186: eleven kits redone with menus in tabs, industry FAQs and Best-for lines, lazy site images; community inside the member's site and domain at /community with a step-3 switch; nothing to deploy); v0.76.0 (#185: shop links from subcategories, else item badges; Notes topic links; /community/events; nothing to deploy); v0.75.0 (#184: audio rooms with live chat, group-style feed, own pages for General/Spaces/Circles/Audio rooms, 12 help articles, Churches and NGOs kit opens Community, leaving a community leaves its Circles; deploy: `firebase deploy --only firestore` for rooms, links and chat rules + 2 indexes, HANDOVER 37); v0.72.0–v0.74.0 (#183: courses on sites, storefront and basket, WebP, Beauty and wellness kit, Luxe look, Community and Events; deploy: `firebase deploy --only firestore` for the Community rules and 2 indexes); v0.63.0–v0.70.0 (#181: picture menu and CardTap diagnostics from the other session; analytics, sites for every plan with kits, Clean and Scholar, imports and more kits, free trials, inventory; deploy: `firebase deploy --only firestore`, HANDOVER 27–33); v0.61.3–v0.62.2 from the other session (#180; analytics and sites renumbered after it); v0.60.0 call safety code and screen sharing, v0.61.0 group calls (#177; deploy: `firebase deploy --only firestore` for the groupCalls rules and index); v0.57.3–v0.59.0 from the other session (#176); v0.57.1 and v0.57.2 (#175); v0.56.0 and v0.57.0 (#174).

Later, not started: provider API and webhooks on Enterprise; Nana suggesting delivery rates (waits for the AI work); Cloudflare relay for audio rooms past 20 listeners (keys first); fixing the other kits' looks (on hold until the owner says; Beauty and wellness done); per-service booking for beauty (owner: not yet).
