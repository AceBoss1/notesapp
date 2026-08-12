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
      <div className="card mt-8 p-7">
        <p className="font-ui text-sm font-semibold text-ink">Email</p>
        <a href="mailto:hello@notesapp.africa" className="text-crimson">
          hello@notesapp.africa
        </a>
      </div>
    </div>
  );
}
