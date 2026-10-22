// The brand guidelines on /brand (Introduction, General guidelines, the logo pack, Prohibited uses, FAQ, Legal). Kept here as plain
// text so scripts/brand-pack.mjs can put the same words in the logo pack's GUIDELINES.txt.
export const BRAND_OWNER = "NOTESAPP TECHNOLOGIES LTD";
export const BRAND_PACK = { file: "/brand/notesapp-logo-pack.zip", version: "2026-10" };

export const BRAND_INTRO = [
  "#NotesApp is more than a name: it's where Africa publishes, books and gets paid. The name, the red “na” mark and our product names carry that promise, so we ask everyone who uses them to use them the same way.",
  "Members, partners, press and developers are welcome to use the files on this page to point people to NotesApp. Using them means you agree to these guidelines, which set out what's allowed, what isn't, the legal notes and the questions we're asked most.",
];

export const BRAND_GENERAL: { t: string; d: string }[] = [
  { t: "Use our files", d: "Use only the name and marks from this page or the logo pack, never copies found elsewhere online. Check back now and then: we update the files." },
  { t: "Write the name right", d: "One word, capital N and capital A: NotesApp. As a hashtag or our brand line, #NotesApp. Never “Notes App”, “Notesapp”, “NA” or a translation of it." },
  { t: "Words in a sentence", d: "In running text, write NotesApp in the same font, size and style as the words around it. Don't put the logo in place of the word." },
  { t: "Say how you use us", d: "Members can say “Read my journal on NotesApp”, “Book me on #NotesApp” or “Find my shop on NotesApp”, with a link to their page." },
  { t: "Give the mark room", d: "Keep clear space round the icon equal to the height of the “n”. Smallest sizes: the icon 24 px on screen (8 mm in print), the wordmark 80 px wide (25 mm)." },
  { t: "Keep it secondary", d: "Your own name or brand should lead. Our mark may appear on your material, but not as its biggest or most striking part." },
  { t: "Our product names too", d: "Notes Academy, Notes Life, Naija Exam Prep, Nana and the #1MillionNairaNotesAppChallenge follow the same rules as NotesApp." },
];

export const BRAND_PROHIBITED = [
  "Suggesting that NotesApp partners with, sponsors or endorses you, your product or your event, unless we've agreed it in writing.",
  "Combining our name or marks, or any part of them, with your own logo, company name, other marks or generic words (for example “NotesApp Lagos Hub”).",
  "Changing the marks: recolouring outside the crimson family, stretching, rotating, outlining, adding effects, words or pictures, or redrawing them.",
  "Making our name or mark the most prominent part of your material.",
  "Using our name or marks in anything misleading, defamatory, obscene, infringing, unlawful, hateful or otherwise objectionable, or in a way that weakens the brand.",
  "Using NotesApp, or a name like it, as part of another product's, service's or company's name.",
  "Using a mark that looks like ours: a red rounded square with “na”, or a look-alike of any of our marks.",
  "Misspellings, sound-alikes, translations, take-offs or abbreviations of our names (for example “NoteApp”, “NotesAp” or “Notes App NG”).",
  "Making or selling merchandise (T-shirts, mugs, bags, stickers) with our marks: our own merch is sold only through the NotesApp Merch Store.",
  "Using NotesApp, or something like it, in a domain name, a username, a page or group name or an app name. Usernames containing “notesapp” are already reserved on NotesApp.",
  "Using our seasonal and festival marks: they're for NotesApp's own channels only.",
];

export const BRAND_FAQ: { q: string; a: string }[] = [
  { q: "Why do these rules exist?", a: "So people always know what's really NotesApp. Consistent use stops confusion, keeps members safe from look-alike scams and protects our trademarks." },
  { q: "Can I use the logo on my website, flyer or slides?", a: "Yes, to point people to your NotesApp page, journal, shop or booking link, following the guidelines above. Link to your page where you can." },
  { q: "Can I put the logo on T-shirts, mugs or other merchandise?", a: "Not without our written approval. Official merch is in the NotesApp Merch Store; for a collaboration, write to us from the contact page." },
  { q: "Can I use NotesApp in a TV show, film, video or ad?", a: "Ask us first from the contact page, with a description, the script or storyboard, where it will be shown and any translations. Allow about 2 to 3 weeks; approval comes once we've seen the final version." },
  { q: "Can I write about NotesApp in a book, article or play?", a: "Yes, you may use the word NotesApp to describe us, with a clear line that NotesApp doesn't sponsor or endorse the work. Logos and screenshots need our written permission." },
  { q: "Can I change the logo, or add my name to it?", a: "No. You may scale it, keeping its shape, as long as it isn't the most prominent part of your design." },
  { q: "Can I use “notesapp” in my domain, username or page name?", a: "No. That includes look-alikes. It confuses people and can be used for scams." },
  { q: "Can I call myself a NotesApp partner or ambassador?", a: "Only with a written agreement with us. Being a member, a teacher on Notes Academy or a seller on Notes Market doesn't make you a partner." },
  { q: "Can I use NotesApp as a verb?", a: "We use “drop a note” and “create a note” in the app. Please don't turn the name itself into a verb (“NotesApp me”); say “message me on NotesApp” instead." },
  { q: "I found our logo on another site. Can I use that copy?", a: "Please use the files from this page only: copies elsewhere may be old or altered." },
  { q: "What happens if someone misuses the brand?", a: "We register and protect our trademarks and act against misuse. Report a fake page, look-alike app or scam from the contact page or the Report button on the page itself." },
];

export const BRAND_LEGAL = [
  `NotesApp, #NotesApp, the “na” mark, Notes Academy, Notes Life, Notes Market, Naija Exam Prep, Nana and the #1MillionNairaNotesAppChallenge are trademarks of ${BRAND_OWNER}. We put work into building and protecting them, including registration and acting against misuse.`,
  "You may use them only as these guidelines allow or with our written permission. You may not register or claim any right in them, including as part of a trademark, company or business name, username or domain name, and you may not adopt marks that are confusingly similar to or dilute them.",
  "Our Terms of Service and Community Guidelines also apply to any use. We may withdraw permission at any time, and may refuse any use we consider inconsistent with the NotesApp brand.",
  "Other companies' names and logos shown on NotesApp belong to their owners.",
];
