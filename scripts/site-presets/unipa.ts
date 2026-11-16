// The preset for UNIPA's site at /s/unipa (scripts/site-setup.ts unipa): a proposal, built for the owner (16 Nov 2026) to show UNIPA
// before it takes the site over on an Enterprise account and its own domain.
//
// Where the words come from: UNIPA's own public pages at unipa-un.org, read on 16 Nov 2026 and tidied (spelling, British English),
// never added to. Three things are new and are the proposal itself: the Academy, the Fellowship and Alumni Spaces, and joining
// through the Community. The three Academy courses are drafts for UNIPA to check, on public facts only (the Universal Declaration, the
// 2030 Agenda, how a dialogue is run): they say nothing about UNIPA.
//
// Kept out on purpose:
//  - The logo. UNIPA's own shows a globe in a wreath, like the emblem of the United Nations, which only the UN may use or authorise.
//    The account's picture is for UNIPA to upload; the banner here is our own drawing (scripts/site-art.ts).
//  - Any wording that could make a visitor take UNIPA for a United Nations body or an organisation of governments. UNIPA's own FAQ
//    says it is not a UN agency; the site says so in its questions, on About and in its bio.
//  - The Executive Council list (the one published repeats names under different countries) and the founding day (the pages give both
//    10 January and 10 December 1989): both are for UNIPA to confirm. The year, 1989, is used.
//  - The donation link (a PayPal.me link) and the social links (they open pages under another name, Jalpan Global): for UNIPA to
//    confirm. Donations here go through Giving in the Community, which pays only to the organisation's own verified bank account.
import { SITE_URL } from "../../lib/host";
import type { SitePreset } from "../../lib/site-setup-server";

const EMAIL = "info@unipa-un.org";
const NOT_UN = "UNIPA is an independent non-profit association. It is not a United Nations agency and is not part of the United Nations system.";

export const unipa: SitePreset = {
  username: "unipa",
  kit: "intl",
  bio: "United Nations Inter-Pacific Association (UNIPA): a transnational alliance for rights, development and peacebuilding. An independent non-profit association, not a United Nations agency.",
  palette: { id: "ocean", bg: "white" },
  cover: `${SITE_URL}/images/sites/world-map.svg`,
  focus: "services",
  order: ["hero", "info", "services", "team", "faq", "gallery"],
  blocks: {
    hero: {
      on: true, style: "photo", eyebrow: "Diplomacy beyond borders", headline: "Bridging nations, empowering people.",
      subline: "A transnational alliance for rights, development and peacebuilding, connecting voices across continents for justice, equity and sustainable progress.",
      image: `${SITE_URL}/images/sites/world-map.svg`,
      button: { kind: "contact", label: "Become a member", value: "" }, second: { kind: "services", label: "Our work", value: "" },
    },
    info: { on: true, hours: "Secretariat: by email, Monday to Friday", bookingHours: false, whatsapp: "+447438229940", phone: "", email: EMAIL, address: "London, United Kingdom (administrative office, no public access)", mapUrl: "" },
    services: {
      on: true,
      items: [
        { group: "Programmes", name: "Human rights", price: "", note: "Promoting, protecting and advancing fundamental rights and freedoms, in line with the Universal Declaration of Human Rights." },
        { group: "Programmes", name: "Youth and education", price: "", note: "Cultivating globally conscious, socially responsible young leaders through education, mentoring and leadership training." },
        { group: "Programmes", name: "Environment and climate action", price: "", note: "Environmental justice, climate resilience and sustainability, linking grassroots innovation with policy advocacy." },
        { group: "Programmes", name: "Peacebuilding and conflict resolution", price: "", note: "Inclusive, culturally sensitive ways of ending violence and restoring social harmony through dialogue and reconciliation." },
        { group: "Programmes", name: "Intercultural dialogue", price: "", note: "Exchange between people of different cultures, traditions and beliefs, to build mutual respect and peaceful coexistence." },
        { group: "Get involved", name: "Membership", price: "", note: "For individuals, institutions and organisations that share UNIPA's vision: working groups, events, training and a voice." },
        { group: "Get involved", name: "Ambassadors", price: "", note: "Volunteers who represent UNIPA's mission and values in their country, region or institution." },
        { group: "Get involved", name: "Country chapters", price: "", note: "Start an official chapter in your country, region or campus, with three core members and two activities a year." },
        { group: "Get involved", name: "Volunteers and interns", price: "", note: "Give your time and skills to UNIPA's programmes, from wherever you are." },
        { group: "Learn and grow", name: "UNIPA Academy", price: "", note: "Certificate courses in human rights, sustainable development, peacebuilding and leadership, studied online at your own pace." },
        { group: "Learn and grow", name: "Fellowship", price: "", note: "Fellowship and internship placements for members, online and in person, alongside UNIPA's programmes." },
        { group: "Learn and grow", name: "Alumni network", price: "", note: "Academy graduates and past fellows stay in touch, mentor newcomers and come back to speak." },
        { group: "Learn and grow", name: "Excellence Awards", price: "", note: "Annual awards for people and institutions with outstanding work in peace, human rights, education and development." },
      ],
    },
    team: { on: true, items: [{ name: "Dr. Muhammed Haider Ali", role: "Founder and Secretary General", photo: "" }] },
    faq: {
      on: true,
      items: [
        { q: "What is UNIPA?", a: "The United Nations Inter-Pacific Association (UNIPA) is a transnational alliance dedicated to promoting peace, justice, human rights, sustainable development and intercultural cooperation worldwide." },
        { q: "Is UNIPA affiliated with the United Nations?", a: `UNIPA is not a UN agency. ${NOT_UN} It works in alignment with UN values and collaborates with institutions, governments and civil society organisations.` },
        { q: "When was UNIPA founded, and where is it registered?", a: "UNIPA was founded in 1989. It is registered as a non-profit in Sweden (registration no. 802532-3380) and in the United Kingdom (registration no. 14600192), with its headquarters in London." },
        { q: "Who can become a member?", a: "Membership is open to individuals, institutions and organisations that share UNIPA's vision and are committed to its objectives." },
        { q: "How do I join?", a: "Ask to join in our Community on this site and answer the short questions, or write to membership@unipa-un.org with your credentials and a statement of intent. The Secretariat reviews every application." },
        { q: "Are ambassador, chapter and volunteer roles paid?", a: "No. They are voluntary roles: people give their time, leadership and networks to UNIPA's goals." },
        { q: "What is the UNIPA Excellence Award?", a: "UNIPA's highest honour, recognising individuals and institutions for exceptional contributions to peace, justice, human rights and sustainable development. Nominations come with a formal letter, a CV or profile and supporting documents." },
        { q: "Does UNIPA offer internships or volunteer opportunities?", a: "Yes. UNIPA runs internship and volunteer programmes for students and professionals. Write to volunteer@unipa-un.org." },
      ],
    },
  },
  pages: {
    about: `## Who we are

The United Nations Inter-Pacific Association (UNIPA) is a transnational alliance for rights, development and peacebuilding, registered in Sweden and the United Kingdom, with its headquarters in the UK. Guided by the slogan "Diplomacy Beyond Borders", UNIPA connects diverse voices across continents to champion justice, equity and sustainable progress.

We believe in building bridges: between people and nations, between cultures and causes. With chapters around the world, UNIPA is a platform for dialogue, collaboration and grassroots empowerment.

## Our mission

To unite individuals and organisations across borders to protect human rights, promote sustainable development and foster inclusive global cooperation.

## Our vision

A just, peaceful and equitable world where humanity thrives in unity and dignity.

## What we do

- **Advocacy and rights protection.** Campaigning for human rights, equality and inclusive policy reform.
- **Sustainable development projects.** Community-based initiatives in health, education, livelihoods and innovation.
- **Youth empowerment.** Training, mentoring and mobilising young leaders to shape tomorrow's world.
- **Climate action.** Awareness and solutions, from local eco-projects to international environmental advocacy.
- **Peacebuilding and dialogue.** Cross-cultural forums, mediation and mutual understanding through diplomacy and cultural exchange.

## What we value

- **Impact.** We value performance and results, and hold ourselves to high standards.
- **Respect.** We listen to and learn from our constituents, partners, funders and one another.
- **Empowerment.** We believe in the power of knowledge to mobilise people to create a better world.
- **Passion.** We strive for what can be; we do not settle for what is.
- **Collaboration.** We work as a team within UNIPA and with our partners.
- **Innovation.** We seek original approaches to our goals and creative ways of reaching people.

## History

UNIPA was founded in 1989 to promote peace, sustainable development and international cooperation across the Pacific and beyond. It was registered in Sweden and later in the United Kingdom. Today it works through a voluntary leadership structure, with people and organisations from every continent, and operates remotely: professionals, scholars, civil society leaders and youth advocates work together from wherever they are.

## Legal status

${NOT_UN}

- **United Kingdom:** registration no. 14600192, non-profit, registered office in London.
- **Sweden:** registration no. 802532-3380, non-profit, registered office in Stockholm.

UNIPA works by the principles of the Universal Declaration of Human Rights, the Charter of the United Nations and the Sustainable Development Goals. For legal or verification enquiries, write to legal@unipa-un.org.

## Headquarters

UNIPA is headquartered in London, United Kingdom, and works as a remote, decentralised organisation. There is no public access to the administrative office; all official communication is by email.
`,
    contact: `## Write to us

We answer as soon as we can.

- **Central coordination:** info@unipa-un.org
- **Secretary General:** secretariat@unipa-un.org
- **International affairs and diplomacy:** diplomacy@unipa-un.org
- **Membership and chapters:** membership@unipa-un.org
- **Youth empowerment:** youth@unipa-un.org
- **Human rights and justice:** rights@unipa-un.org
- **Sustainable development:** development@unipa-un.org
- **Climate and environment:** climate@unipa-un.org
- **Events and conferences:** events@unipa-un.org
- **Media and communication:** media@unipa-un.org
- **Volunteers and internships:** volunteer@unipa-un.org
- **Finance and donations:** donation@unipa-un.org
- **Legal and compliance:** legal@unipa-un.org

## WhatsApp

+44 7438 229940

## Administrative office

London, United Kingdom. There is no public or member access to the office; please write to us instead.
`,
  },
  community: {
    id: "unipa", name: "UNIPA Community",
    tagline: "Members, ambassadors, chapters, fellows and alumni of UNIPA, in one place.",
    about: `The home of UNIPA's people: members, ambassadors, country chapters, fellows, volunteers and Academy graduates.\n\nAsk to join and answer the short questions; the Secretariat reviews every request. Announcements are open to everyone. The other Spaces are for members only.\n\n${NOT_UN}`,
    contact: `Membership and chapters: membership@unipa-un.org\nGeneral enquiries: ${EMAIL}`,
    cover: `${SITE_URL}/images/sites/world-map.svg`,
    joinMode: "approval",
    questions: ["Which country do you live in?", "How are you joining: member, ambassador, chapter lead, fellow, volunteer or Academy graduate?", "Which UNIPA programme interests you most?", "Tell us briefly about your work or studies."],
    spaces: [
      { id: "announcements", name: "Announcements", visibility: "public", whoPosts: "admins" },
      { id: "members", name: "Members", visibility: "members", whoPosts: "members" },
      { id: "ambassadors", name: "Ambassadors", visibility: "members", whoPosts: "members" },
      { id: "chapters", name: "Country chapters", visibility: "members", whoPosts: "members" },
      { id: "fellows", name: "Fellows", visibility: "members", whoPosts: "members" },
      { id: "alumni", name: "Alumni", visibility: "members", whoPosts: "members" },
    ],
  },
  courses: [
    {
      title: "Human rights: the foundations", level: "beginner", topics: ["law", "community", "education"],
      summary: "Where human rights come from, the treaties that protect them and how to stand up for them responsibly. A short reading course for members, ambassadors and anyone new to rights work.",
      outcomes: ["Explain what makes a right a human right", "Name the documents of the International Bill of Human Rights", "Record what happened to someone safely and fairly"],
      lessons: [
        { title: "What human rights are", minutes: 8, body: `## What human rights are\n\nHuman rights are the rights every person has simply because they are human. Three ideas hold them together:\n\n- **Universal.** They belong to everyone, everywhere, whatever their nationality, sex, colour, religion, language or status.\n- **Inalienable.** They cannot be given up or taken away, though some can be limited by law in narrow cases (a court may limit a convicted person's liberty).\n- **Indivisible and interdependent.** Civil and political rights (a fair trial, free expression) and economic, social and cultural rights (education, health, work) depend on each other.\n\n## The Universal Declaration\n\nOn **10 December 1948** the United Nations General Assembly adopted the **Universal Declaration of Human Rights** in Paris. Its 30 articles set out, for the first time, the rights all people should have. Article 1 opens: "All human beings are born free and equal in dignity and rights."\n\nThe Declaration is not a treaty, but it is the base that later treaties, constitutions and courts have built on. 10 December is kept each year as Human Rights Day.\n\n## Try this\n\nRead the 30 articles (they fit on two pages). Choose the three that matter most where you live, and write one sentence on why.` },
        { title: "The laws that protect them", minutes: 9, body: `## From a declaration to law\n\nIn **1966** two treaties turned the Declaration's promises into duties for the states that join them. Both came into force in 1976:\n\n- the **International Covenant on Civil and Political Rights** (life, liberty, a fair trial, free expression, taking part in public life);\n- the **International Covenant on Economic, Social and Cultural Rights** (work, health, education, an adequate standard of living).\n\nTogether with the Universal Declaration they are called the **International Bill of Human Rights**. Other treaties protect particular groups or ban particular wrongs: against racial discrimination, against discrimination against women, against torture, on the rights of the child, of migrant workers and of persons with disabilities.\n\n## Who checks?\n\n- **Treaty bodies:** committees of independent experts that review each state's reports.\n- **Regional systems:** the European Convention on Human Rights (1950), the American Convention on Human Rights (1969) and the African Charter on Human and Peoples' Rights (1981), each with its own court or commission.\n- **National courts and human rights institutions**, which is where most people find a remedy.\n\n## Try this\n\nFind out which of these treaties your country has joined, and when it last reported.` },
        { title: "Standing up for rights, responsibly", minutes: 10, body: `## Do no harm\n\nThe first rule of rights work is that the person you are trying to help must not be worse off because of you.\n\n- **Consent.** Ask before you record, photograph or share anything. Say who will see it. People may change their mind.\n- **Safety.** Would naming this person put them at risk? If so, don't.\n- **Honesty.** Never promise a result you cannot deliver.\n\n## Recording what happened\n\nA useful record answers plain questions: **who** was affected, **what** happened, **when**, **where**, **who is said to be responsible**, and **how you know** (you saw it, they told you, a document shows it). Keep what you saw apart from what you were told. Check with a second source where you can.\n\n## Passing it on\n\nYou are rarely the one who can fix it. Know who can: a legal aid group, a national human rights institution, a health or counselling service. Refer people to them, with their consent.\n\n## Try this\n\nWrite a half-page record of a public event you attended, using the questions above. Mark each sentence "seen", "told" or "document".` },
      ],
    },
    {
      title: "The Sustainable Development Goals in practice", level: "beginner", topics: ["community", "climate", "education"],
      summary: "What the 17 Goals are, how to choose the ones your project really serves, and how to show what changed. For chapter leads, volunteers and community organisers.",
      outcomes: ["Explain the 2030 Agenda in a minute", "Tie a local project to a goal and a target", "Tell an output from an outcome"],
      lessons: [
        { title: "The 2030 Agenda in brief", minutes: 7, body: `## The 2030 Agenda\n\nIn **September 2015** every member state of the United Nations adopted the **2030 Agenda for Sustainable Development**. At its centre are **17 Sustainable Development Goals** with **169 targets**, to be met by 2030.\n\nThe Goals cover people (ending poverty and hunger, health, education, gender equality), the planet (water, energy, climate, life on land and below water), prosperity (decent work, industry, fair cities), peace (justice and strong institutions) and partnership.\n\nTwo ideas run through all of them:\n\n- **Leave no one behind:** progress counts only when it reaches the people furthest behind.\n- **The Goals are linked:** a school meal is about hunger, health, education and girls staying in school at once.\n\n## Try this\n\nList the 17 Goals from memory, then check. Which did you forget? Those are often the ones a project overlooks.` },
        { title: "Choosing your goals and targets", minutes: 8, body: `## Start from the problem, not the Goal\n\nA project that claims all 17 Goals serves none of them. Begin with the problem in front of you, then find where it sits.\n\n1. **Say the problem in one sentence.** "Girls in our ward leave school at 13."\n2. **Find the Goal.** Quality education (Goal 4), with gender equality (Goal 5).\n3. **Find the target.** Each Goal has numbered targets. Read them; choose the one that says what you are trying to change.\n4. **Say your part.** You will not meet a global target. Say what your project adds: "40 girls in two schools stay enrolled through this year."\n\n## Be honest about scale\n\nSmall, true and measured is worth more than large and vague. Funders and partners trust the first.\n\n## Try this\n\nWrite the four lines above for a project you know.` },
        { title: "Showing what changed", minutes: 9, body: `## Outputs and outcomes\n\n- An **output** is what you did: "We ran 6 workshops for 120 people."\n- An **outcome** is what changed because of it: "Three months on, 70 of them had registered to vote."\n\nReports full of outputs say you were busy. Outcomes say it mattered.\n\n## A baseline\n\nYou can only show change if you know where you started. Before the project, count the thing you hope to change. Count it again after, the same way.\n\n## Keep it simple\n\nOne or two measures you can truly collect are better than ten you cannot. Say how you counted, and what you could not count. Share the result with the people it is about, not only with funders.\n\n## Try this\n\nFor the project from the last lesson, write one output, one outcome, and how you would count each.` },
      ],
    },
    {
      title: "Dialogue and peacebuilding for community leaders", level: "beginner", topics: ["community", "leadership"],
      summary: "How conflicts work, how to bring people into one room and keep the talk fair, and what to do afterwards. For ambassadors, chapter leads and anyone who brings people together.",
      outcomes: ["Tell a position from an interest", "Set ground rules and keep a dialogue fair", "Turn a good conversation into agreed next steps"],
      lessons: [
        { title: "Understanding conflict", minutes: 8, body: `## Conflict is not the same as violence\n\nPeople disagree; that is normal, and often useful. The harm comes when a disagreement is handled through force, humiliation or silence.\n\nPeace researchers speak of two kinds of peace: **negative peace**, where the fighting has stopped, and **positive peace**, where the causes (injustice, exclusion, fear) are being dealt with. A ceasefire is the first. A community that trusts its institutions is the second.\n\n## Positions and interests\n\nA **position** is what someone says they want: "The market must move." An **interest** is why: "My children can't sleep for the noise." Positions clash. Interests can often both be met.\n\nAsk "why does that matter to you?" until you reach the interest.\n\n## Try this\n\nThink of a dispute you know. Write each side's position, then your best guess at their interest. Where do the interests overlap?` },
        { title: "Running a dialogue", minutes: 10, body: `## Before\n\n- **Who must be in the room?** Those affected, and those who can change something. Meet each side alone first.\n- **Where?** A place neither side owns.\n- **What for?** Agree the question beforehand. A dialogue is for understanding; it is not a debate to win or a negotiation to close.\n\n## Ground rules\n\nAgree them aloud at the start: one person speaks at a time; speak for yourself, not for your group; no insults; what is said here is not repeated with names.\n\n## Your job as facilitator\n\nYou are fair to everyone and on nobody's side. Give the quiet ones room. Say back what you heard ("So what worries you is…") before the next person answers. When it gets heated, slow down: pause, or break into smaller groups.\n\n## Try this\n\nWrite four ground rules in your own words, as you would say them to a room.` },
        { title: "After the dialogue", minutes: 7, body: `## Close properly\n\nBefore people leave, say what was agreed, what was not, and what happens next. Write it down in plain words and read it back.\n\n## Small, named next steps\n\n"We will improve relations" changes nothing. "Amina and Peter will meet the ward head by Friday about the water point" does. Each step needs a name and a date.\n\n## Follow up\n\nCheck in when the date comes. Trust grows when small promises are kept.\n\n## Do no harm\n\nAsk who might be put at risk by having taken part, and what you can do about it. Do not publish names or photographs without consent.\n\n## Try this\n\nWrite three next steps from a meeting you attended recently, each with a name and a date.` },
      ],
    },
  ],
  // UNIPA's own posts, with their own dates and words.
  news: [
    { slug: "unipa-anthem-released", title: "UNIPA announces the formal release of the UNIPA Anthem", date: "2025-08-26T14:03:53.000Z", topics: ["news", "community"], content: "The United Nations Inter-Pacific Association (UNIPA) is pleased to announce the formal release of the UNIPA Anthem, symbolising our shared commitment to peace, justice and global cooperation.\n\nIn accordance with the directive of the Secretary-General, UNIPA offices, chapters and missions will raise the UNIPA flag and render the anthem at the start of official functions, meetings and ceremonial gatherings. The official recording will be sent to regional and national offices so that it is performed the same way everywhere.\n\nTogether, let us uphold the ideals of UNIPA with unity, dignity and pride." },
    { slug: "unipa-international-day-of-peace-dialogue", title: "UNIPA celebrates the International Day of Peace with a global online dialogue", date: "2025-06-24T06:38:47.000Z", topics: ["news", "community"], content: "To mark the International Day of Peace, UNIPA held a virtual global dialogue that connected participants from across the Inter-Pacific region to exchange ideas on conflict resolution, intercultural understanding and grassroots peacebuilding." },
    { slug: "unipa-roundtable-human-rights-gender-equality-stockholm", title: "Roundtable on human rights and gender equality held in Stockholm", date: "2025-06-24T06:37:46.000Z", topics: ["news", "community"], content: "UNIPA hosted a high-level roundtable in Stockholm on pressing human rights issues and gender equality. Experts, civil society leaders and policymakers shared strategies to advance inclusive policies and support marginalised communities." },
    { slug: "unipa-global-campaign-digital-inclusion", title: "UNIPA launches a global campaign for digital inclusion", date: "2025-06-24T06:36:49.000Z", topics: ["news", "tech"], content: "To bridge the digital divide across the Inter-Pacific region, UNIPA has launched an initiative focused on digital literacy training, access to technology and online safety for underserved communities." },
  ],
};
