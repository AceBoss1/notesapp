// JAMB Use of English, second batch, for Naija Exam Prep. Original questions and passages; options are written with the correct one
// first and shuffled at build time. Oral forms follow British Received Pronunciation (RP), as taught in Nigerian schools.

const PASSAGE_PEPPER = `When Mama Rukayat first agreed to accept bank transfers at her pepper stall in Ipata Market, Ilorin, she did it reluctantly. Her customers had been arriving without cash for months, ever since notes became hard to find, and she was tired of watching them walk away to the next stall. Her nephew opened an account for her on his phone, wrote the account number on a sheet of cardboard and nailed it to the post above her trays.

The first weeks were anxious ones. Every time a customer said "I have sent it", she would stare at her phone, waiting for the alert, while a queue grew behind. Twice the alert never came, and she had to choose between trusting a stranger and insulting a customer. She trusted, and once she was wrong.

Yet by the end of the year she would not go back. She no longer kept a tin of money under her stool, which thieves had once snatched in broad daylight. She could see at a glance how much she had sold each week, something her old notebook had never told her honestly. When the bank offered her a small loan on the strength of those records, she bought a freezer and began selling ground pepper to restaurants.

"Cash is sweet in the hand," she told her nephew, "but it does not remember anything."`;

const PASSAGE_READING = `It has become fashionable to say that young people no longer read. The charge is only half true. A typical student today reads more words in a day than her grandparents did in a week: messages, captions, comments, headlines, notes shared in class group chats. What has changed is not the amount of reading but its kind. Most of it comes in fragments, and most of it is abandoned the moment something brighter appears on the screen.

Reading a book demands a different skill. A novel or a history asks the reader to hold a long argument or a large cast of characters in mind across many pages, and to tolerate a slow chapter for the sake of a later reward. That skill, like a muscle, weakens when it is not used. Teachers notice it first: students who can summarise a two-minute video perfectly may struggle to follow a three-page essay.

The answer is not to throw away the phone, which is also a library in the pocket. It is to practise sustained reading deliberately, as athletes practise endurance. Twenty minutes a day with one text, without switching, is a modest beginning. Schools that have set aside such a period report that students complain for a fortnight and then, quietly, begin to ask for the next book.`;

const PASSAGE_CHALK = `Baba Audu was seventy-one when he enrolled in the adult literacy class held every Thursday evening in the primary school near his house in Bauchi. The other learners were market women and young drivers, and for the first month he sat at the back, saying nothing, his hands folded over his walking stick.

His teacher, a corps member from Ekiti, assumed he had come only for company. Then one evening, as the class was ending, the old man walked slowly to the board, took the chalk from her hand and wrote, in large uneven letters, the name of his late wife. He looked at it for a long time. "For forty years," he said, "I signed with my thumb. Now she has a name I can read."

Nobody spoke. The corps member, who had been counting the weeks until her service year ended, found that she no longer wanted to count.`;

export default {
  jamb: {
    list: [
      // comprehension: passage 1 (Mama Rukayat)
      {
        t: "comprehension", ctx: PASSAGE_PEPPER,
        stem: "Why did Mama Rukayat begin to accept bank transfers at her stall?",
        o: [
          "Customers often had no cash and she was losing sales to other stalls",
          "Her nephew wanted to start a business selling phones",
          "The bank offered her a loan if she opened an account",
          "Thieves had stolen the tin of money under her stool",
        ], ans: 0, d: 1,
        e: "The first paragraph says customers had been arriving without cash and she was tired of watching them walk away to the next stall, so she accepted transfers to keep their business.",
        why: { C: "The loan came at the end of the year, after she had been keeping records, not at the start.", D: "The theft is mentioned as something transfers protected her from later; it is not given as the reason she started." },
      },
      {
        t: "comprehension", ctx: PASSAGE_PEPPER,
        stem: "\"She had to choose between trusting a stranger and insulting a customer.\" This means that when no alert came, Mama Rukayat",
        o: [
          "could either believe the buyer had paid or risk offending someone who might be honest",
          "had to decide whether to sell to strangers or only to regular customers",
          "was forced to report the buyer to the market police",
          "had to choose between two customers who wanted the same pepper",
        ], ans: 0, d: 3,
        e: "Without an alert she could not tell whether the money had been sent. Accepting the customer's word meant trusting a stranger; demanding proof or refusing the goods might insult a buyer who had really paid.",
        why: { B: "The passage does not divide her customers into strangers and regulars; the choice is about one buyer whose payment has not shown.", C: "No police or report is mentioned." },
      },
      {
        t: "comprehension", ctx: PASSAGE_PEPPER,
        stem: "The sentence \"She trusted, and once she was wrong\" suggests that",
        o: [
          "on one occasion a customer took the pepper without really paying",
          "she stopped trusting customers after the first week",
          "both missing alerts turned out to be bank errors",
          "she wrongly accused an honest customer of cheating",
        ], ans: 0, d: 2,
        e: "She chose to trust the customers whose alerts did not arrive. Being \"wrong\" once means that one of those two customers had not actually sent the money, so she lost the sale.",
        why: { B: "The passage shows she kept trusting; nothing says she stopped.", D: "She did not accuse anyone; she trusted them, which is why she could be \"wrong\"." },
      },
      {
        t: "comprehension", ctx: PASSAGE_PEPPER,
        stem: "Which of the following benefits of bank transfers is NOT mentioned in the passage?",
        o: [
          "Lower prices from her suppliers",
          "Less risk of losing cash to thieves",
          "A clearer record of her weekly sales",
          "Being able to obtain a loan",
        ], ans: 0, d: 2,
        e: "The third paragraph gives three benefits: she no longer kept a tin of cash that could be stolen, she could see her weekly sales at a glance, and her records earned her a loan. Nothing is said about her suppliers' prices.",
        why: { B: "The tin of money that thieves had once snatched shows that safety from theft is mentioned.", D: "The bank offered her a loan \"on the strength of those records\"." },
      },
      {
        t: "comprehension", ctx: PASSAGE_PEPPER,
        stem: "The phrase \"something her old notebook had never told her honestly\" suggests that her handwritten records had been",
        o: [
          "incomplete or inaccurate",
          "stolen by her nephew",
          "written in a language she could not read",
          "kept secret from the bank",
        ], ans: 0, d: 3,
        e: "Saying the notebook never told her \"honestly\" how much she sold implies that its figures could not be relied on: entries were missed or wrong. The bank records, by contrast, showed every sale.",
        why: { B: "Nothing suggests the nephew took the notebook; he helped her set up the account.", D: "The point is about how reliable the records were, not about hiding them." },
      },
      {
        t: "comprehension", ctx: PASSAGE_PEPPER,
        stem: "\"Cash is sweet in the hand, but it does not remember anything.\" By this, Mama Rukayat means that cash",
        o: [
          "is pleasant to hold but leaves no record of what was bought and sold",
          "loses its value quickly when prices rise",
          "is easily forgotten by careless traders",
          "should be spent before it is stolen",
        ], ans: 0, d: 3,
        e: "\"Sweet in the hand\" admits that holding cash feels good. \"Does not remember anything\" contrasts it with bank transfers, which keep a record of every payment, the very records that got her the loan.",
        why: { B: "Inflation is not discussed anywhere in the passage.", C: "It is the cash that cannot \"remember\", not traders who forget it." },
      },
      // comprehension: passage 2 (reading)
      {
        t: "comprehension", ctx: PASSAGE_READING,
        stem: "What is the writer's view of the claim that young people no longer read?",
        o: [
          "It is partly true: they read a great deal, but mostly in short fragments",
          "It is completely false, since students read more books than before",
          "It is entirely true, because phones have replaced all reading",
          "It cannot be judged without a scientific survey",
        ], ans: 0, d: 2,
        e: "The writer calls the charge \"only half true\": students read many words every day, but the reading comes in fragments rather than long, sustained texts.",
        why: { B: "The writer does not say they read more books; the extra reading is messages, captions and headlines.", C: "\"Only half true\" rules out \"entirely true\"." },
      },
      {
        t: "comprehension", ctx: PASSAGE_READING,
        stem: "According to the passage, what has changed about young people's reading?",
        o: [
          "The kind of reading they do",
          "The amount of reading they do",
          "The languages they read in",
          "The time of day they read",
        ], ans: 0, d: 1,
        e: "The first paragraph says directly: \"What has changed is not the amount of reading but its kind.\"",
        why: { B: "The writer says the amount has not fallen; students read more words than their grandparents." },
      },
      {
        t: "comprehension", ctx: PASSAGE_READING,
        stem: "The writer mentions students who can summarise a two-minute video but struggle with a three-page essay in order to show that",
        o: [
          "the ability to follow long texts weakens when it is not practised",
          "videos are a better way to learn than essays",
          "teachers set essays that are too long",
          "students summarise better than their teachers",
        ], ans: 0, d: 2,
        e: "The example comes straight after the claim that the skill of sustained reading, \"like a muscle, weakens when it is not used\". It illustrates that weakening.",
        why: { B: "The writer does not rank videos above essays; the point is about a skill that is fading.", C: "Nothing suggests the essays are unreasonable; three pages is short." },
      },
      {
        t: "comprehension", ctx: PASSAGE_READING,
        stem: "What is the writer's attitude to the mobile phone?",
        o: [
          "It is useful and need not be abandoned",
          "It should be banned from schools",
          "It is the only cause of poor reading",
          "It has no place in serious study",
        ], ans: 0, d: 1,
        e: "The writer says \"the answer is not to throw away the phone, which is also a library in the pocket\": the phone is valued, and the remedy is deliberate practice in sustained reading.",
        why: { B: "The writer rejects throwing the phone away and never suggests a ban.", D: "Calling it \"a library in the pocket\" gives it a place in study." },
      },
      {
        t: "comprehension", ctx: PASSAGE_READING,
        stem: "In the passage, sustained reading is compared to",
        o: [
          "an athlete's training for endurance",
          "a teacher marking essays",
          "a library kept in the pocket",
          "a video summarised in two minutes",
        ], ans: 0, d: 1,
        e: "The writer says we should \"practise sustained reading deliberately, as athletes practise endurance\": regular training builds the capacity, just as it does for a runner.",
        why: { C: "\"A library in the pocket\" describes the phone, not sustained reading.", D: "The video is an example of short-form content, the opposite of sustained reading." },
      },
      {
        t: "comprehension", ctx: PASSAGE_READING,
        stem: "\"Students complain for a fortnight and then, quietly, begin to ask for the next book.\" This suggests that",
        o: [
          "early resistance to the reading period gives way to real interest",
          "students complain so much that the period is cancelled",
          "students read only to stop teachers complaining",
          "the reading period lasts for only two weeks",
        ], ans: 0, d: 3,
        e: "After two weeks of complaint, students start asking for more books of their own accord. \"Quietly\" stresses that the change is genuine rather than forced: the habit has taken hold.",
        why: { B: "Students asking for \"the next book\" shows the period continues.", D: "\"A fortnight\" is how long the complaining lasts, not the reading period." },
      },
      // comprehension: passage 3 (Baba Audu)
      {
        t: "comprehension", ctx: PASSAGE_CHALK,
        stem: "Why did the teacher at first think Baba Audu had joined the literacy class?",
        o: [
          "Only for company",
          "To teach the market women",
          "To escort one of the young drivers",
          "Because his late wife had asked him to",
        ], ans: 0, d: 1,
        e: "The passage says the corps member \"assumed he had come only for company\", because he sat silently at the back for a month.",
        why: { D: "His wife is mentioned only when he writes her name; nothing says she asked him to enrol." },
      },
      {
        t: "comprehension", ctx: PASSAGE_CHALK,
        stem: "How did Baba Audu behave during his first month in the class?",
        o: [
          "He was quiet and kept to himself",
          "He interrupted the teacher often",
          "He helped the younger learners",
          "He complained about the lessons",
        ], ans: 0, d: 1,
        e: "For the first month \"he sat at the back, saying nothing, his hands folded over his walking stick\": a picture of a quiet, withdrawn learner.",
        why: { B: "He said nothing, so he did not interrupt.", C: "Nothing shows him helping anyone." },
      },
      {
        t: "comprehension", ctx: PASSAGE_CHALK,
        stem: "\"For forty years I signed with my thumb.\" This tells us that Baba Audu",
        o: [
          "had not been able to write his name and used a thumbprint instead",
          "had hurt his hand forty years earlier",
          "worked as a clerk who signed documents",
          "had refused to sign any document",
        ], ans: 0, d: 2,
        e: "People who cannot write often \"sign\" with an inked thumbprint. Combined with his joining a literacy class, the line shows he had been unable to write for forty years.",
        why: { C: "A clerk would need to read and write, which he could not do.", D: "He did sign, but with his thumb rather than with a pen." },
      },
      {
        t: "comprehension", ctx: PASSAGE_CHALK,
        stem: "\"Nobody spoke.\" The silence after Baba Audu wrote on the board suggests that the class was",
        o: [
          "deeply moved by what he had done",
          "angry that he had taken the chalk",
          "bored and waiting to go home",
          "confused about what he had written",
        ], ans: 0, d: 2,
        e: "The silence follows an emotional moment: an old man writing his late wife's name for the first time. Nobody speaks because they are touched, not because they object or are bored.",
        why: { B: "Nothing suggests anyone was angry; the teacher's feelings change for the better.", D: "He explained clearly what the name meant, so there was nothing to be confused about." },
      },
      {
        t: "comprehension", ctx: PASSAGE_CHALK,
        stem: "The last sentence of the passage suggests that the corps member",
        o: [
          "had found new meaning in her work",
          "had decided to extend her service year",
          "had lost count of the weeks",
          "was eager to return to Ekiti",
        ], ans: 0, d: 3,
        e: "Before, she was \"counting the weeks\" until her service ended, a sign of impatience. Afterwards she \"no longer wanted to count\": the old man's achievement made her work feel worthwhile.",
        why: { B: "Not wanting to count the weeks is a change of feeling, not a formal decision to extend her service.", C: "\"No longer wanted to count\" is about her attitude, not her memory." },
      },
      // lexis-and-structure
      {
        t: "lexis-and-structure",
        stem: "Choose the option nearest in meaning to the word in capitals: The panel found the witness's story PLAUSIBLE.",
        o: ["believable", "ridiculous", "lengthy", "contradictory"], ans: 0, d: 2,
        e: "\"Plausible\" means seeming reasonable or likely to be true, so the nearest meaning is \"believable\".",
        why: { B: "\"Ridiculous\" is close to the opposite of plausible.", D: "A contradictory story would not seem plausible." },
      },
      {
        t: "lexis-and-structure",
        stem: "Choose the option nearest in meaning to the word in capitals: The governor's AMBIVALENT remarks on the policy left journalists unsure of his position.",
        o: ["mixed", "hostile", "enthusiastic", "careless"], ans: 0, d: 3,
        e: "\"Ambivalent\" means having mixed or contradictory feelings about something. The sentence confirms this: the remarks left journalists unsure where he stood.",
        why: { B: "Hostile remarks would show a clear position against the policy.", C: "Enthusiastic remarks would show clear support, not uncertainty." },
      },
      {
        t: "lexis-and-structure",
        stem: "Choose the option opposite in meaning to the word in capitals: The chairman spoke with great OPTIMISM about the economy.",
        o: ["pessimism", "hope", "humour", "anger"], ans: 0, d: 1,
        e: "\"Optimism\" is the belief that things will turn out well. Its opposite is \"pessimism\", the expectation that things will go badly.",
        why: { B: "\"Hope\" is close in meaning to optimism, not opposite.", D: "Anger is a feeling, but it is not the opposite of expecting good outcomes." },
      },
      {
        t: "lexis-and-structure",
        stem: "Choose the option opposite in meaning to the word in capitals: Nkechi's ADAMANT refusal to change her answer surprised the examiners.",
        o: ["yielding", "stubborn", "polite", "sudden"], ans: 0, d: 2,
        e: "\"Adamant\" means firm and unwilling to change one's mind. The opposite is \"yielding\": willing to give way.",
        why: { B: "\"Stubborn\" has nearly the same meaning as adamant.", D: "\"Sudden\" refers to timing, not firmness." },
      },
      {
        t: "lexis-and-structure",
        stem: "Choose the option that best completes the sentence: Zainab is one of the girls who ___ in the school choir.",
        o: ["sing", "sings", "is singing", "has sung"], ans: 0, d: 3,
        e: "The relative pronoun \"who\" refers to \"the girls\" (plural), not to \"one\". So the verb in the relative clause must be plural: \"the girls who sing\".",
        why: { B: "\"Sings\" wrongly makes \"who\" agree with \"one\"; it is the girls who sing.", D: "\"Has sung\" is singular and also changes the meaning to a single past event." },
      },
      {
        t: "lexis-and-structure",
        stem: "Choose the option that best completes the sentence: The number of applicants for the scholarship ___ risen sharply this year.",
        o: ["has", "have", "are", "were"], ans: 0, d: 3,
        e: "The subject is \"the number\" (singular), so it takes \"has\". Compare \"A number of applicants have applied\", where \"a number of\" means \"many\" and takes a plural verb.",
        why: { B: "\"Have\" agrees with \"applicants\", but the head of the subject is \"the number\".", C: "\"Are risen\" is not a correct verb form." },
      },
      {
        t: "lexis-and-structure",
        stem: "Choose the option that best completes the sentence: Hardly ___ the bell rung when the students rushed out of the hall.",
        o: ["had", "has", "did", "was"], ans: 0, d: 2,
        e: "When a sentence begins with \"hardly\", the subject and auxiliary are inverted, and the past perfect is used for the earlier action: \"Hardly had the bell rung when…\".",
        why: { B: "\"Has\" is present perfect and clashes with the past tense \"rushed\".", C: "\"Did\" needs the base form (\"did the bell ring\"), not \"rung\"." },
      },
      {
        t: "lexis-and-structure",
        stem: "Choose the option that best completes the sentence: The cashier was accused ___ fraud by the bank's auditors.",
        o: ["of", "for", "with", "on"], ans: 0, d: 1,
        e: "In standard English we accuse someone OF a wrongdoing. (By contrast, someone is \"charged with\" an offence.)",
        why: { B: "\"Accused for\" is a common error.", C: "\"With\" goes with \"charged\", not \"accused\"." },
      },
      {
        t: "lexis-and-structure",
        stem: "Choose the option that best completes the sentence: Ten kilometres ___ a long distance to walk to school every day.",
        o: ["is", "are", "were", "have been"], ans: 0, d: 2,
        e: "A distance, sum of money or period of time treated as a single amount takes a singular verb, even though the noun is plural: \"Ten kilometres is a long distance\".",
        why: { B: "\"Are\" treats the kilometres as separate items, but the sentence is about one total distance.", C: "\"Were\" is both plural and past, while \"every day\" points to a present habit." },
      },
      {
        t: "lexis-and-structure",
        stem: "In her first week at the new school, the teacher was still LEARNING THE ROPES. This means that she was",
        o: [
          "learning how things are done in her new job",
          "learning to climb for a sports competition",
          "getting into trouble with the principal",
          "teaching students to tie knots",
        ], ans: 0, d: 1,
        e: "\"To learn the ropes\" is an idiom meaning to learn the basic procedures of a new job or situation.",
        why: { B: "The idiom is not about real ropes or climbing.", C: "Nothing in the idiom suggests trouble." },
      },
      {
        t: "lexis-and-structure",
        stem: "Winning the national debate was A FEATHER IN ADA'S CAP. This means that the victory was",
        o: [
          "an achievement she could be proud of",
          "a small prize of little value",
          "an unfair advantage given to her",
          "a reason for others to be jealous",
        ], ans: 0, d: 2,
        e: "\"A feather in one's cap\" is an idiom for an achievement that earns praise and pride.",
        why: { B: "The idiom stresses honour, not that the prize is worthless.", D: "Others may be jealous, but that is not what the idiom means." },
      },
      {
        t: "lexis-and-structure",
        stem: "Choose the option that best completes the sentence: By the time the meeting started, the report ___ by the secretary.",
        o: ["had been written", "has been written", "was writing", "had written"], ans: 0, d: 3,
        e: "The report is the thing acted on, so a passive form is needed. The writing was finished before another past action (the meeting started), so the past perfect passive is right: \"had been written\".",
        why: { B: "\"Has been written\" is present perfect and does not fit \"started\".", C: "\"Was writing\" is active: it would mean the report itself was writing something.", D: "\"Had written\" is active and needs an object." },
      },
      {
        t: "lexis-and-structure",
        stem: "Choose the option that best completes the sentence: Let's go to the stadium after lunch, ___?",
        o: ["shall we", "will you", "don't we", "isn't it"], ans: 0, d: 2,
        e: "A suggestion beginning with \"Let's\" (let us) takes the question tag \"shall we?\": \"Let's go, shall we?\"",
        why: { B: "\"Will you?\" is the tag for a command to someone else (\"Close the door, will you?\"), not a suggestion including the speaker.", D: "\"Isn't it?\" is a common error; there is no \"it\" or \"is\" in the sentence." },
      },
      {
        t: "lexis-and-structure",
        stem: "In the sentence \"The FAST will end at sunset\", the word in capitals is used as",
        o: ["a noun", "a verb", "an adjective", "an adverb"], ans: 0, d: 2,
        e: "Here \"fast\" means a period of going without food. It follows the article \"the\" and is the subject of \"will end\", so it is a noun.",
        why: { B: "\"Fast\" is a verb in \"They fast during Ramadan\", but here it follows \"the\" and is the subject.", C: "\"Fast\" is an adjective in \"a fast car\", but here it is not describing a noun." },
      },
      {
        t: "lexis-and-structure",
        stem: "\"We stayed indoors because it was raining heavily.\" The words \"because it was raining heavily\" form",
        o: ["an adverbial clause of reason", "an adjectival clause", "a noun clause", "an adverbial clause of time"], ans: 0, d: 2,
        e: "The clause has its own subject and verb (\"it was raining\") and tells us WHY we stayed indoors. A clause introduced by \"because\" that gives a reason is an adverbial clause of reason.",
        why: { B: "An adjectival clause describes a noun, often beginning with who, which or that.", D: "A clause of time answers \"when?\" and usually begins with when, after, before or until." },
      },
      {
        t: "lexis-and-structure",
        stem: "\"Tunde is not as tall as his younger brother.\" This sentence means that",
        o: [
          "Tunde's younger brother is taller than Tunde",
          "Tunde is taller than his younger brother",
          "Tunde and his younger brother are the same height",
          "Tunde will soon be as tall as his younger brother",
        ], ans: 0, d: 1,
        e: "\"Not as tall as\" means \"shorter than\". If Tunde is shorter than his younger brother, the younger brother is the taller of the two.",
        why: { B: "This reverses the meaning.", C: "\"As tall as\" would mean the same height, but the sentence says \"not as tall as\"." },
      },
      {
        t: "lexis-and-structure",
        stem: "Choose the correctly spelt word to complete the sentence: Being chosen as head girl is a great ___.",
        o: ["privilege", "priviledge", "privelege", "privilage"], ans: 0, d: 2,
        e: "The correct spelling is p-r-i-v-i-l-e-g-e. There is no \"d\" (unlike \"knowledge\"), and the vowels are i, i, e, e.",
        why: { B: "Adding a \"d\" is a common error, copied from words like \"knowledge\".", D: "The last vowel is \"e\", not \"a\"." },
      },
      // oral-forms
      {
        t: "oral-forms",
        stem: "Choose the word that has the same vowel sound as the one in \"tongue\".",
        o: ["young", "tone", "tong", "town"], ans: 0, d: 2,
        e: "\"Tongue\" is /tʌŋ/, with the short vowel /ʌ/ as in \"cup\". \"Young\" is /jʌŋ/, with the same vowel.",
        why: { B: "\"Tone\" has the diphthong /əʊ/.", C: "\"Tong\" has /ɒ/, as in \"pot\"; the spelling misleads.", D: "\"Town\" has the diphthong /aʊ/." },
      },
      {
        t: "oral-forms",
        stem: "Which of these words contains the vowel sound /ɜː/, as in \"bird\"?",
        o: ["journey", "bury", "heart", "board"], ans: 0, d: 3,
        e: "\"Journey\" is /ˈdʒɜːni/: the \"our\" spelling here gives /ɜː/, the same vowel as in \"bird\" and \"word\".",
        why: { B: "\"Bury\" is /ˈberi/, with /e/ as in \"bed\".", C: "\"Heart\" is /hɑːt/, with /ɑː/.", D: "\"Board\" is /bɔːd/, with /ɔː/." },
      },
      {
        t: "oral-forms",
        stem: "Three of these words share the same vowel sound. Which one does not?",
        o: ["paid", "said", "bread", "friend"], ans: 0, d: 1,
        e: "\"Said\" /sed/, \"bread\" /bred/ and \"friend\" /frend/ all have the short vowel /e/. \"Paid\" /peɪd/ has the diphthong /eɪ/.",
        why: { B: "\"Said\" looks like \"paid\" but is pronounced /sed/, with /e/.", D: "\"Friend\" is /frend/, with /e/ despite the \"ie\" spelling." },
      },
      {
        t: "oral-forms",
        stem: "In which of these words is \"ch\" pronounced /k/?",
        o: ["stomach", "chief", "chef", "cheap"], ans: 0, d: 1,
        e: "\"Stomach\" is /ˈstʌmək/: the \"ch\" is pronounced /k/, as in many words from Greek.",
        why: { B: "\"Chief\" begins with /tʃ/.", C: "\"Chef\" (from French) begins with /ʃ/." },
      },
      {
        t: "oral-forms",
        stem: "In which of these words is \"th\" pronounced /t/?",
        o: ["Thomas", "thought", "though", "think"], ans: 0, d: 2,
        e: "In \"Thomas\" /ˈtɒməs/ the \"th\" is pronounced as a plain /t/. This happens in a few names such as Thomas and Thames.",
        why: { B: "\"Thought\" begins with /θ/.", C: "\"Though\" begins with /ð/." },
      },
      {
        t: "oral-forms",
        stem: "In which of these words is the letter \"l\" silent?",
        o: ["palm", "bold", "film", "help"], ans: 0, d: 1,
        e: "\"Palm\" is /pɑːm/: the \"l\" is not pronounced, as in \"calm\" and \"half\".",
        why: { B: "\"Bold\" is /bəʊld/; the /l/ is heard.", C: "\"Film\" is /fɪlm/; the /l/ is heard." },
      },
      {
        t: "oral-forms",
        stem: "In which of these words is the \"-ed\" ending pronounced /ɪd/?",
        o: ["needed", "laughed", "cleaned", "watched"], ans: 0, d: 1,
        e: "The \"-ed\" ending is pronounced /ɪd/ after /t/ or /d/. \"Need\" ends in /d/, so \"needed\" is /ˈniːdɪd/.",
        why: { B: "\"Laughed\" ends in /t/ (after the voiceless /f/).", C: "\"Cleaned\" ends in /d/ (after the voiced /n/).", D: "\"Watched\" ends in /t/ (after the voiceless /tʃ/)." },
      },
      {
        t: "oral-forms",
        stem: "In which of these words is the plural ending pronounced /ɪz/?",
        o: ["bridges", "cups", "bags", "books"], ans: 0, d: 2,
        e: "The plural ending is pronounced /ɪz/ after hissing and hushing sounds such as /s/, /z/, /ʃ/, /tʃ/ and /dʒ/. \"Bridge\" ends in /dʒ/, so \"bridges\" is /ˈbrɪdʒɪz/.",
        why: { B: "\"Cups\" ends in /s/ (after the voiceless /p/).", C: "\"Bags\" ends in /z/ (after the voiced /ɡ/)." },
      },
      {
        t: "oral-forms",
        stem: "Choose the word that carries its main stress on the third syllable.",
        o: ["engineer", "candidate", "government", "exercise"], ans: 0, d: 2,
        e: "\"Engineer\" is en-gi-NEER, /ˌendʒɪˈnɪə/: words ending in -eer are stressed on that ending.",
        why: { B: "\"Candidate\" is stressed on the first syllable: CAN-di-date.", C: "\"Government\" is stressed on the first syllable: GOV-ern-ment." },
      },
      {
        t: "oral-forms",
        stem: "Which of these words has a different stress pattern from the other three?",
        o: ["decide", "borrow", "village", "carpet"], ans: 0, d: 2,
        e: "\"Decide\" is stressed on the second syllable (de-CIDE). \"Borrow\", \"village\" and \"carpet\" are all stressed on the first syllable.",
        why: { B: "BOR-row is stressed on the first syllable, like the other two.", C: "VIL-lage is stressed on the first syllable." },
      },
      {
        t: "oral-forms",
        stem: "In the sentence \"The workers will protest against the new tax\", the word \"protest\" is stressed on",
        o: [
          "the second syllable, because it is a verb",
          "the first syllable, because it is a verb",
          "the first syllable, because it is a noun",
          "both syllables equally",
        ], ans: 0, d: 2,
        e: "Many two-syllable words are stressed on the first syllable as nouns (a PROtest) and on the second as verbs (to proTEST). Here \"protest\" follows \"will\", so it is a verb: pro-TEST.",
        why: { B: "A verb in this group takes second-syllable stress, not first.", C: "In this sentence \"protest\" is a verb, not a noun." },
      },
      {
        t: "oral-forms",
        stem: "Which of these related words is stressed on the third syllable?",
        o: ["democratic", "democracy", "democrat", "demonstrate"], ans: 0, d: 3,
        e: "\"Democratic\" is de-mo-CRA-tic: words ending in -ic are stressed on the syllable just before the ending. The stress moves as the word changes form.",
        why: { B: "\"Democracy\" is stressed on the second syllable: de-MOC-ra-cy.", C: "\"Democrat\" is stressed on the first syllable: DEM-o-crat.", D: "\"Demonstrate\" is stressed on the first syllable: DEM-on-strate." },
      },
      {
        t: "oral-forms",
        stem: "In the sentence below, the word in capitals carries the emphatic stress. Which question does the sentence answer?\nThe principal suspended THREE students yesterday.",
        o: [
          "How many students did the principal suspend yesterday?",
          "Who suspended three students yesterday?",
          "When did the principal suspend three students?",
          "Did the principal expel three students yesterday?",
        ], ans: 0, d: 2,
        e: "Emphatic stress falls on the word that supplies the new or corrected information. Stressing THREE answers a question about the number of students.",
        why: { B: "That question would be answered by stressing PRINCIPAL.", C: "That question would be answered by stressing YESTERDAY.", D: "That question would be answered by stressing SUSPENDED." },
      },
      {
        t: "oral-forms",
        stem: "\"You are the new prefect, aren't you?\" If the speaker says the question tag with a falling tune, the speaker",
        o: [
          "is fairly sure and expects the listener to agree",
          "has no idea and genuinely wants information",
          "is angry with the listener",
          "is giving the listener an order",
        ], ans: 0, d: 3,
        e: "In RP, a question tag with a falling tune asks for confirmation of something the speaker already believes. A rising tune on the tag shows real uncertainty and asks for information.",
        why: { B: "Genuine uncertainty is shown by a rising tune on the tag.", D: "A question tag after a statement is not a command." },
      },
      {
        t: "oral-forms",
        stem: "Which word is represented by the phonetic transcription /ˈwɪmɪn/?",
        o: ["women", "woman", "woven", "wagon"], ans: 0, d: 1,
        e: "/ˈwɪmɪn/ has /ɪ/ in both syllables. This is \"women\": the first \"o\" is pronounced /ɪ/, an unusual spelling.",
        why: { B: "\"Woman\" is /ˈwʊmən/, with /ʊ/ in the first syllable.", C: "\"Woven\" is /ˈwəʊvn/." },
      },
      {
        t: "oral-forms",
        stem: "Which of these words contains the consonant sound /ʒ/?",
        o: ["vision", "mission", "station", "passion"], ans: 0, d: 2,
        e: "\"Vision\" is /ˈvɪʒn/: the \"s\" before \"-ion\" is pronounced /ʒ/, the voiced sound heard in \"measure\".",
        why: { B: "\"Mission\" has the voiceless /ʃ/: /ˈmɪʃn/.", C: "\"Station\" has /ʃ/: /ˈsteɪʃn/." },
      },
    ],
    free: [0, 3, 5, 7, 11, 13, 16, 17, 19, 21, 24, 26, 29, 32, 34, 36, 39, 42, 45, 48],
  },
};
