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
];
