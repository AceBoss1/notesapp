// Chemistry WAEC/NECO practice questions for Naija Exam Prep. Original questions; options are written with the correct one
// first and shuffled at build time. Every calculation is worked out in `check` and compared with option A.
const close = (a, b) => Math.abs(a - b) < 1e-9;
const near = (a, b, tol) => Math.abs(a - b) < tol;
const is = (q, value) => ({ ...q, check: q.o[0] === value });
// Compares the leading number of option A (spaces removed) with the worked value.
const num = (q, value) => ({ ...q, check: close(parseFloat(q.o[0].replace(/\s/g, "")), value) });
// Reads option A written as "m × 10ⁿ" and compares it with the worked value (to 3 significant figures).
const SUPS = "⁰¹²³⁴⁵⁶⁷⁸⁹";
const sci = (q, value) => {
  const [m, e] = q.o[0].split(" × 10");
  const exp = Number([...e].map((c) => SUPS.indexOf(c)).join(""));
  return { ...q, check: near(parseFloat(m) * 10 ** exp, value, Math.abs(value) * 0.005) };
};
const SUB = { 0: "₀", 1: "₁", 2: "₂", 3: "₃", 4: "₄", 5: "₅", 6: "₆", 7: "₇", 8: "₈", 9: "₉" };
const sub = (n) => (n === 1 ? "" : String(n).replace(/\d/g, (d) => SUB[d]));
const ox = (n) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : "0");

export default {
  waec: {
    list: [
      // atomic-structure-and-bonding
      {
        t: "atomic-structure-and-bonding",
        stem: "Which subatomic particle has a relative mass of about 1 and carries no electrical charge?",
        o: ["neutron", "proton", "electron", "alpha particle"], ans: 0, d: 1,
        e: "The neutron is found in the nucleus, has a relative mass of about 1 (like the proton) and has no charge. The proton has a mass of about 1 but a charge of +1, and the electron has a charge of −1 and a mass of only about 1/1840.",
        why: { B: "A proton has about the same mass but carries a +1 charge.", C: "An electron carries a −1 charge and is almost massless compared with the neutron." },
      },
      {
        t: "atomic-structure-and-bonding",
        stem: "When magnesium burns in oxygen, magnesium oxide is formed. What type of bond holds the particles of magnesium oxide together?",
        o: ["electrovalent (ionic) bond", "covalent bond", "metallic bond", "hydrogen bond"], ans: 0, d: 1,
        e: "Magnesium (2, 8, 2) is a metal that loses two electrons to form Mg²⁺, and oxygen (2, 6) is a non-metal that gains two electrons to form O²⁻. Transfer of electrons from a metal to a non-metal gives an electrovalent (ionic) bond between the oppositely charged ions.",
        why: { B: "Covalent bonds form by sharing electrons, usually between two non-metals.", C: "Metallic bonding holds atoms together in a pure metal, not in a metal oxide." },
      },
      is({
        t: "atomic-structure-and-bonding",
        stem: "How many electrons, protons and neutrons are there in the aluminium ion ²⁷₁₃Al³⁺?",
        o: ["10 electrons, 13 protons, 14 neutrons", "13 electrons, 13 protons, 14 neutrons", "10 electrons, 13 protons, 27 neutrons", "16 electrons, 13 protons, 14 neutrons"], ans: 0, d: 2,
        e: "The atomic number 13 gives 13 protons. Neutrons = mass number − atomic number = 27 − 13 = 14. A neutral atom has 13 electrons; the 3+ charge means 3 electrons have been lost, so the ion has 13 − 3 = 10 electrons.",
        why: { B: "13 electrons is the neutral atom; the 3+ ion has lost three electrons.", C: "27 is the mass number (protons + neutrons), not the number of neutrons.", D: "16 electrons would be a 3− ion, formed by gaining electrons." },
      }, `${13 - 3} electrons, 13 protons, ${27 - 13} neutrons`),
      {
        t: "atomic-structure-and-bonding",
        stem: "The carbon atom in methane, CH₄, forms four single covalent bonds and has no lone pairs. What is the shape of the methane molecule?",
        o: ["tetrahedral", "linear", "trigonal planar", "bent (V-shaped)"], ans: 0, d: 2,
        e: "Four bonding electron pairs around carbon repel one another equally and get as far apart as possible, pointing to the corners of a tetrahedron with bond angles of about 109.5°. So methane is tetrahedral.",
        why: { B: "Linear shapes arise from two electron pairs, as in CO₂.", C: "Trigonal planar arises from three electron pairs, as in BF₃.", D: "A bent shape needs lone pairs on the central atom, as in H₂O." },
      },
      {
        t: "atomic-structure-and-bonding",
        stem: "Which of the following Period 3 elements has the highest first ionisation energy?",
        o: ["chlorine", "sodium", "magnesium", "aluminium"], ans: 0, d: 2,
        e: "Across a period, nuclear charge increases while the outer electrons stay in the same shell, so the outer electrons are held more tightly and ionisation energy generally rises. Chlorine is furthest to the right of the four, so it needs the most energy to remove an outer electron.",
        why: { B: "Sodium, at the start of the period, has the lowest first ionisation energy of the four.", C: "Magnesium's value is higher than sodium's and aluminium's but still far below chlorine's." },
      },
      num({
        t: "atomic-structure-and-bonding",
        stem: "Boron has two isotopes, ¹⁰B and ¹¹B. Its relative atomic mass is 10.8. What is the percentage abundance of ¹⁰B?",
        o: ["20%", "80%", "8%", "50%"], ans: 0, d: 3,
        e: "Let the abundance of ¹⁰B be x%, so ¹¹B is (100 − x)%. Then (10x + 11(100 − x)) ÷ 100 = 10.8, so 1100 − x = 1080 and x = 20. Boron is 20% ¹⁰B and 80% ¹¹B; the average (10.8) is closer to 11 because ¹¹B is more abundant.",
        why: { B: "80% is the abundance of ¹¹B, the heavier isotope.", D: "50% of each would give a relative atomic mass of 10.5, not 10.8." },
      }, (() => { for (let x = 0; x <= 100; x++) if (close((10 * x + 11 * (100 - x)) / 100, 10.8)) return x; })()),

      // stoichiometry
      num({
        t: "stoichiometry",
        stem: "What volume is occupied by 0.5 mol of hydrogen gas at s.t.p.? [Molar volume = 22.4 dm³ at s.t.p.]",
        o: ["11.2 dm³", "22.4 dm³", "44.8 dm³", "5.6 dm³"], ans: 0, d: 1,
        e: "One mole of any gas occupies 22.4 dm³ at s.t.p. So 0.5 mol occupies 0.5 × 22.4 = 11.2 dm³.",
        why: { B: "22.4 dm³ is the volume of one whole mole, not half a mole.", C: "44.8 dm³ comes from dividing 22.4 by 0.5 instead of multiplying." },
      }, 0.5 * 22.4),
      num({
        t: "stoichiometry",
        stem: "What is the mass of 0.25 mol of calcium trioxocarbonate(IV), CaCO₃? [C = 12, O = 16, Ca = 40]",
        o: ["25 g", "100 g", "400 g", "2.5 g"], ans: 0, d: 1,
        e: "Molar mass of CaCO₃ = 40 + 12 + (3 × 16) = 100 g mol⁻¹. Mass = moles × molar mass = 0.25 × 100 = 25 g.",
        why: { B: "100 g is the mass of one mole, not 0.25 mol.", C: "400 g comes from dividing 100 by 0.25 instead of multiplying." },
      }, 0.25 * (40 + 12 + 3 * 16)),
      num({
        t: "stoichiometry",
        stem: "Methane burns in oxygen: CH₄(g) + 2O₂(g) → CO₂(g) + 2H₂O(l). What volume of oxygen is needed to burn 20 cm³ of methane completely, all volumes measured at the same temperature and pressure?",
        o: ["40 cm³", "20 cm³", "10 cm³", "60 cm³"], ans: 0, d: 2,
        e: "By Gay-Lussac's law, gases react in simple volume ratios equal to their mole ratios. CH₄ : O₂ = 1 : 2, so 20 cm³ of methane needs 2 × 20 = 40 cm³ of oxygen.",
        why: { B: "20 cm³ assumes a 1 : 1 ratio, ignoring the 2 in front of O₂.", C: "10 cm³ inverts the ratio (it would be the volume of CH₄ needed for 20 cm³ of O₂)." },
      }, 20 * 2),
      sci({
        t: "stoichiometry",
        stem: "How many atoms are present in 0.1 mol of ammonia, NH₃? [Avogadro constant = 6.02 × 10²³ mol⁻¹]",
        o: ["2.41 × 10²³", "6.02 × 10²²", "6.02 × 10²³", "1.81 × 10²³"], ans: 0, d: 2,
        e: "Number of molecules = 0.1 × 6.02 × 10²³ = 6.02 × 10²². Each NH₃ molecule contains 4 atoms (1 N + 3 H), so the number of atoms = 4 × 6.02 × 10²² = 2.408 × 10²³ ≈ 2.41 × 10²³.",
        why: { B: "6.02 × 10²² is the number of molecules; each molecule has 4 atoms.", D: "1.81 × 10²³ counts only the 3 hydrogen atoms in each molecule." },
      }, 4 * 0.1 * 6.02e23),
      num({
        t: "stoichiometry",
        stem: "6.5 g of zinc is added to 100 cm³ of 1.0 mol dm⁻³ hydrochloric acid: Zn + 2HCl → ZnCl₂ + H₂. What volume of hydrogen is produced at s.t.p.? [Zn = 65; molar volume = 22.4 dm³ at s.t.p.]",
        o: ["1.12 dm³", "2.24 dm³", "4.48 dm³", "0.56 dm³"], ans: 0, d: 3,
        e: "Moles of Zn = 6.5 ÷ 65 = 0.10 mol. Moles of HCl = 1.0 × 100/1000 = 0.10 mol. Zinc needs 2 × 0.10 = 0.20 mol HCl, so HCl is the limiting reagent. 2 mol HCl give 1 mol H₂, so 0.10 mol HCl gives 0.05 mol H₂ = 0.05 × 22.4 = 1.12 dm³.",
        why: { B: "2.24 dm³ assumes all the zinc reacts, but there is not enough acid for that.", C: "4.48 dm³ treats each mole of HCl as giving two moles of H₂." },
      }, (() => { const zn = 6.5 / 65, hcl = 1.0 * 0.1; return Math.min(zn, hcl / 2) * 22.4; })()),
      num({
        t: "stoichiometry",
        stem: "2.86 g of hydrated sodium trioxocarbonate(IV), Na₂CO₃·xH₂O, was heated to constant mass and 1.06 g of the anhydrous salt remained. What is the value of x? [H = 1, C = 12, O = 16, Na = 23]",
        o: ["10", "7", "5", "1"], ans: 0, d: 3,
        e: "Molar mass of Na₂CO₃ = 46 + 12 + 48 = 106 g mol⁻¹, so moles of Na₂CO₃ = 1.06 ÷ 106 = 0.010 mol. Mass of water lost = 2.86 − 1.06 = 1.80 g = 1.80 ÷ 18 = 0.10 mol. Ratio Na₂CO₃ : H₂O = 0.010 : 0.10 = 1 : 10, so x = 10 (washing soda, Na₂CO₃·10H₂O).",
        why: { B: "7 does not match the mole ratio of water to anhydrous salt.", D: "1 is the monohydrate; it would lose only 0.18 g of water here." },
      }, Math.round(((2.86 - 1.06) / 18) / (1.06 / (2 * 23 + 12 + 3 * 16)))),

      // acids-bases-and-salts
      {
        t: "acids-bases-and-salts",
        stem: "Which of the following is a property of dilute acids?",
        o: ["They turn blue litmus paper red.", "They turn red litmus paper blue.", "They feel soapy to the touch.", "They have a pH greater than 7."], ans: 0, d: 1,
        e: "Dilute acids contain hydrogen ions, H⁺(aq), which turn blue litmus red. They have a pH below 7 and taste sour. Turning red litmus blue, a soapy feel and pH above 7 are properties of alkalis.",
        why: { B: "Turning red litmus blue is a property of alkalis.", C: "A soapy feel is typical of alkalis, which react with oils on the skin.", D: "A pH greater than 7 means the solution is alkaline." },
      },
      {
        t: "acids-bases-and-salts",
        stem: "Which of the following gases dissolves in water to form an alkaline solution?",
        o: ["ammonia", "hydrogen chloride", "sulphur(IV) oxide", "carbon(IV) oxide"], ans: 0, d: 1,
        e: "Ammonia reacts with water: NH₃ + H₂O ⇌ NH₄⁺ + OH⁻. The hydroxide ions make the solution alkaline (it turns red litmus blue). The other three gases form acidic solutions.",
        why: { B: "Hydrogen chloride dissolves to form hydrochloric acid.", C: "Sulphur(IV) oxide forms trioxosulphate(IV) acid, H₂SO₃.", D: "Carbon(IV) oxide forms weak trioxocarbonate(IV) acid, H₂CO₃." },
      },
      {
        t: "acids-bases-and-salts",
        stem: "Crystals of washing soda, Na₂CO₃·10H₂O, left open to the air slowly lose part of their water of crystallisation and become a white powder. This property is called",
        o: ["efflorescence", "deliquescence", "hygroscopy", "sublimation"], ans: 0, d: 2,
        e: "An efflorescent substance gives up some or all of its water of crystallisation to the atmosphere when exposed, so the crystals crumble to a powder. Washing soda is a common example.",
        why: { B: "A deliquescent substance absorbs so much water from the air that it dissolves in it (e.g. CaCl₂, NaOH).", C: "A hygroscopic substance absorbs water from the air without dissolving (e.g. concentrated H₂SO₄)." },
      },
      num({
        t: "acids-bases-and-salts",
        stem: "What mass of sodium hydroxide is needed to prepare 500 cm³ of a 0.20 mol dm⁻³ solution? [H = 1, O = 16, Na = 23]",
        o: ["4.0 g", "8.0 g", "40 g", "0.10 g"], ans: 0, d: 2,
        e: "Moles needed = concentration × volume in dm³ = 0.20 × 500/1000 = 0.10 mol. Molar mass of NaOH = 23 + 16 + 1 = 40 g mol⁻¹. Mass = 0.10 × 40 = 4.0 g.",
        why: { B: "8.0 g is what 1 dm³ of the solution would need, not 500 cm³.", D: "0.10 is the number of moles, not the mass in grams." },
      }, 0.2 * (500 / 1000) * (23 + 16 + 1)),
      num({
        t: "acids-bases-and-salts",
        stem: "What is the basicity of ethanoic acid, CH₃COOH?",
        o: ["1", "4", "2", "3"], ans: 0, d: 2,
        e: "Basicity is the number of replaceable (ionisable) hydrogen atoms in one molecule of the acid. In CH₃COOH only the hydrogen of the –COOH group ionises (CH₃COOH ⇌ CH₃COO⁻ + H⁺); the three hydrogens of the CH₃ group are bonded to carbon and are not replaceable. So the basicity is 1.",
        why: { B: "4 counts every hydrogen atom, but only the –COOH hydrogen is replaceable.", C: "2 is the basicity of acids such as H₂SO₄, which have two replaceable hydrogens." },
      }, ["CH₃COOH"].map((f) => (f.match(/COOH/g) || []).length)[0]),
      num({
        t: "acids-bases-and-salts",
        stem: "25.0 cm³ of a sodium trioxocarbonate(IV) solution required 20.0 cm³ of 0.25 mol dm⁻³ hydrochloric acid for complete neutralisation, using methyl orange. Na₂CO₃ + 2HCl → 2NaCl + H₂O + CO₂. What is the concentration of the Na₂CO₃ solution in g dm⁻³? [C = 12, O = 16, Na = 23]",
        o: ["10.6 g dm⁻³", "21.2 g dm⁻³", "5.3 g dm⁻³", "0.10 g dm⁻³"], ans: 0, d: 3,
        e: "Moles of HCl = 0.25 × 20.0/1000 = 0.0050 mol. From the equation, moles of Na₂CO₃ = 0.0050 ÷ 2 = 0.0025 mol in 25.0 cm³. Concentration = 0.0025 ÷ 0.0250 = 0.10 mol dm⁻³. Molar mass of Na₂CO₃ = 106 g mol⁻¹, so concentration = 0.10 × 106 = 10.6 g dm⁻³.",
        why: { B: "21.2 g dm⁻³ ignores the 1 : 2 mole ratio and treats the reaction as 1 : 1.", D: "0.10 is the concentration in mol dm⁻³, not in g dm⁻³." },
      }, ((0.25 * 20.0 / 1000) / 2 / (25.0 / 1000)) * (2 * 23 + 12 + 3 * 16)),

      // redox-and-electrolysis
      {
        t: "redox-and-electrolysis",
        stem: "In terms of electron transfer, oxidation is defined as",
        o: ["loss of electrons", "gain of electrons", "gain of protons", "loss of neutrons"], ans: 0, d: 1,
        e: "Oxidation is the loss of electrons by a species, so its oxidation number increases. Reduction is the gain of electrons. A memory aid is OIL RIG: Oxidation Is Loss, Reduction Is Gain.",
        why: { B: "Gain of electrons is reduction.", C: "Gaining protons describes a base in acid-base reactions, not oxidation." },
      },
      num({
        t: "redox-and-electrolysis",
        stem: "What is the oxidation number of sulphur in tetraoxosulphate(VI) acid, H₂SO₄?",
        o: ["+6", "+4", "+2", "−2"], ans: 0, d: 1,
        e: "Hydrogen is +1 and oxygen is −2, and the compound is neutral. So 2(+1) + S + 4(−2) = 0, giving S − 6 = 0 and S = +6. This matches the (VI) in its name.",
        why: { B: "+4 is sulphur's oxidation number in SO₂ and H₂SO₃.", D: "−2 is sulphur's oxidation number in H₂S and metal sulphides." },
      }, 0 - 2 * 1 - 4 * -2),
      {
        t: "redox-and-electrolysis",
        stem: "Molten lead(II) bromide is electrolysed using carbon electrodes. Which substance is liberated at the anode?",
        o: ["bromine", "lead", "hydrogen", "oxygen"], ans: 0, d: 2,
        e: "The melt contains only Pb²⁺ and Br⁻ ions. Negative Br⁻ ions move to the positive anode and are oxidised: 2Br⁻ → Br₂ + 2e⁻, giving brown bromine vapour. Lead is deposited at the cathode.",
        why: { B: "Lead forms at the cathode, where Pb²⁺ gains electrons.", C: "There is no water in a melt, so no hydrogen can be formed." },
      },
      {
        t: "redox-and-electrolysis",
        stem: "In the reaction H₂S + Cl₂ → 2HCl + S, which substance is the reducing agent?",
        o: ["H₂S", "Cl₂", "HCl", "S"], ans: 0, d: 2,
        e: "Sulphur changes from −2 in H₂S to 0 in S, so H₂S loses electrons (is oxidised). A substance that is oxidised gives electrons to another substance and is therefore the reducing agent. Chlorine goes from 0 to −1, so Cl₂ is the oxidising agent.",
        why: { B: "Cl₂ gains electrons (0 → −1); it is the oxidising agent.", C: "HCl and S are products, not the reagents that donate or accept electrons." },
      },
      {
        t: "redox-and-electrolysis",
        stem: "In a Daniell cell, a zinc rod dips into zinc tetraoxosulphate(VI) solution and a copper rod dips into copper(II) tetraoxosulphate(VI) solution, connected by a salt bridge. In the external wire, electrons flow",
        o: ["from the zinc rod to the copper rod", "from the copper rod to the zinc rod", "through the salt bridge from zinc to copper", "in both directions equally"], ans: 0, d: 2,
        e: "Zinc is higher than copper in the electrochemical series, so zinc atoms are oxidised (Zn → Zn²⁺ + 2e⁻) and the electrons travel through the external wire to the copper rod, where Cu²⁺ + 2e⁻ → Cu. The zinc rod is the negative electrode.",
        why: { B: "Copper is less reactive, so it receives electrons rather than releasing them.", C: "The salt bridge carries ions, not electrons." },
      },
      num({
        t: "redox-and-electrolysis",
        stem: "The same quantity of electricity is passed through silver trioxonitrate(V) solution and copper(II) tetraoxosulphate(VI) solution connected in series. If 2.16 g of silver is deposited, what mass of copper is deposited? [Ag = 108, Cu = 64]",
        o: ["0.64 g", "1.28 g", "0.32 g", "2.16 g"], ans: 0, d: 3,
        e: "Ag⁺ + e⁻ → Ag: moles of Ag = 2.16 ÷ 108 = 0.020 mol, so 0.020 mol of electrons (0.020 F) passed. Cu²⁺ + 2e⁻ → Cu: 0.020 mol of electrons deposits 0.020 ÷ 2 = 0.010 mol of Cu = 0.010 × 64 = 0.64 g.",
        why: { B: "1.28 g forgets that each Cu²⁺ ion needs two electrons.", D: "Equal charge does not deposit equal masses; it depends on molar mass and ionic charge." },
      }, (2.16 / 108 / 2) * 64),

      // organic-chemistry
      {
        t: "organic-chemistry",
        stem: "Which of the following is an unsaturated hydrocarbon?",
        o: ["C₂H₄", "C₂H₆", "C₃H₈", "CH₄"], ans: 0, d: 1,
        e: "C₂H₄ (ethene) fits CₙH₂ₙ, the general formula of the alkenes, and contains a carbon–carbon double bond, so it is unsaturated. The others fit CₙH₂ₙ₊₂ and are saturated alkanes with only single bonds.",
        why: { B: "C₂H₆ (ethane) is an alkane with only single bonds.", C: "C₃H₈ (propane) is an alkane with only single bonds." },
      },
      {
        t: "organic-chemistry",
        stem: "What is the IUPAC name of CH₃CH₂COOH?",
        o: ["propanoic acid", "ethanoic acid", "propan-1-ol", "propanal"], ans: 0, d: 2,
        e: "The molecule has three carbon atoms in its chain (prop-), including the carbon of the –COOH group, and the –COOH group makes it an alkanoic acid (-oic acid). So it is propanoic acid.",
        why: { B: "Ethanoic acid, CH₃COOH, has only two carbon atoms.", C: "Propan-1-ol has an –OH group, not a –COOH group.", D: "Propanal has an aldehyde –CHO group." },
      },
      num({
        t: "organic-chemistry",
        stem: "How many structural isomers have the molecular formula C₄H₁₀?",
        o: ["2", "3", "4", "1"], ans: 0, d: 2,
        e: "Four carbon atoms can be joined in only two ways: a straight chain, CH₃CH₂CH₂CH₃ (butane), or a three-carbon chain with a methyl branch on the middle carbon, CH₃CH(CH₃)CH₃ (2-methylpropane). Any other drawing is one of these two.",
        why: { B: "1-methylpropane is just butane drawn bent, so it is not a third isomer.", C: "4 counts the carbon atoms, not the isomers." },
      }, ["butane", "2-methylpropane"].length),
      {
        t: "organic-chemistry",
        stem: "Which reagent can be used to distinguish ethanoic acid from ethanol in the laboratory?",
        o: ["aqueous sodium hydrogentrioxocarbonate(IV)", "metallic sodium", "bromine water", "distilled water"], ans: 0, d: 2,
        e: "Ethanoic acid is an acid, so it reacts with NaHCO₃ to give effervescence of carbon(IV) oxide: CH₃COOH + NaHCO₃ → CH₃COONa + H₂O + CO₂. Ethanol is neutral and gives no gas. A test that gives different results is the one that distinguishes them.",
        why: { B: "Sodium metal reacts with both, giving hydrogen gas each time.", C: "Neither compound has a C=C bond, so neither decolourises bromine water.", D: "Both mix completely with water, so water shows no difference." },
      },
      num({
        t: "organic-chemistry",
        stem: "Ethene burns completely in oxygen: C₂H₄ + 3O₂ → 2CO₂ + 2H₂O. What mass of carbon(IV) oxide is produced when 7.0 g of ethene is burnt? [H = 1, C = 12, O = 16]",
        o: ["22 g", "11 g", "44 g", "7.0 g"], ans: 0, d: 3,
        e: "Molar mass of C₂H₄ = 24 + 4 = 28 g mol⁻¹, so moles = 7.0 ÷ 28 = 0.25 mol. Each mole of ethene gives 2 mol CO₂, so 0.50 mol CO₂ is formed. Molar mass of CO₂ = 44 g mol⁻¹, so mass = 0.50 × 44 = 22 g.",
        why: { B: "11 g uses a 1 : 1 ratio and ignores the 2 in front of CO₂.", C: "44 g is the mass of one mole of CO₂, not of 0.50 mol." },
      }, (7.0 / (2 * 12 + 4 * 1)) * 2 * (12 + 2 * 16)),
      (() => {
        // CxHy + (x + y/4) O₂ → x CO₂ + y/2 H₂O, volumes per 10 cm³ of hydrocarbon
        const x = 20 / 10, y = 4 * (30 / 10 - x);
        return is({
          t: "organic-chemistry",
          stem: "10 cm³ of a gaseous hydrocarbon burns completely in exactly 30 cm³ of oxygen, producing 20 cm³ of carbon(IV) oxide. All volumes are measured at the same temperature and pressure. What is the formula of the hydrocarbon?",
          o: [`C${sub(x)}H${sub(y)}`, "C₂H₆", "C₂H₂", "C₃H₆"], ans: 0, d: 3,
          e: "For CₓHᵧ + (x + y/4)O₂ → xCO₂ + (y/2)H₂O, volumes are in the mole ratio. 10 cm³ of hydrocarbon gives 20 cm³ CO₂, so x = 2. It uses 30 cm³ O₂, so x + y/4 = 3, giving y/4 = 1 and y = 4. The hydrocarbon is C₂H₄ (ethene).",
          why: { B: "C₂H₆ would need 3.5 volumes of oxygen per volume (35 cm³), not 30 cm³.", C: "C₂H₂ would need only 2.5 volumes of oxygen (25 cm³).", D: "C₃H₆ would give 30 cm³ of CO₂, not 20 cm³." },
        }, "C₂H₄");
      })(),
    ],
    free: [0, 3, 6, 9, 12, 15, 17, 18, 21, 24, 25, 28],
  },

  neco: {
    list: [
      // atomic-structure-and-bonding
      {
        t: "atomic-structure-and-bonding",
        stem: "The elements in Group VII of the Periodic Table, such as chlorine and bromine, are known as the",
        o: ["halogens", "alkali metals", "noble gases", "alkaline earth metals"], ans: 0, d: 1,
        e: "Group VII elements (fluorine, chlorine, bromine, iodine) have seven outer electrons and are called the halogens, meaning 'salt formers', because they combine with metals to form salts such as NaCl.",
        why: { B: "The alkali metals are Group I (e.g. sodium, potassium).", C: "The noble gases are Group 0 (or VIII), e.g. neon and argon.", D: "The alkaline earth metals are Group II (e.g. magnesium, calcium)." },
      },
      {
        t: "atomic-structure-and-bonding",
        stem: "The atomic number of an element is the number of",
        o: ["protons in the nucleus of its atom", "neutrons in the nucleus of its atom", "protons and neutrons in its atom", "electrons in the outermost shell of its atom"], ans: 0, d: 1,
        e: "The atomic (proton) number, Z, is the number of protons in the nucleus. It identifies the element; in a neutral atom it also equals the number of electrons.",
        why: { C: "Protons plus neutrons gives the mass number, A.", D: "The outermost electrons are the valence electrons, which relate to the group number." },
      },
      {
        t: "atomic-structure-and-bonding",
        stem: "Which of the following compounds contains both ionic and covalent bonds?",
        o: ["NaOH", "MgCl₂", "HCl", "CH₄"], ans: 0, d: 2,
        e: "Sodium hydroxide is made of Na⁺ ions and OH⁻ ions held by ionic bonds, but within each OH⁻ ion the oxygen and hydrogen atoms share a pair of electrons in a covalent bond. So NaOH has both kinds of bond.",
        why: { B: "MgCl₂ contains only Mg²⁺ and Cl⁻ ions held by ionic bonds.", C: "HCl is a covalent molecule with no ions in the pure compound.", D: "CH₄ has only covalent C–H bonds." },
      },
      {
        t: "atomic-structure-and-bonding",
        stem: "Solid metals such as copper conduct electricity because they contain",
        o: ["delocalised electrons that can move through the structure", "positive ions that can move through the structure", "negative ions held in fixed positions", "molecules with shared pairs of electrons"], ans: 0, d: 2,
        e: "In metallic bonding, the outer electrons of the metal atoms are delocalised: they form a 'sea' of electrons around a lattice of positive ions. These mobile electrons carry the current when a voltage is applied.",
        why: { B: "The positive ions in a solid metal stay fixed in the lattice; they only vibrate.", C: "Metals do not contain negative ions; the lattice is made of positive ions." },
      },
      {
        t: "atomic-structure-and-bonding",
        stem: "Across a period of the Periodic Table from left to right, the atomic radius generally decreases. This is because",
        o: ["the nuclear charge increases while electrons are added to the same shell", "the number of electron shells decreases", "the atoms lose electrons more easily", "the number of neutrons decreases"], ans: 0, d: 2,
        e: "Along a period, each element has one more proton than the one before, so the nuclear charge increases. The added electrons go into the same outer shell and shield one another poorly, so the stronger nucleus pulls the outer shell closer and the atoms get smaller.",
        why: { B: "All elements in a period have the same number of occupied shells.", C: "Atoms on the right of a period actually lose electrons less easily." },
      },
      num({
        t: "atomic-structure-and-bonding",
        stem: "What is the total number of electrons in the tetraoxosulphate(VI) ion, SO₄²⁻? [Atomic numbers: O = 8, S = 16]",
        o: ["50", "48", "46", "52"], ans: 0, d: 3,
        e: "Electrons in the neutral atoms = 16 (S) + 4 × 8 (O) = 48. The 2− charge means the ion has gained 2 extra electrons, so the total is 48 + 2 = 50.",
        why: { B: "48 counts only the electrons of the neutral atoms and ignores the 2− charge.", C: "46 subtracts the 2 electrons, as if the ion were positive." },
      }, 16 + 4 * 8 + 2),

      // stoichiometry
      num({
        t: "stoichiometry",
        stem: "How many moles are present in 9.8 g of tetraoxosulphate(VI) acid, H₂SO₄? [H = 1, O = 16, S = 32]",
        o: ["0.10 mol", "1.0 mol", "0.98 mol", "10 mol"], ans: 0, d: 1,
        e: "Molar mass of H₂SO₄ = 2(1) + 32 + 4(16) = 98 g mol⁻¹. Moles = mass ÷ molar mass = 9.8 ÷ 98 = 0.10 mol.",
        why: { B: "1.0 mol would be 98 g of the acid.", D: "10 mol comes from dividing 98 by 9.8 instead of 9.8 by 98." },
      }, 9.8 / (2 * 1 + 32 + 4 * 16)),
      num({
        t: "stoichiometry",
        stem: "How many moles of sodium ions, Na⁺, are present in 0.5 mol of sodium tetraoxosulphate(VI), Na₂SO₄?",
        o: ["1.0 mol", "0.5 mol", "0.25 mol", "2.0 mol"], ans: 0, d: 1,
        e: "Each formula unit of Na₂SO₄ contains 2 Na⁺ ions. So 0.5 mol of Na₂SO₄ contains 2 × 0.5 = 1.0 mol of Na⁺ ions.",
        why: { B: "0.5 mol is the amount of the salt (and of SO₄²⁻ ions), not of Na⁺.", C: "0.25 mol divides by 2 instead of multiplying." },
      }, 2 * 0.5),
      num({
        t: "stoichiometry",
        stem: "Ammonium trioxonitrate(V), NH₄NO₃, is used as a fertiliser. What is the percentage by mass of nitrogen in it? [H = 1, N = 14, O = 16]",
        o: ["35%", "17.5%", "28%", "60%"], ans: 0, d: 2,
        e: "Molar mass of NH₄NO₃ = 14 + 4(1) + 14 + 3(16) = 80 g mol⁻¹. It contains two nitrogen atoms, mass 2 × 14 = 28 g. Percentage of N = 28 ÷ 80 × 100 = 35%.",
        why: { B: "17.5% counts only one of the two nitrogen atoms.", C: "28 is the mass of nitrogen in grams per mole, not a percentage.", D: "60% is the percentage of oxygen (48 ÷ 80 × 100)." },
      }, (2 * 14) / (14 + 4 + 14 + 48) * 100),
      num({
        t: "stoichiometry",
        stem: "What is the mass of 4.48 dm³ of ammonia gas, NH₃, at s.t.p.? [H = 1, N = 14; molar volume = 22.4 dm³ at s.t.p.]",
        o: ["3.4 g", "1.7 g", "17 g", "6.8 g"], ans: 0, d: 2,
        e: "Moles of NH₃ = 4.48 ÷ 22.4 = 0.20 mol. Molar mass of NH₃ = 14 + 3 = 17 g mol⁻¹. Mass = 0.20 × 17 = 3.4 g.",
        why: { B: "1.7 g is the mass of 0.10 mol (2.24 dm³).", C: "17 g is the mass of one mole, which would occupy 22.4 dm³." },
      }, (4.48 / 22.4) * (14 + 3)),
      (() => {
        const fe = 70 / 56, o = 30 / 16, r = o / fe; // 1 : 1.5 → 2 : 3
        const k = [1, 2, 3, 4].find((m) => close(Math.round(r * m), r * m));
        return is({
          t: "stoichiometry",
          stem: "An oxide of iron contains 70% iron by mass. What is its empirical formula? [O = 16, Fe = 56]",
          o: [`Fe${sub(k)}O${sub(Math.round(r * k))}`, "FeO", "Fe₃O₄", "FeO₂"], ans: 0, d: 3,
          e: "In 100 g there are 70 g Fe and 30 g O. Moles: Fe = 70 ÷ 56 = 1.25; O = 30 ÷ 16 = 1.875. Divide by the smaller: Fe = 1, O = 1.5. Multiply by 2 to get whole numbers: Fe : O = 2 : 3, so the formula is Fe₂O₃.",
          why: { B: "FeO contains about 78% iron (56 ÷ 72).", C: "Fe₃O₄ contains about 72% iron (168 ÷ 232).", D: "FeO₂ would contain about 64% iron, and it is not a common oxide of iron." },
        }, "Fe₂O₃");
      })(),
      num({
        t: "stoichiometry",
        stem: "Potassium trioxochlorate(V) decomposes on heating: 2KClO₃ → 2KCl + 3O₂. What mass of KClO₃ must be heated to produce 3.36 dm³ of oxygen at s.t.p.? [O = 16, Cl = 35.5, K = 39; molar volume = 22.4 dm³ at s.t.p.]",
        o: ["12.25 g", "18.38 g", "6.13 g", "24.50 g"], ans: 0, d: 3,
        e: "Moles of O₂ = 3.36 ÷ 22.4 = 0.15 mol. From the equation, 3 mol O₂ come from 2 mol KClO₃, so moles of KClO₃ = 0.15 × 2/3 = 0.10 mol. Molar mass of KClO₃ = 39 + 35.5 + 48 = 122.5 g mol⁻¹. Mass = 0.10 × 122.5 = 12.25 g.",
        why: { B: "18.38 g treats the mole ratio as 1 : 1 (0.15 mol of KClO₃).", C: "6.13 g divides the moles of O₂ by 3 but forgets to multiply by 2 (0.05 mol of KClO₃).", D: "24.50 g is the mass for 0.20 mol, double the amount needed." },
      }, (3.36 / 22.4) * (2 / 3) * (39 + 35.5 + 3 * 16)),

      // acids-bases-and-salts
      {
        t: "acids-bases-and-salts",
        stem: "An aqueous solution has a pH of 2. The solution is",
        o: ["strongly acidic", "weakly acidic", "neutral", "strongly alkaline"], ans: 0, d: 1,
        e: "On the pH scale, values below 7 are acidic, 7 is neutral and above 7 is alkaline. The lower the pH, the higher the hydrogen ion concentration, so pH 2 is strongly acidic.",
        why: { B: "Weakly acidic solutions have pH values just below 7, such as 5 or 6.", D: "Strongly alkaline solutions have pH values near 14." },
      },
      {
        t: "acids-bases-and-salts",
        stem: "Which gas is given off when dilute hydrochloric acid is added to zinc granules?",
        o: ["hydrogen", "chlorine", "oxygen", "carbon(IV) oxide"], ans: 0, d: 1,
        e: "A metal above hydrogen in the activity series displaces hydrogen from a dilute acid: Zn + 2HCl → ZnCl₂ + H₂. The gas burns with a 'pop' when a lighted splint is brought near.",
        why: { B: "Chlorine stays in the salt, zinc chloride, as Cl⁻ ions.", D: "Carbon(IV) oxide is given off when an acid reacts with a trioxocarbonate(IV), not with a metal." },
      },
      {
        t: "acids-bases-and-salts",
        stem: "Hydrochloric acid is described as a strong acid because it",
        o: ["ionises completely in water", "has a high concentration", "is very corrosive", "contains many hydrogen atoms in each molecule"], ans: 0, d: 2,
        e: "The strength of an acid depends on how far it ionises in water. HCl ionises completely: HCl → H⁺ + Cl⁻. A weak acid such as ethanoic acid ionises only partly. Strength is different from concentration, which is the amount of acid per dm³.",
        why: { B: "Concentration describes how much acid is dissolved; a dilute strong acid is still strong.", D: "HCl has only one hydrogen atom per molecule." },
      },
      {
        t: "acids-bases-and-salts",
        stem: "Which of the following is the most suitable drying agent for ammonia gas?",
        o: ["calcium oxide (quicklime)", "concentrated tetraoxosulphate(VI) acid", "anhydrous calcium chloride", "phosphorus(V) oxide"], ans: 0, d: 2,
        e: "Ammonia is a basic gas, so it must be dried with a basic drying agent that does not react with it. Calcium oxide is basic and is used for this. Acidic drying agents react with ammonia, and calcium chloride forms a compound with it.",
        why: { B: "Concentrated H₂SO₄ is an acid and reacts with ammonia to form ammonium tetraoxosulphate(VI).", C: "Anhydrous calcium chloride absorbs ammonia to form a complex (CaCl₂·8NH₃).", D: "Phosphorus(V) oxide is an acidic oxide and reacts with ammonia." },
      },
      num({
        t: "acids-bases-and-salts",
        stem: "How many moles of hydrogen ions are present in 50 cm³ of 0.20 mol dm⁻³ tetraoxosulphate(VI) acid, H₂SO₄? (Assume the acid is fully ionised.)",
        o: ["0.020 mol", "0.010 mol", "0.20 mol", "0.040 mol"], ans: 0, d: 2,
        e: "Moles of H₂SO₄ = 0.20 × 50/1000 = 0.010 mol. Each H₂SO₄ gives 2 H⁺ ions (H₂SO₄ → 2H⁺ + SO₄²⁻), so moles of H⁺ = 2 × 0.010 = 0.020 mol.",
        why: { B: "0.010 mol is the amount of acid; it forgets that the acid is dibasic.", C: "0.20 is the concentration, not the number of moles in 50 cm³." },
      }, 2 * 0.2 * (50 / 1000)),
      num({
        t: "acids-bases-and-salts",
        stem: "55.0 cm³ of 0.10 mol dm⁻³ hydrochloric acid is mixed with 45.0 cm³ of 0.10 mol dm⁻³ sodium hydroxide solution. What is the pH of the resulting solution? (Assume complete ionisation.)",
        o: ["2", "1", "7", "3"], ans: 0, d: 3,
        e: "Moles of HCl = 0.10 × 0.0550 = 0.0055 mol; moles of NaOH = 0.10 × 0.0450 = 0.0045 mol. They react 1 : 1, leaving 0.0055 − 0.0045 = 0.0010 mol of H⁺ in a total volume of 100 cm³ (0.100 dm³). [H⁺] = 0.0010 ÷ 0.100 = 0.010 mol dm⁻³, so pH = −log₁₀(0.010) = 2.",
        why: { B: "pH 1 is the pH of the original 0.10 mol dm⁻³ acid, before any was neutralised.", C: "pH 7 would need exactly equal moles of acid and alkali; here the acid is in excess." },
      }, -Math.log10((0.1 * 0.055 - 0.1 * 0.045) / (0.055 + 0.045))),

      // redox-and-electrolysis
      {
        t: "redox-and-electrolysis",
        stem: "A goldsmith in Kano wants to electroplate a brass spoon with silver. The spoon should be made the",
        o: ["cathode", "anode", "electrolyte", "salt bridge"], ans: 0, d: 1,
        e: "In electroplating, the object to be coated is made the cathode, where metal ions gain electrons and are deposited: Ag⁺ + e⁻ → Ag. A piece of silver is used as the anode and a silver salt solution as the electrolyte.",
        why: { B: "The anode is the silver metal, which dissolves to replace the Ag⁺ ions.", C: "The electrolyte is the solution of silver ions, not the spoon." },
      },
      num({
        t: "redox-and-electrolysis",
        stem: "Household bleach contains sodium oxochlorate(I), NaOCl. What is the oxidation number of chlorine in this compound?",
        o: ["+1", "−1", "+3", "+5"], ans: 0, d: 1,
        e: "Sodium is +1 and oxygen is −2, and the compound is neutral. So (+1) + (−2) + Cl = 0, giving Cl = +1. This matches the (I) in oxochlorate(I).",
        why: { B: "−1 is chlorine's oxidation number in chlorides such as NaCl.", D: "+5 is chlorine's oxidation number in trioxochlorate(V), such as KClO₃." },
      }, 0 - 1 - -2),
      (() => {
        // Cathode: 4H⁺ + 4e⁻ → 2H₂; anode: 4OH⁻ → 2H₂O + O₂ + 4e⁻ (same 4 electrons)
        const h2 = 4 / 2, o2 = 4 / 4;
        return is({
          t: "redox-and-electrolysis",
          stem: "Water acidified with dilute tetraoxosulphate(VI) acid is electrolysed using platinum electrodes. What is the ratio of the volume of hydrogen to the volume of oxygen collected, at the same temperature and pressure?",
          o: [`${h2 / o2} : 1`, "1 : 2", "1 : 1", "4 : 1"], ans: 0, d: 2,
          e: "Cathode: 4H⁺ + 4e⁻ → 2H₂. Anode: 4OH⁻ → 2H₂O + O₂ + 4e⁻. The same 4 mol of electrons produce 2 mol H₂ and 1 mol O₂, so the volume ratio of hydrogen to oxygen is 2 : 1, matching the formula H₂O.",
          why: { B: "1 : 2 swaps the gases; more hydrogen than oxygen is produced.", C: "1 : 1 ignores that each O₂ needs four electrons but each H₂ needs only two." },
        }, "2 : 1");
      })(),
      {
        t: "redox-and-electrolysis",
        stem: "In the reaction 2FeCl₂ + Cl₂ → 2FeCl₃, what happens to iron?",
        o: ["It is oxidised from +2 to +3.", "It is reduced from +3 to +2.", "It is oxidised from 0 to +3.", "Its oxidation number does not change."], ans: 0, d: 2,
        e: "In FeCl₂, each Cl is −1, so Fe is +2. In FeCl₃, Fe is +3. An increase in oxidation number (loss of an electron) is oxidation, so iron is oxidised from +2 to +3. Chlorine is reduced from 0 to −1.",
        why: { B: "The change is from FeCl₂ to FeCl₃, i.e. +2 to +3, not the reverse.", C: "Iron starts as Fe²⁺ in FeCl₂, not as the free element (0)." },
      },
      {
        t: "redox-and-electrolysis",
        stem: "Which of the following metals will NOT liberate hydrogen from dilute hydrochloric acid?",
        o: ["copper", "zinc", "magnesium", "iron"], ans: 0, d: 2,
        e: "Only metals above hydrogen in the electrochemical (activity) series can displace hydrogen from dilute acids. Copper is below hydrogen, so it does not react with dilute HCl. Magnesium, zinc and iron are above hydrogen and give hydrogen gas.",
        why: { B: "Zinc is above hydrogen and reacts readily with dilute HCl.", C: "Magnesium is well above hydrogen and reacts vigorously." },
      },
      num({
        t: "redox-and-electrolysis",
        stem: "How long will it take a current of 2.0 A to deposit 0.54 g of aluminium during the electrolysis of molten aluminium oxide? [Al = 27; F = 96 500 C mol⁻¹]",
        o: ["2895 s", "965 s", "5790 s", "8685 s"], ans: 0, d: 3,
        e: "Al³⁺ + 3e⁻ → Al. Moles of Al = 0.54 ÷ 27 = 0.020 mol, needing 3 × 0.020 = 0.060 mol of electrons. Charge Q = 0.060 × 96 500 = 5790 C. Time t = Q ÷ I = 5790 ÷ 2.0 = 2895 s.",
        why: { B: "965 s treats aluminium as Al⁺, needing only one electron per atom.", C: "5790 is the charge in coulombs; it still has to be divided by the current." },
      }, ((0.54 / 27) * 3 * 96500) / 2.0),

      // organic-chemistry
      {
        t: "organic-chemistry",
        stem: "Which of the following compounds is an alkanoic acid?",
        o: ["CH₃COOH", "CH₃CH₂OH", "CH₃CHO", "CH₃COOCH₃"], ans: 0, d: 1,
        e: "Alkanoic acids contain the carboxyl group, –COOH. CH₃COOH (ethanoic acid, the acid in vinegar) has this group.",
        why: { B: "CH₃CH₂OH (ethanol) has an –OH group; it is an alkanol.", C: "CH₃CHO (ethanal) has a –CHO group; it is an alkanal.", D: "CH₃COOCH₃ (methyl ethanoate) is an ester (–COO–)." },
      },
      {
        t: "organic-chemistry",
        stem: "In petroleum refining, heavy fractions are cracked. The main purpose of cracking is to",
        o: ["break large hydrocarbon molecules into smaller, more useful ones such as petrol and alkenes", "separate crude oil into fractions by their boiling points", "remove sulphur compounds from crude oil", "join small alkene molecules into long polymer chains"], ans: 0, d: 2,
        e: "Cracking uses heat (and often a catalyst) to break long-chain alkanes, which are in low demand, into shorter alkanes for petrol and alkenes such as ethene, which are used to make plastics.",
        why: { B: "Separating by boiling point is fractional distillation, not cracking.", D: "Joining small alkene molecules is polymerisation, the reverse idea." },
      },
      {
        t: "organic-chemistry",
        stem: "What is the IUPAC name of CH₂=CHCH₂CH₃?",
        o: ["but-1-ene", "but-2-ene", "butane", "prop-1-ene"], ans: 0, d: 2,
        e: "The chain has four carbon atoms (but-) and one C=C double bond (-ene). Numbering from the end nearest the double bond, it starts at carbon 1, so the name is but-1-ene.",
        why: { B: "But-2-ene is CH₃CH=CHCH₃, with the double bond between carbons 2 and 3.", C: "Butane has no double bond.", D: "Prop-1-ene has only three carbon atoms." },
      },
      {
        t: "organic-chemistry",
        stem: "Which of the following polymers is made by condensation polymerisation?",
        o: ["nylon", "poly(ethene)", "poly(chloroethene)", "poly(phenylethene)"], ans: 0, d: 2,
        e: "In condensation polymerisation, monomers join and a small molecule such as water or HCl is given off at each link. Nylon is formed this way from a diamine and a dicarboxylic acid (or its acid chloride). The other three are addition polymers made from alkene monomers with nothing given off.",
        why: { B: "Poly(ethene) is an addition polymer of ethene.", C: "Poly(chloroethene), PVC, is an addition polymer of chloroethene.", D: "Poly(phenylethene), polystyrene, is an addition polymer." },
      },
      num({
        t: "organic-chemistry",
        stem: "Ethyne is prepared by adding water to calcium dicarbide: CaC₂ + 2H₂O → C₂H₂ + Ca(OH)₂. What volume of ethyne at s.t.p. is obtained from 6.4 g of CaC₂? [C = 12, Ca = 40; molar volume = 22.4 dm³ at s.t.p.]",
        o: ["2.24 dm³", "4.48 dm³", "1.12 dm³", "22.4 dm³"], ans: 0, d: 3,
        e: "Molar mass of CaC₂ = 40 + 2(12) = 64 g mol⁻¹, so moles = 6.4 ÷ 64 = 0.10 mol. One mole of CaC₂ gives one mole of C₂H₂, so 0.10 mol of ethyne is formed, occupying 0.10 × 22.4 = 2.24 dm³.",
        why: { B: "4.48 dm³ uses the 2 in front of H₂O as if it applied to ethyne.", D: "22.4 dm³ is the volume of one whole mole of gas." },
      }, (6.4 / (40 + 2 * 12)) * 22.4),
      {
        t: "organic-chemistry",
        stem: "Which of the following is an isomer of ethanol, CH₃CH₂OH?",
        o: ["CH₃OCH₃", "CH₃CHO", "CH₃OH", "CH₃COOH"], ans: 0, d: 3,
        e: "Isomers have the same molecular formula but different structures. Ethanol is C₂H₆O. Methoxymethane, CH₃OCH₃, is also C₂H₆O, but its oxygen links the two carbon atoms (an ether), so it is a structural isomer of ethanol.",
        why: { B: "CH₃CHO (ethanal) is C₂H₄O, two hydrogen atoms fewer than ethanol.", C: "CH₃OH (methanol) is CH₄O; it is a homologue of ethanol, not an isomer.", D: "CH₃COOH (ethanoic acid) is C₂H₄O₂." },
      },
    ],
    free: [0, 3, 6, 9, 12, 15, 17, 18, 21, 24, 25, 28],
  },
};
