import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { NOTESAPP_POSTS } from "@/lib/notesapp-posts";

export default function NotesAppPostDetail({ params }: { params: { slug: string } }) {
  const post = NOTESAPP_POSTS.find((p) => p.slug === params.slug);
  if (!post) return notFound();

  const index = NOTESAPP_POSTS.findIndex((p) => p.slug === params.slug);
  const next = NOTESAPP_POSTS[(index + 1) % NOTESAPP_POSTS.length];

  return (
    <article className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
      <Link
        href="/u/notesapp"
        className="font-ui text-xs font-semibold uppercase tracking-wideish text-crimson-bright"
      >
        ← @notesapp
      </Link>
      <p className="eyebrow mt-6">{post.category}</p>
      <h1 className="mt-3 font-display text-4xl leading-[1.05] text-ink sm:text-5xl">
        {post.title}
      </h1>

      <div className="mt-8 overflow-hidden rounded-xl2 border border-rule">
        <Image
          src={post.image}
          alt={post.title}
          width={post.imageWidth}
          height={post.imageHeight}
          className="h-auto w-full"
        />
      </div>

      <div className="prose prose-lg mt-10 max-w-none font-body text-ink prose-headings:font-display">
        {post.body.map((para, i) => (
          <p key={i}>{para}</p>
        ))}
      </div>

      <div className="mt-16 border-t-2 border-ink pt-8">
        <p className="eyebrow">Next</p>
        <Link href={`/u/notesapp/posts/${next.slug}`} className="group mt-3 block">
          <h4 className="font-display text-xl text-ink group-hover:text-crimson-bright">
            {next.title}
          </h4>
          <p className="mt-1 text-sm text-slate">{next.excerpt}</p>
        </Link>
      </div>
    </article>
  );
}
