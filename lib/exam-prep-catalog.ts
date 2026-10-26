import type { ExamId, Subject } from "./exam-prep";

// The subjects and topics Naija Exam Prep starts with, following each exam's published syllabus areas. They're written to
// prepSubjects the first time the catalogue is read (lib/exam-prep-server.ts) and edited from then on in Admin → Naija Exam
// Prep. A subject shows to students only once it has published questions.
const t = (pairs: [string, string][]) => pairs.map(([id, name]) => ({ id, name }));
const ENGLISH_JAMB = t([["comprehension", "Comprehension and summary"], ["lexis-and-structure", "Lexis and structure"], ["oral-forms", "Oral forms"]]);
const ENGLISH_SSCE = t([["comprehension", "Comprehension"], ["lexis-and-structure", "Lexis and structure"], ["oral-english", "Oral English"]]);
const MATHS_JAMB = t([["number-and-numeration", "Number and numeration"], ["algebra", "Algebra"], ["geometry-and-trigonometry", "Geometry and trigonometry"], ["calculus", "Calculus"], ["statistics", "Statistics"]]);
const MATHS_SSCE = t([["number-and-numeration", "Number and numeration"], ["algebraic-processes", "Algebraic processes"], ["mensuration", "Mensuration"], ["geometry-and-trigonometry", "Geometry and trigonometry"], ["statistics-and-probability", "Statistics and probability"]]);
// The sciences, Economics and Government: the same broad areas in the UTME and SSCE syllabuses.
const PHYSICS = t([["measurement-and-mechanics", "Measurement and mechanics"], ["heat", "Heat and thermal physics"], ["waves-and-optics", "Waves, sound and light"], ["electricity-and-magnetism", "Electricity and magnetism"], ["modern-physics", "Atomic and nuclear physics"]]);
const CHEMISTRY = t([["atomic-structure-and-bonding", "Atomic structure, bonding and the periodic table"], ["stoichiometry", "The mole and chemical equations"], ["acids-bases-and-salts", "Acids, bases and salts"], ["redox-and-electrolysis", "Redox and electrolysis"], ["organic-chemistry", "Organic chemistry"]]);
const BIOLOGY = t([["cell-biology", "The cell and living things"], ["physiology", "Nutrition, transport and body systems"], ["ecology", "Ecology"], ["genetics-and-evolution", "Genetics and evolution"], ["variety-of-organisms", "Variety of organisms"]]);
const ECONOMICS = t([["basic-concepts", "Basic concepts"], ["demand-and-supply", "Demand, supply and prices"], ["production-and-costs", "Production, costs and markets"], ["money-and-banking", "Money, banking and finance"], ["national-income-and-trade", "National income, public finance and trade"]]);
const GOVERNMENT = t([["basic-concepts", "Basic concepts of government"], ["constitutions-and-organs", "Constitutions and organs of government"], ["parties-and-elections", "Political parties and elections"], ["nigerian-government", "Nigerian government and history"], ["international-relations", "International organisations and relations"]]);

// More SSCE subjects (owner, 26 Oct 2026: "50 on each subject taken in WAEC/NECO"), WAEC and NECO only, following the syllabus areas.
const LITERATURE = t([["literary-terms", "Literary terms and devices"], ["poetry", "Poetry"], ["drama", "Drama"], ["prose", "Prose"], ["african-literature", "African and Nigerian literature"]]);
const GEOGRAPHY = t([["map-reading", "Map reading and practical geography"], ["physical-geography", "Physical geography"], ["human-geography", "Human and economic geography"], ["geography-of-nigeria", "Geography of Nigeria"], ["africa-and-the-world", "Africa and the wider world"]]);
const AGRIC = t([["general-agriculture", "General agriculture"], ["crop-and-soil", "Crop production and soil science"], ["animal-production", "Animal production"], ["agricultural-economics", "Agricultural economics and extension"], ["farm-mechanisation", "Farm machinery and mechanisation"]]);
const CIVIC = t([["citizenship-and-values", "Citizenship and national values"], ["human-rights", "Human rights"], ["democracy-and-rule-of-law", "Democracy and the rule of law"], ["social-problems", "Social problems: drugs, cultism and trafficking"], ["public-service", "Public service and civil society"]]);
const COMMERCE = t([["trade", "Home and foreign trade"], ["aids-to-trade", "Aids to trade"], ["business-units", "Business units and the capital market"], ["documents-and-payment", "Trade documents and means of payment"], ["consumer-protection", "Consumer protection and e-commerce"]]);
const ACCOUNTING = t([["principles", "Accounting principles and concepts"], ["books-and-ledger", "Books of original entry and the ledger"], ["trial-balance-and-errors", "Trial balance, bank reconciliation and errors"], ["final-accounts", "Final accounts"], ["partnership-and-company", "Partnership, company and public sector accounts"]]);
const CRS = t([["leaders-of-israel", "Old Testament: leaders and kings"], ["prophets", "Old Testament: prophets and themes"], ["life-of-jesus", "The life and teaching of Jesus"], ["early-church", "The early church (Acts)"], ["epistles", "The Epistles"]]);
const IRS = t([["quran", "The Qur'an"], ["hadith", "Hadith"], ["tawhid-and-fiqh", "Tawhid and Fiqh"], ["sirah", "The life of the Prophet (Sirah)"], ["islam-in-west-africa", "Islam in West Africa"]]);
const FURTHER_MATHS = t([["algebra", "Algebra, sets and functions"], ["coordinate-geometry-and-vectors", "Coordinate geometry and vectors"], ["calculus", "Calculus"], ["statistics-and-probability", "Statistics and probability"], ["mechanics", "Mechanics"]]);
const COMPUTER = t([["fundamentals", "Computer fundamentals and history"], ["hardware", "Hardware"], ["software", "Software and operating systems"], ["data-and-programming", "Data, logic and programming"], ["networks-and-safety", "Networks, the internet and safety"]]);
const HISTORY = t([["pre-colonial-nigeria", "Pre-colonial Nigeria"], ["colonial-rule", "Colonial rule in Nigeria"], ["nationalism-and-independence", "Nationalism and independence"], ["nigeria-since-independence", "Nigeria since independence"], ["west-africa-and-the-world", "West Africa and the wider world"]]);
export const SSCE_EXTRA: [string, string, Subject["topics"]][] = [
  ["literature-in-english", "Literature in English", LITERATURE], ["geography", "Geography", GEOGRAPHY], ["agricultural-science", "Agricultural Science", AGRIC],
  ["civic-education", "Civic Education", CIVIC], ["commerce", "Commerce", COMMERCE], ["financial-accounting", "Financial Accounting", ACCOUNTING],
  ["christian-religious-studies", "Christian Religious Studies", CRS], ["islamic-studies", "Islamic Studies", IRS], ["further-mathematics", "Further Mathematics", FURTHER_MATHS],
  ["computer-studies", "Computer Studies", COMPUTER], ["history", "History", HISTORY],
];

const subject = (exam: ExamId, id: string, name: string, topics: Subject["topics"], order: number): Subject => ({ exam, id, name, topics, order, live: true, approvalsNeeded: 1 });
export const DEFAULT_SUBJECTS: Subject[] = [
  subject("jamb", "use-of-english", "Use of English", ENGLISH_JAMB, 1),
  subject("jamb", "mathematics", "Mathematics", MATHS_JAMB, 2),
  subject("waec", "english-language", "English Language", ENGLISH_SSCE, 1),
  subject("waec", "mathematics", "General Mathematics", MATHS_SSCE, 2),
  subject("neco", "english-language", "English Language", ENGLISH_SSCE, 1),
  subject("neco", "mathematics", "General Mathematics", MATHS_SSCE, 2),
  ...(["jamb", "waec", "neco"] as ExamId[]).flatMap((exam) => [
    subject(exam, "physics", "Physics", PHYSICS, 3),
    subject(exam, "chemistry", "Chemistry", CHEMISTRY, 4),
    subject(exam, "biology", "Biology", BIOLOGY, 5),
    subject(exam, "economics", "Economics", ECONOMICS, 6),
    subject(exam, "government", "Government", GOVERNMENT, 7),
  ]),
  ...(["waec", "neco"] as ExamId[]).flatMap((exam) => SSCE_EXTRA.map(([id, name, topics], i) => subject(exam, id, name, topics, 8 + i))),
];
