// Single source for the /docs endpoint reference — the page renders straight from this, so docs and the
// routes under app/api/v1 are edited together.
export type Endpoint = {
  id: string;
  method: "GET" | "POST" | "PATCH";
  path: string;
  scope: string;
  summary: string;
  params?: { name: string; in: "query" | "body"; required?: boolean; text: string }[];
  example: string; // sample response
};

export const ENDPOINTS: Endpoint[] = [
  {
    id: "me", method: "GET", path: "/v1/me", scope: "any key", summary: "The account a key belongs to — a quick way to test your key.",
    example: `{ "id": "uid_123", "username": "precheks", "display_name": "Precheks", "plan": "enterprise",
  "profile_url": "https://www.notesapp.name.ng/u/precheks", "payouts_ready": true }`,
  },
  {
    id: "list-posts", method: "GET", path: "/v1/posts", scope: "read:posts", summary: "Your posts, newest first.",
    params: [
      { name: "status", in: "query", text: "`draft` or `published`." },
      { name: "limit", in: "query", text: "1–100, default 25." },
      { name: "cursor", in: "query", text: "`next_cursor` from the previous page." },
    ],
    example: `{ "data": [ { "id": "n_1", "slug": "minding-the-pay-gap", "url": "https://www.notesapp.name.ng/journals/minding-the-pay-gap",
    "title": "Minding the Pay Gap", "status": "published", "date": "2026-10-03T09:00:00.000Z",
    "tags": [], "categories": [], "featured_image": "", "premium": false,
    "view_count": 8, "like_count": 1, "share_count": 0 } ], "next_cursor": null }`,
  },
  {
    id: "get-post", method: "GET", path: "/v1/posts/{id}", scope: "read:posts", summary: "One of your posts, including its Markdown `content`.",
    example: `{ "id": "n_1", "title": "Minding the Pay Gap", "status": "published", "content": "# …", "…": "…" }`,
  },
  {
    id: "create-post", method: "POST", path: "/v1/posts", scope: "write:posts", summary: "Create a post as the account. Drafts unless you send `status: \"published\"`. Send an `Idempotency-Key` header to make retries safe.",
    params: [
      { name: "title", in: "body", required: true, text: "Up to 140 characters." },
      { name: "content", in: "body", required: true, text: "Markdown, up to 100,000 characters." },
      { name: "status", in: "body", text: "`draft` (default) or `published`." },
      { name: "tags", in: "body", text: "Up to 10 strings." },
      { name: "categories", in: "body", text: "Up to 5 strings." },
      { name: "featured_image", in: "body", text: "An https image URL." },
      { name: "premium", in: "body", text: "`true` to lock it behind a subscription." },
    ],
    example: `// 201 Created
{ "id": "n_2", "slug": "hello-world", "status": "draft", "title": "Hello world", "content": "…", "…": "…" }`,
  },
  {
    id: "update-post", method: "PATCH", path: "/v1/posts/{id}", scope: "write:posts", summary: "Edit your own post, or publish / unpublish it with `status`. Send only the fields you want to change.",
    example: `{ "id": "n_2", "status": "published", "…": "…" }`,
  },
  {
    id: "bookings", method: "GET", path: "/v1/bookings", scope: "read:bookings", summary: "Sessions booked with you. Client contact details are never returned.",
    params: [{ name: "status", in: "query", text: "e.g. `confirmed`." }, { name: "limit", in: "query", text: "1–100." }, { name: "cursor", in: "query", text: "Pagination cursor." }],
    example: `{ "data": [ { "id": "ref_1", "date": "2026-10-12", "slot": "10:00", "minutes": 60,
    "starts_at": "2026-10-12T09:00:00.000Z", "status": "confirmed", "amount_kobo": 1500000, "created_at": "…" } ], "next_cursor": null }`,
  },
  {
    id: "orders", method: "GET", path: "/v1/orders", scope: "read:orders", summary: "Store orders for your physical items. Add `kind=digital` for download sales. Buyers' names, phones and street addresses are never returned — only city and state.",
    params: [{ name: "kind", in: "query", text: "`digital` for download sales (default is physical orders)." }, { name: "status", in: "query", text: "Physical orders only, e.g. `paid`." }],
    example: `{ "data": [ { "id": "ref_2", "item_title": "Tote bag", "quantity": 2, "amount_kobo": 1300000,
    "commission_kobo": 52000, "status": "paid", "parcel_id": "NA-…", "ship_to": { "city": "Abuja", "state": "FCT" }, "paid_at": "…" } ], "next_cursor": null }`,
  },
  {
    id: "earnings", method: "GET", path: "/v1/earnings", scope: "read:earnings", summary: "Your payout ledger and a summary by status (held, transferring, paid …). Amounts are in kobo (₦1 = 100 kobo).",
    params: [{ name: "kind", in: "query", text: "`booking`, `order`, `digital`, `gift` or `subscription`." }],
    example: `{ "summary": { "held": { "count": 3, "net_kobo": 4200000 }, "paid": { "count": 9, "net_kobo": 15000000 } },
  "data": [ { "id": "ref_1", "kind": "booking", "gross_kobo": 1500000, "commission_kobo": 225000, "net_kobo": 1275000,
    "status": "held", "release_after": "…", "created_at": "…" } ], "next_cursor": null }`,
  },
];

export const WEBHOOK_DOCS: { event: string; text: string }[] = [
  { event: "booking.created", text: "A client paid for a session with you." },
  { event: "order.paid", text: "A buyer paid for a physical item in your store." },
  { event: "digital.sold", text: "A buyer paid for a download in your store." },
  { event: "payout.released", text: "A payout to your bank account was started." },
  { event: "post.published", text: "A post of yours went live through the API." },
];
