// Fills the Firestore and Auth emulators with a small, realistic #NotesApp: people (founders, a verified writer, an organisation,
// a seller), journals on different topics, store items with sales set up, two free Notes Academy courses, this week's visits, a
// bookable publisher, a signed-in reader with interests, a course in progress and two conversations. For trying pages locally, screenshots and the smoke test. Emulators only: it refuses to run
// unless FIRESTORE_EMULATOR_HOST is set, so it can never touch live data.
//
//   npx -y firebase-tools@13 emulators:exec --only firestore,auth --project demo-notesapp \
//     "FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 npx -y tsx scripts/seed-demo.ts && <your command>"
// Sign in as reader@demo.notesapp (a reader) or chimdinma@demo.notesapp (Business), password demo-password-1.
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  console.error("seed-demo only runs against the emulators (FIRESTORE_EMULATOR_HOST is not set).");
  process.exit(1);
}
initializeApp({ projectId: process.env.GCLOUD_PROJECT || "demo-notesapp" });
const db = getFirestore();
db.settings({ ignoreUndefinedProperties: true });
const day = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();
const ymd = (n: number) => day(n).slice(0, 10);
const I = "/images";

type Person = { uid: string; username: string; displayName: string; avatar: string; bio: string; role?: string; accountTier?: string; accountKind?: string; verified?: boolean; email?: string; interests?: string[] };
const PEOPLE: Person[] = [
  { uid: "u_emmanuel", username: "emmanuel", displayName: "Emmanuel Adams", avatar: `${I}/headshots/emmanuel-adams-2.jpeg`, bio: "Founder and CEO, #NotesApp.", role: "admin", accountTier: "business" },
  { uid: "u_chimdinma", username: "chimdinma", displayName: "Chimdinma Onwuegbu", avatar: `${I}/headshots/chimdinma-onwuegbu-1.jpeg`, bio: "Co-founder. Careers, money and people.", role: "admin", accountTier: "business", email: "chimdinma@demo.notesapp" },
  { uid: "u_ada", username: "ada", displayName: "Ada Okafor", avatar: `${I}/headshots/default-avatar.png`, bio: "Therapist in Abuja.", role: "reader", accountTier: "pro", verified: true },
  { uid: "u_tola", username: "tola", displayName: "Tola Bello", avatar: `${I}/headshots/default-avatar.png`, bio: "Tech writer.", role: "reader", accountTier: "basic" },
  { uid: "u_precheks", username: "precheks", displayName: "Precheks", avatar: `${I}/brand/notesapp-icon.png`, bio: "Background checks for Africa.", role: "reader", accountTier: "business", accountKind: "organisation" },
  { uid: "u_clickam", username: "clickam", displayName: "Clickam Store", avatar: `${I}/headshots/default-avatar.png`, bio: "Solar and gadgets.", role: "reader", accountTier: "pro" },
  { uid: "u_reader", username: "reader", displayName: "Demo Reader", avatar: `${I}/headshots/default-avatar.png`, bio: "", role: "reader", accountTier: "basic", email: "reader@demo.notesapp", interests: ["fintech", "startups", "mental-health", "tech"] },
];
const NOTES = [
  { id: "n_paygap", slug: "minding-the-pay-gap", title: "Minding the pay gap: what Nigerian creators charge", author: "u_chimdinma", topics: ["fintech", "careers"], img: `${I}/notes/2go.jpg`, age: 2, views: 4120, week: 310, body: "We asked 300 coaches, consultants and therapists what they charge for an hour, and how that changed once they took bookings online." },
  { id: "n_escrow", slug: "how-we-built-escrow", title: "How we built escrow for a marketplace in Naira", author: "u_emmanuel", topics: ["startups", "fintech"], img: `${I}/journal/defi.jpg`, age: 5, views: 2210, week: 190, body: "Holding a buyer's money until the parcel arrives sounds simple. Here is everything that went wrong first." },
  { id: "n_therapist", slug: "five-questions-therapist", title: "Five questions to ask before you book a therapist", author: "u_ada", topics: ["mental-health"], img: `${I}/notes/IMG_6655.jpeg`, age: 1, views: 1980, week: 260, body: "Short, honest answers from three therapists who take bookings on #NotesApp." },
  { id: "n_itniches", slug: "20-it-niches", title: "20 IT niches to explore in 2027", author: "u_tola", topics: ["tech", "careers"], img: `${I}/notes/20-it-niches-to-be-explor-selar.co-666a052b4279c.jpeg`, age: 8, views: 1730, week: 80, body: "From cloud support to data analysis: where the jobs are, and how to start." },
  { id: "n_sunday", slug: "sunday-service-leadership", title: "What Sunday service taught me about leading a team", author: "u_emmanuel", topics: ["faith", "leadership"], img: `${I}/notes/IMG_6676.jpeg`, age: 0, views: 120, week: 40, body: "Every week, two hundred volunteers show up on time. Here's what that taught me." },
  { id: "n_abuja", slug: "abuja-tech-one-year-on", title: "The Abuja tech scene, one year on", author: "u_tola", topics: ["abuja", "tech"], img: `${I}/notes/IMG_7827.jpeg`, age: 3, views: 640, week: 120, body: "Meetups, hubs and the first real exits in the capital." },
  { id: "n_checks", slug: "background-checks-guide", title: "A plain guide to background checks for small teams", author: "u_precheks", topics: ["hr", "business"], img: `${I}/notes/IMG_6680-2.jpeg`, age: 6, views: 410, week: 60, body: "What you can check, what you can't, and what it costs." },
  { id: "n_savings", slug: "saving-in-naira", title: "Saving in naira when prices keep moving", author: "u_chimdinma", topics: ["personal-finance"], img: `${I}/notes/IMG_7826-1024x693.jpeg`, age: 12, views: 980, week: 30, body: "Three habits that worked for our readers this year." },
];
const ITEMS = [
  { id: "i_excel", owner: "u_chimdinma", title: "MS Excel: beginner to advanced", price: "₦6,000", kobo: 600000, img: `${I}/shop/ms-excel-beginner-to-advanced.jpg`, category: "Books & courses", kind: "digital", age: 4, views: 900, week: 120, favs: 40 },
  { id: "i_career", owner: "u_chimdinma", title: "Career planning and development", price: "₦4,500", kobo: 450000, img: `${I}/shop/career-planning-and-development.jpg`, category: "Books & courses", kind: "digital", age: 9, views: 610, week: 70, favs: 22 },
  { id: "i_entre", owner: "u_emmanuel", title: "Entrepreneurship 101", price: "₦3,000", kobo: 300000, img: `${I}/shop/Entrepreneurship-101-Release-Inner-Entrepreneur.jpg`, category: "Books & courses", kind: "digital", age: 2, views: 480, week: 150, favs: 31 },
  { id: "i_crypto", owner: "u_emmanuel", title: "The future of digital money", price: "₦5,000", kobo: 500000, img: `${I}/shop/Future-Digital-Money-Cryptocurrency.jpg`, category: "Books & courses", kind: "digital", age: 15, views: 300, week: 10, favs: 9 },
  { id: "i_niches", owner: "u_tola", title: "20 IT niches workbook", price: "₦2,500", kobo: 250000, img: `${I}/shop/20-it-niches-to-be-explored.jpg`, category: "Electronics", kind: "physical", age: 1, views: 90, week: 60, favs: 4 },
  { id: "i_hero", owner: "u_clickam", title: "NotesApp magazine, June 2026", price: "₦1,500", kobo: 150000, img: `${I}/shop/Hero-Cover-June-2026.webp`, category: "Books & courses", kind: "physical", age: 0, views: 20, week: 20, favs: 1 },
];

// Notes Academy: two published free courses. The video ids only need to look real (the emulator never calls YouTube).
const COURSES = [
  {
    id: "excel-everyday", owner: "u_chimdinma", slug: "excel-for-everyday-work", title: "Excel for everyday work", topics: ["data", "careers", "productivity"],
    cover: `${I}/shop/ms-excel-beginner-to-advanced.jpg`, age: 6, views: 520, week: 140, enrolled: 46,
    summary: "Go from a blank sheet to a budget, a sales tracker and a tidy report. Three short video lessons for people who use Excel at work and want to stop guessing.",
    lessons: [
      { id: "l1", title: "Find your way round a spreadsheet", kind: "youtube", youtubeId: "Xl4cM2q8T0a", minutes: 9 },
      { id: "l2", title: "Formulas you'll use every day", kind: "youtube", youtubeId: "bR7kP9sQx1E", minutes: 14 },
      { id: "l3", title: "Charts and a one-page report", kind: "youtube", youtubeId: "nT3vW6yZ0cD", minutes: 12 },
    ],
  },
  {
    id: "first-customers", owner: "u_emmanuel", slug: "your-first-ten-customers", title: "Your first ten customers", topics: ["entrepreneurship", "startups", "sales"],
    cover: `${I}/shop/Entrepreneurship-101-Release-Inner-Entrepreneur.jpg`, age: 2, views: 210, week: 90, enrolled: 18,
    summary: "A short reading course for new founders: who to sell to first, what to say, and how to price before you have a brand.",
    lessons: [
      { id: "t1", title: "Who buys first", kind: "text", minutes: 5, body: "## Who buys first\n\nYour first customers are people who **already have the problem** and are trying to fix it badly. Write down ten of them by name before you build anything." },
      { id: "t2", title: "What to say", kind: "text", minutes: 6, body: "## What to say\n\nOne sentence on the problem, one on what you do about it, and a question. Then listen.\n\n- Keep it short\n- Ask for a call, not a sale" },
      { id: "t3", title: "Pricing before you have a brand", kind: "text", minutes: 7, body: "## Pricing\n\nCharge from the first day. A small price tells you more than a hundred compliments." },
    ],
  },
];

(async () => {
  const auth = getAuth();
  const batch = db.batch();
  for (const p of PEOPLE) {
    batch.set(db.doc(`users/${p.uid}`), { uid: p.uid, username: p.username, displayName: p.displayName, avatar: p.avatar, bio: p.bio, role: p.role ?? "reader", accountTier: p.accountTier ?? "basic", createdAt: day(200), suspended: false, ...(p.accountKind ? { accountKind: p.accountKind, org: { rcStatus: "verified" } } : {}), ...(p.verified ? { verified: true } : {}), ...(p.interests ? { interests: p.interests } : {}) });
    batch.set(db.doc(`usernames/${p.username}`), { uid: p.uid });
    batch.set(db.doc(`payoutAccounts/${p.uid}`), { recipientCode: `RCP_${p.uid}` });
  }
  batch.set(db.doc("publisherSettings/u_emmanuel"), { payoutReady: true, session: { enabled: true, priceKobo: 2500000, minutes: 60 } });
  for (const uid of ["u_chimdinma", "u_ada", "u_precheks", "u_clickam"]) batch.set(db.doc(`publisherSettings/${uid}`), { payoutReady: true });
  batch.set(db.doc("publisherSettings/u_tola"), {}); // hasn't set up payouts: Gift me shows greyed out with its ℹ️
  // A journal saved the old way (by the Precheks app, or before usernames were stored): only the display name.
  batch.set(db.doc("notes/n_oldstyle"), { slug: "what-is-an-economy-for", title: "What is an economy for?", date: day(1), topics: ["economy"], categories: [], tags: [], featured_image: `${I}/notes/IMG_7827.jpeg`, content: "Because I heard Nigeria's economy is getting better. I believe them. Or at least, I am trying to.", author: "NotesApp", author_role: "Official Channel", author_avatar: `${I}/brand/notesapp-icon.png`, status: "published", viewCount: 8, likeCount: 2, shareCount: 1 });
  for (const n of NOTES) {
    const a = PEOPLE.find((p) => p.uid === n.author)!;
    batch.set(db.doc(`notes/${n.id}`), { slug: n.slug, title: n.title, date: day(n.age), topics: n.topics, categories: [], tags: [], featured_image: n.img, content: n.body, author: a.displayName, author_role: "", author_avatar: a.avatar, authorUid: a.uid, authorUsername: a.username, status: "published", viewCount: n.views, likeCount: Math.round(n.views / 40), shareCount: 0 });
    batch.set(db.doc(`pageViews/note_${n.id}_${ymd(1).replace(/-/g, "")}`), { kind: "note", id: n.id, day: ymd(1), count: n.week });
  }
  for (const i of ITEMS) {
    batch.set(db.doc(`storeItems/${i.id}`), { ownerUid: i.owner, title: i.title, price: i.price, priceKobo: i.kobo, image: i.img, images: [i.img], category: i.category, kind: i.kind, sellable: true, stock: 20, fileName: i.kind === "digital" ? "book.pdf" : undefined, link: "", cta: "Buy", createdAt: day(i.age) });
    batch.set(db.doc(`storeStats/${i.id}`), { ownerUid: i.owner, views: i.views, favs: i.favs });
    batch.set(db.doc(`pageViews/item_${i.id}_${ymd(1).replace(/-/g, "")}`), { kind: "item", id: i.id, day: ymd(1), count: i.week });
  }
  for (const c of COURSES) {
    const a = PEOPLE.find((p) => p.uid === c.owner)!;
    batch.set(db.doc(`courses/${c.id}`), {
      ownerUid: a.uid, ownerUsername: a.username, ownerName: a.displayName, ownerAvatar: a.avatar, title: c.title, slug: c.slug, summary: c.summary, topics: c.topics, cover: c.cover,
      free: true, status: "published", lessonIds: c.lessons.map((l) => l.id), lessonCount: c.lessons.length, minutes: c.lessons.reduce((n, l) => n + l.minutes, 0),
      enrolCount: c.enrolled, viewCount: c.views, createdAt: day(c.age + 3), updatedAt: day(c.age), publishedAt: day(c.age),
    });
    batch.set(db.doc(`courseSlugs/${c.slug}`), { courseId: c.id });
    c.lessons.forEach(({ id, ...l }, order) => batch.set(db.doc(`courses/${c.id}/lessons/${id}`), { ...l, order }));
    batch.set(db.doc(`pageViews/course_${c.id}_${ymd(1).replace(/-/g, "")}`), { kind: "course", id: c.id, day: ymd(1), count: c.week });
  }
  // The reader is part-way through the Excel course: one lesson of three done.
  batch.set(db.doc("enrolments/excel-everyday_u_reader"), { courseId: "excel-everyday", uid: "u_reader", enrolledAt: day(3), done: { l1: day(2) }, lastLessonId: "l1", completedAt: null });
  batch.set(db.doc("follows/u_reader_ada"), { followerUid: "u_reader", username: "ada" });
  // Two conversations for the reader (Messages), one with unread messages.
  const chats: [string, [string, string, number][]][] = [
    ["u_chimdinma", [["u_chimdinma", "Did you see the pay gap numbers?", 3], ["u_reader", "Yes! Sharing it with my team.", 2.9], ["u_chimdinma", "The full breakdown drops Friday.", 1]]],
    ["u_emmanuel", [["u_emmanuel", "Welcome to #NotesApp 👋", 6], ["u_emmanuel", "Tell me what you'd like to read more of.", 5.9]]],
  ];
  for (const [other, msgs] of chats) {
    const cid = ["u_reader", other].sort().join("_");
    const last = msgs[msgs.length - 1];
    batch.set(db.doc(`conversations/${cid}`), { participants: ["u_reader", other].sort(), createdAt: day(msgs[0][2]), lastMessage: { from: last[0], text: last[1], at: day(last[2]) }, lastMessageAt: day(last[2]), unread: { u_reader: other === "u_emmanuel" ? 2 : 0, [other]: 0 } });
    msgs.forEach(([from, text, age], i) => batch.set(db.doc(`conversations/${cid}/messages/${String(Date.now() - age * 86_400_000).padStart(13, "0")}_${i}`), { from, text, createdAt: day(age), ...(other === "u_chimdinma" && i === 0 ? { reactions: { u_reader: "👍" } } : {}), ...(other === "u_chimdinma" && i === 1 ? { readAt: day(2.8), reactions: { u_chimdinma: "❤️" } } : {}) }));
  }
  // A third, with Ada after a session the reader booked (it shows under the inbox's Bookings filter), with her notes as a PDF.
  batch.set(db.doc("bookings/demo_ada_session"), { publisherUid: "u_ada", clientUid: "u_reader", status: "completed", title: "First session", startsAt: day(4), endsAt: day(4), priceKobo: 1500000, createdAt: day(6) });
  batch.set(db.doc("conversations/u_ada_u_reader"), { participants: ["u_ada", "u_reader"], createdAt: day(4), lastMessage: { from: "u_ada", text: "📎 Session-notes-Oct.pdf", at: day(0.2) }, lastMessageAt: day(0.2), unread: { u_reader: 1, u_ada: 0 } });
  batch.set(db.doc("conversations/u_ada_u_reader/messages/a1"), { from: "u_ada", text: "Thank you for today. Here are the notes from our session, and the two exercises for this week.", createdAt: day(0.21) });
  // A busy group the reader hasn't opened for a while (the "N new · Summarise" bar), with a #NotesApp link that shows as a card.
  const crew = ["u_reader", "u_chimdinma", "u_tola", "u_ada"];
  const said: [string, string][] = [["u_chimdinma", "Morning all! Pay gap piece is live 👉 https://www.notesapp.name.ng/journals/minding-the-pay-gap"], ["u_tola", "Read it on the bus. The coaching numbers surprised me."], ["u_ada", "Same. Therapists charge less than I expected."], ["u_tola", "Should we do a live session on pricing?"], ["u_chimdinma", "Yes, Thursday 6pm works for me."], ["u_ada", "Thursday is fine. I'll bring questions from my clients."], ["u_tola", "I'll set up the room and post the link here."]];
  batch.set(db.doc("conversations/g_creators"), { kind: "group", title: "Creators circle", participants: crew, adminUids: ["u_chimdinma"], createdBy: "u_chimdinma", scope: "public", createdAt: day(5), readMarker: { u_reader: day(3) }, lastMessage: { from: "u_tola", fromName: "Tola Bello", text: said[said.length - 1][1], at: day(0.1) }, lastMessageAt: day(0.1), unread: { u_reader: said.length, u_chimdinma: 0, u_tola: 0, u_ada: 0 } });
  said.forEach(([from, text], i) => batch.set(db.doc(`conversations/g_creators/messages/g${i}`), { from, text, createdAt: day(1 - i * 0.12) }));
  // The reader kept Chimdinma's note about Friday (Saved → From chats).
  batch.set(db.doc("keptMessages/u_reader_kept1"), { uid: "u_reader", cid: "u_chimdinma_u_reader", messageId: "kept1", from: "u_chimdinma", fromName: "Chimdinma Onwuegbu", chatTitle: "Chimdinma Onwuegbu", text: "The full breakdown drops Friday.", files: [], sentAt: day(1), keptAt: day(0.5) });
  batch.set(db.doc("conversations/u_ada_u_reader/messages/a2"), { from: "u_ada", text: "", attachments: [{ key: "demo/session-notes.pdf", name: "Session-notes-Oct.pdf", size: 248_000, type: "application/pdf", kind: "document" }], createdAt: day(0.2) });
  await batch.commit();
  // Emmanuel's picture history (the profile picture viewer): the current one first, then two older ones.
  for (const [n, url] of [[0, `${I}/headshots/emmanuel-adams-2.jpeg`], [30, `${I}/notes/IMG_6676.jpeg`], [120, `${I}/headshots/emmanuel-adams-1.jpeg`]] as const) {
    await db.collection("profilePictures").add({ uid: "u_emmanuel", url, createdAt: day(n) });
  }
  // Tola typed their links the casual way (handles, a bare address, a phone number); the profile still shows them.
  await db.doc("users/u_tola").set({ social: { twitter: "@tolabello", instagram: "tola.bello", linkedin: "linkedin.com/in/tolabello", whatsapp: "0803 123 4567", website: "tolabello.com" } }, { merge: true });
  // Precheks' site: the Maroon theme, journals only, an About page.
  await db.doc("users/u_precheks").set({ siteTheme: "maroon", siteSections: { journals: true, shop: false, courses: false }, sitePages: { about: "## About Precheks\n\nBackground checks for African businesses: **identity, address, employment and education**, done in days.", updatedAt: day(0) } }, { merge: true });
  for (const p of PEOPLE.filter((x) => x.email)) {
    await auth.createUser({ uid: p.uid, email: p.email, password: "demo-password-1", displayName: p.displayName, emailVerified: true }).catch((e) => { if (!String(e).includes("exists")) throw e; });
  }
  console.log(`seeded ${PEOPLE.length} people, ${NOTES.length + 1} journals, ${ITEMS.length} items, ${COURSES.length} courses; reader@demo.notesapp and chimdinma@demo.notesapp / demo-password-1`);
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
