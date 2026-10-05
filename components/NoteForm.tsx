"use client";

import CoAuthorsPanel from "@/components/CoAuthorsPanel";
import { canLeadCoAuthors } from "@/lib/coauthors";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Note, slugify, createNote, updateNote, slugTaken } from "@/lib/firestore-notes";
import { deleteField } from "firebase/firestore";
import VideoUploader, { VideoValue, videoFromNote } from "@/components/VideoUploader";
import { uploadToR2 } from "@/lib/upload";
import RichTextEditor from "@/components/RichTextEditor";
import { roleLabelFor, type UserProfile } from "@/lib/users";

// Kept identical to Precheks' own author_role text on purpose — this
// writes into the shared `notes` document, and Precheks renders
// author_role verbatim on its own note pages. NotesApp's own framing
// of these two people (Founder/CEO, Guest Writer) is applied at the
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
  {
    // @na-notesapp — everything cross-posted from the official social
    // handles. Unlike the other two, this is a genuinely new identity
    // (not one Precheks already has), so there's no "keep it identical
    // to Precheks" constraint on its role text.
    name: "NotesApp",
    role: "Official Channel",
    avatar: "/images/brand/notesapp-icon.webp",
  },
];

type Props = {
  noteId?: string;
  initial?: Partial<Note>;
  // Set when a member (not an admin picking an identity) is writing: the
  // byline, author id and avatar come from their own profile, and saving
  // returns to their own journal (/write).
  self?: UserProfile;
  // Writing for an organisation as a team member: the organisation is the
  // author (byline, avatar, money), `self` is recorded as the writer.
  org?: { profile: UserProfile };
};

// Stored on new entries as the fallback byline; the journal page shows the live label (roleLabelFor).
function selfRoleLabel(p: UserProfile): string {
  return roleLabelFor(p);
}

export default function NoteForm({ noteId, initial, self, org }: Props) {
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
  const [premium, setPremium] = useState(initial?.premium || false);
  const [video, setVideo] = useState<VideoValue | null>(videoFromNote(initial));
  const [videoBusy, setVideoBusy] = useState(false);
  const [boostAfter, setBoostAfter] = useState(false);
  const [coOpen, setCoOpen] = useState(false);
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
      const url = await uploadToR2(file);
      setFeaturedImage(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  // Saves the entry (optionally forcing draft). Returns the note id, or null if
  // validation/saving failed (the error is shown on the form).
  async function persist(forceDraft = false): Promise<string | null> {
    setSaving(true);
    setError("");
    const author = org
      ? { name: org.profile.displayName, role: "Organisation channel", avatar: org.profile.avatar }
      : self
      ? { name: self.displayName, role: selfRoleLabel(self), avatar: self.avatar }
      : AUTHORS.find((a) => a.name === authorName) || AUTHORS[0];
    const finalSlug = slug || slugify(title);
    try {
      if (await slugTaken(finalSlug, noteId)) {
        setError("Another entry already uses that URL — change the slug.");
        setSaving(false);
        return null;
      }
    } catch {
      /* if the check itself fails, let the save decide */
    }
    const payload = {
      title,
      slug: finalSlug,
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
      ...(org && self
        ? { authorUid: org.profile.uid, authorUsername: org.profile.username, writerUid: initial?.writerUid ?? self.uid, writerUsername: initial?.writerUsername ?? self.username }
        : self
        ? { authorUid: self.uid, authorUsername: self.username }
        : {}),
      status: forceDraft ? ("draft" as const) : status,
      premium,
      // Saving with a video attaches it; removing one clears the stored fields (updateDoc only touches what it's given).
      ...(video
        ? { videoId: video.videoId, videoKey: video.videoKey, videoDuration: video.videoDuration, videoSize: video.videoSize, ...(video.videoPoster ? { videoPoster: video.videoPoster } : {}) }
        : initial?.videoId
          ? { videoId: deleteField(), videoKey: deleteField(), videoPoster: deleteField(), videoDuration: deleteField(), videoSize: deleteField() }
          : {}),
    } as Parameters<typeof createNote>[0];
    try {
      let savedId = noteId;
      if (noteId) {
        await updateNote(noteId, payload);
      } else {
        savedId = await createNote(payload);
      }
      try {
        localStorage.removeItem(`notesapp:draft:${noteId || "new"}`);
      } catch {}
      return savedId ?? null;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
      setSaving(false);
      return null;
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const savedId = await persist();
    if (savedId === null) return;
    // Boosting is a paid step of its own — hand off to the package picker.
    router.push(boostAfter && status === "published" && savedId ? `/boost/${savedId}` : self ? "/write" : "/admin/journals");
  }

  // Co-authors need a saved draft to be invited to: save, then reopen it in the editor.
  async function saveDraftForCoAuthors() {
    if (!title.trim()) {
      setError("Add a title first, then save the draft to invite co-authors.");
      return;
    }
    const savedId = await persist(true);
    if (savedId) router.push(`/write/${savedId}/edit`);
  }

  return (
    <>
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

      {!self && (
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
      )}

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

      <VideoUploader
        value={video}
        onChange={setVideo}
        onBusy={setVideoBusy}
        disabled={premium}
        disabledReason="Videos can't be added to premium (subscribers-only) posts yet. Untick Premium to add one."
      />

      <div className="block">
        <span className="eyebrow">Content</span>
        <div className="mt-2">
          <RichTextEditor value={content} onChange={setContent} draftKey={noteId || "new"} />
        </div>
      </div>

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

      {status === "published" && (
        <label className="flex items-start gap-3 text-sm text-ink">
          <input type="checkbox" checked={boostAfter} onChange={(e) => setBoostAfter(e.target.checked)} className="mt-1" />
          <span>
            Boost this post after saving
            <span className="block text-xs text-slate">
              Choose an impressions package next (from ₦3,000). You pay only for validated impressions delivered over several days.
            </span>
          </span>
        </label>
      )}

      <label className="flex items-center gap-3">
        <input
          type="checkbox"
          checked={premium}
          disabled={!!video}
          onChange={(e) => setPremium(e.target.checked)}
          className="h-4 w-4 accent-crimson"
        />
        <span>
          <span className="font-ui text-sm font-semibold text-ink">
            Premium — subscribers only
          </span>
          <span className="block text-xs text-slate">
            Non-subscribers see a teaser and a "Subscribe to unlock"
            prompt instead of the full entry. #NotesApp-only field —
            Precheks' own note pages ignore it and show the entry in
            full either way.{video ? " Remove the video first to make this post premium." : ""}
          </span>
        </span>
      </label>

      {error && <p className="text-sm text-red-700">{error}</p>}

      <div className="flex gap-4">
        <button
          type="submit"
          disabled={saving || uploading || videoBusy}
          className="bg-crimson text-paper font-ui font-semibold px-6 py-3 hover:bg-crimson-deep hover:text-paper transition-colors disabled:opacity-50"
        >
          {saving ? "Saving…" : noteId ? "Save Changes" : "Publish / Save Draft"}
        </button>
      </div>
    </form>

    {self && !org && (
      <div className="mt-8 max-w-3xl">
        {!canLeadCoAuthors(self) ? (
          <div className="card p-5">
            <p className="eyebrow">Co-authors</p>
            <p className="mt-2 text-sm text-slate">
              Inviting co-authors and sharing a post&apos;s earnings is a Pro and Business feature.{" "}
              <Link href="/pricing" className="text-crimson underline">See plans</Link> · <Link href="/coauthoring" className="text-crimson underline">How it works</Link>
            </p>
          </div>
        ) : noteId && initial?.authorUid === self.uid && initial?.status !== "published" ? (
          <CoAuthorsPanel noteId={noteId} leadUid={self.uid} />
        ) : !noteId ? (
          <div className="card p-5">
            <label className="flex items-center gap-3">
              <input type="checkbox" checked={coOpen} onChange={(e) => setCoOpen(e.target.checked)} />
              <span className="eyebrow">Write this with co-authors</span>
            </label>
            {coOpen && (
              <div className="mt-3 text-sm text-slate">
                <p>Invite members and agree each person&apos;s share of what the post earns. Co-authors can only be invited to a saved draft.</p>
                <button type="button" onClick={saveDraftForCoAuthors} disabled={saving} className="btn-primary mt-3 !px-4 !py-2 text-xs disabled:opacity-50">
                  {saving ? "Saving…" : "Save draft & invite co-authors"}
                </button>
              </div>
            )}
          </div>
        ) : null}
      </div>
    )}
    </>
  );
}
