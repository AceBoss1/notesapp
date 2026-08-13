import { SITE } from "@/lib/site";

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6 lg:px-8">
      <span className="eyebrow">Contact</span>
      <h1 className="mt-4 font-display text-4xl text-ink sm:text-5xl">
        Talk to us
      </h1>
      <p className="mt-5 text-slate">
        For partnership, investment, or press enquiries, reach the
        founding team directly.
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
    </div>
  );
}
