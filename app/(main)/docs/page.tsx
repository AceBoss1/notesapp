import Link from "next/link";
import type { Metadata } from "next";
import { ENDPOINTS, WEBHOOK_DOCS } from "@/lib/api-docs";

export const metadata: Metadata = {
  title: "API Docs",
  description: "The #NotesApp API for Enterprise partners: authentication, posts, bookings, orders, earnings, webhooks and custom domains.",
};

const code = "overflow-x-auto rounded bg-ink px-4 py-3 font-mono text-xs leading-relaxed text-paper";
const METHOD: Record<string, string> = { GET: "bg-emerald-100 text-emerald-900", POST: "bg-sky-100 text-sky-900", PATCH: "bg-amber-100 text-amber-900" };

export default function DocsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <span className="eyebrow">Docs</span>
      <h1 className="mt-3 font-display text-4xl text-ink sm:text-5xl">#NotesApp API</h1>
      <p className="mt-4 text-lg text-slate">
        Server-to-server access for Enterprise partners: publish posts, and read your own bookings, orders and earnings. Get access by contacting us, then create keys in the <Link href="/console" className="text-crimson underline">Console</Link>.
        Changes are listed in the <Link href="/changelog" className="text-crimson underline">Changelog</Link>.
      </p>

      <nav className="card mt-8 p-4 text-sm" aria-label="On this page">
        <ul className="grid gap-1 sm:grid-cols-2">
          {[["quickstart", "Quickstart"], ["auth", "Authentication"], ["errors", "Errors & limits"], ["endpoints", "Endpoints"], ["webhooks", "Webhooks"], ["domains", "Your own domain"]].map(([id, label]) => (
            <li key={id}><a href={`#${id}`} className="text-crimson underline">{label}</a></li>
          ))}
        </ul>
      </nav>

      <h2 id="quickstart" className="mt-12 font-display text-3xl text-ink">Quickstart</h2>
      <ol className="mt-3 list-decimal space-y-1 pl-5 text-slate">
        <li>Ask us to switch on API access for your account with the <Link href="/contact?topic=api" className="text-crimson underline">contact form</Link>.</li>
        <li>Open the Console and create a key with the permissions you need. Copy it — it&apos;s shown once.</li>
        <li>Call the API:</li>
      </ol>
      <pre className={`${code} mt-3`}>{`curl https://www.notesapp.name.ng/api/v1/me \\
  -H "Authorization: Bearer nak_your_key_here"`}</pre>

      <h2 id="auth" className="mt-12 font-display text-3xl text-ink">Authentication</h2>
      <p className="mt-3 text-slate">
        Send your key as a bearer token on every request. Keys look like <code className="font-mono text-xs">nak_&lt;id&gt;.&lt;secret&gt;</code>, belong to one account and carry <strong>scopes</strong>: <code className="font-mono text-xs">read:posts</code>, <code className="font-mono text-xs">write:posts</code>, <code className="font-mono text-xs">read:bookings</code>, <code className="font-mono text-xs">read:orders</code>, <code className="font-mono text-xs">read:earnings</code>.
        We store only a hash of the secret. Revoke a key in the Console and it stops working at once. Keep keys on your server — never in a browser or mobile app.
      </p>

      <h2 id="errors" className="mt-12 font-display text-3xl text-ink">Errors &amp; limits</h2>
      <p className="mt-3 text-slate">Errors share one shape and the usual HTTP status:</p>
      <pre className={`${code} mt-3`}>{`{ "error": { "code": "missing_scope", "message": "This key doesn't have the \`write:posts\` scope." } }`}</pre>
      <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate">
        <li><code className="font-mono text-xs">401 invalid_key</code> · <code className="font-mono text-xs">403 api_not_enabled / missing_scope</code> · <code className="font-mono text-xs">404 not_found</code> · <code className="font-mono text-xs">400 invalid_request</code> · <code className="font-mono text-xs">429 rate_limited</code> (120 requests per minute per key; see <code className="font-mono text-xs">Retry-After</code>).</li>
        <li>Lists are paginated: pass <code className="font-mono text-xs">limit</code> (max 100) and the <code className="font-mono text-xs">next_cursor</code> you got back. Money is in kobo.</li>
        <li>For <code className="font-mono text-xs">POST /v1/posts</code>, send an <code className="font-mono text-xs">Idempotency-Key</code> header; a retry with the same key returns the original post instead of creating a duplicate.</li>
      </ul>

      <h2 id="endpoints" className="mt-12 font-display text-3xl text-ink">Endpoints</h2>
      <p className="mt-2 text-sm text-slate">Base URL: <code className="font-mono text-xs">https://www.notesapp.name.ng/api</code></p>
      <div className="mt-6 space-y-8">
        {ENDPOINTS.map((e) => (
          <section key={e.id} id={e.id} className="card p-5">
            <div className="flex flex-wrap items-center gap-3">
              <span className={`rounded-md px-2 py-0.5 font-mono text-xs font-bold ${METHOD[e.method]}`}>{e.method}</span>
              <code className="font-mono text-sm text-ink">{e.path}</code>
              <span className="ml-auto text-xs text-slate">scope: <code className="font-mono">{e.scope}</code></span>
            </div>
            <p className="mt-3 text-sm text-slate">{e.summary}</p>
            {e.params && (
              <ul className="mt-3 space-y-1 text-sm">
                {e.params.map((p) => (
                  <li key={p.name} className="text-slate"><code className="font-mono text-xs text-ink">{p.name}</code> <span className="text-xs">({p.in}{p.required ? ", required" : ""})</span> — {p.text}</li>
                ))}
              </ul>
            )}
            <pre className={`${code} mt-4`}>{e.example}</pre>
          </section>
        ))}
      </div>

      <h2 id="webhooks" className="mt-12 font-display text-3xl text-ink">Webhooks</h2>
      <p className="mt-3 text-slate">Add an https endpoint in the Console and choose events. We POST JSON, wait up to 5 seconds for a 2xx, and log every delivery (resend any of them from the Console).</p>
      <ul className="mt-3 space-y-1 text-sm text-slate">
        {WEBHOOK_DOCS.map((w) => <li key={w.event}><code className="font-mono text-xs text-ink">{w.event}</code> — {w.text}</li>)}
      </ul>
      <pre className={`${code} mt-4`}>{`{ "id": "evt_9f2c…", "type": "order.paid", "created": 1791100800,
  "data": { "id": "ref_2", "item_title": "Tote bag", "quantity": 2, "amount_kobo": 1300000 } }`}</pre>
      <p className="mt-4 text-slate">
        <strong>Verify the signature.</strong> Each request carries <code className="font-mono text-xs">NotesApp-Signature: t=&lt;unix&gt;,v1=&lt;hex&gt;</code>, an HMAC-SHA256 of <code className="font-mono text-xs">&quot;&lt;t&gt;.&lt;raw body&gt;&quot;</code> using your endpoint&apos;s signing secret. Reject anything that doesn&apos;t match or whose timestamp is more than five minutes old.
      </p>
      <pre className={`${code} mt-3`}>{`import { createHmac, timingSafeEqual } from "crypto";

function verify(rawBody, header, secret) {
  const { t, v1 } = Object.fromEntries(header.split(",").map((p) => p.split("=")));
  if (Math.abs(Date.now() / 1000 - Number(t)) > 300) return false;
  const expected = createHmac("sha256", secret).update(\`\${t}.\${rawBody}\`).digest("hex");
  return v1.length === expected.length && timingSafeEqual(Buffer.from(v1), Buffer.from(expected));
}`}</pre>

      <h2 id="domains" className="mt-12 font-display text-3xl text-ink">Your own domain</h2>
      <p className="mt-3 text-slate">
        Enterprise accounts get their own branded site on their own domain — <span className="font-mono text-xs">notes.yourbrand.com</span> or the root <span className="font-mono text-xs">yourbrand.com</span>. Add it in the Console, create the DNS record it shows
        (a CNAME for a subdomain, an A record for a root domain), then press <em>Check status</em>. The site has your name in the header, three pages — Home (your profile and booking), Notes (<span className="font-mono text-xs">/notes</span>) and Shop (<span className="font-mono text-xs">/shop</span>) — and a small “powered by #NotesApp” footer. Your <span className="font-mono text-xs">/u/username</span> page keeps working; you choose whether the front page shows Home or your Shop.
        Visitors browse, sign in, book sessions and buy right on your domain. Signing in briefly passes through www.notesapp.name.ng (where accounts live) and brings them straight back, already signed in; payments run on Paystack and return to your site.
      </p>
    </div>
  );
}
