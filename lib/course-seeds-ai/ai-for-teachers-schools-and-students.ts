// Course 4 of lib/course-seeds-ai.ts: AI for Teachers, Schools and Students. Videos checked with YouTube oEmbed on 1 November 2026.
import type { AiSeedCourse, AiSeedLesson } from "../course-seeds-ai";

const LESSONS: AiSeedLesson[] = [
  {
    id: "te-01-welcome", moduleId: "teplan", kind: "text", minutes: 8, title: "Welcome: AI in our classrooms",
    body: `Welcome. I'm Emmanuel Adams from LWB academy. This course is for teachers, head teachers, school owners, lesson teachers and students: the primary school teacher in Ilorin with 70 pupils and no projector, the SS3 student in Owerri preparing for WAEC, the private school proprietor in Abuja wondering what rules to set, and the lesson teacher who coaches evening classes.

AI has arrived in our schools whether we planned for it or not. Students are already using ChatGPT, Gemini, Claude and Copilot, sometimes to learn and sometimes to cheat. Teachers can use the same tools to save hours of preparation. The question is not "AI or no AI?" but **"How do we use it honestly and well?"**

## What this course covers

1. **Plan and teach:** lesson plans, local examples, and AI teaching assistants.
2. **Check learning:** quizzes, marking help, WAEC and NECO revision, and explanations in local languages.
3. **Honest use:** cheating rules, a school AI policy, and protecting children's data.

## The teacher stays in charge

AI can draft a lesson plan in a minute. But it doesn't know your pupils, your scheme of work, your school's resources, or that NEPA took the light this morning. You do. In this course, AI is your **assistant**, never your replacement. You check everything before it reaches a learner.

## Children's data needs extra care

Under Nigeria's **Data Protection Act 2023**, a child is anyone under 18, and organisations generally need a **parent's or guardian's consent** to process a child's personal data, with a duty to take reasonable steps to verify it. So the rule for this course is simple: **never put learners' names, photos, results, health information or other personal details into a public AI tool.**

## Try this today

1. Write down **three teaching tasks** that take most of your time (for example, lesson notes, setting questions, marking).
2. Write down **one worry** you have about students using AI.
3. Keep both lists. By the end of the course you'll have a plan for each.`,
  },
  {
    id: "te-02-vision", moduleId: "teplan", kind: "youtube", minutes: 22, title: "The big picture: AI tutors and teaching assistants",
    youtubeId: "hJP5GqnTrNo",
    videoCredit: { title: "How AI Could Save (Not Destroy) Education | Sal Khan | TED", name: "TED", url: "https://www.youtube.com/@TED" },
    body: `Many teachers first heard about AI in schools as a cheating problem. It's worth hearing the hopeful side too.

In this talk, shared on YouTube by TED, **Sal Khan**, the founder of Khan Academy, argues that AI could give every student a personal tutor and every teacher a teaching assistant. He describes how a well-designed AI tutor can guide a student towards the answer with questions, instead of simply handing it over, and he demonstrates Khan Academy's AI tool, Khanmigo.

## What this could mean for us

Think about a typical Nigerian classroom: one teacher, a large class, learners at very different levels, and little time for one-to-one help. A good AI tutor could, in principle:

- explain a topic again, patiently, for the learner who didn't understand the first time
- give extra practice to a learner who's racing ahead
- help a teacher prepare differentiated work for different groups

## Keep your feet on the ground

There are real limits in our context:

- **Access:** many learners don't have their own phone, data or power at home.
- **Accuracy:** AI tutors can still make mistakes, especially with local syllabuses and examples.
- **Design:** a general chatbot gives answers; a good tutor asks questions. Most free tools are general chatbots.
- **Safety:** children need protection online, and their data needs care.

So we use AI where it genuinely helps, and we keep good teaching at the centre.

## Try this today

1. Watch the talk above.
2. Write down **one idea** from it you'd like to try, and **one concern** you have for your own school.
3. Ask an AI assistant: *"Act as a tutor. Don't give me the answer. Help me solve 3x + 7 = 22 by asking me questions one at a time."* Notice how it feels to be guided rather than told.

**Privacy check:** when you try AI tutors yourself or with students, use made-up examples, never real learners' details.`,
  },
  {
    id: "te-03-lesson-plans", moduleId: "teplan", kind: "text", minutes: 10, title: "Lesson plans with local examples",
    body: `Writing lesson notes and plans takes hours every week. AI can produce a solid first draft in minutes, so you can spend your energy on the parts only you can do: knowing your learners and teaching them.

## A strong lesson-plan prompt

Give the AI the details a good colleague would need:

> *"I teach Basic Science to JSS2 in a public school in Kaduna. Class size: 65. No projector, and power is unreliable. Topic: 'Separation of mixtures' from our scheme of work. Lesson length: 40 minutes. Write a lesson plan with: objectives, a 5-minute starter, main activities using cheap local materials, a group activity, three check-for-understanding questions, and homework. Use examples from Nigerian homes and markets."*

The details about class size, resources and location make the plan realistic. You might get activities like separating sand and garri with water, or winnowing beans, things your pupils have seen at home.

## Check it against your scheme of work

AI doesn't reliably know the current Nigerian curriculum or your state's scheme of work. **Compare the plan with your official scheme** and textbook. Remove anything off-syllabus, fix any wrong facts, and adjust the level.

## Differentiate

> *"Give me three versions of the homework: one for learners who are struggling, one for most of the class, and one challenge question for the fastest learners."*

## Teaching without power or devices

AI can also help you plan for low-resource lessons:

> *"Suggest five ways to teach fractions to Primary 4 using only chalk, a blackboard, bottle tops and paper."*

## Share and teach beyond your classroom

Good lesson materials deserve a wider audience. On #NotesApp, teachers can publish courses on **Notes Academy** (free or paid, with quizzes and certificates), and write journals sharing teaching ideas. **Nana AI** can help you polish your writing.

**Privacy check:** describe your class in general terms ("65 learners, mixed ability"). Never paste learners' names, photos, results or special needs details into a public AI tool.

## Try this today

1. Choose a lesson you'll teach this week.
2. Write a detailed prompt with class, topic, resources, time and location.
3. Ask an AI assistant for a lesson plan, then **check it against your scheme of work** and correct it.
4. Teach the lesson and write one sentence about what worked.`,
  },
  {
    id: "te-04-assistant", moduleId: "teplan", kind: "youtube", minutes: 10, title: "AI teaching assistants: what they can do",
    youtubeId: "Elnfgd7OzoM",
    videoCredit: { title: "Introducing Khanmigo for teachers", name: "Khan Academy", url: "https://www.youtube.com/@khanacademy" },
    body: `Beyond general chatbots, some tools are designed specifically for teachers.

In this video, Khan Academy introduces the features of **Khanmigo for teachers** and explains how it aims to save teachers time, for example with lesson planning and preparing activities. Availability and pricing of such tools vary by country and change over time, so check what's available where you are. Even if you can't use Khanmigo itself, the video shows the kinds of tasks an AI teaching assistant can take on, and you can do many of them with a general assistant like ChatGPT, Claude, Gemini or Copilot.

## Tasks you can hand to an AI assistant

- **Rubrics:** *"Create a marking rubric for an SS1 English essay on 'The importance of reading', with four levels and clear descriptions."*
- **Exit tickets:** *"Write three quick questions to check understanding at the end of a lesson on photosynthesis."*
- **Reading passages:** *"Write a 250-word reading passage for Primary 5 about a market day in Ibadan, followed by five comprehension questions."*
- **Parent letters:** *"Write a short, friendly letter to parents about our inter-house sports day, with the date and what learners should bring."*
- **Explanations at different levels:** *"Explain gravity for Primary 3, then for JSS3, then for SS2."*

## Tasks to keep for yourself

- Final grades and reports.
- Conversations about a learner's behaviour, wellbeing or family situation.
- Decisions about promotion, discipline or special needs support.
- Anything involving a child's safety.

## Check everything

AI can make factual mistakes, especially in science, maths and history. Read every question and answer before it reaches learners. **Work the maths problems yourself.**

**Privacy check:** don't upload class lists, report cards or learners' work with names on it. If you want help with feedback, remove names first and use "Learner A".

## Try this today

1. Watch the video above.
2. Choose **two tasks** from the list and do them with an AI assistant.
3. Check the results carefully and correct any mistakes.
4. Use one of them in class this week.`,
  },
  {
    id: "te-05-quizzes", moduleId: "techeck", kind: "text", minutes: 11, title: "Quizzes and marking help",
    body: `Setting good questions and marking scripts are two of the most time-consuming parts of teaching. AI can help with both, as long as you stay the examiner.

## Setting quizzes

> *"Write 10 multiple-choice questions on 'Parts of speech' for JSS1 English. Four options each, one correct answer, and a one-sentence explanation of why it's correct. Mix easy, medium and hard."*

Then:

1. **Check every answer.** AI sometimes marks the wrong option as correct.
2. **Check the level.** Remove questions that are off-syllabus or too hard.
3. **Make it local.** Change "Tom went to the mall" to "Tunde went to Oshodi market".

You can also ask for **short-answer** and **essay** questions, and for **marking schemes** with model answers.

## Marking help

AI can help you mark faster without handing over your judgement:

- **Use a rubric:** paste your rubric and one anonymous answer, and ask: *"Using this rubric, suggest a score and two pieces of feedback. Explain your reasoning."* Then decide the mark yourself.
- **Common mistakes:** after marking, type a summary of the errors you saw and ask: *"Suggest a 10-minute revision activity to fix these common mistakes."*
- **Feedback comments:** *"Write five encouraging feedback comments for a learner whose essay has good ideas but poor paragraphing."*

**Never let AI give final marks on its own.** It can be inconsistent and unfair, especially with local expressions, handwriting it can't read, or creative answers.

## Quizzes on Notes Academy

If you teach online, **Notes Academy** on #NotesApp lets you add **quiz lessons** with multiple-choice questions, explanations and a pass mark. The quiz is marked automatically, and learners who finish a course can get a certificate anyone can check. AI can help you draft the questions; you check them before publishing.

**Privacy check:** remove names, admission numbers and anything identifying from scripts before using AI. Never upload photos of scripts with learners' names visible.

## Try this today

1. Ask an AI assistant for **ten quiz questions** with explanations on a topic you're teaching.
2. Check every answer and change at least three questions to use local examples.
3. Give the quiz to your class and note which questions they found hardest.`,
  },
  {
    id: "te-06-waec", moduleId: "techeck", kind: "text", minutes: 10, title: "WAEC and NECO revision with AI",
    body: `For many students, WAEC and NECO feel like the most important exams of their lives. AI can be a brilliant revision partner, or a trap that fills your head with wrong answers. This lesson is for students and teachers.

## Start with real past questions

The best revision uses **real exam-style questions**. On #NotesApp, **Naija Exam Prep** gives free practice questions for JAMB, WAEC and NECO with explanations, timed mocks, and packs that work offline. Use it as your base.

Then use AI to go deeper on what you get wrong.

## Good ways to use AI for revision

- **Explain a mistake:** *"I chose B for this Chemistry question, but the answer is D. Explain why D is right and why B is wrong, step by step."*
- **Teach a topic again:** *"Explain 'demand and supply' for WAEC Economics, with a Nigerian market example. Then give me three practice questions."*
- **Make a timetable:** *"WAEC starts in eight weeks. I'm taking these nine subjects. My weakest are Physics and Further Maths. Make me a realistic revision timetable with breaks."*
- **Test yourself:** *"Ask me ten questions on the Nigerian constitution for Civic Education, one at a time. Tell me if I'm right after each."*
- **Essay practice:** *"Here's my English essay. Using the WAEC style of marking content, organisation, expression and mechanics, tell me what to improve."*

## Watch out

- **AI can be wrong**, especially with calculations, chemistry equations and specific syllabus details. If an explanation doesn't match your textbook, trust the textbook and ask your teacher.
- **Don't memorise AI answers.** Understand them.
- **Exam rules:** using any phone, AI tool or outside help during WAEC, NECO or school exams is examination malpractice, with serious consequences, including cancelled results. AI is for preparation only.

## For teachers

Ask AI to help you plan revision lessons for the topics your class finds hardest, and to create extra practice in the style of past questions. Always check answers before sharing them.

**Privacy check:** students, don't share your exam number, full name or school details with AI tools. You don't need them to revise.

## Try this today

1. Do one **timed practice set** on Naija Exam Prep for your weakest subject.
2. Pick the **two questions you got wrong** and ask an AI assistant to explain them step by step.
3. Check its explanations against your textbook.
4. Ask AI to make you a **revision timetable** for the weeks before your exams.`,
  },
  {
    id: "te-07-languages", moduleId: "techeck", kind: "text", minutes: 9, title: "Explaining in local languages",
    body: `Many learners understand a concept faster when it's explained in the language they speak at home. Teachers already do this, switching to Yoruba, Igbo, Hausa or Pidgin to make a point land. AI can help you prepare explanations in local languages, with some important cautions.

## What you can try

- *"Explain photosynthesis in simple Hausa for a Primary 6 class."*
- *"Give a short explanation of 'fractions' in Nigerian Pidgin, with an example of sharing akara."*
- *"Translate these five science key words into Igbo, and explain each in one sentence."*
- *"Write a short story in Yoruba that teaches the water cycle."*

## How good is it?

AI tools are usually much stronger in English than in Nigerian languages. Results in Yoruba, Igbo, Hausa and Pidgin can be very useful, but they can also contain wrong words, odd grammar, or missing tone marks. There's growing work on African languages: for example, in September 2025 Nigeria launched **N-ATLAS**, an open-source language model for Yoruba, Hausa, Igbo and Nigerian-accented English, developed by the National Centre for Artificial Intelligence and Robotics with Awarri Technologies, mainly for developers and researchers to build on.

So:

1. **Always check with a fluent speaker** (a colleague, a parent, yourself) before using a local-language explanation in class.
2. **Keep key terms in English too**, because exams are in English.
3. **Use local language to build understanding**, then practise the English exam wording.

## Respect every learner

In a mixed class, not everyone speaks the same home language. Use local-language explanations to help, not to exclude. Pair learners so that those who share a language can support each other.

**Privacy check:** local-language voice notes and recordings of learners are personal data. Don't upload recordings of children's voices to AI tools.

## Try this today

1. Choose one concept your learners struggle with.
2. Ask an AI assistant to explain it in the local language most of your class speaks.
3. Ask a fluent colleague to check it and correct it.
4. Use the corrected version in class, followed by the English key terms.`,
  },
  {
    id: "te-08-honest", moduleId: "tehonest", kind: "youtube", minutes: 12, title: "Honest use: learning, not cheating",
    youtubeId: "4jN0ASk959Y",
    videoCredit: { title: "Decoding Generative Artificial Intelligence with Media and Information Literacy", name: "UNESCO", url: "https://www.youtube.com/@UNESCO" },
    body: `Students are using AI to do homework. Some use it to learn; some use it to copy. Banning it completely rarely works, because it's on every phone. Clear, fair rules and assignments that reward thinking work better.

In this video, UNESCO explains how media and information literacy can help people understand and use generative AI critically: asking where information comes from, checking it, and thinking about how it's made. These are exactly the habits we want our students to build.

## What UNESCO recommends

In September 2023, UNESCO published global **Guidance for Generative AI in Education and Research**. Among other things, it suggested that countries consider a **minimum age of 13** for using generative AI tools in the classroom, together with data-protection measures and teacher training. It also noted that many commentators think 13 is too young.

## A simple traffic-light rule for students

- **Green (allowed):** asking AI to explain a topic, quiz you, check your grammar, or suggest how to improve your own work.
- **Amber (ask your teacher):** using AI to help plan an essay or brainstorm ideas. Say that you used it.
- **Red (cheating):** submitting AI-written work as your own, using AI in a test or exam, or making up sources.

## Assignments that reward thinking

Teachers can make cheating less useful:

- Ask for **personal and local** responses: *"Interview an elderly person in your street about how markets have changed."*
- Ask learners to **show their working** and drafts.
- Use **short in-class writing** and oral questions.
- Ask learners to **critique an AI answer**: *"Here's what an AI wrote about the Nigerian civil war. Find two errors and one missing perspective."*

## Talk about it

Students respond better to honesty than to fear. Explain why: exams test *them*, employers will expect *their* skills, and copying robs them of learning.

**Privacy check:** don't paste students' essays with their names into "AI detectors" or any public tool. Detectors are also unreliable, and can wrongly accuse honest students, so never punish a learner on a detector score alone.

## Try this today

1. Watch the video above.
2. Write a **traffic-light rule** for AI use in your class or for your own studies.
3. Teachers: redesign **one assignment** so that copying from AI wouldn't help. Students: use AI in a "green" way for one piece of homework, and tell your teacher how you used it.`,
  },
  {
    id: "te-09-policy", moduleId: "tehonest", kind: "text", minutes: 9, title: "A school AI policy and children's data",
    body: `Every school needs a short, clear AI policy, so teachers, learners and parents know what's allowed. It doesn't have to be long. A one- or two-page policy that people actually read is better than a thick document no one opens.

## What a school AI policy should cover

1. **Purpose:** why the school allows AI (to support learning and save teachers' time) and what it wants to avoid (cheating, harm, misuse of data).
2. **Students:** what's green, amber and red, by age group. Remember UNESCO's suggestion to consider a minimum age of 13 for classroom generative AI.
3. **Teachers:** what they may use AI for (planning, question setting, feedback drafts) and what they must not (final grades on their own, sharing learners' data).
4. **Exams:** no AI or devices in tests and exams, in line with WAEC, NECO and school rules.
5. **Data protection:** no learners' names, photos, results, health or family information in public AI tools.
6. **Honesty:** how learners should say when they've used AI.
7. **What happens if rules are broken:** fair, proportionate, with a chance to explain.
8. **Review:** the date the policy will be reviewed, because AI changes fast.

Ask an AI assistant to draft it: *"Draft a two-page AI policy for a Nigerian secondary school covering these eight points, in plain English for parents and students."* Then discuss it with staff and parents and adapt it.

## Children's data and the law

Under Nigeria's **Data Protection Act 2023**, a child is anyone under 18. For most processing of a child's personal data, organisations need the **consent of a parent or legal guardian** and must take reasonable steps to verify the child's age and that consent. Schools hold a lot of children's data: names, photos, results, medical notes, family details. So:

- Only use school-approved tools for learners' data.
- Ask parents before learners sign up to any AI tool that needs an account.
- Keep records secure: locked phones, strong passwords, no class lists in personal chats.

The **Nigeria Data Protection Commission (ndpc.gov.ng)** supervises the Act. Larger schools may need professional advice on their duties.

## Bring parents along

Hold a short parents' meeting or send a letter explaining the policy. Many parents are curious and worried about AI. A school that explains its approach earns trust. A **Community** on #NotesApp, with **Spaces** for each class or year group and **events** for meetings, gives the school one place for announcements and parents' questions.

## Try this today

1. Ask an AI assistant to draft a **school AI policy** using the eight points above.
2. Edit it for your school and share it with two colleagues for comments.
3. List every place your school stores learners' data, and check that none of it goes into public AI tools.
4. Take the quiz that follows and claim your certificate.`,
  },
  {
    id: "te-10-quiz", moduleId: "tehonest", kind: "quiz", minutes: 6, title: "Check what you've learnt",
    quiz: {
      passPercent: 70,
      questions: [
        { id: "teq1", prompt: "AI gives you a lesson plan. What should you do before teaching it?", options: ["Teach it exactly as written", "Check it against your scheme of work and correct any errors", "Give it to a student to check", "Nothing: AI knows the Nigerian curriculum perfectly"], answer: 1, explain: "AI doesn't reliably know your scheme of work, your class or your resources. Check and adapt everything." },
        { id: "teq2", prompt: "Which of these is safe to put into a public AI tool?", options: ["A class list with learners' names and results", "A photo of a learner's script with their name on it", "\"A class of 65 JSS2 learners with mixed ability\"", "A learner's medical notes"], answer: 2, explain: "Describe your class in general terms. Learners' names, results, photos and health details must stay out." },
        { id: "teq3", prompt: "Under Nigeria's Data Protection Act 2023, who is a child?", options: ["Anyone under 12", "Anyone under 18", "Anyone in primary school only", "The Act doesn't mention children"], answer: 1, explain: "The NDPA treats anyone under 18 as a child, and generally requires a parent's or guardian's consent to process their data." },
        { id: "teq4", prompt: "A student uses AI during a WAEC paper. What is this?", options: ["Smart revision", "Examination malpractice", "Allowed if the answer is correct", "Allowed for Mathematics only"], answer: 1, explain: "Using phones, AI or outside help in an exam is malpractice. AI is for preparation only." },
        { id: "teq5", prompt: "What minimum age did UNESCO's 2023 guidance suggest countries consider for generative AI in the classroom?", options: ["5", "10", "13", "21"], answer: 2, explain: "UNESCO suggested considering a minimum age of 13, while noting many think that's too young." },
        { id: "teq6", prompt: "AI gives a final score for an essay. What should the teacher do?", options: ["Record it as the final mark", "Use it as a suggestion and decide the mark themselves", "Average it with a random number", "Ask the student to accept it"], answer: 1, explain: "AI can be inconsistent and unfair. The teacher stays the examiner." },
        { id: "teq7", prompt: "An AI detector says a student's essay is \"90% AI\". What's the fairest response?", options: ["Punish the student immediately", "Treat it as unreliable, talk to the student and look at drafts and other evidence", "Fail the whole class", "Post the result publicly"], answer: 1, explain: "Detectors are unreliable and can wrongly accuse honest students. Never punish on a detector score alone." },
        { id: "teq8", prompt: "AI explains a topic in Hausa for your class. What should you do first?", options: ["Use it straight away", "Ask a fluent speaker to check it, and keep the English key terms", "Translate it back to English with AI", "Never use local languages"], answer: 1, explain: "AI is usually weaker in Nigerian languages. A fluent speaker should check it, and exams use English terms." },
      ],
    },
  },
];

export const AI_TEACHERS: AiSeedCourse = {
  key: "ai-teachers-schools-students",
  ownerUsername: "lwb", byline: "Emmanuel Adams",
  slug: "ai-for-teachers-schools-and-students",
  title: "AI for Teachers, Schools and Students",
  cover: "/images/academy/covers/ai-for-teachers-schools-and-students.webp",
  summary: `Use AI to teach better and learn honestly.

A practical course for teachers, school leaders, lesson teachers and students in Nigeria and across Africa. You'll use AI to draft lesson plans with local examples, prepare quizzes and marking rubrics, get help with feedback, revise for WAEC and NECO alongside Naija Exam Prep, and explain ideas in Yoruba, Igbo, Hausa or Pidgin. You'll also set fair rules on cheating, write a simple school AI policy, and protect children's data under Nigeria's Data Protection Act 2023.

Short lessons, "Try this today" exercises and a final quiz. Written by Emmanuel Adams for LWB academy.`,
  topics: ["education", "ai"],
  subtopics: [{ parent: "education", label: "Lesson Planning" }, { parent: "education", label: "WAEC Revision" }, { parent: "ai", label: "AI in Education" }],
  level: "beginner", language: "English", format: "self",
  outcomes: [
    "Draft realistic lesson plans with local examples and check them",
    "Use AI teaching assistants for rubrics, passages and exit tickets",
    "Set quizzes with AI help and keep marking decisions yourself",
    "Revise for WAEC and NECO with Naija Exam Prep and an AI explainer",
    "Prepare local-language explanations and have them checked",
    "Set clear green, amber and red rules for AI use",
    "Design assignments that reward thinking over copying",
    "Write a school AI policy",
    "Protect children's data under the NDPA 2023",
  ],
  requirements: [
    "No experience needed",
    "A smartphone, tablet or computer with internet",
    "Your scheme of work or syllabus, if you teach",
  ],
  modules: [
    { id: "teplan", title: "Plan and teach" },
    { id: "techeck", title: "Check learning" },
    { id: "tehonest", title: "Honest use and safe data" },
  ],
  lessons: LESSONS,
};
