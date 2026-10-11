import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import PageHero from "@/components/PageHero";

export const metadata: Metadata = {
  title: "Domains",
  description:
    "Coming soon: search, register and manage domains, including .ng and .com.ng, and edit DNS records without leaving #NotesApp. For Business and Enterprise, with our domain partner Whogohost (now go54).",
};

const STEPS = [
  {
    n: "1",
    title: "Search",
    body: "Type the name you want and see whether it is free, with the price, for .com, .ng, .com.ng and more.",
  },
  {
    n: "2",
    title: "Confirm who owns it",
    body: "You are the registrant, so the domain is yours. A short form asks for four sets of details, and fills in whatever we already know about you.",
  },
  {
    n: "3",
    title: "Pay and connect",
    body: "Pay in Naira. Once registered, the domain can be connected to your #NotesApp site with the records set for you.",
  },
  {
    n: "4",
    title: "Manage it",
    body: "Renew, lock, change nameservers, get your transfer code and edit DNS records from one place.",
  },
];

const FORMS = [
  { name: "Registrant", body: "The owner of the domain. That is you or your organisation." },
  { name: "Admin", body: "Who decides things about the domain." },
  { name: "Technical", body: "Who to contact about DNS and servers." },
  { name: "Billing", body: "Who gets renewal and payment notices." },
];

export default function DomainsPage() {
  return (
    <>
      <PageHero eyebrow="Coming Soon · Business and Enterprise" title={<>Domains, inside #NotesApp</>}>
        <p>Find a name, register it, and manage its DNS without leaving your account. Your own domain already works on Business and Enterprise today: you add the records yourself. This will let us do the buying and the records for you.</p>
      </PageHero>
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">

      <section className="mt-10 card flex flex-col items-center gap-6 p-7 sm:flex-row" aria-labelledby="partner">
        <Image
          src="/images/partners/whogohost-gold-partner.png"
          alt="Whogohost gold partner badge: Powering Africa's web. Trusted by thousands. #1 in Africa."
          width={168}
          height={164}
          className="h-auto w-36 shrink-0"
        />
        <div>
          <h2 id="partner" className="font-display text-2xl text-ink">Our domain partner: Whogohost (now go54)</h2>
          <p className="mt-2 text-sm text-slate">
            Whogohost, now go54, is our domain partner: domains will be registered through them. We are building the connection now, so nothing on this page can be bought yet.
          </p>
        </div>
      </section>

      <section className="mt-12" aria-labelledby="how">
        <h2 id="how" className="font-display text-2xl text-ink">How it will work</h2>
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {STEPS.map((s) => (
            <div key={s.n} className="card p-6">
              <span className="font-mono text-[11px] uppercase tracking-eyebrow text-crimson-bright">Step {s.n}</span>
              <h3 className="mt-2 font-display text-xl text-ink">{s.title}</h3>
              <p className="mt-2 text-sm text-slate">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-12" aria-labelledby="forms">
        <h2 id="forms" className="font-display text-2xl text-ink">Four short forms, filled in for you</h2>
        <p className="mt-2 text-sm text-slate">
          A domain needs four sets of contact details. We start with what we already have and ask you before using any of it. If something is missing, we ask for it. When one form is done, we offer to copy the same details into the next, until all four are complete.
        </p>
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {FORMS.map((f) => (
            <div key={f.name} className="card p-5">
              <h3 className="font-ui text-sm font-bold text-ink">{f.name}</h3>
              <p className="mt-1 text-sm text-slate">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-12" aria-labelledby="rules">
        <h2 id="rules" className="font-display text-2xl text-ink">The ground rules</h2>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-slate">
          <li>You own the domain. You are listed as the registrant, and you can transfer it away whenever you like.</li>
          <li>Domain registration is for Business and Enterprise accounts.</li>
          <li>Prices are shown in Naira before you pay. Registrations and renewals are paid for in advance, and a registered domain can&apos;t be refunded once the registry has accepted it.</li>
          <li>The details you give are sent to our domain partner to register the domain. Nothing else is done with them.</li>
          <li>Prices, extensions and conditions can change before launch.</li>
        </ul>
      </section>

      <section className="mt-12 card border-dashed p-7">
        <span className="font-mono text-[11px] uppercase tracking-eyebrow text-crimson-bright">Not live yet</span>
        <p className="mt-3 text-sm text-slate">
          Until this ships, you can connect a domain you already own on Business or Enterprise. See <Link href="/pricing" className="text-crimson underline underline-offset-2">Pricing</Link>, the <Link href="/roadmap" className="text-crimson underline underline-offset-2">roadmap</Link> and the <Link href="/changelog" className="text-crimson underline underline-offset-2">changelog</Link>.
        </p>
      </section>
    </div>
    </>
  );
}
