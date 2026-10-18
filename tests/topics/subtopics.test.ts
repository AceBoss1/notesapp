// Subtopics and subcategories (lib/subtopics.ts): labels, slugs, and reading Nana's answer safely. Part of npm run test:topics.
import assert from "node:assert/strict";
import {
  cleanSubtopicLabel, subtopicSlug, subtopicHashtag, docIdOf, sameAsParent, parseTopicSuggestion, parseCategorySuggestion,
  fallbackTopicSuggestion, fallbackCategorySuggestion, type Subtopic,
} from "../../lib/subtopics";

// labels: tidy, 2 to 30 characters, up to four words, at least one letter; the writer's capitals kept
assert.equal(cleanSubtopicLabel("  it support!! "), "It support");
assert.equal(cleanSubtopicLabel("#CompTIA A+"), "CompTIA A+");
assert.equal(cleanSubtopicLabel("Real estate law"), "Real estate law");
for (const bad of ["", "a", "123", "one two three four five", "x".repeat(40).replace(/x/g, "x ")]) assert.equal(cleanSubtopicLabel(bad), "", bad);
assert.equal(cleanSubtopicLabel("<b>Bags</b>"), "B Bags b", "markup is reduced to plain words (labels are only ever shown as text)");
assert.equal(subtopicSlug("IT Support"), "it-support");
assert.equal(subtopicHashtag("IT Support"), "#ITSupport");
assert.equal(subtopicHashtag("real estate law"), "#RealEstateLaw");
assert.equal(docIdOf("topic", "tech", "it-support"), "tech__it-support");
assert.equal(docIdOf("category", "Shoes & bags", "bags"), "shoes-bags__bags");
assert.ok(sameAsParent("topic", "tech", "Tech")); assert.ok(sameAsParent("category", "Electronics", "electronics")); assert.ok(!sameAsParent("topic", "tech", "IT Support"));

const existing: Subtopic[] = [{ parent: "tech", slug: "it-support", label: "IT Support" }, { parent: "careers", slug: "certifications", label: "Certifications" }];
// Nana's answer: topics must be ours; existing subtopics are reused (their label wins); new ones are tidied and marked; each subtopic's
// topic is added (up to three); rubbish is dropped; JSON inside a code fence is fine
const s = parseTopicSuggestion("```json\n{\"topics\":[\"tech\",\"nope\"],\"subtopics\":[{\"parent\":\"tech\",\"label\":\"it support\"},{\"parent\":\"careers\",\"label\":\"Certifications\"},{\"parent\":\"tech\",\"label\":\"CompTIA\"},{\"parent\":\"fake\",\"label\":\"X\"},{\"parent\":\"tech\",\"label\":\"Tech\"}]}\n```", existing);
assert.deepEqual(s.topics, ["tech", "careers"]);
assert.deepEqual(s.subtopics, [
  { parent: "tech", slug: "it-support", label: "IT Support", isNew: false },
  { parent: "careers", slug: "certifications", label: "Certifications", isNew: false },
  { parent: "tech", slug: "comptia", label: "CompTIA", isNew: true },
]);
assert.deepEqual(parseTopicSuggestion("Sorry, I can't help with that.", existing), { topics: [], subtopics: [] });
assert.deepEqual(parseTopicSuggestion("{not json", existing), { topics: [], subtopics: [] });
// four topics asked for: three kept
assert.equal(parseTopicSuggestion('{"topics":["tech","careers","education","ai"]}', existing).topics.length, 3);

const items = parseCategorySuggestion('{"options":[{"category":"Shoes & bags","subcategory":"Tote bags"},{"category":"Fashion & clothing","subcategory":null},{"category":"Cars","subcategory":"x"},{"category":"Art & crafts","subcategory":"Art & crafts"}]}', []);
assert.deepEqual(items.options, [
  { category: "Shoes & bags", subcategory: { slug: "tote-bags", label: "Tote bags", isNew: true } },
  { category: "Fashion & clothing", subcategory: null },
  { category: "Art & crafts", subcategory: null },
]);

// without AI: the words of the title
const f = fallbackTopicSuggestion("IT Support Training for beginners", existing);
assert.deepEqual(f.subtopics.map((x) => x.slug), ["it-support"]);
assert.ok(f.topics.includes("tech"));
assert.ok(fallbackTopicSuggestion("How I passed my fintech interview", existing).topics.includes("fintech"));
assert.deepEqual(fallbackCategorySuggestion("Handmade leather bags", []).options.map((o) => o.category), ["Shoes & bags"]);
console.log("SUBTOPICS OK");
