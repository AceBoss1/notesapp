// Two Notes Academy courses written for the owner, Emmanuel Adams (@emmanuel), seeded into production from Admin → Academy
// (POST /api/admin/course-seeds; the writing is in lib/course-seeds-server.ts). Pure data, client-safe: the admin card shows what each
// seed holds before anyone confirms. Lessons are Markdown, as text lessons are (components/academy/LessonPlayer.tsx renders them with
// remark). A YouTube lesson's notes are the same Markdown, and its credit is what YouTube's oEmbed returned for the video, word for word
// (checked on 1 Nov 2026). Never add a video whose id hasn't been checked that way.
import type { CourseLevel, CourseModule, VideoCredit } from "./courses";
import { AI_COURSE_SEEDS } from "./course-seeds-ai";

export const SEED_OWNER_USERNAME = "emmanuel";

export type SeedQuestion = { id: string; prompt: string; options: string[]; answer: number; explain?: string };
export type SeedLesson = {
  id: string; // fixed, so seeding again rewrites the same lessons and learners keep their ticks on them
  title: string; kind: "text" | "youtube" | "quiz"; minutes: number; moduleId: string;
  body?: string; // a text lesson, or a YouTube lesson's notes
  youtubeId?: string; videoCredit?: VideoCredit;
  quiz?: { passPercent: number; questions: SeedQuestion[] };
};
export type SeedCourse = {
  key: string;
  ownerUsername: string; // who the course belongs to: a member, or an organisation's account
  byline: string; // who wrote it, as people know them
  // For an organisation's course: the team member (admin or writer) who makes it, credited as its teacher. Defaults to the owner.
  teacherUsername?: string;
  group?: string; // the heading on the admin card (an organisation's academy); defaults to the owner
  existingId?: string; // a course already in production that this seed rewrites in place (kept published, with its id and address)
  slug: string; title: string; summary: string; cover: string; topics: string[]; subtopics: { parent: string; label: string }[];
  level: CourseLevel; language: string; format: "self"; outcomes: string[]; requirements: string[];
  modules: CourseModule[]; lessons: SeedLesson[];
};

// What happens to people already learning on a course this seed rewrites (the admin card says it before anyone confirms).
export const SEED_PROGRESS_NOTE =
  "Learners keep their enrolment, their reviews and any certificate already issued (nothing is revoked). The new lessons start unticked, so their progress shows the new lessons. Anyone who finished the old lessons but hasn't claimed a certificate can still claim it until they tick a new lesson.";

// ============================================================================================================================
// Course A: How to Restart Your Life After a Breakdown
// ============================================================================================================================
const SAFETY = `> **If you are in danger right now:** if you feel unsafe, or you are thinking about ending your life, please stop reading and get help now. In Nigeria, call **112** (the free national emergency number) or go to the nearest hospital. You can also call the **Suicide Research and Prevention Initiative (SURPIN)** on its toll-free line **0800 078 7746**, or on **0908 021 7555**, **0903 440 0009** or **0814 224 1007**. You matter, and help is there.`;

const RESTART_LESSONS: SeedLesson[] = [
  {
    id: "ra-00-welcome", moduleId: "rastart", kind: "text", minutes: 7, title: "Welcome: before we begin",
    body: `Welcome. My name is Emmanuel Adams, and I'm glad you are here.

If you have opened this course, something has probably fallen apart. Maybe you burnt out at work. Maybe a business failed, a marriage ended, someone you loved died, or your mind simply stopped coping. Some people call it a breakdown, others call it "when everything crashed". Whatever you call it, you are not lazy, weak or finished. You are a person who has been carrying too much for too long.

This course will not rush you. It gives you **nine strategies** to start moving again, one small step at a time.

${SAFETY}

## What this course is, and what it is not

- It **is** a practical guide written in plain English, with one small exercise in each lesson.
- It **is not** medical advice, and it is **not a substitute for a doctor, psychologist or counsellor**. If you are struggling with your sleep, your appetite, your thoughts or your safety, please see a professional. Many general hospitals and teaching hospitals in Nigeria have psychiatry and psychology clinics, and seeing them is a sign of strength, not shame.
- Nothing here replaces medicine a doctor has given you. Don't stop or change any medicine without talking to them first.

## How the course works

There are eleven short lessons and a reflection quiz at the end:

1. Rest and look after your body first
2. Get support and talk to someone
3. Build small daily routines
4. Take one tiny step at a time
5. Change the story you tell yourself
6. Set boundaries that protect your recovery
7. Reconnect with your purpose, faith and values
8. Rebuild your finances and work, gently
9. Plan for setbacks

Each lesson takes about five to ten minutes. Some include a short talk on YouTube by someone who has studied the subject; I always say who made it, and the credit sits under the video.

You can do one lesson a day, or one a week. Recovery is not a race. Tick each lesson off when you have done its exercise, not just when you have read it.

## What you will need

- A notebook and a pen. Writing things down by hand slows the mind and helps you see your thoughts more clearly.
- Ten quiet minutes a day, if you can find them. Early morning or before bed both work.
- Honesty with yourself. Nobody else will read your notebook.

## Try this today

1. Write today's date at the top of a fresh page in your notebook.
2. Under it, finish this sentence in two or three lines: *"Right now, the hardest thing for me is…"*
3. Then write one person's name: someone you could call if things got worse. If you can't think of anyone, write **112** and **SURPIN 0800 078 7746**.
4. Close the notebook. That's enough for today. You've started.`,
  },
  {
    id: "ra-01-rest", moduleId: "rasteady", kind: "youtube", minutes: 25, title: "Strategy 1: Rest and look after your body first",
    youtubeId: "5MuIMqhT8DM",
    videoCredit: { title: "Sleep Is Your Superpower | Matt Walker | TED", name: "TED", url: "https://www.youtube.com/@TED" },
    body: `After a breakdown, many of us try to fix our whole life in one weekend: a new plan, a new job, a new everything. It rarely works, because the body is still empty. **The first strategy is to rest and refuel your body before you ask it to carry anything new.**

## Why the body comes first

Stress is not only in the mind. When you have been under pressure for months, your body has been living in "emergency mode": a racing heart, tight shoulders, poor sleep, a stomach that won't settle. Until the body feels safe again, clear thinking is hard.

In the talk above, shared on YouTube by TED, sleep scientist **Matt Walker** explains why sleep is not a luxury but one of the most important things we do for our health, our memory and our mood. Watch it when you have a quiet moment, then come back to these notes.

## Four basics to protect this week

1. **Sleep.** Aim for the same bedtime and waking time every day, even at weekends. Put your phone away from the bed thirty minutes before you sleep. If NEPA takes the light and the heat keeps you awake, a damp cloth on the neck and a hand fan can help more than scrolling.
2. **Food and water.** Eat something proper at least twice a day, even if it is simple: beans and plantain, eba and soup, rice and stew, fruit. Keep a bottle of water near you. Skipping meals makes low moods lower.
3. **Movement.** A ten-minute walk around your street, stretching on your mat, or dancing to one song in your room counts. You are not training for a race; you are telling your body it is safe.
4. **Less of what drains you.** Cut down on alcohol, energy drinks and late-night coffee. They borrow energy from tomorrow.

## Rest is not laziness

Many of us grew up hearing "you cannot be tired, others are suffering more". That voice can push you straight back into collapse. Rest is part of the work. A farmer lets the land lie fallow so it can produce again.

If you can't sleep for many nights, have lost a lot of weight, or feel numb all the time, please see a doctor. These can be signs that you need medical help, and there's no shame in that.

## Try this today

1. In your notebook, draw four boxes: **Sleep, Food, Water, Movement.**
2. In each box, write one small thing you will do **today**. Examples: "Phone off at 10 pm", "Eat breakfast before 10 am", "Two bottles of water", "Walk to the junction and back".
3. Tonight, put a tick in each box you managed. Don't punish yourself for the ones you missed. Try again tomorrow.`,
  },
  {
    id: "ra-02-support", moduleId: "rasteady", kind: "youtube", minutes: 22, title: "Strategy 2: Get support and talk to someone",
    youtubeId: "RcGyVTAoXEU",
    videoCredit: { title: "How to Make Stress Your Friend | Kelly McGonigal | TED", name: "TED", url: "https://www.youtube.com/@TED" },
    body: `When life falls apart, many of us hide. We stop answering calls, we post nothing, we say "I'm fine" in the family WhatsApp group. Hiding feels safer, but it usually makes the pain heavier. **The second strategy is to let at least one safe person in.**

## Why talking helps

In the talk above, shared on YouTube by TED, health psychologist **Kelly McGonigal** explains that how we think about stress changes how it affects us, and that reaching out to other people is one of the body's own ways of coping with stress. When we connect with others, and when we help others, we become stronger, not weaker.

You don't need a big crowd. One trustworthy person can make a real difference.

## Who could you talk to?

- **A trusted friend or family member** who listens more than they lecture.
- **A faith leader**, if your faith is important to you. A good pastor or imam will listen, pray with you and also encourage you to see a doctor when you need one.
- **A professional**: a counsellor, a clinical psychologist or a psychiatrist. Many teaching hospitals and federal medical centres have mental health clinics, and some organisations offer counselling by phone or online.
- **A helpline**, when you need to talk now. In Nigeria, the Suicide Research and Prevention Initiative (SURPIN) lists a toll-free line, **0800 078 7746**, and the hotlines **0908 021 7555**, **0903 440 0009** and **0814 224 1007** on its website.

If you feel unsafe or think about ending your life, call **112** or go to the nearest hospital now.

## How to start the conversation

Starting is the hardest part. You can borrow one of these lines:

- "I've not been okay for a while. Can I talk to you for a few minutes?"
- "I don't need you to fix anything. I just need someone to listen."
- "Things have been really hard. Can we meet this week?"

If the first person brushes you off or says "just pray about it" or "you're overthinking it", please don't stop there. Try someone else. Their answer is about them, not about your worth.

## Try this today

1. Write down the names of **three people** you could talk to. Next to each, write how you would reach them (call, chat, visit).
2. Choose **one** and send them a message today. You can use one of the lines above.
3. In your notebook, write how you felt **before** and **after** sending it.`,
  },
  {
    id: "ra-03-routines", moduleId: "rasteady", kind: "youtube", minutes: 22, title: "Strategy 3: Build small daily routines",
    youtubeId: "PrJAX-iQ-O4",
    videoCredit: { title: "Emily Nagoski and Amelia Nagoski: The cure for burnout (hint: it isn't self-care) | TED", name: "TED", url: "https://www.youtube.com/@TED" },
    body: `When everything is uncertain, a few small, predictable routines give your mind something solid to stand on. **The third strategy is to build simple daily routines that steady you.**

## Routines calm the stress in the body

In the talk above, shared on YouTube by TED, **Emily Nagoski and Amelia Nagoski** explain that dealing with the cause of stress is not the same as dealing with the stress itself. Even after a problem is solved, the body may still be holding the stress, and it needs things like movement, slow breathing, laughter, kind contact with others, a good cry or making something creative to let it go.

Small routines are a way to do these things every day without having to think about them.

## A simple daily shape

Don't build a perfect timetable. Start with an **anchor** in the morning, an anchor in the evening, and one thing in between.

- **Morning anchor (10 minutes):** get up, wash your face, drink water, open the window, and write one line in your notebook: *"Today I will…"*
- **Midday anchor (10 minutes):** step outside or move. Walk, stretch, sweep the compound, or play one song and dance.
- **Evening anchor (10 minutes):** put your phone away, write *"One thing that went okay today was…"*, and prepare for sleep.

If you pray, read scripture or meditate, those can sit inside your anchors too.

## Make it easy to do

- **Attach** each routine to something you already do. "After I brush my teeth, I drink a glass of water."
- **Shrink** it when you are low. On a bad day, the morning anchor can be just "sit up and drink water". That still counts.
- **Prepare** the night before: put your notebook and pen by the bed, fill your water bottle.

## Try this today

1. In your notebook, write your three anchors: **morning, midday, evening**, with one small action each.
2. Make each one take **ten minutes or less**.
3. Do them for the next **three days**. Tick each one you manage. After three days, write what helped and what you want to change.`,
  },
  {
    id: "ra-04-tiny-steps", moduleId: "ramove", kind: "text", minutes: 8, title: "Strategy 4: Take one tiny step at a time",
    body: `After a breakdown, the list of things to fix can feel endless: bills, work, family, health, debts, relationships. Looking at all of it at once can freeze you. **The fourth strategy is to choose one tiny step, do it, and then choose the next.**

## Why tiny steps work

Big goals ask for energy you may not have yet. Tiny steps ask for very little, so you actually start. And every step you finish sends a quiet message to your mind: *"I can still do things."* That message rebuilds confidence faster than any speech.

A tiny step is so small that it feels almost silly:

- Not "sort out my finances", but "find my last bank statement".
- Not "get a new job", but "open my CV file and read it".
- Not "fix my marriage", but "write down one thing I want to say to my spouse".

## The "brain dump" and the "one next step"

1. **Brain dump.** Write down everything on your mind, in any order. Big and small. Don't organise it yet.
2. **Group.** Put a letter next to each item: **H** for health, **M** for money, **W** for work, **P** for people, **O** for other.
3. **Pick one group** that matters most this week.
4. **Find the next step.** For one item in that group, ask: *"What is the smallest action I could do in 15 minutes?"* Write it down.
5. **Do it today** if you can. Then tick it off.

## When you get stuck

- If you keep avoiding a step, it is still too big. Make it smaller.
- If you finish a step and feel nothing, that is normal at first. Keep going; the feeling often comes later.
- If you miss a day, don't start over. Just do the next tiny step.

## A short story

Ngozi lost her job and stayed in bed for weeks. Her brain dump had forty items. She chose one: "reply to my sister's message". The next day: "wash the plates". The day after: "update the first line of my CV". Three months later she had a new job, but she says what changed her life was replying to that one message.

## Try this today

1. Do the **brain dump** in your notebook. Give yourself ten minutes.
2. Group the items with **H, M, W, P, O**.
3. Choose **one** tiny step that takes fifteen minutes or less, and do it today.
4. Write it in your notebook with a big tick next to it.`,
  },
  {
    id: "ra-05-reframe", moduleId: "ramove", kind: "youtube", minutes: 25, title: "Strategy 5: Change the story you tell yourself",
    youtubeId: "F2hc2FLOdhI",
    videoCredit: { title: "How to practice emotional first aid | Guy Winch | TED", name: "TED", url: "https://www.youtube.com/@TED" },
    body: `After a fall, most of us start telling ourselves a harsh story: *"I am a failure. I've wasted my life. Everyone has moved on except me."* We repeat it so often that it starts to feel like the truth. **The fifth strategy is to notice that story and rewrite it, kindly and honestly.**

## Emotional first aid

In the talk above, shared on YouTube by TED, psychologist **Guy Winch** points out that we know how to put a plaster on a cut, but we rarely look after emotional wounds such as failure, rejection and loneliness. He shows how going over painful thoughts again and again, and treating ourselves harshly after failure, can make the wound deeper, and he suggests simple ways to protect ourselves instead.

## Catch the thought

You can't change a thought you haven't noticed. For one week, when you feel a sudden drop in mood, pause and ask: *"What did I just tell myself?"* Write it down exactly.

Common harsh thoughts look like this:

- **All or nothing:** "If I'm not doing well at everything, I'm useless."
- **Fortune-telling:** "It will never get better."
- **Mind-reading:** "Everyone at church thinks I'm a disgrace."
- **Labelling:** "I'm a failure", instead of "I failed at this one thing."

## Rewrite it

For each thought, ask three questions:

1. **Is it completely true?** What evidence do I have for and against it?
2. **What would I say to a friend** who told me this about themselves?
3. **What is a fairer way to say it?**

For example:

- Harsh: *"I'm a failure. My business collapsed."*
- Fairer: *"My business collapsed, and it hurts. I also learnt things about running a business that I didn't know before. I can try again, more wisely."*

The fairer version is not fake positivity. It doesn't pretend nothing happened. It just stops you from beating yourself while you're already down.

## Try this today

1. Draw three columns in your notebook: **The harsh thought**, **The evidence**, **A fairer way to say it**.
2. Fill in **two rows** today, using thoughts you've had this week.
3. Read the third column out loud to yourself once in the morning and once at night for the rest of the week.`,
  },
  {
    id: "ra-06-boundaries", moduleId: "ramove", kind: "text", minutes: 8, title: "Strategy 6: Set boundaries that protect your recovery",
    body: `Many breakdowns don't come from one big event, but from years of saying "yes" when we meant "no": the extra shift, the relative who always needs money, the friend who only calls with problems, the boss who sends messages at midnight. **The sixth strategy is to set clear, kind boundaries so your recovery has room to grow.**

## What a boundary is

A boundary is a line that says *"this is what I can give, and this is where I stop."* It is not a wall, and it is not rude. It protects your time, your energy, your money and your peace, so you can keep showing up for the people and things that matter.

In many of our homes, saying no to family can feel almost impossible. You can still love and respect people while being honest about your limits.

## Where boundaries are often needed

- **Time:** being reachable all day and night; never having a rest day.
- **Money:** lending or giving more than you can afford, then struggling yourself.
- **Energy:** people who drain you, gossip, or pull you back into old habits.
- **Phone and social media:** endless group chats, news and comparison.

## How to say it

Keep it short, calm and clear. You don't have to give a long explanation.

- "I can't lend money this month, but I'll let you know if that changes."
- "I don't answer work messages after 8 pm. I'll reply first thing tomorrow."
- "I'm resting this weekend. Can we see each other next week?"
- "I'm not comfortable talking about that. Let's talk about something else."

People who are used to you always saying yes may push back at first. That doesn't mean your boundary is wrong. Stay calm, repeat it once, and move on.

## Try this today

1. Write down **three situations** in the last month that left you drained or resentful.
2. For each, write the boundary you wish you had set.
3. Choose **one** boundary to practise this week. Write the exact sentence you will use.
4. When you use it, write down what happened and how you felt.`,
  },
  {
    id: "ra-07-purpose", moduleId: "rabuild", kind: "text", minutes: 8, title: "Strategy 7: Reconnect with your purpose, faith and values",
    body: `A breakdown often shakes the things we built our identity on: a job title, a marriage, money, being the strong one. When those wobble, we ask, *"Who am I now? What is the point?"* **The seventh strategy is to reconnect with what gives your life meaning: your values, your faith if you have one, and the people you want to be there for.**

## Values are your compass

Values are what matters to you deep down, whatever your situation. Examples: honesty, family, service, learning, creativity, fairness, faith, courage, kindness.

Your job may change. Your bank balance may change. But you can live by your values today, even in small ways. A person who values kindness can be kind to a neighbour this afternoon, even while unemployed.

## Faith and recovery

For many of us in Nigeria and across Africa, faith is a source of hope and strength. Prayer, worship, scripture, a supportive faith community: these can steady you. At the same time, faith and medical care work best **together**. Seeking a doctor, counsellor or medicine is not a lack of faith. Many faith leaders say this clearly.

If you don't follow a faith, you can still draw meaning from nature, music, art, service, family and community.

## Small acts of purpose

You don't need to discover your "life mission" this week. Start smaller:

- Help a neighbour carry their shopping.
- Teach a younger person something you know.
- Volunteer an hour at church, a mosque, or a community group.
- Call an older relative and listen to their stories.

Doing something for others shifts your focus and reminds you that you still have something to give.

## Try this today

1. Write down **ten values** that matter to you. Circle the **three** that matter most.
2. For each of the three, write one small action you can take **this week** that lives it out.
3. Do one of them today. In your notebook, write what you did and how it felt.`,
  },
  {
    id: "ra-08-finances-work", moduleId: "rabuild", kind: "text", minutes: 10, title: "Strategy 8: Rebuild your finances and work, gently",
    body: `Money worries can keep you trapped in stress, and stress makes it harder to sort out money. Breaking that loop is possible, but it needs a gentle, step-by-step approach. **The eighth strategy is to face your finances and your work slowly and honestly, without panic.**

This lesson is general guidance, not financial or legal advice. For serious debts, speak to someone qualified.

## Step 1: Look, without judging

Many of us avoid our bank app because we're afraid of what we'll see. Choose a calm moment and write down:

- **Money in:** salary, business income, support from family, anything regular.
- **Money out:** rent, food, transport, school fees, data and airtime, family support, loan repayments.
- **Debts:** who you owe, how much, and when it's due.

Just looking is a brave step. Breathe. You can't fix what you can't see.

## Step 2: Protect the essentials

List your essentials in order: **food, rent or shelter, health, transport to work, children's school**. Pay these first. Everything else waits for now.

## Step 3: Talk to the people you owe

Silence makes debts scarier. If you can't pay on time, contact the lender or landlord early, explain honestly, and suggest a smaller, realistic amount. Get any new agreement in writing, even a WhatsApp message. Be very careful with instant loan apps that charge high interest or threaten borrowers; don't borrow from one to pay another.

## Step 4: Ease back into work

If you've been away from work, you don't have to go from zero to full speed.

- **If you're employed:** ask HR or your manager whether a gradual return, lighter duties or flexible hours is possible for a few weeks.
- **If you're looking for work:** spend a fixed time each day on it, say one hour in the morning, then stop. Update your CV, then apply to two good jobs a day, rather than fifty random ones.
- **If you're self-employed:** restart with your most reliable customers, and add one small new thing at a time.

Small, steady income is better than big promises that drain you again.

## Try this today

1. On one page, write **Money in**, **Money out** and **Debts** with real numbers, as best you know them.
2. Circle your **essentials** and put them in order.
3. Choose **one** money step for this week, such as "call the landlord", "cancel one subscription" or "apply to two jobs a day", and write it down with a day next to it.`,
  },
  {
    id: "ra-09-setbacks", moduleId: "rabuild", kind: "text", minutes: 9, title: "Strategy 9: Plan for setbacks",
    body: `Recovery is not a straight line. You'll have good weeks and then a bad day that makes you think, *"I'm back where I started."* You're not. **The ninth strategy is to expect setbacks and plan for them in advance, so a bad day doesn't become a bad month.**

## Know your early warning signs

Most of us show signs before things get serious. Common ones:

- Sleeping much more or much less than usual
- Not eating, or eating a lot more
- Pulling away from people, not answering calls
- Feeling irritable, numb or hopeless
- Drinking more, or using other things to cope
- Missing work or important tasks

Look back at the time before your breakdown. Which signs did you have? Write them down.

## Know your triggers

Triggers are situations that tend to start a slide: a deadline, an argument, money running out, anniversaries of a loss, lack of sleep, certain people. You can't avoid all of them, but knowing them helps you prepare.

## Your setback plan

A setback plan is a short page you write **while you're well**, to use **when you're not**. Include:

1. **My early warning signs:** three to five of them.
2. **My triggers:** three to five of them.
3. **What helps me:** the routines, people and activities from this course that work for you.
4. **Who I'll contact:** two people, with their phone numbers.
5. **When to get professional help:** for example, "if I can't sleep for a week" or "if I start thinking about ending my life".
6. **Emergency:** if I feel unsafe, I'll call **112** or go to the nearest hospital, and I can call **SURPIN on 0800 078 7746**.

Share your plan with one trusted person so they know what to look for and how to help.

## After a setback

When a setback comes, be kind to yourself. Go back to the basics: sleep, food, water, movement, one routine, one person. Ask: *"What did this teach me?"* Then add that to your plan.

## Try this today

1. Write your **setback plan** on one page using the six headings above.
2. Take a photo of it, and keep the paper somewhere you'll find it, such as inside your notebook's cover.
3. Send it, or tell it, to one person you trust.`,
  },
  {
    id: "ra-10-closing", moduleId: "rakeep", kind: "text", minutes: 7, title: "Closing: keep going, one day at a time",
    body: `You've reached the end of this course. Take a moment to notice that. When you started, things may have felt impossible. You still showed up, lesson after lesson.

## The nine strategies, in one place

1. **Rest and look after your body first:** sleep, food, water, movement.
2. **Get support and talk to someone:** you don't have to carry this alone.
3. **Build small daily routines:** morning, midday and evening anchors.
4. **Take one tiny step at a time:** the smallest next step, done today.
5. **Change the story you tell yourself:** catch the harsh thought, write a fairer one.
6. **Set boundaries:** protect your time, money and energy, kindly and clearly.
7. **Reconnect with purpose, faith and values:** live one value today.
8. **Rebuild finances and work, gently:** look, protect the essentials, talk early, ease back in.
9. **Plan for setbacks:** know your signs and triggers, and have your plan ready.

You don't need to do all nine perfectly. Most people find two or three that make the biggest difference. Keep those, and come back to the others when you need them.

## Looking after yourself from here

- Keep your **setback plan** where you can find it.
- Keep at least one **routine**, even on busy days.
- Keep at least one **person** you talk to honestly.
- Keep seeing your doctor or counsellor if you have one.

And if things get very hard, please remember: if you feel unsafe or think about ending your life, call **112** or go to the nearest hospital now. You can also call **SURPIN on 0800 078 7746**.

## A last word from me

Breakdowns are painful, but they are not the end of your story. Many people come through them wiser, kinder and clearer about what matters. I hope this course has helped you take your first steps. Take the next one tomorrow.

With you on the journey,

**Emmanuel Adams**

## Try this today

1. Read back through your notebook from the first lesson. Write down **three things that have changed**, however small.
2. Write a short letter to yourself, to read in three months. Tell your future self what you've learnt and what you hope for.
3. Take the short reflection quiz that follows, then claim your certificate if you'd like one.`,
  },
  {
    id: "ra-11-reflection", moduleId: "rakeep", kind: "quiz", minutes: 5, title: "Reflection quiz",
    quiz: {
      passPercent: 60,
      questions: [
        { id: "raq1", prompt: "You're thinking about ending your life, or you feel unsafe. What should you do first?", options: ["Wait until you feel better tomorrow", "Call 112 or go to the nearest hospital now", "Finish the course first", "Keep it to yourself so nobody worries"], answer: 1, explain: "Your safety comes first. In Nigeria, call 112 (free) or go to the nearest hospital now. You can also call SURPIN on 0800 078 7746." },
        { id: "raq2", prompt: "Why does this course start with rest and the body?", options: ["Because the mind doesn't matter", "Because a body stuck in emergency mode makes clear thinking hard", "Because exercise fixes everything", "Because rest is the only strategy you need"], answer: 1, explain: "Sleep, food, water and gentle movement help your body feel safe again, so the other strategies become possible." },
        { id: "raq3", prompt: "Which of these is a good \"tiny step\"?", options: ["Sort out all my finances this weekend", "Find a new career by Friday", "Find my last bank statement", "Fix every relationship in my life"], answer: 2, explain: "A tiny step can be done in about fifteen minutes. Finishing it builds confidence for the next one." },
        { id: "raq4", prompt: "Your thought is \"I'm a complete failure\". Which is a fairer way to say it?", options: ["\"I'm a complete failure, and everyone knows it\"", "\"I failed at this one thing, it hurts, and I learnt from it\"", "\"Nothing bad ever happened\"", "\"It's all someone else's fault\""], answer: 1, explain: "A fairer thought is honest about the pain without turning one event into your whole identity." },
        { id: "raq5", prompt: "What belongs in a setback plan?", options: ["Only your goals for next year", "Your early warning signs, triggers, what helps, who to contact and when to get help", "A list of people who hurt you", "Nothing: setbacks can't be planned for"], answer: 1, explain: "Written while you're well, a setback plan tells you and the people you trust what to do when things start to slide." },
      ],
    },
  },
];

export const RESTART_COURSE: SeedCourse = {
  key: "restart-after-breakdown",
  ownerUsername: SEED_OWNER_USERNAME, byline: "Emmanuel Adams",
  slug: "how-to-restart-your-life-after-a-breakdown",
  title: "How to Restart Your Life After a Breakdown",
  cover: "/images/academy/covers/how-to-restart-your-life-after-a-breakdown.webp", // original art (rising sun, kente band), 1600x900
  summary: `9 strategies to get you moving again.

A gentle, practical course for anyone rebuilding after burnout, a breakdown, a loss or a season when everything fell apart. In short lessons with one small exercise each, you'll rest and steady your body, find support, build simple routines, take tiny steps, change the harsh story in your head, set boundaries, reconnect with your purpose and faith, rebuild your finances and work gently, and plan for setbacks.

Written in plain English for learners in Nigeria and across Africa. This course is not a substitute for a doctor, psychologist or counsellor. If you feel unsafe or think about ending your life, call 112 or go to the nearest hospital now.`,
  topics: ["mental-health", "productivity", "lifestyle"],
  subtopics: [{ parent: "mental-health", label: "Resilience" }, { parent: "mental-health", label: "Burnout Recovery" }],
  level: "beginner", language: "English", format: "self",
  outcomes: [
    "Look after sleep, food, water and movement as the base of recovery",
    "Know when and how to reach out to a friend, faith leader or professional",
    "Build simple morning, midday and evening routines that steady you",
    "Break big problems into tiny steps you can finish today",
    "Catch harsh thoughts and rewrite them in a fairer, kinder way",
    "Set clear, kind boundaries with family, work and friends",
    "Reconnect with your values, purpose and faith",
    "Face your money and work calmly, one step at a time",
    "Spot your early warning signs and triggers",
    "Write a setback plan and know where to get urgent help",
  ],
  requirements: [
    "No experience needed: just a willingness to start",
    "A notebook and a pen",
    "Ten quiet minutes a day",
    "A smartphone, tablet or computer for the lessons",
  ],
  modules: [
    { id: "rastart", title: "Start here" },
    { id: "rasteady", title: "Steady yourself" },
    { id: "ramove", title: "Start moving" },
    { id: "rabuild", title: "Build a life that lasts" },
    { id: "rakeep", title: "Keep going" },
  ],
  lessons: RESTART_LESSONS,
};

// ============================================================================================================================
// Course B: IT Support Training (rewrites the published course wLQCJdqolPh6A3WbvEZL, /academy/it-support-staff-training, in place)
// ============================================================================================================================
const IT_LESSONS: SeedLesson[] = [
  {
    id: "it-01-role", moduleId: "itstart", kind: "text", minutes: 8, title: "The IT support role and career paths",
    body: `Welcome to IT Support Training. I'm Emmanuel Adams, and in this course I'll walk you through the skills that help people get hired in IT support, customer service, telemarketing and cloud administration, and earn from those skills remotely on platforms such as Upwork and Fiverr.

## What IT support people actually do

IT support is about **helping people use technology to get their work done**. A typical day can include:

- Setting up a new laptop or phone for a staff member
- Fixing "my internet is not working", "my printer won't print" or "I can't log in"
- Installing and updating software
- Resetting passwords and managing user accounts
- Logging every request in a ticketing system and following it to the end
- Explaining technical things in plain language to people who aren't technical

Good IT support people are not only technical. They are **patient, organised and good with people**. Those "soft skills" are often what gets you hired and promoted.

## Support levels (tiers)

Many companies organise support in tiers:

- **Tier 1 (help desk / service desk):** first contact. Password resets, basic troubleshooting, logging tickets, escalating harder issues.
- **Tier 2 (desktop support / technical support):** deeper problems with devices, software and networks, sometimes on site.
- **Tier 3 (specialists):** network engineers, system administrators, cloud engineers, who handle the hardest issues and design systems.

Most people start at Tier 1. That's normal and a great place to learn.

## Career paths from here

IT support is a doorway into many careers:

1. **Customer service and customer success**, for tech companies, banks, telecoms and online businesses
2. **Systems administration**: servers, user accounts, backups
3. **Networking**: routers, switches, Wi-Fi, firewalls
4. **Cloud administration**: Microsoft Azure, AWS, Google Cloud
5. **Cybersecurity**: protecting systems and data
6. **Sales and lead generation**, especially for software (SaaS) companies
7. **Freelancing and remote work**, offering support, admin or customer service to clients abroad

## Certifications that help (optional)

You don't need certificates to start this course, but they can help later: **CompTIA A+** (IT support basics), **Microsoft Azure Fundamentals (AZ-900)** and **Google IT Support Professional Certificate** are popular starting points.

## Try this today

1. In your notebook, write the **three careers** from the list above that interest you most.
2. Search a job site (such as LinkedIn or Jobberman) for one of them. Read **three job adverts** and write down the skills that appear in all three.
3. Circle the skills you already have. You'll build the rest in this course.`,
  },
  {
    id: "it-02-troubleshooting", moduleId: "ittech", kind: "youtube", minutes: 22, title: "Troubleshooting hardware and software: a step-by-step method",
    youtubeId: "QRd_Y_BiuL8",
    videoCredit: { title: "Troubleshooting Theory - CompTIA A+ 220-802: 4.1", name: "Professor Messer", url: "https://www.youtube.com/@professormesser" },
    body: `Guessing wastes time and can make problems worse. Good technicians follow **a method**, every time. In the video above, **Professor Messer** explains the troubleshooting theory taught for the CompTIA A+ exam. The video was made for an older version of the exam, but the method is the same one IT support teams use today.

## The six-step troubleshooting method

1. **Identify the problem.** Ask questions and gather facts. What exactly is happening? When did it start? What changed recently? Can you reproduce it? Is anyone else affected?
2. **Establish a theory of probable cause.** Start with the simple, obvious causes: is it plugged in, switched on, connected, logged in, out of paper?
3. **Test the theory.** Check whether your idea is right. If not, form a new theory, or escalate.
4. **Make a plan and put it into action.** Think about side effects first. Will a restart lose someone's unsaved work? Do you need permission?
5. **Check that everything works**, and prevent it happening again if you can (for example, update the driver, replace the worn cable, teach the user).
6. **Document it.** Write the problem, the cause and the fix in the ticket, so you or a colleague can fix it faster next time.

## Questions to ask the user

- "What were you trying to do when it happened?"
- "Do you see an error message? Can you read it to me, or send a screenshot?"
- "Has it ever worked? When did it last work?"
- "Did anything change: a new update, new software, a move to a new desk?"

## Common hardware problems and first checks

- **Won't power on:** check the socket, the extension, the power cable and the battery. Try another socket. With unstable power, a surge protector or UPS helps.
- **No display:** check the monitor cable and input source, try another monitor, adjust brightness.
- **Overheating or loud fan:** clean dust from vents, use the laptop on a hard surface, check for heavy programs running.
- **Printer problems:** check paper, toner or ink, the connection (USB, Wi-Fi), the print queue, and that the correct printer is chosen.
- **No internet:** check Wi-Fi is on, the router lights, whether other devices connect, and whether data or the subscription has run out.

## Common software problems and first checks

- **Program freezes or crashes:** close and reopen it, restart the computer, check for updates, reinstall if needed.
- **Slow computer:** check storage space, startup programs and Task Manager for anything using lots of memory or CPU; scan for malware.
- **Can't log in:** check Caps Lock and keyboard language, the username, and whether the account is locked; reset the password following company policy.
- **Error messages:** copy the exact message and search for it; vendors' own help pages are often the best source.

## Try this today

1. Pick a real problem you or a friend had with a phone or computer.
2. Write it up using the **six steps**: problem, theory, test, plan, check, document.
3. Keep this as your first entry in a "fix log". Add every problem you solve from now on. It's great material for interviews.`,
  },
  {
    id: "it-03-remote-tools", moduleId: "ittech", kind: "text", minutes: 8, title: "Remote support tools",
    body: `Many support jobs, and almost all freelance support work, happen remotely. You'll often fix someone's computer without being in the same room, city or even country.

## Common remote support tools

- **Quick Assist** (built into Windows): the user gives you a security code and you can see or control their screen with their permission.
- **Remote Desktop (RDP):** connects to a Windows computer or server over the network, usually inside a company or through a VPN.
- **TeamViewer and AnyDesk:** popular tools for support across the internet, with free use for personal purposes and paid plans for businesses.
- **Chrome Remote Desktop:** a free tool from Google that works through the Chrome browser.
- **Video calls with screen sharing** (Google Meet, Zoom, Microsoft Teams): useful when you just need to see the problem and guide the user.

Your employer or client will usually tell you which tool to use. Learn its basics: starting a session, viewing only versus taking control, transferring files, and ending the session.

## A safe remote session, step by step

1. **Confirm who you're helping.** Check their name and ticket number, and follow your company's identity checks.
2. **Get permission** before taking control: "May I take control of your screen to fix this?"
3. **Explain what you're doing** as you go, in simple words.
4. **Never ask for their password.** If a password is needed, let them type it themselves, or reset it through the proper system.
5. **Don't open personal files** you don't need to.
6. **End the session** clearly, and make sure the user sees that you've disconnected.
7. **Write it up** in the ticket.

## Spotting scams

Fraudsters pretend to be "Microsoft support" or "your bank's IT team" to get remote access. Teach users this rule: **genuine support teams don't call you out of the blue to ask for remote access or your PIN.** If in doubt, hang up and call the official number.

## When the connection is poor

- Lower the screen quality in the tool's settings.
- Switch to "view only" and guide the user by voice.
- Send clear written steps with screenshots by email or chat.
- Agree a better time if the network keeps dropping.

## Try this today

1. Install one free remote tool (for example Chrome Remote Desktop) on two of your own devices, or with a friend who agrees.
2. Practise: start a session, view the screen, take control, end the session.
3. Write a short **remote session checklist** in your notebook using the seven steps above.`,
  },
  {
    id: "it-04-service", moduleId: "itcust", kind: "text", minutes: 10, title: "Multi-channel customer service: phone, email and chat",
    body: `Whether you're fixing laptops or answering questions about an online shop, customers judge you on **how** you help as much as **whether** you help. Most companies now support customers on several channels at once: phone, email and live chat (including WhatsApp).

## The service basics on every channel

- **Greet warmly** and use the customer's name.
- **Listen fully** before you answer. Repeat the problem back to show you understood.
- **Show empathy:** "I understand how frustrating that is."
- **Be clear** about what happens next and when.
- **Own it:** if you can't solve it now, say who will and by when, and follow up.
- **Close properly:** check they're satisfied and thank them.

## Phone

Smile while you speak; people can hear it. Speak clearly and not too fast, especially with poor network.

**Sample phone script:**

> "Good morning, thank you for calling [Company]. My name is Ada. How may I help you today?"
>
> *(Customer explains.)*
>
> "Thank you, Mr Bello. So your internet stopped working this morning after the light went off, and it's still down now. Is that right? I'm sorry about that; I know you need it for work. Let's sort it out together. Can you see the lights on your router? What colour is the internet light?"
>
> *(Troubleshoot.)*
>
> "It's working again. Is there anything else I can help you with today? Thank you for calling, and have a lovely day."

If you need to put someone on hold, ask first and tell them how long: "May I place you on hold for about two minutes while I check?"

## Email

Emails last, so write carefully.

- Use a clear subject line, including the ticket number.
- Answer every question they asked, in order.
- Use short paragraphs and numbered steps.
- Read it once before you send it.

**Sample email:**

> Subject: Your request #20451: unable to log in
>
> Dear Funmi,
>
> Thank you for contacting us, and I'm sorry you've had trouble logging in.
>
> I've reset your account. Please:
>
> 1. Go to the login page.
> 2. Click "Forgot password".
> 3. Follow the link we've just emailed you to choose a new password.
>
> If the link doesn't arrive within ten minutes, please check your spam folder or reply to this email.
>
> Kind regards,
> Emeka, Customer Support

## Chat

Chat is fast and often handles several customers at once.

- Reply quickly, even if only to say "I'm checking that for you now."
- Keep messages short. Send steps one at a time.
- Use friendly, professional language; avoid slang and too many emojis.
- Use saved replies (macros) for common questions, but personalise them.

**Sample chat opening:**

> "Hi Tunde, thanks for reaching out! I'm Grace from support. I can see you're asking about a delayed order. Could you share your order number, please?"

## Handling an angry customer

1. **Let them finish.** Don't interrupt.
2. **Acknowledge** the feeling: "I understand why you're upset."
3. **Apologise** for the experience, without blaming anyone.
4. **Focus on the fix** and what you **can** do.
5. **Follow up** to make sure it stayed fixed.

## Try this today

1. Write your own **phone greeting** and **closing** for a company you'd like to work for.
2. Rewrite the sample email for this problem: *"My printer prints blank pages."*
3. Ask a friend to role-play an angry customer for three minutes. Practise the five steps above.`,
  },
  {
    id: "it-05-crm", moduleId: "itcust", kind: "youtube", minutes: 20, title: "Ticketing and CRM: Zendesk, Intercom and HubSpot",
    youtubeId: "1G8R1vL3N_o",
    videoCredit: { title: "Zendesk Tutorial: Getting Started", name: "Zendesk", url: "https://www.youtube.com/@zendesk" },
    body: `Support teams don't work from memory. They use **ticketing** and **CRM** (customer relationship management) tools to record every request, every customer and every conversation. In the video above, **Zendesk** shows the first things to set up when you start using Zendesk. Watch it, then use these notes to compare the three tools employers mention most.

## Key words you'll see everywhere

- **Ticket:** one customer request, with its history.
- **Status:** where a ticket is. In Zendesk: *New, Open, Pending* (waiting for the customer), *On-hold* (waiting for someone else), *Solved* and *Closed*.
- **Priority:** how urgent it is (low, normal, high, urgent).
- **Assignee:** the agent or group responsible.
- **Macro / saved reply:** a ready-made answer or set of actions for common requests.
- **SLA (service level agreement):** the time you've promised to reply or solve.
- **Contact / company / deal:** records of people, organisations and sales opportunities in a CRM.

## Zendesk

Zendesk is a widely used help desk. Requests from email, chat, phone, social media and the help centre all become **tickets** in one place.

- Agents work tickets in **views** (lists such as "My open tickets").
- **Macros** apply a reply and change fields in one click.
- **Triggers and automations** do things automatically, such as sending a "we've received your request" email.
- **The help centre** holds articles so customers can help themselves.

## Intercom

Intercom is built around **conversations**, especially chat on websites and apps.

- The **Messenger** is the chat window customers see.
- The **Inbox** is where agents answer conversations from chat, email and other channels.
- **Help centre articles** and an AI agent can answer common questions before a human steps in.

## HubSpot

HubSpot is a CRM with free tools and paid "hubs" for marketing, sales and service.

- **Contacts, companies and deals** hold your customer and sales records.
- **Pipelines** show where each deal or ticket is.
- **Tickets** in the service tools work like a help desk.
- Emails and calls can be **logged** on each contact's timeline, so the whole team sees the history.

## Good habits in any tool

1. **One request, one ticket.** Don't mix problems.
2. **Write clear internal notes**: what you checked, what you found, what's next.
3. **Update the status** every time something changes.
4. **Tag** tickets so managers can see trends (for example "password", "billing", "delivery").
5. **Never leave a ticket without a next step.**

## Try this today

1. Sign up for a **free trial or free plan** of one of these tools (Zendesk, Intercom or HubSpot).
2. Create **three practice tickets** from the problems in earlier lessons. Give each a status, a priority and an internal note.
3. Create **one macro or saved reply** for a password reset.`,
  },
  {
    id: "it-06-azure", moduleId: "itcloud", kind: "youtube", minutes: 25, title: "Microsoft Azure basics: resource groups, virtual machines and storage",
    youtubeId: "rOiSRkxtTeU",
    videoCredit: { title: "How to create a virtual machine in Azure | Azure Portal Series", name: "Microsoft Azure", url: "https://www.youtube.com/@MicrosoftAzure" },
    body: `Many companies now run their servers and files in the **cloud** instead of in a room in the office. Microsoft Azure is one of the biggest cloud platforms, and knowing your way around it opens doors to cloud support and administration jobs. In the video above, from **Microsoft Azure**'s own Azure Portal Series, you'll see a virtual machine being created in the Azure portal. These notes give you the steps in writing, and how to fix the most common errors.

**Cost warning:** Azure charges for what you use. Use a free account or student credit to practise, choose small sizes, and **delete your practice resources when you finish** (Step 5).

## Key ideas

- **Subscription:** the billing account your resources belong to.
- **Resource group:** a folder that holds related resources, so you can manage or delete them together.
- **Region:** the data centre location (for example *South Africa North* or *West Europe*). Choose one close to your users.
- **Virtual machine (VM):** a computer that runs in Azure.
- **Storage account:** a place to keep files, backups and other data.

## Step 1: Sign in

Go to **portal.azure.com** and sign in. If you don't have an account, Microsoft offers a free account with some credit, and students can apply for Azure for Students. Have a payment card ready for the free account; if your card is declined, check with your bank about international payments.

## Step 2: Create a resource group

1. In the search bar at the top, type **Resource groups** and open it.
2. Click **+ Create**.
3. Choose your **Subscription**.
4. Type a **Resource group** name, for example *rg-training-yourname*.
5. Choose a **Region**.
6. Click **Review + create**, then **Create**.

## Step 3: Create a virtual machine

1. Search for **Virtual machines** and click **+ Create**, then **Azure virtual machine**.
2. On the **Basics** tab, choose your subscription and the **resource group** you just made.
3. Give the VM a name, for example *vm-training-01*, and choose the same **region**.
4. Choose an **Image**, such as *Ubuntu Server* (Linux) or *Windows Server*.
5. Choose a **Size**. Pick a small, low-cost size for practice.
6. Under **Administrator account**, choose SSH key (Linux) or username and password (Windows). Save these details safely.
7. Under **Inbound port rules**, allow **SSH (22)** for Linux or **RDP (3389)** for Windows, only for practice.
8. Click **Review + create**. Wait for validation to pass, then click **Create**.
9. When it finishes, click **Go to resource** and note the **Public IP address**.

## Step 4: Create a storage account

1. Search for **Storage accounts** and click **+ Create**.
2. Choose your subscription and resource group.
3. Type a **Storage account name**: 3 to 24 characters, **lowercase letters and numbers only**, and it must be unique across all of Azure (for example *sttrainingada2026*).
4. Choose the **Region**, **Standard** performance and **Locally-redundant storage (LRS)** for practice.
5. Click **Review + create**, then **Create**.
6. Open the storage account, go to **Containers**, create a container and upload a small file.

## Step 5: Clean up

Open your **resource group** and click **Delete resource group**, type its name to confirm, and delete. Everything inside goes with it, and the charges stop.

## Troubleshooting common errors

- **"The storage account name is already taken" or "is not valid":** names must be unique and use only lowercase letters and numbers. Add your initials or numbers.
- **Validation failed: quota exceeded:** your subscription has a limit on VM cores. Choose a smaller size, use another region, or request a quota increase under **Subscriptions → Usage + quotas**.
- **The selected size is not available in this region:** pick a different size or region.
- **"MissingSubscriptionRegistration" or a resource provider error:** go to your **Subscription → Resource providers**, find the provider named in the error (for example *Microsoft.Compute*) and click **Register**.
- **"AuthorizationFailed" or you can't see the Create button:** your account doesn't have permission. Ask the subscription owner for the right role (for example *Contributor*) on the resource group.
- **Can't connect to the VM:** check the VM is **Running**, you're using the correct public IP and username, and the **Networking** settings allow port 22 or 3389 from your IP address.
- **Deployment failed:** open the resource group, click **Deployments**, select the failed one and read the **error details**. The message usually tells you exactly what's wrong.

## Try this today

1. Create a **resource group**, a **small VM** and a **storage account** following the steps above.
2. Take a screenshot of each one in the portal, for your portfolio.
3. Write down **one error** you met (or one from the list above) and how you would fix it.
4. **Delete the resource group** when you're done.`,
  },
  {
    id: "it-07-telemarketing", moduleId: "itfree", kind: "text", minutes: 10, title: "Telemarketing and lead generation",
    body: `Every business needs customers, and someone has to find them. **Lead generation** means finding people or companies who might buy, and **telemarketing** means contacting them by phone to start a conversation. These skills are in demand from local businesses and from foreign companies hiring remote staff.

## Leads, prospects and qualified leads

- **Lead:** a person or company who might be interested.
- **Qualified lead:** a lead who has a real need, the budget and the authority to decide.
- **Appointment:** an agreed call or meeting with a salesperson.

## Building a lead sheet

Use a spreadsheet (Google Sheets or Excel) with columns like these:

- Company name
- Contact name and job title
- Phone number and email
- Source (where you found them: LinkedIn, Google Maps, company website, a directory)
- Industry and city
- Date contacted
- Outcome (no answer, not interested, call back, interested, appointment booked)
- Next step and date
- Notes

Only collect contact details from public, business sources, respect people who ask not to be contacted, and follow the data protection rules of the country you're calling (in Nigeria, the Nigeria Data Protection Act).

## A simple call script

> "Good afternoon, may I speak with Mrs Okafor? … Hello Mrs Okafor, my name is Daniel, and I'm calling from [Company]. We help small clinics in Lagos manage appointments online, so patients don't wait so long. Do you have two minutes?"
>
> *(If yes.)* "How do you currently book patients? … What's the biggest challenge with that?"
>
> *(Listen and take notes.)*
>
> "Thank you, that's helpful. Based on what you've said, I think a 15-minute demo with my colleague would be worth your time. Would Tuesday at 11 am or Thursday at 2 pm suit you better?"

Notice the structure: **introduce, permission, ask questions, listen, suggest a next step, offer two time choices.**

## Handling common objections

- **"I'm busy."** "I understand. When would be a better time for a two-minute call?"
- **"Send me an email."** "Of course. So that I send the right information, may I ask one quick question about how you currently…?"
- **"We already use something."** "That's great. What do you like most about it? Is there anything you wish it did better?"
- **"It's too expensive."** "I understand budget matters. May I ask what you're comparing it to? Many clients find it saves them more than it costs."
- **"Not interested."** "Thank you for your honesty. May I ask what you're focusing on at the moment?" If they still say no, thank them politely and mark the lead.

Stay polite, never pressure people, and never mislead them.

## Daily rhythm and numbers

Track your numbers every day: calls made, conversations, qualified leads, appointments booked. Over a few weeks you'll see what works and improve your script.

## Try this today

1. Create a **lead sheet** with the columns above.
2. Find **ten businesses** in one industry and city from public sources and add them.
3. Write your **own call script** for a product or service you know.
4. Practise it out loud with a friend, including two objections.`,
  },
  {
    id: "it-08-freelancing", moduleId: "itfree", kind: "youtube", minutes: 25, title: "Freelancing on Upwork and Fiverr: profile, gigs and proposals",
    youtubeId: "beUq_c1Oy84",
    videoCredit: { title: "Simple Tips to Perfect your Upwork Profile | New Talent Webinar", name: "Upwork", url: "https://www.youtube.com/@Upwork" },
    body: `Freelance platforms let you sell your skills to clients anywhere in the world. **Upwork** works mainly through **proposals** (you apply to jobs clients post). **Fiverr** works mainly through **gigs** (you list a service and clients buy it). In the webinar above, **Upwork** shares tips for new freelancers on building a strong profile. These notes cover both platforms.

## Choose what you'll sell

From this course, services you could offer include:

- Remote IT support and troubleshooting
- Help desk and customer service (email, chat, phone)
- Zendesk, Intercom or HubSpot setup and admin
- Azure support tasks
- Lead generation, lead lists and appointment setting
- Virtual assistance

Pick **one main service** to start. A clear focus wins more work than "I can do everything".

## Your Upwork profile

1. **Photo:** a clear, friendly, professional head-and-shoulders photo.
2. **Title:** say exactly what you do, for example *"Zendesk Customer Support Specialist | Email and Live Chat"*.
3. **Overview:** the first two lines matter most. Start with the client's problem and how you solve it, then your experience, then a call to action.
4. **Skills:** add the specific tools and skills clients search for.
5. **Portfolio:** add screenshots and short write-ups from your practice work in this course (your Azure set-up, your lead sheet, your sample tickets), with any private details removed.
6. **Rate:** research what others with similar experience charge, and start at a fair rate you can raise later.

Upwork asks you to spend **Connects** to send proposals, so apply to jobs that really fit you.

## Your Fiverr gig

1. **Gig title:** begin with "I will…", for example *"I will provide professional email and chat customer support"*.
2. **Packages:** offer **Basic, Standard and Premium**, with clear differences (hours, number of tickets, response time).
3. **Description:** who it's for, what they get, how you work, what you need from them.
4. **Gig images:** clean, readable images that show the service.
5. **Requirements:** the information you need from the buyer to start.
6. **FAQs:** answer the questions buyers usually ask.

## A sample Upwork proposal

> Hi Sarah,
>
> You need someone to answer customer emails and live chats in Zendesk during US business hours, and to keep response times under two hours.
>
> I've handled email and chat support for e-commerce stores, using macros and clear internal notes so nothing gets lost. I can work 9 am to 5 pm Eastern time.
>
> For your store, I would:
>
> 1. Review your top 20 customer questions and set up macros for them.
> 2. Answer new tickets within your two-hour target.
> 3. Send you a short weekly report: ticket volume, common issues and suggestions.
>
> I've attached a sample of my ticket notes and macros. Could we have a 10-minute call this week to discuss your current process?
>
> Best regards,
> Chidi

Notice: it starts with **the client's need**, not with "I am a hard-working person". It's short, specific and ends with a clear next step.

## Try this today

1. Choose your **one main service** and write a profile **title** for Upwork and a gig **title** for Fiverr.
2. Write the **first two lines** of your Upwork overview.
3. Find one real job post that fits you, and write a proposal using the structure above. Don't send it until you've read it twice.`,
  },
  {
    id: "it-09-clients", moduleId: "itfree", kind: "youtube", minutes: 20, title: "Working with clients: queries, time tracking with Clockify and getting paid",
    youtubeId: "BVOXETKDIUk",
    videoCredit: { title: "Getting Started: How to Track Time with Clockify", name: "Clockify", url: "https://www.youtube.com/@Clockify" },
    body: `Winning the job is only the beginning. Clients come back, and recommend you, when you **communicate clearly, deliver on time and keep honest records**. In the video above, **Clockify** shows how to get started tracking your time with its free time tracker.

## Answering client queries

- **Reply within your working hours**, and tell clients what those hours are, with the time zone (for example "9 am to 5 pm West Africa Time, which is 4 am to 12 noon New York time").
- **Confirm the request:** "Just to confirm, you'd like me to…"
- **Give a time frame:** "I'll have this done by Thursday, 3 pm your time."
- **Share progress** before they have to ask.
- **Say early if something will be late**, with a new date and the reason.
- **Keep communication on the platform** while you're working through Upwork or Fiverr; it protects both of you if there's a dispute.

**Sample update:**

> Hi James, quick update: I've answered 46 tickets today. Three customers asked about refunds for damaged items. I've tagged those "refund-damaged" and left them for you to approve. Everything else is solved. Have a good evening!

## Tracking time with Clockify

Clockify is a free time tracker that works in a browser, on a computer and on a phone.

1. **Create a workspace** and add each **client** and **project**.
2. **Start the timer** when you begin a task, with a short description ("Answering Zendesk tickets").
3. **Stop it** when you finish or take a break.
4. **Add time manually** if you forgot to start the timer, and be honest.
5. Mark time as **billable** and set your **hourly rate**.
6. Use **Reports** to see hours per client and export a summary for your invoice.

On Upwork's hourly contracts, Upwork's own work diary records the time clients are billed for; Clockify is still useful for your own records and for clients outside the platforms.

## Invoicing

For clients outside the platforms, send a clear invoice with:

- Your name or business name and contact details
- The client's name
- Invoice number and date
- What you did (from your Clockify report), the hours, the rate and the total
- The currency and how to pay
- The due date (for example "Due within 7 days")

Agree the price, the payment terms and what's included **before** you start.

## Getting paid in Nigeria

- **On Upwork and Fiverr**, your earnings go into your platform balance first. Open the withdrawal settings in your account to see the options currently offered for Nigeria, such as direct transfer to a bank account or Payoneer, and their fees.
- **Payoneer** is widely used by Nigerian freelancers to receive money from platforms and from clients.
- **A domiciliary (dollar) account** at your bank lets you receive foreign currency and decide when to convert it to naira.
- **Keep records** of everything you earn and the fees you pay. They help with your tax and when you apply for loans or visas.
- **Protect yourself from scams:** never pay a "registration fee" to get a job, don't share your platform login, and be wary of anyone asking you to move payment off the platform early.

Options and fees change, so always check the platform's current help pages.

## Try this today

1. Create a free **Clockify** account, add one practice client and project, and track **one hour** of real work (for example, finishing this lesson's exercises).
2. Export a report and use it to create a simple **invoice** in Google Docs or Word.
3. Write your **working hours** in both West Africa Time and one client time zone, for your profile.`,
  },
  {
    id: "it-10-capstone", moduleId: "itcap", kind: "text", minutes: 8, title: "Capstone checklist",
    body: `Well done for reaching the final lesson. Now it's time to bring everything together into a **portfolio** you can show employers and clients, and a **plan** for your next 30 days.

## Your capstone checklist

Tick each item when it's done. Keep screenshots and files in one folder called *IT Support Portfolio*.

**Technical support**

- ☐ A **fix log** with at least five problems written up using the six-step method
- ☐ A **remote session checklist**, and one practice remote session completed

**Customer service and CRM**

- ☐ Your **phone greeting and closing**
- ☐ One **sample email** reply and one **sample chat** conversation
- ☐ Three **practice tickets** with statuses, priorities and notes, and one **macro**, in Zendesk, Intercom or HubSpot

**Cloud**

- ☐ Screenshots of a **resource group**, a **VM** and a **storage account** you created in Azure
- ☐ One **error** and how you fixed it (or would fix it)
- ☐ Practice resources **deleted**

**Lead generation**

- ☐ A **lead sheet** with at least ten researched businesses
- ☐ Your own **call script** with answers to three objections

**Freelancing**

- ☐ An **Upwork profile** (title, overview, skills, portfolio)
- ☐ A **Fiverr gig** draft with three packages
- ☐ One **proposal** written for a real job
- ☐ A **Clockify** report and a sample **invoice**

## Your 30-day plan

1. **Week 1:** finish anything left on the checklist and publish your profiles.
2. **Week 2:** apply to **two well-matched jobs a day** (Upwork, job sites or LinkedIn). Quality beats quantity.
3. **Week 3:** reach out to **five local businesses** offering support, customer service or lead generation.
4. **Week 4:** review: what got replies? Improve your profile, proposals and CV.

## Keep learning

- Study towards **CompTIA A+** or **Azure Fundamentals (AZ-900)** when you're ready.
- Join communities of IT and freelance professionals, and help others; teaching is the best way to learn.
- Keep your fix log going. It becomes your best interview story.

Thank you for learning with me. I'm proud of the work you've put in.

**Emmanuel Adams**

## Try this today

1. Go through the checklist and tick what's done.
2. Pick the **two unticked items** that matter most to you and do them this week.
3. Share your Upwork profile or Fiverr gig link with one friend and ask for honest feedback.`,
  },
];

// One short quiz at the end of each module (pass 70%), placed after that module's lessons.
const IT_QUIZZES: SeedLesson[] = [
  {
    id: "it-q-tech", moduleId: "ittech", kind: "quiz", minutes: 5, title: "Quiz: technical support",
    quiz: { passPercent: 70, questions: [
      { id: "itqt1", prompt: "What is the first step of the troubleshooting method?", options: ["Reinstall the software", "Identify the problem", "Replace the hardware", "Escalate to Tier 3"], answer: 1, explain: "Gather facts first: what is happening, when it started and what changed." },
      { id: "itqt2", prompt: "A laptop won't power on. What should you check first?", options: ["The motherboard", "The socket, power cable and battery", "The operating system licence", "The Wi-Fi password"], answer: 1, explain: "Start with the simple, obvious causes before anything complex." },
      { id: "itqt3", prompt: "During a remote session, the user's password is needed. What should you do?", options: ["Ask them to tell you the password", "Ask them to type it themselves, or reset it properly", "Guess it", "Write it in the ticket"], answer: 1, explain: "Never ask for a user's password. Let them type it, or reset it through the proper system." },
      { id: "itqt4", prompt: "What is the last step of the troubleshooting method?", options: ["Document the problem, cause and fix", "Close the laptop", "Delete the ticket", "Blame the user"], answer: 0, explain: "Documenting helps you and your colleagues fix the same problem faster next time." },
    ] },
  },
  {
    id: "it-q-service", moduleId: "itcust", kind: "quiz", minutes: 5, title: "Quiz: customer service and CRM",
    quiz: { passPercent: 70, questions: [
      { id: "itqs1", prompt: "A customer is angry. What should you do first?", options: ["Interrupt and explain the policy", "Let them finish and acknowledge how they feel", "Transfer them straight away", "End the call"], answer: 1, explain: "Listen fully and acknowledge the feeling before you move to the fix." },
      { id: "itqs2", prompt: "In Zendesk, a ticket waiting for the customer to reply is usually…", options: ["New", "Pending", "Closed", "Urgent"], answer: 1, explain: "Pending means you're waiting for the customer; On-hold means you're waiting for someone else." },
      { id: "itqs3", prompt: "What is a macro (saved reply)?", options: ["A virus", "A ready-made reply or set of actions for common requests", "A type of customer", "A long report"], answer: 1, explain: "Macros save time on common requests; personalise them before sending." },
      { id: "itqs4", prompt: "In HubSpot, where would you record a sales opportunity?", options: ["As a deal", "As a printer", "As a password", "As a resource group"], answer: 0, explain: "Contacts, companies and deals are the core records in a CRM like HubSpot." },
    ] },
  },
  {
    id: "it-q-cloud", moduleId: "itcloud", kind: "quiz", minutes: 5, title: "Quiz: Microsoft Azure basics",
    quiz: { passPercent: 70, questions: [
      { id: "itqc1", prompt: "What is a resource group in Azure?", options: ["A team of engineers", "A folder that holds related resources so you can manage or delete them together", "A type of virtual machine", "A payment card"], answer: 1, explain: "Deleting a resource group deletes everything in it, which is handy for cleaning up practice work." },
      { id: "itqc2", prompt: "Which storage account name is valid?", options: ["My_Storage", "st-training", "sttrainingada2026", "ST2026!"], answer: 2, explain: "3 to 24 characters, lowercase letters and numbers only, unique across Azure." },
      { id: "itqc3", prompt: "You can't connect to your Linux VM. Which is a sensible check?", options: ["The VM is running and port 22 is allowed from your IP", "Delete the subscription", "Change the storage account name", "Buy a new laptop"], answer: 0, explain: "Check the VM's state, the public IP and username, and the networking rules for SSH (22) or RDP (3389)." },
      { id: "itqc4", prompt: "Validation fails because of a quota. What can you do?", options: ["Choose a smaller size, another region, or request a quota increase", "Nothing", "Create the same VM again", "Rename the resource group"], answer: 0, explain: "Quotas limit cores per region; a smaller size, another region or a quota request under Usage + quotas fixes it." },
    ] },
  },
  {
    id: "it-q-freelance", moduleId: "itfree", kind: "quiz", minutes: 5, title: "Quiz: leads, freelancing and clients",
    quiz: { passPercent: 70, questions: [
      { id: "itqf1", prompt: "What makes a lead \"qualified\"?", options: ["They answered the phone", "They have a real need, a budget and the authority to decide", "They have a website", "They live in Lagos"], answer: 1, explain: "Qualified leads are worth a salesperson's time." },
      { id: "itqf2", prompt: "How should a strong Upwork proposal start?", options: ["\"I am a hard-working person\"", "With the client's need and how you'll meet it", "With your full CV", "With your rate"], answer: 1, explain: "Clients read the first lines to see whether you understood their problem." },
      { id: "itqf3", prompt: "On Fiverr, what do you list for buyers to purchase?", options: ["A proposal", "A gig with packages", "A ticket", "A resource group"], answer: 1, explain: "Fiverr works through gigs, often with Basic, Standard and Premium packages." },
      { id: "itqf4", prompt: "Someone offers you a job but asks for a registration fee first. What should you do?", options: ["Pay quickly before the offer goes", "Treat it as a likely scam and don't pay", "Send your platform login", "Borrow money to pay"], answer: 1, explain: "Genuine clients and employers don't charge you to start work." },
    ] },
  },
];

const IT_ORDERED: SeedLesson[] = (() => {
  const out: SeedLesson[] = [];
  for (const m of ["itstart", "ittech", "itcust", "itcloud", "itfree", "itcap"]) out.push(...IT_LESSONS.filter((l) => l.moduleId === m), ...IT_QUIZZES.filter((q) => q.moduleId === m));
  return out;
})();

export const IT_SUPPORT_COURSE: SeedCourse = {
  key: "it-support-training",
  ownerUsername: SEED_OWNER_USERNAME, byline: "Emmanuel Adams",
  existingId: "wLQCJdqolPh6A3WbvEZL",
  slug: "it-support-staff-training",
  title: "IT Support Training",
  cover: "/images/academy/covers/it-support-training.webp", // original art (support icons, kente band), 1600x900
  summary: `This training is for people who want to enter or advance in IT support, customer service, telemarketing or cloud administration, and for aspiring freelancers and remote workers who want to earn from their technical or non-technical skills on platforms such as Upwork and Fiverr.

What you'll be able to do:
- Provide technical and non-technical support: diagnose and resolve hardware and software issues, manage remote tools, and handle customer service by phone, email and chat.
- Manage CRM and cloud resources: use Zendesk, Intercom and HubSpot, and create and troubleshoot Microsoft Azure cloud resources.
- Generate leads: run telemarketing calls and build sales leads.
- Earn from your skills remotely: build optimised Upwork and Fiverr profiles, submit proposals, answer client queries and track your time with tools like Clockify.

#Freelancing #RemoteWork #Monetization`,
  topics: ["freelancing", "tech", "careers"],
  subtopics: [{ parent: "freelancing", label: "Remote Work" }, { parent: "freelancing", label: "Monetization" }, { parent: "tech", label: "IT Support" }],
  level: "beginner", language: "English", format: "self",
  outcomes: [
    "Diagnose and resolve hardware and software problems with a step-by-step method",
    "Manage remote support tools to help users safely from a distance",
    "Handle customer service by phone, email and chat",
    "Use Zendesk, Intercom and HubSpot for tickets, chats and customer records",
    "Create and troubleshoot Microsoft Azure resources: resource groups, VMs and storage",
    "Run telemarketing calls and build sales leads",
    "Build optimised Upwork and Fiverr profiles and submit strong proposals",
    "Answer client queries, track time with Clockify and get paid",
  ],
  requirements: ["An interest in learning", "A notebook and a pen", "A smartphone, tablet or computer for accessing lessons"],
  modules: [
    { id: "itstart", title: "Getting started" },
    { id: "ittech", title: "Technical support" },
    { id: "itcust", title: "Customer service and CRM" },
    { id: "itcloud", title: "Cloud: Microsoft Azure" },
    { id: "itfree", title: "Leads, freelancing and clients" },
    { id: "itcap", title: "Capstone" },
  ],
  lessons: IT_ORDERED,
};

// Emmanuel's own two courses, then LWB Academy's seven on AI (lib/course-seeds-ai.ts, owned by the @lwb organisation).
export const COURSE_SEEDS: SeedCourse[] = [RESTART_COURSE, IT_SUPPORT_COURSE];
export const ALL_COURSE_SEEDS: SeedCourse[] = [...COURSE_SEEDS, ...AI_COURSE_SEEDS];
export const seedByKey = (key: unknown) => ALL_COURSE_SEEDS.find((c) => c.key === key) ?? null;

// What a seed holds, for the admin card and the dry run.
export function seedSummary(c: SeedCourse) {
  return {
    lessons: c.lessons.length, minutes: c.lessons.reduce((n, l) => n + l.minutes, 0),
    texts: c.lessons.filter((l) => l.kind === "text").length, quizzes: c.lessons.filter((l) => l.kind === "quiz").length,
    cover: c.cover,
    videos: c.lessons.filter((l) => l.kind === "youtube").map((l) => ({ lesson: l.title, youtubeId: l.youtubeId!, title: l.videoCredit!.title, creator: l.videoCredit!.name })),
  };
}
