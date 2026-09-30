import { SITE } from "@/lib/site";
import type { Metadata } from "next";
import ContactForm from "@/components/ContactForm";

export const metadata: Metadata = {
  title: "Contact",
  description: "Contact #NotesApp — support, bookings and payments help, boosts and gifts, reporting a post, partnerships, press or investment.",
};

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6 lg:px-8">
      <span className="eyebrow">Contact</span>
      <h1 className="mt-4 font-display text-4xl text-ink sm:text-5xl">
        Talk to us
      </h1>
      <p className="mt-5 text-slate">
        Help with a booking, payment, payout or refund; questions about
        boosts and gifts; reporting a post or account; partnerships,
        press, investment — or anything else. The fastest way to reach
        the team is the form below. It goes
        straight to admins, not a shared inbox someone has to remember
        to check.
      </p>
      <div className="card mt-8 grid gap-5 p-7 sm:grid-cols-2">
        <div>
          <p className="font-ui text-sm font-semibold text-ink">Email</p>
          <a href={`mailto:${SITE.email}`} className="text-crimson">
            {SITE.email}
          </a>
        </div>
        <div>
          <p className="font-ui text-sm font-semibold text-ink">LinkedIn</p>
          <a
            href={SITE.linkedin}
            target="_blank"
            rel="noopener noreferrer"
            className="text-crimson"
          >
            linkedin.com/company/na-notesapp
          </a>
        </div>
      </div>

      <ContactForm />
    </div>
  );
}

