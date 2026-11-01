// Course 3 of lib/course-seeds-ai.ts: AI for Farmers and Agribusiness. Videos checked with YouTube oEmbed on 1 November 2026.
import type { AiSeedCourse, AiSeedLesson } from "../course-seeds-ai";

const LESSONS: AiSeedLesson[] = [
  {
    id: "fa-01-welcome", moduleId: "fagrow", kind: "text", minutes: 8, title: "Welcome: AI on the farm",
    body: `Welcome. I'm Emmanuel Adams from LWB academy. This course is for farmers, farm managers, cooperative leaders, agro-processors and young people going into agribusiness: the cassava farmer in Ogun, the poultry keeper in Kaduna, the rice grower in Kebbi, the woman processing palm oil in Imo, and the graduate starting a fish farm.

Farming in Africa is hard work, and the risks are real: pests, diseases, late rains, floods, poor prices and expensive inputs. AI won't plough your land or carry your harvest. But on a simple smartphone, it can help you **see problems earlier, plan better, keep records, and find markets, loans and insurance**.

## What you'll learn

1. **See and grow:** identify crop diseases and pests from photos; understand weather and planting advice.
2. **Sell and record:** check market prices, keep farm records, use digital services.
3. **Money and protection:** prepare for loans and insurance, and make a plan.

## Be honest about what AI can do

AI tools on the farm can be very helpful, but:

- **They can be wrong.** A photo app may mistake one disease for another. Always confirm serious problems with an extension officer, an agro-dealer you trust, or a research institute.
- **They don't know your soil.** Local knowledge, yours and your elders', still matters.
- **They need data and charge.** Some apps work offline; many need internet. Plan for that.

## Your farm data is valuable

Your farm's location, your yields, your ID and your bank details are **personal and business data**. Nigeria's **Data Protection Act 2023** protects personal data, and you have the right to know how apps and companies use yours. Before you install a farming app, read what it collects. Before you give your BVN or NIN on a loan form, make sure the organisation is genuine.

## Try this today

1. Write down the **three biggest problems** on your farm or in your agribusiness this year (for example: pests, prices, finance).
2. If you have a smartphone, open an AI assistant (ChatGPT, Gemini, Claude or Copilot) and type: *"I'm a [crop or livestock] farmer in [state]. My biggest problems are [list]. Suggest five practical things I could try this season, and tell me who I should ask to confirm each one."*
3. Read the answer and circle one idea to discuss with your extension officer or cooperative.`,
  },
  {
    id: "fa-02-crop-photos", moduleId: "fagrow", kind: "youtube", minutes: 12, title: "Identifying crop diseases and pests from photos",
    youtubeId: "0tQ__k3G17g",
    videoCredit: { title: "Plantix - A mobile app revolutionizes farming with a little help from AI", name: "Plantix", url: "https://www.youtube.com/@PlantixFarmer" },
    body: `One of the most useful things AI can do for farmers is look at a **photo of a sick leaf** and suggest what's wrong. This is called **image recognition**: the AI has been trained on many thousands of pictures of healthy and diseased plants.

## Two apps to know

In this video, Plantix explains how its mobile app uses AI to help farmers diagnose plant problems from a photo. Plantix is a free app for Android phones: you take a picture of the affected crop, and it suggests the likely disease, pest or nutrient problem and possible treatments. The video is a few years old, and the app has changed since, but the idea is the same.

Another tool built with African farmers in mind is **PlantVillage Nuru**, developed at Penn State University with partners including the International Institute of Tropical Agriculture (IITA). According to IITA and Penn State, Nuru is free, can run **offline** on an Android phone, and was built to recognise cassava diseases such as cassava mosaic disease and cassava brown streak disease, as well as fall armyworm damage on maize.

General AI assistants like ChatGPT, Gemini, Claude and Copilot can also look at photos. You can upload a picture and ask: *"What might be wrong with this cassava leaf? What else could it be?"*

## How to take a good photo

- Use **daylight**, not a torch.
- Get **close**: one or two leaves filling the screen.
- Take **several photos**: the top and underside of the leaf, the stem, and the whole plant.
- Include **healthy and sick** leaves for comparison.

## Always confirm

An app's answer is a **first opinion**, not a final one. Before you spend money on chemicals:

1. Compare the app's answer with a second source (another app, an AI assistant, or a printed guide).
2. Show the photos to your **extension officer**, a trusted agro-dealer or your cooperative.
3. Follow the **label** on any pesticide or fungicide: the right dose, protective clothing, and the waiting time before harvest. Wrong use can poison you, your family and your customers.

**Privacy check:** some apps record the location of your photos. That can help researchers track disease outbreaks, which is good, but read the app's privacy settings so you know what's shared and with whom.

## Try this today

1. Install one plant-diagnosis app, or open an AI assistant that accepts photos.
2. Take clear photos of a plant on your farm (or in your compound) that looks unhealthy.
3. Write down what the app suggests and how confident it seems.
4. Show the result to an extension officer or experienced farmer and compare their opinion.`,
  },
  {
    id: "fa-03-ai-africa", moduleId: "fagrow", kind: "youtube", minutes: 9, title: "What AI farming looks like in Africa today",
    youtubeId: "03ptRLlEHl4",
    videoCredit: { title: "Kenya's AI-powered farms: Farmers use technology to tackle challenges", name: "Al Jazeera English", url: "https://www.youtube.com/@aljazeeraenglish" },
    body: `You'll hear big promises about AI "transforming African agriculture". Some are true; some are hype. It's worth seeing the real picture.

In this video, Al Jazeera English reports from Kenya on how farmers are using AI-powered tools to deal with their challenges. The report also notes that AI was once expected to revolutionise agriculture, but some major investments failed, and it's smaller companies that are now finding practical uses. That's an honest message: **the tools that help most are often the simple, local ones.**

## Questions to ask about any farm-tech tool

Before you pay for, or rely on, any AI farming product, ask:

1. **Does it work for my crop and my area?** A tool trained on maize in Kenya may not know your yam in Benue.
2. **Does it work on my phone and my network?** Offline or SMS options matter in rural areas.
3. **Who is behind it?** A known company, university, research institute or government agency? Or an unknown page asking for money?
4. **What does it cost, really?** Subscription, data, and any equipment.
5. **What does it do with my data?** Your farm's location and yields have value. Who owns them?
6. **Can I talk to a farmer who uses it?** Ask your cooperative or farmer group.

## Beware of farm scams

Some fake "agritech" schemes promise huge returns if you "invest" in a farm or pay a fee for a grant, a loan or a tractor. Warning signs:

- You must pay before you receive anything.
- The returns sound too good to be true.
- They contact you through random messages and won't meet in person.
- They can't show a registered office or real farms.

Check with your state ministry of agriculture, your cooperative or a trusted extension officer before paying anything.

**Privacy check:** fake schemes often collect farmers' BVN, NIN, bank details and phone numbers to steal from them later. Don't give personal details to anyone until you've confirmed who they are, and remember your rights over your data under Nigeria's Data Protection Act 2023.

## Try this today

1. Watch the video above.
2. Think of one farm technology you've heard about (an app, a drone service, a soil test, a market platform).
3. Answer the **six questions** above about it in your notebook.
4. Decide: try it, ask more questions, or avoid it.`,
  },
  {
    id: "fa-04-weather", moduleId: "fagrow", kind: "text", minutes: 10, title: "Weather and planting advice",
    body: `For rain-fed farming, the biggest gamble is the weather. Plant too early and the first false rains fool you; your seeds dry in the ground. Plant too late and you miss the best of the season. Good information, used well, reduces the gamble.

## Start with the official forecast

In Nigeria, the **Nigerian Meteorological Agency (NiMet)** publishes a **Seasonal Climate Prediction (SCP)** each year, with expected rainfall onset and end dates for different parts of the country. The 2026 SCP was launched in Abuja on **10 February 2026**, and NiMet warned farmers that early pre-season showers don't always mean the rainy season has started, and urged them to follow the predicted onset dates for their area. You can find NiMet at **nimet.gov.ng**, and state ministries of agriculture and extension services often share the local advice.

## Where AI helps

AI assistants can't see the sky above your farm, and general chatbots don't produce official forecasts. But they can help you **understand and use** the forecast:

- *"Explain the difference between 'onset of rainfall' and 'cessation', in simple words."*
- *"The predicted onset date for my area is late April. I grow maize and cowpea. Help me plan a planting calendar, with land preparation, planting, weeding, fertiliser and harvest dates."*
- *"What are signs that the rainy season has truly started, and why is planting on the first rains risky?"*
- *"Suggest ways to reduce risk if rains are late: drought-tolerant varieties, staggered planting, mulching."*

Many weather apps on your phone also use AI-assisted models for short-range forecasts (the next few days). Use them for day-to-day decisions like spraying or harvesting, but use the seasonal outlook for planting plans.

## Mix science with experience

Your experience and your community's knowledge matter: older farmers often know local signs. Use the official forecast, AI explanations and local knowledge together, and talk to your extension officer when they disagree.

**Privacy check:** weather apps often ask for your location. That's needed for a local forecast, but check in your phone's settings which apps can see your location, and switch it off for apps that don't need it.

## Try this today

1. Find the predicted **rainfall onset date** for your area from NiMet's Seasonal Climate Prediction, or ask your extension office.
2. Ask an AI assistant to help you draw a **season calendar** for your main crop, starting from that date.
3. Write the calendar on paper and put it where your family or workers can see it.`,
  },
  {
    id: "fa-05-market", moduleId: "fasell", kind: "text", minutes: 9, title: "Market prices and selling your produce",
    body: `Many farmers work hard all season, then sell at a poor price because they don't know what buyers elsewhere are paying, or because they must sell immediately. Better information gives you better bargaining power.

## What AI can and can't tell you

General AI assistants **don't know today's prices** at Mile 12, Bodija or Dawanau market, unless they search the web, and even then the information may be old or wrong. **Never set your price based only on what a chatbot says.**

Better sources for prices:

- Buyers and traders you trust in several markets (call two or three).
- Your **cooperative** or farmer association.
- Agricultural market information services and commodity platforms in your area.
- Extension officers and state agricultural development programmes.

## Where AI does help

Once you have real prices, AI can help you **think**:

- *"Buyers in my village offer ₦38,000 per bag of maize. In the city market 60 km away, it's ₦45,000. Transport costs ₦2,500 per bag and a day of my time. Is it worth taking it to the city? Show me the maths."* (Check the maths yourself.)
- *"I have 40 bags of maize. Prices usually rise a few months after harvest. What are the risks and costs of storing it, and how can I reduce losses from pests and moisture?"*
- *"Write a short, polite message to five buyers asking for their best price for 40 bags of dried maize, delivered on Saturday."*

## Add value and sell online

Processed products often earn more than raw produce: garri, palm oil, honey, smoked fish, plantain chips, dried pepper. If you package them well, you can sell them in **your own store on #NotesApp**, where they can also appear in **Notes Market**, with clear prices, photos and delivery information. AI (or **Nana AI** on #NotesApp) can help you write product descriptions, a label text, and a short story about your farm that buyers will remember.

Be honest about weight, quality and how the product was made. Follow food safety and labelling rules for anything you sell to the public.

**Privacy check:** when you sell to buyers online, you'll collect their names, addresses and phone numbers. Use them only for the order and keep them private.

## Try this today

1. Call or visit **three buyers** in different places and write down their prices for your main product.
2. Ask an AI assistant to compare the options, including transport and your time. Check its maths.
3. If you process any product, ask AI to draft a **product description** for your #NotesApp store.`,
  },
  {
    id: "fa-06-records", moduleId: "fasell", kind: "text", minutes: 10, title: "Farm record keeping made simple",
    body: `If you can't show your records, it's hard to get a loan, insurance or a good buyer, and hard to know which crops or animals actually make you money. Record keeping sounds boring, but it's one of the most powerful things a farmer can do. AI can make it much easier.

## What to record

At minimum, keep records of:

- **Inputs:** seeds, fertiliser, chemicals, feed, with dates, amounts and costs.
- **Labour:** who worked, how many days, how much you paid.
- **Activities:** planting, weeding, spraying, vaccination dates.
- **Output:** how much you harvested or sold, and at what price.
- **Problems:** pests, diseases, floods, deaths of animals.

## Let AI design your record book

> *"I'm a poultry farmer with 500 broilers. Design a simple weekly record sheet I can print or copy into a notebook. Include feed, water, vaccinations, deaths, weight checks and sales."*

> *"I grow cassava on 2 hectares. Create a season record table with columns for date, activity, inputs used, cost in naira and notes."*

You can keep these in a notebook, or in a spreadsheet on your phone (Google Sheets or Excel). Ask AI to teach you the spreadsheet basics if you're new.

## Let AI help you understand your records

At the end of a season, give AI your totals (not your personal details) and ask:

> *"Here are my costs and sales for this cassava season: [totals]. What was my profit per hectare? Which costs were highest? What could I change next season?"*

Check the maths. Then discuss the ideas with your cooperative or extension officer.

## Voice notes and photos

If writing is difficult, record a **voice note** each evening of what you did, and take photos of receipts. Later, you or a family member can turn them into a written record. Some AI tools can transcribe voice notes into text.

**Privacy check:** your records may include workers' names and payments, and your own bank details. Keep them safe, lock your phone, and remove names and account numbers before pasting anything into a public AI tool.

## Try this today

1. Ask an AI assistant to design a **record sheet** for your main crop or livestock.
2. Copy it into a notebook or spreadsheet.
3. Fill in everything you can remember from this week.
4. Set a daily reminder on your phone: "Farm records: 5 minutes".`,
  },
  {
    id: "fa-07-digital-services", moduleId: "fasell", kind: "youtube", minutes: 7, title: "Digital advice services for smallholder farmers",
    youtubeId: "jF4bYqCeDzI",
    videoCredit: { title: "FAO Digital Service Portfolio – enhanced by AI capabilities", name: "Food and Agriculture Organization of the United Nations", url: "https://www.youtube.com/@UNFAO" },
    body: `Big organisations are building digital services to bring farm advice to smallholders, often through simple phones and in local languages.

In this short video, the Food and Agriculture Organization of the United Nations (FAO) introduces AI-driven features added to its **Digital Services Portfolio**, which is designed to support smallholder farmers with information and advice. It's one example of how international and national agencies are using AI to reach farmers who don't have an extension officer nearby.

## The kinds of help available

Across Africa, digital farm services commonly offer:

- **Advice by SMS, voice or app**: planting, fertiliser, pest alerts, in local languages.
- **Weather alerts** for your area.
- **Market information** on prices and buyers.
- **Machinery booking**: for example, **Hello Tractor**, a Nigerian company often called an "Uber for tractors", connects farmers with tractor owners who offer ploughing and other services, booked through booking agents and an app.
- **Learning**: short lessons on good practices.

## How to judge a service

Use the six questions from the earlier lesson: does it work for my crop and area, on my phone, who's behind it, what does it cost, what happens to my data, and can I talk to a farmer who uses it?

## Learn and share with other farmers

Advice is more useful when farmers discuss it together. On #NotesApp, you can join or start a **Community** for your cooperative or farmer group, with **Spaces** for topics like poultry, cassava or market prices, and **events** for training days. Extension officers and experienced farmers can also teach short courses on **Notes Academy**.

**Privacy check:** before you sign up to any digital farm service, find out what data it collects (phone number, location, farm size, yields) and whether it shares it with others, such as input sellers or lenders. You have the right to ask under Nigeria's Data Protection Act 2023.

## Try this today

1. Watch the video above.
2. Ask your extension officer, cooperative or agro-dealer which **digital advice services** farmers in your area use.
3. Try one for two weeks and write down whether its advice was useful and accurate.`,
  },
  {
    id: "fa-08-loans-insurance", moduleId: "famoney", kind: "text", minutes: 11, title: "Getting loans and insurance",
    body: `A good season can be wiped out by a flood, a drought or a disease outbreak. And growth often needs money: for better seeds, irrigation, a tractor service or a processing machine. **Loans** and **insurance** can help, but only if you choose carefully. This lesson is general information, not financial advice.

## Agricultural insurance

Insurance means paying a small amount (a premium) so that if a covered disaster happens, you receive compensation.

- In Nigeria, the **Nigerian Agricultural Insurance Corporation (NAIC)** is the government-owned agricultural insurer (**naic.gov.ng**).
- Some companies offer **index insurance**, which pays out based on measurements like rainfall or average yields in your area, rather than an inspection of your own farm. **Pula**, an insurance technology company based in Kenya, has worked in Nigeria with partners including NIRSAL and NAIC on index-based products, often sold together with input loans.

Questions to ask before you buy insurance:

1. What exactly is covered, and what isn't?
2. How is a payout decided, and how long does it take?
3. What do I need to do to claim?
4. Is the insurer licensed?

AI can help you understand the answers: *"Explain 'index insurance' to a farmer in simple words. What are its advantages and its weaknesses?"*

## Loans

Lenders want to see that you can repay. This is where your **records** from the earlier lesson pay off. AI can help you prepare:

- *"Help me write a simple one-page farm plan for a loan application: what I grow, my land size, last season's costs and sales, what the loan is for, and how I'll repay."*
- *"Here is a loan offer: ₦500,000 over 12 months with these fees [details]. Explain the total cost in simple words and what questions I should ask the lender."*

Check any numbers yourself, and ask the lender to explain everything in writing.

## Sharing equipment

You don't always need a loan to buy machinery. Tractor-hire services like **Hello Tractor** let you pay for ploughing when you need it. In 2022, Hello Tractor and Heifer International also announced a pay-as-you-go financing scheme in Nigeria to help people buy tractors and repay from their hiring income.

## Scam warning

Fake "agric loans" and "government grants" are common. Be careful if:

- you must pay a "processing fee" before receiving a loan
- someone asks for your BVN, card details or OTP over the phone or in a chat
- the offer comes from a random social media page or message

Check with your bank, cooperative, state ministry of agriculture or the official website of the agency named.

**Privacy check:** loan and insurance forms ask for sensitive data: BVN, NIN, bank details, farm location. Only give them to organisations you've confirmed are genuine, and never paste them into an AI tool.

## Try this today

1. Ask an AI assistant to explain **agricultural insurance** and **index insurance** in simple words.
2. Use your records to draft a **one-page farm plan** with AI help.
3. Write down **three questions** you'll ask a lender or insurer before signing anything.`,
  },
  {
    id: "fa-09-plan", moduleId: "famoney", kind: "text", minutes: 7, title: "Your farm AI plan for the season",
    body: `You've seen how AI can help you identify crop problems, plan around the weather, think about prices, keep records, use digital services, and prepare for loans and insurance. Now let's put it into one simple plan for your next season.

## Your season plan

Draw a table with four rows:

| Season stage | AI helper | Who I'll confirm with |
|---|---|---|
| Before planting | Season calendar from the NiMet onset date | Extension officer |
| Growing | Photo diagnosis of pests and diseases | Extension officer, agro-dealer |
| Harvest and sale | Price comparison and buyer messages | Buyers in three markets, cooperative |
| All season | Record sheet and end-of-season summary | My own calculator; an accountant for loans |

## Farmer AI rules

1. **The app suggests; I confirm.**
2. **I follow chemical labels exactly.**
3. **I never pay upfront for a "grant" or "loan".**
4. **I keep my BVN, NIN and bank details private.**
5. **I keep records, every week.**

**Privacy check:** your records, your ID and your bank details are your data. Under Nigeria's Data Protection Act 2023 you can ask any app, lender or insurer what they hold about you and how they use it.

## Grow together

Farmers who learn together do better. Share this course with your cooperative, and use a **Community** on #NotesApp for your group, with Spaces for each crop and events for training days. If you have experience to share, consider teaching a short course on **Notes Academy**.

## A word from me

Your work feeds the nation. AI is just another tool in your hands, like a good hoe or a reliable tractor. Use it with care, keep learning, and keep asking questions.

**Emmanuel Adams**, LWB academy

## Try this today

1. Fill in your **season plan** table for your main crop or livestock.
2. Write the **five farmer AI rules** on a card and keep it with your records.
3. Take the quiz that follows and claim your certificate.`,
  },
  {
    id: "fa-10-quiz", moduleId: "famoney", kind: "quiz", minutes: 6, title: "Check what you've learnt",
    quiz: {
      passPercent: 70,
      questions: [
        { id: "faq1", prompt: "A plant-diagnosis app says your cassava has a disease. What should you do before buying chemicals?", options: ["Buy the strongest chemical you can find", "Confirm with an extension officer or trusted agro-dealer, and follow the label", "Ignore it", "Spray double the dose to be safe"], answer: 1, explain: "Apps can be wrong. Confirm the problem, then use any chemical exactly as the label says." },
        { id: "faq2", prompt: "Which tool was built at Penn State with IITA and can run offline to help recognise cassava diseases?", options: ["PlantVillage Nuru", "A calculator", "A weather app", "A social media page"], answer: 0, explain: "According to IITA and Penn State, PlantVillage Nuru is free, runs offline on Android phones and recognises cassava diseases and fall armyworm damage." },
        { id: "faq3", prompt: "Which Nigerian agency publishes the annual Seasonal Climate Prediction with rainfall onset dates?", options: ["NiMet (Nigerian Meteorological Agency)", "NAFDAC", "NDPC", "WAEC"], answer: 0, explain: "NiMet publishes the Seasonal Climate Prediction. In 2026 it warned farmers not to plant on early false rains." },
        { id: "faq4", prompt: "Can a general AI chatbot tell you today's exact price of maize at your local market?", options: ["Yes, always", "Not reliably: check with real buyers, your cooperative or market information services", "Yes, if you ask twice", "Only on Sundays"], answer: 1, explain: "Chatbots don't reliably know today's local prices. Get real prices, then use AI to compare options." },
        { id: "faq5", prompt: "Why are farm records important for getting a loan?", options: ["They aren't", "They show lenders your costs, sales and ability to repay", "Lenders like long notebooks", "They replace collateral completely"], answer: 1, explain: "Records show what your farm earns and spends, which helps lenders and insurers trust you." },
        { id: "faq6", prompt: "Someone offers you a government farm grant if you first pay a ₦20,000 processing fee. What is this most likely to be?", options: ["A normal procedure", "A scam: check with the agency's official website, your bank or your cooperative", "A good investment", "An insurance premium"], answer: 1, explain: "Paying upfront for a grant or loan is a classic warning sign of a scam." },
        { id: "faq7", prompt: "What does index insurance base its payouts on?", options: ["Measurements like rainfall or average yields in your area", "How nicely you ask", "Your social media followers", "Nothing: it never pays"], answer: 0, explain: "Index insurance pays out based on measured conditions in an area, rather than an inspection of each farm." },
        { id: "faq8", prompt: "Which of these should you never paste into a public AI tool?", options: ["Your crop type", "Your total season costs", "Your BVN and bank account details", "A general question about weeding"], answer: 2, explain: "BVN, NIN and bank details are sensitive. Keep them private and only give them to organisations you've confirmed are genuine." },
      ],
    },
  },
];

export const AI_FARMERS: AiSeedCourse = {
  key: "ai-farmers-agribusiness",
  ownerUsername: "lwb", byline: "Emmanuel Adams",
  slug: "ai-for-farmers-and-agribusiness",
  title: "AI for Farmers and Agribusiness",
  cover: "/images/academy/covers/ai-for-farmers-and-agribusiness.webp",
  summary: `Smarter farming with the phone in your pocket.

A practical course for farmers, cooperatives, agro-processors and young agripreneurs in Nigeria and across Africa. You'll use AI to identify crop diseases and pests from photos (with apps like Plantix and PlantVillage Nuru), plan your season around NiMet's rainfall forecast, compare market prices, keep simple farm records, use digital advice services, and prepare for loans and agricultural insurance, while avoiding farm scams.

Every lesson has a "Try this today" exercise and a privacy check for your farm and personal data. Written by Emmanuel Adams for LWB academy.`,
  topics: ["agriculture", "ai", "africa"],
  subtopics: [{ parent: "agriculture", label: "Agritech" }, { parent: "agriculture", label: "Crop Health" }, { parent: "agriculture", label: "Farm Records" }],
  level: "beginner", language: "English", format: "self",
  outcomes: [
    "Take good crop photos and use AI apps to suggest diseases and pests",
    "Confirm AI diagnoses with extension officers before using chemicals",
    "Judge whether a farm-tech tool is useful, safe and genuine",
    "Plan your season from NiMet's rainfall onset dates",
    "Compare real market prices and selling options with AI help",
    "Keep simple farm records and read your season's profit",
    "Prepare a one-page farm plan for a loan application",
    "Understand agricultural and index insurance",
    "Spot fake grant and loan offers",
  ],
  requirements: [
    "A farm, an agribusiness, or a plan to start one",
    "A smartphone (Android is best for the farming apps)",
    "A notebook and a pen",
  ],
  modules: [
    { id: "fagrow", title: "See and grow" },
    { id: "fasell", title: "Sell and record" },
    { id: "famoney", title: "Money and protection" },
  ],
  lessons: LESSONS,
};
