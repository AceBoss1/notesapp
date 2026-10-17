# #NotesApp Courses (plan, October 2026)

A course is a set of lessons a member teaches on #NotesApp, with progress, a certificate at the end that anyone can verify, and
a one-tap share of that certificate. Free courses grow the audience; paid courses earn. This is the owner's spec (17 Oct 2026)
turned into a build plan, with the owner's decisions at the end. **Step 1 (free courses) is built**: how it works is in
`docs/ARCHITECTURE.md` ("Notes Academy: free courses"); steps 2 to 5 are not built yet.

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
  - Assets needed before building: the Certified Course logo and the Verifiable Certificate badge (we design them in the brand
    colours, or the owner supplies them).
- Data: `certificates/{id}` (server-only), written only by the server when completion is checked there.

## How it fits what exists
- Builds on **view-only lessons** (Pro and above today: `components/LessonsEditor.tsx`, `lib/stream.ts`, `lib/private-files.ts`,
  `components/PdfViewer.tsx`, two devices per purchase, the buyer's email stamped on the content). A view-only item with
  several lessons is already a simple paid course; Courses add free courses, YouTube lessons, progress, quizzes and certificates.
- Plans: new flags in `lib/tiers.ts` (`freeCourses` for every publishing tier, `paidCourses` for Pro and up) and limits in
  `lib/limits.ts` (courses per plan, storage, video hours), so they're set in Admin → Limits.
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
4. **Quizzes**, reviews, "continue learning" in the feed and the digest.
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
