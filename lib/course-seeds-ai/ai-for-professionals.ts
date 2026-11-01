// Course 7 of lib/course-seeds-ai.ts: AI for Professionals (lawyers, accountants, HR and healthcare staff). Videos checked with YouTube
// oEmbed on 1 November 2026. Cases and guidance named here were checked the same day (sources in the lesson text).
import type { SeedCourse, SeedLesson } from "../course-seeds";

const LESSONS: SeedLesson[] = [
  {
    id: "pr-01-welcome", moduleId: "prbase", kind: "text", minutes: 9, title: "Welcome: AI in professional work",
    body: `Welcome. I'm Emmanuel Adams from LWB academy. This course is for professionals whose work carries responsibility for other people: **lawyers, accountants, HR practitioners and healthcare staff**, in Nigeria and across Africa. If you're in another profession (engineering, banking, consulting, pharmacy, public administration), most of what follows applies to you too.

You've probably seen colleagues use AI to draft a letter in seconds, and you've probably also heard the horror stories: fake court cases, leaked client data, biased hiring tools. Both are real. This course takes a **careful, practical** approach: what AI can safely do in your job, what it can't, and how to tell the difference.

## Why professionals must be more careful

- **Duty of care:** clients, patients and employees rely on your judgement.
- **Confidentiality:** you handle privileged, financial, medical and personal information.
- **Accountability:** if AI makes a mistake in your work, it's *your* mistake, professionally and sometimes legally.
- **Regulation:** your professional body's rules, and Nigeria's **Data Protection Act 2023**, still apply when you use AI.

## The professional's rule

**AI can assist your work. It cannot hold your responsibility.** Every output that reaches a client, court, patient, employee or regulator must be checked by a qualified person who is willing to sign their name to it.

## What this course covers

1. **Foundations:** how AI works, its main failure modes, and confidentiality.
2. **Profession by profession:** lawyers, accountants, HR and healthcare staff.
3. **Safe adoption:** what AI can and can't do, and a team AI policy.

This course is general guidance, not legal, accounting, HR or medical advice, and it doesn't replace your professional body's rules.

## Try this today

1. List **five tasks** in your work week that involve drafting, summarising, searching or organising information.
2. For each, mark the level of **risk** if it went wrong: low (internal note), medium (client letter), high (court filing, tax return, hiring decision, clinical decision).
3. Keep this list. By the end of the course, you'll decide where AI fits.`,
  },
  {
    id: "pr-02-terms", moduleId: "prbase", kind: "youtube", minutes: 16, title: "How AI works, and how it fails",
    youtubeId: "qYNweeDHiyU",
    videoCredit: { title: "AI, Machine Learning, Deep Learning and Generative AI Explained", name: "IBM Technology", url: "https://www.youtube.com/@IBMTechnology" },
    body: `Professionals need to understand the tools they rely on well enough to know where they break. In this video, IBM Technology explains the differences between **artificial intelligence**, **machine learning**, **deep learning** and **generative AI**: terms that are often mixed up in vendor pitches and news stories.

## The short version

- **Machine learning** systems learn patterns from data (for example, flagging unusual transactions).
- **Generative AI** produces new text, images or audio (for example, drafting a letter). The assistants most professionals use (ChatGPT, Claude, Gemini, Copilot) are generative AI built on large language models.

## Five ways generative AI fails professionals

1. **Fabrication ("hallucination"):** it can invent cases, statutes, standards, figures, drug doses and references, written perfectly and confidently.
2. **Out-of-date knowledge:** laws, tax rates, clinical guidelines and regulations change. A model's knowledge may not.
3. **Wrong jurisdiction:** much of its training is American or British. It may apply US law or UK practice to a Nigerian matter.
4. **Bias:** it can reflect unfair patterns in its training data, about gender, ethnicity, age, disability or region.
5. **Automation bias in us:** people tend to over-trust confident computer output, especially when tired or busy. The World Health Organization's 2024 guidance on large multi-modal models in health names this risk specifically.

## Good habits that follow

- Treat AI output as a **draft from a clever but unreliable junior**.
- Ask for **sources**, then check them in primary materials.
- State the **jurisdiction and date** in your prompt: *"Under Nigerian law as at 2026…"*, and still verify.
- Keep a record of how AI was used on important work.

**Privacy check:** understanding how these tools work includes knowing what happens to what you type. Some consumer AI services may use conversations to improve their models unless you change the settings. We'll cover this in the next lesson.

## Try this today

1. Watch the video above.
2. Ask an AI assistant a question in your field you already know the answer to, ideally one specific to Nigeria.
3. Note any fabrication, wrong jurisdiction or out-of-date point. Write it down as a reminder of why verification matters.`,
  },
  {
    id: "pr-03-confidentiality", moduleId: "prbase", kind: "text", minutes: 11, title: "Confidentiality and choosing the right tools",
    body: `The fastest way for a professional to get into serious trouble with AI is to paste confidential information into the wrong tool. This lesson is about preventing that.

## Consumer tools versus business tools

Most AI providers offer:

- **Free and personal plans:** convenient, but depending on the provider and settings, your conversations may be stored and may be used to improve the service.
- **Business and enterprise plans:** usually offer contractual commitments, such as not training on your data, admin controls, retention settings and data processing agreements.

Read the actual terms and settings for any tool you use. Don't rely on marketing pages or a colleague's memory.

## What never goes into a public AI tool

- Client names with matter details, privileged communications or unfiled pleadings.
- Clients' financial statements, tax records, bank details or payroll.
- Patients' names, hospital numbers, records, images or anything that could identify them.
- Employees' and candidates' personal files, disciplinary records or health information.
- Passwords, access codes and system details.

## Anonymise properly

Removing a name is often not enough. A combination of job title, town, date and unusual facts can identify someone. Replace or generalise: "a mid-sized manufacturing company in the South-West" rather than the company's name and products.

## The law still applies

Under Nigeria's **Data Protection Act 2023**, health data and other categories are **sensitive personal data** needing extra protection. Organisations need a lawful basis for processing personal data, must keep it secure, and have rules to follow when personal data is transferred outside Nigeria. Using an overseas AI service can involve such a transfer. Larger organisations may have additional duties to the **Nigeria Data Protection Commission (ndpc.gov.ng)**. Your organisation's data protection officer or adviser should approve AI tools used with personal data.

## Your professional body

Your professional rules on confidentiality, competence and supervision apply to AI use. For lawyers, the Nigerian Bar Association published **guidelines on the use of AI in the legal profession** in September 2024. Check whether your own professional body has issued guidance, and follow it.

## Try this today

1. Find out which AI tools, if any, your organisation has **approved**, and on what terms.
2. Open the privacy or data settings of any AI tool you personally use for work. Write down whether your chats can be used for training and how long they're kept.
3. Rewrite one real (confidential) task as a properly **anonymised** prompt.`,
  },
  {
    id: "pr-04-lawyers", moduleId: "prjobs", kind: "youtube", minutes: 20, title: "Lawyers: verify every citation",
    youtubeId: "sEOapG7-kro",
    videoCredit: { title: "ChatGPT Lawyers Who Cited Fake Cases Sanctioned by Court", name: "Steve Lehto", url: "https://www.youtube.com/@stevelehto" },
    body: `## The case every lawyer should know

In **Mata v. Avianca, Inc.**, in the United States District Court for the Southern District of New York, lawyers submitted a brief citing court decisions that **did not exist**. They had been generated by ChatGPT. When the opposing side and the court couldn't find the cases, the lawyers at first stood by them. On **22 June 2023**, Judge P. Kevin Castel sanctioned attorneys Steven Schwartz and Peter LoDuca and their firm, Levidow, Levidow & Oberman, imposing a **$5,000 penalty** and requiring them to write to the judges whose names had been attached to the fake opinions.

In this video, Steve Lehto, an American lawyer who comments on legal news, discusses the sanctions in that case. It's a vivid reminder: the problem was not only using AI, but **failing to check** and then failing to come clean.

## Where AI can help a lawyer

- **First drafts** of routine correspondence, client updates and internal memos.
- **Summarising** long documents you've lawfully provided (with confidentiality controls), such as a long contract or a transcript.
- **Brainstorming** arguments, counter-arguments and questions for a witness.
- **Plain-language explanations** for clients, checked by you.
- **Checklists** for due diligence or contract review.

## Where you must be strict

1. **Every authority must be verified** in a primary or trusted source: the law reports, official judgments, or reputable legal databases. Read the case, check the citation, check it hasn't been overruled, and check that it says what you're citing it for.
2. **Jurisdiction:** AI often applies American or English law. Nigerian statutes, rules of court and decisions of Nigerian courts must be checked directly.
3. **Privilege and confidentiality:** don't put privileged material into tools your firm hasn't approved.
4. **Supervision:** if juniors or pupils use AI, supervise and check their work.
5. **Candour:** if you discover an error in a filed document, correct it promptly.

The Nigerian Bar Association's **guidelines on the use of AI in the legal profession**, published in September 2024, emphasise ethics, human oversight, data privacy and transparency. Read them in full.

## A verification routine

For any AI-assisted legal research: list each authority → find it in a primary source → read the relevant part → confirm the proposition → confirm it's still good law → record that you checked it.

**Privacy check:** client identity, facts and strategy are confidential and often privileged. Anonymise or use approved tools only.

## Try this today

1. Watch the video above.
2. Ask an AI assistant for three Nigerian authorities on a point of law you know well.
3. Verify each one in a primary source. Record how many were accurate, inaccurate or non-existent.
4. Write a one-paragraph **verification rule** for your chambers or legal department.`,
  },
  {
    id: "pr-05-accountants", moduleId: "prjobs", kind: "text", minutes: 11, title: "Accountants: speed with accuracy and confidentiality",
    body: `Accountants and finance staff spend a lot of time on drafting, summarising and spreadsheet work, where AI can genuinely help. But numbers that look right and aren't can be costly, and financial data is highly confidential.

## Where AI can help

- **Spreadsheet formulas and checks:** *"Write an Excel formula to flag any invoice in column D over ₦1,000,000 where column F (approval) is blank."*
- **Explaining variances** from figures you've already verified: *"Revenue fell 12% while costs rose 5%. Draft a short management commentary explaining possible reasons, based on these notes."*
- **Drafting** client letters, engagement letters, internal policies and training notes.
- **Summarising** long standards, circulars or reports you've provided, as a starting point for your own reading.
- **Checklists** for month-end close, audit preparation or document requests.

## Where you must be careful

1. **Calculations:** AI assistants can make arithmetic errors and invent figures. Do calculations in your spreadsheet or accounting software, not in a chat. Use AI to help build the formula, then test it.
2. **Tax and regulation:** tax laws, rates, filing rules and reporting standards change. AI may be out of date or apply another country's rules. Always check current Nigerian law and official guidance, and use your professional judgement.
3. **Confidentiality:** clients' accounts, payroll, bank statements and tax records must not go into unapproved tools. Use anonymised or summarised figures, or approved business tools.
4. **Professional standards:** your professional body's ethics code (integrity, objectivity, competence, confidentiality) applies to AI-assisted work.
5. **Bias in automated decisions:** if AI or machine learning is used for credit scoring, fraud flags or supplier risk, check for unfair patterns, such as against particular regions or groups, and keep a human review of decisions that significantly affect people.

## Document your work

For audit and review purposes, record when AI was used, for what, and how the output was verified. Reviewers and regulators may ask.

**Privacy check:** payroll data includes employees' personal details, and sometimes health information (sick leave). Treat it as personal data under the NDPA 2023, and keep it out of public AI tools.

## Try this today

1. Ask an AI assistant to write one **spreadsheet formula** you need this week. Test it on sample data with known answers.
2. Draft one **client letter** with AI help using anonymised details, then check every figure against your records.
3. Write down your firm's (or your own) rule for **which financial data may never** be put into AI tools.`,
  },
  {
    id: "pr-06-hr", moduleId: "prjobs", kind: "text", minutes: 11, title: "HR: fairness, bias and people's data",
    body: `HR work touches people's livelihoods: who gets hired, promoted, disciplined or let go. AI can save HR teams a lot of time on writing and organising. It can also quietly introduce **bias** and **privacy** problems that harm people and expose the organisation.

## A lesson from Amazon

In October 2018, Reuters reported that Amazon had abandoned an experimental AI recruiting tool after finding that it **penalised CVs that included the word "women's"**, such as "women's chess club captain". The system had learnt from past hiring data dominated by men. Amazon said the tool was never used by its recruiters to evaluate candidates. The lesson: **AI trained on past decisions can repeat past unfairness**, without anyone intending it.

## Where AI can help HR

- **Drafting** job descriptions, offer letters, policies, handbooks and announcements.
- **Checking language** in job adverts for wording that might discourage some groups.
- **Interview guides:** structured questions linked to the skills the job needs.
- **Training materials** and onboarding checklists.
- **Summarising** anonymised staff survey comments into themes.

## Where you must be careful

1. **Don't let AI screen or rank candidates on its own.** If any automated screening is used, test it for bias (by gender, age, ethnicity, disability, state of origin, university) and keep a human decision-maker.
2. **Automated decisions:** under Nigeria's **Data Protection Act 2023**, people generally have rights in relation to decisions based solely on automated processing that significantly affect them. Hiring, promotion and dismissal clearly do.
3. **Candidate and employee data:** CVs, ID numbers, salaries, health and disciplinary records are personal data, and health data is sensitive. Keep them out of public AI tools.
4. **Employee monitoring:** AI tools that monitor productivity, emails or behaviour raise serious privacy and trust questions. Take advice before introducing them, and be transparent with staff.
5. **Disciplinary and grievance matters** need human judgement, fairness and due process. AI may help organise notes, but never decide outcomes.

## Write fair job adverts

> *"Rewrite this job advert so it focuses on the skills and outcomes required, removes unnecessary requirements (like age limits or 'must be a graduate of top universities' where not needed), and uses inclusive language."*

Then review it with a colleague and check it meets employment law.

**Privacy check:** before pasting any staff survey results, remove names and anything that could identify individuals, especially in small teams where a department and role can identify a person.

## Try this today

1. Ask an AI assistant to review **one job advert** for unnecessary requirements and exclusive language. Edit it yourself.
2. List every place in your HR process where software or AI **ranks, scores or filters** people. Note who reviews those results.
3. Write one sentence for your HR policy: *"AI may be used for… It may not be used for…"*`,
  },
  {
    id: "pr-07-health", moduleId: "prjobs", kind: "youtube", minutes: 14, title: "Healthcare staff: AI is not a diagnosis",
    youtubeId: "0g3cG5GT_74",
    videoCredit: { title: "AI for Healthcare", name: "IBM Research", url: "https://www.youtube.com/@ibmresearch" },
    body: `AI has real promise in healthcare, from research to administration. In this short video, IBM Research describes how it approaches cancer research as an information science problem, using machine learning and related techniques to help researchers make sense of vast amounts of medical data. That's the research end. On the ward and in the clinic, the rules are stricter.

## The two non-negotiables

1. **Never put patient data into public AI tools.** Names, hospital numbers, dates of birth, test results, images, clinical notes, or any combination that could identify a patient. Health data is **sensitive personal data** under Nigeria's **Data Protection Act 2023**, and confidentiality is a core professional duty.
2. **AI is not a diagnosis.** General AI assistants are not medical devices, haven't examined the patient and can be confidently wrong. Clinical decisions remain with qualified professionals, using approved tools and guidelines.

## What WHO says

In January 2024, the **World Health Organization** published guidance on the ethics and governance of **large multi-modal models** (generative AI) in health, with over 40 recommendations for governments, developers and health providers. It identifies uses such as clinical care, patient-guided use, clerical and administrative tasks, medical and nursing education, and research, and warns of risks including false or biased outputs and **automation bias**, where professionals and patients overlook errors because they trust the machine.

## Lower-risk uses (with care)

- **Administrative drafts:** rotas, memos, meeting minutes, generic letters, with no patient details.
- **Education:** revising a topic, generating practice questions, which you check against current guidelines and textbooks.
- **Patient information leaflets:** plain-language drafts on general topics, checked by a clinician for accuracy, and translated and checked by fluent speakers.
- **Literature support:** summarising papers you provide, then reading the papers yourself.

## Higher-risk uses (need approved tools and governance)

- Anything involving identifiable patient data.
- Clinical decision support, triage or image interpretation.
- Drug doses, interactions and prescribing.

These require tools approved by your institution, appropriate validation, and clear accountability.

## Patients use AI too

Patients increasingly arrive with AI-generated "diagnoses". Respond with respect: acknowledge their research, explain what AI can and can't know, and examine them properly.

**Privacy check:** de-identifying health data properly is hard. A rare condition, a ward, a date and an age can identify someone. If in doubt, leave it out.

## Try this today

1. Watch the video above.
2. Find out whether your hospital or clinic has an **approved AI tool** or a policy. If not, raise it with your management or data protection lead.
3. Use an AI assistant to draft a **general patient leaflet** (for example, on hand hygiene or malaria prevention) with no patient details. Check every statement against current guidelines before using it.`,
  },
  {
    id: "pr-08-can-cant", moduleId: "prsafe", kind: "text", minutes: 9, title: "What AI can and can't safely do in your job",
    body: `Let's bring the four professions together in one picture. Use this as a reference, and adapt it to your own organisation's rules.

| Profession | AI can help with (checked by you) | AI must not do on its own |
|---|---|---|
| **Lawyers** | Drafting routine letters; summarising documents you've provided under approved tools; brainstorming arguments; client explainers | Provide authorities you haven't verified; give final legal advice; handle privileged material in unapproved tools |
| **Accountants** | Spreadsheet formulas; commentary on verified figures; letters and policies; checklists | Do the calculations you rely on; decide tax positions; receive clients' financial records in unapproved tools |
| **HR** | Job adverts; policies; interview guides; anonymised survey themes | Screen, rank or reject people without human review; decide discipline or dismissal; process staff files in unapproved tools |
| **Healthcare staff** | Admin drafts; revision; general patient leaflets (checked); summaries of papers you provide | Diagnose; decide treatment or doses; receive identifiable patient data in public tools |

## Three questions before any AI use

1. **Is the data allowed?** No confidential or personal data in unapproved tools.
2. **Can I check the output?** If you can't verify it, don't use it.
3. **Who signs it?** A qualified person must take responsibility.

## Keep your skills sharp

Over-reliance on AI can erode professional skills, such as legal research, mental arithmetic, clinical reasoning and careful reading. Make sure juniors still learn the fundamentals, and that you still practise them yourself.

**Privacy check:** add your organisation's approved tools and settings to the table, so everyone knows what "approved" means in practice.

## Try this today

1. Copy the table and add a row for your own role, with **three** things AI can help with and **three** it must not do.
2. Go back to the task list from the first lesson. For each task, apply the **three questions** and decide: use AI, use it with care, or don't use it.`,
  },
  {
    id: "pr-09-policy", moduleId: "prsafe", kind: "text", minutes: 9, title: "A team AI policy and a safe pilot",
    body: `Individual good habits matter, but professional organisations need shared rules. A short, clear AI policy and a careful pilot will help your firm, practice or department get the benefits without the disasters.

## What a professional AI policy should cover

1. **Approved tools:** which tools, which plans, which settings (for example, training on your data switched off).
2. **Permitted uses:** drafting, summarising, research support, education, administration.
3. **Prohibited uses:** confidential, privileged or personal data in unapproved tools; final decisions on legal, financial, employment or clinical matters; unverified citations or figures.
4. **Verification:** who checks what, and how it's recorded.
5. **Disclosure:** when clients, courts, patients or employees must be told AI was used, following your professional body's guidance and any court or regulator rules.
6. **Data protection:** alignment with the **NDPA 2023**, including sensitive data, cross-border transfers and breach reporting.
7. **Training:** everyone completes basic AI and data training before using the tools.
8. **Incidents:** what to do if confidential data is pasted into the wrong tool, or an AI error reaches a client.
9. **Review date:** at least every six months.

## Run a safe pilot

1. Choose **two or three low-risk tasks** (for example, internal memos, meeting minutes, first drafts of standard letters).
2. Choose a **small group** of willing staff and an approved tool.
3. Run it for **four to six weeks**, recording time saved and errors found.
4. Review honestly, then expand, adjust or stop.

## Teaching and sharing expertise

Professionals have knowledge others need. On #NotesApp you can offer paid consultations through **Booking**, publish continuing-education courses on **Notes Academy** (with quizzes and certificates anyone can check), and run a **Community** for your professional association or alumni, with **Spaces** for practice areas and **events** for seminars. **Nana AI** can help you polish your writing.

## A word from me

The professionals who thrive with AI will be the ones who combine its speed with their own judgement, integrity and care. Your clients, patients and colleagues trust *you*. Keep it that way.

**Emmanuel Adams**, LWB academy

## Try this today

1. Draft a **one-page AI policy** for your team using the nine headings above, with AI help and your own judgement.
2. Choose **one low-risk task** for a pilot and propose it to your manager or partners.
3. Take the quiz that follows and claim your certificate.`,
  },
  {
    id: "pr-10-quiz", moduleId: "prsafe", kind: "quiz", minutes: 8, title: "Check what you've learnt",
    quiz: {
      passPercent: 75,
      questions: [
        { id: "prq1", prompt: "An AI assistant gives you three Nigerian cases supporting your argument. What must you do before citing them?", options: ["Cite them: AI is trained on law reports", "Find each case in a primary or trusted source, read it, and confirm it says what you claim and is still good law", "Ask the AI if they're real", "Cite only the first one"], answer: 1, explain: "In Mata v. Avianca, lawyers were sanctioned for citing non-existent cases generated by ChatGPT. Verify every authority yourself." },
        { id: "prq2", prompt: "What happened in Mata v. Avianca in June 2023?", options: ["A court approved AI-written judgments", "Lawyers were sanctioned after citing fake cases generated by ChatGPT", "An airline was fined for using AI", "Nothing notable"], answer: 1, explain: "Judge P. Kevin Castel sanctioned the lawyers and their firm, imposing a $5,000 penalty." },
        { id: "prq3", prompt: "A nurse wants AI help writing a discharge summary. Which approach is acceptable?", options: ["Paste the patient's notes into a free public chatbot", "Use only an institution-approved tool under its policy, or draft generic text without any patient details", "Ask the patient to paste them in", "Remove the name but keep the hospital number and dates"], answer: 1, explain: "Never put identifiable patient data into public AI tools. Health data is sensitive under the NDPA 2023." },
        { id: "prq4", prompt: "What did Reuters report in 2018 about Amazon's experimental AI recruiting tool?", options: ["It worked perfectly", "It penalised CVs containing the word \"women's\" and was abandoned", "It hired only engineers", "It was used to set salaries"], answer: 1, explain: "The tool learnt from male-dominated hiring data and repeated that bias. AI trained on past decisions can repeat past unfairness." },
        { id: "prq5", prompt: "An accountant needs a VAT calculation for a client. What's the safest approach?", options: ["Ask a chatbot to calculate it and use the answer", "Calculate it in a spreadsheet or accounting software using current law, and use AI only to help build or check formulas", "Guess", "Use last year's figure"], answer: 1, explain: "AI can make arithmetic errors and be out of date on tax rules. Do the calculation in proper tools and check current law." },
        { id: "prq6", prompt: "What is \"automation bias\"?", options: ["Machines being biased against automation", "People over-trusting confident computer output and missing its errors", "A type of tax", "A legal doctrine"], answer: 1, explain: "WHO's 2024 guidance on large multi-modal models in health warns about automation bias by professionals and patients." },
        { id: "prq7", prompt: "Under the NDPA 2023, which of these is sensitive personal data?", options: ["An employee's health information", "A company's office address", "A published annual report", "A job title on a public website"], answer: 0, explain: "Health data is a sensitive category needing extra protection." },
        { id: "prq8", prompt: "Who should make the final decision to reject a job candidate?", options: ["An AI screening tool on its own", "A human decision-maker, with any automated screening tested for bias", "The candidate", "Whoever replies first"], answer: 1, explain: "Keep humans in charge of decisions that significantly affect people, and test any screening for bias." },
        { id: "prq9", prompt: "Which three questions should you ask before using AI on a task?", options: ["Is it fast? Is it free? Is it new?", "Is the data allowed? Can I check the output? Who signs it?", "Who made it? What colour is it? Does it have an app?", "None: just use it"], answer: 1, explain: "Data, verification and accountability decide whether AI belongs in a professional task." },
        { id: "prq10", prompt: "When did the Nigerian Bar Association publish its guidelines on AI in the legal profession?", options: ["September 2024", "January 1999", "They haven't", "June 2010"], answer: 0, explain: "The NBA launched technology guidelines, including AI guidelines, in September 2024, emphasising ethics, human oversight, privacy and transparency." },
      ],
    },
  },
];

export const AI_PROFESSIONALS: SeedCourse = {
  key: "ai-professionals",
  ownerUsername: "lwb", byline: "Emmanuel Adams",
  slug: "ai-for-professionals",
  title: "AI for Professionals",
  cover: "/images/academy/covers/ai-for-professionals.webp",
  summary: `Use AI with care, and keep your professional responsibility.

A careful, practical course for lawyers, accountants, HR practitioners and healthcare staff in Nigeria and across Africa. You'll learn how generative AI works and how it fails, how to keep confidential and personal data safe, and what AI can and can't safely do in each profession: verifying every legal citation (and what happened in Mata v. Avianca), keeping calculations and tax positions in proper tools, guarding against bias in hiring, and never treating AI as a diagnosis or putting patient data in public tools. You'll finish with a team AI policy and a safe pilot plan.

Aligned with Nigeria's Data Protection Act 2023. Written by Emmanuel Adams for LWB academy.`,
  topics: ["ai", "law", "health"],
  subtopics: [{ parent: "ai", label: "Responsible AI" }, { parent: "law", label: "Legal Tech" }, { parent: "health", label: "Health Data Privacy" }],
  level: "intermediate", language: "English", format: "self",
  outcomes: [
    "Explain how generative AI works and its main failure modes",
    "Choose approved tools and keep confidential data out of public ones",
    "Anonymise information properly before using AI",
    "Verify every legal authority AI suggests",
    "Use AI for formulas and commentary, not for figures you rely on",
    "Spot and reduce bias in AI-assisted HR processes",
    "Keep patient data safe and never treat AI as a diagnosis",
    "Apply the NDPA 2023 to sensitive data and automated decisions",
    "Decide where AI fits in your own work, task by task",
    "Write a team AI policy and run a safe pilot",
  ],
  requirements: [
    "Working in, or training for, a professional role",
    "Basic experience with an AI assistant is helpful",
    "Your organisation's data protection or IT policy, if it has one",
  ],
  modules: [
    { id: "prbase", title: "Foundations" },
    { id: "prjobs", title: "Profession by profession" },
    { id: "prsafe", title: "Safe adoption" },
  ],
  lessons: LESSONS,
};
