import type { ExamId, Subject } from "./exam-prep";

// The subjects and topics Naija Exam Prep starts with, following each exam's published syllabus areas. They're written to
// prepSubjects the first time the catalogue is read (lib/exam-prep-server.ts) and edited from then on in Admin → Naija Exam
// Prep. A subject shows to students only once it has published questions.
const t = (pairs: [string, string][]) => pairs.map(([id, name]) => ({ id, name }));
const ENGLISH_JAMB = t([["comprehension", "Comprehension and summary"], ["lexis-and-structure", "Lexis and structure"], ["oral-forms", "Oral forms"]]);
const ENGLISH_SSCE = t([["comprehension", "Comprehension"], ["lexis-and-structure", "Lexis and structure"], ["oral-english", "Oral English"]]);
const MATHS_JAMB = t([["number-and-numeration", "Number and numeration"], ["algebra", "Algebra"], ["geometry-and-trigonometry", "Geometry and trigonometry"], ["calculus", "Calculus"], ["statistics", "Statistics"]]);
const MATHS_SSCE = t([["number-and-numeration", "Number and numeration"], ["algebraic-processes", "Algebraic processes"], ["mensuration", "Mensuration"], ["geometry-and-trigonometry", "Geometry and trigonometry"], ["statistics-and-probability", "Statistics and probability"]]);

const subject = (exam: ExamId, id: string, name: string, topics: Subject["topics"], order: number): Subject => ({ exam, id, name, topics, order, live: true, approvalsNeeded: 1 });
export const DEFAULT_SUBJECTS: Subject[] = [
  subject("jamb", "use-of-english", "Use of English", ENGLISH_JAMB, 1),
  subject("jamb", "mathematics", "Mathematics", MATHS_JAMB, 2),
  subject("waec", "english-language", "English Language", ENGLISH_SSCE, 1),
  subject("waec", "mathematics", "General Mathematics", MATHS_SSCE, 2),
  subject("neco", "english-language", "English Language", ENGLISH_SSCE, 1),
  subject("neco", "mathematics", "General Mathematics", MATHS_SSCE, 2),
];
