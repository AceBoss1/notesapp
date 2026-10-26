// English Language WAEC/NECO questions for Naija Exam Prep. Original questions and passages; options are written with the
// correct one first and shuffled at build time. Oral English follows British Received Pronunciation (RP), as WAEC uses.

const PASSAGE_MUSA = `When the national grid failed for the third week running, the residents of Sabon Gari in Kano stopped complaining and started looking for Musa.

Two years earlier, Musa had been a secondary-school leaver with no money for university and a head full of questions about the solar panels he saw on the roofs of the rich. Instead of waiting for admission, he attached himself to an electrician on Bello Road who was willing to teach him in exchange for free labour. For eleven months he carried ladders, swept the shop and watched. He learned to test a battery, to read the small print on an inverter and, most of all, to tell a customer the truth about what a system could and could not do.

Now his own shop, painted bright yellow, was the busiest on the street. Customers liked that he never sold them more panels than they needed. "A small house does not need a big system," he would say. "It needs a careful owner." Some of his rivals called this bad business. Musa called it the reason people came back.

His mother, who had once begged him to find "a proper job", now kept his accounts.`;

const PASSAGE_FLOOD = `Every rainy season, the same scene plays out in many Nigerian cities. A heavy downpour lasts an hour, and by evening roads have become rivers, cars are abandoned and traders are bailing water out of their shops with buckets. It is tempting to blame the rain alone. Yet the rain is only part of the story.

Engineers who study urban flooding point to two other causes. The first is the steady loss of open ground. When swamps are filled and gardens are paved over, rainwater that once soaked into the soil has nowhere to go but the streets. The second cause is more embarrassing because it is entirely within our control: the drains are blocked. Plastic bottles, nylon bags and food packs thrown carelessly into gutters collect at narrow points and form dams. Water that should flow to the lagoon backs up instead.

Government can dredge canals and build wider channels, and it must. But no channel is wide enough to carry a city's rubbish as well as its rain. The monthly sanitation exercises of the past were unpopular, but they reminded every household that the gutter in front of its gate was its own responsibility. Until that sense of ownership returns, each new drain will simply be a bigger place to throw waste.`;

const PASSAGE_PURSE = `Chiamaka noticed the purse only when the bus jerked to a stop at Ogui Junction in Enugu. It had slipped down between the seat and the window: a brown leather purse, heavy with something. The woman who had been sitting beside her, a trader with a basket of tomatoes, was already crossing the road.

Chiamaka hesitated. Inside, she could see a thick bundle of notes and an identity card. Her own school fees were three weeks overdue; her father had been promising to pay "by month end" for two months now. For a moment the purse felt less like a burden than an answer.

Then she remembered the trader's face: tired, sunburnt, the kind of face she saw every evening on her own mother. She jumped down from the bus, ignoring the conductor's shout, and ran. When she caught up with the woman at the edge of the market, the trader stared at the purse, then at her, and burst into tears. The money, she explained, was for her son's hospital bill.

The woman tried to press a note into Chiamaka's hand. Chiamaka refused it, but she accepted a single tomato, which she ate slowly on the long walk home.`;

const PASSAGE_FARM = `Ask a class of secondary-school students in Nigeria what they want to become, and you will hear "doctor", "engineer", "lawyer", perhaps "content creator". Very few will say "farmer". For many young people, farming means a cutlass, a hoe and a lifetime of poverty: the life their grandparents worked hard to escape.

This picture is understandable, but it is out of date. Across the country, a new kind of farmer is appearing. In Ogun State, a graduate raises catfish in tanks behind her house and sells them smoked to supermarkets. In Benue, a group of young men use a mobile phone app to learn when to plant and where to get the best price for their yams. These farmers are not escaping technology; they are using it.

None of this means farming is easy. Loans are hard to get, the roads to markets are poor, and storage is a constant worry: many of the tomatoes grown in the North rot before they reach southern cities. But these are problems to be solved, not reasons to stay away. A country that imports food it could grow is not short of opportunities; it is short of people willing to see them.`;

export default {
  waec: {
    list: [
      // comprehension: passage 1 (Musa)
      {
        t: "comprehension", ctx: PASSAGE_MUSA,
        stem: "Why did the residents of Sabon Gari start looking for Musa?",
        o: [
          "Their electricity from the national grid had failed for weeks",
          "They wanted him to teach them how to install panels",
          "His shop had moved to a new street",
          "They wanted to complain about his prices",
        ], ans: 0, d: 1,
        e: "The first sentence links the two events: the national grid had failed for the third week running, so people turned to Musa, who installs and repairs solar systems.",
        why: { B: "Nothing in the passage says the residents wanted to learn the trade themselves.", D: "The passage says customers liked him because he did not oversell; there is no complaint about prices." },
      },
      {
        t: "comprehension", ctx: PASSAGE_MUSA,
        stem: "According to the passage, how did Musa learn his trade?",
        o: [
          "By working without pay for an electrician who taught him",
          "By studying electrical engineering at a university",
          "By reading the instructions printed on inverters",
          "By watching his rivals install solar panels",
        ], ans: 0, d: 1,
        e: "Musa had no money for university, so he worked for an electrician on Bello Road \"in exchange for free labour\" for eleven months, learning as he carried ladders, swept and watched.",
        why: { B: "The passage says he had no money for university and did not wait for admission.", C: "Reading the small print on an inverter was one thing he learned, not how he learned the trade." },
      },
      {
        t: "comprehension", ctx: PASSAGE_MUSA,
        stem: "As used in the passage, \"attached himself to\" an electrician means that Musa",
        o: [
          "joined the electrician as a helper in order to learn",
          "became the electrician's business partner",
          "followed the electrician around without permission",
          "was employed by the electrician on a good salary",
        ], ans: 0, d: 2,
        e: "The rest of the sentence explains the phrase: the electrician taught him \"in exchange for free labour\". Musa joined him as an unpaid helper, which is an apprenticeship.",
        why: { B: "A partner shares ownership; Musa only carried ladders and swept the shop.", D: "He worked for free labour, so he earned no salary." },
      },
      {
        t: "comprehension", ctx: PASSAGE_MUSA,
        stem: "Musa's rivals called his way of working \"bad business\" because he",
        o: [
          "sold customers fewer panels than he could have sold them",
          "charged more than other shops on the street",
          "refused to repair systems he had not installed",
          "painted his shop a bright colour to attract attention",
        ], ans: 0, d: 2,
        e: "The sentence just before says Musa \"never sold them more panels than they needed\". To rivals, turning down extra sales looked like lost profit, so they called it bad business.",
        why: { B: "Prices are not mentioned anywhere in the passage.", D: "The yellow paint is a detail of description; the rivals' comment follows the point about not overselling." },
      },
      {
        t: "comprehension", ctx: PASSAGE_MUSA,
        stem: "What does the last sentence of the passage suggest about Musa's mother?",
        o: [
          "She has come to accept and support the work she once doubted",
          "She still wishes he had found a proper job",
          "She was the one who taught him to keep accounts",
          "She has taken over the running of his shop",
        ], ans: 0, d: 3,
        e: "She once begged him to find \"a proper job\", but now she keeps his accounts. The contrast shows that she has changed her mind and now takes part in his business.",
        why: { B: "Keeping his accounts shows the opposite: she now treats his work as a proper job.", D: "Keeping the accounts is one task; the passage does not say she runs the shop." },
      },
      // comprehension: passage 2 (flooding)
      {
        t: "comprehension", ctx: PASSAGE_FLOOD,
        stem: "Which cause of flooding does the writer describe as \"entirely within our control\"?",
        o: ["Blocked drains", "Heavy rainfall", "The filling of swamps", "Narrow canals"], ans: 0, d: 1,
        e: "In paragraph 2 the writer says the second cause \"is entirely within our control: the drains are blocked\" by bottles, nylon bags and food packs.",
        why: { B: "The writer says rain is only part of the story; nobody controls rainfall.", C: "The filling of swamps is the first cause (loss of open ground), not the one called \"entirely within our control\"." },
      },
      {
        t: "comprehension", ctx: PASSAGE_FLOOD,
        stem: "According to the passage, paving over gardens leads to flooding because",
        o: [
          "rainwater can no longer soak into the soil",
          "the paving stones block the drains",
          "rubbish collects on paved surfaces",
          "paved roads slope towards the lagoon",
        ], ans: 0, d: 2,
        e: "The passage says that when gardens are paved over, rainwater \"that once soaked into the soil has nowhere to go but the streets\". Less open ground means more water on the roads.",
        why: { B: "Blocked drains are a separate cause, caused by rubbish, not by paving.", C: "Rubbish is linked to the drains, not to paved surfaces." },
      },
      {
        t: "comprehension", ctx: PASSAGE_FLOOD,
        stem: "As used in the passage, to \"dredge\" canals means to",
        o: [
          "remove mud and waste from their beds to deepen them",
          "build new walls along their sides",
          "fill them in to create dry land",
          "cover them so that rubbish cannot enter",
        ], ans: 0, d: 2,
        e: "To dredge a canal is to dig out the mud, sand and waste that have settled at the bottom, so that water can flow freely. It sits beside \"build wider channels\" as a way to carry more water.",
        why: { C: "Filling in canals would reduce drainage, the opposite of what the writer wants government to do.", D: "Covering channels is not what dredging means." },
      },
      {
        t: "comprehension", ctx: PASSAGE_FLOOD,
        stem: "In the sentence \"Government can dredge canals and build wider channels, and it must\", the words \"it must\" mean that government",
        o: [
          "has a duty to dredge canals and build wider channels",
          "must stop households from throwing waste",
          "must bring back the monthly sanitation exercise",
          "must blame the rain for the floods",
        ], ans: 0, d: 2,
        e: "\"It must\" is short for \"it must dredge canals and build wider channels\". The writer agrees that this work is government's duty, before adding that it is not enough on its own.",
        why: { B: "Stopping households from dumping waste is the writer's later point, not what \"it must\" refers to.", C: "The sanitation exercise is mentioned in the next sentences, but the writer does not say government must bring it back." },
      },
      {
        t: "comprehension", ctx: PASSAGE_FLOOD,
        stem: "Which of the following best states the writer's main point?",
        o: [
          "New drains will not stop floods unless people stop dumping waste in them",
          "Government alone is to blame for flooding in Nigerian cities",
          "Heavy rain is the main cause of urban flooding",
          "Monthly sanitation exercises should be made compulsory again",
        ], ans: 0, d: 3,
        e: "The passage builds to its last sentence: until households take ownership of their gutters, \"each new drain will simply be a bigger place to throw waste\". Government work is needed, but people's habits must change too.",
        why: { B: "The writer says government \"must\" act but places much of the blame on careless dumping.", C: "The writer says rain is \"only part of the story\".", D: "The writer says the exercises reminded people of their duty, but does not argue they should be compulsory again." },
      },
      // lexis-and-structure
      {
        t: "lexis-and-structure",
        stem: "Choose the option nearest in meaning to the word in capitals: The principal commended the students for their DILIGENT preparation for the examination.",
        o: ["hard-working", "careless", "hurried", "secret"], ans: 0, d: 1,
        e: "Diligent means showing steady care and effort in one's work. The students were praised (commended), which fits hard-working preparation.",
        why: { B: "Careless is close to the opposite of diligent.", C: "Hurried preparation would not usually be praised, and it does not mean diligent." },
      },
      {
        t: "lexis-and-structure",
        stem: "Choose the option opposite in meaning to the word in capitals: The new manager was praised for being FRUGAL with the company's funds.",
        o: ["extravagant", "sparing", "honest", "careful"], ans: 0, d: 3,
        e: "Frugal means using money carefully and avoiding waste. Its opposite is extravagant: spending far more than is necessary.",
        why: { B: "Sparing is a synonym of frugal, not its opposite.", D: "Careful is close in meaning to frugal." },
      },
      {
        t: "lexis-and-structure",
        stem: "Choose the option that best completes the sentence: Neither the teacher nor the students ___ aware of the change in the timetable.",
        o: ["were", "was", "is", "has been"], ans: 0, d: 2,
        e: "With \"neither … nor\", the verb agrees with the subject nearer to it (the rule of proximity). The nearer subject is \"the students\", which is plural, so the verb is \"were\".",
        why: { B: "\"Was\" would agree with \"the teacher\", but the verb agrees with the nearer subject, \"the students\".", C: "\"Is\" is singular and also in the wrong tense for this past-tense sentence." },
      },
      {
        t: "lexis-and-structure",
        stem: "Choose the option that best completes the sentence: By the time the police arrived, the robbers ___.",
        o: ["had escaped", "have escaped", "will have escaped", "escapes"], ans: 0, d: 2,
        e: "Two past actions are compared: the escape happened before the police arrived. The earlier of two past actions takes the past perfect tense, \"had escaped\".",
        why: { B: "\"Have escaped\" is present perfect and does not fit with the past \"arrived\".", C: "\"Will have escaped\" is future perfect and points to the future, not the past." },
      },
      {
        t: "lexis-and-structure",
        stem: "Choose the option that best completes the sentence: Bola is married ___ a doctor who works at the teaching hospital.",
        o: ["to", "with", "by", "for"], ans: 0, d: 1,
        e: "In standard English, a person is married to someone. \"Married with\" is a common error.",
        why: { B: "\"Married with\" is a common error; the correct preposition is \"to\"." },
      },
      {
        t: "lexis-and-structure",
        stem: "After failing the test, Emeka decided to BURN THE MIDNIGHT OIL before the resit. This means that Emeka decided to",
        o: ["study late into the night", "waste money on fuel", "give up his studies", "celebrate before the result"], ans: 0, d: 1,
        e: "To burn the midnight oil is an idiom meaning to work or study until very late at night. It comes from the days when people studied by oil lamps.",
        why: { B: "This takes the idiom literally; no real oil is involved.", C: "Studying late is the opposite of giving up." },
      },
      {
        t: "lexis-and-structure",
        stem: "Which of the following words is spelt correctly? The school has no ___ for visiting athletes.",
        o: ["accommodation", "accomodation", "acommodation", "accommadation"], ans: 0, d: 1,
        e: "Accommodation has a double c and a double m: ac-com-mo-da-tion.",
        why: { B: "This has only one m; the word needs a double m.", C: "This has only one c; the word needs a double c." },
      },
      {
        t: "lexis-and-structure",
        stem: "Which of the following sentences uses \"its\" and \"it's\" correctly?",
        o: [
          "It's time the school repaired its gate.",
          "Its time the school repaired it's gate.",
          "It's time the school repaired it's gate.",
          "Its time the school repaired its gate.",
        ], ans: 0, d: 2,
        e: "\"It's\" is short for \"it is\", so \"It's time\" needs the apostrophe. \"Its\" is the possessive (the gate belonging to the school) and never takes an apostrophe.",
        why: { C: "\"It's gate\" would mean \"it is gate\"; the possessive \"its\" has no apostrophe.", D: "\"Its time\" needs an apostrophe because it means \"it is time\"." },
      },
      {
        t: "lexis-and-structure",
        stem: "\"Had Ngozi known about the test, she would have prepared for it.\" This sentence means that Ngozi",
        o: [
          "did not know about the test, so she did not prepare",
          "knew about the test but did not prepare",
          "knew about the test and prepared well",
          "prepared even though she did not know about the test",
        ], ans: 0, d: 3,
        e: "\"Had Ngozi known\" is a past (third) conditional, the same as \"If Ngozi had known\". It describes something that did not happen: she did not know, and so she did not prepare.",
        why: { B: "The conditional tells us she did not know about the test.", C: "\"Would have prepared\" shows that the preparation did not actually happen." },
      },
      {
        t: "lexis-and-structure",
        stem: "Choose the option that best completes the sentence: Everybody was at the meeting, ___?",
        o: ["weren't they", "wasn't he", "wasn't it", "didn't they"], ans: 0, d: 3,
        e: "\"Everybody\" takes a singular verb (\"was\"), but in the question tag it is referred to with \"they\", and \"they\" needs \"were\". The main clause is positive, so the tag is negative: \"weren't they?\"",
        why: { B: "\"Everybody\" includes men and women, so the tag uses \"they\", not \"he\".", D: "The main verb is \"was\", so the tag repeats the verb \"be\", not \"do\"." },
      },
      // oral-english
      {
        t: "oral-english",
        stem: "Which of the following words contains the vowel sound /ɪ/, as in \"ship\"?",
        o: ["busy", "sheep", "shape", "shop"], ans: 0, d: 2,
        e: "\"Busy\" is pronounced /ˈbɪzi/: although it is spelt with u, its stressed vowel is /ɪ/, the same as in \"ship\".",
        why: { B: "\"Sheep\" has the long vowel /iː/.", C: "\"Shape\" has the diphthong /eɪ/.", D: "\"Shop\" has the vowel /ɒ/." },
      },
      {
        t: "oral-english",
        stem: "Which of the following words has the vowel sound /ɔː/, as in \"caught\"?",
        o: ["court", "coat", "cot", "cut"], ans: 0, d: 1,
        e: "In British RP, \"court\" is pronounced /kɔːt/, exactly like \"caught\". The r is not pronounced before a consonant.",
        why: { B: "\"Coat\" has the diphthong /əʊ/.", C: "\"Cot\" has the short vowel /ɒ/.", D: "\"Cut\" has the vowel /ʌ/." },
      },
      {
        t: "oral-english",
        stem: "Which of the following words contains the diphthong /aɪ/?",
        o: ["height", "weight", "receipt", "eight"], ans: 0, d: 2,
        e: "\"Height\" is pronounced /haɪt/, with the diphthong /aɪ/ as in \"high\". The spelling -eigh- is misleading: in the other words it gives different sounds.",
        why: { B: "\"Weight\" is /weɪt/, with the diphthong /eɪ/.", C: "\"Receipt\" is /rɪˈsiːt/, with the long vowel /iː/ (and a silent p).", D: "\"Eight\" is /eɪt/, with /eɪ/." },
      },
      {
        t: "oral-english",
        stem: "Which of the following words begins with the consonant sound /dʒ/?",
        o: ["gentle", "guest", "yacht", "chorus"], ans: 0, d: 1,
        e: "\"Gentle\" is pronounced /ˈdʒentl/: the g before e is soft, giving /dʒ/ as in \"judge\".",
        why: { B: "\"Guest\" begins with the hard /ɡ/.", C: "\"Yacht\" begins with /j/.", D: "\"Chorus\" begins with /k/." },
      },
      {
        t: "oral-english",
        stem: "Which of the following words ends with the sound /t/ when spoken?",
        o: ["looked", "played", "wanted", "begged"], ans: 0, d: 2,
        e: "The past tense ending -ed is said as /t/ after a voiceless sound. \"Look\" ends in voiceless /k/, so \"looked\" is /lʊkt/.",
        why: { B: "\"Played\" ends in a vowel sound, so -ed is /d/: /pleɪd/.", C: "After /t/ or /d/, -ed is /ɪd/: \"wanted\" is /ˈwɒntɪd/.", D: "\"Beg\" ends in voiced /ɡ/, so -ed is /d/: /beɡd/." },
      },
      {
        t: "oral-english",
        stem: "In which of the following words is the sound /ʃ/ heard?",
        o: ["machine", "chemist", "cereal", "measure"], ans: 0, d: 3,
        e: "In \"machine\" (/məˈʃiːn/), the letters ch stand for /ʃ/, the sound in \"shoe\". This happens in several words borrowed from French.",
        why: { B: "In \"chemist\", ch is said as /k/.", C: "\"Cereal\" begins with /s/.", D: "\"Measure\" has the voiced sound /ʒ/, not /ʃ/." },
      },
      {
        t: "oral-english",
        stem: "Which of the following words is stressed on the second syllable?",
        o: ["examine", "comfort", "jealous", "visit"], ans: 0, d: 1,
        e: "\"Examine\" is pronounced ex-AM-ine, /ɪɡˈzæmɪn/, with the stress on the second syllable.",
        why: { B: "\"Comfort\" is stressed on the first syllable: COM-fort.", C: "\"Jealous\" is stressed on the first syllable: JEA-lous." },
      },
      {
        t: "oral-english",
        stem: "Which of the following words is stressed on the third syllable?",
        o: ["education", "photography", "necessary", "comfortable"], ans: 0, d: 3,
        e: "\"Education\" is ed-u-CA-tion, /ˌedʒuˈkeɪʃn/. Words ending in -tion are stressed on the syllable just before the ending, which here is the third.",
        why: { B: "\"Photography\" is stressed on the second syllable: pho-TOG-ra-phy.", C: "\"Necessary\" is stressed on the first syllable: NE-ces-sa-ry.", D: "\"Comfortable\" is stressed on the first syllable: COM-for-ta-ble." },
      },
      {
        t: "oral-english",
        stem: "In the sentence below, the word in capitals carries the emphatic stress. Which question does the sentence answer?\nMUSA bought the car yesterday.",
        o: [
          "Who bought the car yesterday?",
          "What did Musa buy yesterday?",
          "When did Musa buy the car?",
          "Did Musa sell the car yesterday?",
        ], ans: 0, d: 2,
        e: "Emphatic stress falls on the word that carries the new or important information. Stressing MUSA answers a question about the person: who bought the car.",
        why: { B: "This question would need the stress on CAR.", C: "This question would need the stress on YESTERDAY.", D: "This question would need the stress on BOUGHT, to contrast it with \"sell\"." },
      },
      {
        t: "oral-english",
        stem: "\"Where are you going?\" Which intonation tune is normally used when this question is asked simply to get information?",
        o: ["a falling tune", "a rising tune", "a level tune", "a rising tune on \"Where\" only"], ans: 0, d: 3,
        e: "Questions that begin with a wh-word (who, what, where, when, why, how) normally take a falling tune (Tune 1) in RP when they simply ask for information. Yes/no questions are the ones that normally rise.",
        why: { B: "A rising tune is normal for yes/no questions, or for a wh-question said with surprise or to ask for a repeat.", C: "A level tune is not the normal pattern for questions in English." },
      },
    ],
    free: [0, 3, 5, 8, 10, 13, 15, 18, 20, 23, 26, 29],
  },
  neco: {
    list: [
      // comprehension: passage 1 (purse)
      {
        t: "comprehension", ctx: PASSAGE_PURSE,
        stem: "Where did Chiamaka find the purse?",
        o: [
          "Between the seat and the window of the bus",
          "In the trader's basket of tomatoes",
          "On the road at Ogui Junction",
          "At the edge of the market",
        ], ans: 0, d: 1,
        e: "The passage says the purse \"had slipped down between the seat and the window\" of the bus.",
        why: { C: "Ogui Junction is where the bus stopped, not where the purse was.", D: "The edge of the market is where Chiamaka caught up with the trader." },
      },
      {
        t: "comprehension", ctx: PASSAGE_PURSE,
        stem: "\"For a moment the purse felt less like a burden than an answer.\" This sentence shows that Chiamaka",
        o: [
          "was briefly tempted to use the money to pay her school fees",
          "found the purse too heavy to carry",
          "knew the answer to a question in her school work",
          "wanted to give the purse to the conductor",
        ], ans: 0, d: 2,
        e: "The sentence comes straight after we learn that her fees are overdue. For a moment, the money looked like an \"answer\" to her problem of unpaid fees, so she was tempted to keep it.",
        why: { B: "\"Burden\" here means a troubling responsibility, not physical weight.", C: "\"Answer\" is used figuratively: a solution to her money problem, not to school work." },
      },
      {
        t: "comprehension", ctx: PASSAGE_PURSE,
        stem: "What finally made Chiamaka decide to return the purse?",
        o: [
          "The trader's face reminded her of her own mother",
          "The bus conductor shouted at her to return it",
          "She saw the trader's identity card",
          "She was afraid that someone had seen her take it",
        ], ans: 0, d: 2,
        e: "Paragraph 3 begins \"Then she remembered the trader's face\" and describes it as \"the kind of face she saw every evening on her own mother\". This thought made her run after the woman.",
        why: { B: "The conductor shouted because she jumped down from the bus; she ignored him.", D: "The passage does not mention any fear of being seen." },
      },
      {
        t: "comprehension", ctx: PASSAGE_PURSE,
        stem: "Why did the trader burst into tears?",
        o: [
          "The money she thought she had lost was for her son's hospital bill",
          "Chiamaka had refused to give back the purse",
          "Her tomatoes had been spoilt on the bus",
          "She was angry that Chiamaka had opened the purse",
        ], ans: 0, d: 1,
        e: "She explained that the money was for her son's hospital bill. Getting back money that important, after losing it, moved her to tears of relief.",
        why: { B: "Chiamaka did give back the purse; that is why the trader cried.", D: "Nothing suggests anger; she tried to reward Chiamaka." },
      },
      {
        t: "comprehension", ctx: PASSAGE_PURSE,
        stem: "Chiamaka refused the money but accepted a single tomato. This suggests that she",
        o: [
          "did not want payment for being honest but accepted a small sign of thanks",
          "was too hungry to refuse any food",
          "thought the note offered was too small",
          "wanted to sell the tomato later",
        ], ans: 0, d: 3,
        e: "Taking money would have turned her honesty into a paid service. A single tomato is a small token of gratitude, and accepting it lets the trader say thank you without Chiamaka being rewarded.",
        why: { B: "Nothing in the passage says she was hungry; the tomato matters as a token of thanks, not as food.", C: "She refused the note completely; she did not ask for more." },
      },
      // comprehension: passage 2 (farming)
      {
        t: "comprehension", ctx: PASSAGE_FARM,
        stem: "According to the passage, why do very few students say they want to be farmers?",
        o: [
          "They link farming with hard manual work and poverty",
          "There is no land available for young people",
          "Their teachers discourage them from farming",
          "Farming is not taught in secondary schools",
        ], ans: 0, d: 1,
        e: "Paragraph 1 says that for many young people \"farming means a cutlass, a hoe and a lifetime of poverty\", the life their grandparents tried to escape.",
        why: { B: "Lack of land is not mentioned in the passage.", C: "The passage says nothing about teachers' views." },
      },
      {
        t: "comprehension", ctx: PASSAGE_FARM,
        stem: "When the writer says \"This picture is understandable, but it is out of date\", the writer means that",
        o: [
          "the old image of farming no longer matches how farming is changing",
          "photographs of farms in textbooks are old",
          "young people's career choices are understandable and correct",
          "farming was easier in the past than it is today",
        ], ans: 0, d: 2,
        e: "\"This picture\" refers to the image of farming as cutlass, hoe and poverty. The writer accepts why people think so, but says it no longer describes the new kind of farmer described next.",
        why: { B: "\"Picture\" is used figuratively to mean an idea or image in people's minds, not a photograph.", C: "The writer understands their view but argues it is mistaken." },
      },
      {
        t: "comprehension", ctx: PASSAGE_FARM,
        stem: "The writer mentions the catfish farmer in Ogun State and the yam farmers in Benue to show that",
        o: [
          "young people are farming successfully with modern methods",
          "fish farming pays better than yam farming",
          "farming is only possible in some states",
          "graduates should not become farmers",
        ], ans: 0, d: 2,
        e: "Both examples support the claim that \"a new kind of farmer is appearing\": a graduate with fish tanks selling to supermarkets, and young men using a phone app. They \"are not escaping technology; they are using it\".",
        why: { B: "The passage does not compare the profits of different kinds of farming.", D: "The example of the graduate suggests the opposite." },
      },
      {
        t: "comprehension", ctx: PASSAGE_FARM,
        stem: "Which of the following problems facing farmers is NOT mentioned in the passage?",
        o: ["Lack of rainfall", "Difficulty in getting loans", "Poor roads to markets", "Poor storage"], ans: 0, d: 2,
        e: "Paragraph 3 lists three problems: loans are hard to get, roads to markets are poor, and storage is a constant worry. Rainfall is not mentioned.",
        why: { B: "\"Loans are hard to get\" is in paragraph 3.", D: "\"Storage is a constant worry\" is in paragraph 3, with the example of rotting tomatoes." },
      },
      {
        t: "comprehension", ctx: PASSAGE_FARM,
        stem: "\"A country that imports food it could grow is not short of opportunities; it is short of people willing to see them.\" The writer is suggesting that",
        o: [
          "Nigeria has farming opportunities that people are failing to take",
          "Nigeria should stop importing all food at once",
          "Nigeria does not have enough land to grow its own food",
          "only foreigners can see the opportunities in farming",
        ], ans: 0, d: 3,
        e: "If a country imports food it could grow itself, there is room for local farmers to supply that food. The writer says the opportunity exists; what is missing is people willing to take it up.",
        why: { B: "The writer criticises importing food that could be grown, but does not call for an immediate ban.", C: "\"Food it could grow\" means the country is able to grow it." },
      },
      // lexis-and-structure
      {
        t: "lexis-and-structure",
        stem: "Choose the option nearest in meaning to the word in capitals: The witness gave a LUCID account of the accident at the junction.",
        o: ["clear", "confused", "brief", "false"], ans: 0, d: 3,
        e: "Lucid means clearly expressed and easy to understand. A lucid account is one that is clear.",
        why: { B: "Confused is the opposite of lucid.", C: "A lucid account may be long or short; lucid is about clarity, not length." },
      },
      {
        t: "lexis-and-structure",
        stem: "Choose the option opposite in meaning to the word in capitals: Halima's response to the scholarship offer was ENTHUSIASTIC.",
        o: ["indifferent", "eager", "grateful", "noisy"], ans: 0, d: 1,
        e: "Enthusiastic means showing great interest and excitement. The opposite is indifferent: showing no interest or concern.",
        why: { B: "Eager is close in meaning to enthusiastic.", C: "Grateful is a different feeling, not the opposite of enthusiastic." },
      },
      {
        t: "lexis-and-structure",
        stem: "Choose the option that best completes the sentence: The committee ___ submitted its report to the principal.",
        o: ["has", "have", "are", "were"], ans: 0, d: 2,
        e: "A collective noun takes a singular verb when the group acts as one unit. The pronoun \"its\" shows the committee is treated as one body, so the verb must be singular: \"has submitted\".",
        why: { B: "\"Have\" would treat the committee as separate members, which clashes with the singular \"its\".", C: "\"Are submitted\" is not a correct verb form here, and \"are\" is plural." },
      },
      {
        t: "lexis-and-structure",
        stem: "Choose the option that best completes the sentence: Mathematics ___ my favourite subject.",
        o: ["is", "are", "were", "have been"], ans: 0, d: 1,
        e: "Although it ends in -s, \"mathematics\" is the name of one subject and takes a singular verb: \"Mathematics is…\". Physics, economics and news behave the same way.",
        why: { B: "\"Are\" treats mathematics as plural because of the -s ending." },
      },
      {
        t: "lexis-and-structure",
        stem: "Choose the option that best completes the sentence: If I ___ you, I would accept the offer.",
        o: ["were", "am", "will be", "had been"], ans: 0, d: 2,
        e: "This is an imaginary (second) conditional: I am not you. Formal English uses \"were\" for all persons in this kind of condition: \"If I were you, I would…\".",
        why: { B: "\"Am\" is used for real present conditions and does not go with \"would\".", D: "\"Had been\" belongs to the past (third) conditional, which needs \"would have accepted\"." },
      },
      {
        t: "lexis-and-structure",
        stem: "Choose the option that best completes the sentence: Candidates were warned to abstain ___ examination malpractice.",
        o: ["from", "of", "against", "with"], ans: 0, d: 2,
        e: "The verb \"abstain\" always takes the preposition \"from\": to abstain from something is to keep yourself from doing it.",
        why: { C: "We warn against something, but we abstain from it." },
      },
      {
        t: "lexis-and-structure",
        stem: "When Tola asked to travel to Lagos alone, her father PUT HIS FOOT DOWN. This means that her father",
        o: ["firmly refused to allow it", "stamped his foot in anger", "agreed after some delay", "walked out of the room"], ans: 0, d: 2,
        e: "To put one's foot down is an idiom meaning to insist firmly on something, usually by refusing to allow it.",
        why: { B: "This takes the idiom literally.", C: "Agreeing is the opposite of what the idiom means." },
      },
      {
        t: "lexis-and-structure",
        stem: "Choose the correct spelling to complete the sentence: Please do not ___ your sister in front of her friends.",
        o: ["embarrass", "embarass", "emmbarrass", "embarras"], ans: 0, d: 1,
        e: "Embarrass has a double r and a double s: em-bar-rass.",
        why: { B: "This has only one r; the word needs a double r.", D: "This has only one s at the end; the word needs a double s." },
      },
      {
        t: "lexis-and-structure",
        stem: "\"Scarcely had we entered the hall when the lights went off.\" This sentence means that",
        o: [
          "the lights went off just after we entered the hall",
          "the lights went off before we entered the hall",
          "we rarely enter the hall",
          "we entered the hall long after the lights went off",
        ], ans: 0, d: 3,
        e: "\"Scarcely … when\" shows that one action happened immediately after another. We had only just entered when the lights went off.",
        why: { B: "We were already inside when the lights went off.", C: "\"Scarcely\" here means \"only just\", not \"rarely\"." },
      },
      {
        t: "lexis-and-structure",
        stem: "\"The man who lives next door is a doctor.\" The words \"who lives next door\" form",
        o: ["an adjectival clause", "a noun clause", "an adverbial clause of place", "a main clause"], ans: 0, d: 3,
        e: "\"Who lives next door\" has its own verb (lives), so it is a clause. It describes the noun \"man\", telling us which man, so it does the work of an adjective: an adjectival (relative) clause.",
        why: { B: "A noun clause would act as subject or object of the sentence; this one describes a noun.", C: "It identifies the man rather than telling us where an action happened.", D: "It cannot stand alone; the main clause is \"The man is a doctor\"." },
      },
      // oral-english
      {
        t: "oral-english",
        stem: "Which of the following words contains the vowel sound /ʊ/, as in \"put\"?",
        o: ["woman", "moon", "mud", "mould"], ans: 0, d: 2,
        e: "\"Woman\" is pronounced /ˈwʊmən/: the o in the first syllable is said as the short /ʊ/ in \"put\".",
        why: { B: "\"Moon\" has the long vowel /uː/.", C: "\"Mud\" has the vowel /ʌ/.", D: "\"Mould\" has the diphthong /əʊ/." },
      },
      {
        t: "oral-english",
        stem: "Which of the following words contains the vowel sound /ʌ/, as in \"cup\"?",
        o: ["country", "county", "court", "cart"], ans: 0, d: 2,
        e: "\"Country\" is pronounced /ˈkʌntri/: the ou spelling here gives /ʌ/, as in \"cup\".",
        why: { B: "\"County\" is /ˈkaʊnti/, with the diphthong /aʊ/.", C: "\"Court\" has /ɔː/.", D: "\"Cart\" has /ɑː/." },
      },
      {
        t: "oral-english",
        stem: "Which of the following words has the same vowel sound as \"hair\"?",
        o: ["their", "here", "hire", "her"], ans: 0, d: 1,
        e: "\"Hair\" is /heə/ and \"their\" is /ðeə/: both have the diphthong /eə/.",
        why: { B: "\"Here\" has the diphthong /ɪə/.", C: "\"Hire\" has /aɪə/.", D: "\"Her\" has the long vowel /ɜː/." },
      },
      {
        t: "oral-english",
        stem: "Which of the following words contains the vowel sound /ɑː/?",
        o: ["heart", "hurt", "hat", "hot"], ans: 0, d: 2,
        e: "\"Heart\" is pronounced /hɑːt/, with the long open vowel /ɑː/ as in \"car\". In RP the r is silent.",
        why: { B: "\"Hurt\" has /ɜː/.", C: "\"Hat\" has the short /æ/.", D: "\"Hot\" has /ɒ/." },
      },
      {
        t: "oral-english",
        stem: "Which of the following words contains the consonant sound /ð/?",
        o: ["breathe", "breath", "thank", "teeth"], ans: 0, d: 3,
        e: "\"Breathe\" (the verb) is /briːð/ and ends in the voiced /ð/, as in \"this\". The noun \"breath\" ends in the voiceless /θ/.",
        why: { B: "\"Breath\" (the noun) is /breθ/, with voiceless /θ/.", C: "\"Thank\" begins with voiceless /θ/.", D: "\"Teeth\" ends with voiceless /θ/." },
      },
      {
        t: "oral-english",
        stem: "In which of the following words is the letter \"b\" silent?",
        o: ["debt", "rubber", "bulb", "robe"], ans: 0, d: 1,
        e: "\"Debt\" is pronounced /det/: the b is not sounded. The same is true of \"doubt\", \"climb\" and \"thumb\".",
        why: { B: "In \"rubber\" the b is sounded: /ˈrʌbə/.", C: "Both b's in \"bulb\" are sounded." },
      },
      {
        t: "oral-english",
        stem: "Which of the following words is stressed on the first syllable?",
        o: ["colleague", "career", "canal", "cement"], ans: 0, d: 2,
        e: "\"Colleague\" is pronounced COL-league, /ˈkɒliːɡ/, with the stress on the first syllable.",
        why: { B: "\"Career\" is stressed on the second syllable: ca-REER.", C: "\"Canal\" is stressed on the second syllable: ca-NAL.", D: "\"Cement\" is stressed on the second syllable: ce-MENT." },
      },
      {
        t: "oral-english",
        stem: "In which of the following words does the main stress fall on the second syllable?",
        o: ["photographer", "photograph", "photographic", "telephone"], ans: 0, d: 3,
        e: "\"Photographer\" is pho-TOG-ra-pher, /fəˈtɒɡrəfə/. Adding -er moves the stress from the first syllable of \"photograph\" to the second.",
        why: { B: "\"Photograph\" is stressed on the first syllable: PHO-to-graph.", C: "\"Photographic\" is stressed on the third syllable: pho-to-GRAPH-ic.", D: "\"Telephone\" is stressed on the first syllable: TE-le-phone." },
      },
      {
        t: "oral-english",
        stem: "Which of the following words rhymes with \"flood\"?",
        o: ["mud", "food", "good", "mood"], ans: 0, d: 1,
        e: "\"Flood\" is /flʌd/ and \"mud\" is /mʌd/: both end in /ʌd/, so they rhyme, even though the spellings differ.",
        why: { B: "\"Food\" is /fuːd/, with the long vowel /uː/.", C: "\"Good\" is /ɡʊd/, with /ʊ/." },
      },
      {
        t: "oral-english",
        stem: "\"Is the library open today?\" Which intonation tune is normally used when this question is asked simply to get a yes or no answer?",
        o: ["a rising tune", "a falling tune", "a level tune", "a falling tune on \"Is\" only"], ans: 0, d: 3,
        e: "Questions that can be answered with yes or no normally end with a rising tune (Tune 2) in RP. Wh-questions and statements normally take a falling tune.",
        why: { B: "A falling tune is normal for statements and wh-questions, not neutral yes/no questions.", C: "A level tune is not the normal pattern for questions in English." },
      },
    ],
    free: [0, 4, 6, 9, 11, 13, 16, 18, 20, 23, 25, 28],
  },
};
