// The second batch (owner, 28 Oct 2026): 50 more questions for every subject in every exam body, so JAMB subjects go from 20 to 70 and
// WAEC and NECO subjects from 50 to 100. One file a subject, keyed by exam; each exam's topic ids match lib/exam-prep-catalog.ts.
import { SSCE, NUMERIC } from "../ssce/topics.mjs";

const JAMB = {
  "use-of-english": ["comprehension", "lexis-and-structure", "oral-forms"],
  mathematics: ["number-and-numeration", "algebra", "geometry-and-trigonometry", "calculus", "statistics"],
  physics: SSCE.physics.topics, chemistry: SSCE.chemistry.topics, biology: SSCE.biology.topics, economics: SSCE.economics.topics, government: SSCE.government.topics,
};
export const ADD = 50;
// subject → { exam → topic ids }
export const BATCH2 = {
  "use-of-english": { jamb: JAMB["use-of-english"] },
  ...Object.fromEntries(Object.entries(SSCE).map(([id, s]) => [id, { ...(JAMB[id] ? { jamb: JAMB[id] } : {}), waec: s.topics, neco: s.topics }])),
};
export { NUMERIC };
