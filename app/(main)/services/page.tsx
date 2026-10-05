export const metadata = { title: "Services — Precheks" };

const CORE_SERVICES = [
  {
    title: "1-to-1 Career Coaching",
    body: "A safe space to share academic and career challenges, and in return gain clarity, valuable information, and confidence to pursue and grow a rewarding career. If you're unsure where to begin, book a session with us.",
  },
  {
    title: "Data Analytics Consulting",
    body: "Cloud and on-premises databases, data scraping and migration, dashboard creation, and business intelligence reports with actionable insight — helping you make data-driven decisions that improve productivity and reduce cost.",
  },
  {
    title: "Web & App Development",
    body: "Seamless, user-centric digital experiences from our expert web and app development team. Elevate your brand, captivate your audience, and stay ahead in the digital game.",
  },
];

const COURSES = [
  {
    title: "Career Planning",
    body: "Navigate the ever-changing landscape of careers and achieve long-term professional success — whether starting out, changing careers, or aiming for advancement.",
  },
  {
    title: "Excel & Spreadsheets",
    body: "From beginner to advanced Excel proficiency — no prior knowledge required. Real-time live classes available on request via WhatsApp, email, or social media.",
  },
  {
    title: "Cybersecurity Training",
    body: "In-depth awareness of cyberattacks and how to stay afloat, including testing of information security controls.",
  },
];

const OTHER_SERVICES = [
  "CV and Resume crafting",
  "LinkedIn profile optimisation",
  "Cover letters",
  "PowerPoint report preparation",
  "Guidance in choosing project topics",
  "Voice over services",
  "Copywriting",
  "Lectures and public speaking",
  "UK relocation guidance",
];

export default function ServicesPage() {
  return (
    <section className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-14">
      <p className="eyebrow">Bespoke Education &amp; IT Consultancy</p>
      <h1 className="font-display text-5xl mt-3">Our Services</h1>
      <p className="mt-6 text-lg text-slate font-body">
        Meticulously crafted to empower individuals and organizations —
        whatever your learning objectives, our programs equip you with the
        essential skills and knowledge for today&apos;s dynamic landscape.
      </p>

      <div className="mt-12 divide-y divide-rule border-t-2 border-ink">
        {CORE_SERVICES.map((s) => (
          <div key={s.title} className="py-6">
            <h2 className="font-display text-2xl">{s.title}</h2>
            <p className="mt-2 text-slate font-body">{s.body}</p>
          </div>
        ))}
      </div>

      <div className="mt-16">
        <p className="eyebrow">Our Courses</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 mt-5">
          {COURSES.map((c) => (
            <div key={c.title} className="border-t-2 border-gold pt-4">
              <h3 className="font-display text-xl">{c.title}</h3>
              <p className="mt-2 text-sm text-slate">{c.body}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-16 bg-ink text-paper p-8">
        <p className="eyebrow text-gold">Other Services</p>
        <ul className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 font-body">
          {OTHER_SERVICES.map((s) => (
            <li key={s} className="flex items-start gap-2">
              <span className="text-gold">—</span> {s}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
