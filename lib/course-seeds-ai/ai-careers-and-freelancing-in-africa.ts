// Course 6 of lib/course-seeds-ai.ts: AI Careers and Freelancing in Africa. Videos checked with YouTube oEmbed on 1 November 2026.
// Platform facts were checked on 1 November 2026 (sources in the lesson text); they change often, so re-check before seeding again.
import type { AiSeedCourse, AiSeedLesson } from "../course-seeds-ai";

const LESSONS: AiSeedLesson[] = [
  {
    id: "ca-01-welcome", moduleId: "caskill", kind: "text", minutes: 8, title: "Welcome: real AI opportunities, honestly",
    body: `Welcome. I'm Emmanuel Adams from LWB academy. This course is for young people, graduates, career changers and anyone in Africa who wants to earn with AI skills: the NYSC member in Kwara with a laptop and ideas, the secretary in Port Harcourt who wants to become a virtual assistant, the writer in Nairobi, the student in Accra.

You'll see a lot of noise online: "Make $5,000 a month with AI!", "Get paid to chat with chatbots!". Some of it is real. A lot is exaggerated, and some is outright scams. This course is honest about both.

## Four ways people earn with AI skills

1. **Prompt writing:** getting excellent results from AI tools, for yourself or for clients. It's a core skill for almost every job now.
2. **AI-assisted freelancing:** doing work clients already pay for (writing, design, research, virtual assistance, data cleaning, translation) faster and better with AI.
3. **AI training and data work:** labelling images, rating AI answers, writing examples, for companies that build AI.
4. **Building and teaching:** creating digital products, courses and services that use or explain AI.

Deeper technical careers (machine learning engineering, data science) need longer study, often maths and programming. In Nigeria, the federal government's **3 Million Technical Talent (3MTT)** programme includes an AI and machine learning track among its learning tracks (**3mtt.nitda.gov.ng**). This course focuses on the skills you can start using this month.

## What you'll need

- A smartphone at minimum; a laptop opens many more doors.
- Reliable internet, at least sometimes.
- Patience. Building a reputation takes months, not days.

## Your data and your safety (privacy first)

Job hunting online exposes you to fake recruiters who want your NIN, BVN, bank login or a "registration fee". **Real employers don't need your BVN or bank password to hire you, and you should never pay to get a job.** We'll come back to this.

## Try this today

1. Write down which of the **four ways** interests you most, and why.
2. List the skills you already have (writing, Excel, design, languages, teaching, customer service, research).
3. Ask an AI assistant: *"I'm in [city] with these skills: [list]. Suggest five realistic ways I could earn using AI tools, starting with what I already know. Be honest about how long each might take."*`,
  },
  {
    id: "ca-02-prompts", moduleId: "caskill", kind: "youtube", minutes: 10, title: "Prompt writing: the core skill",
    youtubeId: "3SjjFOEEWNo",
    videoCredit: { title: "Write Clear and Specific Prompts | Google AI Essentials", name: "Grow with Google", url: "https://www.youtube.com/@growwithgoogle" },
    body: `Every AI career starts with one skill: **writing prompts that get excellent results**. Two people can use the same AI tool; one gets generic rubbish, the other gets work a client will pay for. The difference is usually the prompt.

In this video, Grow with Google, from its Google AI Essentials course, explains how the quality of the prompt you give a conversational AI tool affects the quality of what you get back, and why **clear and specific prompts** work better.

## The anatomy of a strong prompt

A reliable pattern is **Role, Task, Context, Format, Rules**:

- **Role:** *"You're an experienced copywriter for Nigerian fashion brands."*
- **Task:** *"Write three Instagram captions for a new Adire collection."*
- **Context:** *"The brand is based in Abeokuta, targets women aged 25 to 40, and is proud of hand-dyeing techniques."*
- **Format:** *"Each caption under 40 words, with two hashtags."*
- **Rules:** *"No exaggerated claims. British spelling. No emojis."*

Compare that with *"Write captions for Adire."* You can feel the difference before you even run it.

## Iterate like a professional

A professional rarely uses the first output. They **refine**:

- "Make the second one warmer."
- "Shorter. Remove the cliché in line one."
- "Give me two more in the style of the third."

Each round teaches you what the tool responds to.

## Save what works

Start a **prompt library**: a document where you keep prompts that gave great results, organised by task (captions, emails, summaries, CV bullets). This becomes a valuable asset, and part of your portfolio later.

**Privacy check:** when you practise with real client work, remove names, contact details, prices and anything confidential. Use "[Client]" and "[Product]" placeholders.

## Try this today

1. Watch the video above.
2. Choose one task you do often. Write a weak prompt and a strong one using **Role, Task, Context, Format, Rules**.
3. Run both. Compare the results and write down what made the difference.
4. Start your **prompt library** with the strong one.`,
  },
  {
    id: "ca-03-techniques", moduleId: "caskill", kind: "text", minutes: 11, title: "Prompt techniques that professionals use",
    body: `Once you know the basic pattern, a few extra techniques will make your work faster and more reliable. These work across ChatGPT, Claude, Gemini, Copilot and most other assistants.

## 1. Give examples

Show the AI what "good" looks like:

> *"Here are two product descriptions I like: [example 1], [example 2]. Write a new one for [product] in the same style."*

This is often called **few-shot prompting**, and it's one of the most effective techniques.

## 2. Ask it to think step by step

For anything involving reasoning, numbers or planning:

> *"Work through this step by step, then give the final answer."*

## 3. Ask it to ask you questions

> *"Before you write the proposal, ask me any questions you need answered."*

This catches missing information early.

## 4. Break big jobs into parts

Don't ask for a 20-page report in one go. Ask for an outline, approve it, then write each section. You stay in control of quality.

## 5. Use a checker prompt

After a draft, run a second prompt:

> *"Review this text as a strict editor. List factual claims that need checking, unclear sentences, and anything that sounds generic."*

## 6. Templates with placeholders

Turn your best prompts into reusable templates:

> *"Write a cold email to [type of client] in [city] offering [service]. Mention [one specific benefit]. Under 120 words. Friendly, not pushy."*

## 7. Know when not to use AI

Some work needs a human from the start: sensitive conversations, original creative ideas a client is paying *you* for, legal or medical judgements, and anything where you can't check the output.

## Check facts, always

AI invents things confidently. In client work, an invented statistic, quote or source can cost you the client and your reputation. **Every fact gets checked.**

**Privacy check:** clients trust you with their information. Many expect it to stay confidential. Ask clients whether they're happy for you to use AI tools on their work, and never paste confidential documents into a public tool without permission.

## Try this today

1. Pick a real task (a cover letter, a proposal, a social media plan).
2. Use at least **three** of the techniques above on it.
3. Add the best prompts to your **prompt library**, turned into templates with placeholders.`,
  },
  {
    id: "ca-04-deeper", moduleId: "caskill", kind: "youtube", minutes: 50, title: "Go deeper: a full prompt engineering tutorial",
    youtubeId: "_ZvnD73m40o",
    videoCredit: { title: "Prompt Engineering Tutorial – Master ChatGPT and LLM Responses", name: "freeCodeCamp.org", url: "https://www.youtube.com/@freecodecamp" },
    body: `This lesson is longer and optional, for those who want to go deeper into prompt engineering.

In this video, freeCodeCamp.org, a free non-profit coding school, teaches prompt engineering techniques for getting better results from ChatGPT and other large language models. The tutorial runs for about 40 minutes. You can watch it in two or three sittings.

## How to watch for maximum learning

- Keep an AI assistant open beside the video, and **try each technique** as it's explained, using your own examples.
- Pause and write a one-line note for each technique in your **prompt library**.
- Adapt examples to your context: Nigerian businesses, local clients, your own skills.

## From prompting to a service

As your skill grows, think about how it becomes something people pay for:

- **Prompt packs:** tested prompt templates for a specific job (estate agents, caterers, teachers), sold as a digital download in your **#NotesApp store**.
- **AI set-up sessions:** helping a small business set up its AI routines, sold as a 1:1 session through **Booking** on #NotesApp.
- **Teaching:** a short course on **Notes Academy**, "AI prompts for Nigerian small businesses", with a quiz and a certificate.

Only sell what you've tested and what genuinely works. Your reputation is your business.

**Privacy check:** when you create prompt packs or courses from client work, remove anything that identifies the client or their customers, and ask permission before using their work as an example.

## Try this today

1. Watch at least the **first half** of the tutorial, trying techniques as you go.
2. Add five new entries to your **prompt library**.
3. Write down one **service or product idea** based on your prompting skills.`,
  },
  {
    id: "ca-05-freelancing", moduleId: "cawork", kind: "text", minutes: 11, title: "AI-assisted freelancing",
    body: `Most AI freelancing isn't a new kind of job. It's the jobs clients already pay for, done faster and better because you use AI well. The client pays for the **result** and **your judgement**, not for the tool.

## Services that work well with AI help

- **Writing and editing:** blog posts, product descriptions, newsletters, CVs.
- **Virtual assistance:** inbox management, scheduling, research, summaries, meeting notes.
- **Social media management:** content calendars, captions, simple graphics.
- **Data tasks:** cleaning spreadsheets, summarising survey results, simple reports.
- **Translation and localisation:** first drafts by AI, finished by you as a fluent speaker.
- **Customer support writing:** FAQs, reply templates, help articles.

## What makes clients come back

- **Quality:** you check and improve every AI draft. You never send raw AI output.
- **Local knowledge:** you understand the Nigerian or African market, the language and the culture.
- **Reliability:** you meet deadlines and communicate clearly.
- **Honesty:** you're open about using AI tools if the client asks, and you follow their rules.

## Pricing your work

Price by **value and outcome**, not by how long the AI took. A well-researched, checked, on-brand blog post is worth the same to the client whether it took you two hours or five. Ask an AI assistant to help you think through pricing, then check what others charge for similar work.

## Where to work from

Have **one professional home** for your freelance business. On #NotesApp you can:

- offer paid consultations and sessions through **Booking**
- sell templates, prompt packs and guides in **your own store**
- publish **journals** showing your expertise
- teach courses on **Notes Academy**

Clients may also find you through international freelance marketplaces. Wherever you work, read the platform's terms, and keep copies of your agreements.

## Confidentiality

Clients' documents, customer lists and plans are confidential. Before using AI on client work:

1. **Ask** whether they allow AI tools.
2. **Remove** names and confidential details where you can.
3. **Use** tools and settings that don't train on your data, where available.
4. **Never** paste passwords, financial data or customer personal data into public AI tools.

## Try this today

1. Choose **one service** from the list that fits your skills.
2. Write a short service description with AI help: what you do, for whom, the result, and your price.
3. Set it up as a **Booking** session or a store item on #NotesApp, or write it as a draft ready to publish.`,
  },
  {
    id: "ca-06-labelling", moduleId: "cawork", kind: "youtube", minutes: 13, title: "Data-labelling and AI training jobs: the real picture",
    youtubeId: "ug_p2wHhla0",
    videoCredit: { title: "Doing Grueling Work for an AI: Data Labeling", name: "DW Shift", url: "https://www.youtube.com/@DWShift" },
    body: `AI systems learn from examples labelled by people: images tagged ("this is a car"), answers rated ("this reply is better"), text written and checked. This is **data labelling**, also called **annotation** or **AI training work**. It's real work, much of it done in Africa. But it's also an area full of disappointment and scams.

## The honest picture

In this video, DW Shift reports on data-labelling work in Kenya, where workers were exposed to disturbing content to make ChatGPT safer, and says their pay was less than 2 euros an hour. Not all labelling work is like this, but it's a reminder to go in with open eyes: some tasks are repetitive, some are upsetting, and pay can be low and unpredictable.

## Platforms and companies (checked in November 2026: things change fast)

- **Sama** employs data annotators directly, with its largest office in **Nairobi** and operations in **Uganda** (Kampala and Gulu). It hires through its own careers page (sama.com), as an employer, not a gig app.
- **Remotasks** (owned by Scale AI) **shut down for workers in Kenya, Nigeria and Pakistan in March 2024**, as reported by Rest of World.
- **Outlier** (also Scale AI) is a separate platform for generative-AI training work. A May 2026 report by Techsoma said its sign-up was rejecting Nigerian phone numbers. Check its current list of eligible countries before you spend time on it.
- **Toloka** has moved its annotator work to **Mindrift** (mindrift.ai), which says joining is free, pays through Payoneer or Tipalti, and publishes eligibility rules on its site.
- **Appen**'s contributor platform is now **CrowdGen** (crowdgen.com). Some projects have recruited Nigeria-resident contributors, but project availability by country varies.

Always check the platform's **own website** for current eligibility in your country.

## Scam warning

Fake "AI training" jobs are everywhere. Walk away if:

- you must **pay** for registration, training, a "starter kit" or an account
- someone offers to **sell you a foreign account** or tells you to use a VPN or foreign SIM to pretend you live elsewhere (this breaks platform rules; you can be banned and lose your earnings)
- a "recruiter" contacts you on social media with no company email or website
- they ask for your **BVN, bank login, card PIN or OTP**
- the pay sounds too good for simple work

## Is it for you?

Data work can be a way to earn while you learn, especially if you have specialist knowledge (a profession, a degree, fluency in Yoruba, Hausa, Igbo, Swahili or another African language). Treat it as one income stream, not a guaranteed career, and keep building other skills.

**Privacy check:** genuine platforms may verify your identity for payments. Only give ID documents through the platform's official website or app, never to a "recruiter" in a chat.

## Try this today

1. Watch the video above.
2. Visit the official websites of **two** of the platforms above and read their current eligibility and pay rules.
3. Write down which, if any, you're eligible for, and what specialist knowledge you could offer.`,
  },
  {
    id: "ca-07-portfolio", moduleId: "caport", kind: "text", minutes: 11, title: "Building a portfolio that wins work",
    body: `Clients and employers don't hire "I know AI". They hire **evidence**: work they can see, results they can trust, and a person they can reach. Your portfolio is that evidence.

## What to put in it

Aim for **five to eight strong pieces**, each showing a real skill:

- **Before and after:** a messy spreadsheet and the clean version; a weak product description and your improved one; rough notes and the finished report.
- **Case studies:** *"A Lagos bakery needed a month of social media content. I created a calendar and 20 captions with AI help, checked and edited by hand. Posts went out on time for the whole month."* Only claim results you can show.
- **Prompt library samples:** a few of your best prompt templates, explained.
- **Writing samples:** journals or articles in your area of expertise.
- **Certificates:** from courses you've genuinely completed, such as Notes Academy certificates, which anyone can check.

No clients yet? Do **practice projects**: rewrite the website of a local business (for your portfolio only, not passed off as paid work), or create a sample content plan for an imaginary brand, clearly labelled as a sample.

## Be honest about AI

Say how you work: *"I use AI tools for first drafts and research, and I check, edit and take responsibility for everything I deliver."* Honest clients appreciate it. Dishonesty, if discovered, ends relationships.

## Where to publish it

Your portfolio needs a home that's easy to share. On #NotesApp:

- Write **journals** showing your work and thinking.
- List your services through **Booking** and products in **your store**.
- Teach what you know on **Notes Academy**; a published course is powerful proof of expertise.
- Your profile brings these together in one link you can share with clients.

Keep it updated. Remove weaker pieces as you add better ones.

**Privacy check:** never show client work without permission. Remove client names, customer details, prices and anything confidential, or create samples instead.

## Try this today

1. List **five pieces** you could put in your portfolio now, or practice projects you could do this week.
2. Write one **case study** in this format: the problem, what you did (including how you used AI), and the result you can show.
3. Publish it as a journal on #NotesApp, or save it as a draft ready to publish.`,
  },
  {
    id: "ca-08-learning", moduleId: "caport", kind: "text", minutes: 9, title: "Keep learning: a path for the next year",
    body: `AI tools change every few months. The people who do best aren't those who learnt one tool, but those who keep learning. Here's a practical path.

## Months 1 to 3: foundations

- Practise prompting daily on real tasks.
- Learn **spreadsheets** properly (Google Sheets or Excel): sorting, formulas, charts. Many AI-assisted jobs need them.
- Take a structured course. **Google AI Essentials** is offered through Coursera (Grow with Google publishes previews of its lessons on YouTube), and Notes Academy has courses from teachers across Africa.

## Months 4 to 6: specialise

Choose **one area** and go deep: content writing, virtual assistance, data, design, translation, or customer support. Clients pay more for specialists. Combine AI with knowledge you already have: law, health, agriculture, accounting, teaching.

## Months 7 to 12: build and show

- Complete **three real or practice projects** in your specialism and add them to your portfolio.
- Teach what you've learnt: a journal series, a short **Notes Academy** course, or a session for a community group.
- If you want a technical path, look at programmes like **3MTT** and free resources like freeCodeCamp.

## Protect your own skills

Relying on AI for everything can make you weaker. Keep practising the core skills **without** AI sometimes: write a paragraph by hand, do the maths yourself, read the full document. Your judgement is what clients pay for.

## Learn with others

Learning alone is hard. Join or start a **Community** on #NotesApp for freelancers or learners in your city, with **Spaces** for different skills and **events** for monthly meet-ups or online sessions.

**Privacy check:** when you sign up to courses and platforms, use strong, different passwords and turn on two-step verification. Your accounts are your livelihood.

## Try this today

1. Write your **12-month learning path** using the three stages above, with your chosen specialism.
2. Sign up for **one** structured course this week.
3. Block **three hours a week** in your calendar for learning.`,
  },
  {
    id: "ca-09-plan", moduleId: "caport", kind: "text", minutes: 7, title: "Your 90-day plan",
    body: `You now know the core skill (prompting), the main kinds of AI work, the honest truth about data-labelling platforms, how to build a portfolio, and how to keep learning. Let's turn it into a 90-day plan.

## Days 1 to 30: skill and setup

- Practise prompting every day; build your **prompt library** to 30 templates.
- Choose your **one service**.
- Set up your professional home on #NotesApp: profile, one **Booking** service or store item, and your first journal.

## Days 31 to 60: proof

- Complete **three** practice or real projects.
- Write **two case studies**.
- Tell 20 people what you offer: former colleagues, your church or mosque, your alumni network, local businesses.

## Days 61 to 90: first clients and review

- Aim for your **first paying client** (or your first few if you're further along).
- Ask every client for **feedback and a review**.
- Review: what worked, what didn't, what to change.

## Your career safety rules

1. **I never pay to get a job.**
2. **I never share my BVN, bank login, PIN or OTP with "recruiters".**
3. **I never buy accounts or fake my location** on platforms.
4. **I check every AI output** before a client sees it.
5. **I keep client information confidential.**

## A word from me

Africa has some of the world's most talented, hard-working young people. AI won't replace that talent, but it can multiply it. Be patient, be honest, keep learning, and build a reputation that speaks for you.

**Emmanuel Adams**, LWB academy

## Try this today

1. Write your **90-day plan** with dates.
2. Write the **five safety rules** where you'll see them.
3. Take the quiz that follows and claim your certificate. Add it to your portfolio.`,
  },
  {
    id: "ca-10-quiz", moduleId: "caport", kind: "quiz", minutes: 7, title: "Check what you've learnt",
    quiz: {
      passPercent: 70,
      questions: [
        { id: "caq1", prompt: "Which prompt is most likely to give work a client would pay for?", options: ["\"Write captions\"", "\"Captions for Adire pls\"", "A prompt with a role, task, context, format and rules", "\"Make it go viral\""], answer: 2, explain: "Role, Task, Context, Format and Rules give the AI what it needs to produce useful work." },
        { id: "caq2", prompt: "A \"recruiter\" offers you an AI training job if you pay ₦15,000 for registration. What is this most likely to be?", options: ["A normal hiring step", "A scam: genuine jobs don't charge you to join", "A good investment", "A tax"], answer: 1, explain: "Never pay to get a job. Paying for registration or a starter kit is a classic scam sign." },
        { id: "caq3", prompt: "According to Rest of World, what happened to Remotasks workers in Kenya, Nigeria and Pakistan in March 2024?", options: ["They got a pay rise", "The platform shut down for them", "They were all hired by Sama", "Nothing"], answer: 1, explain: "Rest of World reported that Remotasks, owned by Scale AI, shut down for workers in those countries in March 2024." },
        { id: "caq4", prompt: "Someone offers to sell you a US account on an AI training platform. Should you buy it?", options: ["Yes, it pays more", "No: it breaks platform rules, and you can be banned and lose your earnings", "Yes, if it's cheap", "Only with a VPN"], answer: 1, explain: "Buying accounts or faking your location breaks the platform's terms and puts your earnings at risk." },
        { id: "caq5", prompt: "What's the best way to treat AI output before a client sees it?", options: ["Send it as it is", "Check every fact, edit it, and take responsibility for it", "Add more emojis", "Ask the client to check it"], answer: 1, explain: "Clients pay for your judgement. AI can invent facts, so you check and improve everything." },
        { id: "caq6", prompt: "You want to show client work in your portfolio. What must you do first?", options: ["Nothing", "Get the client's permission, or remove confidential details and use samples", "Post it with the client's prices", "Claim bigger results"], answer: 1, explain: "Client work is confidential. Get permission, anonymise, or create clearly labelled samples." },
        { id: "caq7", prompt: "Which platform does Toloka's annotator work now run on?", options: ["Mindrift", "WAEC", "Notes Market", "None: it closed"], answer: 0, explain: "Toloka moved its annotator tasks to Mindrift (mindrift.ai). Always check the official site for eligibility." },
        { id: "caq8", prompt: "Where on #NotesApp can you sell 1:1 AI set-up sessions to clients?", options: ["Booking", "Naija Exam Prep", "Notes Life", "Nowhere"], answer: 0, explain: "Booking lets clients choose a time and pay for a session." },
      ],
    },
  },
];

export const AI_CAREERS: AiSeedCourse = {
  key: "ai-careers-freelancing-africa",
  ownerUsername: "lwb", byline: "Emmanuel Adams",
  slug: "ai-careers-and-freelancing-in-africa",
  title: "AI Careers and Freelancing in Africa",
  cover: "/images/academy/covers/ai-careers-and-freelancing-in-africa.webp",
  summary: `Earn with AI skills, honestly and safely.

A practical course for young people, graduates and career changers across Africa. You'll learn to write prompts that produce work clients pay for, turn existing skills into AI-assisted freelance services, understand the real picture of data-labelling and AI training jobs (which platforms operate where, and how to avoid the scams), build a portfolio that wins work, and plan your next 90 days and 12 months.

Every lesson has a "Try this today" exercise and a privacy check for your own and your clients' data. Written by Emmanuel Adams for LWB academy.`,
  topics: ["ai", "freelancing", "careers"],
  subtopics: [{ parent: "ai", label: "Prompt Engineering" }, { parent: "ai", label: "Data Labelling" }, { parent: "freelancing", label: "Remote Work" }],
  level: "beginner", language: "English", format: "self",
  outcomes: [
    "Write strong prompts with role, task, context, format and rules",
    "Use few-shot examples, step-by-step reasoning and checker prompts",
    "Build a reusable prompt library",
    "Offer an AI-assisted freelance service and price it by value",
    "Understand which data-labelling platforms operate where",
    "Recognise and avoid fake AI job and account scams",
    "Keep client work confidential when using AI tools",
    "Build a portfolio with case studies and samples",
    "Plan your learning for the next 12 months",
    "Set up your services on #NotesApp",
  ],
  requirements: [
    "No experience needed",
    "A smartphone at minimum; a laptop is better",
    "Internet access",
    "A skill you'd like to build on (writing, Excel, languages, design or other)",
  ],
  modules: [
    { id: "caskill", title: "The core skill: prompts" },
    { id: "cawork", title: "Kinds of AI work" },
    { id: "caport", title: "Show your work and grow" },
  ],
  lessons: LESSONS,
};
