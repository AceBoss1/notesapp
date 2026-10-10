"use client";

import { useAppPush } from "@/components/AppLink";
import { useEffect, useRef, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { recordView } from "@/lib/track";
import {
  incrementViewCount,
  incrementShareCount,
  hasLiked,
  toggleLike,
} from "@/lib/engagement";
import { getUserByUid } from "@/lib/users";
import { notifyLike } from "@/lib/notifications";
import { xIntentText } from "@/lib/social-text";

const SHARE_TARGETS = [
  {
    label: "WhatsApp",
    build: (url: string, title: string) =>
      `https://wa.me/?text=${encodeURIComponent(title + " " + url)}`,
  },
  {
    label: "X / Twitter",
    build: (url: string, title: string, excerpt?: string) =>
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(excerpt ? xIntentText({ title, excerpt }) : title)}&url=${encodeURIComponent(url)}`,
  },
  {
    label: "Facebook",
    build: (url: string) =>
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
  },
  {
    label: "LinkedIn",
    build: (url: string) =>
      `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
  },
];

export default function SocialBar({
  noteId,
  slug,
  title,
  noteAuthor,
  excerpt,
  initialViewCount,
  initialLikeCount,
  initialShareCount,
}: {
  noteId: string;
  slug: string;
  title: string;
  noteAuthor: string;
  excerpt?: string; // the opening of the post: what the share window to X carries beside the title
  initialViewCount: number;
  initialLikeCount: number;
  initialShareCount: number;
}) {
  const push = useAppPush(); // a full page load on a member's own domain
  const [uid, setUid] = useState<string | null>(null);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(initialLikeCount);
  const [shareCount, setShareCount] = useState(initialShareCount);
  const [viewCount, setViewCount] = useState(initialViewCount);
  const [copied, setCopied] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const shareRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const key = `viewed:${noteId}`;
    if (!sessionStorage.getItem(key)) {
      sessionStorage.setItem(key, "1");
      incrementViewCount(noteId);
      setViewCount((v) => v + 1);
    }
    recordView("note", noteId); // daily bucket for the trending feed
  }, [noteId]);

  useEffect(() => {
    return onAuthStateChanged(auth, async (user) => {
      setUid(user?.uid || null);
      if (user) setLiked(await hasLiked(noteId, user.uid));
    });
  }, [noteId]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (shareRef.current && !shareRef.current.contains(e.target as Node)) {
        setShareOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleLike() {
    if (!uid) {
      push("/login");
      return;
    }
    const nowLiked = await toggleLike(noteId, uid);
    setLiked(nowLiked);
    setLikeCount((c) => c + (nowLiked ? 1 : -1));
    if (nowLiked) {
      const liker = await getUserByUid(uid);
      if (liker) {
        notifyLike({ slug, title, author: noteAuthor }, liker).catch((err) =>
          console.warn("notifyLike failed:", err)
        );
      }
    }
  }

  function scrollToComments() {
    document
      .getElementById("comments")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function recordShare() {
    await incrementShareCount(noteId);
    setShareCount((c) => c + 1);
  }

  async function handleShareClick(buildUrl: (url: string, title: string, excerpt?: string) => string) {
    const url = `${window.location.origin}/journals/${slug}`;
    window.open(buildUrl(url, title, excerpt), "_blank", "noopener,noreferrer");
    setShareOpen(false);
    await recordShare();
  }

  async function handleCopyLink() {
    const url = `${window.location.origin}/journals/${slug}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setShareOpen(false);
    setTimeout(() => setCopied(false), 2000);
    await recordShare();
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-5 border-y border-rule">
      <div className="flex items-center gap-3">
        <button
          onClick={handleLike}
          className={`flex items-center gap-2 px-4 py-2.5 border font-ui text-sm font-semibold transition-colors ${
            liked
              ? "border-crimson bg-crimson/10 text-crimson-bright"
              : "border-rule text-slate hover:border-crimson hover:text-crimson-bright"
          }`}
        >
          <span className="text-lg leading-none">{liked ? "♥" : "♡"}</span>
          <span>{likeCount}</span>
        </button>

        <button
          onClick={scrollToComments}
          className="flex items-center gap-2 px-4 py-2.5 border border-rule text-slate hover:border-crimson hover:text-crimson-bright font-ui text-sm font-semibold transition-colors"
        >
          <span className="text-lg leading-none">💬</span>
          <span>Comment</span>
        </button>

        <div className="relative" ref={shareRef}>
          <button
            onClick={() => setShareOpen((v) => !v)}
            className="flex items-center gap-2 px-4 py-2.5 border border-rule text-slate hover:border-crimson hover:text-crimson-bright font-ui text-sm font-semibold transition-colors"
          >
            <span className="text-lg leading-none">🔁</span>
            <span>{copied ? "Link copied" : `Share (${shareCount})`}</span>
          </button>

          {shareOpen && (
            <div className="absolute left-0 top-full mt-2 w-56 border border-rule bg-card shadow-lg z-10">
              {SHARE_TARGETS.map((t) => (
                <button
                  key={t.label}
                  onClick={() => handleShareClick(t.build)}
                  className="block w-full text-left px-4 py-3 text-sm font-ui hover:bg-paper transition-colors border-b border-rule"
                >
                  {t.label}
                </button>
              ))}
              <button
                onClick={handleCopyLink}
                className="block w-full text-left px-4 py-3 text-sm font-ui hover:bg-paper transition-colors"
              >
                Copy Link
              </button>
            </div>
          )}
        </div>
      </div>

      <span className="font-mono text-xs text-slate whitespace-nowrap">
        👁 {viewCount} views
      </span>
    </div>
  );
}
