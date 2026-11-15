// Careers and Nana-HR's drafts, the pure rules (lib/careers.ts, lib/hr-drafts.ts). Run: npm run test:hr → "ALL OK" (twice).
import assert from "node:assert/strict";
import { CareersError, SEED_ROLES, cleanApplication, cleanRole, nextStatusAllowed } from "../../lib/careers";
import { ROLE_PRESETS, ambassadorAgreement, announcement, cleanTerms, contractorAgreement, draftsFor, offerLetter, optionGrant, presetTerms } from "../../lib/hr-drafts";
import { COMPANY_INFO } from "../../lib/site";

// The five seeded vacancies the owner asked for, each with requirements Nana-HR can check against.
assert.deepEqual(SEED_ROLES.map((r) => r.seedKey), ["cmo", "ua-lead", "partnerships-lead", "care-lead", "safety-lead", "community-strategist", "chief-of-staff", "executive-assistant", "campus-ambassador"]);
assert.deepEqual(SEED_ROLES.map((r) => r.dept), ["marketing", "marketing", "growth", "support", "moderation", "support", "executive", "executive", "marketing"]); // CMO and UA lead in Marketing; the partnerships lead in Sales & partnerships
for (const r of SEED_ROLES) assert.ok(r.requirements.length >= 4 && r.responsibilities.length >= 4, r.title);

// The Campus Ambassador (9 Nov 2026): affiliate rewards and employee stock options, a contract role: no employment offer letter but
// the Campus Ambassador Agreement (15 Nov 2026), an option grant, and a role form that keeps the arrangement.
const amb = SEED_ROLES.find((r) => r.seedKey === "campus-ambassador")!;
assert.equal(amb.arrangement, "affiliate_options");
assert.ok(/affiliate rewards/i.test(amb.about) && /stock options/i.test(amb.about));
assert.equal(cleanRole({ title: "Campus Ambassador", dept: "marketing", requirements: ["A student"], arrangement: "affiliate_options" }).arrangement, "affiliate_options");
const ambDrafts = draftsFor(cleanTerms({ name: "Ada", arrangement: "affiliate_options" }));
assert.deepEqual(ambDrafts.map((d) => d.kind), ["agreement", "grant", "announcement"], "an agreement, not an employment offer, for a contract role");
assert.equal(ambDrafts[0].title, "Campus Ambassador Agreement: Ada");
assert.match(offerLetter(cleanTerms({ arrangement: "affiliate_options" })), /Campus Ambassador Agreement/);
assert.doesNotMatch(offerLetter(cleanTerms({ arrangement: "affiliate_options" })), /\[Legal: ambassador agreement template\]/, "no more pointer to a template that didn't exist");

// The Campus Ambassador Agreement (15 Nov 2026): from the role's preset and the form's terms; an independent contractor, affiliate
// rewards with no fixed pay and no hard-coded rates, the option grant by reference, and every required clause.
assert.ok(ROLE_PRESETS["campus-ambassador"], "the Campus Ambassador has a preset");
for (const r of SEED_ROLES) if (r.arrangement === "affiliate_options" || r.arrangement === "options_only") assert.ok(ROLE_PRESETS[r.seedKey], `${r.seedKey}: a contract role has a preset`);
const ambP = ROLE_PRESETS["campus-ambassador"];
assert.equal(ambP.title, amb.title);
assert.equal(ambP.reportsTo.toLowerCase(), amb.reportsTo.toLowerCase());
assert.equal(ambP.duties.length, 5);
const ambT = cleanTerms({ ...presetTerms("campus-ambassador"), name: "Ada Obi", arrangement: "affiliate_options", startDate: "1st December 2026", optionShares: "2,000", optionPercent: "0.02%" });
assert.equal(ambT.hoursPerWeek, "5", "the preset's hours, not the employees' default");
const ag = ambassadorAgreement(ambT);
assert.match(ag, /DRAFT FOR COUNSEL REVIEW/);
assert.match(ag, /Campus Ambassador Agreement/);
assert.ok(ag.includes(COMPANY_INFO.legalName) && ag.includes(`RC ${COMPANY_INFO.rcNumber}`) && ag.includes(`TIN ${COMPANY_INFO.tin}`), "company details from COMPANY_INFO");
assert.match(ag, /independent contractor, not as an employee/);
assert.match(ag, /Ada Obi/);
assert.match(ag, /1st December 2026/);
assert.match(ag, /You report to the User Acquisition Lead/);
assert.match(ag, /about 5 hours a week/);
for (const h of ["The engagement", "Independent contractor", "What you do", "Affiliate rewards \\(no fixed pay\\)", "Stock options", "Term and ending this agreement", "Conduct and use of the brand", "Confidentiality", "Data protection", "Intellectual property", "No authority to bind the Company", "Law and general", "Appendix: the services"])
  assert.match(ag, new RegExp(`## (\\d+\\. )?${h}`), h);
assert.match(ag, /NotesApp affiliate and referral programme/);
assert.match(ag, /There is no salary, fee, retainer or minimum/);
assert.match(ag, /Nigeria Data Protection Act 2023/);
assert.match(ag, /0\.02% of the parent's fully diluted capital \(2,000 shares\)/);
assert.match(ag, /Weeks 2 to 6: introduce NotesApp/);
assert.doesNotMatch(ag, /\d+%\s+of each|for \d+ months/, "no referral rates written in: they're the programme's to set");
assert.doesNotMatch(ag, /Nora|Bawa|150,000|₦/);
// Blanks stay as open points the reviewer can't miss.
const agBlank = ambassadorAgreement(cleanTerms({ arrangement: "affiliate_options" }));
for (const o of ["[name]", "[date]", "[start date]", "[%]", "[number]", "[campus]", "[the services, from the role's listing]"]) assert.ok(agBlank.includes(o), o);

// The Contractor (Consulting) Agreement for the options-only contract role.
const ct = cleanTerms({ name: "Bola Ade", title: "Product advisor", arrangement: "options_only", reportsTo: "the Chief Product Officer", hoursPerWeek: "10", optionShares: "5,000" });
const cDrafts = draftsFor(ct);
assert.deepEqual(cDrafts.map((d) => d.kind), ["agreement", "grant", "announcement"]);
assert.equal(cDrafts[0].title, "Contractor (Consulting) Agreement: Bola Ade");
const ca = contractorAgreement(ct);
assert.match(ca, /DRAFT FOR COUNSEL REVIEW/);
assert.match(ca, /Contractor \(Consulting\) Agreement/);
assert.match(ca, /independent contractor, not as an employee/);
assert.match(ca, /in the role of Product advisor/);
assert.match(ca, /You report to the Chief Product Officer/);
assert.match(ca, /about 10 hours a week/);
assert.match(ca, /stock options only/);
assert.match(ca, /\(5,000 shares\)/);
for (const h of ["Fee and expenses", "Stock options", "Confidentiality", "Data protection", "Intellectual property", "Non-solicitation", "No authority to bind the Company", "Law and general"]) assert.match(ca, new RegExp(`## \\d+\\. ${h}`), h);
assert.ok(ca.includes(COMPANY_INFO.legalName));
assert.match(contractorAgreement(cleanTerms({ arrangement: "options_only" })), /\[the services for the first 90 days\]/);
assert.match(optionGrant(ct), /Contractor \(Consulting\) Agreement/);
assert.match(optionGrant(ambT), /Campus Ambassador Agreement/);
// Section numbers run on without gaps.
for (const doc of [ag, ca]) { const ns = [...doc.matchAll(/^## (\d+)\./gm)].map((m) => Number(m[1])); assert.deepEqual(ns, ns.map((_, i) => i + 1)); }
// Employees never get a contract agreement.
assert.ok(!draftsFor({ ...ct, arrangement: "salary_options" }).some((d) => d.kind === "agreement"));

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
assert.deepEqual(draftsFor({ ...t, arrangement: "options_only" }).map((d) => d.kind), ["agreement", "grant", "announcement"]);
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

// The Executive Assistant (8 Nov 2026): reports to the Chief of Staff and Senior Executive Assistant, salary and options; its preset fills the
// offer's first 90 days and the announcement, and never presets pay, dates or equity, or anything personal from the source letter.
const ea = SEED_ROLES.find((r) => r.seedKey === "executive-assistant")!;
assert.deepEqual([ea.reportsTo, ea.arrangement], ["The Chief of Staff and Senior Executive Assistant", "salary_options"]);
assert.ok(ROLE_PRESETS["executive-assistant"]);
const eaTerms = cleanTerms({ ...presetTerms("executive-assistant"), arrangement: "salary_options", hoursPerWeek: "20" });
assert.equal(eaTerms.duties.length, 5);
const eaOffer = offerLetter(eaTerms);
assert.match(eaOffer, /You will join as Executive Assistant\. You report to the Chief of Staff and Senior Executive Assistant/);
assert.match(eaOffer, /Weeks 1 to 2: read the handbook/);
assert.match(eaOffer, /₦\[amount\]/, "pay stays an open point");
assert.match(eaOffer, /\[name\]/);
assert.doesNotMatch(eaOffer, /Nora|Bawa|150,000|₦50,000/);
assert.match(announcement(eaTerms), /Turns meeting decisions into team hub tasks/);
assert.deepEqual(presetTerms("no-such-role"), {});
// The Chief of Staff and Senior Executive Assistant: one role, reporting to the CEO, with its own preset.
const cos = SEED_ROLES.find((r) => r.seedKey === "chief-of-staff")!;
assert.deepEqual([cos.title, cos.reportsTo, cos.arrangement], ["Chief of Staff and Senior Executive Assistant", "The CEO", "salary_options"]);
const cosOffer = offerLetter(cleanTerms({ ...presetTerms("chief-of-staff"), arrangement: "salary_options", hoursPerWeek: "20" }));
assert.match(cosOffer, /You will join as Chief of Staff and Senior Executive Assistant\. You report to the Chief Executive Officer/);
assert.match(cosOffer, /₦\[amount\]/);
assert.doesNotMatch(cosOffer, /Nora|Bawa|150,000|₦50,000/);

console.log("ALL OK");
