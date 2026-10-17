// Fills the Firestore and Auth emulators with a small, realistic #NotesApp: people (founders, a verified writer, an organisation,
// a seller), journals on different topics, store items with sales set up, this week's visits, a bookable publisher, a
// signed-in reader with interests and two conversations. For trying pages locally, screenshots and the smoke test. Emulators only: it refuses to run
// unless FIRESTORE_EMULATOR_HOST is set, so it can never touch live data.
//
//   npx -y firebase-tools@13 emulators:exec --only firestore,auth --project demo-notesapp \
//     "FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 npx -y tsx scripts/seed-demo.ts && <your command>"
// The reader signs in as reader@demo.notesapp / demo-password-1.
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
  { uid: "u_chimdinma", username: "chimdinma", displayName: "Chimdinma Onwuegbu", avatar: `${I}/headshots/chimdinma-onwuegbu-1.jpeg`, bio: "Co-founder. Careers, money and people.", role: "admin", accountTier: "business" },
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
    msgs.forEach(([from, text, age], i) => batch.set(db.doc(`conversations/${cid}/messages/${String(Date.now() - age * 86_400_000).padStart(13, "0")}_${i}`), { from, text, createdAt: day(age) }));
  }
  await batch.commit();
  for (const p of PEOPLE.filter((x) => x.email)) {
    await auth.createUser({ uid: p.uid, email: p.email, password: "demo-password-1", displayName: p.displayName, emailVerified: true }).catch((e) => { if (!String(e).includes("exists")) throw e; });
  }
  console.log(`seeded ${PEOPLE.length} people, ${NOTES.length} journals, ${ITEMS.length} items; reader@demo.notesapp / demo-password-1`);
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
