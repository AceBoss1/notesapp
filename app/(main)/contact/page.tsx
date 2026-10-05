import { getSiteSettingsCached } from "@/lib/settings";
import type { Metadata } from "next";
import ContactForm from "@/components/ContactForm";
import { FacebookIcon, LinkedInIcon, MailIcon, NotesAppIcon } from "@/components/ContactIcons";

export const metadata: Metadata = {
  title: "Contact",
  description: "Contact #NotesApp — bookings and payments help, store orders and parcels, advertising campaigns, organisation accounts and CAC verification, boosts and gifts, reporting a post or account, partnerships, press or investment.",
};

export default async function ContactPage() {
  const site = await getSiteSettingsCached();
  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6 lg:px-8">
      <span className="eyebrow">Contact</span>
      <h1 className="mt-4 font-display text-4xl text-ink sm:text-5xl">
        Talk to us
      </h1>
      <p className="mt-5 text-slate">
        Help with a booking, payment, payout or refund; a store order, a
        parcel or a delivery problem; an advertising campaign; setting up an
        organisation account, CAC verification or your team; boosts and gifts;
        the gold badge; reporting a post or account; partnerships, press,
        investment — or anything else. Pick the topic in the form below and it
        goes straight to admins, not a shared inbox someone has to remember to
        check. For a parcel, include its ID (it looks like NA-7K2M9QXD) — you
        can also <a href="/track" className="text-crimson underline">track it yourself</a>.
      </p>
      <div className="card mt-8 grid gap-5 p-7 sm:grid-cols-2">
        <div>
          <p className="font-ui text-sm font-semibold text-ink">Email</p>
          <a href={`mailto:${site.email}`} className="inline-flex items-center gap-2 text-crimson">
            <MailIcon /> {site.email}
          </a>
        </div>
        {site.social.linkedin && (
          <div>
            <p className="font-ui text-sm font-semibold text-ink">LinkedIn</p>
            <a href={site.social.linkedin} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-crimson">
              <LinkedInIcon /> {site.social.linkedin.replace(/^https?:\/\/(www\.)?/, "")}
            </a>
          </div>
        )}
        {site.social.facebook && (
          <div>
            <p className="font-ui text-sm font-semibold text-ink">Facebook</p>
            <a href={site.social.facebook} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-crimson">
              <FacebookIcon /> {site.social.facebook.replace(/^https?:\/\/(www\.|web\.)?/, "")}
            </a>
          </div>
        )}
        <div>
          <p className="font-ui text-sm font-semibold text-ink">#NotesApp on #NotesApp</p>
          <a href="/u/na-notesapp" className="inline-flex items-center gap-2 text-crimson">
            <NotesAppIcon /> notesapp.name.ng/u/na-notesapp
          </a>
        </div>
        {site.whatsapp && (
          <div>
            <p className="font-ui text-sm font-semibold text-ink">WhatsApp</p>
            <a href={site.whatsapp} target="_blank" rel="noopener noreferrer" className="text-crimson">
              Message us
            </a>
          </div>
        )}
      </div>

      <ContactForm />
    </div>
  );
}

