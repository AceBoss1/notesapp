// Literature in English questions for Naija Exam Prep (WAEC, NECO). Original questions; options are written with the correct
// one first and shuffled at build time. Every poem and extract below is original writing for Naija Exam Prep; no prescribed set
// text is quoted. Factual questions on African literature use only well-established facts (authors, titles, countries, prizes).

// ---------------------------------------------------------------- shared passages
const HARMATTAN = `Read the poem below and answer the questions that follow.

Harmattan Morning

The harmattan arrives without a knock;
It powders every roof and every road;
It grips the town like fingers round a lock,
And bends the market women with its load.
The sun, a pale coin, hides behind the haze;
The children cough and shiver at the gate;
Yet Grandmother sits counting out the days,
For she has learnt that all good things must wait.`;

const LAGOS = `Read the poem below and answer the questions that follow.

Night Song for Lagos

Lagos, you never sleep.
Your generators growl like tired lions,
your yellow buses cough along the bridges,
your hawkers chant their prices into the dark.
Lagos, you never sleep,
and neither, it seems, do we
who must pay your rent.`;

const FISHERMAN = `Read the poem below and answer the questions that follow.

The Fisherman

At dawn old Ebi pushes out his boat,
A morning hymn still trembling in his throat;
The river, a brown snake, slides past the reeds,
And hides its fish among the tangled weeds.
He casts his net as wide as hope can reach,
And listens to the water's whispered speech;
At dusk he rows back slowly to the shore
With fewer fish than on the day before.`;

const MARKET = `Read the poem below and answer the questions that follow.

Market Day

Bang! The trader's shutter rises.
Pepper sellers shout a thousand greetings,
tomatoes sit in neat red pyramids,
and Mama Ngozi's laughter rolls
from one end of the market to the other.
By evening the stalls are empty,
the noise is only a memory,
and silence sits alone, counting the day's coins.`;

const DEBT = `Read the drama extract below and answer the questions that follow.

(CHIEF OKAFOR's sitting room. ADAMU enters carrying a heavy bag.)
ADAMU: (to the audience) Chief Okafor thinks I have come to pay my debt. Let him smile while he can; this bag holds nothing but old newspapers.
CHIEF OKAFOR: Ah, Adamu my son! An honest man at last. Sit, sit! Bring him a cold drink!
ADAMU: Thank you, Chief. Honesty is the only wealth I have.
CHIEF OKAFOR: (taking the bag) I will not even count it. Between friends, counting is an insult.`;

const AMAKA = `Read the drama extract below and answer the questions that follow.

(A dark bedroom. AMAKA is alone, holding a letter.)
AMAKA: So it has come to this. If I go to Abuja, Mama will be alone in this house with her cough and her memories. If I stay, the job goes to someone else, and we remain poor for ever. Papa, you always said that a river which forgets its source will dry up. But what of a river that never leaves its source? Does it not become a pond?`;

const PRINCE = `Read the drama extract below and answer the questions that follow.

(Night. The palace courtyard. KABIRU, the guard, is asleep on a bench. Enter the PRINCE, disguised as a beggar.)
PRINCE: (aside) Not one guard awake. My father trusts these men with his life.
(He shakes KABIRU.)
KABIRU: (waking) Who is there? Go away, beggar! The Prince himself could not get past me tonight.
PRINCE: I am sure he could not, my brave friend.`;

const BELLO = `Read the drama extract below and answer the questions that follow.

MRS BELLO: Tunde, your cousin Femi has finished his homework, washed the car and greeted every elder on this street. And you?
TUNDE: I have been thinking, Mama.
MRS BELLO: Thinking! Can thinking wash a car?
TUNDE: No, Mama. But it can invent a machine that does.`;

const GOAT = `Read the prose extract below and answer the questions that follow.

I was eleven when Papa sold our only goat to pay my school fees. I remember the goat better than I remember the fees. She had a white patch over one eye, and she followed me to the stream every morning like a younger sister. When the buyer led her away, I did not cry. I told myself that big girls do not cry over goats. That night I cried over everything else.`;

const FLOOD = `Read the prose extract below and answer the questions that follow.

Rain had fallen on Onitsha for three days, and the main market was a lake of brown water. Mr Eze stood at the door of his shop, counting the cartons that would never be sold. Across the road, his rival Okoro was smiling. Eze could not know that Okoro's own warehouse had flooded the night before, or that the smile was the bravest lie Okoro had ever told.`;

const GARBA = `Read the prose extract below and answer the questions that follow.

Mallam Garba never raised his voice. When the boys of the street stole mangoes from his tree, he did not chase them or report them to their parents. Instead, the next morning he left a basket of the ripest mangoes by his gate, with a note in careful letters: "Ask, and they are yours." The mangoes stopped disappearing. Soon the boys were greeting him every morning on their way to school.`;

const BOTTLE = `Read the prose extract below and answer the questions that follow.

Before Chidi boarded the bus to Kano, his grandmother pressed a small bottle of water into his hand. "You will need this before the journey ends," she said. Chidi laughed, thanked her politely and pushed the bottle to the bottom of his bag. Six hours later, when the bus broke down on an empty stretch of road under the burning afternoon sun, he remembered her words.`;

export default {
  waec: {
    list: [
      // literary-terms
      {
        t: "literary-terms",
        stem: "\"The thunder was a drummer beating on the roof of the sky.\" The figure of speech in this line is",
        o: ["metaphor", "simile", "onomatopoeia", "euphemism"], ans: 0, d: 1,
        e: "A metaphor compares two unlike things by saying one IS the other, without 'like' or 'as'. Here thunder is said to be a drummer, so it is a metaphor.",
        why: { B: "A simile would need 'like' or 'as' (e.g. 'the thunder was like a drummer').", C: "Onomatopoeia uses words that imitate sounds, such as 'boom'; no such word appears." },
      },
      {
        t: "literary-terms",
        stem: "\"A deafening silence filled the hall when the principal walked in.\" The expression \"deafening silence\" is an example of",
        o: ["oxymoron", "hyperbole", "alliteration", "litotes"], ans: 0, d: 1,
        e: "An oxymoron places two words with opposite meanings side by side. Silence makes no sound, yet it is called 'deafening', so the phrase is an oxymoron.",
        why: { B: "Hyperbole is deliberate exaggeration; the effect here comes from joining opposites, not from exaggerating.", C: "Alliteration is the repetition of the same first consonant sound, which 'deafening silence' does not have." },
      },
      {
        t: "literary-terms",
        stem: "\"After a long illness, Mama Bisi has gone to join her ancestors.\" The expression \"gone to join her ancestors\" is an example of",
        o: ["euphemism", "irony", "paradox", "apostrophe"], ans: 0, d: 1,
        e: "A euphemism is a mild or gentle expression used in place of a harsh or unpleasant one. 'Gone to join her ancestors' is a polite way of saying that she has died.",
        why: { B: "Irony says the opposite of what is meant; here the speaker means exactly that she died, only more gently.", D: "Apostrophe is addressing an absent person or a thing directly; nobody is being addressed here." },
      },
      {
        t: "literary-terms",
        stem: "\"Is there any mother who does not love her own child?\" This sentence is best described as",
        o: ["a rhetorical question", "an oxymoron", "a pun", "an allegory"], ans: 0, d: 1,
        e: "A rhetorical question is asked for effect, not to get an answer, because the answer is obvious. The speaker is really stating that every mother loves her child.",
        why: { C: "A pun plays on a word with two meanings; no word here is used with a double meaning.", D: "An allegory is a whole story whose characters stand for ideas, not a single sentence." },
      },
      {
        t: "literary-terms",
        stem: "After a five-hour hold-up on Third Mainland Bridge, Tobi said, \"Lagos traffic is not a small matter.\" The device Tobi uses is",
        o: ["litotes", "hyperbole", "antithesis", "metonymy"], ans: 0, d: 3,
        e: "Litotes is a form of understatement in which something is affirmed by denying its opposite. 'Not a small matter' means 'a very big problem', said in an understated way.",
        why: { B: "Hyperbole exaggerates; Tobi does the opposite and understates the problem.", C: "Antithesis sets two contrasting ideas side by side in balanced phrases, which is not done here." },
      },
      {
        t: "literary-terms",
        stem: "\"With ten mouths to feed, the farmer could not afford a new bicycle.\" In this sentence \"mouths\" stands for people. This device, in which a part is used to represent the whole, is called",
        o: ["synecdoche", "personification", "simile", "onomatopoeia"], ans: 0, d: 3,
        e: "Synecdoche is a figure of speech in which a part stands for the whole (or the whole for a part). The mouth is a part of a person, and 'ten mouths' means ten people who must be fed.",
        why: { B: "Personification gives human qualities to non-human things; here human body parts stand for humans.", C: "A simile compares two things using 'like' or 'as', which the sentence does not do." },
      },
      {
        t: "literary-terms",
        stem: "\"Aso Rock has announced a new minimum wage.\" Here \"Aso Rock\" stands for the Nigerian Presidency, which is closely associated with it. This device is",
        o: ["metonymy", "hyperbole", "oxymoron", "alliteration"], ans: 0, d: 2,
        e: "Metonymy replaces the name of something with the name of a thing closely associated with it. Aso Rock (where the Presidential Villa is) is used to mean the President and his government.",
        why: { B: "Nothing is exaggerated; the sentence simply uses an associated name.", C: "An oxymoron joins two opposite words, such as 'bitter sweet'; there are no opposites here." },
      },
      {
        t: "literary-terms",
        stem: "\"We came to the city in hope; we left it in despair.\" The main device in this sentence is",
        o: ["antithesis", "euphemism", "onomatopoeia", "rhetorical question"], ans: 0, d: 2,
        e: "Antithesis places contrasting ideas side by side in balanced (parallel) structures. 'Came … in hope' is set against 'left … in despair' to sharpen the contrast.",
        why: { B: "A euphemism softens an unpleasant idea; the sentence states its contrast plainly.", D: "The sentence is a statement, not a question." },
      },
      {
        t: "literary-terms",
        stem: "\"To keep your friends, you must sometimes let them go.\" This statement, which seems to contradict itself but contains a truth, is",
        o: ["a paradox", "a hyperbole", "a simile", "a euphemism"], ans: 0, d: 2,
        e: "A paradox is a statement that appears self-contradictory or absurd but, on reflection, reveals a truth. Letting friends go seems the opposite of keeping them, yet giving people freedom can preserve a friendship.",
        why: { B: "Hyperbole is exaggeration; nothing in the statement is exaggerated.", C: "A simile is a comparison using 'like' or 'as', which is absent here." },
      },
      {
        t: "literary-terms",
        stem: "A story in which the characters and events stand for abstract ideas or real political situations, so that it has a second, hidden meaning, is called",
        o: ["an allegory", "an elegy", "an epic", "a ballad"], ans: 0, d: 2,
        e: "In an allegory, characters and events are symbols of ideas, moral qualities or real events, so the story works on two levels: the surface story and the hidden meaning behind it.",
        why: { B: "An elegy is a poem mourning someone who has died.", C: "An epic is a long narrative poem about the deeds of a great hero." },
      },
      // poetry
      {
        t: "poetry", ctx: HARMATTAN,
        stem: "What is the rhyme scheme of the poem?",
        o: ["abab cdcd", "aabb ccdd", "abba cddc", "abcb dede"], ans: 0, d: 2,
        e: "Mark the end sounds: knock (a), road (b), lock (a), load (b); haze (c), gate (d), days (c), wait (d). The lines rhyme alternately, giving abab cdcd.",
        why: { B: "aabb would need line 1 to rhyme with line 2 ('knock' and 'road' do not rhyme).", C: "abba would need line 1 to rhyme with line 4 ('knock' and 'load' do not rhyme)." },
      },
      {
        t: "poetry", ctx: HARMATTAN,
        stem: "\"The harmattan arrives without a knock\" (line 1) is an example of",
        o: ["personification", "onomatopoeia", "hyperbole", "litotes"], ans: 0, d: 1,
        e: "Personification gives human qualities or actions to non-human things. Only a person would be expected to knock before entering, so the wind is presented as a rude visitor.",
        why: { B: "Onomatopoeia uses words that imitate sounds; 'knock' here is an action the wind fails to do, not a sound effect.", C: "The line does not exaggerate; it pictures the wind as a person." },
      },
      {
        t: "poetry", ctx: HARMATTAN,
        stem: "In line 5, \"The sun, a pale coin\" is an example of",
        o: ["metaphor", "simile", "alliteration", "oxymoron"], ans: 0, d: 1,
        e: "The sun is directly called 'a pale coin' without 'like' or 'as', so it is a metaphor. It suggests the sun looks small, round and dull through the harmattan haze.",
        why: { B: "A simile would say the sun is LIKE a pale coin.", D: "An oxymoron joins two opposite words; 'pale coin' has no contradiction." },
      },
      {
        t: "poetry", ctx: HARMATTAN,
        stem: "The last two lines of the poem present Grandmother as",
        o: ["patient and hopeful", "angry and bitter", "frightened and confused", "careless and lazy"], ans: 0, d: 2,
        e: "While others suffer, Grandmother calmly counts the days because 'all good things must wait'. She believes the hard season will pass, which shows patience and hope.",
        why: { B: "Nothing in the lines shows anger; her tone is calm acceptance.", D: "Counting the days is a sign of quiet expectation, not carelessness." },
      },
      {
        t: "poetry", ctx: HARMATTAN,
        stem: "Each line of the poem has ten syllables, with stress falling mostly on every second syllable (\"The HAR-mat-TAN ar-RIVES with-OUT a KNOCK\"). The metre of the poem is",
        o: ["iambic pentameter", "iambic tetrameter", "trochaic pentameter", "anapaestic trimeter"], ans: 0, d: 3,
        e: "An iamb is an unstressed syllable followed by a stressed one (da-DUM). Ten syllables in this pattern make five iambs per line, and five feet is 'pentameter'. So the metre is iambic pentameter.",
        why: { B: "Tetrameter has four feet (eight syllables in iambs), not five.", C: "A trochee is stressed then unstressed (DUM-da); these lines begin with an unstressed syllable." },
      },
      {
        t: "poetry", ctx: LAGOS,
        stem: "In line 1, the poet speaks directly to Lagos as if the city could hear. This device is called",
        o: ["apostrophe", "euphemism", "alliteration", "litotes"], ans: 0, d: 2,
        e: "Apostrophe is a figure of speech in which the speaker directly addresses an absent person, an abstract idea or a place or thing, as if it could hear and respond. 'Lagos, you…' addresses the city.",
        why: { B: "A euphemism softens an unpleasant idea; this line does not soften anything.", C: "Alliteration is a repeated first consonant sound, which line 1 does not show." },
      },
      {
        t: "poetry", ctx: LAGOS,
        stem: "The imagery in lines 2–4 appeals mainly to the sense of",
        o: ["hearing", "taste", "smell", "touch"], ans: 0, d: 2,
        e: "The generators 'growl', the buses 'cough' and the hawkers 'chant'. All three verbs describe sounds, so the imagery is mainly auditory (it appeals to hearing).",
        why: { B: "Nothing in these lines is tasted.", C: "No smells are mentioned, even though a real city might have them." },
      },
      {
        t: "poetry", ctx: LAGOS,
        stem: "The poem has no regular rhyme scheme and no fixed metre. It is therefore written in",
        o: ["free verse", "blank verse", "heroic couplets", "ballad metre"], ans: 0, d: 2,
        e: "Free verse is poetry without a regular rhyme scheme or a fixed metrical pattern; line lengths and rhythms vary freely, as they do in this poem.",
        why: { B: "Blank verse has no rhyme but DOES keep a regular metre (usually iambic pentameter).", C: "Heroic couplets are rhyming pairs of iambic pentameter lines." },
      },
      {
        t: "poetry", ctx: LAGOS,
        stem: "The tone of the last three lines (\"and neither, it seems, do we / who must pay your rent\") is best described as",
        o: ["wryly humorous", "deeply mournful", "fiercely angry", "joyfully triumphant"], ans: 0, d: 3,
        e: "The speaker turns the praise of a lively city into a gentle joke: the residents cannot sleep either, because they must work hard to afford the city's rent. This light, slightly bitter humour is a wry tone.",
        why: { B: "Nobody has died or been lost; the lines are a light complaint, not a lament.", C: "There is no outburst or threat; 'it seems' keeps the tone mild and ironic." },
      },
      {
        t: "poetry",
        stem: "A sonnet is a poem of",
        o: ["fourteen lines", "eight lines", "twelve lines", "sixteen lines"], ans: 0, d: 1,
        e: "A sonnet has fourteen lines, usually in iambic pentameter with a set rhyme scheme. The Shakespearean sonnet ends with a rhyming couplet; the Petrarchan sonnet is divided into an octave (8 lines) and a sestet (6 lines).",
        why: { B: "Eight lines is the octave, the first part of a Petrarchan sonnet, not the whole poem." },
      },
      // drama
      {
        t: "drama", ctx: DEBT,
        stem: "Adamu's first speech, which is spoken to the audience and not heard by Chief Okafor, is",
        o: ["an aside", "a soliloquy", "a prologue", "a dialogue"], ans: 0, d: 1,
        e: "An aside is a short remark a character makes to the audience (or to himself) that the other characters on stage are not supposed to hear. Chief Okafor is present but does not hear it.",
        why: { B: "A soliloquy is a longer speech made when the character is ALONE on stage; Chief Okafor is present.", C: "A prologue is an introductory speech before the main action of the play begins." },
      },
      {
        t: "drama", ctx: DEBT,
        stem: "The audience knows the bag holds only old newspapers, but Chief Okafor believes it contains money. This situation creates",
        o: ["dramatic irony", "comic relief", "a flashback", "a denouement"], ans: 0, d: 2,
        e: "Dramatic irony occurs when the audience knows something that a character does not. Chief Okafor's warm welcome and refusal to count become ironic because we know he is being cheated.",
        why: { C: "A flashback shows events from an earlier time; this scene happens in the present.", D: "The denouement is the final unravelling of the plot, not a single moment of hidden knowledge." },
      },
      {
        t: "drama", ctx: DEBT,
        stem: "Adamu's words \"Honesty is the only wealth I have\" are ironic because",
        o: ["he is in the very act of deceiving the Chief", "he has just paid all his debts", "he is speaking only to the audience", "he really is a very wealthy man"], ans: 0, d: 3,
        e: "Verbal irony arises when a character's words clash with the truth. Adamu boasts of honesty while handing over a bag of newspapers instead of money, so his claim is the opposite of his conduct.",
        why: { B: "He has not paid; the bag holds old newspapers.", C: "This line is said to the Chief as part of the conversation; only his first speech is addressed to the audience." },
      },
      {
        t: "drama", ctx: DEBT,
        stem: "Instructions in brackets such as \"(taking the bag)\" are called",
        o: ["stage directions", "asides", "subtitles", "dramatis personae"], ans: 0, d: 1,
        e: "Stage directions are the playwright's instructions, usually in brackets or italics, telling actors how to move or speak and describing the setting. They are not spoken aloud.",
        why: { B: "An aside is spoken by a character to the audience; stage directions are not spoken at all.", D: "Dramatis personae is the list of characters at the start of a play." },
      },
      {
        t: "drama", ctx: AMAKA,
        stem: "Amaka's speech, made while she is alone on stage and revealing her private thoughts, is",
        o: ["a soliloquy", "an aside", "an epilogue", "a chorus"], ans: 0, d: 2,
        e: "A soliloquy is a speech in which a character, alone on stage, speaks her thoughts aloud so the audience learns what is going on in her mind. The stage direction says Amaka is alone.",
        why: { B: "An aside is a brief remark made while other characters are present but do not hear it.", C: "An epilogue is a speech at the end of a play that comments on what has happened." },
      },
      {
        t: "drama", ctx: AMAKA,
        stem: "The conflict Amaka faces in this extract is mainly",
        o: ["an internal conflict between duty to her mother and her ambition", "an open quarrel between Amaka and her mother", "a fight between Amaka and a rival for the job", "a struggle between Amaka and the forces of nature"], ans: 0, d: 2,
        e: "Amaka is torn inside her own mind: going to Abuja helps the family's finances but leaves her sick mother alone. A struggle within a character's mind is an internal conflict.",
        why: { B: "Her mother is not on stage and there is no quarrel; the struggle is in Amaka's mind.", C: "No rival appears; the job simply 'goes to someone else' if she stays." },
      },
      {
        t: "drama", ctx: AMAKA,
        stem: "By turning her father's proverb about the river into a question about a pond, Amaka shows that she is",
        o: ["using traditional wisdom to argue for leaving home", "rejecting everything her father ever taught her", "deciding firmly to stay with her mother", "mocking her father in front of others"], ans: 0, d: 3,
        e: "Her father's proverb warns against forgetting home. Amaka extends the image: water that never leaves its source becomes a stagnant pond. She uses the same imagery to argue that staying put can also lead to decay, so she leans towards going.",
        why: { B: "She builds on the proverb's image rather than throwing it away.", C: "The pond image argues against staying, so she has not decided to stay." },
      },
      {
        t: "drama",
        stem: "In tragedy, the error of judgement or weakness of character that leads to the hero's downfall is called",
        o: ["hamartia", "catharsis", "nemesis", "peripeteia"], ans: 0, d: 2,
        e: "Hamartia (a term from Aristotle) is the tragic flaw or error of judgement in the hero that causes his fall. Excessive pride (hubris) is one common form it takes.",
        why: { B: "Catharsis is the release of pity and fear felt by the AUDIENCE at the end of a tragedy.", D: "Peripeteia is the sudden reversal of the hero's fortune, which the flaw brings about." },
      },
      {
        t: "drama",
        stem: "A light-hearted, humorous scene placed within a serious play to ease the tension for the audience is known as",
        o: ["comic relief", "melodrama", "an anticlimax", "a tableau"], ans: 0, d: 2,
        e: "Comic relief is a humorous scene, character or speech in a serious play (especially a tragedy) that gives the audience a brief rest from the tension before the serious action continues.",
        why: { B: "Melodrama is a whole type of play with exaggerated emotions and stock heroes and villains.", D: "A tableau is a moment when actors freeze in position to form a still picture." },
      },
      {
        t: "drama",
        stem: "The list of characters printed at the beginning of a play is called the",
        o: ["dramatis personae", "prologue", "stage directions", "synopsis"], ans: 0, d: 1,
        e: "Dramatis personae (Latin for 'persons of the drama') is the list of characters in a play, often with a short description of each, printed before the first scene.",
        why: { B: "A prologue is a speech or scene that introduces the play, not a list of characters.", D: "A synopsis is a short summary of the plot." },
      },
      // prose
      {
        t: "prose", ctx: GOAT,
        stem: "The extract is narrated from the",
        o: ["first-person point of view", "third-person omniscient point of view", "second-person point of view", "third-person objective point of view"], ans: 0, d: 1,
        e: "The narrator tells her own story using 'I' and 'my' ('I was eleven', 'I remember'). A story told by a character who refers to herself as 'I' is first-person narration.",
        why: { B: "An omniscient narrator stands outside the story and refers to characters as 'he' or 'she'.", C: "Second-person narration addresses the reader as 'you'." },
      },
      {
        t: "prose", ctx: GOAT,
        stem: "Which of the following best describes the narrator?",
        o: ["An older person looking back on a childhood event", "A child describing events as they happen", "An outsider reporting on a neighbour's family", "The goat's buyer telling his side of the story"], ans: 0, d: 3,
        e: "'I was eleven' and 'I remember' show the events are being recalled from a later time, so the narrator is an adult looking back (retrospective narration). The past tense and reflective comment support this.",
        why: { B: "The past tense and 'I remember' show the events are over; they are not told as they happen.", C: "The narrator is the girl herself ('our only goat', 'my school fees')." },
      },
      {
        t: "prose", ctx: GOAT,
        stem: "The last sentence, \"That night I cried over everything else\", suggests that the narrator",
        o: ["held back her grief in public but was deeply hurt", "did not care about the goat at all", "was punished by Papa that night", "was happy that her fees had been paid"], ans: 0, d: 2,
        e: "She refused to cry when the goat was led away, telling herself big girls do not cry. That night her suppressed sorrow came out, attached to 'everything else'. This contrast shows she was deeply hurt but hid it.",
        why: { B: "She remembers the goat lovingly and later weeps, so she clearly cared.", C: "Nothing in the extract mentions any punishment." },
      },
      {
        t: "prose", ctx: FLOOD,
        stem: "The narrator reveals Okoro's secret, which Mr Eze himself does not know. This shows that the extract uses",
        o: ["a third-person omniscient narrator", "a first-person narrator", "a narrator who is Mr Eze himself", "stream of consciousness"], ans: 0, d: 3,
        e: "The story refers to characters as 'he' (third person), and the narrator knows things no single character knows, such as the flooding of Okoro's warehouse and the meaning of his smile. An all-knowing outside narrator is omniscient.",
        why: { B: "No narrator says 'I'; all characters are 'he'.", C: "Mr Eze 'could not know' Okoro's secret, so he cannot be the one telling us." },
      },
      {
        t: "prose", ctx: FLOOD,
        stem: "The setting of the extract is",
        o: ["a flooded market in Onitsha", "a farm during the harmattan", "a quiet village at night", "a warehouse in Lagos"], ans: 0, d: 1,
        e: "Setting is the time and place of the action. The extract states that rain had fallen on Onitsha for three days and the main market was flooded, with Mr Eze at the door of his shop.",
        why: { B: "It is the rainy season, not the dry harmattan.", D: "The only warehouse mentioned is Okoro's, and nothing places the story in Lagos." },
      },
      {
        t: "prose", ctx: FLOOD,
        stem: "\"the main market was a lake of brown water\" contains",
        o: ["a metaphor", "a simile", "onomatopoeia", "a rhetorical question"], ans: 0, d: 1,
        e: "The flooded market is described as if it actually were a lake, without 'like' or 'as'. A direct comparison of this kind is a metaphor.",
        why: { B: "A simile would say the market was LIKE a lake." },
      },
      {
        t: "prose", ctx: FLOOD,
        stem: "What does Mr Eze most likely believe when he sees Okoro smiling?",
        o: ["That Okoro is enjoying Eze's loss", "That Okoro's warehouse has flooded", "That Okoro wants to buy his cartons", "That Okoro is about to apologise"], ans: 0, d: 2,
        e: "Okoro is Eze's rival, and Eze 'could not know' about Okoro's flooded warehouse. Seeing only a smile, Eze would naturally take it as gloating over his ruined goods, though it is really a brave cover for Okoro's own loss.",
        why: { B: "The extract says Eze 'could not know' this.", C: "Nothing suggests any offer to buy; the cartons 'would never be sold'." },
      },
      {
        t: "prose",
        stem: "A novel that follows the growth of its main character from childhood or youth into maturity is called a",
        o: ["bildungsroman", "picaresque novel", "epistolary novel", "gothic novel"], ans: 0, d: 3,
        e: "A bildungsroman (German for 'novel of formation') traces the moral and psychological development of the hero from youth to adulthood, showing how experience shapes the character.",
        why: { B: "A picaresque novel follows the episodic adventures of a roguish wanderer.", C: "An epistolary novel is told through letters, whatever its subject." },
      },
      {
        t: "prose",
        stem: "A narrative technique in which the story is interrupted to show events that happened at an earlier time is",
        o: ["flashback", "foreshadowing", "suspense", "climax"], ans: 0, d: 2,
        e: "A flashback breaks the time order of the story to take the reader back to earlier events, often to explain a character's present situation or behaviour.",
        why: { B: "Foreshadowing hints at what will happen LATER, not what happened before.", D: "The climax is the turning point or highest point of tension in the plot." },
      },
      {
        t: "prose",
        stem: "A novel written mainly in the form of letters exchanged between or written by characters is described as",
        o: ["epistolary", "allegorical", "picaresque", "satirical"], ans: 0, d: 2,
        e: "'Epistle' means letter. An epistolary novel tells its story through letters (and sometimes diaries), which lets readers see events through the characters' own private words.",
        why: { B: "An allegorical work has a hidden symbolic meaning, whatever its form.", D: "A satirical work mocks folly or vice; it can be written in any form." },
      },
      // african-literature
      {
        t: "african-literature",
        stem: "Things Fall Apart, the novel about Okonkwo of Umuofia, was written by",
        o: ["Chinua Achebe", "Wole Soyinka", "Cyprian Ekwensi", "Elechi Amadi"], ans: 0, d: 1,
        e: "Chinua Achebe published Things Fall Apart in 1958. It tells the story of Okonkwo and the coming of colonial rule and Christianity to Igboland, and it is one of the best-known African novels.",
        why: { B: "Wole Soyinka is best known for plays such as The Lion and the Jewel.", C: "Cyprian Ekwensi wrote city novels such as People of the City and Jagua Nana." },
      },
      {
        t: "african-literature",
        stem: "In 1986, who became the first African to be awarded the Nobel Prize in Literature?",
        o: ["Wole Soyinka", "Chinua Achebe", "Ngũgĩ wa Thiong'o", "Naguib Mahfouz"], ans: 0, d: 1,
        e: "The Nigerian playwright, poet and novelist Wole Soyinka won the Nobel Prize in Literature in 1986, the first African writer to receive it.",
        why: { B: "Chinua Achebe never won the Nobel Prize.", D: "Naguib Mahfouz of Egypt won in 1988, two years after Soyinka." },
      },
      {
        t: "african-literature",
        stem: "The Négritude movement, which celebrated Black African culture and identity, is most closely associated with",
        o: ["Léopold Sédar Senghor", "Chinua Achebe", "Ngũgĩ wa Thiong'o", "Amos Tutuola"], ans: 0, d: 2,
        e: "Négritude was a movement of French-speaking Black writers. Its leading founders included the Senegalese poet Léopold Sédar Senghor (later Senegal's first president), together with Aimé Césaire and Léon Damas.",
        why: { B: "Achebe wrote in English and was not part of this francophone movement.", C: "Ngũgĩ, a Kenyan writer, is known for novels and for arguing for writing in African languages." },
      },
      {
        t: "african-literature",
        stem: "The Palm-Wine Drinkard (1952), a story of a journey into a world of spirits, was written by",
        o: ["Amos Tutuola", "Gabriel Okara", "Cyprian Ekwensi", "Flora Nwapa"], ans: 0, d: 2,
        e: "Amos Tutuola wrote The Palm-Wine Drinkard, drawing on Yoruba folktales; its hero travels to the land of the dead to find his palm-wine tapster.",
        why: { B: "Gabriel Okara is known for the poem 'Piano and Drums' and the novel The Voice.", D: "Flora Nwapa wrote Efuru." },
      },
      {
        t: "african-literature",
        stem: "Which Nigerian writer is the author of the novel Efuru (1966)?",
        o: ["Flora Nwapa", "Buchi Emecheta", "Zaynab Alkali", "Ama Ata Aidoo"], ans: 0, d: 2,
        e: "Flora Nwapa wrote Efuru, published in 1966, about a beautiful and independent Igbo woman. Nwapa is a pioneer among Nigerian women novelists.",
        why: { B: "Buchi Emecheta wrote novels such as The Joys of Motherhood.", D: "Ama Ata Aidoo is a Ghanaian writer, author of The Dilemma of a Ghost." },
      },
      {
        t: "african-literature",
        stem: "The title of Chinua Achebe's Things Fall Apart is taken from a line in \"The Second Coming\", a poem by",
        o: ["W. B. Yeats", "T. S. Eliot", "William Wordsworth", "John Keats"], ans: 0, d: 3,
        e: "Achebe took his title from W. B. Yeats's poem 'The Second Coming' ('Things fall apart; the centre cannot hold'), and the novel opens with lines from it as an epigraph.",
        why: { B: "T. S. Eliot wrote 'The Waste Land' but not 'The Second Coming'.", C: "Wordsworth was a Romantic poet of the late 18th and early 19th centuries; the poem is Yeats's." },
      },
      {
        t: "african-literature",
        stem: "Ngũgĩ wa Thiong'o, author of Weep Not, Child and A Grain of Wheat, is a writer from",
        o: ["Kenya", "Nigeria", "Ghana", "South Africa"], ans: 0, d: 2,
        e: "Ngũgĩ wa Thiong'o is a Kenyan novelist, playwright and critic. His early novels deal with colonial Kenya and the Mau Mau struggle for independence.",
        why: { B: "His novels are set in Kenya, among the Gikuyu people, not in Nigeria." },
      },
      {
        t: "african-literature",
        stem: "Ola Rotimi's play The Gods Are Not to Blame is an African adaptation of",
        o: ["Sophocles' Oedipus Rex", "Shakespeare's Macbeth", "Shakespeare's Hamlet", "Euripides' Medea"], ans: 0, d: 3,
        e: "Ola Rotimi re-set the Greek tragedy Oedipus Rex by Sophocles in a Yoruba kingdom. As in the original, the king unknowingly kills his father and marries his mother, fulfilling a prophecy.",
        why: { B: "Macbeth is about a Scottish general who murders his king out of ambition, not a prophecy about killing a father.", D: "Medea is a Greek tragedy, but about a wife's revenge, not a fated king." },
      },
      {
        t: "african-literature",
        stem: "In West African oral tradition, a griot is",
        o: ["a storyteller, praise singer and keeper of a community's history", "a masked spirit that appears at festivals", "a collection of proverbs written on palm leaves", "a type of drum used to send messages"], ans: 0, d: 2,
        e: "A griot is a West African oral artist (especially among the Mande peoples) who preserves history, genealogies and stories, and performs praise songs, often with music. Griots carry literature by word of mouth.",
        why: { B: "A masquerade is a masked figure; a griot is a human performer.", C: "Oral literature is passed on by speech and performance, not written records." },
      },
      {
        t: "african-literature",
        stem: "Purple Hibiscus, a novel narrated by a teenage girl named Kambili, was written by",
        o: ["Chimamanda Ngozi Adichie", "Buchi Emecheta", "Flora Nwapa", "Zaynab Alkali"], ans: 0, d: 1,
        e: "Chimamanda Ngozi Adichie published Purple Hibiscus in 2003. Its narrator, Kambili, grows up in Enugu under a rich but violently strict father.",
        why: { B: "Buchi Emecheta wrote The Joys of Motherhood and Second-Class Citizen.", D: "Zaynab Alkali wrote The Stillborn." },
      },
    ],
    free: [0, 4, 7, 9, 10, 14, 17, 19, 20, 22, 24, 27, 30, 33, 35, 37, 40, 41, 45, 47],
  },
  neco: {
    list: [
      // literary-terms
      {
        t: "literary-terms",
        stem: "\"The old man moved as slowly as a tortoise on a hot afternoon.\" The figure of speech used here is",
        o: ["simile", "metaphor", "personification", "oxymoron"], ans: 0, d: 1,
        e: "A simile compares two different things using 'like' or 'as'. The old man's movement is compared to a tortoise's using 'as slowly as', so it is a simile.",
        why: { B: "A metaphor would say he WAS a tortoise, without 'as' or 'like'.", C: "Personification gives human qualities to a non-human thing; here a human is compared to an animal." },
      },
      {
        t: "literary-terms",
        stem: "\"I have told you a million times to lock that gate!\" This sentence contains",
        o: ["hyperbole", "litotes", "euphemism", "onomatopoeia"], ans: 0, d: 1,
        e: "Hyperbole is deliberate exaggeration for emphasis. Nobody has really said anything a million times; the speaker exaggerates to show frustration.",
        why: { B: "Litotes is understatement, the opposite of exaggeration.", C: "A euphemism softens something unpleasant; this sentence makes the point stronger, not softer." },
      },
      {
        t: "literary-terms",
        stem: "\"The angry wind slapped the windows of the classroom.\" The main device in this sentence is",
        o: ["personification", "simile", "apostrophe", "antithesis"], ans: 0, d: 1,
        e: "Personification gives human feelings or actions to non-human things. The wind is described as 'angry' and as 'slapping', which are human emotions and actions.",
        why: { B: "There is no comparison using 'like' or 'as'.", C: "Apostrophe means speaking directly to something; nobody addresses the wind here." },
      },
      {
        t: "literary-terms",
        stem: "A line or group of lines repeated at regular intervals in a poem or song, usually at the end of each stanza, is called",
        o: ["a refrain", "a couplet", "a caesura", "an octave"], ans: 0, d: 1,
        e: "A refrain is a line or lines repeated regularly through a poem or song, like a chorus. It emphasises a key idea and gives the poem a musical pattern.",
        why: { B: "A couplet is two consecutive lines that rhyme, not a repeated line.", D: "An octave is the first eight lines of a Petrarchan sonnet." },
      },
      {
        t: "literary-terms",
        stem: "\"The slow boat rolled home through the cold foam.\" The repetition of the same vowel sound in slow, boat, rolled, home, cold and foam is",
        o: ["assonance", "alliteration", "onomatopoeia", "a pun"], ans: 0, d: 3,
        e: "Assonance is the repetition of similar VOWEL sounds within nearby words. The long 'o' sound recurs in slow, boat, rolled, home, cold and foam, giving the line a slow, heavy movement.",
        why: { B: "Alliteration repeats the same CONSONANT sound at the start of nearby words; these words begin with different consonants.", C: "Onomatopoeia uses words that imitate sounds, such as 'splash'; none of these words do." },
      },
      {
        t: "literary-terms",
        stem: "Emeka failed every subject in his examination. His friend shook his hand and said, \"Well done, genius!\" The friend's remark is an example of",
        o: ["verbal irony", "hyperbole", "euphemism", "apostrophe"], ans: 0, d: 2,
        e: "Verbal irony is saying the opposite of what one really means. After a total failure, calling Emeka a 'genius' and saying 'well done' actually means the reverse.",
        why: { B: "The friend is not exaggerating a truth; he is saying the opposite of the truth.", C: "A euphemism softens bad news; this remark mocks rather than softens." },
      },
      {
        t: "literary-terms",
        stem: "\"O Death, why did you visit our compound so early?\" The figure of speech in which the speaker addresses Death directly is",
        o: ["apostrophe", "metonymy", "onomatopoeia", "litotes"], ans: 0, d: 2,
        e: "Apostrophe is directly addressing an absent person, a dead person, an abstract idea or a thing as if it could hear. Death cannot hear, yet the speaker talks to it.",
        why: { B: "Metonymy names something by an associated thing (e.g. 'the crown' for a king).", D: "Litotes is understatement by denying the opposite (e.g. 'not bad')." },
      },
      {
        t: "literary-terms",
        stem: "In poetry, the running on of a sentence from one line into the next without a pause at the end of the line is called",
        o: ["enjambment", "caesura", "end-stopping", "refrain"], ans: 0, d: 2,
        e: "Enjambment (run-on lines) happens when the sense and grammar of a line continue into the next line with no punctuation or pause at the line ending.",
        why: { B: "A caesura is a pause WITHIN a line.", C: "An end-stopped line is the opposite: it finishes with a pause, usually marked by punctuation." },
      },
      {
        t: "literary-terms",
        stem: "\"Ade ran to the gate; the house behind him was dark.\" The strong pause in the middle of this line of verse, marked here by the semicolon, is called",
        o: ["a caesura", "an enjambment", "a refrain", "a foot"], ans: 0, d: 3,
        e: "A caesura is a pause or break within a line of poetry, often marked by punctuation such as a full stop, semicolon or comma. Here the semicolon splits the line into two halves.",
        why: { B: "Enjambment is the run-on of a sentence from one line to the next, not a pause inside a line.", D: "A foot is a unit of metre (such as an iamb), not a pause." },
      },
      {
        t: "literary-terms",
        stem: "A work that uses humour, irony and exaggeration to expose and criticise the foolishness or wrongdoing of people or institutions is",
        o: ["a satire", "an elegy", "a lyric", "a tragedy"], ans: 0, d: 2,
        e: "Satire ridicules human vices and follies (for example corruption or hypocrisy) through humour, irony and exaggeration, with the aim of exposing them and encouraging change.",
        why: { B: "An elegy is a poem of mourning for someone who has died.", C: "A lyric is a short poem expressing personal feelings, not mainly criticism." },
      },
      // poetry
      {
        t: "poetry", ctx: FISHERMAN,
        stem: "The rhyme scheme of the poem is",
        o: ["aabbccdd", "ababcdcd", "abbacddc", "abcabcdd"], ans: 0, d: 1,
        e: "The end words pair off: boat/throat (a a), reeds/weeds (b b), reach/speech (c c), shore/before (d d). Each pair of lines rhymes together, giving aabbccdd: rhyming couplets.",
        why: { B: "ababcdcd would need 'boat' to rhyme with 'reeds', which it does not.", C: "abba would need 'boat' to rhyme with 'weeds', which it does not." },
      },
      {
        t: "poetry", ctx: FISHERMAN,
        stem: "\"The river, a brown snake\" (line 3) is an example of",
        o: ["metaphor", "simile", "hyperbole", "onomatopoeia"], ans: 0, d: 1,
        e: "The river is directly identified as 'a brown snake' without 'like' or 'as', so this is a metaphor. It suggests the river's winding shape, muddy colour and hidden danger.",
        why: { B: "A simile would say the river is LIKE a brown snake.", C: "The comparison is not an exaggeration; it pictures the river's shape and colour." },
      },
      {
        t: "poetry", ctx: FISHERMAN,
        stem: "In \"the water's whispered speech\" (line 6), the repetition of the \"w\" sound at the beginning of words is",
        o: ["alliteration", "assonance", "rhyme", "caesura"], ans: 0, d: 1,
        e: "Alliteration is the repetition of the same consonant sound at the beginning of nearby words. 'Water's' and 'whispered' both begin with 'w', imitating the soft sound of moving water.",
        why: { B: "Assonance is the repetition of VOWEL sounds, not initial consonants.", C: "Rhyme is the matching of sounds at the ends of words or lines." },
      },
      {
        t: "poetry", ctx: FISHERMAN,
        stem: "The poem is written in rhyming pairs of ten-syllable iambic lines. Such pairs are called",
        o: ["heroic couplets", "blank verse", "free verse", "quatrains"], ans: 0, d: 3,
        e: "Heroic couplets are pairs of rhyming lines in iambic pentameter (ten syllables, five iambic feet). Each pair here rhymes (boat/throat, reeds/weeds…) and each line has ten syllables, e.g. 'at DAWN old E-bi PUSH-es OUT his BOAT'.",
        why: { B: "Blank verse is iambic pentameter WITHOUT rhyme.", C: "Free verse has neither regular metre nor regular rhyme; this poem has both." },
      },
      {
        t: "poetry", ctx: FISHERMAN,
        stem: "The last line, \"With fewer fish than on the day before\", suggests that",
        o: ["Ebi's livelihood is slowly declining", "Ebi has given up fishing for good", "the river is about to flood the village", "Ebi is the richest fisherman in the village"], ans: 0, d: 2,
        e: "Each day he catches less than the day before, even though he casts his net 'as wide as hope can reach'. This points to a steady decline in his catch and therefore in his livelihood.",
        why: { B: "He goes out at dawn and returns at dusk; nothing says he has stopped fishing.", C: "No flood is mentioned; the river 'slides' calmly past the reeds." },
      },
      {
        t: "poetry", ctx: MARKET,
        stem: "The word \"Bang!\" in line 1 is an example of",
        o: ["onomatopoeia", "oxymoron", "euphemism", "metonymy"], ans: 0, d: 1,
        e: "Onomatopoeia is the use of a word whose sound imitates the sound it describes. 'Bang!' imitates the noise of the metal shutter being thrown open.",
        why: { B: "An oxymoron joins two contradictory words; 'Bang!' is a single sound word.", C: "A euphemism softens something unpleasant, which 'Bang!' does not do." },
      },
      {
        t: "poetry", ctx: MARKET,
        stem: "\"Pepper sellers shout a thousand greetings\" (line 2) contains",
        o: ["hyperbole", "litotes", "apostrophe", "antithesis"], ans: 0, d: 2,
        e: "Hyperbole is deliberate exaggeration. The sellers do not literally give a thousand greetings; the number exaggerates how many and how loud the greetings are, to show the market's busy friendliness.",
        why: { B: "Litotes is understatement, the opposite of this exaggeration.", C: "Apostrophe is addressing someone absent or something non-human directly; the line describes, it does not address." },
      },
      {
        t: "poetry", ctx: MARKET,
        stem: "Lines 4 and 5 (\"and Mama Ngozi's laughter rolls / from one end of the market to the other\") illustrate",
        o: ["enjambment", "caesura", "a refrain", "a rhyming couplet"], ans: 0, d: 2,
        e: "The sentence does not stop at the end of line 4; it runs on into line 5 ('rolls / from one end…'). Continuing a sentence across a line break without a pause is enjambment, and here it mirrors the laughter rolling on.",
        why: { B: "A caesura is a pause in the middle of a line, not a run-on between lines.", D: "'rolls' and 'other' do not rhyme, so these lines are not a rhyming couplet." },
      },
      {
        t: "poetry", ctx: MARKET,
        stem: "The main contrast in the poem is between",
        o: ["the noisy, lively morning and the silent, empty evening", "the rich traders and the poor buyers", "the city market and a village farm", "the rainy season and the dry season"], ans: 0, d: 2,
        e: "The first five lines are full of noise and activity (Bang!, shouting, laughter). The last three lines show empty stalls and silence. The poem is built on this contrast between the busy day and the quiet evening.",
        why: { B: "The poem says nothing about who is rich or poor.", D: "No season is mentioned; the change is from morning to evening." },
      },
      {
        t: "poetry", ctx: MARKET,
        stem: "In the last line, \"silence sits alone, counting the day's coins\", the poet",
        o: ["presents silence as a person to stress the market's emptiness", "uses a simile to compare silence with a trader", "addresses silence directly as if it could hear", "exaggerates how much money the traders made"], ans: 0, d: 2,
        e: "Silence is given human actions (sitting alone, counting coins), which is personification. Picturing silence as the only 'trader' left emphasises how completely the crowd has gone.",
        why: { B: "There is no 'like' or 'as', so it is not a simile.", C: "The poet describes silence; nobody speaks to it, so it is not apostrophe." },
      },
      // drama
      {
        t: "drama", ctx: PRINCE,
        stem: "Kabiru's boast, \"The Prince himself could not get past me tonight\", is amusing mainly because of",
        o: ["dramatic irony", "a soliloquy", "a flashback", "a pun"], ans: 0, d: 2,
        e: "Dramatic irony occurs when the audience knows something a character does not. We know the 'beggar' is the Prince, who has just walked past the sleeping guard, so Kabiru's boast is funny.",
        why: { B: "A soliloquy is a speech made alone on stage; Kabiru is speaking to the Prince.", C: "A flashback returns to earlier events; this happens in the present." },
      },
      {
        t: "drama", ctx: PRINCE,
        stem: "The Prince's reply, \"I am sure he could not, my brave friend\", is an example of",
        o: ["verbal irony", "an aside", "a euphemism", "a soliloquy"], ans: 0, d: 2,
        e: "Verbal irony means saying the opposite of what one means. The Prince knows he got past easily and that Kabiru was asleep, so 'I am sure he could not' and 'brave' mean the reverse.",
        why: { B: "The line is spoken to Kabiru, not to the audience, so it is not an aside.", D: "A soliloquy is a speech made alone on stage; Kabiru is present." },
      },
      {
        t: "drama", ctx: PRINCE,
        stem: "The opening stage direction, \"Night. The palace courtyard\", mainly tells the audience about the",
        o: ["setting", "theme", "climax", "conflict"], ans: 0, d: 1,
        e: "Setting is the time and place in which the action happens. 'Night' gives the time and 'the palace courtyard' gives the place.",
        why: { B: "A theme is a central idea of the play, not a time and place.", C: "The climax is the turning point of the plot, which a scene heading cannot show." },
      },
      {
        t: "drama", ctx: BELLO,
        stem: "In this extract, the character of Femi mainly serves as",
        o: ["a foil to Tunde", "the antagonist of the play", "a chorus commenting on the action", "a narrator of past events"], ans: 0, d: 3,
        e: "A foil is a character whose qualities contrast with another's, making that character's traits stand out. Femi's obedient, busy behaviour highlights Tunde's very different, dreamy and inventive nature.",
        why: { B: "An antagonist actively opposes the main character; Femi does nothing against Tunde and does not even appear.", C: "A chorus comments on the action; Femi is only mentioned by Mrs Bello." },
      },
      {
        t: "drama", ctx: BELLO,
        stem: "Tunde's last reply shows him to be",
        o: ["witty and imaginative", "timid and silent", "rude and violent", "obedient and hard-working"], ans: 0, d: 2,
        e: "Instead of being silenced by his mother's scolding, Tunde gives a clever answer that turns her question round: thinking cannot wash a car, but it can invent a machine that does. This shows quick wit and imagination.",
        why: { B: "He answers back promptly, so he is not timid or silent.", D: "He has not done the chores his mother lists, so 'obedient and hard-working' does not fit." },
      },
      {
        t: "drama", ctx: BELLO,
        stem: "Mrs Bello's question, \"Can thinking wash a car?\", is",
        o: ["a rhetorical question", "an aside", "a pun", "a soliloquy"], ans: 0, d: 1,
        e: "A rhetorical question is asked for effect, with an obvious answer expected. Mrs Bello means 'Thinking cannot wash a car', scolding Tunde for doing no chores.",
        why: { B: "She speaks directly to Tunde, not privately to the audience.", D: "A soliloquy is a speech made alone on stage; Tunde is present." },
      },
      {
        t: "drama",
        stem: "In a play, the character or force that opposes the main character is called the",
        o: ["antagonist", "protagonist", "foil", "narrator"], ans: 0, d: 1,
        e: "The antagonist is the character (or force) that works against the protagonist, the main character, creating the central conflict of the play.",
        why: { B: "The protagonist is the main character, not the one who opposes him or her.", C: "A foil contrasts with another character but need not oppose him." },
      },
      {
        t: "drama",
        stem: "According to Aristotle, the purging of the emotions of pity and fear which the audience experiences at the end of a tragedy is",
        o: ["catharsis", "hamartia", "hubris", "nemesis"], ans: 0, d: 3,
        e: "In his Poetics, Aristotle says tragedy arouses pity and fear in the audience and brings about their catharsis, a cleansing or release of these emotions, so the audience leaves feeling relieved.",
        why: { B: "Hamartia is the hero's tragic flaw or error, not the audience's emotional release.", C: "Hubris is excessive pride shown by the hero." },
      },
      {
        t: "drama",
        stem: "The final part of a play's plot, in which the complications are unravelled and the outcome is made clear, is the",
        o: ["denouement", "exposition", "rising action", "climax"], ans: 0, d: 2,
        e: "The denouement (French for 'untying') follows the climax. Loose ends are tied up, mysteries are explained and the fate of the characters is settled.",
        why: { B: "The exposition comes at the beginning and introduces characters and situation.", D: "The climax is the turning point of highest tension, which comes before the denouement." },
      },
      {
        t: "drama",
        stem: "A type of comedy that relies on exaggerated, highly improbable situations, mistaken identities and physical horseplay mainly to make the audience laugh is",
        o: ["farce", "tragedy", "tragicomedy", "a morality play"], ans: 0, d: 3,
        e: "Farce is a form of comedy built on absurd, unlikely situations, fast action, misunderstandings and slapstick. Its main aim is laughter rather than serious comment.",
        why: { C: "Tragicomedy mixes serious and comic elements and often has a happy ending after threatened disaster.", D: "A morality play is a medieval drama in which characters stand for virtues and vices, teaching a moral lesson." },
      },
      // prose
      {
        t: "prose", ctx: GARBA,
        stem: "Mallam Garba is best described as",
        o: ["patient and generous", "harsh and quick-tempered", "greedy and suspicious", "careless and forgetful"], ans: 0, d: 1,
        e: "He 'never raised his voice', did not chase or report the boys, and gave them a basket of his best mangoes. These actions show patience and generosity.",
        why: { B: "He never raised his voice or punished the boys.", C: "He gave mangoes away freely, which is the opposite of greed." },
      },
      {
        t: "prose", ctx: GARBA,
        stem: "The writer reveals Mallam Garba's character mainly by",
        o: ["showing his actions and their effect on others", "describing his private thoughts in detail", "letting him describe himself in a long speech", "describing his physical appearance in detail"], ans: 0, d: 3,
        e: "This is indirect characterisation (showing rather than telling): we learn what Garba is like from what he does (leaving mangoes and a note) and how the boys respond, not from the narrator labelling him.",
        why: { B: "The narrator never enters Garba's mind; we learn about him from outside, through what he does.", D: "His appearance is not described at all." },
      },
      {
        t: "prose", ctx: GARBA,
        stem: "Which of the following best states a theme of the extract?",
        o: ["Kindness can change behaviour more effectively than punishment", "Children should never be trusted with fruit trees", "Old people are usually lonely and bitter", "Stealing is the quickest way to make friends"], ans: 0, d: 2,
        e: "A theme is the central idea the story conveys. Garba's generous response stops the stealing and turns the boys into respectful neighbours, showing that kindness can reform people better than punishment.",
        why: { B: "The story is about how the boys changed, not about distrusting children.", C: "Garba is shown as calm and generous, not lonely or bitter." },
      },
      {
        t: "prose", ctx: BOTTLE,
        stem: "The grandmother's words, \"You will need this before the journey ends\", are an example of",
        o: ["foreshadowing", "flashback", "anticlimax", "stream of consciousness"], ans: 0, d: 2,
        e: "Foreshadowing is a hint or warning of what will happen later in a story. The grandmother's words prepare us for the breakdown in the heat, when Chidi will need the water.",
        why: { B: "A flashback goes back to earlier events; these words point forward.", D: "Stream of consciousness records a character's flowing thoughts; this is spoken dialogue." },
      },
      {
        t: "prose", ctx: BOTTLE,
        stem: "From which point of view is the extract narrated?",
        o: ["Third person", "First person", "Second person", "Chidi's own diary"], ans: 0, d: 1,
        e: "The narrator stands outside the story and refers to the characters as 'he', 'his' and 'she' ('Chidi laughed', 'he remembered'). This is third-person narration.",
        why: { B: "First-person narration uses 'I'; Chidi is called 'he'.", C: "Second-person narration addresses the reader as 'you'." },
      },
      {
        t: "prose", ctx: BOTTLE,
        stem: "Chidi's reaction when he receives the bottle shows that at first he",
        o: ["did not take his grandmother's warning seriously", "was angry with his grandmother", "expected the bus to break down", "refused to accept the bottle"], ans: 0, d: 2,
        e: "He laughs and pushes the bottle to the bottom of his bag, which shows he thought the warning was unnecessary. Only later, in the heat, does he remember her words.",
        why: { B: "He thanks her politely, so he is not angry.", D: "He accepts it and puts it in his bag." },
      },
      {
        t: "prose",
        stem: "A novel that tells the episodic adventures of a roguish, often lower-class hero who wanders from place to place is called",
        o: ["a picaresque novel", "an epistolary novel", "a historical novel", "a bildungsroman"], ans: 0, d: 3,
        e: "The picaresque novel (from Spanish 'pícaro', a rogue) follows a clever, morally loose hero through a series of loosely connected adventures as he travels and survives by his wits.",
        why: { B: "An epistolary novel is told through letters.", D: "A bildungsroman traces a character's growth to maturity, not a rogue's wanderings." },
      },
      {
        t: "prose",
        stem: "The arrangement of events in a story, linked by cause and effect, is the",
        o: ["plot", "theme", "setting", "diction"], ans: 0, d: 1,
        e: "Plot is the sequence of connected events in a story, usually moving from exposition through rising action and climax to resolution.",
        why: { B: "Theme is the central idea or message, not the events themselves.", C: "Setting is the time and place of the action." },
      },
      {
        t: "prose",
        stem: "A work of prose fiction that is longer than a short story but shorter than a novel is called",
        o: ["a novella", "an anecdote", "a fable", "an epic"], ans: 0, d: 2,
        e: "A novella is a prose narrative of intermediate length: more developed than a short story, but shorter and usually less complex than a full novel.",
        why: { B: "An anecdote is a very short account of a real, often amusing, incident.", D: "An epic is a long narrative POEM about a hero, not a short prose work." },
      },
      {
        t: "prose",
        stem: "A narrator whose account the reader cannot fully trust, because of ignorance, bias, madness or dishonesty, is called",
        o: ["an unreliable narrator", "an omniscient narrator", "an objective narrator", "an intrusive narrator"], ans: 0, d: 3,
        e: "An unreliable narrator is one whose telling of events is distorted, so readers must look beyond the narrator's words to work out what really happened.",
        why: { B: "An omniscient narrator knows everything about all the characters and is generally trustworthy.", C: "An objective narrator reports only what can be seen and heard, without bias or comment." },
      },
      // african-literature
      {
        t: "african-literature",
        stem: "The Lion and the Jewel, a comedy about Sidi, Lakunle and Baroka, was written by",
        o: ["Wole Soyinka", "Ola Rotimi", "Femi Osofisan", "J. P. Clark"], ans: 0, d: 1,
        e: "The Lion and the Jewel is a play by Wole Soyinka, first performed in 1959. It is set in the Yoruba village of Ilujinle and contrasts tradition with shallow modernity.",
        why: { B: "Ola Rotimi wrote The Gods Are Not to Blame and Kurunmi.", C: "Femi Osofisan wrote plays such as Morountodun and Women of Owu." },
      },
      {
        t: "african-literature",
        stem: "In many Yoruba and Igbo folktales, the best-known trickster, who uses cunning rather than strength, is the",
        o: ["tortoise", "elephant", "lion", "goat"], ans: 0, d: 1,
        e: "The tortoise (Ijapa in Yoruba, Mbe in Igbo) is the classic trickster of Nigerian folktales: small and slow, but clever and often greedy, and frequently punished for his tricks.",
        why: { B: "The elephant usually represents size and strength, not cunning.", C: "The lion usually represents power or kingship." },
      },
      {
        t: "african-literature",
        stem: "Chinua Achebe's famous essay \"An Image of Africa\" criticises the portrayal of Africans in",
        o: ["Joseph Conrad's Heart of Darkness", "George Orwell's Animal Farm", "Charles Dickens's Oliver Twist", "William Shakespeare's Othello"], ans: 0, d: 3,
        e: "In 'An Image of Africa' (first delivered as a lecture in 1975), Achebe argued that Joseph Conrad's Heart of Darkness presents Africa as a dark backdrop and denies Africans full humanity.",
        why: { B: "Animal Farm is an allegory of the Russian Revolution and is not about Africa.", C: "Oliver Twist is set in England and is not about Africa." },
      },
      {
        t: "african-literature",
        stem: "Song of Lawino, a long poem in which a rural wife complains about her Westernised husband, was written by the Ugandan poet",
        o: ["Okot p'Bitek", "Dennis Brutus", "Kofi Awoonor", "Gabriel Okara"], ans: 0, d: 2,
        e: "Okot p'Bitek wrote Song of Lawino (first in Acholi, then in English, 1966). Lawino defends African ways against her husband Ocol's blind copying of Western culture.",
        why: { B: "Dennis Brutus was a South African poet known for protest poetry against apartheid.", C: "Kofi Awoonor was a Ghanaian poet." },
      },
      {
        t: "african-literature",
        stem: "Chimamanda Ngozi Adichie's novel Half of a Yellow Sun is set mainly during",
        o: ["the Nigerian Civil War", "the Second World War", "the slave trade era", "Nigeria's colonial amalgamation of 1914"], ans: 0, d: 2,
        e: "Half of a Yellow Sun (2006) follows several characters before and during the Nigerian Civil War (1967–1970). The title refers to the half-sun symbol on the Biafran flag.",
        why: { B: "The novel deals with events in the 1960s, long after the Second World War ended in 1945.", D: "It is set in the 1960s, not in 1914." },
      },
      {
        t: "african-literature",
        stem: "Ijala is a form of Yoruba oral poetry traditionally chanted by",
        o: ["hunters", "fishermen", "weavers", "blacksmiths"], ans: 0, d: 3,
        e: "Ijala is the poetry of Yoruba hunters, associated with Ogun. It is chanted at hunters' gatherings and festivals and celebrates animals, hunting feats and important people.",
        why: { B: "Ijala is linked with hunting in the forest, not with fishing." },
      },
      {
        t: "african-literature",
        stem: "Mariama Bâ, author of the novel So Long a Letter, was a writer from",
        o: ["Senegal", "Ghana", "Kenya", "Cameroon"], ans: 0, d: 2,
        e: "Mariama Bâ was a Senegalese writer. So Long a Letter (Une si longue lettre, 1979) is written as a long letter from Ramatoulaye to her friend Aissatou.",
        why: { B: "Ghanaian women writers include Ama Ata Aidoo; Bâ was Senegalese and wrote in French." },
      },
      {
        t: "african-literature",
        stem: "Ama Ata Aidoo, author of the play The Dilemma of a Ghost, is from",
        o: ["Ghana", "Nigeria", "Uganda", "Senegal"], ans: 0, d: 2,
        e: "Ama Ata Aidoo was a Ghanaian playwright, poet and novelist. The Dilemma of a Ghost (1965) is about a Ghanaian man who returns home with an African-American wife.",
        why: { B: "She was not Nigerian; the play is set in Ghana.", D: "The Senegalese woman writer often studied is Mariama Bâ." },
      },
      {
        t: "african-literature",
        stem: "Which Nigerian poet, author of Labyrinths, died fighting in the Nigerian Civil War in 1967?",
        o: ["Christopher Okigbo", "J. P. Clark", "Gabriel Okara", "Niyi Osundare"], ans: 0, d: 3,
        e: "Christopher Okigbo, one of Nigeria's most important modern poets, was killed in 1967 early in the Civil War. His collected poems were published as Labyrinths.",
        why: { B: "J. P. Clark lived until 2020.", C: "Gabriel Okara lived until 2019." },
      },
      {
        t: "african-literature",
        stem: "The novels People of the City and Jagua Nana, set in Lagos, were written by",
        o: ["Cyprian Ekwensi", "Amos Tutuola", "Elechi Amadi", "Chinua Achebe"], ans: 0, d: 2,
        e: "Cyprian Ekwensi is known for lively novels of Lagos city life, including People of the City (1954) and Jagua Nana (1961).",
        why: { B: "Amos Tutuola wrote The Palm-Wine Drinkard, based on Yoruba folklore.", C: "Elechi Amadi wrote The Concubine, set in a traditional village." },
      },
    ],
    free: [1, 3, 6, 8, 11, 13, 16, 18, 21, 23, 26, 28, 31, 33, 36, 38, 40, 43, 44, 49],
  },
};
