// Careers and Nana-HR's drafts, the pure rules (lib/careers.ts, lib/hr-drafts.ts). Run: npm run test:hr → "ALL OK" (twice).
import assert from "node:assert/strict";
import { CareersError, SEED_ROLES, cleanApplication, cleanRole, nextStatusAllowed } from "../../lib/careers";
import { announcement, cleanTerms, draftsFor, offerLetter, optionGrant } from "../../lib/hr-drafts";

// The five seeded vacancies the owner asked for, each with requirements Nana-HR can check against.
assert.deepEqual(SEED_ROLES.map((r) => r.seedKey), ["cmo", "ua-lead", "partnerships-lead", "care-lead", "safety-lead"]);
assert.deepEqual(SEED_ROLES.map((r) => r.dept), ["growth", "growth", "growth", "support", "moderation"]);
for (const r of SEED_ROLES) assert.ok(r.requirements.length >= 4 && r.responsibilities.length >= 4, r.title);

// Roles need a title, a department and requirements; lists are trimmed and bullets dropped.
assert.throws(() => cleanRole({ title: "", dept: "growth", requirements: ["x"] }), CareersError);
assert.throws(() => cleanRole({ title: "X", dept: "sales", requirements: ["x"] }), CareersError);
assert.throws(() => cleanRole({ title: "X", dept: "growth", requirements: [] }), CareersError);
const role = cleanRole({ title: " Editor ", dept: "content", requirements: "- Writes well\n\n• Edits fast", arrangement: "nonsense" });
assert.deepEqual(role.requirements, ["Writes well", "Edits fast"]);
assert.equal(role.arrangement, "salary_options");
assert.equal(role.location, "Remote, anywhere in Nigeria");
assert.equal(nextStatusAllowed("draft", "open"), true);
assert.equal(nextStatusAllowed("open", "open"), false);
assert.equal(nextStatusAllowed("open", "draft"), false);

// Applications need a real note and consent; only https links are kept.
assert.throws(() => cleanApplication({ coverNote: "short", consent: true }), CareersError);
assert.throws(() => cleanApplication({ coverNote: "x".repeat(50) }), CareersError);
const app = cleanApplication({ coverNote: "I have run community marketing for three Lagos churches.", consent: true, links: "https://a.example/me\njavascript:alert(1)\nhttp://plain.example" });
assert.deepEqual(app.links, ["https://a.example/me"]);

// Drafts: the arrangement decides which documents; given terms are filled, missing ones stay as open points.
const t = cleanTerms({ name: "Ada Obi", title: "Customer care team lead", arrangement: "salary_options", monthlySalary: "80,000", startDate: "1st December 2026", optionShares: "20,000", optionPercent: "0.20%" });
assert.deepEqual(draftsFor(t).map((d) => d.kind), ["offer", "grant", "announcement"]);
assert.deepEqual(draftsFor({ ...t, arrangement: "salary" }).map((d) => d.kind), ["offer", "announcement"]);
assert.deepEqual(draftsFor({ ...t, arrangement: "options_only" }).map((d) => d.kind), ["grant", "announcement"]);
const offer = offerLetter(t);
assert.match(offer, /Dear Ada,/);
assert.match(offer, /₦80,000/);
assert.match(offer, /Stock options/);
assert.match(offer, /\[date\]/, "a missing offer date stays an open point");
assert.match(offer, /DRAFT FOR COUNSEL REVIEW/);
assert.doesNotMatch(offerLetter({ ...t, arrangement: "salary" }), /Stock options/);
assert.match(optionGrant(t), /20,000 shares, being 0\.20%/);
const ann = announcement(t);
assert.doesNotMatch(ann.split("> Edit note")[0], /₦|shares|salary/i, "no pay or equity in the announcement");
// Nothing from the documents the templates came from leaks into a draft for someone else.
for (const d of draftsFor(t)) assert.doesNotMatch(d.markdown, /Nora|Bawa|150,000 shares|₦50,000/);

console.log("ALL OK");
