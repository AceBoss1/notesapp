import { expect, test } from "@playwright/test";

// The pages members land on most, and the safety rails that must never break. Kept short on purpose: it runs on every pull
// request (CI) and against staging before a release (docs/STAGING.md).
const PAGES = [
  { path: "/", text: /NotesApp/i },
  { path: "/pricing", text: /Pro|Business/ },
  { path: "/journals", text: /journal/i },
  { path: "/explore", text: /Explore/ },
  { path: "/trending", text: /Most visited/ },
  { path: "/help", text: /help/i },
  { path: "/life", text: /Notes Life/i },
  { path: "/status", text: /status/i },
];

for (const p of PAGES) {
  test(`opens ${p.path}`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const res = await page.goto(p.path, { waitUntil: "domcontentloaded" });
    expect(res?.status(), `${p.path} answers`).toBeLessThan(400);
    await expect(page.locator("body")).toContainText(p.text);
    expect(errors, `no script errors on ${p.path}`).toEqual([]);
  });
}

test("domains: life. shows Notes Life under its own name; other domains name the primary address", async ({ request }) => {
  const life = await request.get("/", { headers: { host: "life.notesapp.name.ng" }, maxRedirects: 0 });
  expect(life.status()).toBe(200);
  expect(await life.text()).toContain("Notes Life");
  const play = await request.get("/play", { headers: { host: "life.naapp.tech" }, maxRedirects: 0 });
  expect([307, 308]).toContain(play.status());
  expect(play.headers().location).toMatch(/^https:\/\/www\.naapp\.tech\/life\/play/);
});

test("server-only writes refuse people who aren't signed in", async ({ request }) => {
  expect((await request.post("/api/comments", { data: { noteId: "x", content: "hi" } })).status()).toBe(401);
  expect((await request.post("/api/notify/like", { data: { noteId: "x" } })).status()).toBe(401);
  expect((await request.post("/api/admin/notify", { data: { uid: "x", kind: "suspended" } })).status()).toBe(403);
  expect((await request.get("/api/admin/digest")).status()).toBe(403);
  expect((await request.post("/api/journals/save", { data: { noteId: "x" } })).status()).toBe(401);
});

test("a forged unsubscribe link does nothing", async ({ request }) => {
  const r = await request.post("/api/digest/unsubscribe?u=someone&t=forged");
  expect(r.status()).toBe(400);
});
