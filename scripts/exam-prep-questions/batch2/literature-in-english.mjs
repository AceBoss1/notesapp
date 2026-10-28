// Literature in English questions, batch 2, for Naija Exam Prep (WAEC, NECO). Original questions; options are written with the
// correct one first and shuffled at build time. Every poem and extract below is original writing for Naija Exam Prep; no prescribed
// set text is quoted. Factual questions on African literature use only well-established facts (authors, titles, countries, prizes).

// ---------------------------------------------------------------- shared passages
const MANGO = `Read the poem below and answer the questions that follow.

Our Mango Tree

Our mango tree stood guard beside the well,
Its arms spread wide to shelter all who came;
Beneath it Grandpa sat with tales to tell,
And every child who passed there knew its name.

But yesterday the men with saws arrived;
They spoke of roads, of progress and of gain.
The tree that sixty rainy seasons thrived
Fell in an hour, and left us to the rain.`;

const EXAMHALL = `Read the poem below and answer the questions that follow.

Exam Hall

The clock on the wall is a judge
with no mercy in its face.
Forty heads bend like rice in the wind.
Someone's pen dies.
Someone's prayer rises.
And I,
who read all night,
cannot remember my own name.`;

const SHRINE = `Read the drama extract below and answer the questions that follow.

(The village square at Umudike. The drums stop suddenly. The CHIEF ELDER rises.)
CHIEF ELDER: People of Umudike, the oracle has spoken. The new road will not pass through the shrine of our fathers.
OBI: (stepping forward) With respect, Elder, the road will bring a hospital. Must our children die so that a shrine may stand?
CHIEF ELDER: Young man, the goat that butts the wall breaks only its own horns.
(Murmurs among the crowd. OBI's MOTHER pulls him back by the arm.)
MOTHER: (whispering) Obi, you have said enough.`;

const BARBER = `Read the drama extract below and answer the questions that follow.

(A barber's shop in Ibadan. LATEEF is shaving a customer, MR OGUNDELE, who is reading a newspaper.)
LATEEF: Oga, they say the price of fuel will go up again.
OGUNDELE: Hmm.
LATEEF: And they say the suya man at the junction has married a third wife.
OGUNDELE: Hmm.
LATEEF: (shaving faster) And they say barbers who talk too much end up cutting their customers.
OGUNDELE: (lowering the paper quickly) Lateef! Face your work!`;

const LETTER = `Read the prose extract below and answer the questions that follow.

The letter from Ibadan lay unopened on the table for three days. Nkechi dusted around it, cooked around it and prayed around it. On the fourth morning her son Uche, home from the farm, tore it open before she could stop him. "Mama," he said slowly, "they have offered me a place to study medicine." Nkechi sat down on the floor, right there in the dust she had just swept, and laughed until she cried.`;

const COUNCILLOR = `Read the prose extract below and answer the questions that follow.

Councillor Bassey loved the people of his ward so much that he built himself a second house, just to be closer to them. He loved their children so much that he named the new primary school after himself, so that they would never forget whom to thank. When the school's roof blew off in the first storm of the rainy season, he made a moving speech about the cruelty of nature.`;

const MOTHER = `Read the poem below and answer the questions that follow.

To My Mother

You walked ten miles to market, rain or sun,
With yams upon your head and me behind;
You never rested till the day was done,
Yet always found a word that was gentle and kind.
Now I have shoes, a car, a city flat;
You sleep for ever under the cashew tree.
I'd trade them all, the car, the shoes, the flat,
To walk to market once more, you and me.`;

const GENERATOR = `Read the poem below and answer the questions that follow.

Generator

Every evening at seven
the light goes, as always,
and the generators begin their argument:
the big one next door shouts,
the small one across the road stammers,
ours just coughs and clears its throat
like a shy schoolboy
called to answer in class.`;

const WARD = `Read the drama extract below and answer the questions that follow.

(A hospital corridor at midnight. DR ADEBAYO paces up and down. NURSE HALIMA enters.)
HALIMA: Doctor, the generator is out of diesel, and the boy in Ward 3 is getting worse.
DR ADEBAYO: Then we will work with torches. Find every torch in this building.
HALIMA: And if the batteries run down?
DR ADEBAYO: Then we will work by the light of our phones. That boy is not going to die tonight because of diesel.
(HALIMA hesitates, then hurries out. DR ADEBAYO looks up at the dark ceiling.)
DR ADEBAYO: (quietly) God, if You are awake, now would be a good time.`;

const ENVELOPE = `Read the drama extract below and answer the questions that follow.

(The parlour of a small flat in Enugu. RISI comes in from the front door.)
MAMA RISI: (calling from the kitchen) Risi! Who was that at the door?
RISI: Nobody, Mama. Just a man selling brooms.
(She hides a white envelope behind her back. Her brother DAPO, sitting in the corner, sees it.)
DAPO: (aside) A man selling brooms, with a white envelope?`;

const UNCLE = `Read the prose extract below and answer the questions that follow.

My uncle came back from Lagos with a shining car and a bag full of gifts. Everybody in the village said he had become a big man. He gave Papa an envelope, gave Mama a wrapper and gave me a ball that bounced higher than the church roof. On the third night, two policemen came for him. Mama said they were his friends from Lagos, and I believed her, because why else would they hold his hands so tightly?`;

const PLATEAU = `Read the prose extract below and answer the questions that follow.

The Jos Plateau wore its morning mist like an old shawl. Down in the valley the abandoned tin mines lay silent, their ponds full of green water that no child was allowed to touch. Every morning Baba Dung walked slowly along the edge of one of those ponds, though it was twenty years since his only son had drowned there.`;

export default {
  waec: {
    list: [
      // literary-terms
      {
        t: "literary-terms",
        stem: "\"On the stove, the kettle hissed and the pot of beans bubbled.\" The words \"hissed\" and \"bubbled\" are examples of",
        o: ["onomatopoeia", "oxymoron", "litotes", "allegory"], ans: 0, d: 1,
        e: "Onomatopoeia is the use of words whose sounds imitate the sounds they describe. 'Hissed' sounds like steam escaping and 'bubbled' sounds like boiling liquid.",
        why: { B: "An oxymoron joins two words of opposite meaning; 'hissed' and 'bubbled' are not opposites.", C: "Litotes is understatement by denying the opposite, such as 'not bad'; nothing is understated here." },
      },
      {
        t: "literary-terms",
        stem: "\"At the motor park, Funke lost her purse and her temper.\" The device in which one verb (\"lost\") is applied to two words in different senses is",
        o: ["zeugma", "oxymoron", "litotes", "chiasmus"], ans: 0, d: 3,
        e: "Zeugma uses one word to govern two others, with a different sense for each. Funke 'lost' her purse (it went missing) and 'lost' her temper (she became angry): one verb, two meanings.",
        why: { B: "An oxymoron joins opposites such as 'open secret'; 'purse' and 'temper' are not opposites.", D: "Chiasmus reverses the order of words in two parallel phrases (A–B, B–A), which this sentence does not do." },
      },
      {
        t: "literary-terms",
        stem: "\"In the flood, Baba Sule lost his house, his farm, his two cows and his favourite pen.\" The sudden fall from serious losses to a trivial one at the end of this sentence is",
        o: ["anticlimax", "climax", "euphemism", "apostrophe"], ans: 0, d: 2,
        e: "Anticlimax (also called bathos) arranges ideas so that a serious list ends with something unimportant, producing a comic or ironic effect. A house, a farm and cows are major losses; a pen is trivial.",
        why: { B: "Climax arranges ideas in rising order of importance; here the last item is the least important.", D: "Apostrophe addresses an absent person or a thing directly; no one is addressed." },
      },
      {
        t: "literary-terms",
        stem: "A tailor in Aba complained, \"Since the new market opened, business has been only sew-sew.\" The play on \"sew-sew\" and \"so-so\" is a",
        o: ["pun", "simile", "paradox", "refrain"], ans: 0, d: 1,
        e: "A pun is a play on words that sound alike (or one word with two meanings) for a humorous effect. 'Sew-sew' sounds like 'so-so' (just average) and also fits the tailor's work of sewing.",
        why: { B: "A simile compares two things using 'like' or 'as', which is not done here.", D: "A refrain is a line repeated at regular intervals in a poem or song." },
      },
      {
        t: "literary-terms",
        stem: "\"Eat to live; do not live to eat.\" The device in which the words of the first phrase are repeated in reverse order in the second is",
        o: ["chiasmus", "zeugma", "euphemism", "litotes"], ans: 0, d: 3,
        e: "Chiasmus repeats words or ideas in reverse order (A–B, then B–A). 'Eat ... live' becomes 'live ... eat', which makes the advice balanced and memorable.",
        why: { B: "Zeugma uses one word to govern two others in different senses, which is not the pattern here.", C: "A euphemism is a mild expression for something unpleasant; this is not a softened expression." },
      },
      {
        t: "literary-terms",
        stem: "A poem of mourning written in memory of a particular person who has died is called",
        o: ["an elegy", "an ode", "a ballad", "an epic"], ans: 0, d: 1,
        e: "An elegy is a serious, reflective poem lamenting the death of a person. It often moves from grief to some form of consolation.",
        why: { B: "An ode is a formal poem of praise addressed to a person, object or idea, not mainly a lament for the dead.", C: "A ballad tells a story in short, song-like stanzas.", D: "An epic is a long narrative poem about heroic deeds." },
      },
      {
        t: "literary-terms",
        stem: "The attitude of a writer towards his or her subject or audience, shown through the choice of words, is the",
        o: ["tone", "mood", "theme", "setting"], ans: 0, d: 2,
        e: "Tone is the writer's (or speaker's) attitude, for example angry, mocking, tender or bitter, revealed through diction. Mood is the feeling the work creates in the reader.",
        why: { B: "Mood is the atmosphere or feeling produced in the reader, not the writer's own attitude.", C: "Theme is the central idea or message of the work.", D: "Setting is the time and place of the action." },
      },
      {
        t: "literary-terms",
        stem: "In a novel, images of fire appear again and again, each time linked to anger and destruction. Such a recurring image or idea that helps develop the theme of a work is a",
        o: ["motif", "prologue", "caesura", "plot"], ans: 0, d: 2,
        e: "A motif is an image, symbol, idea or phrase that recurs throughout a work and helps to build its theme. The repeated fire images, always tied to anger, form a motif.",
        why: { B: "A prologue is an introductory section at the start of a work, not something that recurs.", C: "A caesura is a pause within a line of verse.", D: "The plot is the sequence of events, not a repeated image." },
      },
      {
        t: "literary-terms",
        stem: "In a poem the speaker says, \"I am the River Niger; I have carried canoes for a thousand years.\" The imagined voice speaking in a poem, which is not the poet's own, is called the",
        o: ["persona", "audience", "chorus", "antagonist"], ans: 0, d: 2,
        e: "The persona is the speaker or 'voice' a poet creates. Here the poet speaks as the River Niger, so the river is the persona, not the poet himself.",
        why: { B: "The audience is the people the poem is addressed to or read by, not the speaker.", C: "A chorus is a group in a play that comments on the action.", D: "An antagonist is the character opposing the hero in a story or play." },
      },
      {
        t: "literary-terms",
        stem: "\"The more a man boasts, the less he has done.\" A short, witty and memorable statement of this kind is",
        o: ["an epigram", "an epitaph", "an epilogue", "an epithet"], ans: 0, d: 3,
        e: "An epigram is a brief, clever saying that expresses an idea neatly, often with a twist. This sentence sums up a truth about boasting in a short, balanced form.",
        why: { B: "An epitaph is an inscription on a tomb or a short text in memory of a dead person.", C: "An epilogue is a closing section or speech at the end of a work.", D: "An epithet is a descriptive word or phrase attached to a name, such as 'Ade the Strong'." },
      },
      // poetry
      {
        t: "poetry", ctx: MANGO,
        stem: "In line 2, \"Its arms spread wide to shelter all who came\", the poet uses",
        o: ["personification", "onomatopoeia", "litotes", "oxymoron"], ans: 0, d: 1,
        e: "Personification gives human qualities to non-human things. The tree is given 'arms' that it spreads to shelter people, like a welcoming human being.",
        why: { B: "Onomatopoeia uses words that imitate sounds; there are none in this line.", D: "An oxymoron joins two contradictory words, which the line does not do." },
      },
      {
        t: "poetry", ctx: MANGO,
        stem: "Each stanza of the poem, made up of four lines, is called a",
        o: ["quatrain", "couplet", "sestet", "tercet"], ans: 0, d: 1,
        e: "A quatrain is a stanza of four lines. Each stanza of 'Our Mango Tree' has four lines rhyming abab (well/tell, came/name).",
        why: { B: "A couplet has two lines.", C: "A sestet has six lines.", D: "A tercet has three lines." },
      },
      {
        t: "poetry", ctx: MANGO,
        stem: "Which of the following best states the main concern of the poem?",
        o: ["The loss of something valued in the community to the demands of development", "The joy of children playing in a village", "The danger of drinking water from an open well", "The skill of the workmen who build roads"], ans: 0, d: 2,
        e: "The first stanza shows the tree as a protector and a centre of community life; the second shows it cut down in the name of 'roads' and 'progress'. The poem is concerned with what is lost when development destroys something valued.",
        why: { B: "Children are mentioned only in passing in line 4; the poem is about the tree's destruction.", C: "The well is only the tree's location; water safety is not discussed.", D: "The workmen are not admired; the speaker regrets what they do." },
      },
      {
        t: "poetry", ctx: MANGO,
        stem: "The tone of the second stanza is best described as",
        o: ["regretful", "triumphant", "humorous", "indifferent"], ans: 0, d: 2,
        e: "The speaker sadly records how a tree that grew for sixty years was destroyed in an hour and 'left us to the rain'. These details express sorrow and regret for the loss.",
        why: { B: "Nothing is celebrated; 'progress' and 'gain' are reported with disappointment.", D: "The speaker clearly cares about the loss, so the tone is not indifferent." },
      },
      {
        t: "poetry", ctx: MANGO,
        stem: "In lines 7–8 the poet sets \"sixty rainy seasons\" against \"an hour\" mainly in order to",
        o: ["stress how quickly something that took very long to grow was destroyed", "show that the tree was too old to bear fruit", "suggest that the rainy season had been unusually long", "prove that the workmen were lazy and slow"], ans: 0, d: 3,
        e: "The contrast between sixty years of growth and one hour of cutting emphasises how quick and careless the destruction was compared with the long time the tree took to grow, deepening the sense of loss.",
        why: { B: "The poem says nothing about the tree's fruit; age is mentioned to show how long it had served the people.", D: "Cutting the tree in one hour shows speed, not slowness." },
      },
      {
        t: "poetry", ctx: EXAMHALL,
        stem: "The poet describes the clock as \"a judge / with no mercy in its face\" mainly to suggest",
        o: ["the pressure of time on the candidates", "that the invigilator is very strict", "that the clock on the wall is broken", "the fairness of the examination"], ans: 0, d: 2,
        e: "A merciless judge decides people's fate without pity. Calling the clock such a judge shows that time keeps running regardless of the candidates' needs, which creates pressure and fear.",
        why: { B: "The lines describe the clock, not the invigilator.", C: "A clock acting as a judge is clearly working; nothing suggests it has stopped.", D: "'No mercy' stresses harshness, not fairness." },
      },
      {
        t: "poetry", ctx: EXAMHALL,
        stem: "\"Forty heads bend like rice in the wind\" (line 3) contains",
        o: ["a simile", "a metaphor", "an apostrophe", "a pun"], ans: 0, d: 1,
        e: "A simile makes a direct comparison using 'like' or 'as'. The bowed heads of the candidates are compared to rice stalks bending in the wind using the word 'like'.",
        why: { B: "A metaphor compares without 'like' or 'as'; this line uses 'like'.", C: "Apostrophe addresses someone or something absent; nobody is addressed here." },
      },
      {
        t: "poetry", ctx: EXAMHALL,
        stem: "\"Someone's pen dies\" (line 4) most likely means that",
        o: ["a candidate's pen has run out of ink", "a candidate has fainted in the hall", "a pen has been thrown out of the hall", "the invigilator has seized a pen"], ans: 0, d: 2,
        e: "In an exam setting, a pen 'dying' figuratively means it stops writing, usually because the ink has run out. The line adds to the picture of small crises happening in the hall.",
        why: { B: "It is the pen, not the candidate, that 'dies'.", D: "Nothing in the poem mentions the invigilator taking anything." },
      },
      {
        t: "poetry", ctx: EXAMHALL,
        stem: "The claim in the last three lines that the speaker \"cannot remember my own name\" is an example of",
        o: ["hyperbole", "euphemism", "onomatopoeia", "litotes"], ans: 0, d: 2,
        e: "Hyperbole is deliberate exaggeration for effect. The speaker does not literally forget his or her name; the exaggeration shows how badly panic has wiped out what was studied.",
        why: { B: "A euphemism softens something unpleasant; here the speaker exaggerates rather than softens.", D: "Litotes is understatement, the opposite of exaggeration." },
      },
      {
        t: "poetry", ctx: EXAMHALL,
        stem: "Lines 4 and 5 both begin with the word \"Someone's\". The repetition of the same word at the beginning of successive lines is called",
        o: ["anaphora", "enjambment", "caesura", "assonance"], ans: 0, d: 3,
        e: "Anaphora is the repetition of a word or phrase at the beginning of successive lines or clauses. 'Someone's pen dies. / Someone's prayer rises.' builds a rhythm that pictures many candidates at once.",
        why: { B: "Enjambment is the running on of a sentence from one line into the next, not repetition.", C: "A caesura is a pause in the middle of a line.", D: "Assonance is the repetition of vowel sounds inside words." },
      },
      // drama
      {
        t: "drama", ctx: SHRINE,
        stem: "The disagreement between the Chief Elder and Obi is mainly a conflict between",
        o: ["respect for tradition and the desire for modern development", "two families quarrelling over land", "a mother and her disobedient son", "the people of Umudike and a neighbouring village"], ans: 0, d: 1,
        e: "The Chief Elder defends the shrine because 'the oracle has spoken', while Obi argues that the road will bring a hospital. Their clash is between tradition and progress.",
        why: { B: "No dispute over family land is mentioned.", C: "Obi's mother only restrains him; the main conflict is with the Chief Elder.", D: "No other village is involved." },
      },
      {
        t: "drama", ctx: SHRINE,
        stem: "The Chief Elder's reply, \"the goat that butts the wall breaks only its own horns\", is",
        o: ["a proverb warning Obi that his stubbornness will bring trouble on himself", "a prayer asking the gods to forgive the village", "a joke meant to calm the angry crowd", "a song of praise for Obi's courage"], ans: 0, d: 2,
        e: "The Chief Elder answers with a proverb, a traditional saying used to give wisdom indirectly. It means that a person who stubbornly attacks something stronger than himself will only hurt himself, so it warns Obi.",
        why: { B: "He is speaking to Obi, not praying to the gods.", D: "The Elder disapproves of Obi; he does not praise him." },
      },
      {
        t: "drama", ctx: SHRINE,
        stem: "The stage direction \"Murmurs among the crowd\" after the Chief Elder's reply mainly shows that",
        o: ["the crowd is uneasy at the open challenge to the Elder", "the crowd has decided to build the road", "the drummers are about to start playing again", "the crowd has fallen asleep"], ans: 0, d: 2,
        e: "Murmuring is low, uneasy talk. Coming after Obi publicly questions the oracle and the Elder rebukes him, it shows the crowd's discomfort and tension at the exchange.",
        why: { B: "No decision is taken; murmurs show reaction, not agreement.", C: "The direction refers to the crowd talking, not to the drums." },
      },
      {
        t: "drama", ctx: SHRINE,
        stem: "Obi's mother pulls him back and whispers, \"Obi, you have said enough.\" Her action suggests that she",
        o: ["fears that Obi has offended the elders and wants to protect him", "agrees completely with Obi's argument", "wants Obi to go and fetch a doctor", "is angry that the drums have stopped"], ans: 0, d: 2,
        e: "Pulling him back and speaking quietly shows she is worried about the consequences of challenging the Elder in public. She wants to stop him before he gets into deeper trouble.",
        why: { B: "If she agreed with him she would not stop him from speaking.", D: "Her words are about Obi's speech, not about the drums." },
      },
      {
        t: "drama", ctx: BARBER,
        stem: "The extract is most likely taken from",
        o: ["a comedy", "a tragedy", "an elegy", "an epic"], ans: 0, d: 1,
        e: "The everyday setting, the talkative barber, the customer's bored 'Hmm' and the funny warning about cutting customers all create humour, which marks the extract as comedy.",
        why: { B: "Nothing serious or disastrous happens; the tone is light.", C: "An elegy is a poem of mourning, not a dramatic scene.", D: "An epic is a long heroic narrative poem." },
      },
      {
        t: "drama", ctx: BARBER,
        stem: "Mr Ogundele's repeated reply, \"Hmm\", shows that he",
        o: ["is not interested in Lateef's gossip", "strongly agrees with every point Lateef makes", "is too frightened to speak", "has not heard anything Lateef said"], ans: 0, d: 2,
        e: "He keeps reading his newspaper and answers only 'Hmm', a polite but uninterested sound. He does not engage with the news about fuel prices or the suya man until his own safety is mentioned.",
        why: { B: "Strong agreement would be shown in words; 'Hmm' is noncommittal.", C: "He is relaxed and reading until the last line; he speaks sharply when alarmed.", D: "His quick reaction to the last remark shows he has been hearing Lateef." },
      },
      {
        t: "drama", ctx: BARBER,
        stem: "The humour of Lateef's last speech comes mainly from the fact that",
        o: ["he warns about barbers cutting customers while shaving his own customer faster", "he reveals a secret about the suya man's wife", "he refuses to accept payment for the shave", "he reads the newspaper aloud to Mr Ogundele"], ans: 0, d: 3,
        e: "Lateef holds a razor to Ogundele's face, speeds up, and then mentions barbers who cut their customers. The audience sees the danger at once, and Ogundele's alarmed reaction makes the moment funny.",
        why: { B: "The suya man's marriage is mentioned earlier and gets no reaction.", C: "Payment is never mentioned.", D: "It is Ogundele who holds the newspaper, not Lateef." },
      },
      {
        t: "drama",
        stem: "An introductory speech or scene that comes before the main action of a play, often giving background or setting the mood, is the",
        o: ["prologue", "epilogue", "climax", "denouement"], ans: 0, d: 1,
        e: "A prologue opens a play and prepares the audience, for example by giving background or introducing the theme, before the main action begins.",
        why: { B: "An epilogue comes at the end of a play, after the main action.", C: "The climax is the point of highest tension in the plot.", D: "The denouement is the final unravelling of the plot." },
      },
      {
        t: "drama",
        stem: "A play that mixes serious and comic elements, in which the main characters face danger but the play ends happily, is a",
        o: ["tragicomedy", "farce", "tragedy", "melodrama"], ans: 0, d: 2,
        e: "A tragicomedy combines features of tragedy (serious events, threat of disaster) with those of comedy, and usually ends happily for the main characters.",
        why: { B: "A farce is pure comedy built on absurd situations and physical humour, without serious threat.", C: "A tragedy ends in disaster for the hero, not happily.", D: "A melodrama relies on exaggerated emotions and clear-cut heroes and villains." },
      },
      {
        t: "drama",
        stem: "In a play, a wealthy chief who is about to win a chieftaincy title is suddenly exposed as a thief and loses everything. This sudden reversal of the hero's fortune is known as",
        o: ["peripeteia", "anagnorisis", "hubris", "exposition"], ans: 0, d: 3,
        e: "Peripeteia (Aristotle's term) is a sudden reversal of fortune, usually from good to bad in tragedy. The chief moves from near-triumph to ruin in one turn of events.",
        why: { B: "Anagnorisis is the hero's moment of recognition or discovery of the truth, not the reversal itself.", C: "Hubris is excessive pride that may cause a downfall, not the reversal.", D: "Exposition is the opening part of a play that gives background information." },
      },
      // prose
      {
        t: "prose", ctx: LETTER,
        stem: "\"Nkechi dusted around it, cooked around it and prayed around it.\" This sentence mainly shows that Nkechi",
        o: ["was anxious about what the letter might say", "did not know how to read", "was too busy to care about the letter", "had already guessed that the news was bad"], ans: 0, d: 2,
        e: "She keeps the letter in view while doing everything else but does not open it, and even prays around it. The repeated 'around it' shows that the letter dominates her thoughts and that she is anxious about its contents.",
        why: { B: "Nothing suggests she cannot read; she simply avoids opening it.", C: "Praying around it shows she cares a great deal.", D: "She is uncertain, not sure the news is bad; she laughs with joy when it turns out good." },
      },
      {
        t: "prose", ctx: LETTER,
        stem: "Nkechi \"laughed until she cried\" because she was",
        o: ["overwhelmed with joy", "deeply disappointed", "angry with Uche", "afraid of the journey"], ans: 0, d: 1,
        e: "The news is that Uche has been offered a place to study medicine. Laughing until she cried shows joy so great that it overflows into tears.",
        why: { B: "The news is good, so she has no reason for disappointment.", C: "Although Uche opened the letter, her reaction is to the good news, not anger at him." },
      },
      {
        t: "prose", ctx: LETTER,
        stem: "By keeping the letter unopened for three days before revealing its contents, the writer mainly creates",
        o: ["suspense", "satire", "a flashback", "comic relief"], ans: 0, d: 2,
        e: "Suspense is the reader's uncertainty and eagerness to know what will happen. Delaying the opening of the letter makes the reader wonder what it contains.",
        why: { B: "Satire ridicules faults in people or society; nothing is ridiculed here.", C: "A flashback moves back to earlier events; the extract moves forward in time." },
      },
      {
        t: "prose", ctx: COUNCILLOR,
        stem: "The tone of the extract is best described as",
        o: ["satirical", "admiring", "sorrowful", "neutral"], ans: 0, d: 2,
        e: "The writer pretends to praise the Councillor ('loved the people ... so much') while showing his selfishness. Mocking wrongdoing through irony in this way gives the passage a satirical tone.",
        why: { B: "The 'praise' is ironic; the actions described are selfish.", D: "The writer clearly takes a critical attitude, so the tone is not neutral." },
      },
      {
        t: "prose", ctx: COUNCILLOR,
        stem: "\"Councillor Bassey loved the people of his ward so much that he built himself a second house.\" The writer's real attitude to the Councillor, shown through this ironic statement, is that he is",
        o: ["selfish and uses public office for his own benefit", "generous and devoted to his people", "too humble to accept praise", "poor and in need of a bigger house"], ans: 0, d: 2,
        e: "The sentence claims love for the people but describes him building a house for himself. The gap between the stated motive and the action is verbal irony, exposing his selfishness.",
        why: { B: "That is what the words seem to say, but the irony shows the opposite.", C: "Naming the school after himself shows he seeks praise, not humility.", D: "He is building a second house, so he is not poor." },
      },
      {
        t: "prose", ctx: COUNCILLOR,
        stem: "The last sentence of the extract suggests that the Councillor",
        o: ["blames nature to hide the poor quality of the school he built", "is a skilled builder who was simply unlucky", "plans to resign because of the storm", "has decided to rebuild the school with his own money"], ans: 0, d: 3,
        e: "A roof that blows off in the very first storm points to poor construction. Instead of accepting responsibility, he makes a 'moving speech' blaming nature, which the writer presents ironically.",
        why: { B: "The irony of the passage shows the writer does not see him as innocent.", C: "Nothing suggests he will resign; he simply makes a speech.", D: "No plan to rebuild is mentioned." },
      },
      {
        t: "prose",
        stem: "A short story opens with the words: \"The bullet had already left the gun when Kunle remembered that the safety catch was off.\" Beginning a story in the middle of the action in this way is called",
        o: ["in medias res", "denouement", "foreshadowing", "epilogue"], ans: 0, d: 3,
        e: "In medias res (Latin for 'into the middle of things') means beginning a narrative in the middle of the action, with earlier events explained later.",
        why: { B: "The denouement is the resolution at the end of a story.", C: "Foreshadowing gives hints of what will happen later; this opening plunges straight into a key event.", D: "An epilogue is a section at the end of a work." },
      },
      {
        t: "prose",
        stem: "A character who is complex, has many sides to his or her personality and may surprise the reader is described as",
        o: ["a round character", "a flat character", "a stock character", "a foil"], ans: 0, d: 2,
        e: "E. M. Forster's term 'round character' describes a character drawn in depth, with complex and sometimes contradictory qualities, who can surprise the reader convincingly.",
        why: { B: "A flat character is built around a single idea or quality.", C: "A stock character is a familiar type, such as the wicked stepmother, with little individuality.", D: "A foil is a character who contrasts with another to highlight that character's qualities." },
      },
      {
        t: "prose",
        stem: "A narrative technique that presents the continuous, unbroken flow of a character's thoughts, feelings and memories as they pass through the mind is",
        o: ["stream of consciousness", "dramatic monologue", "third-person objective narration", "epistolary narration"], ans: 0, d: 3,
        e: "Stream of consciousness tries to record a character's thoughts as they actually occur, often jumping between ideas and memories without normal logical order.",
        why: { B: "A dramatic monologue is a poem in which one speaker addresses a silent listener.", C: "Objective narration reports only what can be seen and heard, never thoughts.", D: "Epistolary narration tells a story through letters." },
      },
      {
        t: "prose",
        stem: "A short story in which animals such as the tortoise and the hare speak and act like humans in order to teach a moral lesson is",
        o: ["a fable", "a biography", "an elegy", "a novella"], ans: 0, d: 1,
        e: "A fable is a short tale, usually with animal characters given human qualities, that ends with a moral lesson.",
        why: { B: "A biography is the true account of a real person's life.", C: "An elegy is a poem of mourning.", D: "A novella is a work of prose fiction longer than a short story, not specifically a moral animal tale." },
      },
      // african-literature
      {
        t: "african-literature",
        stem: "Arrow of God, the novel about Ezeulu, the chief priest of Ulu, was written by",
        o: ["Chinua Achebe", "Wole Soyinka", "Elechi Amadi", "Cyprian Ekwensi"], ans: 0, d: 1,
        e: "Arrow of God (1964) is Chinua Achebe's third novel. Its hero, Ezeulu, is the chief priest of the god Ulu, and the novel explores his clash with his people and the British colonial administration.",
        why: { B: "Wole Soyinka is mainly known as a playwright; his novels include The Interpreters.", C: "Elechi Amadi wrote The Concubine.", D: "Cyprian Ekwensi wrote People of the City and Jagua Nana." },
      },
      {
        t: "african-literature",
        stem: "Death and the King's Horseman, a play about Elesin Oba, the king's horseman of Oyo, was written by",
        o: ["Wole Soyinka", "Ola Rotimi", "J. P. Clark", "Femi Osofisan"], ans: 0, d: 1,
        e: "Death and the King's Horseman (1975) is by Wole Soyinka. It is based on a real event in colonial Oyo, when a British officer interfered with the horseman's ritual duty to follow the dead king.",
        why: { B: "Ola Rotimi wrote The Gods Are Not to Blame and Kurunmi.", C: "J. P. Clark wrote Song of a Goat.", D: "Femi Osofisan wrote Once Upon Four Robbers." },
      },
      {
        t: "african-literature",
        stem: "Ayi Kwei Armah, author of The Beautyful Ones Are Not Yet Born, a novel about corruption after independence, is from",
        o: ["Ghana", "Kenya", "Senegal", "South Africa"], ans: 0, d: 2,
        e: "Ayi Kwei Armah is a Ghanaian novelist. The Beautyful Ones Are Not Yet Born (1968) is set in Ghana and attacks the corruption of the post-independence period.",
        why: { B: "The well-known Kenyan novelist is Ngũgĩ wa Thiong'o.", C: "Senegalese writers include Mariama Bâ and Léopold Sédar Senghor." },
      },
      {
        t: "african-literature",
        stem: "Alan Paton's novel Cry, the Beloved Country (1948), about the pastor Stephen Kumalo searching for his son, is set mainly in",
        o: ["South Africa", "Nigeria", "Kenya", "Ghana"], ans: 0, d: 2,
        e: "Cry, the Beloved Country is set in South Africa. Kumalo travels from his rural village to Johannesburg, and the novel deals with racial injustice there.",
        why: { B: "The novel has no Nigerian setting.", C: "Kenyan settings are found in Ngũgĩ's novels, not Paton's." },
      },
      {
        t: "african-literature",
        stem: "The Joys of Motherhood (1979), whose heroine Nnu Ego gives her life to her children, was written by",
        o: ["Buchi Emecheta", "Flora Nwapa", "Chimamanda Ngozi Adichie", "Zulu Sofola"], ans: 0, d: 2,
        e: "The Joys of Motherhood is a novel by Buchi Emecheta. The title is ironic: Nnu Ego sacrifices everything for her children and dies alone.",
        why: { B: "Flora Nwapa wrote Efuru.", C: "Adichie wrote Purple Hibiscus and Half of a Yellow Sun.", D: "Zulu Sofola was a playwright, author of The Wedlock of the Gods." },
      },
      {
        t: "african-literature",
        stem: "In Yoruba oral literature, oriki is best described as",
        o: ["praise poetry that celebrates the qualities and achievements of a person or lineage", "a hunters' chant performed at hunting festivals", "a song of mourning sung only at burials", "a folktale about the tricks of the tortoise"], ans: 0, d: 2,
        e: "Oriki are Yoruba praise poems or praise names. They recall and celebrate the qualities, deeds and ancestry of a person, family, town or deity.",
        why: { B: "The Yoruba hunters' chant is ijala.", C: "A song of mourning is a dirge.", D: "Tortoise stories are folktales, a prose form, not praise poetry." },
      },
      {
        t: "african-literature",
        stem: "In 1991, Ben Okri's novel The Famished Road, narrated by the spirit-child Azaro, won the",
        o: ["Booker Prize", "Nobel Prize in Literature", "Caine Prize for African Writing", "Commonwealth Poetry Prize"], ans: 0, d: 3,
        e: "The Famished Road won the Booker Prize in 1991, one of the best-known literary prizes for fiction in English.",
        why: { B: "The Nobel Prize is given for a writer's whole body of work, and Okri has not won it.", C: "The Caine Prize, first awarded in 2000, is for African short stories, not novels.", D: "That prize is for poetry, and The Famished Road is a novel." },
      },
      {
        t: "african-literature",
        stem: "In his book Decolonising the Mind (1986), the Kenyan writer Ngũgĩ wa Thiong'o announced that he would",
        o: ["write his creative works in Gikuyu instead of English", "stop writing novels and write only plays", "move to Nigeria to teach literature", "write only in French for a wider audience"], ans: 0, d: 3,
        e: "In Decolonising the Mind, Ngũgĩ argued that African writers should write in African languages, and he bade farewell to English as the language of his creative writing, choosing Gikuyu instead.",
        why: { B: "He went on writing novels, such as Matigari, in Gikuyu.", D: "Kenya is an English-speaking country; Ngũgĩ argued for African languages, not French." },
      },
      {
        t: "african-literature",
        stem: "Camara Laye, whose autobiographical novel The African Child (L'Enfant noir) describes his childhood, was from",
        o: ["Guinea", "Ghana", "Nigeria", "Uganda"], ans: 0, d: 3,
        e: "Camara Laye was a Guinean writer. The African Child (1953), first written in French as L'Enfant noir, recalls his childhood in Kouroussa, Guinea.",
        why: { B: "The book was written in French; Ghana is English-speaking.", D: "The well-known Ugandan writer is Okot p'Bitek." },
      },
      {
        t: "african-literature",
        stem: "Wole Soyinka's poem \"Telephone Conversation\", in which an African man phones a landlady about renting a room, is mainly about",
        o: ["racial prejudice", "the Nigerian Civil War", "corruption in government", "the problems of polygamy"], ans: 0, d: 2,
        e: "In 'Telephone Conversation' the landlady is more interested in how dark the caller's skin is than in him as a tenant. Soyinka uses irony and humour to expose racial prejudice.",
        why: { B: "The poem is about a phone call over a room, not war.", C: "No government or official is involved.", D: "Marriage is not a subject of the poem." },
      },
    ],
    free: [0, 3, 6, 9, 11, 14, 17, 19, 21, 24, 27, 29, 31, 34, 37, 39, 41, 44, 46, 48],
  },

  neco: {
    list: [
      // literary-terms
      {
        t: "literary-terms",
        stem: "\"Big Bola bought blue buckets at Bodija market.\" The repetition of the \"b\" sound at the start of several words is",
        o: ["alliteration", "assonance", "onomatopoeia", "rhyme"], ans: 0, d: 1,
        e: "Alliteration is the repetition of the same consonant sound at the beginning of nearby words. Big, Bola, bought, blue, buckets and Bodija all begin with 'b'.",
        why: { B: "Assonance is the repetition of vowel sounds, not initial consonants.", C: "Onomatopoeia uses words that imitate sounds.", D: "Rhyme is the matching of sounds at the ends of words." },
      },
      {
        t: "literary-terms",
        stem: "\"The more he gave away, the richer he became.\" A statement like this, which seems to contradict itself but contains a deeper truth, is",
        o: ["a paradox", "a pun", "a euphemism", "an onomatopoeia"], ans: 0, d: 2,
        e: "A paradox appears self-contradictory but reveals a truth. Giving away should make one poorer, yet the man becomes 'richer', for example in friendship, respect or happiness.",
        why: { B: "A pun plays on words with similar sounds or double meanings.", C: "A euphemism softens something unpleasant." },
      },
      {
        t: "literary-terms",
        stem: "A serious and dignified lyric poem that addresses and praises a person, object or idea, such as \"To the River Benue\", is",
        o: ["an ode", "a ballad", "a limerick", "an epic"], ans: 0, d: 2,
        e: "An ode is a formal, elevated lyric poem that addresses and celebrates its subject, often a person, natural object or abstract idea.",
        why: { B: "A ballad tells a story in simple song-like stanzas.", C: "A limerick is a short, humorous five-line poem.", D: "An epic is a long narrative poem of heroic deeds." },
      },
      {
        t: "literary-terms",
        stem: "A narrative poem in short stanzas, often with a refrain, that tells a story in simple language and was originally meant to be sung is",
        o: ["a ballad", "a sonnet", "an ode", "an epigram"], ans: 0, d: 2,
        e: "A ballad tells a story (it is narrative), uses simple language and short stanzas, often has a refrain, and comes from a tradition of songs passed on orally.",
        why: { B: "A sonnet is a 14-line lyric poem, not a sung story.", C: "An ode praises its subject rather than telling a story.", D: "An epigram is a short witty statement." },
      },
      {
        t: "literary-terms",
        stem: "A long narrative poem in an elevated style about the heroic deeds of a great warrior or nation is",
        o: ["an epic", "a lyric", "an elegy", "a sonnet"], ans: 0, d: 1,
        e: "An epic is a long narrative poem celebrating the deeds of a hero of great importance to a people, often involving supernatural forces and told in a grand style.",
        why: { B: "A lyric is a short poem expressing personal feeling.", C: "An elegy mourns the dead.", D: "A sonnet has only 14 lines." },
      },
      {
        t: "literary-terms",
        stem: "A writer's choice and use of words, for example formal or slang, simple or difficult, is called",
        o: ["diction", "rhythm", "plot", "setting"], ans: 0, d: 1,
        e: "Diction means a writer's selection of words. It shapes the tone and style of a work, for example by being formal, colloquial, plain or ornate.",
        why: { B: "Rhythm is the pattern of stressed and unstressed syllables.", C: "Plot is the sequence of events.", D: "Setting is time and place." },
      },
      {
        t: "literary-terms",
        stem: "In a poem about the end of a war, a white dove lands on a broken gun. The white dove stands for peace. An object used to represent an idea in this way is a",
        o: ["symbol", "simile", "refrain", "rhyme"], ans: 0, d: 1,
        e: "A symbol is an object, person or action that represents a larger idea. The white dove is a widely recognised symbol of peace.",
        why: { B: "A simile is a comparison using 'like' or 'as'.", C: "A refrain is a repeated line in a poem.", D: "Rhyme is the matching of end sounds." },
      },
      {
        t: "literary-terms",
        stem: "\"Ifeoma was a good student, a fine prefect, a great leader and finally a national hero.\" The arrangement of ideas in rising order of importance is",
        o: ["climax", "anticlimax", "zeugma", "litotes"], ans: 0, d: 3,
        e: "Climax (as a figure of speech) arranges words or ideas so that each is stronger or more important than the last, building up to the most important: from 'good student' to 'national hero'.",
        why: { B: "Anticlimax ends with something less important; here the last item is the greatest.", C: "Zeugma uses one word in two senses.", D: "Litotes is understatement by denying the opposite." },
      },
      {
        t: "literary-terms",
        stem: "\"Musa spent a sleepless night before his interview.\" It is Musa, not the night, who could not sleep. Attaching a description to the wrong noun in this way is called",
        o: ["transferred epithet", "oxymoron", "pun", "metonymy"], ans: 0, d: 3,
        e: "A transferred epithet moves an adjective from the person or thing it really describes to another noun close to it. 'Sleepless' really describes Musa but is attached to 'night'.",
        why: { B: "An oxymoron joins two words with opposite meanings, such as 'sweet sorrow'.", C: "A pun is a play on words with two meanings or similar sounds.", D: "Metonymy names something by a thing closely associated with it." },
      },
      {
        t: "literary-terms",
        stem: "\"The new governor promised to be our Moses and lead us out of poverty.\" The reference to the Bible story of Moses is an example of",
        o: ["allusion", "oxymoron", "litotes", "onomatopoeia"], ans: 0, d: 2,
        e: "An allusion is a brief reference to a well-known person, event or text from history, religion or literature. Moses, who led the Israelites out of slavery in Egypt, is alluded to here.",
        why: { B: "An oxymoron joins contradictory words; none appear here.", C: "Litotes is deliberate understatement.", D: "Onomatopoeia uses words that imitate sounds." },
      },
      // poetry
      {
        t: "poetry", ctx: MOTHER,
        stem: "Line 6, \"You sleep for ever under the cashew tree\", is a gentle way of saying that the mother",
        o: ["has died and is buried", "likes to rest in the shade", "has moved to another village", "is ill and cannot walk"], ans: 0, d: 1,
        e: "To 'sleep for ever' under a tree is a euphemism for being dead and buried there. The poet avoids the harsh word 'dead'.",
        why: { B: "Sleeping 'for ever' shows this is not ordinary rest.", C: "Nothing suggests she moved; she lies under a tree.", D: "Illness is not mentioned; 'for ever' points to death." },
      },
      {
        t: "poetry", ctx: MOTHER,
        stem: "As a poem that remembers and mourns a dead loved one, \"To My Mother\" can best be described as",
        o: ["an elegy", "a ballad", "an epic", "a limerick"], ans: 0, d: 2,
        e: "An elegy is a poem of mourning for someone who has died. The speaker recalls the mother's life and laments her death.",
        why: { B: "A ballad tells a story in song-like stanzas; this poem is a personal lament.", C: "An epic is a long heroic narrative.", D: "A limerick is a humorous five-line poem." },
      },
      {
        t: "poetry", ctx: MOTHER,
        stem: "The tone of the poem is best described as",
        o: ["nostalgic and sorrowful", "angry and bitter", "playful and mocking", "proud and boastful"], ans: 0, d: 2,
        e: "The speaker looks back fondly on walks to market (nostalgia) and grieves the mother's death, wishing to trade all possessions for one more walk (sorrow).",
        why: { B: "The speaker is not angry with anyone.", C: "Nothing in the poem is mocked.", D: "Possessions are listed only to say they are worth less than the mother." },
      },
      {
        t: "poetry", ctx: MOTHER,
        stem: "Line 1, \"You walked ten miles to market, rain or sun\", mainly presents the mother as",
        o: ["hardworking and self-sacrificing", "wealthy and comfortable", "lazy and careless", "proud and unfriendly"], ans: 0, d: 1,
        e: "Walking a long distance to market in any weather, while carrying yams, shows great effort and sacrifice for the family.",
        why: { B: "She walks because she has no car, unlike the speaker today.", D: "She 'always found a word that was gentle and kind', so she is not unfriendly." },
      },
      {
        t: "poetry", ctx: MOTHER,
        stem: "The contrast between lines 1–4 and lines 5–8 mainly brings out the theme that",
        o: ["material comfort cannot replace the love of a lost parent", "city life is better than village life", "children should not walk to market", "hard work always leads to wealth"], ans: 0, d: 3,
        e: "The first half shows a poor life rich in the mother's love; the second shows wealth (shoes, car, flat) without her. The speaker would trade everything for one more walk, showing that possessions cannot replace her.",
        why: { B: "The speaker would give up the city flat, so city life is not preferred.", D: "The poem is about loss, not a rule about hard work; its key claim is that wealth cannot replace love." },
      },
      {
        t: "poetry", ctx: GENERATOR,
        stem: "In line 3, \"the generators begin their argument\", the poet uses",
        o: ["personification", "alliteration", "litotes", "oxymoron"], ans: 0, d: 1,
        e: "Personification gives human actions to non-human things. Generators cannot argue; the poet presents their combined noise as a human quarrel.",
        why: { B: "There is no repetition of initial consonant sounds.", C: "Litotes is understatement by denying the opposite." },
      },
      {
        t: "poetry", ctx: GENERATOR,
        stem: "The comparison of the speaker's generator to \"a shy schoolboy / called to answer in class\" suggests that the generator",
        o: ["is small and struggles weakly to start", "is the loudest on the street", "is brand new and powerful", "has been stolen"], ans: 0, d: 2,
        e: "A shy schoolboy hesitates, coughs and speaks softly. The simile shows that the family's generator splutters and makes only a weak, hesitant noise compared with the others.",
        why: { B: "The big generator next door 'shouts'; theirs only 'coughs'.", C: "A coughing, hesitant machine is not presented as powerful." },
      },
      {
        t: "poetry", ctx: GENERATOR,
        stem: "The tone of the poem is best described as",
        o: ["humorous", "tragic", "furious", "solemn"], ans: 0, d: 2,
        e: "The poet makes fun of a daily nuisance by turning the generators into quarrelling people and a shy schoolboy. This light, amused treatment gives the poem a humorous tone.",
        why: { B: "No disaster or death occurs.", C: "The speaker is amused rather than enraged.", D: "The playful comparisons are not solemn." },
      },
      {
        t: "poetry", ctx: GENERATOR,
        stem: "Lines 1–2, \"Every evening at seven / the light goes, as always\", show that the poem is commenting on",
        o: ["regular failures of public electricity supply", "the beauty of sunset in the city", "the cost of buying a new generator", "a school that closes at seven"], ans: 0, d: 2,
        e: "'The light goes' is the everyday Nigerian expression for a power cut, and 'as always' shows it happens regularly. The generators start because public power has failed.",
        why: { B: "'The light' here means electricity, as the generators that follow show.", C: "No prices are mentioned.", D: "The schoolboy appears only in a simile." },
      },
      {
        t: "poetry", ctx: GENERATOR,
        stem: "In lines 4–6 the generators \"shout\", \"stammer\" and \"cough\". This graded description most likely hints at",
        o: ["differences in size and therefore in the wealth of the households", "the order in which the generators were bought", "the different colours of the generators", "the distance of each house from the road"], ans: 0, d: 3,
        e: "The 'big one' shouts, the 'small one' stammers and the speaker's 'just coughs'. The size and power of a generator usually reflect what a household can afford, so the poem quietly hints at differences in wealth.",
        why: { B: "No dates of purchase are mentioned.", C: "The verbs describe sounds, not colours.", D: "The description concerns noise and size, not distance." },
      },
      // drama
      {
        t: "drama", ctx: WARD,
        stem: "Dr Adebayo's replies to Nurse Halima show him to be",
        o: ["determined and resourceful", "lazy and careless", "cruel and uncaring", "timid and confused"], ans: 0, d: 1,
        e: "Faced with no diesel, he immediately thinks of torches, then phones, and insists the boy will not die. This shows determination and the ability to find solutions.",
        why: { B: "He is working hard at midnight to save a patient.", C: "He is fighting to save the boy's life.", D: "He gives clear, quick orders." },
      },
      {
        t: "drama", ctx: WARD,
        stem: "Dr Adebayo's final line, \"God, if You are awake, now would be a good time\", combines",
        o: ["wry humour with a desperate plea for help", "anger with a decision to give up", "pride with a boast about his skill", "fear with a plan to leave the hospital"], ans: 0, d: 3,
        e: "The line is a prayer, showing how desperate the situation is, but the casual phrasing 'if You are awake' and 'now would be a good time' adds a touch of dry humour.",
        why: { B: "He has just refused to let the boy die, so he is not giving up.", C: "He asks for help rather than praising himself.", D: "Nothing suggests he will leave." },
      },
      {
        t: "drama", ctx: WARD,
        stem: "The setting, \"A hospital corridor at midnight\", mainly helps to create a mood of",
        o: ["tension and urgency", "celebration and joy", "boredom and idleness", "romance and tenderness"], ans: 0, d: 2,
        e: "Midnight, darkness and a hospital where a patient is getting worse create anxiety. Together with the lack of diesel, the setting builds tension and urgency.",
        why: { B: "Nothing is celebrated.", C: "The doctor paces and gives urgent orders; nobody is idle.", D: "The relationship shown is professional, not romantic." },
      },
      {
        t: "drama", ctx: WARD,
        stem: "Through this scene, the playwright most clearly criticises",
        o: ["the poor facilities in public hospitals", "doctors who refuse to work at night", "patients who do not pay their bills", "nurses who disobey orders"], ans: 0, d: 2,
        e: "A hospital running out of diesel, forcing doctors to treat a sick child by torchlight, exposes a lack of basic facilities. The doctor and nurse are dedicated; the system is at fault.",
        why: { B: "The doctor is working at midnight.", C: "Payment is not mentioned.", D: "Halima hesitates but obeys at once." },
      },
      {
        t: "drama", ctx: ENVELOPE,
        stem: "Risi's reply to her mother, \"Nobody, Mama. Just a man selling brooms\", shows that Risi",
        o: ["is hiding something from her mother", "is too tired to answer properly", "wants her mother to buy a broom", "does not know who came to the door"], ans: 0, d: 1,
        e: "Immediately after this reply she hides a white envelope behind her back. This shows that her answer is a cover story to keep something secret.",
        why: { B: "She answers quickly with a ready excuse; tiredness is not shown.", C: "She says nothing about buying.", D: "She clearly received something from whoever came." },
      },
      {
        t: "drama", ctx: ENVELOPE,
        stem: "The main effect of the hidden white envelope on the audience is to create",
        o: ["suspense about what the envelope contains", "comic relief after a sad scene", "a resolution of the play's conflict", "a flashback to Risi's childhood"], ans: 0, d: 2,
        e: "The audience sees the envelope but does not know what is in it or why Risi hides it. This uncertainty makes them eager to know more, which is suspense.",
        why: { B: "No sad scene comes before it.", C: "The envelope begins a mystery; it resolves nothing.", D: "The scene happens in the present, not the past." },
      },
      {
        t: "drama", ctx: ENVELOPE,
        stem: "Which two characters in the extract know about the white envelope?",
        o: ["Risi and Dapo", "Mama Risi and Dapo", "Mama Risi and Risi", "Mama Risi alone"], ans: 0, d: 2,
        e: "Risi holds and hides the envelope, and the stage direction says Dapo sees it, which his aside confirms. Mama Risi is in the kitchen and only hears Risi's cover story, so she does not know.",
        why: { B: "Mama Risi is in the kitchen and cannot see the envelope.", C: "Mama Risi only hears the story about brooms.", D: "Mama Risi is the one character who does not know about it." },
      },
      {
        t: "drama",
        stem: "The opening part of a play, in which the audience is introduced to the main characters, the setting and the background to the conflict, is called the",
        o: ["exposition", "climax", "denouement", "epilogue"], ans: 0, d: 2,
        e: "The exposition gives the information the audience needs to understand the story: who the characters are, where and when it happens, and what led up to the action.",
        why: { B: "The climax is the turning point of greatest tension, later in the plot.", C: "The denouement is the final unravelling.", D: "The epilogue comes at the very end." },
      },
      {
        t: "drama",
        stem: "A play with exaggerated emotions, sensational events, a clearly good hero and a clearly wicked villain is a",
        o: ["melodrama", "tragedy", "farce", "satire"], ans: 0, d: 3,
        e: "Melodrama appeals strongly to the emotions through sensational situations and characters who are simply good or evil, and usually ends with virtue rewarded.",
        why: { B: "A tragedy shows a complex hero's downfall, usually through a flaw, not simple good versus evil.", C: "A farce aims mainly at laughter through absurd situations.", D: "Satire ridicules folly or vice to correct it." },
      },
      {
        t: "drama",
        stem: "In classical Greek drama, a group of performers who comment on the action and speak or sing together is the",
        o: ["chorus", "cast list", "prompter", "protagonist"], ans: 0, d: 2,
        e: "The chorus in Greek drama is a group that sings or chants together, commenting on events, giving background and expressing the community's view.",
        why: { B: "A cast list simply names the actors.", C: "A prompter helps actors who forget their lines and is not seen by the audience.", D: "The protagonist is a single main character." },
      },
      // prose
      {
        t: "prose", ctx: UNCLE,
        stem: "The narrator believes the policemen are the uncle's friends, but the reader realises that he is being arrested. This gap between the narrator's understanding and the reader's is an example of",
        o: ["irony created by a naive narrator", "foreshadowing by an omniscient narrator", "a flashback within a flashback", "a stream of consciousness"], ans: 0, d: 2,
        e: "The child narrator is naive and takes Mama's explanation at face value. Readers understand that holding his hands 'so tightly' means arrest. The difference between what the narrator says and what the reader knows creates irony.",
        why: { B: "The narrator is a child in the story ('I'), not an all-knowing outsider.", C: "The events are told in a simple sequence, with no flashback inside another.", D: "The narration is orderly, not a free flow of thoughts." },
      },
      {
        t: "prose", ctx: UNCLE,
        stem: "\"a ball that bounced higher than the church roof\" is an example of",
        o: ["hyperbole", "litotes", "metonymy", "euphemism"], ans: 0, d: 1,
        e: "Hyperbole is deliberate exaggeration. A ball could hardly bounce higher than a church roof; the exaggeration shows the child's excitement at the gift.",
        why: { B: "Litotes is understatement, the opposite of exaggeration.", D: "A euphemism softens something unpleasant; here a pleasant thing is exaggerated." },
      },
      {
        t: "prose", ctx: UNCLE,
        stem: "Mama tells the narrator that the policemen were the uncle's friends mainly because she",
        o: ["wants to shield the child from a painful truth", "truly believes they are his friends", "is proud of the uncle's arrest", "wants the child to become a policeman"], ans: 0, d: 2,
        e: "An adult would understand an arrest. Mama's explanation is a protective lie that keeps the young narrator from the shame and pain of what is happening.",
        why: { B: "Policemen who come at night and hold a man's hands tightly are clearly not visiting friends.", C: "Nothing suggests pride; she hides the truth instead." },
      },
      {
        t: "prose", ctx: UNCLE,
        stem: "Taken together, the details of the extract suggest that the uncle's wealth was most likely",
        o: ["obtained by illegal means", "inherited from his father", "won in a lottery", "earned from farming in the village"], ans: 0, d: 3,
        e: "The uncle suddenly returns rich, spends lavishly and is arrested a few nights later. These hints lead the reader to infer that his money was gained unlawfully.",
        why: { B: "An inheritance would not explain his arrest.", D: "He came back from Lagos with his money; farming in the village is not mentioned." },
      },
      {
        t: "prose", ctx: PLATEAU,
        stem: "The atmosphere created in the extract is best described as",
        o: ["quiet and melancholy", "busy and cheerful", "noisy and violent", "comic and light-hearted"], ans: 0, d: 2,
        e: "Morning mist, an 'old shawl', silent abandoned mines, forbidden green ponds and a grieving father create a still, sad atmosphere.",
        why: { B: "The mines are silent and abandoned; nothing is busy.", C: "Nothing violent or noisy happens.", D: "A father mourning his drowned son is not comic." },
      },
      {
        t: "prose", ctx: PLATEAU,
        stem: "Baba Dung walks along the edge of the pond every morning most probably because",
        o: ["he still grieves for the son who drowned there", "he is looking for tin in the water", "he is guarding the pond for the mine owners", "he wants to learn how to swim"], ans: 0, d: 2,
        e: "The extract links his daily walk to the pond where his only son drowned twenty years ago. His walk is an act of mourning and remembrance.",
        why: { B: "The mines are abandoned and he is not described as mining.", C: "Nothing suggests he is employed as a guard." },
      },
      {
        t: "prose",
        stem: "A character built around a single quality or idea, who does not change in the course of the story, is a",
        o: ["flat character", "round character", "dynamic character", "narrator"], ans: 0, d: 1,
        e: "A flat character is simple and one-dimensional, often summed up in one sentence, and stays the same throughout the story.",
        why: { B: "A round character is complex and many-sided.", C: "A dynamic character changes in the course of the story.", D: "A narrator is the voice telling the story, not a type of character development." },
      },
      {
        t: "prose",
        stem: "A story is told in the third person (\"he\", \"she\", \"they\"), but the narrator reveals the thoughts and feelings of only one character. This point of view is",
        o: ["third-person limited", "third-person omniscient", "first-person", "second-person"], ans: 0, d: 3,
        e: "In third-person limited narration the narrator stands outside the story but sees events through one character, sharing only that character's thoughts and feelings.",
        why: { B: "An omniscient narrator can enter the minds of all the characters.", C: "First-person narration uses 'I' and the narrator is a character.", D: "Second-person narration addresses the reader as 'you'." },
      },
      {
        t: "prose",
        stem: "An account of a person's life written by that same person is",
        o: ["an autobiography", "a biography", "a fable", "a novella"], ans: 0, d: 1,
        e: "In an autobiography the writer tells the story of his or her own life ('auto' means self). A biography is written about someone else.",
        why: { B: "A biography is one person's life written by another person.", C: "A fable is a short moral tale, often with animals.", D: "A novella is a short novel, a work of fiction." },
      },
      {
        t: "prose",
        stem: "A short story using human characters to illustrate a moral or religious lesson, such as the story of the Prodigal Son, is a",
        o: ["parable", "legend", "myth", "satire"], ans: 0, d: 2,
        e: "A parable is a brief story with human characters told to teach a moral or spiritual lesson. The Prodigal Son, told by Jesus in Luke 15, teaches forgiveness.",
        why: { B: "A legend is a traditional story about a hero, believed to have some historical basis.", C: "A myth explains origins or natural events, usually through gods or supernatural beings.", D: "Satire ridicules folly or vice in society." },
      },
      // african-literature
      {
        t: "african-literature",
        stem: "Which of Chinua Achebe's novels follows Obi Okonkwo, the grandson of Okonkwo, as a civil servant in Lagos who takes a bribe?",
        o: ["No Longer at Ease", "Arrow of God", "A Man of the People", "Anthills of the Savannah"], ans: 0, d: 2,
        e: "No Longer at Ease (1960) continues the story of Okonkwo's family. Obi returns from England, works in the civil service in Lagos, and is eventually tried for taking a bribe.",
        why: { B: "Arrow of God is about Ezeulu, chief priest of Ulu.", C: "A Man of the People is narrated by Odili and centres on the politician Chief Nanga.", D: "Anthills of the Savannah is set in the fictional state of Kangan." },
      },
      {
        t: "african-literature",
        stem: "The Concubine (1966), about the beautiful Ihuoma whose husbands and suitors die mysteriously, was written by",
        o: ["Elechi Amadi", "Flora Nwapa", "Buchi Emecheta", "Cyprian Ekwensi"], ans: 0, d: 1,
        e: "The Concubine is Elechi Amadi's first novel. It is set in a traditional Ikwerre village, and Ihuoma's misfortunes are explained by her being the wife of a sea-king in the spirit world.",
        why: { B: "Flora Nwapa wrote Efuru.", C: "Buchi Emecheta wrote The Joys of Motherhood.", D: "Cyprian Ekwensi wrote Jagua Nana." },
      },
      {
        t: "african-literature",
        stem: "The historical plays Kurunmi and Ovonramwen Nogbaisi were written by",
        o: ["Ola Rotimi", "Wole Soyinka", "J. P. Clark", "Zulu Sofola"], ans: 0, d: 2,
        e: "Ola Rotimi wrote both plays. Kurunmi is about the Ijaye war in nineteenth-century Yorubaland; Ovonramwen Nogbaisi is about the Oba of Benin at the time of the British expedition of 1897.",
        why: { B: "Soyinka's plays include The Lion and the Jewel and Death and the King's Horseman.", C: "J. P. Clark wrote Song of a Goat.", D: "Zulu Sofola wrote The Wedlock of the Gods." },
      },
      {
        t: "african-literature",
        stem: "Once Upon Four Robbers, a play that examines armed robbery and public executions in Nigeria, was written by",
        o: ["Femi Osofisan", "Ola Rotimi", "Wole Soyinka", "Zulu Sofola"], ans: 0, d: 2,
        e: "Once Upon Four Robbers is by Femi Osofisan. It uses a storyteller, songs and a magic charm to question society's response to robbery and the inequality that breeds it.",
        why: { B: "Ola Rotimi's plays include The Gods Are Not to Blame.", C: "Soyinka's plays include The Trials of Brother Jero.", D: "Zulu Sofola wrote The Wedlock of the Gods." },
      },
      {
        t: "african-literature",
        stem: "The Yoruba novel Ògbójú Ọdẹ nínú Igbó Irúnmalẹ̀, translated into English by Wole Soyinka as The Forest of a Thousand Daemons, was written by",
        o: ["D. O. Fagunwa", "Amos Tutuola", "Ola Rotimi", "Femi Osofisan"], ans: 0, d: 3,
        e: "D. O. Fagunwa wrote the novel in Yoruba in 1938. Wole Soyinka translated it into English as The Forest of a Thousand Daemons (1968).",
        why: { B: "Amos Tutuola wrote in English; his best-known book is The Palm-Wine Drinkard.", C: "Ola Rotimi was a playwright.", D: "Femi Osofisan is a playwright born long after the novel was written." },
      },
      {
        t: "african-literature",
        stem: "Gabriel Okara's poem \"Piano and Drums\" is mainly about",
        o: ["the speaker's confusion between African tradition and Western culture", "the joy of a wedding celebration", "the horrors of the slave trade", "a quarrel between two musicians"], ans: 0, d: 2,
        e: "In 'Piano and Drums' the drums stand for the simple, traditional African world and the piano for complex Western culture. The speaker is left torn and 'lost' between the two.",
        why: { B: "No wedding is described.", C: "The slave trade is not its subject.", D: "The instruments are symbols, not real musicians quarrelling." },
      },
      {
        t: "african-literature",
        stem: "Ferdinand Oyono, whose novel Houseboy is written as the diary of a servant named Toundi, was from",
        o: ["Cameroon", "Nigeria", "Kenya", "Zimbabwe"], ans: 0, d: 3,
        e: "Ferdinand Oyono was a Cameroonian novelist and diplomat. Houseboy (Une vie de boy, 1956) exposes the cruelty and hypocrisy of French colonial rule in Cameroon.",
        why: { B: "Houseboy was written in French, as Oyono was from French-speaking Cameroon.", C: "The famous Kenyan novelist is Ngũgĩ wa Thiong'o." },
      },
      {
        t: "african-literature",
        stem: "Nervous Conditions (1988), a novel about a girl named Tambu seeking an education, was written by Tsitsi Dangarembga of",
        o: ["Zimbabwe", "Ghana", "Senegal", "Nigeria"], ans: 0, d: 3,
        e: "Tsitsi Dangarembga is a Zimbabwean writer. Nervous Conditions is set in colonial Rhodesia (now Zimbabwe) and follows Tambu's struggle for education.",
        why: { B: "Ghanaian women writers include Ama Ata Aidoo.", C: "The Senegalese woman writer often studied is Mariama Bâ." },
      },
      {
        t: "african-literature",
        stem: "Heinemann's African Writers Series, launched in 1962 with Things Fall Apart as its first title, had which writer as its first general editor?",
        o: ["Chinua Achebe", "Wole Soyinka", "Cyprian Ekwensi", "Ngũgĩ wa Thiong'o"], ans: 0, d: 3,
        e: "Chinua Achebe was the founding editor of Heinemann's African Writers Series and helped bring many African writers to international readers.",
        why: { B: "Soyinka was not the series editor.", D: "Ngũgĩ was published in the series (Weep Not, Child) but was not its editor." },
      },
      {
        t: "african-literature",
        stem: "In African oral literature, a song of lament performed at a funeral is called a",
        o: ["dirge", "lullaby", "work song", "praise song"], ans: 0, d: 1,
        e: "A dirge is a song or chant of mourning for the dead. In many African communities dirges are performed at burials to express grief and honour the dead.",
        why: { B: "A lullaby is sung to put a child to sleep.", C: "A work song accompanies labour such as farming or rowing.", D: "A praise song celebrates a living person's qualities." },
      },
    ],
    free: [0, 3, 6, 9, 11, 14, 17, 19, 21, 24, 27, 29, 31, 34, 37, 39, 41, 44, 46, 48],
  },
};
