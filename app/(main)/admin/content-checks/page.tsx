"use client";

import Link from "next/link";
import { useAdminAuth } from "@/lib/useAdminAuth";
import ContentChecksAdmin from "@/components/admin/ContentChecksAdmin";

// Admin → People & Trust → Content checks (AI content checks, docs/CONTENT_CHECKS.md): a tab of Reports. Trust & safety review held and
// appealed posts; the Legal team also sees the child-safety queue; super admins set the figures.
export default function AdminContentChecksPage() {
  const { user, loading } = useAdminAuth();
  if (loading) return <p className="p-8 text-slate">Loading…</p>;
  if (!user) return <p className="p-8 text-slate">Admins only.</p>;
  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="font-display text-3xl text-ink">Content checks</h1>
      <p className="mt-2 text-sm text-slate">Every photo, video frame and text others can see is checked by AI before it is published. Borderline posts and appeals wait here for a person. Restoring a post publishes it and removes its strike.</p>
      <div className="mt-4 flex gap-2">
        <Link href="/admin/reports" className="rounded-full border border-rule px-4 py-1 text-sm">Reports</Link>
        <span aria-current="page" className="rounded-full border border-crimson bg-crimson px-4 py-1 text-sm text-white">🛡 Content checks</span>
      </div>
      <ContentChecksAdmin user={user} />
    </div>
  );
}
