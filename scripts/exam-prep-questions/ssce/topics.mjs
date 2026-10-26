// WAEC and NECO subjects that get 50 questions each (owner, 26 Oct 2026), with their topic ids (matching lib/exam-prep-catalog.ts)
// and how many questions each file adds: 30 on top of the 20 already in the starter set, or 50 for a subject that's new.
export const SSCE = {
  "english-language": { code: "eng", add: 30, topics: ["comprehension", "lexis-and-structure", "oral-english"] },
  mathematics: { code: "maths", add: 30, topics: ["number-and-numeration", "algebraic-processes", "mensuration", "geometry-and-trigonometry", "statistics-and-probability"] },
  physics: { code: "phy", add: 30, topics: ["measurement-and-mechanics", "heat", "waves-and-optics", "electricity-and-magnetism", "modern-physics"] },
  chemistry: { code: "chem", add: 30, topics: ["atomic-structure-and-bonding", "stoichiometry", "acids-bases-and-salts", "redox-and-electrolysis", "organic-chemistry"] },
  biology: { code: "bio", add: 30, topics: ["cell-biology", "physiology", "ecology", "genetics-and-evolution", "variety-of-organisms"] },
  economics: { code: "econ", add: 30, topics: ["basic-concepts", "demand-and-supply", "production-and-costs", "money-and-banking", "national-income-and-trade"] },
  government: { code: "gov", add: 30, topics: ["basic-concepts", "constitutions-and-organs", "parties-and-elections", "nigerian-government", "international-relations"] },
  "literature-in-english": { code: "lit", add: 50, topics: ["literary-terms", "poetry", "drama", "prose", "african-literature"] },
  geography: { code: "geo", add: 50, topics: ["map-reading", "physical-geography", "human-geography", "geography-of-nigeria", "africa-and-the-world"] },
  "agricultural-science": { code: "agric", add: 50, topics: ["general-agriculture", "crop-and-soil", "animal-production", "agricultural-economics", "farm-mechanisation"] },
  "civic-education": { code: "civic", add: 50, topics: ["citizenship-and-values", "human-rights", "democracy-and-rule-of-law", "social-problems", "public-service"] },
  commerce: { code: "comm", add: 50, topics: ["trade", "aids-to-trade", "business-units", "documents-and-payment", "consumer-protection"] },
  "financial-accounting": { code: "acct", add: 50, topics: ["principles", "books-and-ledger", "trial-balance-and-errors", "final-accounts", "partnership-and-company"] },
  "christian-religious-studies": { code: "crs", add: 50, topics: ["leaders-of-israel", "prophets", "life-of-jesus", "early-church", "epistles"] },
  "islamic-studies": { code: "irs", add: 50, topics: ["quran", "hadith", "tawhid-and-fiqh", "sirah", "islam-in-west-africa"] },
  "further-mathematics": { code: "fmaths", add: 50, topics: ["algebra", "coordinate-geometry-and-vectors", "calculus", "statistics-and-probability", "mechanics"] },
  "computer-studies": { code: "comp", add: 50, topics: ["fundamentals", "hardware", "software", "data-and-programming", "networks-and-safety"] },
  history: { code: "hist", add: 50, topics: ["pre-colonial-nigeria", "colonial-rule", "nationalism-and-independence", "nigeria-since-independence", "west-africa-and-the-world"] },
};
// Subjects whose answers are mostly worked out: every question with a number in all its options needs a `check`.
export const NUMERIC = new Set(["mathematics", "physics", "chemistry", "financial-accounting", "further-mathematics"]);
