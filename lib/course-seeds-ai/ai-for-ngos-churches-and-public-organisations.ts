// Course 5 of lib/course-seeds-ai.ts: AI for NGOs, Churches and Public Organisations. Videos checked with YouTube oEmbed on
// 1 November 2026. The "Tech in Yoruba " credit keeps the trailing space oEmbed returned (cleanVideoCredit trims it when seeded).
import type { SeedCourse, SeedLesson } from "../course-seeds";

const LESSONS: SeedLesson[] = [
  {
    id: "ng-01-welcome", moduleId: "ngwrite", kind: "text", minutes: 8, title: "Welcome: AI for organisations that serve people",
    body: `Welcome. I'm Emmanuel Adams from LWB academy. This course is for people who serve others: NGO staff and volunteers, church and mosque administrators, community development associations, cooperatives, school boards, local government staff and public servants.

Organisations like yours often do a lot with very little: small teams, tight budgets, endless reports, and people who depend on you. AI assistants can take some of the weight off, **if** they're used responsibly. Because you work with people, and often with vulnerable people, the stakes for privacy and fairness are higher than for most businesses.

## What this course covers

1. **Write and fund:** reports, newsletters and grant proposals.
2. **Reach people in their language:** translating messages into Yoruba, Igbo, Hausa and Pidgin.
3. **Data with care:** surveys and data analysis, and responsible use of people's data under Nigeria's Data Protection Act 2023.

## Three promises for responsible AI use

Before we start, I'd like you to make three promises on behalf of your organisation:

1. **Truth:** we will never use AI to invent results, stories, quotes or numbers.
2. **Privacy:** we will never put beneficiaries', members' or donors' personal details into public AI tools.
3. **People first:** AI will support our staff and volunteers, not replace the human care that people come to us for.

## Sensitive data is everywhere in our work

Nigeria's **Data Protection Act 2023** treats some data as **sensitive**, including **religious beliefs**, **health**, ethnic origin, political opinions and more. Churches, mosques, health NGOs and community groups handle exactly this kind of data every day: membership lists, prayer requests, counselling notes, HIV programme records, beneficiary lists. That's why every lesson in this course has a **Privacy check**.

## Try this today

1. List the **three writing or data tasks** that take most of your team's time.
2. List the **types of personal data** your organisation holds (members, beneficiaries, donors, staff, volunteers).
3. Circle any that are **sensitive** (religion, health, ethnicity, politics). Keep this list for the final lessons.`,
  },
  {
    id: "ng-02-nonprofits", moduleId: "ngwrite", kind: "youtube", minutes: 15, title: "How AI assistants can help a non-profit",
    youtubeId: "NehBwOhTOmw",
    videoCredit: { title: "Enabling nonprofits to achieve more with Gemini", name: "Google.org", url: "https://www.youtube.com/@googleorg" },
    body: `In this video, Google.org explains how Gemini, Google's AI assistant, can help non-profits with creativity and productivity: drafting, brainstorming and organising work. The same kinds of tasks can be done with other assistants like ChatGPT, Claude or Copilot.

Some AI companies and tech firms offer discounts or programmes for registered non-profits. Check each provider's current offers and eligibility for Nigerian organisations, as they change.

## Good first tasks for an organisation

- **Meeting notes:** turn rough notes into clear minutes with action points.
- **Announcements:** draft notices for members, parents or the community.
- **Volunteer guides:** *"Write a one-page guide for new volunteers at our food bank, covering safety, punctuality and respect for beneficiaries."*
- **Event planning:** checklists, timelines and budgets for outreaches and conferences.
- **Social media:** a month of post ideas about your work.

## Set up a "house style" prompt

Write a short paragraph about your organisation and save it:

> *"We are [name], a registered NGO in Jos working on girls' education in rural communities. Our tone is warm, respectful and hopeful. We write in British English and avoid jargon. We never use photos or names of children without parental consent."*

Paste it at the start of each AI chat so the drafts sound like you.

## Where to gather your people

AI helps you write; you still need a place where your members, volunteers and supporters gather. On #NotesApp, a **Community** gives your organisation announcements, **Spaces** for teams or topics, private **Circles**, audio rooms and **events**, and churches and NGOs can switch on **giving** so supporters can give to named funds with receipts.

**Privacy check:** describe your organisation and your work, not individuals. "Girls aged 10 to 15 in rural Plateau" is fine; names, photos and villages of specific children are not.

## Try this today

1. Watch the video above.
2. Write your organisation's **house style** paragraph.
3. Use it with an AI assistant to draft **one real document** you need this week (minutes, a notice or a volunteer guide).
4. Edit it and share it with your team.`,
  },
  {
    id: "ng-03-reports", moduleId: "ngwrite", kind: "text", minutes: 10, title: "Reports and newsletters people actually read",
    body: `Reports to donors, boards, parish councils or government agencies are essential, but they can take days to write. AI can turn your notes and figures into a clear first draft in minutes, so you can focus on making sure it's accurate and meaningful.

## From notes to report

Gather your raw material first: activity logs, attendance figures, photos (with consent), quotes collected with permission, and the targets you promised. Then:

> *"Using the notes below, write a 600-word quarterly report for our funder. Sections: summary, activities, results against targets, challenges, lessons learnt, next quarter's plan. Use only the facts in my notes. Where information is missing, write [MISSING] instead of guessing."*

The last sentence is crucial. **AI fills gaps with invented details** unless you tell it not to. "[MISSING]" shows you exactly what you still need to find.

## Check every fact

Before sending:

- Compare every number with your records.
- Check every name, date and place.
- Make sure quotes are real, and that the person agreed to be quoted.
- Remove anything AI added that you didn't give it.

A funder who finds one invented figure may never trust your reports again.

## Newsletters and annual reports

> *"Turn these three stories from our outreach into a friendly 400-word newsletter for church members, with a short headline for each story and a closing thank-you."*

Use real stories, told with permission. AI can help you structure them and find warm words.

## Different readers, different versions

Ask AI to adapt one report for different audiences:

- a one-page summary for the board
- a short version for members or the community
- a plain-language version for beneficiaries

You can publish public updates as a journal on #NotesApp, or as an announcement in your organisation's **Community**, so supporters see your impact.

**Privacy check:** reports often include stories of real people. Use first names only with consent, or change names and say so. Never paste beneficiary lists, case notes or health records into a public AI tool.

## Try this today

1. Gather your notes and figures for your next report.
2. Use the prompt above, including the **[MISSING]** instruction.
3. Fill in the gaps from your records and check every fact.
4. Ask AI for a **one-page summary** version for your board or leaders.`,
  },
  {
    id: "ng-04-grants", moduleId: "ngwrite", kind: "text", minutes: 11, title: "Grant proposals with AI help, and without invention",
    body: `Grant writing is competitive and time-consuming. AI can help you organise ideas, follow the funder's format and polish your language. It must never make up your track record, your numbers or your partners.

## Understand the call first

Paste the funder's call for proposals (it's public information) and ask:

> *"Summarise this call for proposals: who is eligible, what they will fund, the deadline, the budget range, the required sections and how proposals will be scored. List anything that might make us ineligible."*

Then decide honestly whether you fit. Applying for grants you don't fit wastes your time.

## Build the proposal from your facts

Write down, in your own words:

- the **problem** (with real evidence and its source)
- your **solution** and why it will work
- your **track record** (real projects, real results)
- your **team and partners** (real people who agreed)
- your **budget**

Then ask AI to help structure and strengthen it:

> *"Using only the facts below, draft the 'Problem statement' and 'Project description' sections of this proposal in the funder's format. Keep it under 800 words. Where you need evidence I haven't given, write [EVIDENCE NEEDED]."*

## A logical framework

AI is good at turning plans into a **results framework** or **logframe**:

> *"Turn this project plan into a simple logframe with goal, outcomes, outputs, activities, indicators and means of verification."*

Check that every indicator is something you can actually measure.

## Honesty rules

- **Statistics:** only use figures from sources you've checked, and name the source.
- **Partners:** only list partners who have agreed in writing.
- **Funders' AI rules:** some funders ask whether AI was used, or limit it. Read their guidance and follow it.
- **Your voice:** reviewers read hundreds of proposals. AI-sounding text is easy to spot. Edit so it sounds like your team.

**Privacy check:** proposals may include case studies. Use anonymised stories with consent, and don't paste staff CVs with personal details or beneficiary data into AI tools.

## Try this today

1. Find one real call for proposals relevant to your work.
2. Ask AI to summarise it and list eligibility risks.
3. Write your **facts list** (problem, solution, track record, team, budget).
4. Ask AI to draft one section using only your facts, then mark every **[EVIDENCE NEEDED]** and find the real source.`,
  },
  {
    id: "ng-05-translate", moduleId: "ngreach", kind: "text", minutes: 10, title: "Translating messages into Yoruba, Igbo, Hausa and Pidgin",
    body: `If your message is only in English, many of the people you serve may not fully understand it, especially older people and rural communities. Translation used to be slow and costly. AI makes a first draft quick and cheap, but translation into Nigerian languages needs careful checking.

## How to ask

> *"Translate this announcement into Hausa for an elderly rural audience. Use simple, respectful language. Keep the date, time and place exactly as written."*

> *"Rewrite this health message in simple Nigerian Pidgin, as you would say it at a community meeting."*

> *"Translate into Yoruba with correct tone marks: [text]."*

Tools like Google Translate, ChatGPT, Gemini, Claude and Copilot can all attempt Yoruba, Igbo and Hausa. Pidgin support varies, so test it. There's also growing local work: in September 2025, Nigeria launched **N-ATLAS**, an open-source language model for Yoruba, Hausa, Igbo and Nigerian-accented English, developed by the National Centre for Artificial Intelligence and Robotics with Awarri Technologies. It's mainly a foundation for developers to build on, rather than an everyday app.

## The checking rule

AI is usually much weaker in Nigerian languages than in English. It can:

- choose the wrong word or a word from a different dialect
- get tone marks wrong in Yoruba or Igbo, which can change meaning
- sound stiff, rude or funny without meaning to
- miss cultural meaning entirely

So **every translation must be checked by a fluent speaker** from the community you're addressing before it's printed, announced or posted.

## When AI translation isn't enough

For high-stakes messages, use a **professional or trusted human translator**:

- health and medicine instructions
- legal documents, consent forms and contracts
- safeguarding and emergency information

A wrong word in a medicine dose or a consent form can cause real harm.

## Voice and audio

Many people in your community may prefer listening to reading. Record announcements in local languages yourself, or with a trusted speaker, rather than relying on AI-generated voices, which may sound unnatural.

**Privacy check:** translating a general announcement is fine. Don't paste personal letters, counselling notes or messages that identify individuals into public translation or AI tools.

## Try this today

1. Choose one real announcement your organisation needs to share.
2. Ask an AI tool to translate it into the language most of your audience speaks.
3. Ask a fluent speaker to check and correct it. Note how many changes they made.
4. Share the corrected version with your community.`,
  },
  {
    id: "ng-06-yoruba", moduleId: "ngreach", kind: "youtube", minutes: 12, title: "AI explained in Yoruba",
    youtubeId: "C2FzRzXAYnk",
    videoCredit: { title: "AI for Everyone : Large Language Models(LLMs) in Yoruba - Wuraola Oyewusi", name: "Tech in Yoruba ", url: "https://www.youtube.com/@wuraoyewusi" },
    body: `When your team and your community understand what AI is, they make better decisions about it. And people understand best in the language they think in.

In this video, Tech in Yoruba shares **Wuraola Oyewusi** explaining large language models (LLMs), the technology behind chatbots like ChatGPT, in Yoruba. It's a good example of explaining technology in a Nigerian language, and a good resource to share with Yoruba-speaking staff, volunteers and members.

## Why this matters for your organisation

- **Informed staff and volunteers** use AI more safely.
- **Informed communities** can spot AI scams and fakes, and ask good questions when organisations use AI with their data.
- **Local-language explainers** reach people that English materials miss.

## Run a short AI awareness session

You can run a simple 30-minute session for your volunteers, members or community:

1. **What AI is** (5 minutes): use plain words and local examples.
2. **What it's good for** (5 minutes): writing help, learning, translation drafts.
3. **What to watch for** (10 minutes): mistakes, scams, voice cloning, deepfakes.
4. **Privacy** (5 minutes): never share PINs, BVN or personal details with AI tools or strangers.
5. **Questions** (5 minutes).

Ask AI to help you prepare simple notes in English, then ask fluent speakers to help you deliver the session in Yoruba, Igbo, Hausa or Pidgin. Schedule it as an **event** in your organisation's **Community** on #NotesApp so people can register and get reminders, and publish the notes in a **Space** afterwards.

**Privacy check:** if you record the session, tell people first and get their agreement, especially before sharing recordings with faces or voices.

## Try this today

1. Watch the video above (or share it with a Yoruba-speaking colleague).
2. Plan a **30-minute AI awareness session** using the outline above.
3. Choose the language and a fluent co-presenter, and set a date.`,
  },
  {
    id: "ng-07-surveys", moduleId: "ngdata", kind: "text", minutes: 11, title: "Survey and data analysis",
    body: `Good organisations listen to the people they serve. Surveys, feedback forms and monitoring data tell you what's working and what isn't. AI can help you design better surveys and make sense of the answers, especially the long written ones that are hard to summarise.

## Designing a survey

> *"Help me design a 10-question feedback survey for parents whose children attended our free summer lessons in Ibadan. Mix multiple-choice and two open questions. Keep the language simple. Avoid leading questions."*

Then:

- **Remove questions you don't need.** Collect only what you'll use (this is also a data protection principle).
- **Avoid collecting names** unless you really need them.
- **Explain at the start** what the survey is for and how answers will be used.
- **Translate** it if needed, and have a fluent speaker check it.

## Analysing numbers

Export your results to a spreadsheet. **Remove names, phone numbers and any identifying details** first. Then ask:

> *"Here are anonymised results from 120 survey responses [paste table]. Summarise the main findings, show percentages for each question, and point out anything surprising."*

Check the percentages yourself with spreadsheet formulas. AI can miscount.

## Analysing written answers

This is where AI shines. Paste anonymised open answers and ask:

> *"Group these 80 comments into main themes. For each theme, say how many comments mention it and give two short example quotes. Don't invent any quotes."*

Then **read a sample of the original comments yourself** to make sure the themes are fair, and that quieter voices aren't lost.

## Be careful with conclusions

- A survey of 50 people doesn't speak for a whole state.
- People who answer surveys may be different from those who don't.
- Correlation isn't causation: if attendance rose when you changed the time, other things may have changed too.

Ask AI: *"What are the limitations of these findings?"* and include them in your report.

**Privacy check:** survey answers can be personal, especially about health, religion, income or family. Anonymise before using AI, store raw data securely, share it only with people who need it, and delete it when you no longer need it.

## Try this today

1. Ask AI to help you design (or improve) **one feedback survey** for your work.
2. Remove any question that collects data you won't use.
3. If you have past survey results, anonymise them and ask AI to find the main themes. Then check them against the original answers.`,
  },
  {
    id: "ng-08-responsible", moduleId: "ngdata", kind: "text", minutes: 11, title: "Responsible use of people's data",
    body: `The people you serve trust you with their information: their names, phone numbers, health conditions, family problems, prayer requests, faith, income. That trust is precious. Misusing it, even by accident, can harm people and destroy your organisation's reputation. This lesson is general information, not legal advice.

## What the law says

The **Nigeria Data Protection Act 2023 (NDPA)**, signed on 14 June 2023, applies to organisations that process personal data, including NGOs, religious bodies and public institutions. It's supervised by the **Nigeria Data Protection Commission (NDPC)**, at **ndpc.gov.ng**. Key ideas include:

- **A lawful basis:** you need a valid reason to use personal data, such as consent, a contract, a legal duty, vital interests, a public task or legitimate interests.
- **Consent must be real:** silence or inactivity is not consent, and people can withdraw consent at any time.
- **Sensitive data** (including religious beliefs, health, ethnic origin, political opinions and biometric data) needs extra protection and stronger reasons.
- **Children** (under 18) generally need a parent's or guardian's consent.
- **People's rights:** to know what you hold, get a copy, correct it, have it erased in some cases, object, and complain to the NDPC.
- **Breaches:** where a breach is likely to put people's rights at risk, the NDPC must be notified within 72 hours of becoming aware of it.

Larger organisations, or those handling a lot of sensitive data, may have extra duties, including registration with the NDPC. Get professional advice if you're unsure.

## AI-specific risks

- **Pasting data into public AI tools** may mean sharing it with a company outside your control, possibly outside Nigeria.
- **Automated decisions:** if AI is used to decide who gets help (for example, ranking beneficiaries), people may be treated unfairly. Under the NDPA, people generally have rights around decisions made solely by automated processing. Keep a human in charge of decisions that affect people's lives.
- **Bias:** AI can reflect unfair patterns. Check that its suggestions don't disadvantage women, people with disabilities, minorities or rural people.
- **Photos and stories:** AI image tools can alter photos. Never alter photos of beneficiaries to make need look more dramatic.

## A simple data checklist for your organisation

1. **List** what personal data you hold and why.
2. **Reduce** it: stop collecting what you don't need.
3. **Protect** it: passwords, locked phones, limited access, no lists in personal chats.
4. **Explain** it: a short privacy notice for members and beneficiaries.
5. **Agree** an AI rule: no personal data in public AI tools; anonymise first.
6. **Prepare** for problems: who to call and what to do if data is lost or leaked.

## Try this today

1. Go back to your list of personal data from the first lesson.
2. For each type, write: **why** you hold it, **who** can see it, and **how** it's protected.
3. Write your organisation's **AI rule** in one sentence and share it with your team.`,
  },
  {
    id: "ng-09-plan", moduleId: "ngdata", kind: "text", minutes: 7, title: "Your organisation's AI plan",
    body: `You've seen how AI can help with reports, grant proposals, translation, surveys and data analysis, and how to protect the people whose data you hold. Let's turn it into a simple plan your leadership can approve.

## A one-page AI plan

1. **Why:** what AI will help us do (save staff time, reach more people in their language, report better).
2. **Approved uses:** drafting reports and letters, first-draft translations (checked by fluent speakers), survey design and anonymised analysis, meeting notes.
3. **Not allowed:** personal or sensitive data in public AI tools; AI-invented facts, quotes or figures; AI deciding who receives help; altered photos of beneficiaries.
4. **Checks:** every AI draft is reviewed by a named person before it goes out.
5. **Training:** all staff and volunteers complete a short AI and data session.
6. **Review:** we'll review this plan every six months.

**Privacy check:** the plan must say who your data protection lead is, and how your organisation meets Nigeria's Data Protection Act 2023 for members', donors' and beneficiaries' data.

Ask an AI assistant to help you turn these points into a tidy document, then take it to your board, parish council or management.

## Train your team

Volunteers and staff change often. Put your training somewhere they can always find it. You can publish a short internal course on **Notes Academy** on #NotesApp, with a quiz and a certificate, and keep guidance documents in a **Space** in your organisation's **Community**.

## A word from me

The best organisations combine good hearts with good systems. AI can strengthen your systems, but it can't replace the care, presence and trust that people come to you for. Keep people at the centre.

**Emmanuel Adams**, LWB academy

## Try this today

1. Draft your **one-page AI plan** using the six headings above.
2. Share it with one leader in your organisation for comments.
3. Take the quiz that follows and claim your certificate.`,
  },
  {
    id: "ng-10-quiz", moduleId: "ngdata", kind: "quiz", minutes: 6, title: "Check what you've learnt",
    quiz: {
      passPercent: 70,
      questions: [
        { id: "ngq1", prompt: "Why tell AI to write [MISSING] where information is missing in a report?", options: ["It looks professional", "So it doesn't invent details, and you can see exactly what to find", "Funders like brackets", "It makes the report longer"], answer: 1, explain: "AI fills gaps with invented details unless told not to. [MISSING] shows you what to check in your records." },
        { id: "ngq2", prompt: "Which of these is sensitive data under Nigeria's Data Protection Act 2023?", options: ["A church member's religious beliefs", "The date of your next event", "Your organisation's address", "The title of a report"], answer: 0, explain: "Religious beliefs, health, ethnic origin, political opinions and biometric data are among the sensitive categories." },
        { id: "ngq3", prompt: "AI translates a medicine-dose message into Hausa. What should you do?", options: ["Publish it immediately", "Use a professional or trusted human translator, and have a fluent speaker check it", "Translate it back to English to check", "Use it only in the rainy season"], answer: 1, explain: "AI is weaker in Nigerian languages, and health instructions are high-stakes. Use qualified human checking." },
        { id: "ngq4", prompt: "Your grant proposal needs a statistic. What's the right approach?", options: ["Ask AI to estimate one", "Use only a figure from a source you've checked, and name the source", "Round up to sound impressive", "Leave sources out"], answer: 1, explain: "Never use AI-invented numbers. Use checked figures and name the source." },
        { id: "ngq5", prompt: "Before pasting survey answers into an AI tool, you should…", options: ["Add respondents' phone numbers for context", "Remove names and anything identifying", "Paste everything as it is", "Translate them into French"], answer: 1, explain: "Anonymise first. Survey answers can be personal and sensitive." },
        { id: "ngq6", prompt: "Who should decide which families receive support from your programme?", options: ["An AI ranking alone", "People in your organisation, using fair criteria (AI can help organise information)", "Whoever messages first", "The AI chatbot's mood"], answer: 1, explain: "Keep a human in charge of decisions that affect people's lives, and check for bias." },
        { id: "ngq7", prompt: "Under the NDPA, how quickly must an organisation notify the NDPC of a breach likely to put people's rights at risk?", options: ["Within 72 hours of becoming aware of it", "Within one year", "Never", "Only if it reaches the news"], answer: 0, explain: "The Act requires notification to the NDPC within 72 hours of becoming aware of such a breach." },
        { id: "ngq8", prompt: "AI suggests a quote from a beneficiary for your newsletter. What should you do?", options: ["Use it: it sounds nice", "Only use real quotes that the person agreed to share", "Change the name and use it", "Use it if no one will check"], answer: 1, explain: "Never use invented quotes. Real stories, told with permission, build trust." },
      ],
    },
  },
];

export const AI_NGOS: SeedCourse = {
  key: "ai-ngos-churches-public",
  ownerUsername: "lwb", byline: "Emmanuel Adams",
  slug: "ai-for-ngos-churches-and-public-organisations",
  title: "AI for NGOs, Churches and Public Organisations",
  cover: "/images/academy/covers/ai-for-ngos-churches-and-public-organisations.webp",
  summary: `Serve people better, and protect their trust.

A practical course for NGOs, churches, mosques, community associations and public organisations in Nigeria and across Africa. You'll use AI to draft reports, newsletters and grant proposals without inventing a single fact; translate messages into Yoruba, Igbo, Hausa and Pidgin and have them checked; design surveys and analyse feedback; and handle people's data responsibly under Nigeria's Data Protection Act 2023, including sensitive data like faith and health.

Each lesson ends with a "Try this today" exercise, and the course ends with a one-page AI plan for your organisation and a quiz. Written by Emmanuel Adams for LWB academy.`,
  topics: ["community", "ai", "data"],
  subtopics: [{ parent: "community", label: "Grant Writing" }, { parent: "community", label: "Nonprofit Reporting" }, { parent: "data", label: "Survey Analysis" }],
  level: "beginner", language: "English", format: "self",
  outcomes: [
    "Draft reports and newsletters from your own notes and figures",
    "Use AI on grant proposals without inventing facts or partners",
    "Translate messages into Nigerian languages and have them checked",
    "Know when a professional translator is needed",
    "Design simple surveys and analyse anonymised answers",
    "Run an AI awareness session for your community",
    "Apply the NDPA 2023 to members', donors' and beneficiaries' data",
    "Keep people, not AI, in charge of decisions about them",
    "Write a one-page AI plan for your organisation",
  ],
  requirements: [
    "Work or volunteering with an NGO, faith or public organisation",
    "A smartphone or computer with internet",
    "Some real documents to practise on (reports, notices, surveys)",
  ],
  modules: [
    { id: "ngwrite", title: "Write and fund" },
    { id: "ngreach", title: "Reach people in their language" },
    { id: "ngdata", title: "Data with care" },
  ],
  lessons: LESSONS,
};
