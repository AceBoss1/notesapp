// Public release notes for /changelog. Newest first. To ship a note, add one object at the top:
// bump `version` (major = something existing changed incompatibly, minor = new features, patch = fixes),
// set the date, and tag every line Added / Changed / Fixed.
export type ChangeKind = "added" | "changed" | "fixed";
export type Release = {
  version: string;
  bump: "major" | "minor" | "patch";
  date: string; // YYYY-MM-DD
  changes: { kind: ChangeKind; text: string }[];
};

export const CHANGELOG: Release[] = [
  {
    version: "v0.102.1",
    bump: "patch",
    date: "2026-10-30",
    changes: [
      { kind: "added", text: "#NotesApp won Special Recognition at the Build With NKENNEAi Hackathon for our Kiswahili journals, translation and speech. It is on the About page now." },
    ],
  },
  {
    version: "v0.102.0",
    bump: "minor",
    date: "2026-10-30",
    changes: [
      { kind: "added", text: "Referrals (Account → Referrals): share your link, and a friend who joins with it gets their first month of a plan free (on a yearly plan, one month off). You earn 20% of what they pay for their plan for 12 months, from their first payment." },
      { kind: "added", text: "The affiliate marketplace (/affiliates): browse shop items, downloads and courses whose publishers pay a share to members who promote them, copy your link for any of them and share it with your audience. You earn that share of every sale through your link." },
      { kind: "added", text: "Publishers: set an affiliate share (up to 50%) on any shop item, download or paid course under Account → Referrals, and it goes on the marketplace. The share comes out of your part of the sale, worked out on what the buyer actually paid." },
      { kind: "added", text: "Take your earnings as cash to your bank account (from ₦2,000) or as NotesApp Credit with 10% more. Earnings wait 7 days (14 for delivered shop items) so payments can clear, and a refund takes back what it earned." },
    ],
  },
  {
    version: "v0.101.1",
    bump: "patch",
    date: "2026-10-30",
    changes: [
      { kind: "fixed", text: "Admin → Ads: adding or saving a house ad now says what happened beside its button (a missing headline, link or placement, an end date before the start, a save that failed, or \"Ad added\"), instead of a message at the top of the page that was out of view." },
    ],
  },
  {
    version: "v0.101.0",
    bump: "minor",
    date: "2026-10-30",
    changes: [
      { kind: "added", text: "Discount codes. On every plan, make codes for your shop, downloads, courses and booked sessions (Account → Discount codes): a percentage or a naira amount off, for some or all of your products, with optional limits (total uses, uses per member, dates, a minimum order, first order only). See how often each was used and what it took off; pause one at any time." },
      { kind: "added", text: "At checkout, \"Have a discount code?\" shows what a code takes off before you pay. #NotesApp's own codes work on boosts, Nana credit, merch and the logistics and inventory add-ons." },
      { kind: "changed", text: "Commission on a discounted sale is worked out on what the buyer actually paid, and a code never touches the delivery fee." },
    ],
  },
  {
    version: "v0.100.5",
    bump: "patch",
    date: "2026-10-30",
    changes: [
      { kind: "changed", text: "On the roadmap: discount codes for #NotesApp and every publisher, referral links (a friend's first month of a plan free; cash, or NotesApp Credit with a bonus, for you) and affiliates (20% of the plan payments of the people you bring, for 12 months)." },
    ],
  },
  {
    version: "v0.100.4",
    bump: "patch",
    date: "2026-10-29",
    changes: [
      { kind: "changed", text: "On the roadmap: payments across Africa start in Kenya, with M-Pesa and shilling prices (a pilot with our Kenyan members in December, open to everyone in January 2027), then Ghana." },
    ],
  },
  {
    version: "v0.100.3",
    bump: "patch",
    date: "2026-10-29",
    changes: [
      { kind: "added", text: "Our vision and mission on the About page: Africa\u2019s knowledge, shared, valued and rewarded. #NotesApp gives Africa\u2019s creators, teachers, professionals and businesses one home to share what they know, teach it, sell it and get paid for it." },
    ],
  },
  {
    version: "v0.100.2",
    bump: "patch",
    date: "2026-10-29",
    changes: [
      { kind: "changed", text: "On the roadmap: payments across Africa. Paystack keeps cards and subscriptions and backs up payouts, Paylony takes bank transfers and Tap2Pay, and Flutterwave comes with Ghana and Kenya (mobile money, M-Pesa, more currencies)." },
      { kind: "changed", text: "On the roadmap: the iOS and Android apps are being prepared. They wrap the same #NotesApp as the web, and follow NotesApp Inc, our US company." },
    ],
  },
  {
    version: "v0.100.1",
    bump: "patch",
    date: "2026-10-29",
    changes: [
      { kind: "changed", text: "On the roadmap: WhatsApp booking reminders will be a paid add-on that publishers switch on. Email and bell reminders stay free on every plan." },
    ],
  },
  {
    version: "v0.100.0",
    bump: "minor",
    date: "2026-10-29",
    changes: [
      { kind: "added", text: "Day, Night or Auto for the whole app: Day is the warm ivory paper, Night is #NotesApp maroon with ivory writing, and Auto follows the clock (Night from 6:30 pm to 6:30 am). Choose it in Account settings or the menu; it stays on your device and applies before the page draws. Members' sites, Naija Exam Prep and the Notes Life game keep their own looks." },
      { kind: "added", text: "The #NotesApp African pattern: line drawings of talking drums, the ogene and agogo gongs, the kora and shekere, Nok and Benin bronze heads, an Igbo-Ukwu bronze vase, Queen Idia's mask, kente and adinkra, an old lantern, danfos and kekes, the naira and maps of Africa, Nigeria, Ghana, Kenya, South Africa and Egypt. It sits behind every chat (messages, groups, Circles, the team room) and is the cover on profiles, communities and sites until a picture is added." },
      { kind: "added", text: "Emoji packs in chats, maroon crimson by Day and warm ivory by Night: Afro culture (our own drawings), Faces and Flags (every African country and many more) are free; Summer, Spooky and Celebrate come with Pro and above, with a lock and Unlock for everyone else." },
      { kind: "added", text: "Type a country's name or its code in capitals in a chat and a row offers its flag, and its map when there is one." },
      { kind: "added", text: "A round ☀ / ☽ / ◐ button in the header, next to a shorter search box, taps through Day, Night and Auto." },
      { kind: "added", text: "On Pro, Business and Enterprise, choose your own chat background: the African pattern, plain, one of six colours (Kente gold, Adire indigo, Forest, Sahel sand, Atlantic, Hibiscus) or your own picture. Only you see it, in every chat and on every device, with a soft wash so messages stay readable by Day and Night." },
    ],
  },
  {
    version: "v0.99.1",
    bump: "patch",
    date: "2026-10-29",
    changes: [
      { kind: "added", text: "On the roadmap: Send-Na by NotesApp, email for Nigerian developers and businesses priced and paid in Naira, with WhatsApp and SMS when email is slow. Our own email, sign-in codes and WhatsApp booking reminders move onto it first; then it becomes an add-on on every NotesApp plan (Free 3,000 emails a month, Pearl ₦1,500, Emerald ₦12,500, Ruby ₦40,000); then a public API." },
    ],
  },
  {
    version: "v0.99.0",
    bump: "minor",
    date: "2026-10-28",
    changes: [
      { kind: "added", text: "Naija Exam Prep: 2,150 more original practice questions, 50 more in every subject of every exam. JAMB subjects now have 70 questions each, and WAEC and NECO subjects 100 each (20 more free in each), all with explanations. They go to our subject reviewers first and reach students once approved and published." },
    ],
  },
  {
    version: "v0.98.0",
    bump: "minor",
    date: "2026-10-27",
    changes: [
      { kind: "changed", text: "Notes Life: every outdoor scene now moves. Traffic drives the first street, Chef Adams, itel Energy, the Digital Witch plaza and the road past the Candellux, and people walk the pavements with swinging legs and arms. At the Candellux pool, ladies swim and sunbathe in bikinis and stroll the poolside." },
    ],
  },
  {
    version: "v0.97.0",
    bump: "minor",
    date: "2026-10-27",
    changes: [
      { kind: "added", text: "Notes Life: LUXNAS, the fashion brand from Nnewi led by CEO Chinasa Odina, opens on Wuse Market (Zone 4). Deliver its orders, learn tailoring, embroidery or bespoke African fashion design at LUXNAS Academy, then work there as a tailor, embroiderer, designer or supervisor, or open your own LUXNAS tailoring studio. Find the real LUXNAS at @luxnas on NotesApp." },
      { kind: "added", text: "The Wuse streets have billboards (on the rooftops in Zone 4 and along the crescent in Wuse II) and red LED message boards that scroll the street names." },
      { kind: "changed", text: "People in Notes Life now walk with swinging legs and arms; ladies wear short dresses, skirts or gowns, and more people walk the Wuse pavements." },
    ],
  },
  {
    version: "v0.96.0",
    bump: "minor",
    date: "2026-10-27",
    changes: [
      { kind: "added", text: "Notes Life: Hygiene and Bladder away from home. Tap 🚻 Restroom wherever you are. At the Candellux, a suite guest's WC and bathroom fill both; the new outdoor shower by the pool fills Hygiene if you swam in the last 24 game hours (otherwise +50); the VIP bar restroom fills Bladder if you used the VIP bar in that time (otherwise +50); the pool bar restroom gives Bladder +50." },
      { kind: "added", text: "Bladder +50 at itel Energy, Chef Adams, Emerald Towers and the Digital Witch hub, and emergency mobile WC (N$ 500) and shower (N$ 800) units at Wuse Market that fill the need." },
    ],
  },
  {
    version: "v0.95.0",
    bump: "minor",
    date: "2026-10-27",
    changes: [
      { kind: "added", text: "Notes Life: two new Wuse streets beside the first one. Wuse Market in Zone 4 (stalls, kekes, a pharmacy, tailor, phone shop, pepper soup, barber, Bureau De Change, POS stand, lesson centre, puff-puff and zobo, a suya grill at night and the borehole) and Aminu Kano Crescent in Wuse II (office plazas, a bank, Emerald Towers, a café, a grill and Skyline Lounge). Tap a shop to walk to it; traffic, hawkers and night lights bring the street to life." },
      { kind: "added", text: "Notes Life errands: 14 short paid tasks from the people who live and work in Wuse, each once a game day, from fetching water for Mama Nkechi to parking cars at Skyline Lounge, plus Saturday sanitation for reputation. Phone → Errands lists them all." },
      { kind: "added", text: "Emerald Ezurukam, the mind behind Notes Life, is #1 on the Billionaires List. His convoy stops at the Wuse bus stand at 8 AM, 1 PM and 6 PM, and he gives N$ 100,000 to everyone waiting (once every 30 game days each)." },
    ],
  },
  {
    version: "v0.94.0",
    bump: "minor",
    date: "2026-10-26",
    changes: [
      { kind: "added", text: "Naija Exam Prep adds 11 WAEC and NECO subjects, each with its syllabus topics: Literature in English, Geography, Agricultural Science, Civic Education, Commerce, Financial Accounting, Christian Religious Studies, Islamic Studies, Further Mathematics, Computer Studies and History." },
      { kind: "added", text: "1,520 new original practice questions: every WAEC and NECO subject now has 50 for WAEC and 50 for NECO (20 free in each), with explanations and why the wrong options are wrong. They go to our subject reviewers first and show to students only once approved and published." },
      { kind: "changed", text: "Importing questions in Admin → Naija Exam Prep is faster: large sets go in batches, so the full starter set imports in one go." },
      { kind: "fixed", text: "The Exam Prep review queue showed only the first 500 questions before filtering by exam, so with a big queue whole exams looked empty. It now filters first, and admins can also pick a subject." },
    ],
  },
  {
    version: "v0.93.0",
    bump: "minor",
    date: "2026-10-24",
    changes: [
      { kind: "added", text: "Admin → Backups, for the owner: switch on point-in-time recovery (any minute of the last 7 days) and delete protection, add daily and weekly backups (kept up to 14 weeks), see every backup, and restore one, or copy the database as it was at a chosen minute, into a new database beside the live one. It works with the owner's own Google sign-in, never with the site's server key, and every action is recorded." },
      { kind: "added", text: "The site can be switched to a restored database with one setting (NEXT_PUBLIC_FIRESTORE_DATABASE_ID) after a recovery." },
    ],
  },
  {
    version: "v0.92.0",
    bump: "minor",
    date: "2026-10-24",
    changes: [
      { kind: "added", text: "Admin dashboard → When to grow the infrastructure: five numbers, each against the line that starts the next stage of our plan. Scheduled jobs cut off by the time limit and partners blocking our calls; ledger entries and how long the revenue report takes; page and feed load time; daily active members and database reads per member; search speed, the biggest live room and video stored. For super admins, product and engineering." },
      { kind: "added", text: "To measure page, feed and search speed, a quarter of visits send their load times without anything about the visitor." },
    ],
  },
  {
    version: "v0.91.0",
    bump: "minor",
    date: "2026-10-24",
    changes: [
      { kind: "added", text: "Your email and phone number are now hidden in our staff's admin pages. A team member who needs one to help you gives a reason to show it, and every look is recorded with who, when and why. See Who at #NotesApp can see your email and phone in Help." },
      { kind: "added", text: "Admin → View log: every time staff showed a member's email or phone, with the reason. For the founder and Legal & compliance." },
      { kind: "changed", text: "Admin → Maintenance: a fix for older journals applies only after a backup is ticked and only the list its dry run showed (if the journals changed since, it shows the new list instead). Every run keeps each journal's old values and can be undone from Recent runs; a journal edited since is left as it is." },
    ],
  },
  {
    version: "v0.90.2",
    bump: "patch",
    date: "2026-10-23",
    changes: [
      { kind: "changed", text: "Kiswahili: journals are translated block by block. NKENNEAi merges paragraph breaks, so a grouped request could never be split back and was a wasted call; now every request counts." },
    ],
  },
  {
    version: "v0.90.1",
    bump: "patch",
    date: "2026-10-23",
    changes: [
      { kind: "fixed", text: "Kiswahili: translations and transcripts are read from whichever field NKENNEAi's answer uses, and an answer without text is a clear failure that keeps what came back in the usage log." },
    ],
  },
  {
    version: "v0.90.0",
    bump: "minor",
    date: "2026-10-23",
    changes: [
      { kind: "added", text: "The school pack on Naija Exam Prep: a school gives each class its size (for example SS3 Gold, 41 students), and every student who joins with the class code gets that exam's full pack for 12 months, free during the pilot. A full class says so." },
      { kind: "added", text: "Teachers see how many places are taken, can change the class size and remove a student, which frees the place. Leaving or being removed ends the school pack; a pack the student paid for is kept." },
    ],
  },
  {
    version: "v0.89.1",
    bump: "patch",
    date: "2026-10-23",
    changes: [
      { kind: "fixed", text: "Kiswahili: the NKENNEAi key is read without the spaces, line breaks, quotes or \"Bearer\" a pasted value can carry, which the service refused." },
      { kind: "changed", text: "Kiswahili: when the firewall in front of NKENNEAi blocks our server, members see that plainly and the usage log says it was the firewall (no tokens used), not a page of HTML." },
    ],
  },
  {
    version: "v0.89.0",
    bump: "minor",
    date: "2026-10-23",
    changes: [
      { kind: "added", text: "Naija Exam Prep has five more subjects for JAMB, WAEC and NECO: Physics, Chemistry, Biology, Economics and Government, each with its syllabus topics. They appear to students once their first questions are reviewed and published." },
      { kind: "added", text: "300 new original starter questions, 20 per subject and exam with 8 free, each with a worked explanation. Every calculation is checked when the set is built, and the correct letter is spread evenly." },
    ],
  },
  {
    version: "v0.88.0",
    bump: "minor",
    date: "2026-10-23",
    changes: [
      { kind: "added", text: "Team hub → Time → Invoices: one invoice a month per billable project, from approved billable hours × the project's rate, numbered NA-INV-2026-001 onwards, due in 14 days and emailed to the client with a link." },
      { kind: "added", text: "Clients pay online from that link: Paylony first (a one-time account to transfer to, or CardTap), then card through Paystack, or a plain bank transfer that finance marks paid. Every paid invoice goes into the money ledger as money in." },
      { kind: "added", text: "A sent invoice locks its hours (a week it bills can't be returned until it's voided), and the client gets one reminder 3 days after the due date. VAT at 7.5% can be switched on in the invoice settings." },
    ],
  },
  {
    version: "v0.87.0",
    bump: "minor",
    date: "2026-10-23",
    changes: [
      { kind: "added", text: "Naija Exam Prep for schools: a key member of staff applies at prep.notesapp.name.ng/schools and, once we approve the school, signs the onboarding data agreement for it. Free during the pilot." },
      { kind: "added", text: "Classes with access codes (like GFC-SS3G-7KQ) that students enter under Progress, teachers added by email, and a class view for each teacher: students by first name and initial, this week's questions, score and weakest topic, a nickname board and a CSV export." },
    ],
  },
  {
    version: "v0.86.0",
    bump: "minor",
    date: "2026-10-23",
    changes: [
      { kind: "added", text: "Turning 18: on their 18th birthday a student in teen mode gets a bell and a one-time “You're 18 now” screen. Every switch stays off until they turn it on, and whatever they leave off stays protected on their account." },
      { kind: "added", text: "They agree to the Terms and Privacy Policy themselves, can download their data or delete their day-by-day practice log (progress, scores and certificates stay), and their parent or guardian is told the account is now theirs, with their email removed." },
      { kind: "changed", text: "Students in teen mode no longer get the weekly digest." },
    ],
  },
  {
    version: "v0.85.0",
    bump: "minor",
    date: "2026-10-23",
    changes: [
      { kind: "added", text: "Child profiles for under-13s: a parent adds them from My account → Family and opens them on their own device. A child never has a login; getting back to the parent's account takes the parent's PIN." },
      { kind: "added", text: "A child sees only what the parent switches on: Naija Exam Prep practice, free Academy courses, reading journals with no comments, and Notes Life in kids' Notesville (only its residents, no real players, no invites or Bonus Credits) for a daily play time. Never messages, moments, comments, a public profile or buying." },
      { kind: "added", text: "Every Sunday evening the parent gets an email of what each child practised, with scores by topic, and can delete a child's profile and everything in it at any time." },
    ],
  },
  {
    version: "v0.83.0",
    bump: "minor",
    date: "2026-10-23",
    changes: [
      { kind: "added", text: "Teen mode: only people a teen follows can reply to their journals and comments, and a teen's moments are seen only by people they follow back, never in public." },
      { kind: "added", text: "Teen mode asks the month and year you were born (kept privately, never shown) so it can end on your 18th birthday. It's for ages 13 to 17; under 13, a parent sets you up from their own account." },
    ],
  },
  {
    version: "v0.82.1",
    bump: "patch",
    date: "2026-10-23",
    changes: [
      { kind: "changed", text: "Naija Exam Prep's new logo: a student rising out of an open book under a graduation cap, on a white rounded square, with the name in the logo's rounded lettering and “Built for your next breakthrough.” under it. It's the header, the browser and phone icon, and on the brand page and in the logo pack." },
    ],
  },
  {
    version: "v0.82.0",
    bump: "minor",
    date: "2026-10-22",
    changes: [
      { kind: "added", text: "Team hub → Time: a timer for staff on work items, projects, meetings or other work, with billable time, notes and time added by hand. One timer at a time." },
      { kind: "added", text: "Time checks: a running timer asks “still working?” every 30 minutes, on any page, with a sound, a browser notification and a bell. No answer in 10 minutes stops it and the last half hour isn't counted; a meeting waits for its planned length. A timer still running at midnight stops itself." },
      { kind: "added", text: "Weekly timesheets against a 20-hour week (4 hours, Monday to Friday): change any day, submit for approval, and the week locks. Friday 4 pm brings a reminder if it isn't submitted." },
      { kind: "added", text: "Team leads, chosen by super admins: they approve timesheets and leave for their departments (never their own) and see their teams' hours, attendance, billable share and projects against budget, with a CSV export." },
      { kind: "added", text: "Leave requests (annual, sick, public holiday, other), each set to count towards attendance or not, and public holidays for the whole team." },
      { kind: "changed", text: "Payroll pays by the hour: approved timesheet hours in the month × each person's hourly rate. Monthly salaries still work for anyone set up that way." },
    ],
  },
  {
    version: "v0.81.0",
    bump: "minor",
    date: "2026-10-22",
    changes: [
      { kind: "added", text: "Communities in Explore: a Communities tab lists every community anyone can join or ask to join, with search. Invite-only communities stay private and are listed only for their members." },
      { kind: "added", text: "Trending → Communities: the busiest communities today, this week or this month, ranked by new members, then posts, then comments." },
      { kind: "added", text: "Notes Life in the journal feed: a “Need a 5-minute break?” card, at most twice a day, with the people you follow who play; ✕ hides it for a week. It sits between posts on a phone and in the right column on a computer." },
      { kind: "added", text: "🎮 Plays Notes Life on profiles, stores and course pages, between people who follow each other; tapping it opens the game with them as your inviter." },
      { kind: "added", text: "Two new switches in Account → Privacy: Show that I play Notes Life, and Notes Life card in my feed. In teen mode both are off and can't be turned on." },
    ],
  },
  {
    version: "v0.80.1",
    bump: "patch",
    date: "2026-10-22",
    changes: [
      { kind: "added", text: "Help articles for Naija Exam Prep, which Nana reads too: practice, mocks, packs, refunds, pay links and offline use; teen mode and parents; and reviewing questions. Naija Exam Prep is also on the roadmap." },
      { kind: "changed", text: "What you can do on NotesApp (About, search results and Nana) now names Naija Exam Prep, Community and Events, and messages and free calls, with Notes Life and Notes Academy." },
    ],
  },
  {
    version: "v0.80.0",
    bump: "minor",
    date: "2026-10-22",
    changes: [
      { kind: "changed", text: "The writing boxes now talk about notes: Create a note… on Journals, in Community (General and every Space) and for Moments; Reply a note… under journals, community and Space posts and moments; Drop a note… in Messages (the chats of Circles too), audio-room chat and Notes Life." },
      { kind: "added", text: "Brand guidelines on the brand page, below the marks and colours: an introduction, general guidelines (writing the name, clear space, smallest sizes), prohibited uses, FAQ and legal notes." },
      { kind: "added", text: "The NotesApp logo pack: one zip with the icon, the wordmark, app icons, the challenge artwork and the guidelines, downloaded once you accept the guidelines." },
      { kind: "changed", text: "Naija Exam Prep reviewers: choose the subjects first, then make a link for one person or an open link to share with volunteers (for 7 to 90 days, up to 500 reviewers, closable any time). Reviewers see and review only their subjects, and every review is counted for them." },
      { kind: "added", text: "Admin → Naija Exam Prep → Questions: Approve all shown, for Editorial, recorded as the reviewer on each. Starter questions are labelled Nana AI-assisted draft." },
      { kind: "changed", text: "Naija Exam Prep's sign-in and create-account screens are in its own white and green, and its sign-up no longer asks students to say they're 18 or older: under-18s join and are offered teen mode, with a parent or guardian asked to confirm." },
      { kind: "added", text: "Naija Exam Prep has its own logo, the sun rising over an open book, in its header, as its browser and phone icon, on the brand page and in the logo pack." },
    ],
  },
  {
    version: "v0.79.0",
    bump: "minor",
    date: "2026-10-22",
    changes: [
      { kind: "added", text: "Naija Exam Prep, in Notes Academy at prep.notesapp.name.ng: JAMB, WAEC and NECO practice. Free questions in every subject, marked straight away with a full explanation and why each wrong option is wrong. Use of English (JAMB), English Language (WAEC and NECO) and Mathematics to start." },
      { kind: "added", text: "Timed mocks of 10, 20 or 40 questions. The clock runs on our side, so leaving the page or changing your phone's time doesn't stop it, and the mock is marked when you submit or when time runs out, with every answer to go through." },
      { kind: "added", text: "Exam packs: ₦1,000 opens every question in one exam, all subjects, for 12 months, paid with Paystack. Buying again adds 12 months. A full refund within 7 days if you haven't opened any pack question yet. Restore my pack checks again with Paystack if a payment didn't open it." },
      { kind: "added", text: "Ask someone to pay: a link for a parent, sponsor or friend, good for 14 days. They pay without an account and the pack opens on your account; you choose the name they see." },
      { kind: "added", text: "Save a pack to your phone and practise, or do a timed mock, with no data. Pack questions open offline for up to 30 days at a time for your account only; your answers sync when you're back online." },
      { kind: "added", text: "Your progress: questions answered, right first time, mocks, days in a row and how you're doing in each topic, only from what you actually did (never a predicted score). Join the weekly effort board with a nickname if you like; it counts practice, not scores." },
      { kind: "added", text: "Teen mode for students under 18: hidden from people search and the member directory, messages and group invitations only from people they follow, a nickname on the board, and a parent or guardian asked to confirm by email." },
      { kind: "added", text: "Every question is original, checked by a reviewer before it's published, and has a Report button. Reviewers join by invite link and see the review queue only. Admin → Naija Exam Prep has the questions, spreadsheet import, subjects, reviewers, reports, packs, access, grants, refunds and usage." },
    ],
  },
  {
    version: "v0.78.0",
    bump: "minor",
    date: "2026-10-22",
    changes: [
      { kind: "added", text: "Your community, inside your own site: once you link a community you run on Your site, it opens at /community on your site (and on your own domain), with a Community link in your menu. Visitors join, read and post, members chat and join audio rooms, all without leaving your site; invite and share links point there too." },
      { kind: "added", text: "A Community switch under Choose what shows on Your site, for anyone who runs a community: link one there, or turn its page on and off." },
    ],
  },
  {
    version: "v0.77.0",
    bump: "minor",
    date: "2026-10-22",
    changes: [
      { kind: "changed", text: "Eleven site kits are redone for their trade: Food and baking, Services and freelancers, Healthcare and clinics, Fitness, Events and photography, Electronics, Motor parts, Solar, Real estate, Schools, and Churches and NGOs. Each starts with a menu in tabs (cakes, small chops, meals; consultations, tests, home visits; to let, for sale, shortlet; nursery to secondary; Sunday, midweek, fellowships…) with times and prices, answers to what their customers ask (HMOs and emergencies, deposits, title documents, warranties, waybill delivery, entrance exams, first visits), opening hours and two buttons." },
      { kind: "changed", text: "Food, Fitness, Events and Real estate now open with a full photo (the Luxe look), and Schools and Churches with a full photo on the Clean look. Each kit's card says who it's best for." },
      { kind: "changed", text: "The buttons on a menu fit the trade: Order on a food menu (to your shop), Apply on a school's classes, none on a church's programme, and Book now everywhere else." },
      { kind: "changed", text: "A shop's cover photo fills the top of Home when the shop leads Home (or there are no banner words): gadget and parts shops now open with their headline and buttons." },
      { kind: "fixed", text: "Faster member sites: journal cards, basket pictures and category tiles load as you scroll, and pictures further down are decoded without holding up the page." },
    ],
  },
  {
    version: "v0.76.0",
    bump: "minor",
    date: "2026-10-22",
    changes: [
      { kind: "changed", text: "The links across the top of your site's shop now come from your own labels: your subcategories when you use any, otherwise the words you put on your items' pictures, most used first, up to five, with any more as buttons under the search bar. Spellings of one label count together, so Ocasion wear, Occasion wear and Occasion wears are one link, shown as Occasion wear." },
      { kind: "added", text: "Your site's Notes page has links to the topics you write about most, so visitors can read one topic at a time." },
      { kind: "added", text: "Events has its own page in Community (Community → Events), with pictures, the limits and how reminders and Join live work, linked with General, Spaces, Circles and Audio rooms and from the footer." },
    ],
  },
  {
    version: "v0.75.0",
    bump: "minor",
    date: "2026-10-22",
    changes: [
      { kind: "added", text: "Audio rooms in Community, like Clubhouse: admins and moderators go live with a room, bring up to 4 members on stage to speak, and everyone else listens and can raise a hand. A green ring shows who's talking. Members only, phone to phone, nothing recorded, up to 20 listeners for now." },
      { kind: "added", text: "Room chat: everyone in an audio room can type while it's on (questions, prayer points, amens). Beside the room on a computer, behind 💬 Chat on a phone with a count of what you missed. The host or a moderator can remove a message; the chat goes when the room ends." },
      { kind: "added", text: "Choose the Churches and NGOs kit for your site (Business) and Community opens right under it: start your community there, with its name, address and line filled in for you, or link one you already run. A linked community gets a Community link in your site's menu." },
      { kind: "added", text: "General, Spaces, Circles and Audio rooms each have their own page (Community → General, Spaces, Circles, Audio rooms), with pictures on a computer and a phone, the limits and how each works, all linked to each other and from the footer." },
      { kind: "added", text: "New help articles, which Nana reads too: General, Spaces, Circles, Audio rooms, the shop and basket on your site, your site's looks and kits, the Beauty and wellness kit, courses on your site, academic sites and publications, journals in Kiswahili, photos and media in a chat, and pictures you upload (WebP)." },
      { kind: "fixed", text: "Leaving a community, or being removed from it, now takes you out of its Circles too." },
      { kind: "fixed", text: "Community: the header says \"you're an owner\", and the New Circle list no longer offers you to yourself." },
      { kind: "changed", text: "Community looks and works like a group: Write something… to post (with a photo), Like, Comment and Share on every post, comments with pictures, a ⋯ menu to pin or remove, and an About card and the members' faces on Home." },
    ],
  },
  {
    version: "v0.74.0",
    bump: "minor",
    date: "2026-10-22",
    changes: [
      { kind: "added", text: "Community is live: any account can start one for its church, NGO, school, club or association, at notesapp.name.ng/c/your-name. Free up to 200 members; Business has no limit and adds private Circles." },
      { kind: "added", text: "Members get the whole group: the General announcement channel (admins post, members like and comment), public and members-only Spaces, Events, the member list and Circles. Members-only posts never leave the community." },
      { kind: "added", text: "People who aren't members see a home page about you, and whatever your admins choose to show: General (read only, with slow mode for members), About, Contact, public events, the member list and a Join button." },
      { kind: "added", text: "Admin tools: join openly, by approval with join questions, or by invite link; approve requests; owner, admins and moderators; remove or ban; pin posts; slow mode; Spaces; insights (members, new joins, activity, most active); and View as a non-member, member, moderator or admin before you change anything." },
      { kind: "added", text: "Events for every account: Going and Interested, reminders 24 hours and 1 hour before (bell, phone and email), Add to calendar, weekly or monthly repeats, a Join live link (YouTube Live, Facebook Live, Zoom, Google Meet), and upcoming public events by state and city. A community's events can be for members only." },
    ],
  },
  {
    version: "v0.73.0",
    bump: "minor",
    date: "2026-10-22",
    changes: [
      { kind: "added", text: "Beauty and wellness kit for your site, in four flavours: Spa, Massage, Hair and Nails (Pro and above). It opens with a full photo and your words over it, lists your services as a menu with tabs, times and prices, each with Book now, and keeps a Book your appointment tab on every page. It replaces the Massage and spa and Salons kits; sites using those keep working." },
      { kind: "added", text: "Services can now carry minutes, a tab (Facials, Braids, Pedicure…) and a picture, on any site: they then show as a menu of cards." },
      { kind: "added", text: "A Night background for your site (any look but Scholar): a dark page with your colours glowing on it." },
      { kind: "added", text: "The Luxe look (Pro): your site opens with a full photo (your banner picture or your cover) with your words, buttons and social links over it, then everything under centred titles. Beauty and wellness and Fashion start on it; Fashion's Home now opens with Shop now and New arrivals, then Shop by category and New in." },
      { kind: "added", text: "Choose what your Home leads with: your shop, your services, your courses or your notes, first and with more of it, or a mix of everything (the default)." },
      { kind: "added", text: "A Check our services button for your banner, which jumps to your services menu. Beauty and wellness sites start with Book your appointment and Check our services." },
      { kind: "changed", text: "Your site's hours and contacts strip shows your email instead of your phone number (the phone number is only used by Call buttons). Your social links now also show in your site's footer." },
    ],
  },
  {
    version: "v0.72.0",
    bump: "minor",
    date: "2026-10-22",
    changes: [
      { kind: "fixed", text: "Courses on your site now open inside your site (on your own domain too), instead of sending visitors away to Notes Academy. Lessons and certificates still open on #NotesApp." },
      { kind: "fixed", text: "The shop on your site now looks like a shop on every look: New arrivals, category and Most popular links, a featured piece, a bar with the product count, search, sorting and bigger or smaller pictures, and picture tiles two to a row on phones, with Sold out and Only a few left. Fashion and beauty show tall photos, gadgets and parts show the whole product on white." },
      { kind: "added", text: "A basket for shops on your site: tap + on a picture (or Add to basket on an item's page), see the count in the header, change quantities, and pay for everything at once by card or bank with one delivery. Each item becomes its own order, held until its delivery is confirmed." },
      { kind: "added", text: "For shops: an announcement bar across the top of your site, the featured piece with its picture on the right, and, when the shop is your main page and you have a cover photo, the cover across the whole page with Shop now." },
      { kind: "changed", text: "No more Order on WhatsApp buttons on sites: orders and payments stay on #NotesApp, where buyers are protected. A button saved before becomes Contact us, and the kits' starter buttons now point to the shop, booking or Contact." },
      { kind: "fixed", text: "Pictures are now turned into WebP before they upload (journals, shop, site, profile, chats, moments, adverts): smaller files and faster pages, very large photos made smaller, and the hidden camera details left out." },
    ],
  },
  {
    version: "v0.71.0",
    bump: "minor",
    date: "2026-10-22",
    changes: [
      { kind: "added", text: "Journals in Kiswahili, with NKENNEAi: when the author ticks Offer this journal in Kiswahili, readers get 🌍 Kiswahili (the journal translated, with Show original) and 🔊 Sikiliza (it read aloud, female or male voice, at 0.75×, 1× or 1.25×). It's made the first time a reader asks and kept for everyone after; edit the journal and a fresh version is made next time. Not for subscriber-only posts." },
      { kind: "added", text: "Voice notes in Kiswahili: tap Transcript or Translate to English under someone's Swahili voice note, or In Kiswahili under your own English one. The words stay on the message for both of you." },
      { kind: "added", text: "Admin → Kiswahili (NKENNEAi): every call we make to NKENNEAi, its size and result, and how many readers were served from what we kept." },
    ],
  },
  {
    version: "v0.70.0",
    bump: "minor",
    date: "2026-10-21",
    changes: [
      { kind: "added", text: "Eight more kits for your site, each with its own look, colours, sections and starter words: Massage and spa, Salons and beauty, Fitness trainers, Events and photography, Electronics and mobile devices, Motor and motorcycle spare parts, Solar and energy solutions, and Real estate (Pro and above). The Fashion kit now covers clothes, bags, shoes and jewellery." },
      { kind: "added", text: "A cover photo across the top of your profile on your site, on every look, with your logo over its edge and your social links under your name." },
      { kind: "added", text: "Tag your team: add a person's #NotesApp @username in the Team section and their name links to their profile. Showing someone gives them no access to your account; team seats come with Business." },
    ],
  },
  {
    version: "v0.69.0",
    bump: "minor",
    date: "2026-10-21",
    changes: [
      { kind: "added", text: "Import your publications instead of typing them: upload the BibTeX file Google Scholar exports (or Zotero, Mendeley and others), add a paper by its DOI, or bring in your public works from ORCID. Nothing is added twice, your own edits stay, and you check the list before saving." },
      { kind: "added", text: "Keep in sync with ORCID: link your ORCID iD and new works on your record are added to your site's Publications every day." },
    ],
  },
  {
    version: "v0.68.0",
    bump: "minor",
    date: "2026-10-21",
    changes: [
      { kind: "added", text: "Inventory, under My account: every physical item and option with what's left, its SKU, cost price (private) and the level at which you want an alert, with totals for units in stock and stock value. Restock, take off or correct a count with a reason, and see the history of every change: sales, refunds, restocks and corrections." },
      { kind: "added", text: "Low-stock alerts: a notification when a sale takes an item to its low-stock level, or sells it out. Download your stock as a spreadsheet, edit it, and upload it back: you see every change and any problem before anything is saved." },
      { kind: "added", text: "Inventory is included on Business and Enterprise. Free Basic and Pro add it for ₦1,500 a month, after a free 15-day trial (no card). Organisation teammates who run the store can use it too." },
    ],
  },
  {
    version: "v0.67.0",
    bump: "minor",
    date: "2026-10-21",
    changes: [
      { kind: "added", text: "Free trials for everyone: try Pro or Business free for 15 days from Pricing, with no card (a verified email is needed). Each plan can be tried once." },
      { kind: "changed", text: "Trials are 15 days now, not 30, including the organisation Business trial and the logistics add-on's trial. A paid plan has to come between two free trials: after a trial you're back on the plan you pay for, or Free Basic, until you pay for one. Upgrading and downgrading work as before." },
    ],
  },
  {
    version: "v0.66.0",
    bump: "minor",
    date: "2026-10-21",
    changes: [
      { kind: "added", text: "The Scholar look for your site: plain and academic, a narrow page made for reading, with a light and dark switch that remembers each visitor's choice (and follows their phone's setting until they choose). From Free Basic, with every colour set." },
      { kind: "added", text: "Academic sections for any site, from Free Basic: Publications (by year, newest first, your name in bold among the authors, with links and labels such as Best paper), Awards, Talks on a globe visitors can turn (type the city and its dot appears), and In the news." },
      { kind: "added", text: "An Academics and researchers kit, free with Free Basic like Personal and creators: the Scholar look with your publications, talks, awards and news ready to fill in." },
    ],
  },
  {
    version: "v0.65.0",
    bump: "minor",
    date: "2026-10-21",
    changes: [
      { kind: "added", text: "Your own site now comes with Free Basic and Pro too, at notesapp.name.ng/s/your-name (your own domain stays with Business and Enterprise). Set it up on Your site, under Edit profile." },
      { kind: "added", text: "Kits: start your site from one made for what you do: Personal and creators (Free Basic), Fashion, Food & baking, Services and Healthcare (Pro), and Schools and Churches/NGOs (Business). A kit sets the look, colours, sections and starter words; it never overwrites what you've written." },
      { kind: "added", text: "The Clean look: white and rounded, with your main button in the header and a big banner with your picture. Every look now has colour sets (crimson, green, blue, purple, orange, gold, charcoal), and on Pro you can use your own brand colour. Every look and colour set comes on a white or a warm paper background, your choice." },
      { kind: "added", text: "New sections for any site: a banner with buttons (Book now, Order on WhatsApp, Call us, Shop, Contact or a link), opening hours and contacts with a map link, services and prices, a gallery, testimonials, your team and questions and answers. Switch each on or off and put them in your own order." },
      { kind: "added", text: "Your hours are connected to your booking calendar: the hours strip can show the times you take sessions, and tapping them opens your booking card. And a “Book me” card under every post on your site, if you switch it on." },
      { kind: "changed", text: "Which pages a site shows follows the plan: Journals, Shop and Courses from Free Basic (the shop pays your plan's store commission), Track from Business. The Legacy and Clean looks come with Free Basic; Aurora and Maroon with Pro." },
    ],
  },
  {
    version: "v0.64.0",
    bump: "minor",
    date: "2026-10-21",
    changes: [
      { kind: "added", text: "Analytics, under My account: what you earned after our fee, orders paid out of checkouts started, your average order, visits, a day-by-day chart, your best sellers and items running low, and tabs for Sales, Orders, Products, Customers, Visits and Promotion (your boosts and adverts). Every plan sees the last 7 days." },
      { kind: "added", text: "On Pro: the last 30 and 90 days, your customers (who bought, how much and when, most valuable first) and a download of your sales. On Business and Enterprise: visits by page and where visitors came from (WhatsApp, Instagram, search and more). Organisation teammates who run the store see its analytics too." },
    ],
  },
  {
    version: "v0.63.1",
    bump: "patch",
    date: "2026-10-21",
    changes: [
      { kind: "fixed", text: "When a CardTap wallet top-up can't start, Admin → Paylony now shows why: whether CardTap is switched on, and Paylony's own reply to each of the latest attempts." },
      { kind: "added", text: "The status page has a Wallet top-ups (CardTap) line: Operational when the latest top-up started, Down with Paylony's reason in a few words when it couldn't." },
    ],
  },
  {
    version: "v0.63.0",
    bump: "minor",
    date: "2026-10-21",
    changes: [
      { kind: "added", text: "Your profile pictures have a ⋮ menu when you look through them: make an old picture your profile picture again (no new upload), save one to your device, change it for a new one, or remove an old one from your history. On a computer, Make profile picture also sits at the top." },
    ],
  },
  {
    version: "v0.62.2",
    bump: "patch",
    date: "2026-10-20",
    changes: [
      { kind: "added", text: "Our Discord community, na-notesapp (discord.gg/bbkg47stW): ask the team and other members, hear about each release in #announcements, and talk API, MCP and Notes Life. Linked from the footer, Contact, About, the help centre and its articles, the API docs, the changelog, and Notes Life (its page, its FAQ and the game's Settings)." },
    ],
  },
  {
    version: "v0.62.1",
    bump: "patch",
    date: "2026-10-20",
    changes: [
      { kind: "fixed", text: "Calls, group invites, moments and online status work with the accounts every member follows automatically (@notesapp and the founders), even for members whose automatic follow was never saved. Before, someone who joined without the sign-up form's follow step saw “Following” on a founder's profile but couldn't call them." },
      { kind: "fixed", text: "Opening the profile of an automatically followed account now saves that follow if it was missing, so follower counts and lists include you." },
    ],
  },
  {
    version: "v0.62.0",
    bump: "minor",
    date: "2026-10-20",
    changes: [
      { kind: "changed", text: "Photos and videos in chats show as pictures only, like WhatsApp: no file name or size under them. Tap a photo (or the full-screen button on a video) to open it full screen inside #NotesApp, with Save and ×; the file's private link never opens in a new tab." },
      { kind: "changed", text: "Save on a photo or video downloads it where you are, without opening a tab." },
      { kind: "added", text: "Swipe between a chat's photos and videos in the full-screen viewer, oldest to newest, with “2 of 7” at the top; on a computer, use ‹ › or the arrow keys." },
      { kind: "added", text: "The full-screen viewer says who sent each photo or video and when, with ★ Keep and ↪ Forward at the top and ⋮ for the rest: go to the message in the chat, share it to another app (on a phone), save it, see all the chat's media, links and docs, or delete it for you." },
      { kind: "added", text: "Your own photos and videos in a chat can be posted as your moment, and your own photos made your profile picture, straight from the viewer. Someone else's can be kept, forwarded, shared or saved, never posted as yours." },
      { kind: "added", text: "Media, links and docs (in a chat's ⋮ menu): everything shared in the chat in three tabs. Photos and videos in a grid by month, newest first; documents with their size, who sent them and when; and every link with its preview. Press and hold, or tap Select, to forward, keep or delete several for you at once." },
    ],
  },
  {
    version: "v0.61.3",
    bump: "patch",
    date: "2026-10-20",
    changes: [
      { kind: "changed", text: "Terms of Service and Privacy Policy now sit on the footer's copyright line, beside © #NotesApp, instead of under the contact links." },
    ],
  },
  {
    version: "v0.61.2",
    bump: "patch",
    date: "2026-10-19",
    changes: [
      { kind: "changed", text: "We tell our story the way we see it: we started #NotesApp to fix our own pain, saw that our clients and their customers are one family, and built one home where everyone is welcome. The home page, search and social previews say it too." },
      { kind: "changed", text: "The About page reads like our pitch: the pain we started with, what we saw, what we built, why Nigeria and why now (with the numbers and where they come from), who's already here (Precheks, ApexGlitz and LWB), and where we're going, with a Talk to us button for investors, accelerators and partners." },
      { kind: "fixed", text: "Facts checked against their sources: Nigerians spent 1.3 billion hours listening on Spotify in 2025 (it said 1.4 billion), and what we say about Substack and Calendly is now exact (they take payment only through Stripe or PayPal, so there's no Naira checkout)." },
      { kind: "fixed", text: "The Weekly Digest is described as it is now: up to ten journals, your interests first, plus four Notes Market items and four Notes Academy courses (the home page, About, email settings and Admin said up to five journals)." },
    ],
  },
  {
    version: "v0.61.1",
    bump: "patch",
    date: "2026-10-19",
    changes: [
      { kind: "changed", text: "A tidier footer: the logo, our first customers, our email and pages, and Terms | Privacy on the left; then Product, Company (with Contact, Buy Domains and the Merch Store) and Connect (Gifts, Nana, help, Spaces, Circles, Community, encrypted 1-on-1 and group calls, Explore, Trending, parcel tracking, certificates and Notes Life)." },
      { kind: "added", text: "Encrypted calls (/calls): free 1-on-1 voice and video calls and group calls on one page, with the safety code, screen sharing on a computer, who can call you and what we keep." },
    ],
  },
  {
    version: "v0.61.0",
    bump: "minor",
    date: "2026-10-19",
    changes: [
      { kind: "added", text: "Group calls in group chats, free: tap the phone or camera at the top of a group to call everyone in it. Up to 6 people can talk, or 4 on video. Members get a ringing card with Join (and a notification), the chat shows Join call while it's going, and a line like “Group voice call · 12:03 · 4 people” when it ends." },
      { kind: "added", text: "Group calls go straight between the phones in the call, end-to-end encrypted, never through #NotesApp. Tap someone's picture in the call to compare your safety code with them." },
    ],
  },
  {
    version: "v0.60.0",
    bump: "minor",
    date: "2026-10-19",
    changes: [
      { kind: "added", text: "Calls show a safety code, like WhatsApp: tap “End-to-end encrypted” during a call to see 12 digits. The other person sees a code too; if both match, the call is encrypted between your two devices and nobody, not even #NotesApp, can listen in or watch." },
      { kind: "added", text: "Share your screen in a video call on a computer (Chrome, Edge, Firefox or Safari). The other person sees your whole screen; stop sharing and your camera comes back. Phones can't share their screen from the browser or the installed app yet." },
    ],
  },
  {
    version: "v0.59.0",
    bump: "minor",
    date: "2026-10-19",
    changes: [
      { kind: "added", text: "Top up your wallet with Paylony CardTap: choose Tap to pay with CardTap under Top up, paste the code into the CardTap app (or scan it), tap your bank card on your Android phone and enter your PIN. The credit, and any Bonus Credits, arrive by themselves." },
      { kind: "added", text: "CardTap's fee is passed on at cost, 1% of the top-up and never more than ₦1,000, shown before you pay. During the launch offer we pay it for you." },
    ],
  },
  {
    version: "v0.58.1",
    bump: "patch",
    date: "2026-10-19",
    changes: [
      { kind: "added", text: "A football ⚽ of our own in Messages: in the #NotesApp row of the 😊 emoji list and as a reaction. Type :football: and it shows as a picture once sent." },
    ],
  },
  {
    version: "v0.58.0",
    bump: "minor",
    date: "2026-10-19",
    changes: [
      { kind: "changed", text: "Boosts take turns: the Boosted strips show 3 at a time on a computer or tablet and 1 on a phone, and move to the next set every 45 seconds, waiting while your pointer is over them or they're off screen. Dots under the strip jump to a set." },
      { kind: "changed", text: "Adverts sit in one fixed 1200 × 628 frame everywhere, with a Learn more button, and each stays 30 seconds when a spot has several (only while it's on screen)." },
      { kind: "added", text: "New advert spots: Notes Market, Notes Academy, Explore, search results, free course pages, the weekly digest and, if the advertiser chooses, a billboard on the road in Notes Life. Never in Messages, checkout, lessons, paid course pages, certificates or the editors." },
      { kind: "added", text: "Advert sizes and spots (/advertise/specifications): the best picture size (1200 × 628 px), the safe area, the words, the Notes Life billboard (1600 × 900), where adverts show, how they rotate and how impressions are counted, with templates to download." },
      { kind: "changed", text: "The campaign form crops your picture to the right shape before you pay, keeps the headline to 60 characters and the text to 120, and asks for a billboard picture when you tick Notes Life." },
      { kind: "changed", text: "The weekly digest now has up to 10 journals, 4 Notes Market items and 4 Notes Academy courses, the week's most viewed on your interests first, with people you follow mixed in, and up to 3 sponsored slots: a boosted journal after the 2nd story, an advert after the 6th and a boosted item near the end. Each email sent counts as an impression and clicks from it are counted." },
      { kind: "added", text: "Admin → Ads: how many boosts show at once on computers and on phones, how long boosts and adverts stay, the promoted posts in the journal feed, the digest's sponsored slots, and each spot on or off, changed without a deploy." },
    ],
  },
  {
    version: "v0.57.3",
    bump: "patch",
    date: "2026-10-19",
    changes: [
      { kind: "changed", text: "The home page, About, Roadmap, Pricing, Nana, Organisations, Store selling and the help centre are up to date with paid courses, co-tutors, organisations teaching on Notes Academy and certificates, Nana's gems, weekly allowance and credit, the MCP server for AI assistants, the Academy tab, Explore's Market and Academy tabs, Saved, and Paylony CardTap in Notes Life." },
      { kind: "changed", text: "Nana can now point you to the certificate checker, Teach a course, Your academy, the Nana page, Notes Life and the install page." },
      { kind: "added", text: "The footer links to Check a certificate and Notes Life." },
      { kind: "changed", text: "The roadmap now lists what's coming next in Messages and for organisations: group calls for up to 6 people." },
      { kind: "fixed", text: "The weekly digest shows a paid course's price instead of Free." },
    ],
  },
  {
    version: "v0.57.2",
    bump: "patch",
    date: "2026-10-19",
    changes: [
      { kind: "added", text: "Coming soon: Community for churches, NGOs, schools and clubs (public and members-only Spaces, a General announcement channel, private Circles) and Events for every account, with reminders and Join live links. See the Community and Events pages and the roadmap." },
    ],
  },
  {
    version: "v0.57.1",
    bump: "patch",
    date: "2026-10-19",
    changes: [
      { kind: "fixed", text: "Home, About, the roadmap, Store selling and the help centre now say paid courses are live (Pro: text, PDFs and YouTube; Business and Enterprise: your own uploaded videos too, with co-tutors), instead of calling them next." },
    ],
  },
  {
    version: "v0.57.0",
    bump: "minor",
    date: "2026-10-19",
    changes: [
      { kind: "added", text: "The logistics network: logistics businesses list the states they cover, the areas they know, their services and a rate card by distance and weight. Stores find them on Find a delivery partner, message them, and choose one as their delivery partner." },
      { kind: "added", text: "With a delivery partner, buyers pay the partner's price for their address at checkout, the order goes straight to the partner, and it's tracked on the store's own Track page. Stores pay nothing for delivery; the partner is paid once delivery is confirmed." },
      { kind: "added", text: "The logistics add-on for Free Basic and Pro: Shipments and a listing in the network for ₦4,500 a month, with a 30-day free trial and no card. Business and Enterprise include it." },
      { kind: "added", text: "Store items can have a weight, so delivery partners' prices fit the parcel." },
    ],
  },
  {
    version: "v0.56.0",
    bump: "minor",
    date: "2026-10-19",
    changes: [
      { kind: "added", text: "Shipments for logistics businesses (Business and Enterprise): book deliveries, waybills, bulk deliveries, warehousing and home or office errands for your own customers, get a tracking number, send the receiver their link on WhatsApp or SMS, and hand the parcel rider to rider with the same no-login update links as store orders. Pick the services you offer: an errands company ticks errands, a full logistics company ticks everything. See For logistics businesses." },
      { kind: "added", text: "Your site has a Track section: a Track page and menu link, a tracking box on Home with your services, and a page for each shipment, on your own domain at /track. Only your shipments show there." },
      { kind: "changed", text: "Warehoused parcels read “In storage” until they're despatched, and errands read “On the way” and “Done”." },
      { kind: "fixed", text: "A member's site no longer shows a broken picture in its header, profile and footer when no profile picture has been added." },
    ],
  },
  {
    version: "v0.55.0",
    bump: "minor",
    date: "2026-10-19",
    changes: [
      { kind: "added", text: "Paid courses on Notes Academy. On Pro, sell courses with text lessons, PDFs and YouTube; on Business and Enterprise, upload your own videos too. Learners pay by card, bank transfer or wallet, keep the course for good on up to 2 devices, and can get a refund within 7 days if they haven't started. Uploaded videos never download, with each viewer's @username and email drifting across them. Your earnings, less the same fee as digital items, are paid 7 days after each sale." },
      { kind: "added", text: "Co-tutors: invite up to 4 by @username with their share of each sale; each one accepts, can edit the course, and is paid at their own plan's fee. Organisations' teams can teach as the organisation." },
      { kind: "added", text: "Every course page, free or paid, now shows its level, format and language, What you'll learn, How it works, Requirements and the tutors, in tabs (Overview, Curriculum, Tutors, Reviews), beside the price, This course includes, Share (WhatsApp, LinkedIn, X, Facebook) and the course details. Lessons can be grouped in modules, and live-class courses can share their class and WhatsApp group links with learners only." },
      { kind: "added", text: "Notes Academy lists free and paid courses, with a Topics list showing how many courses each topic and subtopic has, and Level and Price filters." },
      { kind: "fixed", text: "Review on a course page now opens the reviews and scrolls to them, on phones too." },
    ],
  },
  {
    version: "v0.54.0",
    bump: "minor",
    date: "2026-10-18",
    changes: [
      { kind: "added", text: "Notes Life: Paylony CardTap is our newest partner. Every Notesville Naira payment at a counter is now a tap: the merchant's phone shows who you're paying and how much, you tap your CardTap card, it beeps and approves. Food at Chef Adams, the Candellux, fares, petrol, the itel shop, Digital Witch courses and partner outlets. Game money only; buying N$ with NotesApp Credit is unchanged." },
      { kind: "added", text: "Your own CardTap card in the Central Bank of Notesville, a CardTap billboard on the Wuse road, “Tap to pay” on the Metro bus, and Paylony on the Partner with Notes Life page. Prefer no tap? Settings → Tap to pay with CardTap." },
    ],
  },
  {
    version: "v0.53.0",
    bump: "minor",
    date: "2026-10-18",
    changes: [
      { kind: "added", text: "Nana suggests topics from your title: a moment after you type a journal's or course's title, Nana offers topics and subtopics (#Tech › #ITSupport) to tap, or Add all. New subtopics are created when you save. Free, and not taken from your Nana allowance." },
      { kind: "added", text: "Market items can have a subcategory under their category (Shoes & bags › Tote bags), and Nana suggests both from the item's name." },
      { kind: "added", text: "Admin → Topics lists every subtopic and subcategory members have created, with how often each is used, to rename or remove." },
    ],
  },
  {
    version: "v0.52.0",
    bump: "minor",
    date: "2026-10-18",
    changes: [
      { kind: "added", text: "Like, save and review courses: ♥ and the bookmark on every course page and card (saved courses are under Saved → Courses), and What learners say, where learners who've done half the lessons give 1 to 5 stars and a few words. The teacher can reply once to each review. A course shows its stars once it has 2 reviews." },
      { kind: "added", text: "Recommendations now carry 1 to 5 stars, and the ones a person approves also show beside their journals and on their site's About page, not only on their profile." },
      { kind: "changed", text: "Store item reviews have the same new look: the average, how the stars split, a Bought it badge on each review and the seller's reply beneath it." },
    ],
  },
  {
    version: "v0.51.0",
    bump: "minor",
    date: "2026-10-18",
    changes: [
      { kind: "added", text: "Your certificate as a picture: Download image saves it as a PNG, and Copy image link gives you a link to paste into LinkedIn (Add media → Add a link) so the certificate shows on your profile." },
      { kind: "changed", text: "A shared certificate link now shows the certificate itself in its preview on LinkedIn, X and WhatsApp." },
      { kind: "changed", text: "Get your certificate, See your certificate and Set up your certificates now carry the Notes Academy cap icon instead of the 🎓 emoji." },
    ],
  },
  {
    version: "v0.50.0",
    bump: "minor",
    date: "2026-10-18",
    changes: [
      { kind: "added", text: "Notes Academy is in the phone tab bar, next to Market, with its own cap icon, and in the header and footer on a computer." },
      { kind: "added", text: "Explore now has Market and Academy tabs: the most looked-at products and courses this week, searchable, with a way into Notes Market and Notes Academy." },
      { kind: "fixed", text: "The header links no longer wrap onto two lines on narrower computer screens." },
    ],
  },
  {
    version: "v0.49.0",
    bump: "minor",
    date: "2026-10-18",
    changes: [
      { kind: "added", text: "#NotesApp's own emojis in Messages: the na mark and the Notes Academy cap, in the 😊 emoji list and as reactions. Type :na: or :academy: and they show as pictures once sent." },
      { kind: "added", text: "Your own quick reactions: tap ⇄ at the end of the reaction row to swap any of them for another emoji, from the list or typed on your keyboard. They're saved to your account, so they follow you to every device. React with any emoji, not just the six." },
      { kind: "added", text: "Forward several messages at once: Select them, then Forward (up to 10 at a time, in the order they were written)." },
      { kind: "added", text: "Delete for me: any message, yours or theirs, can go from your own view of a chat; everyone else still sees it. Delete now works on any selection: your own can still go for everyone." },
    ],
  },
  {
    version: "v0.48.1",
    bump: "patch",
    date: "2026-10-18",
    changes: [
      { kind: "changed", text: "Certificates: \"Certificate of completion\" is bigger and bolder, and everything from it to the completion date now sits at the exact centre of the certificate with a little more space between lines, leaving room for the academy's logo and subtext at the top." },
    ],
  },
  {
    version: "v0.48.0",
    bump: "minor",
    date: "2026-10-18",
    changes: [
      { kind: "added", text: "Notes Academy certificates: finish every lesson and tap 🎓 Get your certificate on the course page. Check your name, pay (card or wallet) and it's issued straight away with its own ID and QR code." },
      { kind: "added", text: "Anyone can check a certificate at notesapp.name.ng/certificates, by its ID or its QR code: genuine or revoked, for whom, which course and when. Add it to LinkedIn, share it on X or WhatsApp, or save it as a PDF." },
      { kind: "added", text: "Teachers set up their academy once: the name and logo on their certificates, who signs them (a photo of the signature, or the name in script), an accrediting institution (shown once we've checked it) and their own margin on top of our part of the price." },
      { kind: "added", text: "A late claim fee for certificates claimed more than 7 days after finishing a course, shown before you pay. Courses our team has reviewed carry the #NotesApp Certified Course seal." },
      { kind: "added", text: "Questions learners often ask, on every course page and in the help centre." },
      { kind: "changed", text: "The MCP server's own address, mcp.notesapp.name.ng, is live and now the one in the API docs (the old address still works)." },
    ],
  },
  {
    version: "v0.47.1",
    bump: "patch",
    date: "2026-10-18",
    changes: [
      { kind: "fixed", text: "Nana uses far less of your free allowance: each answer now reads only the help articles that match your question instead of the whole help centre, and the model prices used to work out costs are corrected. A Pearl answer now costs well under ₦2." },
      { kind: "added", text: "A help article on the #NotesApp MCP server, so Nana can explain how to use #NotesApp from your AI assistant." },
    ],
  },
  {
    version: "v0.47.0",
    bump: "minor",
    date: "2026-10-18",
    changes: [
      { kind: "added", text: "Nana's gems: Nana now runs on three models, Pearl (fast and light, every plan), Emerald (deeper answers, Business and Enterprise) and Ruby (our most capable, Enterprise). Choose the gem, and how long Nana thinks (Quick, Balanced or Thorough, by plan), from the button next to Nana's name in the chat." },
      { kind: "added", text: "A free Nana allowance on every plan, bigger on higher plans, that refreshes every week. The chat and the Nana page show what's left and when it refreshes." },
      { kind: "added", text: "Nana credit: anyone can buy it on the Nana page, by card or from your NotesApp Credit wallet. Your free allowance is used first, then your credit, which never expires." },
      { kind: "added", text: "Nana's answer bank: a general question someone has asked before is answered straight away, free, without using your allowance. Personal questions never go in." },
    ],
  },
  {
    version: "v0.46.1",
    bump: "patch",
    date: "2026-10-17",
    changes: [
      { kind: "fixed", text: "Opening the MCP server's address (mcp.notesapp.name.ng) in a browser now goes to the MCP docs instead of showing a technical message. AI assistants connect as before." },
    ],
  },
  {
    version: "v0.46.0",
    bump: "minor",
    date: "2026-10-17",
    changes: [
      { kind: "added", text: "The #NotesApp MCP server, phase 1: AI assistants that support MCP (Claude, ChatGPT and others) can find creators, journals, Notes Market items and Notes Academy courses, show a creator's open session times and share booking links. It only reads; booking, buying and paying happen on #NotesApp. Address and tools in the API docs." },
      { kind: "added", text: "With your API key, your assistant can also read your own profile, journals, bookings, orders and earnings (the key's permissions apply). Every call is logged." },
      { kind: "added", text: "A booking link can open the booking card on a chosen date and time, so a shared open time is one tap from booking." },
    ],
  },
  {
    version: "v0.45.1",
    bump: "patch",
    date: "2026-10-17",
    changes: [
      { kind: "changed", text: "Your social links are easier to find: on your own profile, a pencil beside your link icons (or \"+ Add your social links\" when you have none) opens Edit profile at Social links, and Account settings links there too." },
      { kind: "fixed", text: "Edit profile no longer runs wider than a phone screen." },
    ],
  },
  {
    version: "v0.45.0",
    bump: "minor",
    date: "2026-10-17",
    changes: [
      { kind: "added", text: "Forward a message to up to five of your chats at once; it shows \"Forwarded\". Files go with it. Your own message can also start a new journal draft." },
      { kind: "added", text: "Keep: save any message to Saved → From chats, a list only you can see, with a link back to the chat. If the sender deletes the message, it leaves your list too." },
      { kind: "added", text: "#NotesApp links in messages show as cards: a journal (Read), a store item with its price (Buy), a free course (Enrol) or a profile." },
      { kind: "added", text: "Nana in your chats: \"Summarise\" tells you what you missed when a chat has five or more new messages (or any time, from the chat's menu), and Translate puts a message into English, Pidgin, Yorùbá, Igbo or Hausa." },
      { kind: "fixed", text: "A long link no longer pushes a message bubble past the edge of a phone screen." },
    ],
  },
  {
    version: "v0.44.0",
    bump: "minor",
    date: "2026-10-17",
    changes: [
      { kind: "added", text: "Chat essentials: react to any message (👍 ❤️ 😂 😮 😢 🙏). The reactions show under the bubble; tap one to add yours or take it off, and the sender gets a bell." },
      { kind: "changed", text: "Every message has one menu: right-click on a computer, hold it on a phone, or tap ⋯. Reactions on top, then Reply, Copy, Pin, Message info (when it was sent and read; in a group, who has read it), Select, Edit and Delete." },
      { kind: "added", text: "Select several messages to copy them together or delete your own in one go (read ones still wait for the readers to agree)." },
      { kind: "added", text: "Search: the Messages list has a search box (names, @handles, group names and the last message), and \"Search in this chat\" finds words and file names in a conversation, with ↑ ↓ to step through." },
      { kind: "added", text: "Filters above your chats: All, Unread, Groups, and Bookings and Orders for chats with people you have a session or a store order with." },
      { kind: "changed", text: "Files show as cards with the type, size, Open (PDFs) and Save; pictures and videos have Save under them." },
      { kind: "added", text: "On a phone, swipe a message to the right to reply to it." },
    ],
  },
  {
    version: "v0.43.0",
    bump: "minor",
    date: "2026-10-17",
    changes: [
      { kind: "added", text: "Profile pictures, like Facebook: tap someone's picture to see their profile pictures, newest first, and swipe (or use ‹ ›) through the older ones, with the date of each. Pictures are kept from your next change on; you can take an old one out of your history." },
      { kind: "changed", text: "In the journal feed, your own picture has the same + as on your profile: change your picture, add a moment or see yours." },
      { kind: "added", text: "For the team: a work item can be assigned to several people at once. Tick each person, or Select all; everyone on it gets the bell, the deadline reminders, the comments and the item in their morning summary. Meeting invites have Select all too." },
      { kind: "added", text: "For the team: work items can repeat every month. \"Done this month\" moves the due date on a month and the reminders start again, so a monthly check never drops off the board." },
      { kind: "fixed", text: "Social links show on every profile, not just some: an address without https://, an @handle or a WhatsApp number now works, and Edit profile tells you if a link can't be read." },
    ],
  },
  {
    version: "v0.42.0",
    bump: "minor",
    date: "2026-10-17",
    changes: [
      { kind: "added", text: "Notes Academy is open with free courses. Any publishing account can teach: lessons from your own YouTube (they play right on #NotesApp) and written lessons, under your topics, with a cover. Learners enrol free, videos tick themselves off once watched, and progress is kept." },
      { kind: "added", text: "Courses show on Notes Academy (For you, Most viewed, New, Continue learning), on your profile's Courses tab, in Trending's Courses tab, on Business and Enterprise sites and in the weekly digest." },
      { kind: "added", text: "Pricing: the two Enterprise course packages (Enterprise Courses, and the Enterprise Academy API for a white-label academy of your own), and the certificate price for free courses." },
      { kind: "changed", text: "The Team hub, company finance tools, the investor data room and advertising on LinkedIn from #NotesApp are being tested with our own team and will be paid add-ons for Business and Enterprise afterwards. The roadmap, pricing and help pages say so." },
      { kind: "changed", text: "The home page, About, Roadmap, Pricing, Status and help centre are up to date with everything above, and prices on them follow the live prices." },
      { kind: "changed", text: "Signing in from a link (for example Enrol on a course) brings you back to where you were." },
    ],
  },
  {
    version: "v0.41.0",
    bump: "minor",
    date: "2026-10-17",
    changes: [
      { kind: "changed", text: "On a phone, a profile keeps showing ✓ Following once you follow, as on a computer." },
      { kind: "changed", text: "A profile's Notes tab shows journals the way the journal feed does, with likes, comments, shares, views and save." },
      { kind: "added", text: "Trending shows a picture beside every journal and store item." },
      { kind: "fixed", text: "Journals saved with only the writer's name (some older posts and official channel posts) now show the right @username, badges and link, instead of a link that went nowhere." },
      { kind: "changed", text: "The Weekly Digest: the #NotesApp mark in the title, each story's views, and two new sections when there's something to show: the most viewed and most bought in Notes Market, and the same for Notes Academy once courses open." },
      { kind: "added", text: "Business and Enterprise sites: a Your site page to set them up, a third theme (Maroon, with your notes as posts like the journal feed), a choice of what shows (Journals, Shop, Courses), and About and Contact pages written with the journal editor." },
    ],
  },
  {
    version: "v0.40.0",
    bump: "minor",
    date: "2026-10-17",
    changes: [
      { kind: "changed", text: "A new look on phones and computers. On a phone: one light header with search, your notifications and your picture (which opens the menu), and a tab bar along the bottom (Feed, Explore, Market, Messages, Profile). On a computer the journal feed has a menu on the left and Most read and Who to follow on the right." },
      { kind: "changed", text: "Journals is a feed with four tabs: For you (your interests first), Following, Latest and Top this week. Most read this week, Who to follow, boosted journals (marked Promoted) and adverts sit between the posts. Like, comment, share and save straight from the feed." },
      { kind: "added", text: "Explore: topics, people and channels, which used to be tabs of Journals." },
      { kind: "added", text: "Save journals with the bookmark; they're listed in Saved with your saved store items." },
      { kind: "changed", text: "Messages and calls have a new look: a conversation fills the screen on a phone, and calls show the person's picture large, with clear buttons." },
      { kind: "changed", text: "The verified badge suggestion is based on your plan: what to add on your plan, or that Business includes it." },
      { kind: "added", text: "Notes Market at /shop: every store on #NotesApp in one place, in the same order (For you, Most viewed, New), with digital items, categories and a list of stores." },
      { kind: "added", text: "Notes Academy at /academy: where courses will live. Publishers can tell us they want to teach." },
      { kind: "changed", text: "Profiles have Notes, Store and Courses tabs, and the buttons Follow, Book a session, Conversation and Gift me. On a phone, Follow steps aside once you follow someone." },
      { kind: "changed", text: "Trending has Notes, Store, Courses and Publishers tabs, with your interests first among the topics." },
      { kind: "changed", text: "Wherever a picture and a name appear together, the person's badges come right after the name, before their @username." },
      { kind: "changed", text: "When a publisher hasn't set up payouts, Gift me is greyed out with an ℹ️ that explains why (hover or tap it)." },
    ],
  },
  {
    version: "v0.39.0",
    bump: "minor",
    date: "2026-10-17",
    changes: [
      { kind: "added", text: "Choose your interests: pick the topics you want to read about, and journals on them come first in your feed (For you) and in your weekly digest." },
      { kind: "added", text: "Writers pick up to 3 topics for each journal from one shared list of hashtags, and can add their own hashtags." },
      { kind: "changed", text: "Topics are one list across #NotesApp, so #FinTech, fin tech and Fintech are the same topic. Older journals are filed under the topics their categories and tags mean." },
      { kind: "changed", text: "The Topics tab groups topics (Business and money, Tech, Health and wellbeing and more) with yours first, and the hashtags at the end of a journal open that topic." },
    ],
  },
  {
    version: "v0.38.0",
    bump: "minor",
    date: "2026-10-16",
    changes: [
      { kind: "fixed", text: "Comments always show the real name and picture of the person who wrote them: comments are now saved by #NotesApp's server, which reads who you are from your account." },
      { kind: "fixed", text: "Notifications can only come from #NotesApp itself, so nobody can send you a fake one. Liking, unliking and liking again sends one notification, not several." },
      { kind: "changed", text: "Limits on how often something can be done (posting, sending, signing in) now hold across all of #NotesApp's servers, not each one separately." },
      { kind: "changed", text: "Journals belong to their author's account rather than their name, so changing your display name never separates you from your posts." },
      { kind: "added", text: "Admins: a Weekly digest page to preview the digest, send yourself a test and switch the Sunday send on or off." },
    ],
  },
  {
    version: "v0.37.0",
    bump: "minor",
    date: "2026-10-16",
    changes: [
      { kind: "added", text: "When someone @mentions you in a comment or reply, a published journal, a moment, a store review or a seller's reply, or an approved recommendation, you get a notification with a few words around the mention. Once per person for each thing; never for mentions in messages, group chats or Notes Life chat; not when either of you has blocked the other." },
      { kind: "added", text: "The #NotesApp Weekly Digest: on Sunday evenings, up to five journals from the week, from people you follow first and then the topics you like, with the writer's picture, the opening of each story, reading time, likes and comments. Unsubscribe with one click from any digest, or under Emails in Account settings." },
      { kind: "added", text: "#NotesApp works the same on each of our web addresses, and keeps the address you typed. Payments bring you back to the address you paid on." },
      { kind: "fixed", text: "Link previews in Messages are now checked again at the moment they connect, so a web address can't be used to reach anything other than a public website." },
    ],
  },
  {
    version: "v0.36.0",
    bump: "minor",
    date: "2026-10-16",
    changes: [
      { kind: "added", text: "Web addresses become links people can tap, everywhere members write: messages, comments, journals, moment captions, reviews, recommendations, profile bios and Notes Life chat. Type candelluximperialhotel.com, www.… or a full https:// address." },
      { kind: "added", text: "Messages show a preview card under a message with a web address in it: the page's picture, title, description and site." },
      { kind: "added", text: "Type @ in a journal, a comment, a reply, a message, a moment caption or Notes Life chat and NotesApp suggests members as you type: pick one with ↑ ↓ and Enter, or a tap. @username links to their profile everywhere it shows." },
      { kind: "added", text: "Notes Life: a stay at the Candellux Imperial Suite. The room is yours till checkout at 11 AM game time (check in from 6 AM and it runs to 11 AM the next day), even while you swim or leave the hotel. Every time you're in the room, Energy, Hygiene, Bladder and Fun go to 100%: rest an hour or sleep up to 8 hours." },
      { kind: "added", text: "Room service: while you're staying, food from the Candellux restaurant comes up to your suite and fills you up (Hunger to 100%)." },
      { kind: "changed", text: "Notes Life plays a soft tune in your hotel suite, at the VIP bar and in class at the Digital Witch hub, and NEPA's noise (the generators, light going and coming back) stays out of all three." },
    ],
  },
  {
    version: "v0.35.0",
    bump: "minor",
    date: "2026-10-16",
    changes: [
      { kind: "added", text: "Notes Life: Digital Witch joins as a partner. Its training hub is on the ground floor of the Skyscraper Plaza in the Central Business District (Go → Digital Witch hub), with classrooms you can see through the glass." },
      { kind: "added", text: "Ekwutosi Cynthia Okeh, the founder of Digital Witch, is in the game as #1 on the Billionaires List. Meet her at the hub from 9 AM to 5 PM and at the Candellux VIP bar from 7 PM to 11 PM." },
      { kind: "added", text: "Digital Witch courses: Virtual Assistant and Customer Support (N$ 60,000, 4 classes), Social Media Management (N$ 80,000, 5), Project Management (N$ 100,000, 5), Data Analysis and UI/UX Design (N$ 120,000, 6). One class is 2 game hours at the hub, 9 AM to 6 PM. Finish every class to get Digital Witch certified." },
      { kind: "added", text: "New tech jobs, all from your desk: remote virtual assistant, remote customer support, social media manager, remote project coordinator, data analyst and UI/UX designer, each with its Digital Witch certificate." },
      { kind: "added", text: "Cynthia's graduate giveaway: on Saturday nights at the VIP bar, certified players with 10 tech shifts can go up to her once a week for a chance at N$ 500,000 or N$ 1,000,000." },
      { kind: "changed", text: "Tech jobs now need a Digital Witch certificate, including Tech freelancer (any certificate). Players who already have a tech job keep it. Digital Witch adverts are at the Wuse bus stand, and Digital Witch is on the Partner with Notes Life page." },
    ],
  },
  {
    version: "v0.34.0",
    bump: "minor",
    date: "2026-10-15",
    changes: [
      { kind: "added", text: "Notes Life: chat with your friends inside the game. Players who follow each other on NotesApp can chat from Phone → Friends, or by tapping a friend at the same place. It's the same chat as your NotesApp Messages. Each message you send gives +8 Social (+12 when you're at the same place) and each reply +4, up to +40 an hour." },
      { kind: "added", text: "Unread messages from friends show on the Phone button and the Friends tile in the game. On desktop the chat sits on the right while the game keeps running." },
      { kind: "changed", text: "The platform numbers and the revenue report for the team are counted at most once an hour and every 15 minutes, with a Refresh now button, instead of being read in full every time. The help centre, About page, app description and Nana now use one standard description of #NotesApp. On phones, the conversation header in Messages stays at the top while you scroll." },
    ],
  },
  {
    version: "v0.33.0",
    bump: "minor",
    date: "2026-10-15",
    changes: [
      { kind: "added", text: "Notes Life: choose your city when you start. Abuja is open, with the City Gate; Lagos (the National Theatre) and Port Harcourt (Isaac Boro Park) are coming soon, and “Tell me when it opens” lets you know first. New players arrive with a Welcome to Abuja screen at the City Gate by night." },
      { kind: "added", text: "A new Candellux Imperial, built from the real hotel: the glass and stone wings, the tower with its roof sign, the gate, walls and palms, by day and by night. Turn round the back to the pool: green turf, the blue mosaic pool, the pergola and rattan sofas, the pool bar, the VIP bar and the gym tower." },
      { kind: "added", text: "Swimming: get in the pool with other players and residents. Swimming lessons with Coach Femi (N$ 15,000) build your swimming skill, and after 3 lessons you can use the deep end. A day pass is N$ 25,000." },
      { kind: "added", text: "The pool bar (N$ 10,000) and the VIP bar (N$ 11,500), where you meet the richest residents on the Billionaires List. Who's in changes every 4 game hours; say hello to chat." },
      { kind: "added", text: "New Candellux jobs: swimming instructor (N$ 8,000 a shift plus a lesson bonus, needs swimming skill 5) and gym instructor (N$ 8,500, after 10 gym sessions). Lifeguards earn a rescue bonus of up to N$ 1,500, and staff pay half price at the pool bar too." },
      { kind: "added", text: "More from the real Chef Adams menu: chicken shawarma (N$ 3,500), pizza to share (N$ 6,000), and Sum Ting Fresh banana smoothies, cold-pressed juice and yoghurt parfait, with new Chef Adams billboards on the street." },
      { kind: "changed", text: "Solar panels on the roofs of Candellux, its gym, itel Energy and Chef Adams. Candellux's services panel has Services, Pool and Jobs tabs with photos of the real hotel." },
      { kind: "fixed", text: "The Chef Adams mascot was cut off on the shop sign." },
    ],
  },
  {
    version: "v0.32.0",
    bump: "minor",
    date: "2026-10-14",
    changes: [
      { kind: "added", text: "Notes Life: Become a Partner. Own a Chef Adams Takeaway Kiosk (from N$ 2.5m) or Mini Dine-In Shop (from N$ 8.0m), or an itel Home Store (from N$ 1.5m) or Mall Store (from N$ 7.0m), in Wuse or Garki. Residents run it while you're away, it stands in Notesville with your name on it, and you collect the takings at the outlet or in Phone → Businesses." },
      { kind: "added", text: "New jobs at itel Energy (sales attendant with a Power GO bonus, CarlCare technician, solar installer, store supervisor) and Candellux (front desk, waiter with tips, housekeeping with a staff meal, lifeguard, cook, duty manager), with staff perks: 20% off itel products, half price at the Candellux pool, gym and VIP bar." },
      { kind: "added", text: "A fridge and a microwave. Keep takeaway and cooked plates for later: without a cold fridge they spoil after 8 game hours. The itel Power Tank 1000 keeps the fridge cold about 5 game hours in a blackout, charged by 650W bifacial solar panels." },
      { kind: "added", text: "Billboards on the roads for Chef Adams, itel Energy and the #1MillionNairaNotesAppChallenge. Tap one to open it." },
      { kind: "added", text: "Become a real partner: the Partner tabs link to the Chef Adams franchise and itel Home pages." },
      { kind: "changed", text: "Chef Adams, itel Energy and Candellux each have Jobs tabs, and the Jobs list is grouped by employer. The itel shop uses the official itel logo." },
      { kind: "changed", text: "The Terms and the Privacy Policy cover partner outlets: they are game features paid in Notesville Naira and give no right in the real business, and your outlet's sign shows your first name to players nearby. The Notes Life page has a Become a Partner section, real screenshots from the game and two more cards." },
      { kind: "added", text: "Partner with Notes Life (life.notesapp.name.ng/partners): what businesses get in the game, our partners (Chef Adams, itel Energy, Candellux Imperial), and a button that opens the contact form on Partnership with a message ready to fill in." },
    ],
  },
  {
    version: "v0.31.0",
    bump: "minor",
    date: "2026-10-14",
    changes: [
      { kind: "added", text: "Pin up to 3 messages in a conversation (any member in a one-to-one chat, admins in a group). Pinned messages sit in a bar at the top of the chat; tap one to jump to it." },
      { kind: "added", text: "Pin up to 3 chats, with a person or an organisation, to the top of your Messages inbox with 📌. Only you see your pinned chats." },
      { kind: "added", text: "See when someone is writing: “…typing” in a one-to-one chat, and who is typing in a group." },
      { kind: "added", text: "Edit or delete your own messages from the ⋯ menu. While nobody has read a message it changes straight away; once it has been read, everyone who read it is asked to allow the change first. Changed messages say “edited”, and deleted ones show “This message was deleted”. Requests nobody answers are wiped after 30 days." },
      { kind: "added", text: "Video calls: drag your own picture to any corner, tap it to swap it with the other person's, and switch between your front and back camera with 🔄." },
      { kind: "added", text: "Calls ring on the installed #NotesApp app even when it isn't open on your screen: the notification keeps buzzing and sounding for the length of the call, with Answer and Decline." },
      { kind: "changed", text: "Times across #NotesApp now use the 12-hour clock (for example 3:05 pm)." },
      { kind: "fixed", text: "Notes Life sounds were too quiet to hear on many phones, and sometimes didn't start at all. They are louder and clearer now, play even when your phone is on silent mode where the phone allows it, and Settings has a ▶ Test sound button." },
    ],
  },
  {
    version: "v0.30.0",
    bump: "minor",
    date: "2026-10-14",
    changes: [
      { kind: "added", text: "Notes Life: NEPA takes light. Power cuts hit every player at the same moment, a few times a game day: no lamp, no fan, no desk work on an old desktop, hot nights. Generators roar down the street, and when light returns: UP NEPA!" },
      { kind: "added", text: "itel Energy, a new partner shop on the Wuse market road: the Power GO Pro (lamp, fan and laptop through a blackout, silent) and a 100W solar panel that charges it by day, with the small home kit coming. The real Power GO Pro is on NotesApp from @clickam." },
      { kind: "added", text: "Generators from the market: “I Better Pass My Neighbour” 950W and a big 3.5kVA that runs the AC too. Buy petrol, pull the cord, and the neighbours hear it." },
      { kind: "added", text: "Residents: computer players, marked 🤖, around Wuse, Chef Adams, itel Energy and Candellux. Chat with them for Social (kept on your device). The richest are on the Billionaires List, with a Real players only switch." },
      { kind: "added", text: "See real players at the same place (Chef Adams, Candellux, itel Energy, the street, a ride) and tap to message them on NotesApp. You can hide yourself in Settings." },
    ],
  },
  {
    version: "v0.29.0",
    bump: "minor",
    date: "2026-10-14",
    changes: [
      { kind: "added", text: "Notes Life has sound: taps, money, the ringing deal phone, water, cooking, travel, plus birds by day, crickets at night, street traffic and lounge music at Candellux. A mute button at the top and volume sliders (volume, effects, surroundings) in Settings. No sound files are downloaded." },
      { kind: "added", text: "Your invites: the Invite panel lists everyone who joined from your link and whether your ₦250 bonuses are paid, waiting for their first shift or waiting for their email. An Invite button sits under the clock." },
      { kind: "fixed", text: "Buying Notesville Naira by card or bank in Notes Life did nothing when you had money in your NotesApp wallet. It now goes straight to Paystack." },
      { kind: "changed", text: "A friend who hadn't verified their email at their first shift now gets the invite bonus (and so do you) after a later shift once they have." },
      { kind: "changed", text: "Back to NotesApp in Notes Life saves your game and takes you to your journal feed on app.notesapp.name.ng." },
    ],
  },
  {
    version: "v0.28.1",
    bump: "patch",
    date: "2026-10-14",
    changes: [
      { kind: "fixed", text: "Right after you verify your email, sending messages and starting calls work straight away, instead of still saying \"Verify your email first\" for up to an hour." },
      { kind: "fixed", text: "Ending, declining or missing a call no longer needs a verified email, so the call is always closed properly." },
      { kind: "changed", text: "The verify-email message now says where to find the link and how to resend it, and the yellow bar says that messages and calls need a verified email too." },
    ],
  },
  {
    version: "v0.28.0",
    bump: "minor",
    date: "2026-10-14",
    changes: [
      { kind: "added", text: "Notes Life, first playable: a free life game you play with your NotesApp account at life.notesapp.name.ng. Start in a room in Wuse, Abuja with N$ 100,000, keep six needs up, work general and Chef Adams jobs, take deal calls on your bedside phone, pay rent to Alhaji Bello and climb the Billionaires List." },
      { kind: "added", text: "In the game: eat from @chef_adams by delivery, takeaway or dine-in, or buy a cooker and cook; upgrade to a laptop or all-in-one PC, an inverter AC, a smartphone deal line, an e-bike or an electric car; get around by bicycle, bus, keke or taxi; and treat yourself at Candellux Imperial in Garki." },
      { kind: "added", text: "Invite friends from your phone's contacts by WhatsApp or SMS: when a friend joins from your link and finishes their first shift, you each get ₦250 in NotesApp Bonus Credit. Share your wins on WhatsApp." },
      { kind: "added", text: "Buy Notesville Naira with your NotesApp Credit wallet or a card (₦1 = N$ 100). Your money and what you own are kept on our servers; your progress saves on your device and to your account, with restore points from the last day and week." },
      { kind: "added", text: "A help article, How Notes Life works, and a Notes Life section in the Terms and the Privacy Policy." },
      { kind: "changed", text: "The Terms and the calls help article now say plainly that calls go over your internet connection: NotesApp doesn't charge for them, but your mobile network charges its usual data rates." },
    ],
  },
  {
    version: "v0.27.0",
    bump: "minor",
    date: "2026-10-14",
    changes: [
      { kind: "added", text: "NotesApp Credit wallet: top up from ₦1,000 to ₦500,000 through Paystack and pay for boosts, the verification badge, ad campaigns, gifts, shop items, downloads and paid sessions without entering your card each time. Find it under your name → Wallet." },
      { kind: "added", text: "Bonus Credits on larger top-ups (₦250 on ₦5,000, ₦700 on ₦10,000, ₦2,000 on ₦20,000, ₦6,000 on ₦50,000 or more). They last 90 days, are spent first, and work on boosts, badges and advert banners." },
      { kind: "added", text: "When you pay and have something in your wallet, you choose Wallet or Card, with the total and how it splits between bonus and credit. Shop items and sessions paid from the wallet are held until delivered or held, like card payments, and refunds go back to your wallet." },
      { kind: "added", text: "A wallet statement with filters (Top-ups, Spent, Bonus, Held, Refunds), a help article, and the wallet in your data download." },
    ],
  },
  {
    version: "v0.26.0",
    bump: "minor",
    date: "2026-10-14",
    changes: [
      { kind: "added", text: "Call back: tap any call line in a one-to-one conversation (missed, declined or finished) to call that person again, the same kind of call." },
      { kind: "added", text: "Calls are now on the Status page, which shows whether calls and the relay that carries them on strict networks are working." },
      { kind: "added", text: "A help article on voice and video calls: making and answering calls, missed calls, who you can call, privacy, and what to try when a call won't connect. Calls are also described on the home, About, Pricing, Roadmap, Privacy, Terms and Security pages." },
      { kind: "changed", text: "When a call ends, the connection details the two devices exchanged are removed, and deleting your account now also deletes your call records." },
      { kind: "added", text: "Group moderation: group admins have a Manage button at the top of the group, and can remove any message (everyone sees \"Message removed by a group admin\" in its place, and its files are deleted). Members who aren't admins are told who the admins are. When #NotesApp acts on a reported group message, it is removed the same way." },
      { kind: "fixed", text: "Tapping Start the group twice, or a slow connection sending it again, no longer creates the same group twice." },
      { kind: "fixed", text: "If a follow or unfollow doesn't go through, the button now says so instead of doing nothing, and the Follow button no longer stays on a loading bar when the check fails." },
    ],
  },
  {
    version: "v0.25.0",
    bump: "minor",
    date: "2026-10-13",
    changes: [
      { kind: "added", text: "Free voice and video calls in Messages, between people who follow each other. Tap the phone or camera at the top of a conversation. Calls go straight between your phones; every call leaves a line in the conversation, and a missed call sends you a notification." },
      { kind: "added", text: "Messages: each open conversation now starts with the person's picture, their name with badges beside it, and their online status below. A small arrow opens a menu: view profile, view moments, create a group, mute notifications, block and report. Mute turns off the bell, push and email for that one conversation." },
      { kind: "added", text: "Groups look like a channel at the top, with the group picture and the number of members. Group admins can set the group picture, switch member messages off (only admins can write) and on again, and ban people who misbehave, then unban them later." },
      { kind: "added", text: "For the team: the work board can show everyone's work, what is assigned to you or to one person, or what is not assigned; a strip shows what is overdue across the team; people are told when they are given an item, and reminded 3 days and 1 day before it is due, on the day and when it is overdue." },
      { kind: "added", text: "For the team: a staff library (SOPs, the employee handbook, policies and templates, with \"I have read this\" confirmations), a message hub for staff messages with To, Cc, files and an optional email copy, an assignee and pay-by date on every payment due, and a Payroll page for finance." },
    ],
  },
  {
    version: "v0.24.0",
    bump: "minor",
    date: "2026-10-13",
    changes: [
      { kind: "added", text: "Followers and Following lists on every profile. Open either one to see the people and organisations, 30 at a time." },
      { kind: "added", text: "Online now and last seen, on Messages, in a conversation and on profiles. You see it only for people who follow you and whom you follow back." },
      { kind: "added", text: "Two privacy switches, both on to start with: show when you're online, and let signed-in members see your followers and following. If you switch one off, you can't see other people's either. Find them under Profile, Account and in your message settings." },
      { kind: "added", text: "You can cancel a running boost from Boost performance. Impressions already delivered are spent; you get half of the undelivered share back and forfeit the other half. If #NotesApp cancels a boost, the whole undelivered share is refunded and you are told why." },
      { kind: "added", text: "For the team: the owner can make @na-notesapp follow, or stop following, the founders and their business channels from the profile page, and the list shows on @na-notesapp's profile." },
    ],
  },
  {
    version: "v0.23.0",
    bump: "minor",
    date: "2026-10-12",
    changes: [
      { kind: "added", text: "The app address (app.notesapp.name.ng) now signs you in and creates your account right on its welcome screen, with no pop-up and no trip to another site, and stays on the app address for Explore, Help, Terms and Privacy." },
      { kind: "added", text: "A Download button on the welcome screen that knows your device: Download on mobile on a phone or tablet, Download on PC on Windows, Download on Mac on a Mac. It opens /install with the steps for your phone, tablet or computer and your browser, and a one-click install where your browser offers it." },
      { kind: "added", text: "Drag and drop, and paste, for pictures and files: in messages, store item photos and files, journal and note editors, your profile picture and ads." },
      { kind: "added", text: "An eye button on every password field (sign up, sign in, changing your password) to show or hide what you typed." },
      { kind: "added", text: "An organisation's admins can add and edit the organisation's store items to help the owner. Deleting items, orders and money stay with the owner and members given store access." },
      { kind: "changed", text: "Store item descriptions can now be up to 1,200 characters (they were 400). Store pages show a short preview and the item page shows all of it." },
      { kind: "added", text: "For the team: meetings can be set up for a team or chosen people (only they see it), Nana and Granola can suggest the decisions and actions from a meeting for you to approve, and a team member gets the #NotesApp team badge as soon as they are added." },
    ],
  },
  {
    version: "v0.22.2",
    bump: "patch",
    date: "2026-10-11",
    changes: [
      { kind: "changed", text: "Trending, Top store items now always fills up to ten: items that have been looked at come first, then the newest items nobody has opened yet, marked New." },
    ],
  },
  {
    version: "v0.22.1",
    bump: "patch",
    date: "2026-10-11",
    changes: [
      { kind: "added", text: "Store owners can now choose the item shown at the top of their store as Featured: under Your store, press ☆ Feature on an item (★ Featured to remove it). Without a pick, the most saved and viewed item is shown as before." },
      { kind: "changed", text: "Item views in stores now use the same 👁 as Trending." },
      { kind: "fixed", text: "A member's own site (Business and Enterprise) stopped loading its notes, and the More notes list, when the member had no profile picture. It now loads without one." },
    ],
  },
  {
    version: "v0.22.0",
    bump: "minor",
    date: "2026-10-11",
    changes: [
      { kind: "added", text: "For the team: Granola is connected to the team hub. Each team member connects their own Granola account, lists their recent meetings, asks their meeting notes questions (answers keep Granola's links to the source notes), and ticks the follow-ups they want added to this week's work. We keep only an encrypted access key and read notes from Granola when asked, without storing them." },
    ],
  },
  {
    version: "v0.21.0",
    bump: "minor",
    date: "2026-10-11",
    changes: [
      { kind: "added", text: "For the team: a Pricing page in the admin area where the owner and super admins set the prices of Pro and Business, what we take from sessions, subscriptions, gifts and sales on each plan, what publishers earn from ads, the badge and gold prices, and the boost and ad packages. New prices show on every page and checkout straight away, people already subscribed keep the plan price they bought, and every change is logged." },
    ],
  },
  {
    version: "v0.20.0",
    bump: "minor",
    date: "2026-10-11",
    changes: [
      { kind: "added", text: "For the team: Expenses due on the team hub and the money ledger. Bills, renewals and free plans about to turn paid are listed soonest first with what they cost in naira, reminders go out 14, 7, 3 and 1 days ahead, on the day, and once when overdue, and marking one paid records it as an expense in the ledger." },
      { kind: "changed", text: "Grants & subscriptions now lead with naira values, at the rate entered on each grant, with the dollar figure beside them. Grants can be recorded as waiting for approval (ElevenLabs is there now) and switched on when they are approved." },
    ],
  },
  {
    version: "v0.19.1",
    bump: "patch",
    date: "2026-10-11",
    changes: [
      { kind: "changed", text: "The With thanks section on the home and About pages now shows what the programmes are worth together: up to $11,920 in credits and free plans, with how it adds up." },
    ],
  },
  {
    version: "v0.19.0",
    bump: "minor",
    date: "2026-10-11",
    changes: [
      { kind: "added", text: "Store reviews: people who bought an item, and received it, can give it 1 to 5 stars and a few words. Reviews show on the item page marked Verified buyer, a store's page shows what buyers say across all its items, and sellers can reply once to each review. You can edit or remove your own review." },
      { kind: "added", text: "Recommendations on profiles and organisations: write a few sentences about someone you have worked with, bought from or learned from. It shows on their profile only after they approve it, and they can hide it later." },
      { kind: "added", text: "Trending has a third tab, Top store items, ranking items by what buyers look at and save, with ratings." },
      { kind: "changed", text: "Sign in, Sign up, Reset password, Booking, Bookings, Orders, Edit profile, Account settings, Rates & payouts and Boosts now use the crimson banner and rounder buttons and fields." },
    ],
  },
  {
    version: "v0.18.0",
    bump: "minor",
    date: "2026-10-11",
    changes: [
      { kind: "added", text: "Behind the scenes, for the team: a Grants & subscriptions page tracks the free credits and plans we hold (what each is worth, how much is used, the rate per seat, when it ends and what it costs afterwards), and sends finance and the owner a reminder 30, 14, 7, 3 and 1 days before each ends, and on the day." },
      { kind: "changed", text: "More pages now wear the crimson look from our new designs, with the same banner at the top: Security, Contact, Roadmap, Changelog, Badges, Brand, Gifts, Domains, Advertise, Boost, Organisations, Trending, Store selling, Challenge, Services, Teams, Docs, Status, Co-authoring, Merch, Terms and Privacy." },
      { kind: "added", text: "The money ledger can now record a grant as in-kind: free credit or a free plan is counted on its own line, not as cash." },
    ],
  },
  {
    version: "v0.17.0",
    bump: "minor",
    date: "2026-10-11",
    changes: [
      { kind: "added", text: "Site themes for Business and Enterprise: choose how your own site looks under Edit profile → Your site's theme. Legacy is the original look and stays the default, so nothing changes unless you choose. Aurora is the new look: a deep crimson band with your profile on a card, a shop with categories and a featured item, notes with a crimson heading, and a reading page with your booking card, author card and gift card beside the article. You can switch back at any time, and preview your site before you decide." },
      { kind: "added", text: "With thanks: a section on the About and home pages thanking the programmes that back us, with their logos: Claude Startups (12 months of Claude Team and $1,000 in API credits), Moda (3 months of Pro and up to $3,000 in AI credits) and Granola (3 months of Business for up to 10 seats)." },
      { kind: "changed", text: "On your own site, people now get a circle picture and organisations a rounded square, as everywhere else." },
      { kind: "fixed", text: "In Moments, the poster's picture and name now show at the top when you open someone's moments from their profile picture." },
    ],
  },
  {
    version: "v0.16.1",
    bump: "patch",
    date: "2026-10-10",
    changes: [
      { kind: "changed", text: "Pricing: the comparison table has a crimson header with white bold plan names and prices, alternating white and ivory rows, and on a phone the Feature column stays in view while you scroll across the plans. The plans also show as five cards under the heading, and a dark band shows what #NotesApp takes on each rung." },
      { kind: "changed", text: "About: the money section is now a dark band and the trust and safety list a card; the “still to come” line no longer lists social publishing, which is live for LinkedIn and X. Help ends with an Ask Nana or contact the team card. Messages on a phone sit in a card." },
      { kind: "fixed", text: "On a phone, the journal page no longer scrolls sideways because of the date and views lines." },
    ],
  },
  {
    version: "v0.16.0",
    bump: "minor",
    date: "2026-10-10",
    changes: [
      { kind: "changed", text: "Moments on a phone now fill the screen: the picture or video runs edge to edge, with your progress bars, name and picture on top and your reply box on the bottom. Tap the left side to go back and anywhere else to go on. Quick reactions (❤️ 🔥 👏 😂 😮) sit above the reply box, and like, reshare and report are round pills." },
      { kind: "changed", text: "Your own moments: on a computer you now see your views, likes and reshares as big numbers, a Who watched list that is already open, a list of your other moments to jump between, and a Delete button. On a phone, tap the 👁 pill for the same list." },
      { kind: "changed", text: "Journal pages on a computer have a side column next to the article: a crimson Book a session card, the author with Follow and Message, a gift card and more journals from the same author. On a phone the same cards sit under the article." },
    ],
  },
  {
    version: "v0.15.1",
    bump: "patch",
    date: "2026-10-10",
    changes: [
      { kind: "changed", text: "The home page opens with the #1MillionNairaNotesAppChallenge in full crimson: the title, the numbers (100k views, 10k followers, ₦1,000,000 giveaway), the campaign artwork and Nana. The first card in “Why we're different” is now a featured crimson card." },
      { kind: "changed", text: "The app address (app.notesapp.name.ng) welcome screen: the challenge in crimson on the left, with a Welcome to NotesApp card on the right to create an account or sign in, and links to Explore, Pricing and Help." },
    ],
  },
  {
    version: "v0.15.0",
    bump: "minor",
    date: "2026-10-10",
    changes: [
      { kind: "changed", text: "A new look in #NotesApp crimson: the top bar, a crimson banner on the About, Pricing, Help and Track a parcel pages (Help shows Nana), a bolder challenge banner on the home page, and a call to action opening the footer on every page. Nana, boosts and adverts stay where they were." },
      { kind: "changed", text: "Profiles now open with a header card on a crimson band. People's pictures are circles and organisations' pictures are rounded squares, on profiles, stores, item pages, messages, journals and the Moments row." },
      { kind: "changed", text: "Messages on a wide screen: your conversations stay on the left while the open conversation (or Nana) is on the right. On a phone, each is its own page, as before." },
      { kind: "changed", text: "Moments on a computer: a wide viewer with the people you follow on the left (tap to jump between them), the moment in the middle, and on the right who posted it, Follow and Message, quick reactions (❤️ 🔥 👏 😂 😮, which like the moment and send the emoji to their inbox) and details about the moment." },
    ],
  },
  {
    version: "v0.14.0",
    bump: "minor",
    date: "2026-10-10",
    changes: [
      { kind: "added", text: "Store categories: sellers file each item under a category (Fashion & clothing, Shoes & bags, Beauty & care, Jewellery & accessories, Home & living, Food & drinks, Electronics, Books & courses, Art & crafts, Other), and shoppers can filter a store by category." },
      { kind: "added", text: "Save items with the heart: tap ♡ on an item in any store or on its page to save it, and find your list under Saved items in your menu. Only you can see what you saved. Sellers see how many people saved each item." },
      { kind: "added", text: "What buyers check more: each store shows its most viewed items, and the item page shows how many people have looked at it and saved it. Your own visits to your own items are not counted." },
      { kind: "added", text: "Ships from: every physical item now says where it is sent from (for example Lekki, Lagos), on the store, on the item page and before you pay. Sellers are asked for it when they add or edit an item." },
      { kind: "changed", text: "Redesigned store and item pages: a store header with the seller's picture (a circle for people, a rounded square for organisations), a featured item, category filters, bigger item photos and a clearer buying panel, with more items from the same store underneath." },
    ],
  },
  {
    version: "v0.13.3",
    bump: "patch",
    date: "2026-10-10",
    changes: [
      { kind: "changed", text: "Adding sizes to a store item is now one entry at a time: type the size and how many pieces you have, tick ✔ to save it, and add the next (for example L: 2, then XL: 5). Saved entries are listed with the total in stock, and you can edit or remove any of them. You can add up to 60 entries, and a size or colour can have up to 20 choices instead of 5." },
    ],
  },
  {
    version: "v0.13.2",
    bump: "patch",
    date: "2026-10-10",
    changes: [
      { kind: "added", text: "Roadmap: voice is planned. A Listen button on every journal, Nana reading her answers aloud, and voice notes and booked sessions turned into text. Not built yet, no date." },
      { kind: "changed", text: "The status page now says why the Claude AI line is down (key rejected, rate limited, or not reachable) instead of only showing Down." },
    ],
  },
  {
    version: "v0.13.1",
    bump: "patch",
    date: "2026-10-10",
    changes: [
      { kind: "fixed", text: "Asking Nana how to connect your own AI account now gets the right answer; before, she pointed to the own-domain article. The help centre has new articles on Nana AI and on connecting your own AI account." },
      { kind: "changed", text: "Help articles look better: the article sits on a card with a larger opening paragraph, section headings, and a Sources list that can link to other websites. A new article, Who is Emmanuel Adams?, cites his #NotesApp profile, his website and his social accounts as sources." },
      { kind: "changed", text: "The roadmap is up to date: Nana AI and the help centre, publishing to LinkedIn and X, group chats and account data tools are marked live; what is still ahead (team hub for Business and Enterprise, AI notetaker, more networks, calls, apps) is listed separately. The About page now lists Emmanuel Adams as Founder, CEO & CTO." },
      { kind: "changed", text: "The Contact page now points to Nana AI and the help centre for quick questions, before the form." },
    ],
  },
  {
    version: "v0.13.0",
    bump: "minor",
    date: "2026-10-09",
    changes: [
      { kind: "added", text: "Nana AI: a helper you can ask anything about #NotesApp, from the chat button on every page, from a conversation pinned at the top of your Messages, and on her own page. She answers in plain words with links to the right page, and if she can't help she passes you to a person, who follows up by email. Members are recognised automatically; visitors give a name and email first." },
      { kind: "added", text: "A help centre at /help: short articles on getting started, plans and pricing, publishing and earning, selling, badges, organisations, and safety and your data, with search. Nana answers from the same articles, and our team can write and correct them. If the AI is ever off or unavailable, Nana still answers from these articles." },
      { kind: "added", text: "Writing help from Nana: in the journal composer (improve, shorten, expand, friendlier, more professional, or turn notes into a draft), when you share to LinkedIn or X (she writes the words, you edit them), and in a conversation (suggest a reply or polish your message). You always see the result first and decide whether to use it." },
      { kind: "added", text: "Connect your own AI account on the Nana page: paste an Anthropic API key and Nana, the writing help and the team hub use your account, so you can use them today. The key is checked, kept encrypted, never shown again, and deleted when you disconnect or delete your account." },
      { kind: "added", text: "In a conversation, when someone asks to meet or book a session, Nana's suggested reply can offer your next open times (from the availability you set, minus what is already booked) with your booking page link, so they can book and pay straight away. It only does this if you take paid sessions and have a payout account." },
      { kind: "changed", text: "Limits only apply when we pay for the AI. Using your own connected AI account, Nana and the writing help have no daily or hourly limit from #NotesApp; our free allowance covers only what runs on our account." },
      { kind: "added", text: "Claude by Anthropic, the AI behind Nana, now appears on the status page and among our partners and integrations on the home and About pages." },
      { kind: "added", text: "The team hub has an Ask Nana panel for our team: she knows how the hub and admin tools work and can see your open items, so you can ask what to focus on today." },
      { kind: "changed", text: "Privacy Policy: now explains Nana chats (kept, with the name and email a visitor gives), that your text is sent to Anthropic when the AI is on or you ask for writing help (and is not stored by us), and how your own AI key is kept. Chats you have while signed in are in your data download and deleted with your account." },
    ],
  },
  {
    version: "v0.12.0",
    bump: "minor",
    date: "2026-10-09",
    changes: [
      { kind: "added", text: "Tell us a little about you, if you like: what you do, your role (for example CEO) and where you work. You can add it when you sign up or any time in Edit profile, and it shows under your name on your profile, for example “CEO at Acme”. It is optional and you can clear it whenever you like." },
      { kind: "changed", text: "We describe #NotesApp more simply: a home where African creators, professionals and businesses publish, build an audience and get paid in Naira. The home page, About page, footer and search descriptions are updated, and the lists of what you can do now include group chats." },
      { kind: "changed", text: "Pricing: the gold badge costs the same on every plan, so it is no longer a row in the table. It has its own paragraph beside “Why stores don’t link out”, with its prices and the link to the badges page." },
      { kind: "added", text: "A page for the team hub and team messaging (coming to Business and Enterprise after our own team has tested them), linked from the roadmap, pricing and the footer." },
      { kind: "added", text: "Members who joined before the “What do you do?” question existed get a one-time, optional prompt under the header. They can answer, choose “Not now” (it comes back in 30 days) or “Don’t ask again”." },
      { kind: "changed", text: "Under a reader’s name the profile now says “Viewer” instead of “Member”; publishers keep their plan, for example “Pro Publisher”." },
      { kind: "changed", text: "Our description of #NotesApp, on the home page and in search and social previews, now reads: where African creators, professionals, coaches, consultants, therapists and businesses publish, build an audience and get paid in Naira." },
      { kind: "changed", text: "Privacy Policy: now says that these optional lines appear on your public profile and are counted, without names, to help us understand who our members are." },
      { kind: "changed", text: "The admin menu groups related pages together (Workspace, Content, People & trust, Money, Growth, Platform), and a money ledger for our team sits in the team hub. Nothing changes for members." },
    ],
  },
  {
    version: "v0.11.0",
    bump: "minor",
    date: "2026-10-09",
    changes: [
      { kind: "added", text: "Publish to LinkedIn and X from your own post: connect once, see the words we suggest (an excerpt with a link back to the full journal), change them, then press Post. Nothing goes out until you do, and you can disconnect any time. It switches on as soon as our LinkedIn and X apps are approved; until then the share menu still works as before." },
      { kind: "added", text: "Status page: a new line shows whether sharing to LinkedIn and X is connected." },
      { kind: "added", text: "Roadmap: LinkedIn advertising from #NotesApp (boost a post on LinkedIn from your own ad account), under review." },
      { kind: "changed", text: "Behind the scenes, our own team now works with roles and departments, so each person sees only what their job needs. Nothing changes for members." },
    ],
  },
  {
    version: "v0.10.2",
    bump: "patch",
    date: "2026-10-09",
    changes: [
      { kind: "changed", text: "Terms of Service and Privacy Policy updated for group chats (who can see what, who can be added, leaving, reports) and for sharing your posts to LinkedIn or X (what we ask for, what we keep, how to disconnect). You will be asked to accept them before your next payment." },
      { kind: "changed", text: "The top menu no longer lists Booking (it is in the footer and on every profile), which also fixes the logo and menu overlapping on medium-width screens. Tablets now use the Menu button, like phones." },
      { kind: "fixed", text: "Deleting your account now removes you from the groups you are in (another member takes over as admin when needed) instead of leaving your name in them, and removes any connected LinkedIn or X access." },
    ],
  },
  {
    version: "v0.10.1",
    bump: "patch",
    date: "2026-10-09",
    changes: [
      { kind: "changed", text: "A post's preview (on cards, in search and when shared to LinkedIn, Facebook and WhatsApp) now shows the opening of the post as plain words, without formatting marks or image links." },
      { kind: "changed", text: "Sharing a post to X now carries the title and the opening of the post, trimmed to fit, with the link back to the full journal." },
    ],
  },
  {
    version: "v0.10.0",
    bump: "minor",
    date: "2026-10-09",
    changes: [
      { kind: "added", text: "Group chats: start a group from Messages with people you follow or who follow you (up to 50). Everyone in the group sees each message with the sender's name and picture; pictures, files, voice notes, stickers, replies and the emoji button all work. Group admins can rename it, add and remove people and make others admin; anyone can leave, and any message from someone else can be reported." },
      { kind: "changed", text: "Messages now lists groups next to your conversations, with the number of members and who said what last." },
    ],
  },
  {
    version: "v0.9.13",
    bump: "patch",
    date: "2026-10-09",
    changes: [
      { kind: "changed", text: "The Domains page and roadmap now say Whogohost (go54) is our domain partner. Domain sales are still being built and can't be bought yet." },
    ],
  },
  {
    version: "v0.9.12",
    bump: "patch",
    date: "2026-10-09",
    changes: [
      { kind: "changed", text: "The app address welcome screen on tablets and computers now shows the #1MillionNairaNotesAppChallenge announcement on the left, with sign-up and sign-in on the right." },
    ],
  },
  {
    version: "v0.9.11",
    bump: "patch",
    date: "2026-10-09",
    changes: [
      { kind: "changed", text: "The app address welcome screen is split in two on tablets and computers: the brand on the left, sign-up and sign-in on the right." },
      { kind: "fixed", text: "Picture uploads on the app address (app.notesapp.name.ng) showed “Failed to fetch”: the storage settings now allow that address too." },
    ],
  },
  {
    version: "v0.9.10",
    bump: "patch",
    date: "2026-10-08",
    changes: [
      { kind: "added", text: "An app address (app.notesapp.name.ng): it opens on a welcome screen to create an account or sign in, goes straight to your journal if you are already signed in, and shows only the app: Journals, Messages, Bookings and Trending." },
      { kind: "changed", text: "Domains now appears under “Learn more about each product” on Pricing, and Store selling and Domains are in the footer’s Product list." },
    ],
  },
  {
    version: "v0.9.9",
    bump: "patch",
    date: "2026-10-08",
    changes: [
      { kind: "added", text: "A Domains page: what domain sales and DNS management will look like, with our domain partner Whogohost (now go54). Not live yet." },
      { kind: "changed", text: "The roadmap lists domain sales and DNS management for Business and Enterprise." },
    ],
  },
  {
    version: "v0.9.8",
    bump: "patch",
    date: "2026-10-08",
    changes: [
      { kind: "added", text: "Messages: an emoji button before Bold, Italic and Underline. Pick an emoji and it goes into your message where the cursor is." },
    ],
  },
  {
    version: "v0.9.7",
    bump: "patch",
    date: "2026-10-08",
    changes: [
      { kind: "changed", text: "Messages: the message box now says “Start or reply a conversation”." },
    ],
  },
  {
    version: "v0.9.6",
    bump: "patch",
    date: "2026-10-08",
    changes: [
      { kind: "changed", text: "Messages: people on the #NotesApp team now show the team badge beside their verified or gold badge, in conversations and in the inbox." },
    ],
  },
  {
    version: "v0.9.5",
    bump: "patch",
    date: "2026-10-08",
    changes: [
      { kind: "added", text: "Messages: reply to a particular message. The reply quotes it, and tapping the quote takes you back to the original." },
      { kind: "changed", text: "Messages: a picture beside every message, the name with its verified or gold badge, and a Today, Yesterday or date divider whenever a new day starts. Received messages are now easier to see." },
      { kind: "added", text: "Tapping someone's picture in a conversation, a journal or a comment now asks whether you want their profile, their moments, or to message them." },
      { kind: "fixed", text: "A picture that failed to load once could stay on the default picture. It now tries again when the picture changes." },
    ],
  },
  {
    version: "v0.9.4",
    bump: "patch",
    date: "2026-10-08",
    changes: [
      { kind: "changed", text: "The About page now covers Moments and private messages (voice notes, stickers, files), who can see your moments, and how reports and suspensions work. The Contact page says where to report a moment or a conversation." },
    ],
  },
  {
    version: "v0.9.3",
    bump: "patch",
    date: "2026-10-08",
    changes: [
      { kind: "changed", text: "The #1MillionNairaNotesAppChallenge artwork now sits on the right of the home page banner and opens the challenge page." },
      { kind: "added", text: "The full #NotesApp wordmark is now a sticker you can send." },
      { kind: "changed", text: "The roadmap links to the challenge page for its details." },
      { kind: "changed", text: "We updated the Privacy Policy and Terms (moments privacy, voice notes, files and stickers). You will be asked to accept the new version before your next payment." },
    ],
  },
  {
    version: "v0.9.2",
    bump: "patch",
    date: "2026-10-08",
    changes: [
      { kind: "changed", text: "Device notifications are now on by default: if your browser has allowed them we turn them on for you, and if not we offer once (you can turn them off in Messages and we won't turn them back on)." },
      { kind: "added", text: "The #1MillionNairaNotesAppChallenge artwork is now a sticker you can send." },
      { kind: "changed", text: "Rates & payouts: Earnings now comes straight after Your plan." },
      { kind: "changed", text: "Privacy Policy, Terms, Trust & security, Pricing, the home page and the roadmap now cover moments privacy (who can see your moments and how to change it), voice notes, stickers, files in messages and the per-plan limits." },
    ],
  },
  {
    version: "v0.9.1",
    bump: "patch",
    date: "2026-10-08",
    changes: [
      { kind: "added", text: "Journals: a Moments card, like Status in WhatsApp. See your own moments (with a + to add one) and a tile for each person you follow who has shared one." },
      { kind: "added", text: "Profile settings: choose who can see your moments, your followers only (the default) or everyone." },
      { kind: "changed", text: "Journals: the first channel card is now “NotesApp Premium channel”, the second is “Public Channels”, and the channels are listed under it." },
    ],
  },
  {
    version: "v0.9.0",
    bump: "minor",
    date: "2026-10-08",
    changes: [
      { kind: "added", text: "Messages: record and send voice notes of up to 5 minutes with the new microphone button beside Send." },
      { kind: "added", text: "Messages: send stickers. Every #NotesApp icon on the Brand page, including the seasonal ones, is a sticker." },
      { kind: "added", text: "The #1MillionNairaNotesAppChallenge artwork is now on the Brand page." },
    ],
  },
  {
    version: "v0.8.4",
    bump: "patch",
    date: "2026-10-08",
    changes: [
      { kind: "fixed", text: "Turning on device notifications could fail with “The provided applicationServerKey is not valid”. The notification settings are now checked, stray spaces and quotes are ignored, and the status page says exactly which setting needs fixing." },
    ],
  },
  {
    version: "v0.8.3",
    bump: "patch",
    date: "2026-10-08",
    changes: [
      { kind: "changed", text: "The roadmap and the home page now list Moments and private messages as live, with what each one does." },
      { kind: "changed", text: "The status page now says that file storage covers files sent in messages, and that scheduled jobs include moment clean-up, the daily reports digest and the lifting of timed suspensions." },
    ],
  },
  {
    version: "v0.8.2",
    bump: "patch",
    date: "2026-10-08",
    changes: [
      { kind: "fixed", text: "On phones the menu was missing: only an Explore button showed. There is now a Menu button with every page, search, and sign in or your account." },
      { kind: "changed", text: "Messages and replies to moments now use the 💬 icon (on profiles, in notifications and in the moment viewer), and re-sharing a moment uses 🔁." },
    ],
  },
  {
    version: "v0.8.1",
    bump: "patch",
    date: "2026-10-08",
    changes: [
      { kind: "fixed", text: "Moments: watching a video that was split into parts is lighter on your device: the parts now play from one download instead of fetching the same video again for each part, and each moment is counted as seen once." },
      { kind: "fixed", text: "Moments: if a video can't be loaded you now see a message instead of nothing." },
    ],
  },
  {
    version: "v0.8.0",
    bump: "minor",
    date: "2026-10-08",
    changes: [
      { kind: "added", text: "Messages: make text bold, italic or underlined, and see when each message was sent (one tick) and when it was read (two ticks), with the times." },
      { kind: "added", text: "Messages: attach pictures, videos and documents. How big and how many depends on your plan." },
      { kind: "added", text: "Moments: the bars at the top now fill in maroon as each moment plays, so you can see how much is left." },
      { kind: "fixed", text: "Moments: a wide video, such as a side-by-side duet, now fits inside the viewer instead of being cropped." },
    ],
  },
  {
    version: "v0.7.7",
    bump: "patch",
    date: "2026-10-07",
    changes: [
      { kind: "changed", text: "Suspensions can now be for a set time (from a day to a year), and the member is told when theirs ends. The account comes back by itself when the time is up." },
      { kind: "changed", text: "Reports about nudity or violence are now sent to our team straight away, so we can meet our 24-hour promise." },
    ],
  },
  {
    version: "v0.7.6",
    bump: "patch",
    date: "2026-10-07",
    changes: [
      { kind: "changed", text: "When our team reviews a report, they can now suspend the reported member in one step. The member is told why, and can appeal as usual." },
    ],
  },
  {
    version: "v0.7.5",
    bump: "patch",
    date: "2026-10-07",
    changes: [
      { kind: "fixed", text: "Very wide or tall videos and pictures in Moments no longer spill outside the viewer; they now fit inside it." },
    ],
  },
  {
    version: "v0.7.4",
    bump: "patch",
    date: "2026-10-07",
    changes: [
      { kind: "changed", text: "Email for new messages is now off until you switch it on, and is part of the Business and Enterprise plans (at most one email an hour). Everyone still gets the bell, and notifications on their device if they turn them on." },
    ],
  },
  {
    version: "v0.7.3",
    bump: "patch",
    date: "2026-10-07",
    changes: [
      { kind: "fixed", text: "Opening a conversation could crash the Messages page on newer browsers (“n is not a function”). Fixed." },
    ],
  },
  {
    version: "v0.7.2",
    bump: "patch",
    date: "2026-10-07",
    changes: [
      { kind: "added", text: "Moments: a video longer than 90 seconds is no longer refused. It is cut into equal parts of up to 90 seconds, shared as separate moments in order, using one of your plan's weekly video moments for each part. If you don't have enough left, only the first 90 seconds of as many parts as you have room for is used, and you're told before you share which it will be." },
      { kind: "fixed", text: "Messages now shows what went wrong, and records it, instead of replacing the page, and a phone holding an out-of-date copy of the site after an update reloads itself once instead of showing an error." },
    ],
  },
  {
    version: "v0.7.1",
    bump: "patch",
    date: "2026-10-07",
    changes: [
      { kind: "fixed", text: "Profile pages (and so Moments on profile pictures) could freeze phones and laptops: the page kept re-loading a member's notes and follower count over and over in the background. It now loads them once." },
    ],
  },
  {
    version: "v0.7.0",
    bump: "minor",
    date: "2026-10-07",
    changes: [
      { kind: "added", text: "Moments: share a picture, a video of up to 90 seconds or text with your followers from your profile picture, for 24 hours (or 48 or 72), with an optional voice-over. Followers can like, reshare or reply; everything disappears when the time is up. Video moments depend on your plan." },
      { kind: "added", text: "Messages: a message button on profiles and an inbox that updates live. Replies to a moment land there, marked as a reply to a moment that has expired once it has. You hear about new messages by bell and email (you can turn the email off), and can block a member or report a moment or conversation." },
      { kind: "added", text: "The #1MillionNairaNotesAppChallenge page: how influencers can unlock LIVE video and open a ₦1,000,000 giveaway. It opens when live video does." },
      { kind: "added", text: "Enterprise sites on their own domain now have fully branded sign-in and sign-up windows in the site owner's name and logo (still clearly a NotesApp account), with password-reset and confirmation emails sent in the site owner's name and opening on their domain." },
      { kind: "added", text: "The status page now covers messages and moments, and device notifications." },
      { kind: "changed", text: "The Terms of Service and Privacy Policy now cover moments, messages, reports and blocking. You'll be asked to accept the new version before your next payment." },
    ],
  },
  {
    version: "v0.6.4",
    bump: "patch",
    date: "2026-10-06",
    changes: [
      { kind: "fixed", text: "On a member's own domain, Follow, Subscribe, sign-in prompts and “My orders” links no longer trigger blocked cross-origin requests in the browser console; they now open the #NotesApp page with a normal page load." },
      { kind: "fixed", text: "The status page's Video courses check now asks Cloudflare for the account's storage usage, so it no longer reports Down when Stream is fine." },
    ],
  },
  {
    version: "v0.6.2",
    bump: "patch",
    date: "2026-10-06",
    changes: [
      { kind: "added", text: "Sites on your own domain (Business and Enterprise) now have their own Terms of Service and Privacy Policy at /terms and /privacy, written in the site owner's name, linked from the footer, and carrying a “powered by #NotesApp” note." },
      { kind: "changed", text: "Pricing now reads “free forever” under Free Standard and Free Basic, and “Starting from ₦55,000+/month, or ₦550,000+/year (2 months free)” for Enterprise." },
    ],
  },
  {
    version: "v0.6.1",
    bump: "minor",
    date: "2026-10-06",
    changes: [
      { kind: "added", text: "Your own domain is now on Business as well as Enterprise: serve your page, journals and store on notes.yourbrand.com or yourbrand.com. On Business it is semi white-label — the footer reads “Your name is powered by #NotesApp” and emails go out under #NotesApp's name on your behalf. The Console is for connecting your domain; the API, keys and webhooks stay Enterprise-only." },
      { kind: "changed", text: "Enterprise now starts at ₦55,000/month, and its site footer reads “Your name, powered by” with the #NotesApp icon (Business keeps “Your name is powered by #NotesApp”)." },
      { kind: "added", text: "The status page now monitors video courses (Cloudflare Stream)." },
    ],
  },
  {
    version: "v0.6.0",
    bump: "minor",
    date: "2026-10-06",
    changes: [
      { kind: "changed", text: "New store commissions: physical items 6% on Free Basic, 4% on Pro, 2.5% on Business and from 1% on Enterprise; digital downloads 9%, 6%, 4% and from 1.5%. Enterprise starts at ₦35,000/month. Sessions, subscriptions and gifts are unchanged." },
      { kind: "added", text: "View-only files and video courses (Pro and above): add a digital item as “View only”, then add video and PDF lessons. Buyers watch and read them on #NotesApp with no download, on up to 2 devices per purchase with unlimited sessions; a third device is refused and each blocked attempt is counted. Videos are hosted on Cloudflare Stream and play only with short-lived links." },
      { kind: "added", text: "The pricing table now shows team seats and parcel tracking for each plan; About and Organisations describe the shop, the no-login parcel log and Enterprise." },
    ],
  },
  {
    version: "v0.5.8",
    bump: "minor",
    date: "2026-10-05",
    changes: [
      { kind: "added", text: "The Merch Store page now lists every publisher's shop that has something to buy right now, under Individual Shops: boosted shops first, then the most recently stocked, with search and “Show more”. A shop on its own domain opens there. Switch yours off under Rates & payouts." },
    ],
  },
  {
    version: "v0.5.7",
    bump: "patch",
    date: "2026-10-05",
    changes: [
      { kind: "added", text: "Direct links to a profile's booking card and subscribe button: add #book or #subscribe to the profile address (for example /u/yourname#book) and the page opens scrolled to it." },
    ],
  },
  {
    version: "v0.5.6",
    bump: "patch",
    date: "2026-10-05",
    changes: [
      { kind: "fixed", text: "On a custom domain whose front page is set to the shop, the Home page again shows your profile (logo, name with badges, bio, social icons, followers, Follow and Gift) above the shop instead of opening a bare shop page." },
      { kind: "changed", text: "The Boost page now lists your store items alongside your posts, so a seller with no posts can boost products from there." },
      { kind: "changed", text: "Custom domains: besides the DNS records, we now suggest pointing the domain's nameservers at Vercel, the easiest route when a domain isn't hosted anywhere yet or the provider won't take the record." },
    ],
  },
  {
    version: "v0.5.5",
    bump: "minor",
    date: "2026-10-05",
    changes: [
      { kind: "added", text: "Store items can have up to 5 photos, shown as a gallery on the item page." },
      { kind: "added", text: "Physical items can have up to two options such as Size and Colour, each with up to five choices. Stock is kept per combination, sold-out choices are crossed out, and the seller sees which option was ordered." },
      { kind: "changed", text: "Storefront cards now show the price, a short piece of the description with “Learn more »” to the full item page, and the Buy button. Items on a profile open the item itself (they used to open the #NotesApp home page), and if a seller publishes no journal, their store is the main content of their page and of their own domain's home page." },
      { kind: "fixed", text: "Custom domains: the DNS records shown now come from our host's current recommendation, with help for providers that won't accept an A record on the root domain." },
    ],
  },
  {
    version: "v0.5.4",
    bump: "patch",
    date: "2026-10-05",
    changes: [
      { kind: "added", text: "Profiles now show your social links as icons (LinkedIn, Instagram, Facebook, X, WhatsApp, website), and you can add a TikTok link under Edit profile. They also appear on your own domain's Home page." },
      { kind: "changed", text: "Enterprise commission and ad-share rates can now be agreed per account." },
    ],
  },
  {
    version: "v0.5.3",
    bump: "patch",
    date: "2026-10-05",
    changes: [
      { kind: "changed", text: "On a custom domain, the member's logo is now the browser tab icon and sits beside their name in the footer, with the #NotesApp icon next to “powered by #NotesApp”." },
    ],
  },
  {
    version: "v0.5.2",
    bump: "patch",
    date: "2026-10-05",
    changes: [
      { kind: "added", text: "Sign-in on custom domains: visitors sign in once (via www.notesapp.name.ng) and come back to your site already signed in, so they can comment, book a session and buy without leaving it. Payments return to your domain too." },
      { kind: "changed", text: "Custom domains are now a branded site of their own: your name in the header, three pages (Home with your profile and booking, Notes, Shop) and a small “powered by #NotesApp” footer, instead of the full #NotesApp navigation." },
      { kind: "fixed", text: "A custom domain now works the moment it is activated; it no longer shows “isn't connected” for a minute or two." },
      { kind: "fixed", text: "On a member's own site, a note's “More notes” shows only that member's notes, commenters' names stay plain text, and signing in, signing up or paying returns you to the page you came from." },
    ],
  },
  {
    version: "v0.5.1",
    bump: "patch",
    date: "2026-10-05",
    changes: [
      { kind: "added", text: "Cover image for video posts: choose any frame from the video or upload your own. It shows before the video plays and becomes the post's featured image unless you set a different one." },
      { kind: "fixed", text: "Shared links now preview with the post's or store item's own image, title and price instead of the site-wide image. Posts without a featured image use their video cover or first picture." },
    ],
  },
  {
    version: "v0.5.0",
    bump: "minor",
    date: "2026-10-05",
    changes: [
      { kind: "added", text: "Video on posts: add one MP4 (H.264) or WebM video, up to 3 minutes and 100 MB, from the post editor, with an automatic preview image." },
      { kind: "added", text: "Our own video player: nothing downloads until you press play, with the length and data size shown up front, speed control, full screen, keyboard shortcuts and resume where you stopped." },
      { kind: "added", text: "Weekly video allowance by plan: 2 on Free Basic, 7 on Pro, 14 on Business and 30 on Enterprise." },
      { kind: "changed", text: "The Terms now include video rules (section 2a). You'll be asked to accept them before your next payment." },
    ],
  },
  {
    version: "v0.4.1",
    bump: "patch",
    date: "2026-10-04",
    changes: [
      { kind: "added", text: "The status page now also tracks digital downloads storage, the developer API and custom-domain connections." },
      { kind: "changed", text: "The digital downloads check tests storage the way a real download reads it." },
    ],
  },
  {
    version: "v0.4.0",
    bump: "minor",
    date: "2026-10-04",
    changes: [
      { kind: "added", text: "API for Enterprise partners: publish and edit posts, and read your own bookings, orders, download sales and earnings, with scoped, revocable keys." },
      { kind: "added", text: "Console: create and revoke API keys, manage webhooks with signed deliveries, a delivery log and one-click resend, and connect your domain." },
      { kind: "added", text: "Webhooks for new bookings, paid orders, download sales, released payouts and published posts." },
      { kind: "added", text: "API Docs: quickstart, authentication, every endpoint, webhook signature verification and errors." },
      { kind: "added", text: "Your own domain for Enterprise: serve your page, journals and store on notes.yourbrand.com or yourbrand.com. Signing in and paying stay on www.notesapp.name.ng, then buyers return to your store." },
      { kind: "changed", text: "API access is switched on per account by our team." },
    ],
  },
  {
    version: "v0.3.0",
    bump: "minor",
    date: "2026-10-04",
    changes: [
      { kind: "added", text: "Boost prompt for authors: open your own unboosted post or store item and a sheet previews how a boost can look, with a Boost now shortcut." },
      { kind: "added", text: "Account data tools: download a copy of your data or delete your account yourself, under Account → Your data." },
      { kind: "added", text: "Public Trust & security page explaining how payments, files, access rules and your data are protected." },
      { kind: "added", text: "Status page upgrades: recent response times, incident history, and email updates when an incident starts or ends." },
      { kind: "added", text: "Built-in error monitoring that records faults with personal data removed and alerts our team on new kinds of error." },
      { kind: "changed", text: "The 🎁 gift button now always shows on publishers' profiles and posts; it is greyed out with a note until they have set up payouts." },
    ],
  },
  {
    version: "v0.2.0",
    bump: "minor",
    date: "2026-10-03",
    changes: [
      { kind: "added", text: "Digital downloads: sell files from your store, delivered instantly through short-lived private links and final once downloaded." },
      { kind: "added", text: "Store boosts, plus separate Digital and Physical sections in every store with a toggle on the add-item form." },
      { kind: "added", text: "Digital commission by plan: 20% Free Basic, 15% Pro, 10% Business, negotiated on Enterprise." },
      { kind: "added", text: "Merch tracking with parcel IDs, no-login rider links and delivery emails; bell notifications for every purchase and order." },
      { kind: "added", text: "Clients can reschedule or cancel a booking under a published refund policy, report a problem, and sessions pay out automatically once complete." },
      { kind: "added", text: "Joined date on profiles and a maroon/gold verified-badge prompt for visitors." },
    ],
  },
];
