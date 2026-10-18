import { currentPricing } from "./pricing";

// The questions on every course page (components/academy/AcademyFaq.tsx) and in the help centre (lib/kb-articles.ts, so Nana knows
// them too). Prices come from Admin → Pricing when the page is drawn.
export function academyFaq(): { q: string; a: string }[] {
  const p = currentPricing();
  const min = `₦${(p.coursePackages.certificateMinKobo / 100).toLocaleString("en-NG")}`;
  const l = p.certificateLate;
  return [
    { q: "How and when do I get my certificate?", a: "As soon as you've finished every lesson, a Get your certificate button appears on the course page. Check your name, pay, and it's issued straight away with its own ID and QR code. You'll find it again on the course page." },
    { q: "What does the certificate cost?", a: `The course is free. The certificate costs ${min} (#NotesApp's part) plus the teacher's own margin; you see the total before you pay, by card or from your NotesApp Credit wallet. Claim it within ${l.graceDays} days of finishing: after that a late claim fee of ${Math.round(l.weeklyRate * 100)}% of the price is added each week, up to ${Math.round(l.capRate * 100)}% more.` },
    { q: "Can employers check my certificate?", a: "Yes. Anyone can scan its QR code, or enter its ID (NA-C-…) at notesapp.name.ng/certificates, and see that it's genuine. You can add it to your LinkedIn profile, share it, or save it as a PDF." },
    { q: "Can I change the name on my certificate?", a: "Check the spelling before you pay: once it's issued, the name can't be changed. If something went wrong, contact us and we'll help." },
    { q: "How long do I have access to this course?", a: "For as long as the teacher keeps it on Notes Academy, free, including every update and new lesson at no extra cost. Your progress and your certificate stay yours." },
    { q: "How do I get help if I'm stuck?", a: "Ask Nana first: she knows Notes Academy inside out and answers most questions straight away. If she can't, contact our team and we'll usually reply within 24 hours. For questions about the lessons themselves, message the teacher from their profile." },
    { q: "How many questions can I ask Nana?", a: "As many as you like. Each answer uses a little of your free Nana allowance, which refreshes every week; after that Nana uses any Nana credit you've bought. Common questions answered from her answer bank are free." },
    { q: "Can I watch this course offline?", a: "No. Lessons stream on #NotesApp and can't be downloaded, which keeps teachers' work safe from piracy. You can still watch on a bigger screen by casting or connecting your phone, tablet or computer to a TV." },
    { q: "Help! The videos won't play.", a: "It's usually the internet connection or the browser. Try another browser or connection, and turn off any data saver or ad blocker for #NotesApp. Still stuck? Ask Nana or contact our team." },
    { q: "Where are the course resources?", a: "If a lesson has worksheets, templates or other downloads, the teacher links them in the lesson. Paid extras are in the teacher's shop on Notes Market." },
    { q: "Can I get a refund?", a: "The course is free, so there's nothing to refund. If you change your mind about a certificate, ask within 7 days of buying it and we'll refund it; the certificate is then revoked." },
  ];
}
