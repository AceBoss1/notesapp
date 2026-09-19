import { redirect } from "next/navigation";

export default function NoteSlugRedirect({ params }: { params: { slug: string } }) {
  redirect(`/journals/${params.slug}`);
}
