import type { ExamId } from "./exam-prep";

// Free study guides on each exam's page. General, careful facts only: dates, fees and rules change every year, so each guide
// sends students to the board's own site for those. Nothing here claims to be official.
export type Guide = { official: { label: string; url: string }; facts: string[]; tips: string[] };
export const GUIDES: Record<ExamId, Guide> = {
  jamb: {
    official: { label: "jamb.gov.ng", url: "https://www.jamb.gov.ng" },
    facts: [
      "The UTME is taken on a computer at an accredited centre.",
      "You usually sit four subjects: Use of English for everyone, plus three linked to the course you want.",
      "Questions are multiple choice. Check the current syllabus, dates and registration rules on JAMB's own site.",
    ],
    tips: [
      "Practise on a timer: the real exam moves fast, so get used to deciding quickly.",
      "Read the comprehension passages before the questions, then go back for detail.",
      "Don't leave a question blank: pick your best answer and flag it to come back to.",
    ],
  },
  waec: {
    official: { label: "waecnigeria.org", url: "https://www.waecnigeria.org" },
    facts: [
      "The WASSCE is taken at the end of SS3, at school (May/June) or as a private candidate.",
      "Most subjects have an objective paper and a written (essay or theory) paper.",
      "Check the current syllabus, timetable and rules on WAEC Nigeria's own site.",
    ],
    tips: [
      "Use the objective questions here to find weak topics, then practise writing full answers for those.",
      "In maths, show every step on the theory paper: marks are given for working.",
      "For English, read widely and practise summary writing within the word limit.",
    ],
  },
  neco: {
    official: { label: "neco.gov.ng", url: "https://neco.gov.ng" },
    facts: [
      "The NECO SSCE is taken at the end of SS3 (internal, mid-year) or as an external candidate.",
      "Most subjects have an objective paper and a written paper.",
      "Check the current syllabus, timetable and rules on NECO's own site.",
    ],
    tips: [
      "Practise a little every day: steady practice beats a last-week rush.",
      "Time yourself on mocks so the real papers feel familiar.",
      "Go over every question you got wrong and read the explanation before moving on.",
    ],
  },
};
