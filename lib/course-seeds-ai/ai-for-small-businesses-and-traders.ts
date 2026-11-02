// Course 2 of lib/course-seeds-ai.ts: AI for Small Businesses and Traders. Videos checked with YouTube oEmbed on 1 November 2026.
import type { SeedCourse, SeedLesson } from "../course-seeds";

const LESSONS: SeedLesson[] = [
  {
    id: "sb-01-welcome", moduleId: "sbstart", kind: "text", minutes: 8, title: "Welcome: what AI can do for a small business",
    body: `Welcome. I'm Emmanuel Adams from LWB academy. This course is for the people who keep Africa's economy moving: the provision-shop owner, the fabric seller at Onitsha main market, the caterer in Port Harcourt, the phone-accessories trader at Computer Village, the hair stylist with a small salon, and everyone selling from home with a phone and a dream.

You are busy. You don't have time for theory. So this course is practical: each lesson shows one way an **AI assistant** can save you time or help you earn more, with an exercise you can do the same day.

## What AI can help with

- **Writing:** product descriptions, adverts, price lists, captions and replies to customers.
- **Thinking:** pricing, ideas for new products, planning a sales promotion.
- **Numbers:** organising stock lists, simple bookkeeping, and rough sales forecasts.
- **Selling online:** setting up a store page that's clear and trustworthy.

General AI assistants like **ChatGPT**, **Claude**, **Gemini** and **Copilot** can all do these things, and many have free versions. On #NotesApp, **Nana AI** helps you with writing as you set up your store and posts.

## What AI can't do

- It doesn't know your customers like you do.
- It doesn't know today's market prices unless you tell it, or it searches the web (and even then, check).
- It can't take responsibility. If it gives wrong advice and you follow it, the loss is yours.

So the rule for this whole course is: **AI drafts, you decide.**

## Your customers' data matters

When you run a business, you collect personal information: customers' names, phone numbers, addresses and what they bought. Nigeria's **Data Protection Act 2023** expects businesses to handle that information carefully and use it only for fair, clear reasons. In practice:

- Don't paste customers' names, numbers or addresses into public AI tools. Use "Customer A" instead.
- Don't share customer lists with anyone who doesn't need them.
- Only send promotions to people who are happy to receive them.

We'll come back to this in every lesson under **Privacy check**.

## Try this today

1. Write down the **three tasks** that take most of your time each week (for example, replying to customers, writing posts, counting stock).
2. Next to each, write whether it involves **writing**, **thinking** or **numbers**.
3. Keep this list. By the end of the course, you'll have an AI helper for each one.`,
  },
  {
    id: "sb-02-tools", moduleId: "sbstart", kind: "youtube", minutes: 7, title: "A quick look at AI tools for business",
    youtubeId: "AAyXT7V8-cw",
    videoCredit: { title: "Put Google AI to work for your business", name: "Google", url: "https://www.youtube.com/@Google" },
    body: `Before we get practical, let's see what business AI tools look like. In this short video, Google shows how its AI tools can help with everyday business work, like writing, organising and finding information.

Google is one of several companies offering these tools. Microsoft (Copilot), OpenAI (ChatGPT) and Anthropic (Claude) offer similar assistants. You don't need all of them. **Pick one, learn it well**, and only add another if you have a clear reason.

## Choosing your assistant

Ask yourself:

- **Does it work well on my phone?** Most small traders run their business from a phone.
- **Is the free version enough for now?** Usually yes, at the start.
- **Does it handle my language?** Try a question in English and one in Pidgin and see which feels better.
- **What does it do with my data?** Look at the privacy settings before you start. Many let you switch off using your chats for training.

## Your first business prompt

Every good business prompt includes **who you are** and **who your customers are**:

> *"I sell children's school shoes and bags in Aba. My customers are mostly mothers who want durable items at fair prices. Give me ten ideas to attract more customers before the new school term."*

The more context you give, the more useful the answer. Save a short description of your business in your notes so you can paste it at the start of each chat.

**Privacy check:** describe your business, not your customers. "Mothers in Aba" is fine; "Mrs Chioma Okafor, 0803…" is not.

## Try this today

1. Watch the short video above.
2. Write a **three-sentence description** of your business: what you sell, where, and who buys.
3. Paste it into one AI assistant and ask for **ten ideas** to get more customers this month.
4. Circle the two ideas you could actually try this week.`,
  },
  {
    id: "sb-03-descriptions", moduleId: "sbsell", kind: "text", minutes: 10, title: "Product descriptions and adverts that sell",
    body: `A good product description answers the customer's questions before they ask: *What is it? Is it good quality? Will it fit me? How much? How do I get it?* Many sellers just post a photo and "DM for price". AI can help you do much better, quickly.

## The product description formula

Give the AI these facts:

1. **The product:** "Ladies' Ankara wrap dress".
2. **Key details:** size range, material, colours, what makes it special.
3. **Who it's for:** "working women who want something smart for owambe and the office".
4. **Price and delivery:** "₦18,500, delivery in Lagos within 48 hours".
5. **Tone:** "warm, confident, not exaggerated".

Then ask: *"Write a product description of 80 to 100 words and a short version of 25 words for a caption."*

## Adverts and captions

For an advert, ask for **several options**:

> *"Write five short Instagram captions for my weekend promo: 10% off all children's sandals, Friday to Sunday only. Mix English and a little Pidgin. Add one call to action in each."*

Then pick the best and adjust it. You can also ask for **a script for a 30-second video** where you show the product.

## Honesty sells longer

AI loves big words like "premium", "luxury" and "best in Nigeria". Remove anything that isn't true. If your bag is good-quality synthetic leather, don't let AI call it "genuine leather". Customers who feel cheated don't come back, and they tell their friends.

## Pictures

Some AI tools can edit product photos: removing a messy background or improving the light. That's fine. But **don't use AI to make the product look different from what you'll deliver.** The photo must show the real item.

**Privacy check:** if you use customer photos or reviews in your adverts, ask their permission first, and don't paste their names or numbers into AI tools.

## Try this today

1. Choose your **best-selling product**.
2. Give an AI assistant the five facts above and ask for a long description and a short caption.
3. Remove anything that isn't true. Add one sentence in your own voice.
4. Use the new description on your store page or your next post today.`,
  },
  {
    id: "sb-04-customers", moduleId: "sbsell", kind: "text", minutes: 10, title: "Replying to customers quickly and kindly",
    body: `Customers today expect fast replies. A buyer who waits three hours for "How much?" may buy from someone else. But replying to the same questions all day is tiring. AI can help you prepare **ready-made replies** that you send and adjust yourself.

## Build your reply bank

Ask an AI assistant:

> *"I sell phone accessories in Ikeja. Write short, friendly replies to these common customer questions: (1) How much is it? (2) Do you deliver to Abuja? (3) Is it original? (4) Can I pay on delivery? (5) My order hasn't arrived. Our prices are on our store page. We deliver nationwide in 2 to 5 days. All chargers come with a 3-month warranty. We don't do pay on delivery outside Lagos."*

You'll get a set of replies. Edit them, then save them in your phone's notes or as quick replies in whatever messaging app you use for business.

## Difficult customers

AI is very good at helping you stay calm. Paste an angry message, **with the name and number removed**, and ask:

> *"A customer sent this complaint. Write a calm, polite reply that apologises for the delay, explains what we'll do, and offers a 5% discount on their next order."*

Read it before sending. Make sure you can actually do what it promises.

## Keep the human touch

- **Use the customer's name** when you send the reply (add it yourself).
- **Don't pretend to be a person if a bot is replying.** If you ever use an automatic chatbot, say so.
- **Big problems need you.** Refunds, damaged goods and angry regular customers deserve your personal attention.

## Bookings and appointments

If you sell services (hair, make-up, tailoring, consulting, tutoring), stop collecting bookings by back-and-forth messages. **Booking** on #NotesApp lets customers pick a time and pay for a session, so you spend less time arranging and more time working. AI can help you write the description for each service.

**Privacy check:** a customer's complaint, phone number and address are their personal data. Remove them before pasting into AI, and don't screenshot private chats to post publicly.

## Try this today

1. Write down the **five questions** customers ask you most.
2. Ask an AI assistant to draft short, friendly replies, giving it your real facts (prices, delivery, warranty).
3. Edit and save them on your phone.
4. Use at least two of them today and notice how much time you save.`,
  },
  {
    id: "sb-05-pricing", moduleId: "sbsell", kind: "text", minutes: 10, title: "Pricing with AI help",
    body: `Pricing is one of the hardest decisions in small business, especially when the cost of goods, transport and fuel keeps changing. Price too high and customers walk away; too low and you work hard for nothing. AI can't set your price for you, but it can help you **think clearly** about it.

## Step 1: Know your real cost

Many traders forget hidden costs. Ask AI to help you list them:

> *"I make and sell zobo drinks in 50cl bottles. Help me list every cost I should include in my price: ingredients, bottles, labels, transport, power for the freezer, my time, and anything else I may be forgetting."*

Then fill in **your own numbers**. Example: ingredients ₦180, bottle and label ₦120, power and ice ₦50, transport share ₦40. Total cost: **₦390 per bottle.**

## Step 2: Do the maths together

> *"My cost per bottle is ₦390. Show me my profit per bottle and per 100 bottles if I sell at ₦500, ₦600 and ₦700. Put it in a table."*

AI is good at simple tables. But **check the maths** with your calculator. AI sometimes makes arithmetic mistakes.

## Step 3: Think about the market

AI doesn't know what your competitors charge today. **You** do the market survey: walk round, check other sellers' store pages, ask a few customers. Then ask AI:

> *"Other sellers in my area charge ₦500 to ₦800 for similar drinks. Mine are made fresh daily with no preservatives. Suggest three pricing strategies, with the pros and cons of each."*

You might get ideas like a bundle price (three bottles for ₦1,600), a loyalty discount, or a premium price for a better product.

## Step 4: Test and watch

Try a price for two weeks, write down your sales, then adjust. You can also use **discount codes** on your #NotesApp store for promotions, instead of permanently cutting your price.

**Privacy check:** your cost and profit figures are business secrets. That's fine to use with AI for planning, but check the tool's privacy settings, and never paste your bank statements or supplier contracts with names and account numbers.

## Try this today

1. Choose one product. List **every cost** with AI's help, then fill in your real numbers.
2. Ask AI for a profit table at three different prices.
3. Check the maths with your calculator.
4. Decide whether your current price is right, and write down why.`,
  },
  {
    id: "sb-06-stock-books", moduleId: "sbrun", kind: "youtube", minutes: 25, title: "Stock and bookkeeping help",
    youtubeId: "GUQNQnJrabk",
    videoCredit: { title: "Google Gemini Complete Tutorial: AI Tools for Business (Beginner Guide)", name: "Learn With Shopify", url: "https://www.youtube.com/@learnwithshopify" },
    body: `Many small businesses keep their records in their heads or in a notebook that gets lost. When you don't know your numbers, you can't tell which products make money, which ones sit on the shelf, or whether you made a profit this month. AI can help you set up **simple records** and make sense of them.

In this video, Learn With Shopify gives a beginner's tutorial on using Google's Gemini for business tasks. Watch it to see how an AI assistant handles real business requests, then use the steps below for your stock and books. The same ideas work with ChatGPT, Claude or Copilot.

## A simple stock sheet

Ask AI:

> *"Create a simple stock sheet for a provision shop with these columns: item, units in stock, cost price, selling price, units sold this week, reorder level. Give it as a table I can copy into Google Sheets or Excel."*

Fill it in once a week. Then ask:

> *"Here is my stock sheet [paste the numbers, no customer names]. Which items are selling fastest? Which are slow? Which should I reorder?"*

## Simple bookkeeping

At minimum, record **money in** and **money out** every day:

| Date | Money in (₦) | Money out (₦) | What for |
|---|---|---|---|
| 3 Nov | 45,000 | 12,000 | Sales; restock of noodles |

At the end of the month, paste the totals into an AI assistant and ask: *"Summarise my month. What was my profit? Which costs grew the most? What should I watch next month?"*

Remember:

- **AI can make maths mistakes.** Check totals with your calculator or spreadsheet formulas.
- **AI is not your accountant.** For tax returns, loans and official accounts, use a qualified accountant.
- **Keep receipts.** Snap a photo of every receipt and store it in one folder.

## If you can't use spreadsheets yet

Ask AI to teach you: *"Teach me how to add up a column in Google Sheets, step by step, for a complete beginner."* Ten minutes of learning saves hours every month.

**Privacy check:** before pasting any records, remove customer names, phone numbers, bank account numbers and supplier details. Summaries and totals are usually enough for AI to help you.

## Try this today

1. Watch the video above.
2. Ask an AI assistant to make you a **stock sheet** for your business.
3. Fill it in for your **top ten items**.
4. Start a **money in, money out** record today, even if it's just in your notebook.`,
  },
  {
    id: "sb-07-forecast", moduleId: "sbrun", kind: "text", minutes: 10, title: "Simple sales forecasts",
    body: `A forecast is an educated guess about the future: *"How much will I sell next month?"* Big companies spend a lot on forecasting. You can do a simple version with your own records and an AI assistant, and it can stop you from over-buying stock or running out at the busiest time.

## What you need

At least **three months** of sales records, better six or twelve. Even rough weekly totals help.

## Ask the right question

> *"Here are my weekly sales in naira for the last 12 weeks: [numbers]. My business is a children's clothing shop in Ibadan. School resumes in January, and December has Christmas. Estimate my sales for the next 8 weeks. Explain your reasoning simply and give a low, medium and high estimate."*

The **low, medium, high** part is important. A forecast is never certain. Planning for a range keeps you safe.

## Use what you know

AI doesn't know your town. You do. Tell it about:

- **Seasons:** festive periods, school resumption, Ramadan, harvest time, the rainy season.
- **Events:** a new estate opening nearby, a competitor closing, roadworks blocking your street.
- **Money:** salaries late this month? Fuel prices up?

Then ask it to adjust the forecast.

## Turn the forecast into action

> *"Based on the medium forecast, how many units of each of my top five items should I stock for December, if I want to keep two weeks of extra stock?"*

Then **sense-check** it. Can you afford that much stock? Do you have space? Would a supplier give you credit?

## Learn from mistakes

At the end of each month, compare the forecast with what really happened. Ask AI: *"My forecast was ₦600,000 but I sold ₦480,000. What might explain the difference, and how should I adjust next month?"*

**Privacy check:** sales totals are fine to use. Don't paste customer lists or payment details into the chat.

## Try this today

1. Write down your weekly or monthly sales for as far back as you can find.
2. Ask an AI assistant for a **low, medium and high** forecast for the next month, adding what you know about seasons and events.
3. Decide on one action, such as how much stock to buy, based on the medium forecast.
4. Put a reminder in your phone to compare the forecast with reality at the end of the month.`,
  },
  {
    id: "sb-08-online", moduleId: "sbgrow", kind: "text", minutes: 11, title: "Selling online with AI help",
    body: `Selling online lets customers find you when your shop is closed, from cities you've never visited. But scattered posts and "DM for price" can make you look unprofessional and lose sales. The fix is **one clear home** for your business, with AI helping you fill it.

## Your store on #NotesApp

On #NotesApp, you can open **your own store** to sell physical goods, digital downloads and more, and your items can also appear in **Notes Market**, where buyers browse across many sellers. Customers can see your prices, pay, and track their orders without endless back-and-forth messages. Payments are in naira.

If you sell services, use **Booking** so customers can choose a time and pay for a session. If you have expertise to share (cooking, sewing, fixing phones, running a business), you can even teach a course on **Notes Academy**.

## Let AI help you set it up

Use an AI assistant (or **Nana AI** on #NotesApp for writing help) for:

1. **Your store description:** *"Write a 60-word store description for a family business selling handmade Aso-oke and accessories in Iseyin. Warm, proud, trustworthy."*
2. **Item titles:** clear and searchable. *"Suggest five product titles for a 6-yard Aso-oke set, under 60 characters each, that buyers would search for."*
3. **Item descriptions:** use the formula from the earlier lesson.
4. **Policies:** *"Write a short, fair returns policy for a fashion store: returns within 7 days if unworn, buyer pays return delivery unless the item is faulty."* Then check it suits your business.
5. **Discount ideas:** plan a promotion and create a **discount code** for it in your store.

## Build trust

Online buyers worry about being cheated. Build trust by:

- Using **real photos** of your real products.
- Being **clear about delivery times and costs**.
- Replying to questions politely and quickly (your reply bank helps).
- Asking happy customers to leave a review.

## Bring people back

Customers who bought once are your best future customers. Post useful content regularly on #NotesApp: a journal post on "How to care for Aso-oke", a short tutorial, a new arrival. AI can help you plan a month of post ideas in minutes.

**Privacy check:** your store collects customers' names, addresses and phone numbers for delivery. Use them only for that order and for messages they've agreed to. Never paste them into public AI tools, and never sell or share your customer list.

## Try this today

1. Ask an AI assistant (or Nana AI) to draft your **store description** and **titles for your top three items**.
2. Edit them so they're true and sound like you.
3. Set up or update your store on #NotesApp with these, using real photos.
4. Ask AI for **eight post ideas** for the next month, and put them in your calendar.`,
  },
  {
    id: "sb-09-plan", moduleId: "sbgrow", kind: "text", minutes: 7, title: "Your 30-day AI plan for your business",
    body: `You now have AI helpers for writing, customer replies, pricing, stock and bookkeeping, forecasting and selling online. The final step is to make it a **habit**, without letting it take over your business or your customers' trust.

## Your weekly AI routine (about one hour a week)

- **Monday (15 minutes):** update your stock sheet and money in/out record. Ask AI for a quick summary.
- **Wednesday (15 minutes):** write two posts or product descriptions with AI help.
- **Friday (15 minutes):** review customer messages. Improve your reply bank.
- **End of month (15 minutes):** compare your forecast with reality and plan next month.

## Your business AI rules

Write these on a card near your work area:

1. **AI drafts, I decide.**
2. **I check every number.**
3. **I never paste customer names, phone numbers, addresses or payment details into public AI tools.**
4. **I only say what's true about my products.**
5. **Big problems get my personal attention.**

## Customers' data and the law

Nigeria's **Data Protection Act 2023** applies to businesses that handle personal data, and the **Nigeria Data Protection Commission (ndpc.gov.ng)** supervises it. For a small business, good habits include: collect only what you need, keep it safe (lock your phone, use strong passwords), don't share it, delete it when you no longer need it, and tell customers how you use it. If you're growing fast or handling a lot of customer data, get advice on whether you need to do more.

## Keep learning

On **Notes Academy**, look for courses on marketing, bookkeeping and selling online. Join a **Community** on #NotesApp for traders and business owners, where you can share what's working and learn from others.

## Try this today

1. Put the **weekly AI routine** into your phone's calendar.
2. Write your **five business AI rules** on a card.
3. Look back at the list of three time-consuming tasks you made in the first lesson. Write which AI helper you'll use for each.
4. Take the quiz that follows and claim your certificate.`,
  },
  {
    id: "sb-10-quiz", moduleId: "sbgrow", kind: "quiz", minutes: 6, title: "Check what you've learnt",
    quiz: {
      passPercent: 70,
      questions: [
        { id: "sbq1", prompt: "What is the main rule of using AI in your business?", options: ["AI decides, you follow", "AI drafts, you decide", "Use AI for everything", "Never use AI"], answer: 1, explain: "AI is a helper. You know your customers and you're responsible for the result." },
        { id: "sbq2", prompt: "AI writes \"genuine Italian leather\" for a bag made of good synthetic leather. What should you do?", options: ["Keep it: it sounds better", "Change it to the truth: good-quality synthetic leather", "Delete the whole description", "Raise the price"], answer: 1, explain: "Only say what's true. Customers who feel cheated don't come back and tell others." },
        { id: "sbq3", prompt: "Which is safe to paste into a public AI assistant?", options: ["A customer's name, phone number and address", "Your bank account details", "Weekly sales totals with no customer details", "Your supplier's contract with account numbers"], answer: 2, explain: "Totals and summaries are fine. Customers' personal data and financial details must stay out." },
        { id: "sbq4", prompt: "AI gives you a profit table. What should you do before using it?", options: ["Trust it: computers can't get maths wrong", "Check the maths with a calculator or spreadsheet", "Post it online", "Ignore it"], answer: 1, explain: "AI assistants can make arithmetic mistakes. Always check the numbers." },
        { id: "sbq5", prompt: "Why ask AI for a low, medium and high sales forecast?", options: ["Because forecasts are always certain", "To plan safely for a range of outcomes", "Because AI can't do one number", "To confuse your suppliers"], answer: 1, explain: "No forecast is certain. A range helps you avoid over-buying or running out." },
        { id: "sbq6", prompt: "You sell hair-styling services. What's the best way to stop arranging appointments by endless messages?", options: ["Ask customers to just show up", "Use Booking on #NotesApp so customers choose a time and pay", "Stop taking appointments", "Ask AI to remember your schedule"], answer: 1, explain: "Booking lets customers pick a time and pay for a session, so you spend more time working." },
        { id: "sbq7", prompt: "Which law sets rules for how Nigerian businesses handle customers' personal data?", options: ["The Nigeria Data Protection Act 2023", "The Land Use Act", "The Companies Income Tax Act only", "There is no such law"], answer: 0, explain: "The NDPA 2023 applies to personal data, and the Nigeria Data Protection Commission supervises it." },
      ],
    },
  },
];

export const AI_SMALL_BUSINESS: SeedCourse = {
  key: "ai-small-businesses-traders",
  ownerUsername: "lwb", byline: "Emmanuel Adams",
  slug: "ai-for-small-businesses-and-traders",
  title: "AI for Small Businesses and Traders",
  cover: "/images/academy/covers/ai-for-small-businesses-and-traders.webp",
  summary: `Save time and sell more, with AI as your shop assistant.

A practical course for traders, shop owners and small business people in Nigeria and across Africa. You'll use AI assistants to write product descriptions and adverts, reply to customers quickly and kindly, think through your prices, keep simple stock and bookkeeping records, make rough sales forecasts, and set up a clear, trustworthy store online on #NotesApp.

Every lesson has a "Try this today" exercise you can do on your phone, plus simple rules for keeping your customers' data safe under Nigeria's Data Protection Act 2023. Written by Emmanuel Adams for LWB academy.`,
  topics: ["business", "ai", "ecommerce"],
  subtopics: [{ parent: "business", label: "Small Business" }, { parent: "ai", label: "AI Tools" }, { parent: "ecommerce", label: "Online Selling" }],
  level: "beginner", language: "English", format: "self",
  outcomes: [
    "Choose an AI assistant that suits your business",
    "Write honest product descriptions, captions and adverts with AI help",
    "Build a bank of ready replies for common customer questions",
    "Work out your real costs and compare prices with AI help",
    "Keep a simple stock sheet and money in, money out record",
    "Make low, medium and high sales forecasts",
    "Set up a clear store, bookings and promotions on #NotesApp",
    "Keep customers' personal data out of public AI tools",
  ],
  requirements: [
    "A business, or a plan to start one",
    "A smartphone or computer with internet",
    "A notebook and a calculator",
  ],
  modules: [
    { id: "sbstart", title: "Getting started" },
    { id: "sbsell", title: "Sell and talk to customers" },
    { id: "sbrun", title: "Run the numbers" },
    { id: "sbgrow", title: "Grow online" },
  ],
  lessons: LESSONS,
};
