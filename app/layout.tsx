import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import AuthNav from "@/components/AuthNav";
import SearchBar from "@/components/SearchBar";
import { SITE } from "@/lib/site";
import "./globals.css";

const DEFAULT_TITLE = "#NotesApp — Publish. Book. Get Paid. One Workspace.";
const DEFAULT_DESCRIPTION =
  "The professional publishing and booking platform built for African coaches, consultants, and knowledge professionals. Notes, calendar, and payments — one canvas.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: DEFAULT_TITLE,
    template: "%s — #NotesApp",
  },
  description: DEFAULT_DESCRIPTION,
  icons: { icon: "/images/brand/notesapp-icon.webp" },
  openGraph: {
    siteName: "#NotesApp",
    type: "website",
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    images: ["/images/brand/og-default.jpg"],
  },
  twitter: {
    card: "summary_large_image",
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    images: ["/images/brand/og-default.jpg"],
  },
};

const NAV = [
  { href: "/journals", label: "Journals" },
  { href: "/booking", label: "Booking" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

const COMPANY = [
  { href: "/brand", label: "Brand" },
  { href: "/about", label: "About Us" },
  { href: "/contact", label: "Contact" },
  { href: "/roadmap", label: "Roadmap" },
];

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,500&family=Manrope:wght@500;600;700;800&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {/* Masthead */}
        <header className="sticky top-0 z-40 border-b border-rule bg-paper/90 backdrop-blur">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
            <Link href="/" className="flex items-center gap-2.5">
              <Image
                src="/images/brand/notesapp-icon.webp"
                alt="#NotesApp"
                width={36}
                height={36}
                className="h-9 w-9 rounded-lg"
              />
              <span className="font-ui text-xl font-extrabold tracking-tight text-ink">
                Notes<span className="text-crimson">App</span>
              </span>
            </Link>
            <nav className="hidden items-center gap-7 font-ui text-sm font-semibold text-ink md:flex">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="hover:text-crimson transition-colors"
                >
                  {item.label}
                </Link>
              ))}
              <SearchBar />
              <span className="h-4 w-px bg-rule" />
              <AuthNav />
            </nav>
            <Link href="/journals" className="btn-primary md:hidden">
              Explore
            </Link>
          </div>
        </header>

        <main>{children}</main>

        {/* Footer */}
        <footer className="mt-24 border-t border-rule bg-ink text-paper">
          <div className="mx-auto grid max-w-7xl grid-cols-1 gap-10 px-4 py-16 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:px-8">
            <div>
              <div className="flex items-center gap-2.5">
                <Image
                  src="/images/brand/notesapp-icon.webp"
                  alt="#NotesApp"
                  width={32}
                  height={32}
                  className="h-8 w-8 rounded-lg"
                />
                <span className="font-ui text-lg font-extrabold">
                  Notes<span className="text-crimson-bright">App</span>
                </span>
              </div>
              <p className="mt-4 max-w-xs text-sm text-paper/65">
                Publish a note, take a booking, get paid — one workspace
                for African coaches, consultants, and knowledge
                professionals.
              </p>
            </div>

            <div>
              <p className="eyebrow text-crimson-bright/90">Product</p>
              <ul className="mt-4 space-y-2 text-sm text-paper/75">
                <li><Link href="/journals" className="hover:text-paper">Journals</Link></li>
                <li><Link href="/booking" className="hover:text-paper">Booking</Link></li>
                <li><Link href="/merchstore" className="hover:text-paper">Merch Store</Link></li>
                <li><Link href="/advertise" className="hover:text-paper">Advertise</Link></li>
              </ul>
            </div>

            <div>
              <p className="eyebrow text-crimson-bright/90">Company</p>
              <ul className="mt-4 space-y-2 text-sm text-paper/75">
                {COMPANY.map((item) => (
                  <li key={item.href}>
                    <Link href={item.href} className="hover:text-paper">
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="eyebrow text-crimson-bright/90">Connect</p>
              <ul className="mt-4 space-y-2 text-sm text-paper/75">
                <li>
                  <a href={`mailto:${SITE.email}`} className="hover:text-paper">
                    {SITE.email}
                  </a>
                </li>
                <li>
                  <a
                    href={SITE.linkedin}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-paper"
                  >
                    LinkedIn
                  </a>
                </li>
                <li className="text-paper/50">
                  Built in partnership with Precheks — our first
                  reference customer. —{" "}
                  <Link href="/admin/login" className="text-paper/70 hover:text-paper">
                    Staff Login
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-paper/10 py-5 text-center text-xs text-paper/45">
            © {new Date().getFullYear()} #NotesApp. All rights reserved.
          </div>
        </footer>
      </body>
    </html>
  );
}
