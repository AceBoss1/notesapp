import LinkedText from "@/components/LinkedText";

// A message's text with **bold**, _italic_ and __underline__ shown (see lib/message-format.ts), and web addresses and @username
// as links (lib/linkify.ts). Plain React text: no HTML.
export default function FormattedText({ text, linkClass }: { text: string; linkClass?: string }) {
  return <LinkedText text={text} format linkClass={linkClass} />;
}
