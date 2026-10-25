"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAdminAuth } from "@/lib/useAdminAuth";
import { useAdminCall } from "@/lib/useAdminCall";
import { Masked } from "@/components/admin/Masked";
import { Lead, LEAD_CATEGORIES } from "@/lib/leads";

const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(LEAD_CATEGORIES.map((c) => [c.value, c.label]));

export default function AdminLeadsPage() {
  const { user, loading } = useAdminAuth();
  const call = useAdminCall(user, "/api/admin/leads");
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"all" | Lead["status"]>("all");

  // Through /api/admin/leads: senders' emails arrive masked (lib/pii.ts); Show reveals one with a logged reason.
  function reload() {
    call()
      .then((j) => setLeads(j.leads))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load leads"));
  }
  const act = (id: string, action: "read" | "archived" | "delete") =>
    call({ id, action }).then(reload).catch((err) => setError(err instanceof Error ? err.message : "Failed"));

  useEffect(() => {
    if (!user) return;
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  if (loading || !user) {
    return <div className="px-6 py-24 text-center text-slate">Loading…</div>;
  }

  const visible = leads?.filter((l) => filter === "all" || l.status === filter) || [];

  return (
    <section className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-14">
      <Link
        href="/admin"
        className="block font-ui text-xs font-semibold uppercase tracking-wideish text-crimson-bright"
      >
        ← Dashboard
      </Link>
      <p className="eyebrow mt-6">
        {leads ? `${leads.filter((l) => l.status === "new").length} new` : ""}
      </p>
      <h1 className="font-display text-4xl mt-3">Leads</h1>
      <p className="mt-3 text-sm text-slate max-w-xl">
        Every /contact submission — general enquiries, support, bug
        reports, and anything else routed here rather than a shared
        inbox someone has to remember to check.
      </p>

      <div className="mt-6 flex gap-2">
        {(["all", "new", "read", "archived"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-4 py-1.5 font-ui text-xs font-semibold transition-colors ${
              filter === f ? "bg-crimson text-paper" : "border border-rule text-ink hover:border-crimson"
            }`}
          >
            {f[0].toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {error && <p className="mt-6 text-sm text-red-700">{error}</p>}

      {!leads ? (
        <p className="mt-8 text-slate">Loading…</p>
      ) : visible.length === 0 ? (
        <p className="mt-8 text-sm text-slate">Nothing here.</p>
      ) : (
        <div className="mt-8 divide-y divide-rule">
          {visible.map((l) => (
            <div key={l.id} className="py-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-ui font-semibold text-ink">
                    {l.name}{" "}
                    <Masked kind="lead-email" subject={l.id} masked={l.email} page="Leads" className="font-mono text-xs text-crimson-bright" />
                  </p>
                  <p className="mt-1 flex items-center gap-2 font-mono text-[10px] uppercase tracking-wideish text-slate">
                    <span className="rounded-full bg-crimson/10 px-2 py-0.5 text-crimson-bright">
                      {CATEGORY_LABEL[l.category] || l.category}
                    </span>
                    {new Date(l.createdAt).toLocaleString("en-NG", { hour12: true })}
                  </p>
                </div>
                <div className="flex gap-2">
                  {l.status !== "read" && (
                    <button
                      onClick={() => act(l.id, "read")}
                      className="border border-rule px-3 py-1.5 font-ui text-xs font-semibold hover:border-crimson"
                    >
                      Mark Read
                    </button>
                  )}
                  {l.status !== "archived" && (
                    <button
                      onClick={() => act(l.id, "archived")}
                      className="border border-rule px-3 py-1.5 font-ui text-xs font-semibold hover:border-crimson"
                    >
                      Archive
                    </button>
                  )}
                  <button
                    onClick={() => {
                      if (confirm("Delete this lead permanently?")) act(l.id, "delete");
                    }}
                    className="border border-rule px-3 py-1.5 font-ui text-xs font-semibold text-red-700 hover:border-red-700"
                  >
                    Delete
                  </button>
                </div>
              </div>
              <p className="mt-3 text-sm text-ink font-body">{l.message}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
