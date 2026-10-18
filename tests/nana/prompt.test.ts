// Which help articles go with an answer (lib/nana-prompt.ts): the matches for the question, plus a little of each earlier question, never
// the whole help centre; the fixed part (instructions and titles) is the same whatever is asked, so it can be cached.
// Run: npm run test:nana → "ALL OK".
import assert from "node:assert/strict";
import { ARTICLES_MAX, KNOWLEDGE_MAX_CHARS, buildSystem, knowledgeBlock, pickArticles } from "../../lib/nana-prompt";
import type { KbArticle } from "../../lib/kb";

const art = (slug: string, title: string, body: string): KbArticle => ({ slug, title, body, category: "Getting started", source: "built-in", updatedAt: "" } as KbArticle);
const all = [
  art("payouts", "Payouts: getting paid", "Your earnings are paid to your bank account every week."),
  art("paid-sessions", "Paid sessions and bookings", "Set your rates and people book and pay for a session."),
  art("refunds", "Refunds", "If a session is cancelled you get a refund."),
  art("plans-and-prices", "Plans and prices", "Pro costs a monthly price; Business more."),
  art("mcp-ai-assistants", "MCP: use #NotesApp from your AI assistant", "Add the MCP server to Claude or ChatGPT."),
  ...Array.from({ length: 40 }, (_, i) => art(`filler-${i}`, `Something else ${i}`, "Unrelated words about pottery and gardens.")),
];
const slugs = (qs: string[]) => pickArticles(all, qs).map((a) => a.slug);

assert.equal(slugs(["How do I get paid?"])[0], "payouts");
assert.deepEqual(slugs(["What is MCP?"]), ["mcp-ai-assistants"]);
assert.ok(slugs(["How do bookings work?", "and refunds?"]).includes("refunds"), "a short follow-up leans on the question before it");
assert.ok(slugs(["How do bookings work?", "and refunds?"]).includes("paid-sessions"), "and keeps what the first answer used");
assert.deepEqual(slugs(["hi"]), [], "a greeting sends no articles");
assert.ok(pickArticles(all, ["pottery gardens unrelated words something"]).length <= ARTICLES_MAX, "never more than six");
const big = Array.from({ length: 8 }, (_, i) => art(`big-${i}`, `Payouts ${i}`, "payouts ".repeat(1500)));
const size = pickArticles(big, ["payouts"]).reduce((n, a) => n + a.title.length + a.body.length + 40, 0);
assert.ok(size <= KNOWLEDGE_MAX_CHARS, "kept under the size cap");

// The fixed part lists every title but no article text, and doesn't change with the question.
const fixed = buildSystem(all);
assert.match(fixed, /- Refunds: \/help\/refunds/); assert.doesNotMatch(fixed, /If a session is cancelled/);
assert.ok(fixed.length < 20_000, "small enough to stay cheap; well over the 512-token caching minimum");
assert.match(knowledgeBlock(pickArticles(all, ["refunds"])), /If a session is cancelled you get a refund/);
assert.match(knowledgeBlock([]), /none matched/);
console.log("ALL OK");
