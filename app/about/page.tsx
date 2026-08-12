export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
      <span className="eyebrow">About</span>
      <h1 className="mt-4 font-display text-4xl text-ink sm:text-5xl">
        Why #NotesApp exists
      </h1>
      <div className="prose prose-lg mt-8 max-w-none font-body text-ink">
        <p>
          No platform today is purpose-built for African coaches,
          consultants, therapists, and knowledge professionals who
          publish content, take bookings, collect payment in Naira, and
          manage client relationships — all in one place. Substack
          assumes a Western reader. Calendly assumes Stripe. Notion is
          built for tech teams.
        </p>
        <p>
          #NotesApp closes that loop: publish a note, get booked from
          it, get paid inline, follow up on WhatsApp — then turn the
          private session notes into your next public article.
        </p>
        <p>
          We're building this alongside the professionals who will run
          their entire practice on it from day one, starting with our
          first reference customer, Precheks.
        </p>
      </div>
    </div>
  );
}
