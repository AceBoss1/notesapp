"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Note, slugify, createNote, updateNote } from "@/lib/firestore-notes";
import { uploadToCloudinary } from "@/lib/cloudinary";

// Kept identical to Precheks' own author_role text on purpose — this
// writes into the shared `notes` document, and Precheks renders
// author_role verbatim on its own note pages. NotesApp's own framing
// of these two people (Founder/CEO, Co-Founder/COO) is applied at the
// UI level only, in lib/admin.ts + app/u/[username]/page.tsx, never
// written back into shared data.
const AUTHORS = [
  {
    name: "Chimdinma Onwuegbu",
    role: "Founder & Lead Consultant",
    avatar: "/images/headshots/chimdinma-onwuegbu-2-professional.jpeg",
  },
  {
    name: "Emmanuel Adams",
    role: "Business Development Lead",
    avatar: "/images/headshots/emmanuel-adams-1.jpeg",
  },
];

type Props = {
  noteId?: string;
  initial?: Partial<Note>;
};

export default function NoteForm({ noteId, initial }: Props) {
  const router = useRouter();
  const [title, setTitle] = useState(initial?.title || "");
  const [slug, setSlug] = useState(initial?.slug || "");
  const [slugTouched, setSlugTouched] = useState(!!initial?.slug);
  const [categories, setCategories] = useState(
    (initial?.categories || []).join(", ")
  );
  const [tags, setTags] = useState((initial?.tags || []).join(", "));
  const [content, setContent] = useState(initial?.content || "");
  const [featuredImage, setFeaturedImage] = useState(
    initial?.featured_image || ""
  );
  const [authorName, setAuthorName] = useState(
    initial?.author || AUTHORS[0].name
  );
  const [status, setStatus] = useState<"draft" | "published">(
    initial?.status || "draft"
  );
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function handleTitleChange(v: string) {
    setTitle(v);
    if (!slugTouched) setSlug(slugify(v));
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const url = await uploadToCloudinary(file);
      setFeaturedImage(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const author = AUTHORS.find((a) => a.name === authorName) || AUTHORS[0];
    const payload = {
      title,
      slug: slug || slugify(title),
      date: initial?.date || new Date().toISOString(),
      categories: categories
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean),
      tags: tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      featured_image: featuredImage,
      content,
      author: author.name,
      author_role: author.role,
      author_avatar: author.avatar,
      status,
    };
    try {
      if (noteId) {
        await updateNote(noteId, payload);
      } else {
        await createNote(payload);
      }
      router.push("/admin/notes");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-6 max-w-3xl">
      <label className="block">
        <span className="eyebrow">Title</span>
        <input
          required
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          className="mt-2 w-full border border-rule bg-card px-4 py-3 font-body focus:border-crimson outline-none"
        />
      </label>

      <label className="block">
        <span className="eyebrow">Slug (URL)</span>
        <input
          required
          value={slug}
          onChange={(e) => {
            setSlugTouched(true);
            setSlug(e.target.value);
          }}
          className="mt-2 w-full border border-rule bg-card px-4 py-3 font-mono text-sm focus:border-crimson outline-none"
        />
      </label>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <label className="block">
          <span className="eyebrow">Categories (comma-separated)</span>
          <input
            value={categories}
            onChange={(e) => setCategories(e.target.value)}
            placeholder="Career coaching, Life Hacks"
            className="mt-2 w-full border border-rule bg-card px-4 py-3 font-body focus:border-crimson outline-none"
          />
        </label>
        <label className="block">
          <span className="eyebrow">Tags (comma-separated)</span>
          <input
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            className="mt-2 w-full border border-rule bg-card px-4 py-3 font-body focus:border-crimson outline-none"
          />
        </label>
      </div>

      <label className="block">
        <span className="eyebrow">Author</span>
        <select
          value={authorName}
          onChange={(e) => setAuthorName(e.target.value)}
          className="mt-2 w-full border border-rule bg-card px-4 py-3 font-body focus:border-crimson outline-none"
        >
          {AUTHORS.map((a) => (
            <option key={a.name} value={a.name}>
              {a.name} — {a.role}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="eyebrow">Featured Image</span>
        <input
          type="file"
          accept="image/*"
          onChange={handleImageUpload}
          className="mt-2 block text-sm"
        />
        {uploading && (
          <p className="text-xs text-slate mt-1">Uploading…</p>
        )}
        {featuredImage && (
          <Image
            src={featuredImage}
            alt="Featured"
            width={240}
            height={140}
            className="mt-3 object-cover"
          />
        )}
      </label>

      <label className="block">
        <span className="eyebrow">Content (Markdown)</span>
        <textarea
          required
          rows={16}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="mt-2 w-full border border-rule bg-card px-4 py-3 font-mono text-sm focus:border-crimson outline-none"
        />
      </label>

      <label className="block">
        <span className="eyebrow">Status</span>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as "draft" | "published")}
          className="mt-2 w-full border border-rule bg-card px-4 py-3 font-body focus:border-crimson outline-none"
        >
          <option value="draft">Draft</option>
          <option value="published">Published</option>
        </select>
      </label>

      {error && <p className="text-sm text-red-700">{error}</p>}

      <div className="flex gap-4">
        <button
          type="submit"
          disabled={saving || uploading}
          className="bg-crimson text-paper font-ui font-semibold px-6 py-3 hover:bg-crimson-deep hover:text-paper transition-colors disabled:opacity-50"
        >
          {saving ? "Saving…" : noteId ? "Save Changes" : "Publish / Save Draft"}
        </button>
      </div>
    </form>
  );
}
