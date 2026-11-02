# #NotesApp Courses (plan, October 2026)

A course is a set of lessons a member teaches on #NotesApp, with progress, a certificate at the end that anyone can verify, and
a one-tap share of that certificate. Free courses grow the audience; paid courses earn. This is the owner's spec (17 Oct 2026)
turned into a build plan, with the owner's decisions at the end. **Steps 1 to 3 are built** (free courses, certificates, paid
courses with co-tutors and organisations; see `docs/BUILD_LOG.md`, v0.42 to v0.55), and quiz lessons are built (v0.105.0: answers in server-only `quizKeys`, attempts in `quizAttempts`, a quiz
ticked off only once passed); Enterprise courses are next.

**The Notes Academy page** (`/academy`, v0.107.0) is a product page around the catalogue: the hero, three feature blocks
(building a course, quizzes, verifiable certificates), the Teach/Sell/Grow/Learn tabs, why Notes Academy, live numbers counted
from the published courses (no number is shown while it's 0), "Notes Academy for…", help-article cards, the learners' and
teachers' questions (`lib/academy-faq.ts`) with a link to the help centre, and a closing call to teach
(`components/academy/AcademyLanding.tsx`). The catalogue sits in the middle at `#courses`.

**YouTube lessons with notes and a credit (v0.110.0):** a YouTube lesson may also have `body` (the same Markdown as a text lesson, shown
under the video as "Lesson notes") and `videoCredit: { title, name, url }`, filled by the server from YouTube's oEmbed
(`https://www.youtube.com/oembed?url=…&format=json`: `title`, `author_name`, `author_url`) whenever the lesson is saved, never from the
request. The player shows "Video: <title> by <creator>, on YouTube. Shared here with credit to the original creator." Older lessons
have neither and play as before. Tutors using another creator's public video should credit them in the notes too.

**Seeded courses (v0.110.0):** `lib/course-seeds.ts` holds two courses written for the owner (as @emmanuel): *How to Restart Your Life
After a Breakdown* (a new draft) and *IT Support Training* (rewrites the published course `wLQCJdqolPh6A3WbvEZL` in place). Admin →
Academy → Seed courses shows a dry run, then writes them (`lib/course-seeds-server.ts`). Seeded lessons have fixed ids, so seeding again
never duplicates. A rewrite keeps the course's id, address, status, enrolments, reviews and certificates; learners' progress shows the
new lessons (see HANDOVER item 80).

**Covers made with Nana** (v0.111.0, owner 1 Nov 2026: "allow publishers generate cover picture art right in academy, only for courses,
even free courses; Free Basic gets 3 generations a day, any mix of new ones and edits; their Pearl allowance is used, and when it's
exhausted generations end till it refreshes"). There is no picture model, so a cover is designed artwork drawn on our server:
- **Design:** Nana's Pearl turns the course (title, summary, topics, level) and the publisher's words into a small JSON design,
  `CoverSpec` in `lib/covers.ts`: template (band, split, frame, stripes, medallion, poster, tiles, arch), palette (crimson, ivory,
  ink, moss, indigo, gold, teal, earth), pattern (adire, kente, mudcloth, diamonds, waves, dots, none), icon (31 of our own,
  `lib/cover-art.ts`), headline (≤ 90), subline (≤ 90), tag (≤ 32) and layout (left, right, center). `cleanSpec` checks every field;
  an answer that can't be read gets our own design from the course (`designFor`, which also follows words like "green" or "laptop").
- **Drawing:** `lib/cover-render.tsx` draws 1600 × 900 with next/og and our fonts, sets the words line by line at a size measured
  from the font files (`lib/font-metrics.ts`) so they never leave their box, and makes WebP with Next's own encoder. Saved in the media
  bucket (`academy/covers/<courseId>/<id>.webp`), like an uploaded cover. Drawing costs nothing.
- **Use, edit, go back:** `POST /api/academy/covers { courseId, prompt?, baseId? }`; with `baseId` Pearl gets the current design and the
  instruction and changes only that. The last 8 per course are in `courseCovers/{courseId}`; **Use as cover** saves the url as the cover.
- **Who and how many:** the lead, accepted co-tutors and admins; free and paid courses. Per member per Lagos day
  (`coverCounts/{uid}_{day}`): Free 0 (can't publish), Free Basic 3, Pro 10, Business 25, Enterprise 50, in Admin → Pricing
  (`academyCovers`); admins at least Enterprise's; on an organisation's course, the better of the member's and the organisation's plan.
- **Paying for Pearl:** exactly like writing help: the member's own AI key first (not metered), else Pearl on our key, paid from the Nana
  allowance and then Nana credit (`meterCheck`/`meterCharge`). Used up → refused before anything is counted: "Your Nana allowance is used
  up; covers come back when it refreshes on …". The daily number applies to own-key members too.
- **Without the AI:** `adminCover()` and `scripts/course-covers.ts` (no count, no charge; a fixed design or one from the course), and
  `--samples` for the covers of our own courses in `public/images/academy/covers/<slug>.webp` (`lib/cover-samples.ts`).

**Naija Exam Prep** (JAMB, WAEC and NECO practice at prep.notesapp.name.ng, v0.79.0) is part of Notes Academy but is not built on courses: it has its own questions, packs and reviewers (`lib/exam-prep.ts`, HANDOVER items 41–42).

## Who can do what

| | Free courses | Paid courses |
|---|---|---|
| **Basic** (free publishing) | Yes | No |
| **Pro** | Yes | Yes |
| **Business** | Yes | Yes |
| **Enterprise** | Yes | Yes, by agreement: **from ₦100,000 a month** for course support (hosting, more storage and video hours, branded certificates, cohorts, bulk learner invites) |

- **Free courses**: any publishing account. Videos come from the **publisher's own YouTube** (a public or unlisted video or
  playlist): pasted as a link, played inside #NotesApp with YouTube's privacy-enhanced player (`youtube-nocookie.com`), so
  learners stay on the course page. Lessons can also be text (the journal editor) and PDFs. No upload costs for us.
- **Paid courses**: Pro, Business and Enterprise. The publisher **uploads** lessons to #NotesApp. All course files are
  private: kept in the **private R2 bucket** (`R2_PRIVATE_BUCKET`, already used for paid downloads), never on a public
  address, and opened only through short-lived signed links for a learner who has paid. Sold through the existing #NotesApp
  checkout (Paystack, wallet), with the same plan fees and payouts as store items.
- **Enterprise**: a conversation, not a checkbox. The Enterprise page and Console say "Courses for your team or customers:
  from ₦100,000 a month, talk to us", and the request lands in Admin → Enterprise.

### Paid video (decided: Stream with a viewer watermark, see Decisions)
Files (PDFs, slides, audio, downloads, the original video files) go in private R2 as specified. For **playing** paid video
we recommend **Cloudflare Stream with signed tokens**, which view-only courses already use (`lib/stream.ts`): it streams in
small encrypted pieces with no single file to save, adapts to slow connections and phone data, and its tokens expire. Playing
an MP4 straight from R2 works with signed links too, but a signed link is a whole file someone can save while it's valid. Our
suggestion: the original goes to private R2 (so we always own the file), playback through Stream. Cost: Stream bills per
minute stored and watched, so it belongs in the paid plans' price.

## What learners get
- A course page: what you'll learn, lessons (free preview lessons on paid courses), the teacher, reviews, price or "Free".
- **Progress**: lessons ticked off as they're finished (a video watched to 90%, a PDF opened to the end, a text lesson read);
  "Continue where you stopped" on the course and in the feed.
- **Quizzes** (optional, per lesson or at the end): multiple choice, a pass mark set by the teacher.
- **Certificate** when every required lesson (and any final quiz) is done.

## Certificates
- Issued automatically on completion: learner's name, course, teacher (and organisation), date, hours, a unique ID like
  `NA-C-7K2M9QXD`, and a QR code.
- **Verification**: a public page, `/certificates/NA-C-7K2M9QXD`, says whether it's genuine, for whom, which course and when;
  revoked certificates (a refund, a copied course) say so. Anyone can check by ID or by scanning the QR code. Nothing private
  is shown beyond what's printed on the certificate.
- **Share**: LinkedIn "Add to profile" (Licences and certifications, with the verification address as the credential URL),
  X, WhatsApp, Facebook, a copy link, and a downloadable PDF and image. The verification page has its own Open Graph card, so
  a shared link shows the certificate.
- Business and Enterprise: their logo and signature on their certificates; Enterprise can choose the design.
- **The three logo places along the top** (owner, 17 Oct 2026; very important). Each place shows only when it applies:
  - **Top left: the "#NotesApp Certified Course" logo**, only on courses #NotesApp has certified. Certification is set by
    #NotesApp staff in Admin (a `certified` flag on the course, with who certified it and when); teachers can't set it.
  - **Top centre: the publisher's logo** (their organisation or brand logo), when they have one.
  - **Top right: the logo of another verifying institution**, when the publisher's course is accredited by one (a
    professional body, school or regulator). The publisher adds the institution's name, logo and a reference/link; #NotesApp
    reviews it before it can appear, so nobody can claim an accreditation they don't have. The verification page names the
    institution too.
  - **Always, beside the QR code: the "Notes Academy Verifiable Certificate" badge**, whatever the logos above.
  - The artwork is in `public/images/academy/` (made from the owner's Notes Academy logo, 17 Oct 2026; PNG for print and
    PDFs, WebP for pages, SVG to edit): `notesapp-certified-course` (top left), `notes-academy-verifiable-certificate` (the
    seal beside the QR code) and `notes-academy-verifiable-certificate-wide` (seal + words, where there's room), plus the
    Notes Academy logo itself, `notes-academy-logo`.
- Data: `certificates/{id}` (server-only), written only by the server when completion is checked there.

## How it fits what exists
- Builds on **view-only lessons** (Pro and above today: `components/LessonsEditor.tsx`, `lib/stream.ts`, `lib/private-files.ts`,
  `components/PdfViewer.tsx`, two devices per purchase, the buyer's email stamped on the content). A view-only item with
  several lessons is already a simple paid course; Courses add free courses, YouTube lessons, progress, quizzes and certificates.
- Plans (built in v0.122.0): flags in `lib/tiers.ts` (`freeCourses` for every publishing tier, `paidCourses` for Pro and up,
  `courseVideoUploads` for Business and Enterprise) are the defaults of the on/off rows in `lib/limits.ts`'s Courses group, next to
  courses per member (30) and per organisation (90), PDF storage (GB) and uploaded video (hours), both 0 = no limit by default. All are
  set per plan in Admin → Limits (`serverConfig/limits`, read through `lib/limits-server.ts`'s 30-second cache) and enforced by
  `lib/courses-server.ts` (create, price, publish, upload start and lesson save) and `lib/course-sales-server.ts` (checkout).
- Topics: a course is filed under topics (`lib/topics.ts`) like a journal, so it reaches readers interested in them and the weekly digest.
- Settings through `lib/config.ts`; all writes on the server (courses, enrolments, progress, certificates); tests with each step.

## Data (sketch)
`courses/{id}` (owner, title, summary, topics, price, free, status, lesson order), `courses/{id}/lessons/{lessonId}` (kind:
youtube | video | pdf | text | quiz, the YouTube id or the private file key, duration, free preview), `enrolments/{courseId}_{uid}`
(paid or free, started, progress per lesson, completed), `certificates/{id}`. Server-only except the public course page fields.

## Build in steps
1. **Free courses with YouTube** (any publisher): course builder, YouTube and text lessons, the course page, enrol, progress.
2. **Certificates**: issue on completion, the verification page, sharing, the PDF.
3. **Paid courses** (Pro, Business): uploads to private R2, playback (the decision above), checkout, payouts, two-device limit.
   Built in v0.55.0, with publishing for an organisation, co-tutors, and course details (level, format, outcomes, modules) for every course.
   **Complete (v0.122.0):** which plans may teach free courses, sell courses and upload video, and the courses, storage and video
   hours per plan, are settings in Admin → Limits instead of hard-coded, with the v0.55.0 behaviour as the defaults.
4. **Quizzes** (built in v0.105.0), reviews, "continue learning" in the feed and the digest.
5. **Enterprise courses** (from ₦100,000 a month): branded certificates, cohorts, bulk invites, reports for the organisation.

Each step ships with phone and desktop screenshots first (`HANDOVER.md`), the help article, the changelog and tests.

## Decisions (owner, 17 Oct 2026)
1. **Paid video: Cloudflare Stream** with signed, short-lived tokens; the original file stays in private R2. Our player draws
   a **watermark of the viewer's @username and email** over the video, faint and moving every few seconds, so it can't be
   cropped out and any screen recording carries the viewer's own details.
2. **Our fee on course sales: the same as digital store items**, by the publisher's plan (one rule for publishers).
3. **Certificates on free courses are paid**: the learner pays our minimum **₦999** plus the margin the publisher sets, and
   we also take our usual commission from that margin (e.g. margin ₦1,000 → the learner pays ₦1,999; we keep ₦999 plus our
   commission on the ₦1,000). Paid courses can include the certificate in the course price.
4. **Enterprise: two packages on top of the regular Enterprise plan** (whose rate stays as it is for anyone who takes
   neither):
   - **Enterprise Courses, ₦100,000 a month**: courses hosted on #NotesApp under their brand, their logo on certificates,
     cohorts and bulk invites, set amounts of learners, storage and video hours, their own tutors added as team members.
     No API needed.
   - **Enterprise Academy API, from ₦250,000 a month plus usage**: a stand-alone white-label academy built on our API and
     webhooks, with their own tutors, enrolment, progress and certificate webhooks, billed partly by learners and video
     hours.
   All three prices, and what each package includes, are set by the owner in **Admin → Pricing**.

## Decisions (owner, 18–19 Oct 2026)
5. **Who sells what:** free courses on every publishing plan (Free Basic and up); paid courses with text lessons, PDFs and YouTube on Pro
   and up; paid courses with uploaded video on Business and Enterprise only.
6. **Commission** as for digital sales: 6% on Pro, 4% on Business (Enterprise by agreement). **Refunds** within 7 days of buying, only if
   the learner hasn't started (opening a paid lesson counts as starting).
7. **Co-tutors:** a course can have one tutor or co-tutors. Sales are split like a co-authored post's gifts: each co-tutor's agreed
   percent, the lead keeps the rest, each share at its own plan's commission. Organisations' admins and writers can teach as the organisation.
   **Access (v0.109.0, owner 1 Nov 2026):** the lead chooses per co-tutor **Can view** (the course and every lesson, draft or published,
   read-only: the preview at `/academy/<slug>` through `GET /api/academy/courses?slug=`; the editor and uploads are refused) or **Can view
   and edit** (details, About, modules and lessons). Publishing, the price and certificate, the shares, invitations and deleting stay with
   the lead (`editable(…, "lead")`). The co-tutor accepts on `/invites/course/<courseId>_<uid>`, agreeing to the terms shown
   (`agreedAt`, `agreedTerms` on `courseTutorInvites`, the full record in `inviteAgreements`). The lead may change access or share at any
   time, published or not: less access applies at once; more access or a new share is a `change` the co-tutor must agree to. A 0% share
   is allowed for both levels (credited without a share), as before. Co-tutors who accepted before access levels keep edit access
   (`Tutor.access` missing reads as edit). The rules in plain words live in `lib/invite-terms.ts`.
8. **Course details for every course**, free or paid (from the partner review of digitalwitchng.com): level, language, format (live
   classes with recordings), what you'll learn, requirements, how it works, modules, This course includes, Share, and a private class
   link and course group shown only to people who enrolled or bought.
   - **Course group (v0.108.0, owner 1 Nov 2026: our own tools first):** a Space in one of the publisher's communities instead of a
     WhatsApp or Telegram group: linked, added to a community they run, or a new invite-only community started in one tap. Learners get
     the invite with the links and join in one tap. Outside links saved before still show until replaced or removed; new ones are refused.
     Live classes: an audio room (host, 4 speakers, 20 listeners) or a meeting link for video and bigger classes.

