// English Language WAEC/NECO, second batch, for Naija Exam Prep. Original questions and passages; options are written with the
// correct one first and shuffled at build time. Oral English follows British Received Pronunciation (RP), as WAEC and NECO use.

const PASSAGE_BOREHOLE = `The borehole in Igbo-Ora had been broken for three months when Kehinde's grandmother announced that she would fetch water from the stream again, as she had done as a girl. Nobody believed she meant it. She was seventy, and the stream was two kilometres away, down a slope that turned to mud whenever it rained.

On the first morning, Kehinde found her already at the door with a bucket on her head. He took it from her, half in protest and half in shame, and carried it himself. The next day two of his friends came along, mainly to laugh at him. By the end of the week there were nine boys on the path every morning, and the laughter had turned into a competition to see who could carry the most without spilling a drop.

It was one of those boys, whose uncle worked at the local government secretariat, who finally carried the community's complaint to the right office. Within a month, a technician came to replace the pump.

The boys were almost disappointed. The grandmother was not. "Water that comes easily," she said, "teaches nobody anything. You have learnt something. Now go and read your books."`;

const PASSAGE_SLEEP = `In the weeks before the WASSCE, many students treat sleep as a luxury they cannot afford. They read until two or three in the morning, drink strong coffee to stay awake and boast to one another about how little rest they need. It looks like dedication. In fact, it is often the surest way to waste the hours they are working so hard to gain.

Sleep is not simply a pause in the day's work. While we sleep, the brain sorts through what it has taken in, discarding some things and storing others more firmly. A student who studies a chemistry topic in the evening and then sleeps well is more likely to remember it in the morning than one who stays awake going over it again and again. Tiredness also slows thinking and shortens tempers, so the student who has not slept reads the same paragraph four times and remembers none of it.

None of this is an excuse for laziness. The student who sleeps eight hours but spends the evening scrolling through social media has gained nothing. The lesson is that rest and study are partners, not rivals. A sensible timetable makes room for both, and it starts early enough in the term that the last weeks are for revision, not for panic.`;

const POEM_HARMATTAN = `Harmattan Morning

The sun comes up like a coin seen through water,
pale and unhurried over Kaduna's roofs.
Dust has settled on the windscreens overnight,
writing its fine grey signature on everything.
My mother wraps her shawl twice round her shoulders
and complains, as she does every December,
that her lips have cracked like a dry riverbed.
But the children, who have never known another December,
run to school rubbing their hands together,
laughing at the cold as if they had invented it.`;

const PASSAGE_GOALKEEPER = `Amina was the only girl who played football on the dusty field behind the primary school in Zaria, and for a long time the boys put up with her only because the ball belonged to her. They rarely passed to her, and when they did, it was usually by mistake.

Things changed on the afternoon of the inter-street match against Tudun Wada. With five minutes left and the score level, the team's goalkeeper twisted his ankle. Nobody wanted to take his place; the Tudun Wada strikers were bigger and kicked harder. Amina pushed up her sleeves and walked into the goal before anyone could argue.

She saved two shots. The second struck her in the chest so hard that she sat down in the dust, but she held on to the ball. When the referee blew the final whistle, the boys did not lift her onto their shoulders, as they would have done for one of their own. They did something she valued more. The next afternoon, when they chose sides, she was picked first.`;

const PASSAGE_ESUSU = `Long before banks opened branches in every town, Nigerians had found ways to save. Among the Yoruba it is called esusu or ajo; the Igbo speak of isusu; in the North it is adashe. The idea is the same everywhere. A group of people, often traders or workers who trust one another, agree to contribute a fixed sum at regular intervals. Each time, the whole collection goes to one member, until everyone has had a turn.

The system has obvious weaknesses. It pays no interest, and it depends entirely on honesty: if a member who has already collected stops contributing, the others lose. Yet it has survived for generations because it solves a problem that formal banking often ignores. A market woman who earns a little each day finds it hard to save on her own; the money is always needed for something. The group gives her a reason to put money aside and a lump sum she could never have gathered alone.

Today some banks and mobile apps have copied the idea, offering "target savings" that lock money away until a chosen date. They are, in a sense, paying a compliment to the women who have run such schemes from their market stalls for generations.`;

const PASSAGE_RADIO = `My grandfather's radio was older than my father. It was a heavy wooden box with a cracked dial, and it lived on a shelf above his chair in our compound in Abeokuta. Every evening at seven he switched it on for the news, and every evening the rest of us had to be silent until the newsreader had finished.

When my uncle bought him a smartphone that could stream any station in the world, Grandfather thanked him politely and put it in a drawer. "This one," he said, patting the wooden box, "has never told me a lie it did not believe." None of us understood what he meant, and he refused to explain.

After he died, my father took the radio to a repairer, who said it could not be fixed; the parts had not been made for forty years. My father brought it home anyway and put it back on its shelf, where it still sits, silent, every evening at seven.`;

export default {
  waec: {
    list: [
      // comprehension: passage 1 (the borehole)
      {
        t: "comprehension", ctx: PASSAGE_BOREHOLE,
        stem: "Why did Kehinde's grandmother decide to fetch water from the stream?",
        o: [
          "The borehole had been broken for three months",
          "She wanted to teach the boys a lesson",
          "The stream water was cleaner than the borehole water",
          "Kehinde had refused to fetch water for her",
        ], ans: 0, d: 1,
        e: "The first sentence links the two: the borehole had been broken for three months, so she announced she would go back to the stream.",
        why: { B: "The lesson came at the end, as a result; it was not her reason for going.", D: "Kehinde took the bucket from her the first morning; he never refused." },
      },
      {
        t: "comprehension", ctx: PASSAGE_BOREHOLE,
        stem: "Why did nobody believe that the grandmother meant what she said?",
        o: [
          "She was old and the path to the stream was long and difficult",
          "She often made promises she did not keep",
          "The stream had dried up years before",
          "She had never fetched water in her life",
        ], ans: 0, d: 1,
        e: "The passage gives the reasons straight after \"Nobody believed she meant it\": she was seventy, and the stream was two kilometres away down a slope that turned to mud.",
        why: { C: "The stream still had water; she and the boys fetched from it.", D: "She had fetched water from the stream \"as a girl\"." },
      },
      {
        t: "comprehension", ctx: PASSAGE_BOREHOLE,
        stem: "Kehinde took the bucket \"half in protest and half in shame\". This means that he",
        o: [
          "objected to her doing the work and was embarrassed that he had not done it himself",
          "was angry with his grandmother and ashamed of her",
          "protested to the local government and felt ashamed of the village",
          "did not want to carry the bucket but was forced to",
        ], ans: 0, d: 3,
        e: "\"Protest\" shows he did not want a seventy-year-old woman carrying water; \"shame\" shows he felt embarrassed that she was doing work a young man like him should be doing.",
        why: { B: "His shame is about himself, not about his grandmother.", C: "The complaint to the local government came later and was carried by another boy." },
      },
      {
        t: "comprehension", ctx: PASSAGE_BOREHOLE,
        stem: "How did the attitude of Kehinde's friends change during the week?",
        o: [
          "They came to laugh at him but ended up competing to carry water",
          "They helped him at first but later laughed at him",
          "They refused to come until the technician arrived",
          "They laughed at the grandmother throughout the week",
        ], ans: 0, d: 1,
        e: "Two friends first came \"mainly to laugh at him\"; by the end of the week nine boys came every morning and \"the laughter had turned into a competition\".",
        why: { B: "This reverses the order: the laughing came first.", D: "The laughter was directed at Kehinde, and it turned into a competition." },
      },
      {
        t: "comprehension", ctx: PASSAGE_BOREHOLE,
        stem: "According to the passage, how was the borehole finally repaired?",
        o: [
          "A boy whose uncle worked at the secretariat got the complaint to the right office",
          "The grandmother went to the local government herself",
          "The boys raised money to buy a new pump",
          "Kehinde's father paid a technician",
        ], ans: 0, d: 2,
        e: "The third paragraph says one of the boys, whose uncle worked at the local government secretariat, carried the complaint to the right office, and a technician came within a month.",
        why: { B: "The grandmother is never said to have gone to any office.", C: "No fund-raising is mentioned." },
      },
      {
        t: "comprehension", ctx: PASSAGE_BOREHOLE,
        stem: "\"Water that comes easily teaches nobody anything.\" What does the grandmother mean by this?",
        o: [
          "Hardship can teach lessons that comfort cannot",
          "Borehole water is not as pure as stream water",
          "Children should not be given water too easily",
          "Water from the stream is better for learning",
        ], ans: 0, d: 3,
        e: "The hard walk to the stream taught the boys effort, teamwork and how to get things done. She suggests that when things come easily, such lessons are never learnt.",
        why: { B: "She is not comparing the quality of the water.", C: "She speaks generally about ease and effort, not about rationing water." },
      },
      // comprehension: passage 2 (sleep)
      {
        t: "comprehension", ctx: PASSAGE_SLEEP,
        stem: "According to the passage, why do many students sleep very little before the WASSCE?",
        o: [
          "They believe the extra hours of reading will help them",
          "Their teachers tell them to read all night",
          "They are too anxious to fall asleep",
          "Coffee keeps them awake against their will",
        ], ans: 0, d: 1,
        e: "Students \"treat sleep as a luxury they cannot afford\": they give up sleep because they think the extra hours of study will improve their results.",
        why: { B: "No teacher's instruction is mentioned.", D: "They drink coffee on purpose \"to stay awake\"." },
      },
      {
        t: "comprehension", ctx: PASSAGE_SLEEP,
        stem: "\"It looks like dedication.\" The writer suggests that staying up late",
        o: [
          "seems like commitment but often does more harm than good",
          "is the best sign of a dedicated student",
          "should be rewarded by teachers",
          "is only possible for very strong students",
        ], ans: 0, d: 2,
        e: "\"Looks like\" signals that appearance and reality differ. The next sentence confirms it: it is \"often the surest way to waste the hours they are working so hard to gain\".",
        why: { B: "The writer is arguing against this view.", D: "Nothing is said about which students can manage it." },
      },
      {
        t: "comprehension", ctx: PASSAGE_SLEEP,
        stem: "According to the passage, what does the brain do during sleep?",
        o: [
          "It sorts what has been learnt, storing some of it more firmly",
          "It rests completely and does no work",
          "It forgets everything learnt that day",
          "It prepares the body for the next meal",
        ], ans: 0, d: 1,
        e: "The second paragraph says that while we sleep, the brain \"sorts through what it has taken in, discarding some things and storing others more firmly\".",
        why: { B: "The writer says sleep is \"not simply a pause\".", C: "Only some things are discarded; others are stored more firmly." },
      },
      {
        t: "comprehension", ctx: PASSAGE_SLEEP,
        stem: "The student who \"reads the same paragraph four times and remembers none of it\" is an example of",
        o: [
          "the effect of tiredness on concentration",
          "a student who reads too slowly",
          "the danger of studying chemistry at night",
          "a student who has slept too much",
        ], ans: 0, d: 2,
        e: "The example follows the statement that \"tiredness also slows thinking\": the student \"who has not slept\" cannot take in what he reads.",
        why: { B: "The problem is not reading speed but tiredness.", D: "The student in the example is the one \"who has not slept\"." },
      },
      {
        t: "comprehension", ctx: PASSAGE_SLEEP,
        stem: "\"Rest and study are partners, not rivals.\" This means that",
        o: [
          "rest and study support each other",
          "students should rest instead of studying",
          "rest and study should be done at the same time",
          "study is more important than rest",
        ], ans: 0, d: 2,
        e: "Partners work together; rivals compete. The writer means that sleep helps study succeed, so the two belong together in a timetable rather than fighting for the same hours.",
        why: { B: "The writer says plainly that sleep is \"not an excuse for laziness\".", D: "The point is that neither should crowd out the other." },
      },
      {
        t: "comprehension", ctx: PASSAGE_SLEEP,
        stem: "Which of the following best states the writer's main purpose in the passage?",
        o: [
          "To persuade students that enough sleep is part of good exam preparation",
          "To warn students against drinking coffee",
          "To explain how the brain stores chemistry",
          "To encourage students to spend less time on social media",
        ], ans: 0, d: 3,
        e: "Every paragraph builds one argument: giving up sleep wastes study time, sleep helps memory, and rest and study should be planned together. The coffee, chemistry and social media details only support this.",
        why: { B: "Coffee is mentioned once, as part of the picture of late-night study.", D: "Social media is one example in the last paragraph, not the main point." },
      },
      // comprehension: poem
      {
        t: "comprehension", ctx: POEM_HARMATTAN,
        stem: "\"The sun comes up like a coin seen through water.\" The figure of speech used in this line is",
        o: ["simile", "metaphor", "personification", "hyperbole"], ans: 0, d: 1,
        e: "The line compares the sun to a coin using the word \"like\". A direct comparison with \"like\" or \"as\" is a simile.",
        why: { B: "A metaphor makes the comparison without \"like\" or \"as\" (\"the sun is a coin\").", C: "Personification gives human qualities to a thing; here the sun is compared to an object." },
      },
      {
        t: "comprehension", ctx: POEM_HARMATTAN,
        stem: "By comparing the sun to \"a coin seen through water\", the poet suggests that the sun looks",
        o: [
          "dim and blurred through the dusty air",
          "bright and burning hot",
          "small and far away in the evening",
          "wet after the rains",
        ], ans: 0, d: 2,
        e: "A coin seen through water looks faint and wavering. The next line, \"pale and unhurried\", and the dust of the harmattan explain why the morning sun looks dim.",
        why: { B: "\"Pale\" contradicts \"bright and burning\".", D: "Harmattan is the dry season; the water is only part of the comparison." },
      },
      {
        t: "comprehension", ctx: POEM_HARMATTAN,
        stem: "\"Writing its fine grey signature on everything\" suggests that the dust",
        o: [
          "has left a thin layer on every surface",
          "has been used by children to write their names",
          "is so thick that nothing can be seen",
          "has fallen only on the windscreens",
        ], ans: 0, d: 2,
        e: "\"Fine\" means very thin and \"on everything\" shows how widely it has spread. The dust is pictured as signing its name on every surface it touches.",
        why: { C: "\"Fine\" points to a thin layer, not a thick one.", D: "\"On everything\" goes beyond the windscreens." },
      },
      {
        t: "comprehension", ctx: POEM_HARMATTAN,
        stem: "How does the children's response to the harmattan differ from the mother's?",
        o: [
          "The mother finds it uncomfortable, while the children enjoy it",
          "The mother enjoys it, while the children complain",
          "Both the mother and the children dislike it",
          "The children stay indoors, while the mother goes out",
        ], ans: 0, d: 1,
        e: "The mother wraps up and complains about cracked lips; the poem then turns with \"But\" to the children, who run to school \"laughing at the cold\".",
        why: { B: "This reverses the two responses.", D: "The children run to school; they do not stay indoors." },
      },
      {
        t: "comprehension", ctx: POEM_HARMATTAN,
        stem: "The line \"who have never known another December\" suggests that the children",
        o: [
          "are young and accept the harmattan as a normal part of life",
          "were born outside Nigeria",
          "have forgotten the previous year",
          "do not know the names of the months",
        ], ans: 0, d: 3,
        e: "Every December they have known has been a harmattan December, so for them the cold and dust are simply how the season is. Unlike the mother, they have nothing to compare it with and nothing to complain about.",
        why: { B: "The poem gives no hint that they came from elsewhere.", D: "The line is about experience, not knowledge of the calendar." },
      },
      // lexis-and-structure
      {
        t: "lexis-and-structure",
        stem: "Choose the option nearest in meaning to the word in capitals: The doctor warned that the disease was CONTAGIOUS.",
        o: ["infectious", "deadly", "incurable", "painful"], ans: 0, d: 1,
        e: "A contagious disease is one that spreads from person to person. The nearest meaning is \"infectious\".",
        why: { B: "A disease can be contagious without being deadly.", C: "\"Incurable\" is about treatment, not spread." },
      },
      {
        t: "lexis-and-structure",
        stem: "Choose the option nearest in meaning to the word in capitals: The villagers were APPREHENSIVE about the arrival of the soldiers.",
        o: ["anxious", "excited", "ignorant", "angry"], ans: 0, d: 2,
        e: "\"Apprehensive\" means worried or uneasy that something bad may happen. The nearest meaning is \"anxious\".",
        why: { B: "\"Excited\" suggests eager expectation, the opposite of unease.", C: "\"Ignorant\" means unaware; apprehensive people know something is coming." },
      },
      {
        t: "lexis-and-structure",
        stem: "Choose the option nearest in meaning to the word in capitals: The coach gave a TERSE reply when reporters asked about the defeat.",
        o: ["brief", "lengthy", "humorous", "confusing"], ans: 0, d: 2,
        e: "\"Terse\" describes speech that uses few words, often in an abrupt way. The nearest meaning is \"brief\".",
        why: { B: "\"Lengthy\" is the opposite.", C: "Nothing in \"terse\" suggests humour." },
      },
      {
        t: "lexis-and-structure",
        stem: "Choose the option opposite in meaning to the word in capitals: Though she became famous, the singer remained HUMBLE.",
        o: ["arrogant", "modest", "gentle", "poor"], ans: 0, d: 1,
        e: "\"Humble\" means not proud. Its opposite is \"arrogant\": proud and acting as if one is better than others.",
        why: { B: "\"Modest\" is nearly the same as humble.", D: "\"Humble\" can describe poor surroundings, but here it describes a famous person's attitude." },
      },
      {
        t: "lexis-and-structure",
        stem: "Choose the option opposite in meaning to the word in capitals: After a long trial, the court ACQUITTED the accused.",
        o: ["convicted", "freed", "questioned", "released"], ans: 0, d: 3,
        e: "To acquit is to declare someone not guilty. The opposite is to convict: to declare someone guilty.",
        why: { B: "\"Freed\" is close in meaning to acquitted.", D: "\"Released\" is also close in meaning." },
      },
      {
        t: "lexis-and-structure",
        stem: "Choose the option opposite in meaning to the word in capitals: Farming is difficult in the ARID parts of the country.",
        o: ["wet", "dry", "hot", "windy"], ans: 0, d: 2,
        e: "\"Arid\" means having very little rain, too dry to support much plant life. Its opposite is \"wet\".",
        why: { B: "\"Dry\" is the meaning of arid, not its opposite.", C: "Arid areas are often hot, but \"hot\" is about temperature, not rainfall." },
      },
      {
        t: "lexis-and-structure",
        stem: "Choose the option that best completes the sentence: Bread and butter ___ my usual breakfast on school days.",
        o: ["is", "are", "were", "have been"], ans: 0, d: 3,
        e: "\"Bread and butter\" is two nouns joined by \"and\", but together they name a single dish, so the verb is singular: \"Bread and butter is my usual breakfast.\"",
        why: { B: "\"Are\" treats bread and butter as two separate things, but here they form one meal.", C: "\"Were\" is plural and past, while \"usual\" points to a present habit." },
      },
      {
        t: "lexis-and-structure",
        stem: "Choose the option that best completes the sentence: I ___ my homework before my father came home yesterday.",
        o: ["had finished", "have finished", "finish", "will finish"], ans: 0, d: 2,
        e: "Two past actions are described. The one that happened first (finishing the homework) takes the past perfect, \"had finished\"; the later one takes the simple past, \"came\".",
        why: { B: "\"Have finished\" is present perfect and cannot be used with \"yesterday\".", D: "\"Will finish\" is future, but the sentence is about yesterday." },
      },
      {
        t: "lexis-and-structure",
        stem: "Choose the option that best completes the sentence: If it rains tomorrow, we ___ the inter-house sports.",
        o: ["will postpone", "would postponed", "postponed", "would have postponed"], ans: 0, d: 1,
        e: "This is a first (open) conditional about a real possibility: \"if\" + present tense, then \"will\" + base verb.",
        why: { B: "\"Would postponed\" is never correct: \"would\" takes the base form.", D: "\"Would have postponed\" belongs to the third conditional, about the past." },
      },
      {
        t: "lexis-and-structure",
        stem: "Choose the option that best completes the sentence: The suspect was charged ___ armed robbery.",
        o: ["with", "for", "of", "on"], ans: 0, d: 2,
        e: "In standard English a person is charged WITH an offence. (A person is accused OF an offence.)",
        why: { B: "\"Charged for\" is used for prices (\"charged ₦500 for the book\"), not offences.", C: "\"Of\" goes with \"accused\" or \"convicted\", not \"charged\"." },
      },
      {
        t: "lexis-and-structure",
        stem: "Choose the option that best completes the sentence: Between you and ___, I don't think the plan will work.",
        o: ["me", "I", "myself", "mine"], ans: 0, d: 2,
        e: "\"Between\" is a preposition, so the pronouns after it are objects: \"between you and me\".",
        why: { B: "\"I\" is a subject pronoun; using it after a preposition is a common error.", C: "\"Myself\" is reflexive and needs \"I\" as the subject of the same clause." },
      },
      {
        t: "lexis-and-structure",
        stem: "The two brothers do not SEE EYE TO EYE on politics. This means that they",
        o: ["do not agree", "do not see each other often", "do not look at each other", "do not discuss politics"], ans: 0, d: 1,
        e: "\"To see eye to eye\" is an idiom meaning to agree. Not seeing eye to eye means holding different opinions.",
        why: { B: "The idiom is about opinions, not about meeting.", C: "The idiom is not about looking at each other." },
      },
      {
        t: "lexis-and-structure",
        stem: "After his release from prison, Sule decided to TURN OVER A NEW LEAF. This means that he decided to",
        o: ["change his behaviour for the better", "become a farmer", "write a book about his life", "leave the town for good"], ans: 0, d: 1,
        e: "\"To turn over a new leaf\" is an idiom meaning to start behaving in a better way.",
        why: { B: "The idiom has nothing to do with plants or farming.", C: "The \"leaf\" is a page, but the idiom does not mean writing." },
      },
      {
        t: "lexis-and-structure",
        stem: "The plan to raise school fees was NIPPED IN THE BUD. This means that the plan was",
        o: ["stopped at an early stage", "carried out secretly", "delayed for a year", "approved without debate"], ans: 0, d: 2,
        e: "\"To nip something in the bud\" means to stop it before it can develop, as cutting off a bud stops a flower from growing.",
        why: { B: "The idiom is about stopping, not secrecy.", C: "A delayed plan may go ahead later; a plan nipped in the bud is stopped." },
      },
      {
        t: "lexis-and-structure",
        stem: "\"What the principal said at the assembly surprised the students.\" The words \"what the principal said at the assembly\" form",
        o: [
          "a noun clause, subject of the verb \"surprised\"",
          "a noun clause, object of the verb \"surprised\"",
          "an adjectival clause qualifying \"students\"",
          "an adverbial clause of manner",
        ], ans: 0, d: 3,
        e: "The clause does the job of a noun (you could replace it with \"The speech\"), and it comes before the verb as the thing that surprised: it is the subject of \"surprised\".",
        why: { B: "The object of \"surprised\" is \"the students\".", C: "The clause does not describe a noun; it names the thing that surprised them." },
      },
      {
        t: "lexis-and-structure",
        stem: "Ada said, \"I am tired of waiting.\" Which option is the correct reported form of this sentence?",
        o: [
          "Ada said that she was tired of waiting.",
          "Ada said that I am tired of waiting.",
          "Ada said that she is tired of waited.",
          "Ada said that she has been tired of waiting.",
        ], ans: 0, d: 2,
        e: "In reported speech after a past reporting verb, the pronoun changes (I → she) and the tense moves back (am → was): \"Ada said that she was tired of waiting.\"",
        why: { B: "The pronoun \"I\" must change to \"she\", since Ada is not the reporter.", C: "\"Tired of waited\" is ungrammatical." },
      },
      {
        t: "lexis-and-structure",
        stem: "Choose the correctly spelt word to complete the sentence: Power cuts are a daily ___ in many towns.",
        o: ["occurrence", "occurence", "ocurrence", "occurrance"], ans: 0, d: 3,
        e: "The correct spelling is o-c-c-u-r-r-e-n-c-e: double \"c\", double \"r\", and \"-ence\" at the end.",
        why: { B: "\"Occurence\" misses the second \"r\", the most common error.", D: "The ending is \"-ence\", not \"-ance\"." },
      },
      // oral-english
      {
        t: "oral-english",
        stem: "Which of the following words contains the vowel sound /ɒ/, as in \"pot\"?",
        o: ["quality", "water", "walk", "warm"], ans: 0, d: 3,
        e: "\"Quality\" is /ˈkwɒləti/: after /w/, the letter \"a\" is often pronounced /ɒ/, as in \"want\" and \"what\".",
        why: { B: "\"Water\" is /ˈwɔːtə/, with /ɔː/.", C: "\"Walk\" is /wɔːk/, with /ɔː/.", D: "\"Warm\" is /wɔːm/, with /ɔː/." },
      },
      {
        t: "oral-english",
        stem: "Which of the following words contains the vowel sound /iː/, as in \"seat\"?",
        o: ["people", "pretty", "bread", "great"], ans: 0, d: 1,
        e: "\"People\" is /ˈpiːpl/: the \"eo\" spelling gives the long vowel /iː/.",
        why: { B: "\"Pretty\" is /ˈprɪti/, with short /ɪ/.", C: "\"Bread\" is /bred/, with /e/.", D: "\"Great\" is /ɡreɪt/, with /eɪ/." },
      },
      {
        t: "oral-english",
        stem: "Which of the following words has the same vowel sound as \"bed\"?",
        o: ["any", "bead", "bad", "bird"], ans: 0, d: 2,
        e: "\"Any\" is /ˈeni/: the \"a\" is pronounced /e/, the same vowel as in \"bed\" /bed/.",
        why: { B: "\"Bead\" has /iː/.", C: "\"Bad\" has /æ/.", D: "\"Bird\" has /ɜː/." },
      },
      {
        t: "oral-english",
        stem: "Which of the following words contains the diphthong /əʊ/, as in \"go\"?",
        o: ["sew", "new", "few", "now"], ans: 0, d: 2,
        e: "\"Sew\" (to stitch with a needle) is /səʊ/, pronounced like \"so\", despite its \"ew\" spelling.",
        why: { B: "\"New\" is /njuː/.", C: "\"Few\" is /fjuː/.", D: "\"Now\" is /naʊ/." },
      },
      {
        t: "oral-english",
        stem: "Which of the following words contains the diphthong /aʊ/, as in \"cow\"?",
        o: ["drought", "dough", "through", "bought"], ans: 0, d: 3,
        e: "\"Drought\" is /draʊt/. The \"ough\" spelling has several pronunciations; in \"drought\" it is /aʊ/, as in \"cow\".",
        why: { B: "\"Dough\" is /dəʊ/.", C: "\"Through\" is /θruː/.", D: "\"Bought\" is /bɔːt/." },
      },
      {
        t: "oral-english",
        stem: "Which of the following words has the same vowel sound as \"gate\"?",
        o: ["break", "breed", "bread", "breath"], ans: 0, d: 1,
        e: "\"Break\" is /breɪk/, with /eɪ/ as in \"gate\" /ɡeɪt/. It is one of the few \"ea\" words pronounced this way.",
        why: { B: "\"Breed\" is /briːd/.", C: "\"Bread\" is /bred/.", D: "\"Breath\" is /breθ/." },
      },
      {
        t: "oral-english",
        stem: "Which of the following words contains the diphthong /ɪə/, as in \"here\"?",
        o: ["pierce", "pear", "purse", "pace"], ans: 0, d: 2,
        e: "\"Pierce\" is /pɪəs/, with the centring diphthong /ɪə/, as in \"here\" and \"fear\".",
        why: { B: "\"Pear\" is /peə/, with /eə/.", C: "\"Purse\" is /pɜːs/." },
      },
      {
        t: "oral-english",
        stem: "Which of the following words contains the consonant sound /tʃ/?",
        o: ["nature", "chef", "chorus", "giant"], ans: 0, d: 2,
        e: "\"Nature\" is /ˈneɪtʃə/: the \"t\" before \"-ure\" is pronounced /tʃ/, as in \"picture\".",
        why: { B: "\"Chef\" begins with /ʃ/.", C: "\"Chorus\" begins with /k/.", D: "\"Giant\" begins with /dʒ/." },
      },
      {
        t: "oral-english",
        stem: "Which of the following words begins with the consonant sound /θ/?",
        o: ["thumb", "though", "Thames", "that"], ans: 0, d: 2,
        e: "\"Thumb\" is /θʌm/: it begins with the voiceless /θ/, as in \"think\".",
        why: { B: "\"Though\" begins with the voiced /ð/.", C: "\"Thames\" is /temz/; the \"th\" is pronounced /t/.", D: "\"That\" begins with /ð/." },
      },
      {
        t: "oral-english",
        stem: "In which of the following words is \"ng\" pronounced /ŋ/ alone, with no /ɡ/ after it?",
        o: ["singer", "finger", "longer", "hunger"], ans: 0, d: 3,
        e: "\"Singer\" is formed from the verb \"sing\" + \"-er\", so it keeps the /ŋ/ of \"sing\": /ˈsɪŋə/. In \"finger\", \"hunger\" and the comparative \"longer\", RP has /ŋɡ/.",
        why: { B: "\"Finger\" is /ˈfɪŋɡə/.", C: "\"Longer\" (more long) is /ˈlɒŋɡə/.", D: "\"Hunger\" is /ˈhʌŋɡə/." },
      },
      {
        t: "oral-english",
        stem: "In which of the following words is the letter \"h\" silent?",
        o: ["honest", "behind", "hotel", "hungry"], ans: 0, d: 1,
        e: "\"Honest\" is /ˈɒnɪst/: it begins with a vowel sound, which is why we say \"an honest man\".",
        why: { B: "\"Behind\" has /h/: /bɪˈhaɪnd/.", C: "\"Hotel\" has /h/ in RP: /həʊˈtel/." },
      },
      {
        t: "oral-english",
        stem: "In which of the following words is the letter \"g\" silent?",
        o: ["sign", "signal", "signature", "garage"], ans: 0, d: 2,
        e: "\"Sign\" is /saɪn/: the \"g\" is silent. In \"signal\" and \"signature\", which come from the same root, the /ɡ/ is pronounced.",
        why: { B: "\"Signal\" is /ˈsɪɡnəl/; the /ɡ/ is heard.", C: "\"Signature\" is /ˈsɪɡnətʃə/; the /ɡ/ is heard." },
      },
      {
        t: "oral-english",
        stem: "Choose the word whose main stress falls on the second syllable.",
        o: ["develop", "quality", "character", "interval"], ans: 0, d: 2,
        e: "\"Develop\" is de-VE-lop, /dɪˈveləp/, stressed on the second syllable.",
        why: { B: "\"Quality\" is QUA-li-ty, stressed on the first.", C: "\"Character\" is CHA-rac-ter, stressed on the first.", D: "\"Interval\" is IN-ter-val, stressed on the first." },
      },
      {
        t: "oral-english",
        stem: "In which of the following sentences is the word in capitals stressed on the first syllable?",
        o: [
          "The OBJECT on the table is a calculator.",
          "I OBJECT to the new timetable.",
          "The governor will PRESENT the prizes.",
          "Please do not REBEL against your parents.",
        ], ans: 0, d: 3,
        e: "In pairs like object, present and rebel, the noun is stressed on the first syllable and the verb on the second. Only in the first sentence is the word a noun (\"the object\"): OB-ject.",
        why: { B: "Here \"object\" is a verb: ob-JECT.", C: "Here \"present\" is a verb: pre-SENT.", D: "Here \"rebel\" is a verb: re-BEL." },
      },
      {
        t: "oral-english",
        stem: "In the sentence \"I bought yams, rice, beans and oil\", the items in the list are normally said with",
        o: [
          "a rising tune on each item and a falling tune on the last",
          "a falling tune on every item",
          "a rising tune on every item, including the last",
          "a level tune throughout",
        ], ans: 0, d: 3,
        e: "In a list, a rising tune on each item tells the listener that more is coming; a falling tune on the last item (\"oil\") signals that the list is complete.",
        why: { B: "Falling on every item would make each one sound like the end of the list.", C: "A rise on the last item would leave the list sounding unfinished." },
      },
      {
        t: "oral-english",
        stem: "In the sentence below, the word in capitals carries the emphatic stress. Which question does the sentence answer?\nNgozi wrote the letter in RED ink.",
        o: [
          "Did Ngozi write the letter in blue ink?",
          "Who wrote the letter in red ink?",
          "Did Ngozi type the letter in red ink?",
          "What did Ngozi write in red ink?",
        ], ans: 0, d: 2,
        e: "Emphatic stress on RED corrects or supplies information about the colour of the ink, so it answers a question about the colour.",
        why: { B: "That question would be answered by stressing NGOZI.", C: "That question would be answered by stressing WROTE.", D: "That question would be answered by stressing LETTER." },
      },
    ],
    free: [0, 2, 5, 7, 9, 13, 16, 17, 19, 22, 24, 27, 30, 32, 34, 36, 39, 41, 44, 48],
  },
  neco: {
    list: [
      // comprehension: passage 1 (Amina)
      {
        t: "comprehension", ctx: PASSAGE_GOALKEEPER,
        stem: "Why did the boys at first allow Amina to play football with them?",
        o: [
          "The ball belonged to her",
          "She was the best player on the field",
          "Their goalkeeper had twisted his ankle",
          "Their teacher had ordered them to include her",
        ], ans: 0, d: 1,
        e: "The first sentence says the boys \"put up with her only because the ball belonged to her\".",
        why: { B: "They rarely passed to her, so they did not yet rate her as a player.", C: "The injury happened later, in the Tudun Wada match." },
      },
      {
        t: "comprehension", ctx: PASSAGE_GOALKEEPER,
        stem: "\"They rarely passed to her, and when they did, it was usually by mistake.\" This shows that the boys",
        o: [
          "did not take her seriously as a player",
          "were poor at passing the ball",
          "were afraid of hurting her",
          "wanted her to score all the goals",
        ], ans: 0, d: 2,
        e: "Passing to her only by accident shows that the boys chose not to include her in the game: they did not think of her as a real member of the team.",
        why: { B: "The sentence is about whom they passed to, not about their skill.", D: "Rarely passing to her is the opposite of wanting her to score." },
      },
      {
        t: "comprehension", ctx: PASSAGE_GOALKEEPER,
        stem: "Why did nobody want to take the injured goalkeeper's place?",
        o: [
          "The Tudun Wada strikers were bigger and kicked harder",
          "There were only five minutes left in the match",
          "The goalkeeper's position was dusty",
          "They wanted Amina to play in goal",
        ], ans: 0, d: 1,
        e: "The passage gives the reason after a semicolon: \"the Tudun Wada strikers were bigger and kicked harder\". The boys were afraid of their powerful shots.",
        why: { B: "The time left is mentioned, but it is not the reason given for their fear.", D: "Amina walked in \"before anyone could argue\", which shows it was not their plan." },
      },
      {
        t: "comprehension", ctx: PASSAGE_GOALKEEPER,
        stem: "Amina \"walked into the goal before anyone could argue\". This shows that she was",
        o: ["determined", "careless", "proud", "confused"], ans: 0, d: 2,
        e: "She acted at once, without waiting for permission and while the boys hesitated. This shows determination: a firm decision to do what was needed.",
        why: { B: "Nothing suggests she acted without thinking; she then played well.", C: "Her action came from the team's need, not from a wish to show off." },
      },
      {
        t: "comprehension", ctx: PASSAGE_GOALKEEPER,
        stem: "\"The boys did not lift her onto their shoulders, as they would have done for one of their own.\" This suggests that, at that moment, the boys",
        o: [
          "still did not fully see her as one of them",
          "were too tired to celebrate",
          "were angry that she had let in a goal",
          "had lost the match",
        ], ans: 0, d: 3,
        e: "\"One of their own\" means a boy from their group. By not celebrating her as they would have celebrated a boy, they show that she was not yet fully accepted, even after saving the match.",
        why: { C: "The passage says she saved both shots; no goal is mentioned.", D: "The match had been level and she saved the shots; nothing says they lost." },
      },
      {
        t: "comprehension", ctx: PASSAGE_GOALKEEPER,
        stem: "What does the fact that Amina was picked first the next afternoon show?",
        o: [
          "She had earned the boys' respect as a player",
          "The boys still wanted to use her ball",
          "The injured goalkeeper had asked for her",
          "She was now the team's captain",
        ], ans: 0, d: 2,
        e: "Before, the boys tolerated her only for her ball. Being chosen first means they now see her as the most valuable player, something \"she valued more\" than being carried.",
        why: { B: "The ball was the old reason for tolerating her; being picked first is a new sign of respect.", D: "Being picked first is not the same as being made captain." },
      },
      // comprehension: passage 2 (esusu)
      {
        t: "comprehension", ctx: PASSAGE_ESUSU,
        stem: "According to the passage, how does the traditional savings scheme work?",
        o: [
          "Members pay a fixed sum regularly and each one takes the whole collection in turn",
          "Members keep their money with a bank that pays them interest",
          "The richest member lends money to the others",
          "Each member saves alone and shows the group the savings",
        ], ans: 0, d: 1,
        e: "The first paragraph explains that members \"contribute a fixed sum at regular intervals\" and \"the whole collection goes to one member, until everyone has had a turn\".",
        why: { B: "The passage says the system \"pays no interest\".", D: "The point of the scheme is that members save together, not alone." },
      },
      {
        t: "comprehension", ctx: PASSAGE_ESUSU,
        stem: "Which of the following is a weakness of the scheme mentioned in the passage?",
        o: [
          "Members may lose if someone who has collected stops paying",
          "The money is kept in a bank far from the market",
          "Members must be from the same ethnic group",
          "The contributions change every month",
        ], ans: 0, d: 2,
        e: "The second paragraph names two weaknesses: it pays no interest, and it depends on honesty, since \"if a member who has already collected stops contributing, the others lose\".",
        why: { C: "The passage shows the scheme exists among Yoruba, Igbo and Hausa people, but says nothing about members needing to share an ethnic group.", D: "Members pay \"a fixed sum\"." },
      },
      {
        t: "comprehension", ctx: PASSAGE_ESUSU,
        stem: "According to the writer, why has the scheme survived for generations?",
        o: [
          "It helps people who find it hard to save on their own",
          "It pays more interest than the banks",
          "It is enforced by traditional rulers",
          "It is cheaper to join than a bank",
        ], ans: 0, d: 2,
        e: "The writer says it survives \"because it solves a problem that formal banking often ignores\": people with small daily earnings struggle to save alone, and the group gives them a reason and a lump sum.",
        why: { B: "The scheme \"pays no interest\".", C: "Traditional rulers are not mentioned." },
      },
      {
        t: "comprehension", ctx: PASSAGE_ESUSU,
        stem: "\"The money is always needed for something.\" The writer means that",
        o: [
          "small daily earnings are easily spent on everyday needs",
          "market women waste their money",
          "the group always needs more members",
          "banks are always asking for fees",
        ], ans: 0, d: 2,
        e: "The sentence explains why the market woman \"finds it hard to save on her own\": there is always some need to spend her small income on, so nothing is left over.",
        why: { B: "The writer is sympathetic; the money goes on real needs, not waste.", D: "The sentence is about the woman's own spending, not bank charges." },
      },
      {
        t: "comprehension", ctx: PASSAGE_ESUSU,
        stem: "The writer says that banks offering \"target savings\" are \"paying a compliment\" to the women who run such schemes. This means that the banks",
        o: [
          "have shown, by copying the idea, that it was a good one",
          "have paid the women for using their idea",
          "have praised the women in their adverts",
          "have asked the women to work for them",
        ], ans: 0, d: 3,
        e: "Copying an idea is a kind of praise: it shows you value it. The phrase is figurative; the banks have not literally paid or praised anyone.",
        why: { B: "\"Paying\" here is figurative; no money changes hands.", C: "No advertisement is mentioned; the compliment lies in the copying." },
      },
      {
        t: "comprehension", ctx: PASSAGE_ESUSU,
        stem: "As used in the passage, \"a lump sum\" means",
        o: [
          "a single large amount of money",
          "a small daily contribution",
          "an amount owed to the bank",
          "money kept in a heavy box",
        ], ans: 0, d: 1,
        e: "A lump sum is money received all at once, as when a member collects the whole contribution on her turn, rather than in small parts.",
        why: { B: "The small daily amounts are what she pays in; the lump sum is what she receives.", C: "The scheme does not involve borrowing from a bank." },
      },
      // comprehension: passage 3 (the radio)
      {
        t: "comprehension", ctx: PASSAGE_RADIO,
        stem: "What were the family expected to do every evening at seven?",
        o: [
          "Keep silent while the news was on",
          "Gather to listen to music",
          "Take turns choosing a station",
          "Help Grandfather mend the radio",
        ], ans: 0, d: 1,
        e: "The first paragraph says that every evening at seven Grandfather switched on the news, and \"the rest of us had to be silent until the newsreader had finished\".",
        why: { B: "The radio was for the news, not music.", C: "Only Grandfather controlled the radio." },
      },
      {
        t: "comprehension", ctx: PASSAGE_RADIO,
        stem: "The writer says that the radio \"was older than my father\" in order to",
        o: [
          "show how very old the radio was",
          "suggest that the father had bought it",
          "explain why the father disliked it",
          "show that the father was young",
        ], ans: 0, d: 1,
        e: "Comparing the radio's age with a grown man's is a vivid way of stressing how old it was. The same point returns when the repairer says its parts had not been made for forty years.",
        why: { B: "If it was older than the father, he could not have bought it new.", C: "The father later kept the radio, which shows he valued it." },
      },
      {
        t: "comprehension", ctx: PASSAGE_RADIO,
        stem: "Grandfather thanked his son politely for the smartphone and put it in a drawer. This shows that he",
        o: [
          "was courteous but preferred his old radio",
          "did not know how to open the box",
          "was saving the phone for a grandchild",
          "was angry with his son for wasting money",
        ], ans: 0, d: 2,
        e: "He thanked his son \"politely\", so he was not rude, but by putting the phone away and patting the wooden box he showed which he valued more.",
        why: { B: "Nothing suggests he could not use or open it.", D: "\"Politely\" rules out open anger." },
      },
      {
        t: "comprehension", ctx: PASSAGE_RADIO,
        stem: "Why did the writer's father bring the radio home even though it could not be repaired?",
        o: [
          "It reminded him of Grandfather",
          "He hoped to find the parts later",
          "He wanted to sell it as an antique",
          "The repairer refused to keep it",
        ], ans: 0, d: 2,
        e: "The radio no longer worked, so its value was sentimental: it had been Grandfather's companion every evening, and returning it to its shelf keeps his memory alive.",
        why: { B: "The repairer said the parts had not been made for forty years, so this hope is not suggested.", C: "He put it back on its shelf; nothing suggests selling it." },
      },
      {
        t: "comprehension", ctx: PASSAGE_RADIO,
        stem: "The passage ends: \"where it still sits, silent, every evening at seven.\" What is the effect of this ending?",
        o: [
          "It recalls Grandfather's habit and creates a sense of loss",
          "It shows that the family no longer listens to the news",
          "It suggests that the radio might work again one day",
          "It explains why the uncle's gift was useless",
        ], ans: 0, d: 3,
        e: "Seven o'clock was when Grandfather turned on the news. The radio now sits \"silent\" at that hour, which reminds the reader of the old man's routine and of his absence.",
        why: { B: "The ending is about the radio and Grandfather, not the family's news habits.", C: "The repairer said it could not be fixed; \"silent\" stresses this." },
      },
      // lexis-and-structure
      {
        t: "lexis-and-structure",
        stem: "Choose the option nearest in meaning to the word in capitals: The manager gave a VAGUE answer to the workers' questions.",
        o: ["unclear", "honest", "rude", "quick"], ans: 0, d: 1,
        e: "A vague answer is one that is not clear or definite. The nearest meaning is \"unclear\".",
        why: { B: "A vague answer may be honest or not; \"vague\" is about clarity.", D: "Speed has nothing to do with vagueness." },
      },
      {
        t: "lexis-and-structure",
        stem: "Choose the option nearest in meaning to the word in capitals: The commissioner's visit was meant to PACIFY the angry youths.",
        o: ["calm", "provoke", "address", "scatter"], ans: 0, d: 2,
        e: "To pacify is to make angry or upset people calm. The nearest meaning is \"calm\".",
        why: { B: "\"Provoke\" means to make angrier, nearly the opposite.", C: "He may address them, but \"pacify\" names the aim: calming them." },
      },
      {
        t: "lexis-and-structure",
        stem: "Choose the option nearest in meaning to the word in capitals: Despite the warnings, the driver remained OBSTINATE.",
        o: ["stubborn", "careful", "sleepy", "silent"], ans: 0, d: 2,
        e: "\"Obstinate\" means refusing to change one's opinion or behaviour despite warnings. The nearest meaning is \"stubborn\".",
        why: { B: "A careful driver would heed the warnings.", D: "\"Silent\" says nothing about refusing to change." },
      },
      {
        t: "lexis-and-structure",
        stem: "Choose the option opposite in meaning to the word in capitals: The businessman was known for his GENEROSITY.",
        o: ["meanness", "kindness", "wealth", "pride"], ans: 0, d: 1,
        e: "Generosity is readiness to give freely. Its opposite is meanness: unwillingness to give or share.",
        why: { B: "\"Kindness\" is close in meaning to generosity.", C: "Wealth is having money, not an attitude to giving it." },
      },
      {
        t: "lexis-and-structure",
        stem: "Choose the option opposite in meaning to the word in capitals: The editor rejected the article because it was BIASED.",
        o: ["objective", "unfair", "lengthy", "prejudiced"], ans: 0, d: 2,
        e: "\"Biased\" means unfairly favouring one side. The opposite is \"objective\": based on facts and not influenced by personal feelings.",
        why: { B: "\"Unfair\" is close in meaning to biased.", D: "\"Prejudiced\" is also close in meaning." },
      },
      {
        t: "lexis-and-structure",
        stem: "Choose the option opposite in meaning to the word in capitals: The army won a DECISIVE victory in the first battle.",
        o: ["inconclusive", "final", "quick", "costly"], ans: 0, d: 3,
        e: "A decisive victory settles the matter clearly. The opposite is \"inconclusive\": not leading to a clear result.",
        why: { B: "\"Final\" is close in meaning to decisive here.", C: "\"Quick\" is about speed; a decisive victory can be slow." },
      },
      {
        t: "lexis-and-structure",
        stem: "Choose the option that best completes the sentence: Either the students or the teacher ___ to blame for the broken window.",
        o: ["is", "are", "were", "have"], ans: 0, d: 3,
        e: "With \"either … or\", the verb agrees with the nearer subject. The nearer subject is \"the teacher\" (singular), so the verb is \"is\".",
        why: { B: "\"Are\" agrees with \"students\", but that is the farther subject.", D: "\"Have to blame\" changes the meaning and is plural." },
      },
      {
        t: "lexis-and-structure",
        stem: "Choose the option that best completes the sentence: The police ___ arrested the suspects in connection with the robbery.",
        o: ["have", "has", "was", "is"], ans: 0, d: 3,
        e: "\"Police\" is a plural noun in English (like \"cattle\"), so it takes a plural verb: \"The police have arrested…\".",
        why: { B: "\"Has\" treats \"police\" as singular, a common error.", C: "\"Was arrested\" would make the police the ones arrested." },
      },
      {
        t: "lexis-and-structure",
        stem: "Choose the option that best completes the sentence: We ___ in this house in Owerri since 2015.",
        o: ["have lived", "live", "are living", "lived"], ans: 0, d: 2,
        e: "An action that began in the past and continues to now, marked by \"since\", takes the present perfect: \"We have lived here since 2015.\"",
        why: { B: "The simple present cannot be used with \"since 2015\".", D: "The simple past suggests the living has ended, which clashes with \"in this house\" and \"since\"." },
      },
      {
        t: "lexis-and-structure",
        stem: "Choose the option that best completes the sentence: Chidi is very fond ___ his grandmother.",
        o: ["of", "with", "for", "about"], ans: 0, d: 1,
        e: "The adjective \"fond\" is always followed by the preposition \"of\": \"fond of someone or something\".",
        why: { B: "\"Fond with\" is a common error.", C: "\"Fond for\" is not standard English." },
      },
      {
        t: "lexis-and-structure",
        stem: "The football match was CALLED OFF because of the heavy rain. This means that the match was",
        o: ["cancelled", "shortened", "moved indoors", "announced"], ans: 0, d: 1,
        e: "The phrasal verb \"call off\" means to cancel something that was planned.",
        why: { B: "A shortened match still took place; \"called off\" means it did not.", D: "\"Called\" here does not mean announced." },
      },
      {
        t: "lexis-and-structure",
        stem: "Halima TAKES AFTER her mother. This means that Halima",
        o: ["resembles her mother", "looks after her mother", "follows her mother everywhere", "was born after her mother left"], ans: 0, d: 2,
        e: "The phrasal verb \"take after\" means to resemble an older family member in looks or character.",
        why: { B: "\"Looks after\" means to care for someone.", C: "The phrasal verb has nothing to do with following." },
      },
      {
        t: "lexis-and-structure",
        stem: "Some people describe the new tax law as A DOUBLE-EDGED SWORD. This means that the law",
        o: [
          "has both good and bad effects",
          "punishes people twice for the same offence",
          "was passed twice by the assembly",
          "is too harsh to be obeyed",
        ], ans: 0, d: 2,
        e: "A double-edged sword cuts both ways. The idiom describes something that brings both advantages and disadvantages.",
        why: { B: "The idiom is not about double punishment.", D: "\"Sword\" does not suggest harshness here; the point is the two edges." },
      },
      {
        t: "lexis-and-structure",
        stem: "Choose the option that best completes the sentence: Nobody came to the party, ___?",
        o: ["did they", "didn't they", "wasn't it", "didn't he"], ans: 0, d: 2,
        e: "\"Nobody\" makes the statement negative, so the tag is positive. Indefinite pronouns like nobody and everybody are picked up by \"they\" in tags: \"Nobody came, did they?\"",
        why: { B: "A negative tag after a negative statement is wrong.", C: "\"Wasn't it?\" does not match the verb \"came\" or the subject; it is a common error." },
      },
      {
        t: "lexis-and-structure",
        stem: "Which of the following is the passive form of \"The farmers harvested the maize\"?",
        o: [
          "The maize was harvested by the farmers.",
          "The maize has harvested the farmers.",
          "The farmers were harvested by the maize.",
          "The maize is harvesting by the farmers.",
        ], ans: 0, d: 1,
        e: "In the passive, the object (the maize) becomes the subject, the verb becomes \"be\" + past participle in the same tense (was harvested), and the doer follows \"by\".",
        why: { B: "This makes the maize the doer and is not passive.", C: "This reverses who did what." },
      },
      {
        t: "lexis-and-structure",
        stem: "Choose the option that best completes the sentence: Unless you hurry, you ___ the last bus to Onitsha.",
        o: ["will miss", "would miss", "missed", "would have missed"], ans: 0, d: 3,
        e: "\"Unless\" means \"if not\". This is an open condition about a real future possibility, so it takes the present tense in the \"unless\" clause and \"will\" in the main clause.",
        why: { B: "\"Would miss\" goes with an unreal condition in the past tense (\"Unless you hurried…\").", D: "\"Would have missed\" refers to the past." },
      },
      {
        t: "lexis-and-structure",
        stem: "Choose the correctly spelt word to complete the sentence: The match will ___ start at four o'clock.",
        o: ["definitely", "definately", "definitly", "defenitely"], ans: 0, d: 2,
        e: "The correct spelling is d-e-f-i-n-i-t-e-l-y: it is built from \"definite\" + \"-ly\", so it keeps \"finite\" in the middle.",
        why: { B: "\"Definately\" is the most common error; there is no \"a\".", C: "\"Definitly\" drops the \"e\" of \"definite\"." },
      },
      // oral-english
      {
        t: "oral-english",
        stem: "Which of the following words has the same vowel sound as \"law\"?",
        o: ["daughter", "doubt", "dot", "dough"], ans: 0, d: 1,
        e: "\"Daughter\" is /ˈdɔːtə/: the \"augh\" gives /ɔː/, the same long vowel as in \"law\" /lɔː/.",
        why: { B: "\"Doubt\" has /aʊ/.", C: "\"Dot\" has the short /ɒ/.", D: "\"Dough\" has /əʊ/." },
      },
      {
        t: "oral-english",
        stem: "Choose the word that contains the short vowel /ʌ/ heard in \"love\" and \"son\".",
        o: ["oven", "over", "often", "own"], ans: 0, d: 2,
        e: "\"Oven\" is /ˈʌvn/: the \"o\" is pronounced /ʌ/, as in \"love\", \"son\" and \"cup\".",
        why: { B: "\"Over\" is /ˈəʊvə/.", C: "\"Often\" has /ɒ/.", D: "\"Own\" is /əʊn/." },
      },
      {
        t: "oral-english",
        stem: "Which of the following words has the same vowel sound as \"car\"?",
        o: ["calm", "cold", "come", "call"], ans: 0, d: 2,
        e: "\"Calm\" is /kɑːm/: the \"l\" is silent and the vowel is /ɑː/, as in \"car\" /kɑː/.",
        why: { B: "\"Cold\" has /əʊ/.", C: "\"Come\" has /ʌ/.", D: "\"Call\" has /ɔː/." },
      },
      {
        t: "oral-english",
        stem: "Which of the following words contains the long vowel /uː/, as in \"food\"?",
        o: ["fruit", "foot", "full", "fun"], ans: 0, d: 1,
        e: "\"Fruit\" is /fruːt/, with the long vowel /uː/.",
        why: { B: "\"Foot\" has the short /ʊ/.", C: "\"Full\" has /ʊ/.", D: "\"Fun\" has /ʌ/." },
      },
      {
        t: "oral-english",
        stem: "Which of the following words contains the diphthong /ɔɪ/, as in \"boy\"?",
        o: ["choice", "chose", "chase", "cheese"], ans: 0, d: 1,
        e: "\"Choice\" is /tʃɔɪs/: the \"oi\" spelling gives /ɔɪ/.",
        why: { B: "\"Chose\" has /əʊ/.", C: "\"Chase\" has /eɪ/.", D: "\"Cheese\" has /iː/." },
      },
      {
        t: "oral-english",
        stem: "Which of the following words has the same vowel sound as \"square\"?",
        o: ["scarce", "scar", "score", "scour"], ans: 0, d: 3,
        e: "\"Scarce\" is /skeəs/, with the diphthong /eə/ as in \"square\" /skweə/, even though it is spelt like \"scar\".",
        why: { B: "\"Scar\" is /skɑː/.", C: "\"Score\" is /skɔː/." },
      },
      {
        t: "oral-english",
        stem: "In which of the following words does \"ch\" represent the sound /ʃ/?",
        o: ["brochure", "church", "chemist", "choose"], ans: 0, d: 3,
        e: "\"Brochure\" (from French) is /ˈbrəʊʃə/: the \"ch\" is pronounced /ʃ/, as in \"machine\".",
        why: { B: "\"Church\" has /tʃ/.", C: "\"Chemist\" has /k/.", D: "\"Choose\" has /tʃ/." },
      },
      {
        t: "oral-english",
        stem: "Which of the following words contains the consonant sound /dʒ/?",
        o: ["soldier", "goat", "guess", "gift"], ans: 0, d: 2,
        e: "\"Soldier\" is /ˈsəʊldʒə/: the \"di\" before a vowel is pronounced /dʒ/, as in \"judge\".",
        why: { B: "\"Goat\" begins with /ɡ/.", C: "\"Guess\" begins with /ɡ/; the \"u\" is silent." },
      },
      {
        t: "oral-english",
        stem: "Which of the following words begins with the consonant sound /j/, as in \"yes\"?",
        o: ["university", "umbrella", "under", "usher"], ans: 0, d: 2,
        e: "\"University\" is /ˌjuːnɪˈvɜːsəti/: it begins with /j/, which is why we say \"a university\", not \"an university\".",
        why: { B: "\"Umbrella\" begins with the vowel /ʌ/.", D: "\"Usher\" begins with the vowel /ʌ/." },
      },
      {
        t: "oral-english",
        stem: "In which of the following words does \"gh\" represent the sound /f/?",
        o: ["rough", "though", "night", "ghost"], ans: 0, d: 1,
        e: "\"Rough\" is /rʌf/: the \"gh\" is pronounced /f/, as in \"enough\" and \"cough\".",
        why: { B: "In \"though\" the \"gh\" is silent.", C: "In \"night\" the \"gh\" is silent.", D: "In \"ghost\" the \"gh\" is /ɡ/." },
      },
      {
        t: "oral-english",
        stem: "In which of the following words is the final \"n\" silent?",
        o: ["autumn", "again", "human", "basin"], ans: 0, d: 3,
        e: "\"Autumn\" is /ˈɔːtəm/: after \"m\" at the end of a word, \"n\" is silent, as in \"column\" and \"hymn\".",
        why: { B: "\"Again\" ends in /n/.", C: "\"Human\" ends in /n/." },
      },
      {
        t: "oral-english",
        stem: "In which of the following words is the letter \"t\" silent?",
        o: ["castle", "pattern", "tractor", "mistake"], ans: 0, d: 1,
        e: "\"Castle\" is /ˈkɑːsl/: the \"t\" after \"s\" before \"-le\" is silent, as in \"whistle\" and \"wrestle\".",
        why: { B: "\"Pattern\" has /t/.", D: "\"Mistake\" has /t/." },
      },
      {
        t: "oral-english",
        stem: "In which of the following words is the \"-ed\" ending pronounced /d/?",
        o: ["robbed", "jumped", "wanted", "pushed"], ans: 0, d: 2,
        e: "After a voiced sound other than /d/, \"-ed\" is pronounced /d/. \"Rob\" ends in the voiced /b/, so \"robbed\" is /rɒbd/.",
        why: { B: "\"Jumped\" ends in /t/ (after voiceless /p/).", C: "\"Wanted\" ends in /ɪd/ (after /t/).", D: "\"Pushed\" ends in /t/ (after voiceless /ʃ/)." },
      },
      {
        t: "oral-english",
        stem: "Choose the word that is stressed on the first syllable.",
        o: ["industry", "indeed", "inform", "intend"], ans: 0, d: 3,
        e: "\"Industry\" is IN-dus-try, /ˈɪndəstri/. \"Indeed\", \"inform\" and \"intend\" are all stressed on the second syllable.",
        why: { B: "\"Indeed\" is in-DEED.", C: "\"Inform\" is in-FORM.", D: "\"Intend\" is in-TEND." },
      },
      {
        t: "oral-english",
        stem: "Which of the following words is stressed on the third syllable: politician, political, politics or policy?",
        o: ["politician", "political", "politics", "policy"], ans: 0, d: 3,
        e: "\"Politician\" is po-li-TI-cian: words ending in -ian are stressed on the syllable just before the ending.",
        why: { B: "\"Political\" is po-LI-ti-cal, stressed on the second.", C: "\"Politics\" is PO-li-tics, stressed on the first.", D: "\"Policy\" is PO-li-cy, stressed on the first." },
      },
      {
        t: "oral-english",
        stem: "\"You haven't seen my keys, have you?\" If the speaker says the question tag with a rising tune, the speaker",
        o: [
          "is genuinely unsure and is asking for information",
          "is certain the listener has the keys",
          "is ordering the listener to find the keys",
          "is not expecting any answer",
        ], ans: 0, d: 3,
        e: "A rising tune on a question tag makes it a real question: the speaker does not know and wants an answer. A falling tune would show the speaker expects agreement.",
        why: { B: "Certainty is shown by a falling tune on the tag.", D: "A rising tag invites an answer." },
      },
    ],
    free: [0, 2, 4, 7, 9, 11, 14, 17, 19, 22, 24, 27, 29, 32, 34, 37, 40, 43, 46, 49],
  },
};
