// Course 1 of lib/course-seeds-ai.ts: AI for Everyday Africans. Videos checked with YouTube oEmbed on 1 November 2026.
import type { SeedCourse, SeedLesson } from "../course-seeds";

const LESSONS: SeedLesson[] = [
  {
    id: "ev-01-welcome", moduleId: "evmeet", kind: "text", minutes: 8, title: "Welcome: what AI is, in plain words",
    body: `Welcome. My name is Emmanuel Adams, and I'm part of the team at LWB academy. I wrote this course for everyone: the trader in Balogun market, the nurse on night shift, the student preparing for WAEC, the retired teacher in Enugu, and the young person in Kano who keeps hearing "AI, AI, AI" and wonders what all the noise is about.

You don't need to be "a tech person" to use AI well. You need common sense, a little practice and a few safety rules. That's what this course gives you.

## So what is AI?

**Artificial intelligence (AI)** is a name for computer programs that do things we used to think only people could do: recognise a face, understand a sentence, translate a language, suggest the next word, or spot a pattern in a lot of numbers.

You already use AI, probably every day:

- Your phone's keyboard suggests the next word as you type.
- Your bank's app flags a strange transfer as possible fraud.
- Google Maps tells you which road has less go-slow.
- Your photo gallery groups pictures of the same person together.

## The new kind: AI assistants you can chat with

Since about 2022, a newer kind of AI has become popular: **AI assistants** (also called chatbots) that you can type or talk to in normal language. Well-known ones include **ChatGPT** (by OpenAI), **Claude** (by Anthropic), **Gemini** (by Google) and **Copilot** (by Microsoft). On #NotesApp, **Nana AI** helps you with writing and finding your way around the platform.

You can ask them to explain a topic, draft a letter, summarise a long document, or give you ideas. They are fast and patient, and they never get tired of your questions.

## What AI is not

- **It is not a person.** It doesn't know you, love you or care about you, even when it sounds friendly.
- **It is not always right.** It can state wrong things with full confidence. We'll see why in the next lesson.
- **It is not a doctor, lawyer, pastor, imam or financial adviser.** It can help you prepare questions for them, but not replace them.

## How this course works

There are three short modules:

1. **Meet AI:** what it is and how the assistants work.
2. **Use AI well:** writing, learning, money and health questions.
3. **Stay safe:** scams, deepfakes and your privacy under Nigeria's Data Protection Act 2023.

Each lesson ends with **Try this today**, a small exercise. A short quiz at the end checks what you've learnt. Some lessons include a YouTube video by the person or organisation who made it, and I always say who that is.

**Privacy check:** throughout this course, one rule comes first: **never type anything into an AI tool that you wouldn't be happy for a stranger to read.** No BVN, no PINs, no passwords, no ID numbers.

## Try this today

1. Write down three places where you think you already meet AI (your phone, your bank, social media, a shop).
2. If you have a smartphone, open one AI assistant (ChatGPT, Gemini, Copilot, Claude, or Nana AI on #NotesApp) and type: *"Explain what you are in three simple sentences, as if I'm 12 years old."*
3. Read the answer. Did it make sense? Write one thing you found interesting and one thing you're still unsure about.`,
  },
  {
    id: "ev-02-how-it-works", moduleId: "evmeet", kind: "youtube", minutes: 14, title: "How AI assistants work, and why they sometimes make things up",
    youtubeId: "5sLYAQS9sWQ",
    videoCredit: { title: "How Large Language Models Work", name: "IBM Technology", url: "https://www.youtube.com/@IBMTechnology" },
    body: `AI assistants like ChatGPT, Claude, Gemini and Copilot are built on something called a **large language model**, or LLM. Understanding the basic idea helps you use them wisely.

## The idea in one paragraph

In this video, IBM Technology explains how large language models work. In simple terms, a model is trained on a very large amount of text, and it learns the patterns of language: which words tend to follow which, how questions are usually answered, how a letter is usually laid out. When you ask it something, it produces an answer word by word, choosing what is most likely to come next.

Think of a market woman who has sold tomatoes for thirty years. She can guess the price you'll accept before you open your mouth, because she has seen thousands of customers. She is usually right. But sometimes she guesses wrong, and she still sounds sure of herself.

## Why they make things up

Because an AI assistant predicts likely words, it can produce sentences that **sound right but are false**. People call these **"hallucinations"**. It might:

- invent a book, a law or a court case that doesn't exist
- give a wrong date, figure or phone number
- mix up two people with similar names
- give out-of-date information, because its training stopped at a certain time

This doesn't make AI useless. It means **you are the editor**. AI drafts; you check.

## A simple checking habit

Whenever an answer matters, ask yourself three questions:

1. **Can I check this somewhere else?** A government website, a known newspaper, a textbook, a professional.
2. **Does it give sources?** If it does, open them. If they don't exist or don't say what the AI claims, don't trust the answer.
3. **Does it sound too neat?** Real life is often messier than a confident AI paragraph.

You can also ask the assistant: *"How sure are you? What could be wrong in this answer?"* Many will point out their own weak spots.

**Privacy check:** what you type may be stored by the company that runs the tool, and some use conversations to improve their systems unless you switch that off in settings. Look for the privacy or "data controls" settings in whichever assistant you use.

## Try this today

1. Watch the video above.
2. Ask an AI assistant a question you already know the answer to, about your town, your church or mosque, or your secondary school.
3. Check its answer carefully. Did it get anything wrong or invent anything? Write down what you noticed.
4. Then ask: *"What parts of your answer might be wrong?"* and compare.`,
  },
  {
    id: "ev-03-writing", moduleId: "evuse", kind: "text", minutes: 9, title: "Writing letters, messages and CVs with AI",
    body: `One of the most useful things an AI assistant can do for everyday people is **help with writing**. A formal letter to your landlord, a complaint to your bank, a polite message to your child's school, a CV for a new job: these can take hours to get right. With AI, you can get a good first draft in minutes.

## The four-part request

The quality of the answer depends on the quality of your request (people call this a **prompt**). A good prompt has four parts:

1. **Who you are:** "I'm a tenant in Ibadan."
2. **What you want:** "Write a polite letter to my landlord."
3. **The details:** "The roof has been leaking for three weeks. I reported it on 2 September. I want it fixed before the rains get heavy."
4. **The style:** "Keep it short, respectful and firm. Use simple British English."

A weak prompt: *"Write letter to landlord."*
A strong prompt: all four parts together.

## Improve it together

Don't accept the first answer. Ask for changes, as you would with a helpful friend:

- "Make it shorter."
- "Make it sound less angry."
- "Add a line asking for a reply within seven days."
- "Translate it into Yoruba" (and then ask a fluent speaker to check it).

On #NotesApp, **Nana AI** can help you tidy and improve your writing in the same way, for example a journal post or a description for your store.

## CVs and job applications

AI can help you turn a messy list of experience into clear bullet points. Paste your **job titles and duties**, not your personal details, and ask: *"Turn these into five strong CV bullet points for a customer service role."* Then add your name and contact details yourself, at the end.

Be honest. Never let AI add qualifications, jobs or skills you don't have. Employers check, and a false CV can cost you the job later.

## Make it sound like you

AI writing can sound stiff or too "American". Read it out loud. Change words you would never use. Add a local touch. The goal is **your message, written better**, not a stranger's message with your name on it.

**Privacy check:** don't paste your full address, phone number, BVN, NIN, account numbers or other people's private details into a public AI tool. Write "[my address]" and fill it in yourself afterwards.

## Try this today

1. Think of one message you've been putting off: a complaint, a request, a thank-you letter or an application.
2. Write a four-part prompt (who, what, details, style) and give it to an AI assistant.
3. Ask for **two** improvements.
4. Edit the final version by hand so it sounds like you, using placeholders for any personal details. Then send it.`,
  },
  {
    id: "ev-04-learning", moduleId: "evuse", kind: "text", minutes: 10, title: "Learning anything with an AI tutor",
    body: `Imagine having a patient teacher who will explain a topic ten different ways, at midnight, without getting tired or making you feel foolish. Used well, an AI assistant can be that teacher. Used badly, it can make you lazy and fill your head with mistakes. This lesson shows the good way.

## Ask it to teach, not just to answer

Instead of asking for the answer, ask it to help you understand:

- *"Explain how interest on a loan works, using an example in naira. Then ask me two questions to check I understood."*
- *"I'm learning basic Excel. Teach me one thing at a time and wait for me to say 'next'."*
- *"Explain photosynthesis like you're talking to a JSS2 student, with an example from a farm in Benue."*

The phrase **"ask me questions to check I understood"** is powerful. It turns reading into practice.

## Use your own language

Many AI assistants can explain things in Nigerian Pidgin, Yoruba, Igbo, Hausa and other languages, with mixed quality. Try: *"Explain this in simple Pidgin."* If the result sounds strange, switch back to English, and remember that AI is usually strongest in English.

## Learn from real sources too

AI is a helper, not a library. Pair it with trusted places to learn:

- **Notes Academy** on #NotesApp, where real teachers publish courses (like this one) with certificates anyone can check.
- **Naija Exam Prep** on #NotesApp for JAMB, WAEC and NECO practice questions with explanations.
- Your textbooks, your teachers, and official websites.

A good routine: learn the topic from a course or book, then use AI to **quiz you** and **explain what you didn't understand**.

## Don't outsource your brain

If AI does all the thinking, you don't learn. Some simple rules:

- Try first, then ask AI to check your work.
- Ask "why?" until you can explain it yourself.
- Close the chat and write a summary from memory.

**Privacy check:** if you're learning about a sensitive personal topic (a health condition, a debt, a family problem), keep the question general. Say "a 40-year-old woman" rather than your name and your town.

## Try this today

1. Choose one thing you've always wanted to understand better: budgeting, a school subject, a computer skill, or how something works.
2. Ask an AI assistant: *"Teach me [topic] in five short steps. After each step, ask me one question and wait for my answer."*
3. Answer its questions honestly.
4. At the end, close the chat and write three sentences in your own words about what you learnt.`,
  },
  {
    id: "ev-05-money-health", moduleId: "evuse", kind: "text", minutes: 10, title: "Money and health questions: helpful, but not the final word",
    body: `Two of the most common things people ask AI about are **money** and **health**. AI can be genuinely helpful here, but these are also the areas where a wrong answer can hurt you most. This lesson shows where the line is.

## Money: good uses

- **Making a budget.** *"Help me make a monthly budget. My income is ₦180,000. My rent is ₦40,000 a month, transport about ₦30,000, food ₦60,000. I want to save something every month."* (Notice: real numbers, no account details.)
- **Understanding terms.** *"Explain the difference between a savings account, a fixed deposit and a money market fund, in simple words."*
- **Comparing options.** *"What questions should I ask before taking a loan from a lending app?"*
- **Spotting red flags.** *"Someone promised 30% profit a month on my money. What are the warning signs of a Ponzi scheme?"*

## Money: where to stop

- AI doesn't know today's interest rates, exchange rates or prices unless it searches the web, and even then it can be wrong. **Check figures with your bank or an official source.**
- AI must never decide where you put your savings. **Never invest because a chatbot said so.**
- Never type your **BVN, card number, PIN, OTP or online banking password** into any AI tool. No genuine bank or AI service will ever ask for them in a chat.

## Health: good uses

- **Understanding a word on your results.** *"What does 'HbA1c' mean, in simple terms?"*
- **Preparing for a hospital visit.** *"I've had headaches for two weeks. What questions should I ask my doctor?"*
- **Healthy habits.** *"Suggest a simple weekly meal plan with Nigerian foods for someone trying to reduce sugar."*

## Health: where to stop

- **AI is not a diagnosis.** It cannot examine you, test your blood or see your history. Two people with the same symptom can have very different illnesses.
- **Don't start, stop or change medicine** because of an AI answer. Speak to a doctor or pharmacist.
- **Emergencies:** chest pain, difficulty breathing, heavy bleeding, a seizure or thoughts of ending your life need help **now**. In Nigeria, call **112** (the free national emergency number) or go to the nearest hospital.

## The "second opinion" rule

For any money or health decision that matters, treat AI as a **first step**. Use it to understand the topic and prepare good questions. Then take those questions to a real professional: a doctor, a pharmacist, your bank, or a registered financial adviser.

**Privacy check:** health and financial information are some of your most sensitive data. Under Nigeria's Data Protection Act 2023, health data is a special, "sensitive" category. Keep your questions general and leave out names, ID numbers and account details.

## Try this today

1. Write your real monthly income and your five biggest costs on paper.
2. Ask an AI assistant to help you make a simple budget from those numbers, with nothing personal beyond the amounts.
3. Then write down **two health questions** you've been meaning to ask a doctor. Ask an AI assistant to help you turn them into clear questions, and take them to your next appointment.`,
  },
  {
    id: "ev-06-scams", moduleId: "evsafe", kind: "youtube", minutes: 10, title: "AI scams and voice cloning: how to protect your family",
    youtubeId: "E_jP1R6aiUU",
    videoCredit: { title: "Safe Phrases: Stay safe against AI voice cloning", name: "Starling", url: "https://www.youtube.com/@StarlingBankApp" },
    body: `Scammers have always been creative. Now they have AI too. They can write perfect messages without spelling mistakes, make fake "customer care" chats, and even **copy someone's voice**.

## Voice cloning

In this video, Starling, a UK bank, explains how criminals can clone a person's voice from a short recording and use it to call that person's family asking for money. Their simple answer is a **safe phrase**: a secret word or sentence that only your family knows, which you ask for whenever a call sounds urgent and strange.

Picture it: your phone rings. It sounds exactly like your son: *"Mummy, I've been arrested in Abuja. Please send ₦250,000 to this account now, don't tell Daddy."* Panic makes people pay. A safe phrase gives you a calm way to check.

## Other AI-powered scams to watch for

- **Fake customer care.** You complain about your bank on social media, and a "support agent" messages you within minutes asking for your details. Banks don't do this.
- **Fake celebrity or pastor videos.** A well-known person "promotes" an investment, a giveaway or a miracle product. The video is AI-made.
- **Perfect phishing messages.** Emails and SMS that look exactly like your bank, a delivery company or a government agency, with a link to "verify" your account.
- **Fake jobs.** "Earn ₦50,000 a day liking videos" or "pay ₦10,000 for your training kit". If you must pay to get a job, it's usually a scam.
- **Romance scams.** A charming stranger online, with beautiful AI-made photos, who eventually needs money.

## Five rules that beat most scams

1. **Slow down.** Urgency is the scammer's best tool. Real emergencies can wait five minutes for you to check.
2. **Call back on a number you already know.** Not the number that called you, and not one in the message.
3. **Use your family safe phrase.** Agree it face to face, not by text.
4. **Never share OTPs, PINs, passwords or your BVN.** Nobody genuine needs them.
5. **If money is lost, act fast.** Call your bank immediately using the number on your card or their official website, and report it to the police.

**Privacy check:** scammers clone voices and faces from what we post publicly. Think twice before posting long voice notes or videos of children on open social media, and set your accounts to private where you can.

## Try this today

1. Watch the video above.
2. Choose a **safe phrase** with your closest family members. Agree it in person or on a voice call, and don't write it in a group chat.
3. Save your bank's real customer care number in your phone, from the back of your card or the bank's official website.
4. Tell one older relative about voice-cloning scams this week.`,
  },
  {
    id: "ev-07-deepfakes", moduleId: "evsafe", kind: "youtube", minutes: 20, title: "Spotting deepfakes and fake photos",
    youtubeId: "q5_PrTvNypY",
    videoCredit: { title: "How to Spot Fake AI Photos | Hany Farid | TED", name: "TED", url: "https://www.youtube.com/@TED" },
    body: `A **deepfake** is a photo, video or audio clip made or changed by AI to show someone saying or doing something they never did. Some are jokes. Many are used to spread lies, damage reputations, influence elections or steal money.

## Expert eyes

In this video, TED shares a talk by digital forensics expert **Hany Farid**, who studies how to tell whether an image is real. He explains how experts look for small clues that AI gets wrong, and why being careful before we share matters as much as any detection tool.

You won't become a forensics expert in one lesson. But you can learn habits that stop you being fooled, and stop you passing fakes on to your family WhatsApp groups and timelines.

## Clues to look for (they're getting harder to see)

- **Hands, teeth and ears** that look strange: extra fingers, melted teeth, earrings that don't match.
- **Text in the image** that looks like nonsense, or shop signs with wrong spellings.
- **Lighting and shadows** that point in different directions.
- **Skin that is too smooth** or plastic-looking.
- In videos: **lips that don't match the words**, odd blinking, a voice that sounds flat or slightly "off".

Important: newer AI tools make fewer of these mistakes. **A picture with no visible errors can still be fake.** So clues alone are not enough.

## Better: check the story, not just the picture

1. **Who posted it first?** A known news organisation, an official account, or a random account created last month?
2. **Is anyone reliable reporting it?** If a governor really said something shocking, several reliable news outlets would be covering it.
3. **Search for it.** Use a reverse image search (for example Google Lens) to see where the picture first appeared.
4. **Check fact-checkers.** Organisations that check viral claims often cover the big fakes quickly.
5. **Ask: who benefits?** Fakes often appear before elections, during crises, or to sell something.

## The sharing rule

If you're not sure it's real, **don't forward it**. Forwarding a fake makes you part of the problem, even if you meant well. You can say: *"I'm not sure this is real, so I won't share it."*

**Privacy check:** deepfakes can be made from anyone's photos. Be careful about posting clear face photos of children publicly. If someone makes a fake image of you, keep evidence (screenshots and links), report it to the platform, and seek legal advice.

## Try this today

1. Watch the talk above.
2. Find one viral image or video that's going round your groups this week.
3. Do the five checks: who posted it first, is reliable news reporting it, reverse image search, fact-checkers, who benefits.
4. Write down your verdict: real, fake, or "not sure, so I won't share".`,
  },
  {
    id: "ev-08-privacy", moduleId: "evsafe", kind: "text", minutes: 12, title: "Your privacy and Nigeria's Data Protection Act 2023",
    body: `Every time you use an app, fill a form or chat with an AI assistant, you hand over **personal data**: your name, phone number, location, photos, voice, opinions, health or money details. In Nigeria, the law gives you real rights over that data.

This lesson is general information, not legal advice.

## The law in brief

The **Nigeria Data Protection Act 2023 (NDPA)** was signed into law by President Bola Ahmed Tinubu on **14 June 2023**. It created the **Nigeria Data Protection Commission (NDPC)**, which replaced the earlier Nigeria Data Protection Bureau, to supervise how organisations handle personal data. In March 2025, the NDPC issued the **NDPA General Application and Implementation Directive (GAID)**, which explains in more detail how organisations must apply the Act. You can find the Commission at **ndpc.gov.ng**.

## Your main rights

Under the NDPA, you generally have the right to:

- **Be told** what data an organisation holds about you, why, and for how long.
- **Get a copy** of your data.
- **Have it corrected** if it's wrong, or **erased** in certain cases.
- **Object** to how your data is being used.
- **Withdraw your consent** at any time, where consent was the basis for using it.
- **Not be subject to decisions made only by automated processing** (for example, by AI alone) that seriously affect you, in many situations.
- **Complain to the NDPC** if you think your rights have been broken.

The Act also says that **silence or inactivity is not consent**: a company can't treat you as agreeing just because you didn't say no.

## Sensitive data gets extra protection

Some data is treated as **sensitive**: your health, religious or philosophical beliefs, ethnic origin, political opinions, trade union membership, sex life or sexual orientation, genetic data, and biometric data (like fingerprints or face scans) used to identify you. Organisations need a stronger reason to use it.

When organisations have a data breach that's likely to put people's rights at risk, the Act requires them to notify the NDPC **within 72 hours** of becoming aware of it.

## What this means when you use AI

- **Read the settings.** Most AI assistants have privacy or "data controls". Some let you stop your chats being used to train their models, or delete your history.
- **Keep secrets out.** Never paste BVN, NIN, passwords, PINs, medical records or someone else's private information into a public AI tool.
- **Think about other people.** If you paste a friend's message or a customer's details into AI, you're sharing *their* data too.
- **Ask questions.** If a company uses AI to decide something about you (a loan, a job, an insurance claim), you can ask how the decision was made and whether a person reviewed it.

## Try this today

1. Open the settings of one AI assistant you use (or plan to use). Find its privacy or data settings. Write down what it does with your chats and whether you can switch off training or delete history.
2. Look through your last ten AI chats, if you have any. Did you share anything you shouldn't have? Delete those chats if the app allows it.
3. Visit **ndpc.gov.ng** and find out how to make a complaint, so you know where to go if you ever need it.`,
  },
  {
    id: "ev-09-plan", moduleId: "evsafe", kind: "text", minutes: 6, title: "Your personal AI plan",
    body: `You've come a long way. You know what AI is, how assistants work, how to use them for writing, learning, money and health questions, and how to stay safe from scams, deepfakes and privacy risks. Now let's turn that into a simple personal plan.

## The three-column plan

Draw three columns in your notebook:

| I will use AI for… | I will check with… | I will never… |
|---|---|---|
| Drafting letters and messages | Reading it myself before sending | Paste my BVN, PINs or passwords |
| Explaining topics I'm learning | My course, textbook or teacher | Let AI make my money decisions |
| Preparing questions for the doctor | A doctor or pharmacist | Use AI instead of a doctor in an emergency |

Fill in your own version. Keep it on one page.

## Keep growing

- **Practise little and often.** Ten minutes a few times a week builds confidence.
- **Share what you learn.** Teach an older relative how to spot a scam, or a younger one how to use AI to study, not to cheat.
- **Keep learning on #NotesApp.** Notes Academy has more courses, including the other AI courses in this series from LWB academy: for small businesses, farmers, teachers, NGOs, careers and professionals. You can also join a **Community** on #NotesApp to ask questions and learn with others.

## A last word from me

AI is a tool, like a cutlass, a car or a phone. In good hands it saves time and opens doors. In careless hands it causes harm. You now have the knowledge to be one of the careful, confident users, and to help the people around you do the same.

**Emmanuel Adams**, LWB academy

**Privacy check:** before you finish, make sure your safe phrase is agreed with your family, your bank's real number is saved, and your AI privacy settings are the way you want them.

## Try this today

1. Write your **three-column plan** on one page.
2. Tell one person about something you learnt in this course.
3. Take the short quiz that follows, then claim your certificate.`,
  },
  {
    id: "ev-10-quiz", moduleId: "evsafe", kind: "quiz", minutes: 6, title: "Check what you've learnt",
    quiz: {
      passPercent: 70,
      questions: [
        { id: "evq1", prompt: "An AI assistant gives you a confident answer that includes a law and a date. What should you do?", options: ["Trust it: AI is never wrong", "Check the law and the date in a reliable source before relying on it", "Share it immediately with your family", "Ask the AI to promise it is correct"], answer: 1, explain: "AI assistants predict likely words and can invent facts that sound right. Check anything that matters in a reliable source." },
        { id: "evq2", prompt: "Which of these is safe to type into a public AI assistant?", options: ["Your BVN and card PIN", "Your online banking password", "Your monthly budget amounts, without names or account numbers", "A friend's medical results with their name"], answer: 2, explain: "General figures with no identifying details are fine. Never share PINs, passwords, BVN or other people's private information." },
        { id: "evq3", prompt: "Your \"son\" calls in a panic asking you to send money now, and his voice sounds exactly right. What's the best first step?", options: ["Send the money quickly", "Ask for your family's safe phrase, then call him back on the number you already have", "Send half the money", "Post about it on social media"], answer: 1, explain: "Voices can be cloned. A safe phrase and a call back on a number you know are simple, strong checks." },
        { id: "evq4", prompt: "A photo of a politician looks perfect, with no strange hands or blurry text. Does that prove it's real?", options: ["Yes, AI always leaves visible mistakes", "No: newer AI images can look flawless, so check who posted it and whether reliable news is reporting it", "Yes, if it has many shares", "Yes, if it was sent by a friend"], answer: 1, explain: "Clues help, but they're getting harder to see. Check the source and the story, and don't share when you're unsure." },
        { id: "evq5", prompt: "Under Nigeria's Data Protection Act 2023, which body supervises how organisations handle personal data?", options: ["The Central Bank of Nigeria", "The Nigeria Data Protection Commission (NDPC)", "The Nigerian Communications Commission only", "No one"], answer: 1, explain: "The NDPA created the Nigeria Data Protection Commission (ndpc.gov.ng), which replaced the earlier Bureau." },
        { id: "evq6", prompt: "According to the NDPA, if you don't reply to a company's request to use your data, does your silence count as consent?", options: ["Yes, silence means yes", "No, silence or inactivity is not consent", "Only after 30 days", "Only for banks"], answer: 1, explain: "The Act says silence or inactivity by the data subject does not count as consent." },
        { id: "evq7", prompt: "You have chest pain and difficulty breathing. What should you do?", options: ["Ask an AI assistant for a diagnosis", "Wait and see", "Call 112 or go to the nearest hospital now", "Search for herbal remedies"], answer: 2, explain: "AI is not a diagnosis and not for emergencies. In Nigeria, 112 is the free national emergency number." },
        { id: "evq8", prompt: "Which prompt is most likely to give a useful letter?", options: ["\"Write letter\"", "\"Landlord\"", "\"I'm a tenant in Ibadan. Write a short, polite but firm letter asking my landlord to fix a leaking roof I reported on 2 September.\"", "\"Make something good\""], answer: 2, explain: "Good prompts say who you are, what you want, the details and the style." },
      ],
    },
  },
];

export const AI_EVERYDAY: SeedCourse = {
  key: "ai-everyday-africans",
  ownerUsername: "lwb", byline: "Emmanuel Adams",
  slug: "ai-for-everyday-africans",
  title: "AI for Everyday Africans",
  cover: "/images/academy/covers/ai-for-everyday-africans.webp",
  summary: `Use AI with confidence, and without getting burnt.

A friendly, plain-English course for anyone in Nigeria and across Africa who keeps hearing about AI and wants to use it well. You'll learn what AI is and how assistants like ChatGPT, Claude, Gemini, Copilot and Nana AI work; how to use them for writing, learning, money and health questions; how to spot AI scams, cloned voices and deepfakes; and how Nigeria's Data Protection Act 2023 protects your personal data.

Short lessons, a "Try this today" exercise in each, and a quiz at the end. Written by Emmanuel Adams for LWB academy.`,
  topics: ["ai", "cybersecurity", "personal-finance"],
  subtopics: [{ parent: "ai", label: "AI Assistants" }, { parent: "ai", label: "Data Privacy" }, { parent: "cybersecurity", label: "Scam Awareness" }],
  level: "beginner", language: "English", format: "self",
  outcomes: [
    "Explain what AI is and where you already meet it",
    "Understand how AI assistants work and why they make mistakes",
    "Write clear prompts for letters, messages and CVs",
    "Use AI as a tutor without letting it think for you",
    "Use AI for money and health questions, and know where to stop",
    "Protect your family from voice-cloning and other AI scams",
    "Check suspicious photos and videos before sharing them",
    "Know your rights under Nigeria's Data Protection Act 2023",
    "Keep personal and sensitive data out of public AI tools",
  ],
  requirements: [
    "No experience needed",
    "A smartphone, tablet or computer with internet",
    "A notebook and a pen",
  ],
  modules: [
    { id: "evmeet", title: "Meet AI" },
    { id: "evuse", title: "Use AI well" },
    { id: "evsafe", title: "Stay safe" },
  ],
  lessons: LESSONS,
};
