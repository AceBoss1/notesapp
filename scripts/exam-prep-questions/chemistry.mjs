// Chemistry starter questions for Naija Exam Prep (JAMB, WAEC, NECO). Original questions; options are written with the correct
// one first and shuffled at build time. Every calculation is worked out in `check` and compared with option A.
const close = (a, b) => Math.abs(a - b) < 1e-9;
const is = (q, value) => ({ ...q, check: q.o[0] === value });
// Compares the leading number of option A (spaces removed, so "289 500 C" reads as 289500) with the worked value.
const num = (q, value) => ({ ...q, check: close(parseFloat(q.o[0].replace(/\s/g, "")), value) });
const SUP = { 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹" };
const SUB = { 0: "₀", 1: "₁", 2: "₂", 3: "₃", 4: "₄", 5: "₅", 6: "₆", 7: "₇", 8: "₈", 9: "₉" };
const sup = (n) => String(n).replace(/\d/g, (d) => SUP[d]);
const sub = (n) => (n === 1 ? "" : String(n).replace(/\d/g, (d) => SUB[d]));
// Electronic configuration by the aufbau order (good for Z ≤ 36).
const config = (z) => {
  const order = [["1s", 2], ["2s", 2], ["2p", 6], ["3s", 2], ["3p", 6], ["4s", 2], ["3d", 10], ["4p", 6]];
  const parts = [];
  for (const [name, cap] of order) { if (z <= 0) break; const n = Math.min(cap, z); parts.push(`${name}${sup(n)}`); z -= n; }
  return parts.join(" ");
};
// Shells 2, 8, 8 ... for the first 20 elements.
const shells = (z) => { const s = []; for (const cap of [2, 8, 8, 2]) { if (z <= 0) break; s.push(Math.min(cap, z)); z -= Math.min(cap, z); } return s; };
const ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII"];

export default {
  jamb: {
    list: [
      // 0
      is({ t: "atomic-structure-and-bonding", stem: "An atom of element X has 17 protons and a mass number of 37. How many neutrons does it have?", o: ["20", "17", "37", "54"], ans: 0, d: 1, e: "Neutrons = mass number − proton number = 37 − 17 = 20.", why: { C: "37 is the mass number (protons + neutrons), not the neutrons alone.", D: "54 adds the two numbers; subtract instead." } }, `${37 - 17}`),
      // 1
      is({ t: "atomic-structure-and-bonding", stem: "Which of the following is the electronic configuration of potassium, ¹⁹K?", o: [config(19), "1s² 2s² 2p⁶ 3s² 3p⁶ 3d¹", "1s² 2s² 2p⁶ 3s² 3p⁷", "1s² 2s² 2p⁶ 3s² 3p⁵ 4s²"], ans: 0, d: 2, e: "Fill sub-levels in order of increasing energy: 1s, 2s, 2p, 3s, 3p, then 4s before 3d. After 3p⁶ (18 electrons) the 19th electron goes into 4s, giving 1s² 2s² 2p⁶ 3s² 3p⁶ 4s¹.", why: { B: "The 4s sub-level is lower in energy than 3d, so it fills first.", C: "A p sub-level holds at most 6 electrons." } }, config(19)),
      // 2
      { t: "atomic-structure-and-bonding", stem: "Which of the following species contains a dative (coordinate) covalent bond?", o: ["NH₄⁺", "CH₄", "H₂O", "NaCl"], ans: 0, d: 2, e: "In NH₄⁺, the nitrogen of NH₃ donates its lone pair to an H⁺ ion, which brings no electrons of its own. A bond in which both shared electrons come from one atom is a dative bond.", why: { C: "Water has lone pairs, but in H₂O itself each O–H bond is an ordinary covalent bond; a dative bond forms only when it accepts H⁺ to give H₃O⁺.", D: "NaCl is held by ionic (electrovalent) bonds, not shared electrons." } },
      // 3
      num({ t: "atomic-structure-and-bonding", stem: "Chlorine consists of 75% ³⁵Cl and 25% ³⁷Cl. What is the relative atomic mass of chlorine?", o: ["35.5", "36.0", "35.0", "36.5"], ans: 0, d: 2, e: "Relative atomic mass = (75 × 35 + 25 × 37) ÷ 100 = (2625 + 925) ÷ 100 = 35.5.", why: { B: "36.0 is a plain average of 35 and 37; weight each isotope by its abundance." } }, (75 * 35 + 25 * 37) / 100),
      // 4
      num({ t: "stoichiometry", stem: "How many moles are there in 4.4 g of carbon(IV) oxide, CO₂? [C = 12, O = 16]", o: ["0.1 mol", "1.0 mol", "0.2 mol", "10 mol"], ans: 0, d: 1, e: "Molar mass of CO₂ = 12 + 2 × 16 = 44 g mol⁻¹. Moles = mass ÷ molar mass = 4.4 ÷ 44 = 0.1 mol.", why: { D: "10 mol comes from 44 ÷ 4.4; divide the mass by the molar mass, not the other way round." } }, 4.4 / (12 + 2 * 16)),
      // 5
      num({ t: "stoichiometry", stem: "What volume does 3.2 g of oxygen gas, O₂, occupy at s.t.p.? [O = 16; molar volume = 22.4 dm³ at s.t.p.]", o: ["2.24 dm³", "4.48 dm³", "22.4 dm³", "1.12 dm³"], ans: 0, d: 2, e: "Molar mass of O₂ = 32 g mol⁻¹, so 3.2 g is 3.2 ÷ 32 = 0.1 mol. Volume = 0.1 × 22.4 = 2.24 dm³.", why: { B: "4.48 dm³ uses 16 g mol⁻¹; oxygen gas is diatomic, O₂ = 32." } }, (3.2 / 32) * 22.4),
      // 6
      (() => {
        const r = [40.0 / 12, 6.7 / 1, 53.3 / 16];
        const m = Math.min(...r);
        const [c, h, o] = r.map((x) => Math.round(x / m));
        return is({ t: "stoichiometry", stem: "A compound contains 40.0% carbon, 6.7% hydrogen and 53.3% oxygen by mass. What is its empirical formula? [H = 1, C = 12, O = 16]", o: ["CH₂O", "CHO", "C₂H₆O", "CH₂O₂"], ans: 0, d: 2, e: "Divide each percentage by the relative atomic mass: C 40.0 ÷ 12 = 3.33, H 6.7 ÷ 1 = 6.7, O 53.3 ÷ 16 = 3.33. Divide by the smallest (3.33) to get C : H : O = 1 : 2 : 1, so the empirical formula is CH₂O.", why: { B: "CHO ignores that there are twice as many moles of H as of C.", D: "Divide the percentages by the atomic masses before comparing them." } }, `C${sub(c)}H${sub(h)}O${sub(o)}`);
      })(),
      // 7
      num({ t: "stoichiometry", stem: "Hydrogen burns in oxygen: 2H₂ + O₂ → 2H₂O. If 4 g of hydrogen is mixed with 16 g of oxygen and ignited, what mass of water is formed? [H = 1, O = 16]", o: ["18 g", "36 g", "20 g", "9 g"], ans: 0, d: 3, e: "Moles of H₂ = 4 ÷ 2 = 2 mol; moles of O₂ = 16 ÷ 32 = 0.5 mol. 2 mol H₂ would need 1 mol O₂, so oxygen is the limiting reagent. 0.5 mol O₂ gives 2 × 0.5 = 1 mol H₂O = 18 g.", why: { B: "36 g assumes all the hydrogen reacts; there is not enough oxygen for that.", C: "Mass is conserved only for what reacts; 2 g of hydrogen is left over, so you cannot just add 4 g + 16 g." } }, Math.min(4 / 2, 2 * (16 / 32)) * 18),
      // 8
      num({ t: "acids-bases-and-salts", stem: "What is the pH of a 0.001 mol dm⁻³ solution of hydrochloric acid? (Assume the acid is fully ionised.)", o: ["3", "1", "11", "0.001"], ans: 0, d: 2, e: "HCl is a strong acid, so [H⁺] = 0.001 = 1 × 10⁻³ mol dm⁻³. pH = −log[H⁺] = −log(10⁻³) = 3.", why: { C: "11 would be the pH of 0.001 mol dm⁻³ NaOH, an alkali." } }, -Math.log10(0.001)),
      // 9
      num({ t: "acids-bases-and-salts", stem: "What volume of 0.1 mol dm⁻³ NaOH is needed to neutralise 25 cm³ of 0.2 mol dm⁻³ H₂SO₄? [H₂SO₄ + 2NaOH → Na₂SO₄ + 2H₂O]", o: ["100 cm³", "50 cm³", "25 cm³", "12.5 cm³"], ans: 0, d: 3, e: "Moles of H₂SO₄ = 0.2 × 25 ÷ 1000 = 0.005 mol. From the equation, NaOH needed = 2 × 0.005 = 0.01 mol. Volume = 0.01 ÷ 0.1 = 0.1 dm³ = 100 cm³.", why: { B: "50 cm³ treats the reaction as 1 : 1; the acid is dibasic, so it needs twice as much NaOH." } }, ((2 * (0.2 * 25)) / 1000 / 0.1) * 1000),
      // 10
      { t: "acids-bases-and-salts", stem: "An aqueous solution of which of these salts turns blue litmus paper red?", o: ["NH₄Cl", "NaCl", "Na₂CO₃", "KNO₃"], ans: 0, d: 2, e: "NH₄Cl is the salt of a strong acid (HCl) and a weak base (NH₃). Its solution is acidic because NH₄⁺ ions hydrolyse to release H⁺, so it turns blue litmus red.", why: { C: "Na₂CO₃ comes from a strong base and a weak acid, so its solution is alkaline.", B: "NaCl comes from a strong acid and a strong base, so its solution is neutral." } },
      // 11
      { t: "acids-bases-and-salts", stem: "In the reaction NH₃ + H₂O ⇌ NH₄⁺ + OH⁻, water behaves as", o: ["an acid, because it donates a proton", "a base, because it accepts a proton", "an acid, because it accepts a proton", "a base, because it donates a pair of electrons to NH₄⁺"], ans: 0, d: 2, e: "On the Brønsted–Lowry definition an acid is a proton (H⁺) donor. Water gives an H⁺ to NH₃, forming NH₄⁺ and leaving OH⁻, so here water is the acid.", why: { B: "It is NH₃ that accepts the proton, so NH₃ is the base." } },
      // 12
      num({ t: "redox-and-electrolysis", stem: "What is the oxidation number of manganese in potassium tetraoxomanganate(VII), KMnO₄?", o: ["+7", "+6", "+4", "−7"], ans: 0, d: 1, e: "K is +1 and each O is −2. The compound is neutral, so +1 + Mn + 4(−2) = 0, giving Mn = +7. The (VII) in the name says the same.", why: { D: "Manganese must balance four negative oxygens, so its oxidation number is positive." } }, 0 - 1 - 4 * -2),
      // 13
      num({ t: "redox-and-electrolysis", stem: "A current of 0.5 A is passed through copper(II) tetraoxosulphate(VI) solution for 3860 s. What mass of copper is deposited at the cathode? [Cu = 63.5; F = 96 500 C mol⁻¹]", o: ["0.635 g", "1.27 g", "0.318 g", "6.35 g"], ans: 0, d: 3, e: "Charge Q = I × t = 0.5 × 3860 = 1930 C, which is 1930 ÷ 96 500 = 0.02 mol of electrons. Cu²⁺ + 2e⁻ → Cu, so 0.02 mol of electrons deposits 0.01 mol of Cu = 0.01 × 63.5 = 0.635 g.", why: { B: "1.27 g forgets that each Cu²⁺ ion needs two electrons." } }, ((0.5 * 3860) / 96500 / 2) * 63.5),
      // 14
      { t: "redox-and-electrolysis", stem: "In the reaction Zn(s) + Cu²⁺(aq) → Zn²⁺(aq) + Cu(s), the oxidising agent is", o: ["Cu²⁺", "Zn", "Zn²⁺", "Cu"], ans: 0, d: 1, e: "Cu²⁺ gains two electrons to become Cu, so it is reduced. A species that is reduced takes electrons from another and is therefore the oxidising agent.", why: { B: "Zn loses electrons and is oxidised, so it is the reducing agent." } },
      // 15
      { t: "redox-and-electrolysis", stem: "During the electrolysis of concentrated sodium chloride solution (brine) using inert electrodes, the substance liberated at the cathode is", o: ["hydrogen gas", "chlorine gas", "sodium metal", "oxygen gas"], ans: 0, d: 2, e: "Both Na⁺ and H⁺ (from water) move to the cathode. H⁺ is lower in the electrochemical series than Na⁺, so it is discharged preferentially: 2H⁺ + 2e⁻ → H₂.", why: { C: "Na⁺ is very hard to discharge from water; sodium is obtained only by electrolysing molten NaCl.", B: "Chlorine is given off at the anode, not the cathode." } },
      // 16
      { t: "organic-chemistry", stem: "What is the IUPAC name of CH₃CH(CH₃)CH₂CH₃?", o: ["2-methylbutane", "3-methylbutane", "pentane", "2-methylpropane"], ans: 0, d: 2, e: "The longest carbon chain has four carbons (butane), with a methyl branch. Number from the end nearest the branch, so the methyl group is on carbon 2: 2-methylbutane.", why: { B: "Number the chain from the end that gives the branch the lowest number.", D: "The main chain has four carbons, not three." } },
      // 17
      { t: "organic-chemistry", stem: "The general formula of the alkynes is", o: ["CₙH₂ₙ₋₂", "CₙH₂ₙ", "CₙH₂ₙ₊₂", "CₙH₂ₙ₊₁OH"], ans: 0, d: 1, e: "Alkynes contain one C≡C triple bond, which means four fewer hydrogens than the alkane with the same number of carbons, CₙH₂ₙ₊₂. So alkynes are CₙH₂ₙ₋₂, e.g. ethyne C₂H₂.", why: { B: "CₙH₂ₙ is the formula of the alkenes.", C: "CₙH₂ₙ₊₂ is the formula of the alkanes." } },
      // 18
      { t: "organic-chemistry", stem: "Ethene decolourises bromine water to form 1,2-dibromoethane. This type of reaction is", o: ["addition", "substitution", "esterification", "polymerisation"], ans: 0, d: 2, e: "Bromine adds across the C=C double bond, so two atoms join the molecule and nothing is removed: CH₂=CH₂ + Br₂ → CH₂BrCH₂Br. This is an addition reaction, typical of unsaturated compounds.", why: { B: "In substitution an atom is replaced; here no hydrogen is lost from ethene." } },
      // 19
      num({ t: "organic-chemistry", stem: "Propane burns completely in oxygen: C₃H₈ + 5O₂ → 3CO₂ + 4H₂O. What volume of oxygen at s.t.p. is needed to burn 2.2 g of propane? [H = 1, C = 12; molar volume = 22.4 dm³]", o: ["5.6 dm³", "1.12 dm³", "11.2 dm³", "3.36 dm³"], ans: 0, d: 3, e: "Molar mass of C₃H₈ = 3 × 12 + 8 = 44 g mol⁻¹, so 2.2 g is 0.05 mol. Each mole of propane needs 5 mol of O₂: 5 × 0.05 = 0.25 mol. Volume = 0.25 × 22.4 = 5.6 dm³.", why: { B: "1.12 dm³ is the volume of the propane itself; multiply by 5 for the oxygen.", D: "3.36 dm³ is the volume of CO₂ produced (3 mol per mole of propane)." } }, (2.2 / (3 * 12 + 8)) * 5 * 22.4),
    ],
    free: [0, 1, 4, 5, 8, 12, 16, 17],
  },
  waec: {
    list: [
      // 0
      is({ t: "atomic-structure-and-bonding", stem: "How many electrons are present in a magnesium ion, Mg²⁺? [Mg: atomic number 12]", o: ["10", "12", "14", "2"], ans: 0, d: 1, e: "A neutral Mg atom has 12 electrons. Mg²⁺ has lost 2 electrons, so it has 12 − 2 = 10 electrons.", why: { C: "A positive ion has lost electrons, so subtract 2, don't add." } }, `${12 - 2}`),
      // 1
      num({ t: "atomic-structure-and-bonding", stem: "A radioactive isotope has a half-life of 6 hours. What mass of an 80 g sample remains undecayed after 24 hours?", o: ["5 g", "20 g", "10 g", "2.5 g"], ans: 0, d: 2, e: "24 hours is 24 ÷ 6 = 4 half-lives. The mass halves each time: 80 → 40 → 20 → 10 → 5 g.", why: { B: "20 g divides 80 by 4; the mass is halved four times, not divided by four.", C: "10 g stops after three half-lives." } }, 80 / 2 ** (24 / 6)),
      // 2
      { t: "atomic-structure-and-bonding", stem: "Which of the following pairs are isotopes?", o: ["¹²₆C and ¹⁴₆C", "O₂ and O₃", "⁴⁰₁₈Ar and ⁴⁰₂₀Ca", "diamond and graphite"], ans: 0, d: 1, e: "Isotopes are atoms of the same element (same proton number) with different mass numbers. ¹²C and ¹⁴C both have 6 protons but 6 and 8 neutrons respectively.", why: { B: "O₂ and O₃ are allotropes (different molecules of the same element), not isotopes.", C: "Argon and calcium have the same mass number but different proton numbers, so they are different elements." } },
      // 3
      { t: "atomic-structure-and-bonding", stem: "Element X has the electronic configuration 2, 8, 7 and element Y has 2, 8, 2. What is the formula of the compound formed between them?", o: ["YX₂", "Y₂X", "YX", "Y₂X₇"], ans: 0, d: 2, e: "Y loses its 2 outer electrons to form Y²⁺, and X gains 1 electron to form X⁻. Two X⁻ ions balance one Y²⁺, so the formula is YX₂ (like MgCl₂).", why: { B: "Y₂X reverses the charges; Y forms the positive ion with a charge of 2+." } },
      // 4
      num({ t: "stoichiometry", stem: "Calcium trioxocarbonate(IV) decomposes on heating: CaCO₃ → CaO + CO₂. What mass of calcium oxide is obtained by heating 25 g of CaCO₃ to constant mass? [C = 12, O = 16, Ca = 40]", o: ["14 g", "11 g", "25 g", "56 g"], ans: 0, d: 2, e: "Molar mass of CaCO₃ = 40 + 12 + 48 = 100 g mol⁻¹, so 25 g is 0.25 mol. 1 mol CaCO₃ gives 1 mol CaO (56 g mol⁻¹), so mass of CaO = 0.25 × 56 = 14 g.", why: { B: "11 g is the mass of CO₂ given off, not the CaO left.", D: "56 g is the mass from one whole mole of CaCO₃; you only have a quarter of a mole." } }, (25 / (40 + 12 + 3 * 16)) * (40 + 16)),
      // 5
      num({ t: "stoichiometry", stem: "How many molecules are present in 0.5 mol of water? [Avogadro constant = 6.02 × 10²³ mol⁻¹]", o: ["3.01 × 10²³", "6.02 × 10²³", "1.20 × 10²⁴", "9.03 × 10²³"], ans: 0, d: 1, e: "Number of molecules = moles × Avogadro constant = 0.5 × 6.02 × 10²³ = 3.01 × 10²³.", why: { C: "1.20 × 10²⁴ divides by 0.5 instead of multiplying." } }, 0.5 * 6.02),
      // 6
      num({ t: "stoichiometry", stem: "4.0 g of sodium hydroxide is dissolved in distilled water and made up to 250 cm³ of solution. What is the concentration of the solution? [H = 1, O = 16, Na = 23]", o: ["0.4 mol dm⁻³", "0.1 mol dm⁻³", "1.6 mol dm⁻³", "16 mol dm⁻³"], ans: 0, d: 2, e: "Molar mass of NaOH = 23 + 16 + 1 = 40 g mol⁻¹, so 4.0 g is 0.1 mol. 250 cm³ = 0.25 dm³. Concentration = 0.1 ÷ 0.25 = 0.4 mol dm⁻³.", why: { B: "0.1 mol is the amount present; divide by the volume in dm³ to get concentration.", C: "1.6 multiplies by 0.4 somewhere; concentration = moles ÷ volume (0.1 ÷ 0.25)." } }, 4.0 / (23 + 16 + 1) / (250 / 1000)),
      // 7
      num({ t: "stoichiometry", stem: "What is the percentage by mass of water of crystallisation in copper(II) tetraoxosulphate(VI) pentahydrate, CuSO₄·5H₂O? [H = 1, O = 16, S = 32, Cu = 64]", o: ["36%", "18%", "56%", "7.2%"], ans: 0, d: 3, e: "Molar mass = 64 + 32 + 4 × 16 + 5 × 18 = 250 g mol⁻¹. The water contributes 5 × 18 = 90 g. Percentage = 90 ÷ 250 × 100 = 36%.", why: { D: "7.2% uses only one water molecule (18 ÷ 250); there are five.", C: "56% compares the water with the anhydrous salt (90 ÷ 160); divide by the whole hydrate." } }, ((5 * 18) / (64 + 32 + 4 * 16 + 5 * 18)) * 100),
      // 8
      num({ t: "acids-bases-and-salts", stem: "What is the pH of a 0.01 mol dm⁻³ solution of sodium hydroxide at 25 °C? (Assume complete ionisation; pH + pOH = 14.)", o: ["12", "2", "10", "13"], ans: 0, d: 3, e: "NaOH is a strong alkali, so [OH⁻] = 0.01 = 10⁻² mol dm⁻³ and pOH = 2. pH = 14 − pOH = 14 − 2 = 12.", why: { B: "2 is the pOH; an alkali must have a pH above 7, so subtract from 14." } }, 14 - -Math.log10(0.01)),
      // 9
      { t: "acids-bases-and-salts", stem: "Which of the following is an acid salt?", o: ["NaHSO₄", "Na₂SO₄", "Zn(OH)Cl", "KAl(SO₄)₂·12H₂O"], ans: 0, d: 1, e: "An acid salt still contains replaceable hydrogen from the acid. In NaHSO₄ only one of the two hydrogens of H₂SO₄ has been replaced by sodium.", why: { C: "Zn(OH)Cl contains hydroxide, so it is a basic salt.", D: "Potash alum is a double salt." } },
      // 10
      { t: "acids-bases-and-salts", stem: "Which indicator is most suitable for titrating ethanoic acid against sodium hydroxide solution?", o: ["phenolphthalein", "methyl orange", "litmus", "universal indicator"], ans: 0, d: 2, e: "Ethanoic acid is a weak acid and NaOH is a strong base, so the end-point is slightly alkaline (above pH 7). Phenolphthalein changes colour in the alkaline range (about pH 8–10), so it fits.", why: { B: "Methyl orange changes in the acidic range and suits strong acid–weak base titrations." } },
      // 11
      num({ t: "acids-bases-and-salts", stem: "20.0 cm³ of 0.10 mol dm⁻³ HCl exactly neutralised 25.0 cm³ of a sodium hydroxide solution. What is the concentration of the NaOH? [HCl + NaOH → NaCl + H₂O]", o: ["0.08 mol dm⁻³", "0.125 mol dm⁻³", "0.10 mol dm⁻³", "0.05 mol dm⁻³"], ans: 0, d: 2, e: "The reaction is 1 : 1, so C(acid) × V(acid) = C(base) × V(base). 0.10 × 20.0 = C × 25.0, so C = 2.0 ÷ 25.0 = 0.08 mol dm⁻³.", why: { B: "0.125 swaps the volumes: it is 0.10 × 25 ÷ 20." } }, (0.1 * 20) / 25),
      // 12
      num({ t: "redox-and-electrolysis", stem: "What is the oxidation number of chromium in K₂Cr₂O₇?", o: ["+6", "+7", "+12", "+3"], ans: 0, d: 2, e: "K is +1 and O is −2. For the neutral compound: 2(+1) + 2(Cr) + 7(−2) = 0, so 2Cr = +12 and Cr = +6.", why: { C: "+12 is the total for both chromium atoms; divide by 2.", B: "+7 is manganese in KMnO₄, a different compound." } }, (0 - 2 * 1 - 7 * -2) / 2),
      // 13
      { t: "redox-and-electrolysis", stem: "In the purification of copper, impure copper is made the anode in copper(II) tetraoxosulphate(VI) solution. What happens at the anode?", o: ["Copper atoms lose electrons and dissolve as Cu²⁺ ions", "Cu²⁺ ions gain electrons and copper is deposited", "Oxygen gas is given off", "Hydrogen gas is given off"], ans: 0, d: 2, e: "With a copper anode, the copper itself is oxidised: Cu → Cu²⁺ + 2e⁻, so the anode dissolves. Pure copper is deposited at the cathode while impurities fall as anode sludge.", why: { B: "Deposition of copper happens at the cathode, not the anode.", C: "Oxygen is released only with an inert anode such as platinum or carbon." } },
      // 14
      (() => {
        const q = 3 * 96500;
        const fmt = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
        return is({ t: "redox-and-electrolysis", stem: "What quantity of electricity is needed to deposit 1 mole of aluminium from molten aluminium oxide? [F = 96 500 C mol⁻¹]", o: [`${fmt(q)} C`, "96 500 C", "193 000 C", "32 167 C"], ans: 0, d: 2, e: "Al³⁺ + 3e⁻ → Al, so 1 mol of Al needs 3 mol of electrons. Charge = 3 × 96 500 = 289 500 C.", why: { B: "96 500 C deposits 1 mol only of a singly charged ion; Al³⁺ needs three faradays.", D: "32 167 C divides by 3 instead of multiplying." } }, `${fmt(q)} C`);
      })(),
      // 15
      { t: "redox-and-electrolysis", stem: "Which of the following changes is an oxidation?", o: ["Fe²⁺ → Fe³⁺ + e⁻", "Cl₂ + 2e⁻ → 2Cl⁻", "Cu²⁺ + 2e⁻ → Cu", "Ag⁺ + e⁻ → Ag"], ans: 0, d: 2, e: "Oxidation is loss of electrons (OIL RIG). Fe²⁺ loses an electron and its oxidation number rises from +2 to +3. The other three gain electrons, so they are reductions." },
      // 16
      { t: "organic-chemistry", stem: "Ethanol, C₂H₅OH, belongs to the alkanols. The functional group of this homologous series is", o: ["–OH", "–COOH", "–CHO", "–COO–"], ans: 0, d: 1, e: "Alkanols (alcohols) all contain the hydroxyl group, –OH, attached to a carbon atom.", why: { B: "–COOH is the carboxyl group of alkanoic acids such as ethanoic acid.", D: "–COO– is the ester linkage." } },
      // 17
      { t: "organic-chemistry", stem: "In local soap-making, palm oil is boiled with sodium hydroxide solution. Apart from soap, the other product of this reaction is", o: ["propane-1,2,3-triol (glycerol)", "ethanol", "ethanoic acid", "sodium chloride"], ans: 0, d: 2, e: "Palm oil is a mixture of fats (esters of propane-1,2,3-triol with long-chain fatty acids). Alkaline hydrolysis (saponification) gives the sodium salts of the fatty acids, which is soap, and propane-1,2,3-triol.", why: { D: "Common salt is added afterwards to separate the soap (salting out); it is not a product of the reaction." } },
      // 18
      { t: "organic-chemistry", stem: "Ethanoic acid reacts with ethanol in the presence of a little concentrated H₂SO₄. What is the organic product?", o: ["ethyl ethanoate", "methyl ethanoate", "ethyl methanoate", "ethene"], ans: 0, d: 2, e: "An alkanoic acid and an alkanol form an ester and water: CH₃COOH + C₂H₅OH ⇌ CH₃COOC₂H₅ + H₂O. The alcohol part gives 'ethyl' and the acid part gives 'ethanoate'.", why: { C: "The acid gives the '-oate' part of the name: ethanoic acid gives ethanoate, not methanoate." } },
      // 19
      num({ t: "organic-chemistry", stem: "Glucose is fermented by yeast: C₆H₁₂O₆ → 2C₂H₅OH + 2CO₂. What mass of ethanol is produced from 90 g of glucose? [H = 1, C = 12, O = 16]", o: ["46 g", "23 g", "92 g", "44 g"], ans: 0, d: 3, e: "Molar mass of glucose = 6 × 12 + 12 + 6 × 16 = 180 g mol⁻¹, so 90 g is 0.5 mol. Each mole gives 2 mol of ethanol: 2 × 0.5 = 1 mol. Molar mass of C₂H₅OH = 46 g mol⁻¹, so the mass is 46 g.", why: { B: "23 g forgets the 2 in front of C₂H₅OH.", D: "44 g is the mass of CO₂ produced, not ethanol." } }, (90 / (6 * 12 + 12 + 6 * 16)) * 2 * (2 * 12 + 6 + 16)),
    ],
    free: [0, 2, 5, 9, 11, 13, 16, 18],
  },
  neco: {
    list: [
      // 0
      num({ t: "atomic-structure-and-bonding", stem: "What is the maximum number of electrons that the third energy level (n = 3) of an atom can hold?", o: ["18", "8", "32", "9"], ans: 0, d: 1, e: "The maximum number of electrons in shell n is 2n². For n = 3, that is 2 × 3² = 18 (3s² 3p⁶ 3d¹⁰).", why: { B: "8 is the number in the third shell for elements up to calcium, but the shell can hold up to 18.", D: "9 is n² without the factor of 2." } }, 2 * 3 ** 2),
      // 1
      { t: "atomic-structure-and-bonding", stem: "Water (H₂O) boils at 100 °C while hydrogen sulphide (H₂S), which has a larger molar mass, is a gas at room temperature. This is mainly because", o: ["water molecules are held together by hydrogen bonds", "water molecules are ionic", "the O–H covalent bond is broken when water boils", "hydrogen sulphide has metallic bonding"], ans: 0, d: 2, e: "Oxygen is very electronegative, so water molecules attract each other strongly by hydrogen bonds. Extra energy is needed to separate them, which raises the boiling point. Sulphur is less electronegative, so H₂S has only weak van der Waals forces.", why: { C: "Boiling separates molecules from each other; the covalent bonds inside each molecule stay intact." } },
      // 2
      (() => {
        const s = shells(15);
        return is({ t: "atomic-structure-and-bonding", stem: `An element has the electronic configuration ${config(15)}. In which group and period of the Periodic Table is it found?`, o: [`Group ${ROMAN[s[s.length - 1]]}, Period ${s.length}`, "Group III, Period 5", "Group III, Period 3", "Group V, Period 2"], ans: 0, d: 2, e: "The outermost shell is n = 3, so the element is in Period 3. That shell holds 3s² 3p³ = 5 electrons, so it is in Group V. The element is phosphorus.", why: { B: "The period is the number of shells (3), and the group is the number of outer electrons (5); this swaps them.", C: "Count all the outer-shell electrons: 3s² plus 3p³ makes 5, not 3." } }, `Group ${ROMAN[s[s.length - 1]]}, Period ${s.length}`);
      })(),
      // 3
      { t: "atomic-structure-and-bonding", stem: "In Rutherford's gold-foil experiment, most alpha particles passed straight through the foil. This showed that", o: ["most of the atom is empty space", "the nucleus is negatively charged", "electrons move in fixed orbits", "atoms are solid, indivisible spheres"], ans: 0, d: 2, e: "If most alpha particles meet nothing, most of the atom must be empty space. The few that bounced back showed a tiny, dense, positively charged nucleus.", why: { B: "Alpha particles are positive and some were repelled, so the nucleus is positive.", C: "Fixed electron orbits came later from Bohr's model, not from this experiment." } },
      // 4
      num({ t: "stoichiometry", stem: "What is the molar mass of ammonium tetraoxosulphate(VI), (NH₄)₂SO₄, a fertiliser? [H = 1, N = 14, O = 16, S = 32]", o: ["132 g mol⁻¹", "114 g mol⁻¹", "118 g mol⁻¹", "66 g mol⁻¹"], ans: 0, d: 1, e: "(NH₄)₂SO₄ = 2 × (14 + 4 × 1) + 32 + 4 × 16 = 36 + 32 + 64 = 132 g mol⁻¹.", why: { B: "114 counts only one NH₄ group; the bracket and subscript 2 mean two of them.", D: "66 is half the correct value; count both ammonium groups and all four oxygens." } }, 2 * (14 + 4 * 1) + 32 + 4 * 16),
      // 5
      num({ t: "stoichiometry", stem: "How many moles of nitrogen gas are present in 5.6 dm³ of the gas at s.t.p.? [Molar volume = 22.4 dm³ at s.t.p.]", o: ["0.25 mol", "0.5 mol", "4.0 mol", "0.125 mol"], ans: 0, d: 2, e: "At s.t.p. one mole of any gas occupies 22.4 dm³. Moles = 5.6 ÷ 22.4 = 0.25 mol.", why: { C: "4.0 comes from 22.4 ÷ 5.6; divide the volume you have by the molar volume." } }, 5.6 / 22.4),
      // 6
      num({ t: "stoichiometry", stem: "At the Ajaokuta steel plant, iron is extracted by the reaction Fe₂O₃ + 3CO → 2Fe + 3CO₂. What mass of iron can be obtained from 80 kg of Fe₂O₃? [O = 16, Fe = 56]", o: ["56 kg", "28 kg", "112 kg", "40 kg"], ans: 0, d: 2, e: "Molar mass of Fe₂O₃ = 2 × 56 + 3 × 16 = 160, and it contains 2 × 56 = 112 parts of iron. Mass of iron = 80 × 112 ÷ 160 = 56 kg.", why: { B: "28 kg forgets that each Fe₂O₃ gives two Fe atoms.", C: "112 kg is the iron from 160 kg of ore, not 80 kg." } }, (80 * (2 * 56)) / (2 * 56 + 3 * 16)),
      // 7
      num({ t: "stoichiometry", stem: "Excess sodium chloride solution is added to 50 cm³ of 0.20 mol dm⁻³ silver trioxonitrate(V), AgNO₃. What mass of silver chloride is precipitated? [AgNO₃ + NaCl → AgCl + NaNO₃; Cl = 35.5, Ag = 108]", o: ["1.435 g", "14.35 g", "2.870 g", "1.080 g"], ans: 0, d: 3, e: "Moles of AgNO₃ = 0.20 × 50 ÷ 1000 = 0.010 mol, which gives 0.010 mol of AgCl (1 : 1). Molar mass of AgCl = 108 + 35.5 = 143.5 g mol⁻¹, so the mass is 0.010 × 143.5 = 1.435 g.", why: { B: "14.35 g forgets to convert 50 cm³ into dm³ correctly (it uses 0.1 mol).", D: "1.080 g is the mass of silver only; the precipitate also contains chlorine." } }, ((0.2 * 50) / 1000) * (108 + 35.5)),
      // 8
      { t: "acids-bases-and-salts", stem: "Which of the following is a base but NOT an alkali?", o: ["CuO", "NaOH", "KOH", "Ca(OH)₂"], ans: 0, d: 1, e: "A base neutralises an acid to form a salt and water; an alkali is a base that dissolves in water. Copper(II) oxide is a base but is insoluble in water, so it is not an alkali.", why: { D: "Calcium hydroxide is sparingly soluble, and its solution (lime water) is alkaline." } },
      // 9
      num({ t: "acids-bases-and-salts", stem: "A solution has a hydrogen ion concentration of 1.0 × 10⁻⁵ mol dm⁻³. What is its pH?", o: ["5", "9", "−5", "10"], ans: 0, d: 2, e: "pH = −log[H⁺] = −log(10⁻⁵) = 5. The solution is weakly acidic.", why: { B: "9 is the pOH (14 − 5), not the pH.", C: "The minus sign in the formula cancels the negative power, so pH is +5." } }, -Math.log10(1.0e-5)),
      // 10
      { t: "acids-bases-and-salts", stem: "Which of the following salts is best prepared by precipitation (double decomposition)?", o: ["BaSO₄", "NaCl", "KNO₃", "ZnSO₄"], ans: 0, d: 2, e: "Precipitation is used for insoluble salts. Barium tetraoxosulphate(VI) is insoluble, so mixing solutions of, say, BaCl₂ and Na₂SO₄ gives a precipitate that is filtered off. The others are soluble.", why: { D: "ZnSO₄ is soluble; make it by reacting zinc or zinc oxide with excess dilute H₂SO₄." } },
      // 11
      num({ t: "acids-bases-and-salts", stem: "What volume of distilled water must be added to 100 cm³ of 2.0 mol dm⁻³ hydrochloric acid to dilute it to 0.50 mol dm⁻³?", o: ["300 cm³", "400 cm³", "25 cm³", "200 cm³"], ans: 0, d: 3, e: "Moles of acid stay the same on dilution: C₁V₁ = C₂V₂, so 2.0 × 100 = 0.50 × V₂ and V₂ = 400 cm³. The volume of water added = 400 − 100 = 300 cm³.", why: { B: "400 cm³ is the final volume of the solution; subtract the 100 cm³ already there.", C: "25 cm³ comes from inverting the ratio; diluting must increase the volume." } }, (2.0 * 100) / 0.5 - 100),
      // 12
      num({ t: "redox-and-electrolysis", stem: "What is the oxidation number of nitrogen in the trioxonitrate(V) ion, NO₃⁻?", o: ["+5", "+6", "−1", "+3"], ans: 0, d: 1, e: "Each O is −2 and the ion has an overall charge of −1. So N + 3(−2) = −1, giving N = +5, as the (V) in the name shows.", why: { B: "+6 ignores the −1 charge on the ion; the sum must equal −1, not 0." } }, -1 - 3 * -2),
      // 13
      num({ t: "redox-and-electrolysis", stem: "Dilute H₂SO₄ is electrolysed with platinum electrodes. At the anode: 4OH⁻ → 2H₂O + O₂ + 4e⁻. What volume of oxygen at s.t.p. is liberated when 0.20 faraday of electricity is passed? [Molar volume = 22.4 dm³ at s.t.p.]", o: ["1.12 dm³", "4.48 dm³", "2.24 dm³", "0.56 dm³"], ans: 0, d: 3, e: "One faraday is one mole of electrons. From the equation, 4 mol of electrons release 1 mol of O₂, so 0.20 F releases 0.20 ÷ 4 = 0.05 mol of O₂. Volume = 0.05 × 22.4 = 1.12 dm³.", why: { B: "4.48 dm³ multiplies by 4 instead of dividing.", C: "2.24 dm³ is the volume of hydrogen at the cathode (2 electrons per H₂)." } }, (0.2 / 4) * 22.4),
      // 14
      { t: "redox-and-electrolysis", stem: "Galvanised iron roofing sheets do not rust easily even when scratched, because zinc", o: ["is more reactive than iron and is oxidised in preference to it", "is less reactive than iron and never corrodes", "reduces iron(III) oxide back to iron as fast as it forms", "makes the iron an anode"], ans: 0, d: 2, e: "Zinc is higher than iron in the electrochemical series, so it loses electrons more readily. Even where the coat is scratched, zinc is oxidised instead of iron; this is sacrificial protection.", why: { B: "Zinc does corrode; it protects iron precisely because it is more reactive.", D: "Zinc becomes the anode; the iron is kept as the cathode, where no oxidation occurs." } },
      // 15
      { t: "redox-and-electrolysis", stem: "Which of the following is a redox reaction?", o: ["2Mg + O₂ → 2MgO", "NaOH + HCl → NaCl + H₂O", "AgNO₃ + NaCl → AgCl + NaNO₃", "CaCO₃ → CaO + CO₂"], ans: 0, d: 2, e: "In 2Mg + O₂ → 2MgO, magnesium goes from 0 to +2 (oxidised) and oxygen from 0 to −2 (reduced). In the other reactions no element changes its oxidation number.", why: { B: "Neutralisation only swaps ions; every oxidation number stays the same." } },
      // 16
      { t: "organic-chemistry", stem: "When crude oil is fractionally distilled at the Port Harcourt refinery, which fraction has the lowest boiling range?", o: ["refinery gas", "kerosene", "diesel oil", "bitumen"], ans: 0, d: 1, e: "Fractions with the smallest molecules (C₁–C₄) have the weakest attractions between molecules and the lowest boiling points. These form refinery gas, collected at the top of the column.", why: { D: "Bitumen has the largest molecules and the highest boiling range; it is left at the bottom." } },
      // 17
      { t: "organic-chemistry", stem: "What is the IUPAC name of CH₃CH₂CH₂OH?", o: ["propan-1-ol", "propan-2-ol", "propanal", "propanoic acid"], ans: 0, d: 2, e: "It has a three-carbon chain (prop-) with only single bonds (-an-) and an –OH group on the end carbon, carbon 1. So it is propan-1-ol.", why: { B: "In propan-2-ol the –OH is on the middle carbon: CH₃CH(OH)CH₃.", C: "Propanal has a –CHO group, not –OH." } },
      // 18
      { t: "organic-chemistry", stem: "Polythene (poly(ethene)) is made from ethene by", o: ["addition polymerisation", "condensation polymerisation", "cracking", "fermentation"], ans: 0, d: 2, e: "Many ethene molecules join together by opening their C=C double bonds, forming long chains with no other product: n CH₂=CH₂ → (–CH₂–CH₂–)ₙ. This is addition polymerisation.", why: { B: "Condensation polymerisation releases a small molecule such as water; no small molecule is lost when ethene polymerises.", C: "Cracking breaks large molecules into smaller ones; it is how ethene is obtained, not how it is joined." } },
      // 19
      (() => {
        const n = 56 / (12 + 2 * 1);
        return is({ t: "organic-chemistry", stem: "A hydrocarbon has the empirical formula CH₂ and a relative molecular mass of 56. What is its molecular formula? [H = 1, C = 12]", o: [`C${sub(n)}H${sub(2 * n)}`, "C₂H₄", "C₃H₆", "C₅H₁₀"], ans: 0, d: 3, e: "The empirical formula mass of CH₂ = 12 + 2 = 14. n = 56 ÷ 14 = 4, so the molecular formula is (CH₂)₄ = C₄H₈, an alkene such as but-1-ene.", why: { B: "C₂H₄ has a relative molecular mass of 28, half of 56.", C: "C₃H₆ has a relative molecular mass of 42." } }, "C₄H₈");
      })(),
    ],
    free: [1, 3, 6, 8, 10, 14, 17, 19],
  },
};
