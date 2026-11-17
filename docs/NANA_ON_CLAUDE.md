# Nana on Claude

A page on claude.ai (an artifact the owner publishes and shares) where Nana answers questions about #NotesApp. Each visitor's
questions run on their own Claude plan: no API key of ours, and no cost to #NotesApp.

## What the page does

- **Chat.** Nana's own instructions (`lib/nana-prompt.ts`) and the matching help articles go with every question, as on the site.
  Links are checked the same way (`sanitizeLinks`). When Claude isn't available to a visitor, Nana answers from the help articles
  alone and offers **Open Nana on #NotesApp**.
- **Make my avatar.** Claude looks at a photo and writes a simple vector portrait; the page removes anything that isn't a plain
  shape, draws it and adds "Made with Nana AI". A cartoon, not a likeness. The real avatar maker is in the app (`docs/AVATAR_MAKER.md`).
- **Update help articles** (the page's owner and editors only): replaces the page's copy of the help centre from a file.

It cannot see anyone's #NotesApp account, and nobody on the team sees its chats.

## Keeping it up to date

The page can't read our site, so it holds a **copy** of the help centre. Admin → Help & Nana → **Nana on Claude**:

1. **Check for changes**: a dry run. Lists the articles that are new, changed or removed since the last copy, and whether Nana's
   instructions changed. Writes nothing. (`GET /api/admin/help?view=claude`, `lib/nana-claude-server.ts`.)
2. **Download a fresh copy**: saves `nana-on-claude-<date>.json` and remembers it as the last copy (`serverConfig/nanaClaudeCopy`).
   The copy is the help centre as it is now, with the prices and limits saved in Admin; team-only articles are left out.
3. On the Claude page, **Update help articles** → choose the file. The page checks it (`readCopy` in `lib/nana-claude.ts`), says
   what will change, and republishes itself when you confirm. Every open view reloads.

An admin button can't write to the page itself: only the page, signed in as its owner, or Claude can publish it.

## The page's source

`scripts/nana-on-claude/`: `page.html` (the page), `client.ts` (what it takes from `lib/`), `build.ts`:

    npx -y tsx scripts/nana-on-claude/build.ts <copy.json> <out.html>

Build it again only when `page.html` or the bundled `lib/` code changes, then publish the file on claude.ai as the same artifact,
with the capabilities `sample` (with images), `downloads` and `artifact`.

## Tests

`npm run test:nana-claude` (fingerprints, the comparison, the file check) and `npm run test:nana-claude-server` (the dry run, the
download, a price changed in Admin → Pricing showing as a change; Firestore emulator).
