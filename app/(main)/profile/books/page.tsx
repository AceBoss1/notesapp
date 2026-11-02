import type { Metadata } from "next";
import BooksApp from "@/components/books/BooksApp";

export const metadata: Metadata = { title: "Business books", robots: { index: false } };

// Business books (docs/BUSINESS-BOOKS.md): walk-in sales and expenses, online orders flowing in, money owed both ways, profit and loss,
// and import and export. The public page about it is /books; this is the app, for the seller (and an organisation's admins).
export default function BooksPage() {
  return <BooksApp />;
}
