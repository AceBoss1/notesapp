import Link from "next/link";
import { NotesAppPost } from "@/lib/notesapp-posts";

export default function NotesAppPostRow({ post }: { post: NotesAppPost }) {
  return (
    <Link
      href={`/u/notesapp/posts/${post.slug}`}
      className="card flex items-center gap-4 p-3 transition-shadow hover:shadow-md"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={post.image}
        alt=""
        className="h-16 w-16 flex-shrink-0 rounded-lg object-cover"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate font-ui text-sm font-semibold text-ink">
          {post.title}
        </p>
        <p className="mt-1 truncate text-xs text-slate">{post.excerpt}</p>
        <p className="mt-1 font-mono text-[10px] uppercase tracking-eyebrow text-crimson-bright">
          {post.category}
        </p>
      </div>
    </Link>
  );
}
