// Chemistry batch 2 for Naija Exam Prep: 50 more JAMB, WAEC and NECO practice questions. Original questions; options are written
// with the correct one first and shuffled at build time. Every calculation is worked out in `check` and compared with option A.
const close = (a, b) => Math.abs(a - b) < 1e-9;
const near = (a, b, tol) => Math.abs(a - b) < tol;
const is = (q, value) => ({ ...q, check: q.o[0] === value });
// Compares the leading number of option A (spaces removed) with the worked value.
const num = (q, value) => ({ ...q, check: close(parseFloat(q.o[0].replace(/\s/g, "")), value) });
// Same, for answers rounded in the option (within `tol`).
const approx = (q, value, tol) => ({ ...q, check: near(parseFloat(q.o[0].replace(/\s/g, "")), value, tol) });
// Reads option A written as "m × 10ⁿ" and compares it with the worked value (to 3 significant figures).
const SUPS = "⁰¹²³⁴⁵⁶⁷⁸⁹";
const sci = (q, value) => {
  const [m, e] = q.o[0].split(" × 10");
  const exp = Number([...e].map((c) => SUPS.indexOf(c)).join(""));
  return { ...q, check: near(parseFloat(m) * 10 ** exp, value, Math.abs(value) * 0.005) };
};
const SUB = { 0: "₀", 1: "₁", 2: "₂", 3: "₃", 4: "₄", 5: "₅", 6: "₆", 7: "₇", 8: "₈", 9: "₉" };
const sub = (n) => (n === 1 ? "" : String(n).replace(/\d/g, (d) => SUB[d]));
const sup = (n) => String(n).replace(/\d/g, (d) => SUPS[d]);
const ox = (n) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : "0");
// Electrons in shells for the first 20 elements (or ions with up to 20 electrons), e.g. 18 → "2, 8, 8".
const shells = (n) => {
  const out = [];
  for (const cap of [2, 8, 8, 2]) { if (n <= 0) break; out.push(Math.min(cap, n)); n -= Math.min(cap, n); }
  return out.join(", ");
};
// Sub-level configuration in Aufbau order (no exceptions needed for the atoms used here).
const spdf = (n) => {
  const out = [];
  for (const [name, cap] of [["1s", 2], ["2s", 2], ["2p", 6], ["3s", 2], ["3p", 6], ["4s", 2], ["3d", 10], ["4p", 6]]) {
    if (n <= 0) break;
    const k = Math.min(cap, n);
    out.push(name + sup(k));
    n -= k;
  }
  return out.join(" ");
};
// Unpaired electrons in a partly filled p sub-level (Hund's rule).
const unpairedP = (p) => (p <= 3 ? p : 6 - p);
const FREE = [0, 3, 6, 8, 10, 13, 16, 18, 20, 23, 26, 28, 30, 33, 36, 38, 40, 43, 46, 48];

export default {
  jamb: {
    list: [
      // atomic-structure-and-bonding
      {
        t: "atomic-structure-and-bonding",
        stem: "Which pair of species is isoelectronic (has the same number of electrons)? [Atomic numbers: F = 9, Ne = 10, Na = 11, Mg = 12, K = 19]",
        o: ["Na⁺ and F⁻", "Na and Ne", "K⁺ and Ne", "Mg and Na⁺"], ans: 0, d: 2,
        e: "Na⁺ has 11 − 1 = 10 electrons and F⁻ has 9 + 1 = 10 electrons, so they are isoelectronic (both have the neon configuration 2, 8). Na has 11 against Ne's 10; K⁺ has 18 against Ne's 10; Mg has 12 against Na⁺'s 10.",
        why: { B: "A neutral sodium atom has 11 electrons, one more than neon.", C: "K⁺ has 19 − 1 = 18 electrons (the argon arrangement), not 10." },
      },
      num({
        t: "atomic-structure-and-bonding",
        stem: "How many unpaired electrons are there in a nitrogen atom, 1s² 2s² 2p³, in its ground state?",
        o: ["3", "1", "2", "5"], ans: 0, d: 2,
        e: "By Hund's rule, electrons enter the three 2p orbitals singly with parallel spins before any pairing occurs. The three 2p electrons of nitrogen therefore occupy one orbital each, giving 3 unpaired electrons. The 1s and 2s electrons are paired.",
        why: { B: "Pairing two of the 2p electrons in one orbital breaks Hund's rule.", D: "5 is the number of outer-shell (valence) electrons, but the 2s pair is paired." },
      }, unpairedP(3)),
      {
        t: "atomic-structure-and-bonding",
        stem: "The nitrogen atom in ammonia, NH₃, has three bond pairs and one lone pair of electrons. What is the shape of the ammonia molecule?",
        o: ["trigonal pyramidal", "trigonal planar", "linear", "bent (V-shaped)"], ans: 0, d: 2,
        e: "Four electron pairs around nitrogen point roughly to the corners of a tetrahedron. Only three of them hold hydrogen atoms; the lone pair is invisible in the shape. The atoms therefore form a pyramid with nitrogen at the top: trigonal pyramidal, with bond angles of about 107°.",
        why: { B: "Trigonal planar needs three bond pairs and no lone pair, as in BF₃.", D: "A bent shape has two bond pairs, as in water." },
      },
      {
        t: "atomic-structure-and-bonding",
        stem: "Which of the following bonds is the most polar?",
        o: ["H–F", "H–Cl", "H–Br", "H–I"], ans: 0, d: 1,
        e: "Bond polarity depends on the difference in electronegativity between the two atoms. Fluorine is the most electronegative element, and electronegativity falls down Group VII, so the H–F bond has the biggest difference and is the most polar.",
        why: { B: "Chlorine is less electronegative than fluorine, so H–Cl is less polar.", D: "Iodine has the lowest electronegativity of these halogens, so H–I is the least polar." },
      },
      is({
        t: "atomic-structure-and-bonding",
        stem: "A nucleus of ²³⁸₉₂U emits one alpha particle and then two beta particles. What are the mass number and atomic number of the nucleus finally formed?",
        o: ["mass number 234, atomic number 92", "mass number 234, atomic number 88", "mass number 238, atomic number 90", "mass number 236, atomic number 92"], ans: 0, d: 3,
        e: "An alpha particle (⁴₂He) takes away 4 from the mass number and 2 from the atomic number: 238 → 234 and 92 → 90. Each beta particle (⁰₋₁e) leaves the mass number unchanged but raises the atomic number by 1: 90 → 92. The product is ²³⁴₉₂U, an isotope of the original element.",
        why: { B: "This treats the beta particles as lowering the atomic number; beta emission raises it.", C: "The alpha particle removes 4 from the mass number; beta emission does not restore it." },
      }, `mass number ${238 - 4}, atomic number ${92 - 2 + 2 * 1}`),
      {
        t: "atomic-structure-and-bonding",
        stem: "Which scientist proposed that electrons move round the nucleus in fixed energy levels (shells)?",
        o: ["Niels Bohr", "John Dalton", "J. J. Thomson", "Ernest Rutherford"], ans: 0, d: 1,
        e: "Niels Bohr's model (1913) placed electrons in definite energy levels around the nucleus. An electron absorbs or gives out energy only when it jumps from one level to another, which explains the line spectrum of hydrogen.",
        why: { B: "Dalton's atomic theory treated atoms as indivisible particles, with no electrons.", D: "Rutherford discovered the nucleus but did not explain how the electrons were arranged." },
      },
      num({
        t: "atomic-structure-and-bonding",
        stem: "How many pairs of electrons are shared between the two atoms in a nitrogen molecule, N₂? [N: atomic number 7]",
        o: ["3", "1", "2", "4"], ans: 0, d: 2,
        e: "Nitrogen (2, 5) has five outer electrons and needs three more to complete an octet. Each atom therefore shares three of its electrons with the other, forming three shared pairs, a triple bond (N≡N). This strong bond is why nitrogen gas is so unreactive.",
        why: { B: "One shared pair would leave each nitrogen atom with only six outer electrons.", C: "A double bond is found in O₂, whose atoms each need only two more electrons." },
      }, 8 - (7 - 2)),
      {
        t: "atomic-structure-and-bonding",
        stem: "Down Group VII, the boiling points of the halogens rise from fluorine to iodine. This is mainly because",
        o: ["the van der Waals forces between the molecules increase as the molecules get larger", "the covalent bond inside each molecule becomes stronger", "hydrogen bonds form between the larger molecules", "the molecules become more polar down the group"], ans: 0, d: 2,
        e: "Halogen molecules are non-polar and are held together only by van der Waals (dispersion) forces. Larger molecules have more electrons, so these forces become stronger from F₂ to I₂ and more energy is needed to separate the molecules, raising the boiling point.",
        why: { B: "Boiling separates molecules; it does not break the covalent bond inside them (and that bond actually gets weaker down the group).", C: "Halogen molecules have no hydrogen atoms, so no hydrogen bonds form between them.", D: "X₂ molecules are made of two identical atoms and are non-polar." },
      },
      num({
        t: "atomic-structure-and-bonding",
        stem: "The activity of a radioactive sample falls from 800 counts per minute to 50 counts per minute in 20 days. What is its half-life?",
        o: ["5 days", "4 days", "10 days", "2.5 days"], ans: 0, d: 3,
        e: "Count the halvings: 800 → 400 → 200 → 100 → 50 is 4 half-lives. Four half-lives take 20 days, so one half-life = 20 ÷ 4 = 5 days.",
        why: { B: "4 is the number of half-lives, not the length of each one.", C: "10 days would mean only two halvings (800 → 200)." },
      }, 20 / Math.log2(800 / 50)),
      is({
        t: "atomic-structure-and-bonding",
        stem: "Element X has atomic number 20. What is the electronic configuration of the ion X²⁺?",
        o: ["2, 8, 8", "2, 8, 8, 2", "2, 8, 10", "2, 8, 6"], ans: 0, d: 1,
        e: "The atom has 20 electrons arranged 2, 8, 8, 2. It forms X²⁺ by losing its two outermost electrons, leaving 18 electrons arranged 2, 8, 8 (the stable argon arrangement).",
        why: { B: "2, 8, 8, 2 is the neutral atom, before it loses two electrons.", D: "2, 8, 6 has only 16 electrons; it treats the ion as having lost four." },
      }, shells(20 - 2)),

      // stoichiometry
      num({
        t: "stoichiometry",
        stem: "How many moles of oxygen atoms are present in 0.2 mol of aluminium tetraoxosulphate(VI), Al₂(SO₄)₃?",
        o: ["2.4", "0.8", "1.2", "0.6"], ans: 0, d: 2,
        e: "One formula unit of Al₂(SO₄)₃ contains 3 SO₄ groups, each with 4 oxygen atoms, so 3 × 4 = 12 oxygen atoms. Moles of O atoms = 0.2 × 12 = 2.4 mol.",
        why: { B: "0.8 counts only one SO₄ group (0.2 × 4) and ignores the subscript 3.", D: "0.6 is the number of moles of sulphate ions (0.2 × 3), not of oxygen atoms." },
      }, 0.2 * 3 * 4),
      num({
        t: "stoichiometry",
        stem: "A fixed mass of gas occupies 300 cm³ at 27 °C. What volume will it occupy at 127 °C if the pressure stays constant?",
        o: ["400 cm³", "1411 cm³", "225 cm³", "600 cm³"], ans: 0, d: 2,
        e: "Charles's law uses kelvin temperatures: T₁ = 27 + 273 = 300 K and T₂ = 127 + 273 = 400 K. V₂ = V₁ × T₂/T₁ = 300 × 400/300 = 400 cm³.",
        why: { B: "1411 cm³ comes from using °C (300 × 127/27); gas-law temperatures must be in kelvin.", C: "225 cm³ inverts the ratio; the gas expands when heated at constant pressure." },
      }, 300 * (127 + 273) / (27 + 273)),
      approx({
        t: "stoichiometry",
        stem: "A gas occupies 250 cm³ at 27 °C and 380 mmHg. What is its volume at s.t.p. (0 °C and 760 mmHg)?",
        o: ["113.8 cm³", "455.0 cm³", "137.4 cm³", "227.5 cm³"], ans: 0, d: 3,
        e: "Use P₁V₁/T₁ = P₂V₂/T₂, so V₂ = V₁ × (P₁/P₂) × (T₂/T₁) = 250 × (380/760) × (273/300) = 250 × 0.5 × 0.91 = 113.75 ≈ 113.8 cm³.",
        why: { B: "455.0 cm³ turns the pressure ratio upside down; raising the pressure makes the volume smaller.", C: "137.4 cm³ turns the temperature ratio upside down; cooling the gas makes it smaller.", D: "227.5 cm³ corrects only for temperature and ignores the change in pressure." },
      }, 250 * (380 / 760) * (273 / 300), 0.06),
      is({
        t: "stoichiometry",
        stem: "Under the same conditions, what is the ratio of the rate of diffusion of hydrogen to that of oxygen? [H = 1, O = 16]",
        o: ["4 : 1", "16 : 1", "1 : 4", "2 : 1"], ans: 0, d: 2,
        e: "Graham's law: rate ∝ 1/√(molar mass). Rate(H₂)/rate(O₂) = √(M(O₂)/M(H₂)) = √(32/2) = √16 = 4. Hydrogen diffuses four times as fast as oxygen.",
        why: { B: "16 : 1 is the ratio of the molar masses without taking the square root.", C: "1 : 4 has the ratio upside down; the lighter gas diffuses faster." },
      }, `${Math.sqrt(32 / 2)} : 1`),
      num({
        t: "stoichiometry",
        stem: "2.8 g of iron filings is heated with 2.4 g of sulphur: Fe + S → FeS. What mass of iron(II) sulphide is formed? [S = 32, Fe = 56]",
        o: ["4.4 g", "6.6 g", "5.2 g", "2.8 g"], ans: 0, d: 3,
        e: "Moles of Fe = 2.8/56 = 0.05 mol; moles of S = 2.4/32 = 0.075 mol. They react 1 : 1, so iron is the limiting reactant and only 0.05 mol FeS forms (sulphur is in excess). Mass of FeS = 0.05 × (56 + 32) = 0.05 × 88 = 4.4 g.",
        why: { B: "6.6 g bases the yield on sulphur, which is in excess.", C: "5.2 g simply adds the two masses, but 0.025 mol of sulphur is left unreacted." },
      }, Math.min(2.8 / 56, 2.4 / 32) * (56 + 32)),
      {
        t: "stoichiometry",
        stem: "\"Equal volumes of all gases at the same temperature and pressure contain the same number of molecules.\" This statement is",
        o: ["Avogadro's law", "Boyle's law", "Charles's law", "Graham's law"], ans: 0, d: 1,
        e: "This is Avogadro's law. It is why one mole of any gas occupies the same molar volume (22.4 dm³ at s.t.p.) and why reacting gas volumes are in the same ratio as the moles in the equation.",
        why: { B: "Boyle's law relates the pressure and volume of a fixed mass of gas at constant temperature.", D: "Graham's law is about rates of diffusion and molar mass." },
      },
      num({
        t: "stoichiometry",
        stem: "When 20 g of calcium trioxocarbonate(IV) was heated strongly, 9.52 g of calcium oxide was obtained: CaCO₃ → CaO + CO₂. What is the percentage yield? [C = 12, O = 16, Ca = 40]",
        o: ["85%", "48%", "95%", "56%"], ans: 0, d: 3,
        e: "Moles of CaCO₃ = 20/100 = 0.2 mol, so the theoretical yield of CaO = 0.2 × 56 = 11.2 g. Percentage yield = actual/theoretical × 100 = 9.52/11.2 × 100 = 85%.",
        why: { B: "48% divides the CaO obtained by the mass of CaCO₃ heated; the comparison must be with the theoretical mass of CaO.", D: "56% is the theoretical mass of CaO as a percentage of the CaCO₃, not the yield." },
      }, 100 * 9.52 / ((20 / 100) * 56)),
      (() => {
        const n = (2 * 39) / (12 + 1);
        return is({
          t: "stoichiometry",
          stem: "A hydrocarbon has the empirical formula CH and a vapour density of 39. What is its molecular formula? [H = 1, C = 12]",
          o: [`C${sub(n)}H${sub(n)}`, "C₂H₂", "C₃H₃", "C₄H₄"], ans: 0, d: 2,
          e: "Relative molecular mass = 2 × vapour density = 2 × 39 = 78. The empirical formula mass of CH = 13, so n = 78/13 = 6 and the molecular formula is (CH)₆ = C₆H₆ (benzene).",
          why: { C: "C₃H₃ (mass 39) uses the vapour density itself as the molar mass; it must first be doubled.", B: "C₂H₂ has a molar mass of 26, not 78." },
        }, "C₆H₆");
      })(),
      sci({
        t: "stoichiometry",
        stem: "How many molecules are present in 2.24 dm³ of carbon(IV) oxide at s.t.p.? [Molar volume = 22.4 dm³ at s.t.p.; Avogadro constant = 6.02 × 10²³ mol⁻¹]",
        o: ["6.02 × 10²²", "6.02 × 10²³", "1.81 × 10²³", "1.35 × 10²⁴"], ans: 0, d: 3,
        e: "Moles of CO₂ = 2.24/22.4 = 0.1 mol. Number of molecules = 0.1 × 6.02 × 10²³ = 6.02 × 10²².",
        why: { B: "6.02 × 10²³ is one whole mole of molecules, ten times too many.", C: "1.81 × 10²³ is the number of atoms (3 per molecule), not molecules." },
      }, (2.24 / 22.4) * 6.02e23),
      {
        t: "stoichiometry",
        stem: "At constant temperature, the pressure on a fixed mass of gas is doubled. What happens to its volume?",
        o: ["It is halved.", "It is doubled.", "It stays the same.", "It becomes four times as large."], ans: 0, d: 1,
        e: "Boyle's law: at constant temperature, PV is constant, so volume is inversely proportional to pressure. Doubling the pressure halves the volume.",
        why: { B: "Volume and pressure change in opposite directions, not together.", C: "The volume would stay the same only if the pressure did not change." },
      },

      // acids-bases-and-salts
      num({
        t: "acids-bases-and-salts",
        stem: "What is the pH of a 0.005 mol dm⁻³ solution of tetraoxosulphate(VI) acid, H₂SO₄? (Assume the acid is fully ionised.)",
        o: ["2", "2.3", "1", "12"], ans: 0, d: 2,
        e: "Each H₂SO₄ gives two H⁺ ions when fully ionised, so [H⁺] = 2 × 0.005 = 0.01 mol dm⁻³. pH = −log₁₀(0.01) = 2.",
        why: { B: "2.3 uses [H⁺] = 0.005, forgetting that H₂SO₄ is dibasic.", D: "12 would be the pH of an alkali with [OH⁻] = 0.01 mol dm⁻³." },
      }, -Math.log10(2 * 0.005)),
      {
        t: "acids-bases-and-salts",
        stem: "According to the Brønsted–Lowry theory, what is the conjugate base of the hydrogentetraoxosulphate(VI) ion, HSO₄⁻?",
        o: ["SO₄²⁻", "H₂SO₄", "H₃O⁺", "OH⁻"], ans: 0, d: 2,
        e: "A conjugate base is what remains after an acid donates a proton (H⁺). HSO₄⁻ → H⁺ + SO₄²⁻, so the conjugate base of HSO₄⁻ is SO₄²⁻.",
        why: { B: "H₂SO₄ is formed when HSO₄⁻ gains a proton, so it is the conjugate acid.", C: "H₃O⁺ is formed from water, not from HSO₄⁻." },
      },
      {
        t: "acids-bases-and-salts",
        stem: "Which of the following salts dissolves in water to give a solution with a pH greater than 7?",
        o: ["sodium ethanoate", "ammonium chloride", "sodium chloride", "ammonium tetraoxosulphate(VI)"], ans: 0, d: 2,
        e: "Sodium ethanoate is the salt of a strong base (NaOH) and a weak acid (ethanoic acid). Its ethanoate ions react with water (hydrolysis): CH₃COO⁻ + H₂O ⇌ CH₃COOH + OH⁻, releasing OH⁻ ions, so the solution is alkaline.",
        why: { B: "Ammonium chloride comes from a weak base and a strong acid, so its solution is acidic.", C: "Sodium chloride comes from a strong acid and a strong base, so its solution is neutral." },
      },
      num({
        t: "acids-bases-and-salts",
        stem: "A solution of salt Y in 100 g of water at 60 °C contains 60 g of Y. The solubility of Y at 20 °C is 25 g per 100 g of water. What mass of Y crystallises out when the solution is cooled to 20 °C?",
        o: ["35 g", "25 g", "60 g", "85 g"], ans: 0, d: 2,
        e: "At 20 °C, the 100 g of water can hold only 25 g of Y. The rest comes out of solution as crystals: 60 − 25 = 35 g.",
        why: { B: "25 g is the mass that stays dissolved at 20 °C, not the mass that crystallises.", D: "85 g adds the two values; the dissolved mass must be subtracted." },
      }, 60 - 25),
      {
        t: "acids-bases-and-salts",
        stem: "Which of the following substances is deliquescent, absorbing so much water vapour from the air that it dissolves to form a solution?",
        o: ["calcium chloride", "washing soda crystals", "copper(II) oxide", "silicon(IV) oxide (sand)"], ans: 0, d: 1,
        e: "Calcium chloride absorbs water vapour from moist air until it dissolves in the water it has taken up; this is deliquescence. It is why anhydrous calcium chloride is used as a drying agent.",
        why: { B: "Washing soda crystals are efflorescent: they lose water to the air, not gain it.", C: "Copper(II) oxide is insoluble and does not absorb water from the air." },
      },
      num({
        t: "acids-bases-and-salts",
        stem: "Excess marble chips are added to 25 cm³ of 2.0 mol dm⁻³ hydrochloric acid: CaCO₃ + 2HCl → CaCl₂ + H₂O + CO₂. What volume of carbon(IV) oxide is given off at s.t.p.? [Molar volume = 22.4 dm³ at s.t.p.]",
        o: ["0.56 dm³", "1.12 dm³", "0.28 dm³", "56 dm³"], ans: 0, d: 3,
        e: "Moles of HCl = 2.0 × 25/1000 = 0.05 mol. The marble is in excess, so the acid decides the yield. From the equation, 2 mol HCl gives 1 mol CO₂, so CO₂ = 0.05/2 = 0.025 mol. Volume = 0.025 × 22.4 = 0.56 dm³.",
        why: { B: "1.12 dm³ ignores the 2 : 1 ratio and takes 0.05 mol of CO₂.", D: "56 dm³ forgets to convert 25 cm³ to dm³." },
      }, (25 / 1000) * 2.0 / 2 * 22.4),
      {
        t: "acids-bases-and-salts",
        stem: "Which of the following oxides is amphoteric, reacting with both acids and alkalis to form salts?",
        o: ["ZnO", "Na₂O", "CO₂", "CaO"], ans: 0, d: 1,
        e: "Zinc oxide reacts with acids (ZnO + 2HCl → ZnCl₂ + H₂O) and also with alkalis such as sodium hydroxide to form a zincate salt, so it is amphoteric. Aluminium oxide and lead(II) oxide behave in the same way.",
        why: { B: "Na₂O is a basic oxide; it reacts only with acids.", C: "CO₂ is an acidic oxide; it reacts with alkalis but not with acids." },
      },
      num({
        t: "acids-bases-and-salts",
        stem: "What volume of 0.10 mol dm⁻³ sodium hydroxide solution is needed to convert 0.002 mol of tetraoxophosphate(V) acid, H₃PO₄, completely to the normal salt Na₃PO₄?",
        o: ["60 cm³", "20 cm³", "40 cm³", "6 cm³"], ans: 0, d: 2,
        e: "H₃PO₄ is tribasic: H₃PO₄ + 3NaOH → Na₃PO₄ + 3H₂O. Moles of NaOH = 3 × 0.002 = 0.006 mol. Volume = 0.006/0.10 = 0.06 dm³ = 60 cm³.",
        why: { B: "20 cm³ uses a 1 : 1 ratio, which would form only the acid salt NaH₂PO₄.", C: "40 cm³ uses a 2 : 1 ratio, which gives Na₂HPO₄, still an acid salt." },
      }, (0.002 * 3) / 0.10 * 1000),
      approx({
        t: "acids-bases-and-salts",
        stem: "What is the pH of a 5.0 × 10⁻⁴ mol dm⁻³ solution of calcium hydroxide, Ca(OH)₂, at 25 °C? (Assume complete ionisation; pH + pOH = 14.)",
        o: ["11", "3", "10.7", "12"], ans: 0, d: 3,
        e: "Each Ca(OH)₂ gives two OH⁻ ions, so [OH⁻] = 2 × 5.0 × 10⁻⁴ = 1.0 × 10⁻³ mol dm⁻³. pOH = −log₁₀(10⁻³) = 3, and pH = 14 − 3 = 11.",
        why: { B: "3 is the pOH; the question asks for the pH.", C: "10.7 forgets that each Ca(OH)₂ releases two hydroxide ions." },
      }, 14 + Math.log10(2 * 5.0e-4), 1e-6),
      {
        t: "acids-bases-and-salts",
        stem: "Which pair of solutions, when mixed, gives a white precipitate of barium tetraoxosulphate(VI)?",
        o: ["barium chloride and sodium tetraoxosulphate(VI)", "barium chloride and sodium trioxonitrate(V)", "barium trioxonitrate(V) and potassium chloride", "barium hydroxide and hydrochloric acid"], ans: 0, d: 1,
        e: "To precipitate BaSO₄, one solution must supply Ba²⁺ ions and the other SO₄²⁻ ions: BaCl₂(aq) + Na₂SO₄(aq) → BaSO₄(s) + 2NaCl(aq). The insoluble BaSO₄ falls out as a white solid.",
        why: { B: "Neither solution provides sulphate ions, and all the possible products are soluble.", D: "This is a neutralisation that gives soluble barium chloride and water." },
      },

      // redox-and-electrolysis
      is({
        t: "redox-and-electrolysis",
        stem: "What is the oxidation number of phosphorus in tetraoxophosphate(V) acid, H₃PO₄?",
        o: ["+5", "+3", "+4", "−3"], ans: 0, d: 1,
        e: "The sum of oxidation numbers in a neutral compound is zero. H is +1 and O is −2: 3(+1) + P + 4(−2) = 0, so 3 + P − 8 = 0 and P = +5. This matches the (V) in the IUPAC name.",
        why: { B: "+3 ignores one of the oxygen atoms or miscounts the hydrogens.", D: "−3 is phosphorus's oxidation number in metal phosphides and PH₃, not in an oxoacid." },
      }, ox(4 * 2 - 3 * 1)),
      num({
        t: "redox-and-electrolysis",
        stem: "In acidic solution, the tetraoxomanganate(VII) ion, MnO₄⁻, is reduced to Mn²⁺. How many electrons does each MnO₄⁻ ion gain?",
        o: ["5", "2", "3", "7"], ans: 0, d: 2,
        e: "In MnO₄⁻, Mn + 4(−2) = −1, so Mn = +7. In Mn²⁺ it is +2. The fall in oxidation number is 7 − 2 = 5, so each MnO₄⁻ gains 5 electrons: MnO₄⁻ + 8H⁺ + 5e⁻ → Mn²⁺ + 4H₂O.",
        why: { B: "2 is the final charge on the manganese ion, not the electrons gained.", D: "7 is the starting oxidation number; the change is what matters." },
      }, (4 * 2 - 1) - 2),
      num({
        t: "redox-and-electrolysis",
        stem: "A current of 0.20 A is passed through silver trioxonitrate(V) solution for 9650 s. What mass of silver is deposited at the cathode? [Ag = 108; F = 96 500 C mol⁻¹]",
        o: ["2.16 g", "1.08 g", "4.32 g", "21.6 g"], ans: 0, d: 2,
        e: "Q = It = 0.20 × 9650 = 1930 C. Moles of electrons = 1930/96 500 = 0.02 mol. Ag⁺ + e⁻ → Ag, so 0.02 mol of silver is deposited: 0.02 × 108 = 2.16 g.",
        why: { B: "1.08 g treats silver as needing two electrons per atom; Ag⁺ needs only one.", D: "21.6 g is ten times too large; 1930 C is 0.02 F, not 0.2 F." },
      }, (0.20 * 9650) / 96500 * 108),
      {
        t: "redox-and-electrolysis",
        stem: "Which of the following metals is the strongest reducing agent?",
        o: ["potassium", "lead", "copper", "silver"], ans: 0, d: 1,
        e: "A reducing agent gives away electrons. Potassium is at the top of the electrochemical (activity) series, so it loses its outer electron most readily and is the strongest reducing agent of the four.",
        why: { C: "Copper is low in the series and gives up electrons much less readily.", D: "Silver is the least reactive of the four, so it is the weakest reducing agent." },
      },
      {
        t: "redox-and-electrolysis",
        stem: "Copper(II) tetraoxosulphate(VI) solution is electrolysed using copper electrodes. Which observation is correct?",
        o: ["The anode loses mass while the cathode gains mass.", "Oxygen gas bubbles off at the anode.", "The blue colour of the solution fades steadily.", "Hydrogen gas is evolved at the cathode."], ans: 0, d: 2,
        e: "With copper electrodes the copper anode dissolves (Cu → Cu²⁺ + 2e⁻) and copper is deposited on the cathode (Cu²⁺ + 2e⁻ → Cu). The anode gets lighter, the cathode heavier, and the Cu²⁺ concentration (and blue colour) stays the same.",
        why: { B: "Oxygen is released only with inert electrodes; here the copper anode itself is oxidised.", C: "Copper ions removed at the cathode are replaced from the anode, so the colour stays the same." },
      },
      num({
        t: "redox-and-electrolysis",
        stem: "During the electrolysis of concentrated brine, a current of 5.0 A flows for 1930 s. What volume of chlorine is liberated at the anode at s.t.p.? [F = 96 500 C mol⁻¹; molar volume = 22.4 dm³ at s.t.p.]",
        o: ["1.12 dm³", "2.24 dm³", "0.56 dm³", "11.2 dm³"], ans: 0, d: 3,
        e: "Q = 5.0 × 1930 = 9650 C = 9650/96 500 = 0.1 mol of electrons. At the anode 2Cl⁻ → Cl₂ + 2e⁻, so 0.1 mol of electrons gives 0.05 mol of Cl₂. Volume = 0.05 × 22.4 = 1.12 dm³.",
        why: { B: "2.24 dm³ takes one mole of Cl₂ per mole of electrons; two electrons are needed per Cl₂.", C: "0.56 dm³ uses four electrons per Cl₂, as for oxygen." },
      }, (5.0 * 1930) / 96500 / 2 * 22.4),
      {
        t: "redox-and-electrolysis",
        stem: "In the reaction Cl₂ + 2NaOH → NaCl + NaOCl + H₂O, chlorine is",
        o: ["both oxidised and reduced", "oxidised only", "reduced only", "neither oxidised nor reduced"], ans: 0, d: 3,
        e: "Chlorine starts at 0 in Cl₂. In NaCl it is −1 (reduced) and in NaOCl it is +1 (oxidised). The same element is both oxidised and reduced, which is called disproportionation.",
        why: { B: "Half of the chlorine goes to −1 in NaCl, which is reduction.", D: "The oxidation number of chlorine changes, from 0 to −1 and to +1." },
      },
      {
        t: "redox-and-electrolysis",
        stem: "In terms of hydrogen, reduction is defined as the",
        o: ["addition of hydrogen to a substance", "removal of hydrogen from a substance", "addition of oxygen to a substance", "loss of electrons by a substance"], ans: 0, d: 1,
        e: "Reduction is the gain of hydrogen (or loss of oxygen, or gain of electrons). For example, when ethene is hydrogenated to ethane, the ethene is reduced.",
        why: { B: "Removal of hydrogen is oxidation.", D: "Loss of electrons is oxidation, not reduction." },
      },
      num({
        t: "redox-and-electrolysis",
        stem: "The standard electrode potentials are Zn²⁺/Zn = −0.76 V and Cu²⁺/Cu = +0.34 V. What is the e.m.f. of the cell made by joining the two half-cells?",
        o: ["1.10 V", "0.42 V", "−1.10 V", "0.34 V"], ans: 0, d: 2,
        e: "E°cell = E°(cathode, more positive) − E°(anode, more negative) = +0.34 − (−0.76) = 1.10 V. Zinc is the negative electrode and copper the positive one.",
        why: { B: "0.42 V adds the two values without minding the signs (0.76 − 0.34).", C: "A working cell has a positive e.m.f.; the order of subtraction is reversed here." },
      }, 0.34 - -0.76),
      {
        t: "redox-and-electrolysis",
        stem: "Burning magnesium keeps burning in carbon(IV) oxide: 2Mg + CO₂ → 2MgO + C. Which substance is reduced?",
        o: ["carbon(IV) oxide", "magnesium", "magnesium oxide", "carbon"], ans: 0, d: 2,
        e: "CO₂ loses its oxygen to magnesium, and the oxidation number of carbon falls from +4 to 0, so carbon(IV) oxide is reduced. Magnesium gains oxygen (0 → +2) and is oxidised; it is the reducing agent.",
        why: { B: "Magnesium gains oxygen and loses electrons, so it is oxidised.", D: "Carbon is the product of the reduction, not the substance that was reduced." },
      },

      // organic-chemistry
      is({
        t: "organic-chemistry",
        stem: "What is the IUPAC name of CH₃CH₂CH(CH₃)CH₂CH₃?",
        o: ["3-methylpentane", "2-ethylbutane", "3-ethylbutane", "2-methylpentane"], ans: 0, d: 2,
        e: "The longest continuous chain has five carbon atoms (pentane). The methyl branch is on the third carbon whichever end you count from, so the name is 3-methylpentane.",
        why: { B: "Naming it as a butane misses the longest chain, which runs through the ethyl group and has five carbons.", D: "In 2-methylpentane the branch is on carbon 2; here it is in the middle of the chain." },
      }, `${Math.min(3, 5 - 3 + 1)}-methylpentane`),
      {
        t: "organic-chemistry",
        stem: "Which reagent can be used to distinguish ethyne from ethene?",
        o: ["ammoniacal copper(I) chloride", "bromine water", "acidified potassium tetraoxomanganate(VII)", "hydrogen in the presence of nickel"], ans: 0, d: 3,
        e: "Ethyne has hydrogen atoms on its triple-bonded carbons, which react with ammoniacal copper(I) chloride to give a red-brown precipitate of copper(I) dicarbide. Ethene gives no precipitate, so the two can be told apart.",
        why: { B: "Both ethyne and ethene are unsaturated and decolourise bromine water.", C: "Both are oxidised by and decolourise acidified KMnO₄." },
      },
      {
        t: "organic-chemistry",
        stem: "What is the functional group of the alkanals (aldehydes)?",
        o: ["–CHO", "–COOH", "–OH", "–COO–"], ans: 0, d: 1,
        e: "Alkanals contain the –CHO group, a carbonyl group (C=O) with a hydrogen atom on the same carbon, as in ethanal, CH₃CHO.",
        why: { B: "–COOH is the carboxyl group of alkanoic acids.", D: "–COO– is the ester linkage." },
      },
      num({
        t: "organic-chemistry",
        stem: "What volume of hydrogen, measured at s.t.p., is needed to convert 0.1 mol of ethyne completely to ethane? [Molar volume = 22.4 dm³ at s.t.p.]",
        o: ["4.48 dm³", "2.24 dm³", "6.72 dm³", "1.12 dm³"], ans: 0, d: 3,
        e: "C₂H₂ + 2H₂ → C₂H₆. The triple bond needs 2 mol of H₂ per mole of ethyne, so 0.1 mol needs 0.2 mol H₂. Volume = 0.2 × 22.4 = 4.48 dm³.",
        why: { B: "2.24 dm³ adds only one mole of H₂, which stops at ethene.", C: "6.72 dm³ uses three moles of H₂ per mole of ethyne." },
      }, 0.1 * 2 * 22.4),
      {
        t: "organic-chemistry",
        stem: "Which of the following is a secondary alkanol?",
        o: ["CH₃CH(OH)CH₃", "CH₃CH₂CH₂OH", "(CH₃)₃COH", "CH₃OH"], ans: 0, d: 2,
        e: "In a secondary alkanol, the carbon carrying the –OH group is joined to two other carbon atoms. In propan-2-ol, CH₃CH(OH)CH₃, the –OH carbon is bonded to two CH₃ groups.",
        why: { B: "Propan-1-ol is primary: its –OH carbon is joined to only one other carbon.", C: "(CH₃)₃COH is tertiary: its –OH carbon is joined to three carbons." },
      },
      {
        t: "organic-chemistry",
        stem: "Natural rubber is heated with a small amount of an element to make it harder and more elastic for tyres. This process is vulcanisation. Which element is used?",
        o: ["sulphur", "chlorine", "nitrogen", "phosphorus"], ans: 0, d: 1,
        e: "In vulcanisation, rubber is heated with sulphur. Sulphur atoms form cross-links between the long polymer chains, so the rubber becomes harder, stronger and less sticky, and keeps its elasticity over a wider range of temperatures.",
        why: { B: "Chlorine is not used to cross-link rubber.", C: "Nitrogen is an unreactive gas and does not form cross-links in rubber." },
      },
      {
        t: "organic-chemistry",
        stem: "When ethanol is warmed with acidified potassium heptaoxodichromate(VI), the colour of the solution changes from",
        o: ["orange to green", "green to orange", "purple to colourless", "colourless to purple"], ans: 0, d: 1,
        e: "The dichromate ion Cr₂O₇²⁻ (orange) oxidises ethanol to ethanal and then to ethanoic acid, and is itself reduced to Cr³⁺ (green). The orange-to-green change is the basis of older breathalyser tests.",
        why: { B: "This is the reverse change; dichromate is reduced, not formed.", C: "Purple to colourless is the change seen with acidified KMnO₄, not dichromate." },
      },
      {
        t: "organic-chemistry",
        stem: "A gaseous hydrocarbon has a relative molecular mass of 42 and decolourises bromine water. Which of the following could it be? [H = 1, C = 12]",
        o: ["propene", "propane", "ethene", "ethyne"], ans: 0, d: 2,
        e: "Decolourising bromine water shows the hydrocarbon is unsaturated. Propene, C₃H₆, has Mr = 3(12) + 6(1) = 42, which fits both facts.",
        why: { B: "Propane, C₃H₈ (Mr 44), is saturated and does not decolourise bromine water.", C: "Ethene is unsaturated but its Mr is 28, not 42." },
        check: close(3 * 12 + 6 * 1, 42),
      },
      {
        t: "organic-chemistry",
        stem: "Which ester is formed when ethanol reacts with methanoic acid in the presence of a little concentrated tetraoxosulphate(VI) acid?",
        o: ["ethyl methanoate", "methyl ethanoate", "ethyl ethanoate", "methyl methanoate"], ans: 0, d: 2,
        e: "An ester is named alkyl (from the alkanol) + alkanoate (from the acid). Ethanol gives the ethyl part and methanoic acid gives the methanoate part: HCOOH + C₂H₅OH → HCOOC₂H₅ + H₂O, ethyl methanoate.",
        why: { B: "Methyl ethanoate would come from methanol and ethanoic acid; the parts are swapped.", C: "Ethyl ethanoate needs ethanoic acid, not methanoic acid." },
      },
      {
        t: "organic-chemistry",
        stem: "Benzene is unsaturated, yet it does not readily decolourise bromine water and prefers substitution to addition reactions. This is because",
        o: ["its delocalised ring of π-electrons gives it extra stability", "it contains no carbon–carbon double bonds of any kind", "its molecules are saturated with hydrogen atoms", "it is a non-polar liquid that does not dissolve bromine"], ans: 0, d: 3,
        e: "The six π-electrons in benzene are spread (delocalised) evenly around the ring rather than fixed in three separate double bonds. This makes the ring unusually stable, so benzene reacts by substitution, which keeps the ring intact, rather than by addition, which would destroy it.",
        why: { C: "C₆H₆ has far fewer hydrogens than the saturated C₆H₁₄, so it is not saturated.", D: "Bromine dissolves readily in benzene; solubility is not the reason." },
      },
    ],
    free: FREE,
  },

  waec: {
    list: [
      // atomic-structure-and-bonding
      {
        t: "atomic-structure-and-bonding",
        stem: "Which particles are found in the nucleus of an atom?",
        o: ["protons and neutrons", "protons and electrons", "neutrons and electrons", "electrons only"], ans: 0, d: 1,
        e: "The nucleus is the small, dense centre of the atom and contains the protons (positive) and neutrons (neutral). The electrons move in shells around the nucleus.",
        why: { B: "Electrons are outside the nucleus, in energy levels.", C: "Electrons are outside the nucleus; protons are inside it." },
      },
      {
        t: "atomic-structure-and-bonding",
        stem: "Element Q has the electronic configuration 2, 8, 1. Element Q is",
        o: ["an alkali metal", "a halogen", "a noble gas", "an alkaline earth metal"], ans: 0, d: 1,
        e: "One electron in the outermost shell places Q in Group I, the alkali metals (it is sodium). It readily loses that electron to form Q⁺.",
        why: { B: "Halogens have seven outer electrons.", D: "Alkaline earth metals (Group II) have two outer electrons." },
      },
      num({
        t: "atomic-structure-and-bonding",
        stem: "What is the maximum number of electrons that a p sub-level can hold?",
        o: ["6", "2", "8", "10"], ans: 0, d: 1,
        e: "A p sub-level has three orbitals (pₓ, pᵧ, p_z), and each orbital holds at most two electrons of opposite spin. Maximum = 3 × 2 = 6 electrons.",
        why: { B: "2 is the maximum for an s sub-level (one orbital).", D: "10 is the maximum for a d sub-level (five orbitals)." },
      }, 3 * 2),
      approx({
        t: "atomic-structure-and-bonding",
        stem: "Copper consists of 69% ⁶³Cu and 31% ⁶⁵Cu. What is the relative atomic mass of copper?",
        o: ["63.6", "64.0", "63.4", "64.4"], ans: 0, d: 2,
        e: "Relative atomic mass is the weighted average: (69 × 63 + 31 × 65)/100 = (4347 + 2015)/100 = 63.62 ≈ 63.6.",
        why: { B: "64.0 is the simple average of 63 and 65, ignoring the abundances.", D: "64.4 gives the greater weighting to ⁶⁵Cu, the less abundant isotope." },
      }, (69 * 63 + 31 * 65) / 100, 0.05),
      {
        t: "atomic-structure-and-bonding",
        stem: "In which of the following liquids are the molecules held together by hydrogen bonds?",
        o: ["ethanol", "hexane", "tetrachloromethane", "benzene"], ans: 0, d: 2,
        e: "Hydrogen bonds form when hydrogen is bonded directly to a very electronegative atom (N, O or F). Ethanol has an O–H group, so its molecules hydrogen-bond to one another. The other liquids have no H attached to N, O or F.",
        why: { B: "Hexane has only C–H bonds; its molecules are held by van der Waals forces.", C: "CCl₄ has no hydrogen at all." },
      },
      num({
        t: "atomic-structure-and-bonding",
        stem: "How many lone pairs of electrons are on the oxygen atom in a water molecule? [O: atomic number 8]",
        o: ["2", "1", "3", "4"], ans: 0, d: 2,
        e: "Oxygen (2, 6) has six outer electrons. Two of them are used in the two O–H bonds, leaving 6 − 2 = 4 non-bonding electrons, which make 2 lone pairs. These lone pairs give water its bent shape.",
        why: { B: "One lone pair is found on nitrogen in ammonia, not on oxygen in water.", D: "4 is the number of non-bonding electrons, which form two pairs." },
      }, (6 - 2) / 2),
      {
        t: "atomic-structure-and-bonding",
        stem: "Graphite conducts electricity but diamond does not, although both are forms of carbon. This is because in graphite",
        o: ["each carbon atom uses only three of its outer electrons in bonding, leaving one free to move", "the carbon atoms are held together by ionic bonds", "the layers of atoms are held by strong covalent bonds", "each carbon atom is bonded to four other carbon atoms"], ans: 0, d: 2,
        e: "In graphite, each carbon atom forms covalent bonds with three others in flat layers. The fourth outer electron of each atom is delocalised and can move along the layers, so graphite conducts. In diamond all four electrons are used in bonding.",
        why: { B: "Graphite is a covalent network, not an ionic compound.", D: "Bonding to four other carbon atoms describes diamond, which does not conduct." },
      },
      (() => {
        const ie = [738, 1451, 7733, 10541];
        const jumps = ie.slice(1).map((v, i) => v / ie[i]);
        const group = ["I", "II", "III"][jumps.indexOf(Math.max(...jumps))];
        return is({
          t: "atomic-structure-and-bonding",
          stem: "The first four ionisation energies of element X are 738, 1451, 7733 and 10 541 kJ mol⁻¹. In which group of the Periodic Table is X?",
          o: ["Group II", "Group I", "Group III", "Group IV"], ans: 0, d: 3,
          e: "The big jump comes between the second (1451) and third (7733) ionisation energies. The third electron must come from a full inner shell, close to the nucleus. So X has two outer electrons and is in Group II (it is magnesium).",
          why: { B: "A Group I element would show the big jump after the first ionisation energy.", C: "A Group III element would show the big jump after the third ionisation energy." },
        }, `Group ${group}`);
      })(),
      {
        t: "atomic-structure-and-bonding",
        stem: "Carbon-14 decays as follows: ¹⁴₆C → ¹⁴₇N + X. What is X?",
        o: ["a beta particle", "an alpha particle", "a neutron", "a proton"], ans: 0, d: 2,
        e: "The mass number stays at 14 and the atomic number rises from 6 to 7. To balance, X has mass number 0 and charge −1: X = ⁰₋₁e, a beta particle. A neutron in the nucleus has turned into a proton and an electron.",
        why: { B: "An alpha particle (⁴₂He) would reduce the mass number by 4.", D: "Losing a proton would lower the atomic number, not raise it." },
      },
      is({
        t: "atomic-structure-and-bonding",
        stem: "What is the ground-state electronic configuration of an iron atom, ₂₆Fe?",
        o: ["1s² 2s² 2p⁶ 3s² 3p⁶ 4s² 3d⁶", "1s² 2s² 2p⁶ 3s² 3p⁶ 3d⁸", "1s² 2s² 2p⁶ 3s² 3p⁶ 4s² 4p⁶", "1s² 2s² 2p⁶ 3s² 3p⁶ 3d⁶"], ans: 0, d: 3,
        e: "Sub-levels fill in order of energy: 1s, 2s, 2p, 3s, 3p (18 electrons), then 4s (2 more, 20), then 3d. The last 6 electrons go into 3d, giving 1s² 2s² 2p⁶ 3s² 3p⁶ 4s² 3d⁶.",
        why: { B: "The 4s sub-level fills before 3d, so it cannot be left empty in the atom.", C: "3d (lower in energy) fills before 4p.", D: "This has only 24 electrons; it is the Fe²⁺ ion." },
      }, spdf(26)),

      // stoichiometry
      num({
        t: "stoichiometry",
        stem: "What is the molar mass of sodium trioxocarbonate(IV), Na₂CO₃? [C = 12, O = 16, Na = 23]",
        o: ["106 g mol⁻¹", "83 g mol⁻¹", "51 g mol⁻¹", "130 g mol⁻¹"], ans: 0, d: 1,
        e: "Add up the atoms: 2 Na + 1 C + 3 O = 2(23) + 12 + 3(16) = 46 + 12 + 48 = 106 g mol⁻¹.",
        why: { B: "83 counts only one sodium atom.", C: "51 counts one sodium and only one oxygen atom." },
      }, 2 * 23 + 12 + 3 * 16),
      num({
        t: "stoichiometry",
        stem: "How many moles are there in 3.2 g of sulphur(IV) oxide, SO₂? [O = 16, S = 32]",
        o: ["0.05", "0.10", "0.20", "0.5"], ans: 0, d: 1,
        e: "Molar mass of SO₂ = 32 + 2(16) = 64 g mol⁻¹. Moles = mass/molar mass = 3.2/64 = 0.05 mol.",
        why: { B: "0.10 uses the mass of sulphur alone (32) as the molar mass.", D: "0.5 is ten times too large; check the decimal point in 3.2/64." },
      }, 3.2 / (32 + 2 * 16)),
      (() => {
        const mg = 2.4 / 24, o = 1.6 / 16, r = mg / o;
        return is({
          t: "stoichiometry",
          stem: "2.4 g of magnesium combines completely with 1.6 g of oxygen. What is the empirical formula of the oxide? [O = 16, Mg = 24]",
          o: [Math.round(r) === 1 ? "MgO" : "?", "Mg₂O", "MgO₂", "Mg₃O₂"], ans: 0, d: 2,
          e: "Moles of Mg = 2.4/24 = 0.1; moles of O = 1.6/16 = 0.1. The mole ratio Mg : O = 0.1 : 0.1 = 1 : 1, so the empirical formula is MgO.",
          why: { B: "Mg₂O would need twice as many moles of magnesium as oxygen.", C: "MgO₂ would need 3.2 g of oxygen for the same 2.4 g of magnesium." },
        }, "MgO");
      })(),
      num({
        t: "stoichiometry",
        stem: "A solution of tetraoxosulphate(VI) acid, H₂SO₄, has a concentration of 0.50 mol dm⁻³. What is its concentration in g dm⁻³? [H = 1, O = 16, S = 32]",
        o: ["49 g dm⁻³", "98 g dm⁻³", "196 g dm⁻³", "24.5 g dm⁻³"], ans: 0, d: 2,
        e: "Molar mass of H₂SO₄ = 2(1) + 32 + 4(16) = 98 g mol⁻¹. Mass concentration = molar concentration × molar mass = 0.50 × 98 = 49 g dm⁻³.",
        why: { B: "98 g dm⁻³ is the mass of one mole, i.e. a 1.0 mol dm⁻³ solution.", C: "196 g dm⁻³ divides 98 by 0.50 instead of multiplying." },
      }, 0.50 * (2 * 1 + 32 + 4 * 16)),
      num({
        t: "stoichiometry",
        stem: "A gas occupies 600 cm³ at a pressure of 1 atm. At constant temperature, what is its volume when the pressure is raised to 3 atm?",
        o: ["200 cm³", "1800 cm³", "600 cm³", "300 cm³"], ans: 0, d: 1,
        e: "Boyle's law: P₁V₁ = P₂V₂, so V₂ = P₁V₁/P₂ = (1 × 600)/3 = 200 cm³. Tripling the pressure reduces the volume to one third.",
        why: { B: "1800 cm³ multiplies by 3; volume falls as pressure rises.", C: "The volume changes because the pressure changed." },
      }, (1 * 600) / 3),
      num({
        t: "stoichiometry",
        stem: "Magnesium burns in air: 2Mg + O₂ → 2MgO. What mass of magnesium oxide is formed when 6.0 g of magnesium burns completely? [O = 16, Mg = 24]",
        o: ["10 g", "20 g", "8.0 g", "4.0 g"], ans: 0, d: 2,
        e: "Moles of Mg = 6.0/24 = 0.25 mol. From the equation 2 mol Mg gives 2 mol MgO, a 1 : 1 ratio, so 0.25 mol MgO forms. Mass = 0.25 × 40 = 10 g.",
        why: { B: "20 g doubles the moles because of the 2 in front of MgO, but both sides have a 2.", D: "4.0 g is the mass of oxygen that combines, not the mass of oxide." },
      }, (6.0 / 24) * (24 + 16)),
      num({
        t: "stoichiometry",
        stem: "10 g of calcium trioxocarbonate(IV) reacts with excess dilute hydrochloric acid: CaCO₃ + 2HCl → CaCl₂ + H₂O + CO₂. What volume of carbon(IV) oxide is produced at s.t.p.? [C = 12, O = 16, Ca = 40; molar volume = 22.4 dm³]",
        o: ["2.24 dm³", "4.48 dm³", "22.4 dm³", "1.12 dm³"], ans: 0, d: 2,
        e: "Moles of CaCO₃ = 10/100 = 0.1 mol. 1 mol CaCO₃ gives 1 mol CO₂, so 0.1 mol CO₂ is formed. Volume = 0.1 × 22.4 = 2.24 dm³.",
        why: { B: "4.48 dm³ uses the 2 in front of HCl, but the acid is in excess and the ratio CaCO₃ : CO₂ is 1 : 1.", C: "22.4 dm³ is the volume of one whole mole of gas." },
      }, (10 / 100) * 22.4),
      num({
        t: "stoichiometry",
        stem: "20 cm³ of hydrogen is mixed with 30 cm³ of chlorine and exploded: H₂(g) + Cl₂(g) → 2HCl(g). What is the total volume of gas present afterwards, measured at the original temperature and pressure?",
        o: ["50 cm³", "40 cm³", "10 cm³", "70 cm³"], ans: 0, d: 3,
        e: "By Gay-Lussac's law, volumes react in the ratio of the equation. 20 cm³ H₂ reacts with 20 cm³ Cl₂ to give 40 cm³ HCl, leaving 30 − 20 = 10 cm³ of unreacted chlorine. Total = 40 + 10 = 50 cm³.",
        why: { B: "40 cm³ counts the HCl but forgets the 10 cm³ of chlorine left over.", D: "70 cm³ assumes 40 cm³ of HCl forms and none of the starting gas is used up." },
      }, 2 * 20 + (30 - 20)),
      num({
        t: "stoichiometry",
        stem: "A gas occupies 3.0 dm³ at 27 °C and 2 atm. What is its volume at 127 °C and 4 atm?",
        o: ["2.0 dm³", "7.1 dm³", "1.1 dm³", "4.0 dm³"], ans: 0, d: 3,
        e: "Use P₁V₁/T₁ = P₂V₂/T₂ with kelvin temperatures (300 K and 400 K): V₂ = P₁V₁T₂/(T₁P₂) = (2 × 3.0 × 400)/(300 × 4) = 2400/1200 = 2.0 dm³.",
        why: { B: "7.1 dm³ uses Celsius temperatures (127/27) instead of kelvin.", C: "1.1 dm³ inverts the temperature ratio (300/400 instead of 400/300)." },
      }, (2 * 3.0 * 400) / (300 * 4)),
      sci({
        t: "stoichiometry",
        stem: "How many atoms are present in 2.0 g of helium gas? [He = 4; Avogadro constant = 6.02 × 10²³ mol⁻¹]",
        o: ["3.01 × 10²³", "1.51 × 10²³", "6.02 × 10²³", "1.20 × 10²⁴"], ans: 0, d: 2,
        e: "Helium is monatomic. Moles of He = 2.0/4 = 0.5 mol. Number of atoms = 0.5 × 6.02 × 10²³ = 3.01 × 10²³.",
        why: { B: "1.51 × 10²³ treats helium as diatomic (He₂, molar mass 8), but it exists as single atoms.", D: "1.20 × 10²⁴ multiplies by the mass instead of dividing by the molar mass." },
      }, (2.0 / 4) * 6.02e23),

      // acids-bases-and-salts
      {
        t: "acids-bases-and-salts",
        stem: "What colour is methyl orange in a solution of dilute hydrochloric acid?",
        o: ["red", "yellow", "blue", "colourless"], ans: 0, d: 1,
        e: "Methyl orange is red in acidic solution and yellow in alkaline solution. Dilute hydrochloric acid is acidic, so the indicator turns red.",
        why: { B: "Yellow is the colour of methyl orange in alkaline solution.", D: "Colourless is phenolphthalein's colour in acid, not methyl orange's." },
      },
      {
        t: "acids-bases-and-salts",
        stem: "Which acid gives lemons and oranges their sour taste?",
        o: ["citric acid", "ethanoic acid", "lactic acid", "methanoic acid"], ans: 0, d: 1,
        e: "Citrus fruits such as lemons, limes and oranges contain citric acid, a weak organic acid that gives them their sour taste.",
        why: { B: "Ethanoic acid is the acid in vinegar.", C: "Lactic acid is found in sour milk and in tired muscles." },
      },
      {
        t: "acids-bases-and-salts",
        stem: "Potassium hydroxide solution is neutralised by trioxonitrate(V) acid. What is the salt formed?",
        o: ["potassium trioxonitrate(V)", "potassium dioxonitrate(III)", "potassium trioxocarbonate(IV)", "potassium tetraoxosulphate(VI)"], ans: 0, d: 1,
        e: "KOH + HNO₃ → KNO₃ + H₂O. The salt takes the metal from the base and the acid radical (NO₃⁻) from trioxonitrate(V) acid, giving potassium trioxonitrate(V), KNO₃.",
        why: { B: "Dioxonitrate(III) salts come from dioxonitrate(III) acid, HNO₂.", C: "A trioxocarbonate(IV) needs carbonic acid or CO₂, not HNO₃." },
      },
      approx({
        t: "acids-bases-and-salts",
        stem: "An aqueous solution has a hydroxide ion concentration of 1.0 × 10⁻⁴ mol dm⁻³ at 25 °C. What is its pH? (pH + pOH = 14)",
        o: ["10", "4", "9", "14"], ans: 0, d: 2,
        e: "pOH = −log₁₀[OH⁻] = −log₁₀(10⁻⁴) = 4. pH = 14 − pOH = 14 − 4 = 10, so the solution is alkaline.",
        why: { B: "4 is the pOH, not the pH.", D: "14 would need [OH⁻] = 1 mol dm⁻³." },
      }, 14 + Math.log10(1.0e-4), 1e-6),
      num({
        t: "acids-bases-and-salts",
        stem: "What volume of 0.20 mol dm⁻³ hydrochloric acid reacts completely with 2.65 g of anhydrous sodium trioxocarbonate(IV)? Na₂CO₃ + 2HCl → 2NaCl + H₂O + CO₂ [C = 12, O = 16, Na = 23]",
        o: ["250 cm³", "125 cm³", "500 cm³", "25 cm³"], ans: 0, d: 3,
        e: "Molar mass of Na₂CO₃ = 106 g mol⁻¹, so moles = 2.65/106 = 0.025 mol. HCl needed = 2 × 0.025 = 0.05 mol. Volume = 0.05/0.20 = 0.25 dm³ = 250 cm³.",
        why: { B: "125 cm³ uses a 1 : 1 ratio and ignores the 2 in front of HCl.", D: "25 cm³ comes from a slip in converting dm³ to cm³." },
      }, (2.65 / 106) * 2 / 0.20 * 1000),
      {
        t: "acids-bases-and-salts",
        stem: "Which pair of substances reacts to give a salt and water only?",
        o: ["dilute hydrochloric acid and sodium hydroxide solution", "dilute hydrochloric acid and zinc granules", "dilute hydrochloric acid and calcium trioxocarbonate(IV)", "dilute hydrochloric acid and silver trioxonitrate(V) solution"], ans: 0, d: 2,
        e: "Neutralisation of an acid by a base gives a salt and water only: HCl + NaOH → NaCl + H₂O.",
        why: { B: "An acid and a metal give a salt and hydrogen gas.", C: "An acid and a trioxocarbonate(IV) give a salt, water and carbon(IV) oxide." },
      },
      {
        t: "acids-bases-and-salts",
        stem: "Solution P is 0.001 mol dm⁻³ hydrochloric acid and solution Q is 2.0 mol dm⁻³ ethanoic acid. Which statement is correct?",
        o: ["P is a strong but dilute acid, while Q is a weak but concentrated acid.", "P is a strong and concentrated acid, while Q is weak and dilute.", "Q is a strong acid because its concentration is higher.", "P and Q are equally strong because both are acids."], ans: 0, d: 3,
        e: "Strength describes how fully an acid ionises; concentration describes how much acid is dissolved in a given volume. HCl ionises completely (strong), but 0.001 mol dm⁻³ is dilute. Ethanoic acid ionises only partly (weak), but 2.0 mol dm⁻³ is concentrated.",
        why: { B: "0.001 mol dm⁻³ is a dilute solution, not a concentrated one.", C: "A higher concentration does not make an acid stronger; ethanoic acid stays weak." },
      },
      {
        t: "acids-bases-and-salts",
        stem: "Dilute hydrochloric acid is added to a trioxocarbonate(IV), and the gas given off turns lime water milky. The gas is",
        o: ["carbon(IV) oxide", "hydrogen", "oxygen", "chlorine"], ans: 0, d: 1,
        e: "Acids react with trioxocarbonates(IV) to give a salt, water and carbon(IV) oxide. CO₂ reacts with lime water, Ca(OH)₂, to form insoluble CaCO₃, which makes it milky.",
        why: { B: "Hydrogen is given off when acids react with metals; it pops with a lighted splint.", C: "Oxygen relights a glowing splint and has no effect on lime water." },
      },
      num({
        t: "acids-bases-and-salts",
        stem: "25 cm³ of 2.0 mol dm⁻³ tetraoxosulphate(VI) acid is diluted with distilled water to 500 cm³. What is the concentration of the diluted acid?",
        o: ["0.10 mol dm⁻³", "0.40 mol dm⁻³", "0.20 mol dm⁻³", "40 mol dm⁻³"], ans: 0, d: 2,
        e: "Dilution does not change the number of moles of acid: C₁V₁ = C₂V₂. C₂ = (2.0 × 25)/500 = 0.10 mol dm⁻³.",
        why: { D: "40 mol dm⁻³ multiplies by 500/25 instead of dividing; dilution lowers the concentration.", C: "0.20 mol dm⁻³ treats the 25 cm³ as diluted only tenfold instead of twentyfold." },
      }, (2.0 * 25) / 500),
      num({
        t: "acids-bases-and-salts",
        stem: "20.0 cm³ of 0.10 mol dm⁻³ tetraoxosulphate(VI) acid exactly neutralised 25.0 cm³ of potassium hydroxide solution: H₂SO₄ + 2KOH → K₂SO₄ + 2H₂O. What is the concentration of the KOH in g dm⁻³? [H = 1, O = 16, K = 39]",
        o: ["8.96 g dm⁻³", "4.48 g dm⁻³", "0.16 g dm⁻³", "5.60 g dm⁻³"], ans: 0, d: 3,
        e: "Moles of H₂SO₄ = 0.10 × 20.0/1000 = 0.002 mol, so KOH = 2 × 0.002 = 0.004 mol in 25.0 cm³. Concentration = 0.004/0.025 = 0.16 mol dm⁻³. Molar mass of KOH = 39 + 16 + 1 = 56, so 0.16 × 56 = 8.96 g dm⁻³.",
        why: { B: "4.48 g dm⁻³ ignores the 1 : 2 mole ratio of acid to alkali.", C: "0.16 is the concentration in mol dm⁻³; it has not been multiplied by the molar mass." },
      }, ((20.0 * 0.10 / 1000) * 2 / (25.0 / 1000)) * (39 + 16 + 1)),

      // redox-and-electrolysis
      {
        t: "redox-and-electrolysis",
        stem: "In terms of electron transfer, an oxidising agent is a substance that",
        o: ["accepts electrons", "donates electrons", "donates protons", "accepts protons"], ans: 0, d: 1,
        e: "An oxidising agent causes another substance to lose electrons, so it takes those electrons itself and is reduced. For example, Cl₂ + 2e⁻ → 2Cl⁻.",
        why: { B: "Donating electrons is what a reducing agent does.", C: "Donating protons describes a Brønsted–Lowry acid, not an oxidising agent." },
      },
      is({
        t: "redox-and-electrolysis",
        stem: "What is the oxidation number of nitrogen in the ammonium ion, NH₄⁺?",
        o: ["−3", "+3", "+4", "−4"], ans: 0, d: 2,
        e: "The oxidation numbers in an ion add up to its charge. Hydrogen is +1: N + 4(+1) = +1, so N = +1 − 4 = −3.",
        why: { B: "+3 has the right size but the wrong sign; nitrogen is more electronegative than hydrogen.", C: "+4 confuses the number of hydrogen atoms with the oxidation number." },
      }, ox(1 - 4 * 1)),
      {
        t: "redox-and-electrolysis",
        stem: "Which of the following is a non-electrolyte?",
        o: ["sugar solution", "sodium chloride solution", "dilute tetraoxosulphate(VI) acid", "molten lead(II) bromide"], ans: 0, d: 1,
        e: "Sugar (sucrose) is a covalent compound that dissolves as whole molecules, not ions. With no mobile ions, its solution does not conduct electricity and is not decomposed by a current, so it is a non-electrolyte.",
        why: { B: "Salt solution contains free Na⁺ and Cl⁻ ions and conducts electricity.", D: "Molten PbBr₂ contains mobile Pb²⁺ and Br⁻ ions and is electrolysed." },
      },
      num({
        t: "redox-and-electrolysis",
        stem: "What mass of zinc is deposited at the cathode by 0.40 faraday of electricity? Zn²⁺ + 2e⁻ → Zn [Zn = 65]",
        o: ["13 g", "26 g", "6.5 g", "52 g"], ans: 0, d: 2,
        e: "One faraday is one mole of electrons. Each Zn²⁺ needs 2 electrons, so 0.40 F deposits 0.40/2 = 0.20 mol of zinc. Mass = 0.20 × 65 = 13 g.",
        why: { B: "26 g takes one mole of zinc per faraday, forgetting that Zn²⁺ needs two electrons.", C: "6.5 g divides by 4 instead of 2." },
      }, (0.40 / 2) * 65),
      {
        t: "redox-and-electrolysis",
        stem: "Molten sodium chloride is electrolysed using inert electrodes. What is formed at the cathode?",
        o: ["sodium metal", "hydrogen gas", "chlorine gas", "sodium hydroxide"], ans: 0, d: 1,
        e: "Molten NaCl contains only Na⁺ and Cl⁻ ions. The Na⁺ ions move to the cathode and gain electrons: Na⁺ + e⁻ → Na, forming sodium metal. There is no water present, so no hydrogen can form.",
        why: { B: "Hydrogen forms at the cathode only when water is present, as in brine.", C: "Chlorine forms at the anode, where Cl⁻ ions lose electrons." },
      },
      num({
        t: "redox-and-electrolysis",
        stem: "In acidic solution, the heptaoxodichromate(VI) ion, Cr₂O₇²⁻, is reduced to Cr³⁺ ions. How many electrons are gained by each Cr₂O₇²⁻ ion?",
        o: ["6", "3", "2", "7"], ans: 0, d: 3,
        e: "In Cr₂O₇²⁻, 2Cr + 7(−2) = −2, so each Cr is +6. Each Cr falls from +6 to +3, gaining 3 electrons. There are two Cr atoms, so each ion gains 2 × 3 = 6 electrons: Cr₂O₇²⁻ + 14H⁺ + 6e⁻ → 2Cr³⁺ + 7H₂O.",
        why: { B: "3 electrons is the change for one chromium atom; the ion contains two.", D: "7 is the number of oxygen atoms, not electrons." },
      }, 2 * ((7 * 2 - 2) / 2 - 3)),
      {
        t: "redox-and-electrolysis",
        stem: "Four iron nails are left for a week under different conditions. Which nail will rust first?",
        o: ["a nail half-covered with tap water in an open test tube", "a nail in boiled water covered with a layer of oil", "a nail in dry air kept over anhydrous calcium chloride", "a nail coated with grease and kept in dry air"], ans: 0, d: 1,
        e: "Rusting is the oxidation of iron and needs both water and oxygen (air). Only the nail in tap water open to the air has both. Boiled water covered with oil has no dissolved air; dry air has no water; grease keeps both away.",
        why: { B: "Boiling removes the dissolved air and the oil stops more air dissolving.", C: "The calcium chloride removes water vapour, so the air is dry." },
      },
      num({
        t: "redox-and-electrolysis",
        stem: "What steady current must flow for 1930 s to deposit 1.08 g of silver from silver trioxonitrate(V) solution? [Ag = 108; F = 96 500 C mol⁻¹]",
        o: ["0.50 A", "1.0 A", "0.25 A", "5.0 A"], ans: 0, d: 3,
        e: "Moles of Ag = 1.08/108 = 0.01 mol. Ag⁺ + e⁻ → Ag, so 0.01 mol of electrons is needed: Q = 0.01 × 96 500 = 965 C. I = Q/t = 965/1930 = 0.50 A.",
        why: { B: "1.0 A assumes two electrons per silver ion; Ag⁺ needs only one.", D: "5.0 A is ten times too large; recheck 1.08/108." },
      }, ((1.08 / 108) * 96500) / 1930),
      {
        t: "redox-and-electrolysis",
        stem: "Which metal can displace copper from copper(II) tetraoxosulphate(VI) solution but cannot displace zinc from zinc tetraoxosulphate(VI) solution?",
        o: ["iron", "magnesium", "silver", "mercury"], ans: 0, d: 2,
        e: "A metal displaces another from solution only if it is higher in the activity series. Iron lies below zinc but above copper (Zn > Fe > Cu), so it displaces copper but not zinc.",
        why: { B: "Magnesium is above zinc, so it would displace zinc as well.", C: "Silver is below copper, so it cannot displace copper." },
      },
      is({
        t: "redox-and-electrolysis",
        stem: "When hydrogen sulphide burns in excess air to form sulphur(IV) oxide, how does the oxidation number of sulphur change?",
        o: ["increases by 6", "decreases by 6", "increases by 2", "increases by 4"], ans: 0, d: 2,
        e: "In H₂S, 2(+1) + S = 0, so S = −2. In SO₂, S + 2(−2) = 0, so S = +4. The change is from −2 to +4, an increase of 6, so sulphur is oxidised.",
        why: { B: "The oxidation number rises; sulphur is oxidised, not reduced.", D: "+4 is the final oxidation number, but sulphur started at −2, not 0." },
      }, `increases by ${4 - -2}`),

      // organic-chemistry
      {
        t: "organic-chemistry",
        stem: "What is the general formula of the alkanes?",
        o: ["CₙH₂ₙ₊₂", "CₙH₂ₙ", "CₙH₂ₙ₋₂", "CₙH₂ₙ₊₁OH"], ans: 0, d: 1,
        e: "Alkanes are saturated hydrocarbons. Each has two more hydrogen atoms than twice its carbon atoms: methane CH₄, ethane C₂H₆, propane C₃H₈, so CₙH₂ₙ₊₂.",
        why: { B: "CₙH₂ₙ is the general formula of the alkenes.", C: "CₙH₂ₙ₋₂ is the general formula of the alkynes." },
      },
      {
        t: "organic-chemistry",
        stem: "Natural gas, found with crude oil in the Niger Delta, consists mainly of",
        o: ["methane", "butane", "ethene", "hydrogen"], ans: 0, d: 1,
        e: "Natural gas is mostly methane, CH₄, with smaller amounts of ethane, propane and butane. It is used for power generation and as a fuel.",
        why: { B: "Butane is only a minor part of natural gas; it is better known as a component of bottled cooking gas (LPG).", C: "Ethene is not a natural component of the gas; it is made by cracking." },
      },
      {
        t: "organic-chemistry",
        stem: "What is the IUPAC name of the ester CH₃CH₂COOCH₃?",
        o: ["methyl propanoate", "propyl methanoate", "ethyl ethanoate", "methyl ethanoate"], ans: 0, d: 2,
        e: "Split the ester at the –COO– link. CH₃CH₂COO– has three carbons including the C=O carbon, so it comes from propanoic acid (propanoate). The –CH₃ on the oxygen comes from methanol (methyl). The name is methyl propanoate.",
        why: { B: "Propyl methanoate would be HCOOCH₂CH₂CH₃; the parts are reversed.", C: "Ethyl ethanoate (CH₃COOCH₂CH₃) is an isomer with a different structure." },
      },
      (() => {
        const n = 4 + 1; // ethene is the first alkene, so the fourth has five carbon atoms
        return is({
          t: "organic-chemistry",
          stem: "Ethene is the first member of the alkene series. What is the molecular formula of the fourth member?",
          o: [`C${sub(n)}H${sub(2 * n)}`, "C₄H₈", "C₄H₁₀", "C₅H₁₂"], ans: 0, d: 2,
          e: "The alkenes start with ethene (C₂H₄), then propene (C₃H₆), butene (C₄H₈) and pentene. The fourth member has 5 carbon atoms, and alkenes are CₙH₂ₙ, so it is C₅H₁₀.",
          why: { B: "C₄H₈ is butene, the third member, because the series starts at two carbons.", D: "C₅H₁₂ is pentane, an alkane." },
        }, "C₅H₁₀");
      })(),
      {
        t: "organic-chemistry",
        stem: "In the fermentation of glucose to ethanol by yeast, which enzyme catalyses the reaction?",
        o: ["zymase", "diastase", "maltase", "pepsin"], ans: 0, d: 2,
        e: "Yeast supplies the enzyme zymase, which converts glucose into ethanol and carbon(IV) oxide: C₆H₁₂O₆ → 2C₂H₅OH + 2CO₂.",
        why: { B: "Diastase converts starch to maltose, an earlier step.", C: "Maltase converts maltose to glucose, before fermentation." },
      },
      {
        t: "organic-chemistry",
        stem: "Poly(chloroethene), PVC, is used to make water pipes. What is its monomer?",
        o: ["chloroethene", "ethene", "chloroethane", "tetrafluoroethene"], ans: 0, d: 2,
        e: "PVC is made by addition polymerisation of chloroethene (vinyl chloride), CH₂=CHCl. Its double bond opens up to join many units into long –CH₂–CHCl– chains.",
        why: { B: "Ethene polymerises to polythene, not PVC.", C: "Chloroethane is saturated and has no double bond to polymerise." },
      },
      num({
        t: "organic-chemistry",
        stem: "What is the percentage by mass of carbon in ethane, C₂H₆? [H = 1, C = 12]",
        o: ["80%", "20%", "75%", "40%"], ans: 0, d: 2,
        e: "Molar mass of C₂H₆ = 2(12) + 6(1) = 30. Mass of carbon = 24. Percentage = 24/30 × 100 = 80%.",
        why: { B: "20% is the percentage of hydrogen.", D: "40% counts only one carbon atom (12/30)." },
      }, (100 * 2 * 12) / (2 * 12 + 6)),
      {
        t: "organic-chemistry",
        stem: "Methane reacts with chlorine in bright sunlight to form chloromethane and hydrogen chloride. This reaction is an example of",
        o: ["substitution", "addition", "polymerisation", "esterification"], ans: 0, d: 2,
        e: "A chlorine atom takes the place of one hydrogen atom in methane: CH₄ + Cl₂ → CH₃Cl + HCl. Replacing one atom by another is substitution, the typical reaction of saturated alkanes.",
        why: { B: "Addition needs a double or triple bond, and methane has none.", D: "Esterification is the reaction of an acid with an alkanol." },
      },
      num({
        t: "organic-chemistry",
        stem: "What volume of carbon(IV) oxide, measured at s.t.p., is produced when 2.9 g of butane, C₄H₁₀, burns completely in excess oxygen? [H = 1, C = 12; molar volume = 22.4 dm³]",
        o: ["4.48 dm³", "1.12 dm³", "8.96 dm³", "2.24 dm³"], ans: 0, d: 3,
        e: "Molar mass of C₄H₁₀ = 4(12) + 10(1) = 58, so moles = 2.9/58 = 0.05 mol. 2C₄H₁₀ + 13O₂ → 8CO₂ + 10H₂O, so 1 mol butane gives 4 mol CO₂: 0.05 × 4 = 0.2 mol. Volume = 0.2 × 22.4 = 4.48 dm³.",
        why: { B: "1.12 dm³ is the volume of the butane itself; each molecule gives four CO₂ molecules.", C: "8.96 dm³ uses the 8 from the balanced equation without the 2 in front of butane." },
      }, (2.9 / 58) * 4 * 22.4),
      {
        t: "organic-chemistry",
        stem: "Which compound reacts with sodium metal to give hydrogen gas but does NOT turn blue litmus paper red?",
        o: ["ethanol", "ethanoic acid", "ethane", "ethene"], ans: 0, d: 3,
        e: "Ethanol has an –OH group, so it reacts with sodium: 2C₂H₅OH + 2Na → 2C₂H₅ONa + H₂. But ethanol is neutral and does not ionise to give H⁺ in water, so it has no effect on litmus.",
        why: { B: "Ethanoic acid reacts with sodium but is acidic and turns blue litmus red.", C: "Ethane has no –OH group and does not react with sodium." },
      },
    ],
    free: FREE,
  },

  neco: {
    list: [
      // atomic-structure-and-bonding
      {
        t: "atomic-structure-and-bonding",
        stem: "Which scientist discovered the electron through experiments with cathode rays?",
        o: ["J. J. Thomson", "John Dalton", "Ernest Rutherford", "James Chadwick"], ans: 0, d: 1,
        e: "J. J. Thomson showed in 1897 that cathode rays are streams of tiny negatively charged particles, later called electrons, present in all atoms.",
        why: { C: "Rutherford discovered the nucleus with his gold-foil experiment.", D: "Chadwick discovered the neutron in 1932." },
      },
      {
        t: "atomic-structure-and-bonding",
        stem: "The noble gases, such as neon and argon, are very unreactive because",
        o: ["their outermost shells are completely filled", "they have no electrons in their outer shells", "their atoms are too large to form bonds", "they are all radioactive"], ans: 0, d: 1,
        e: "Neon (2, 8) and argon (2, 8, 8) have full outer shells (a stable octet; helium has a stable duplet). They have no tendency to gain, lose or share electrons, so they rarely react.",
        why: { B: "Their outer shells are full of electrons, not empty.", C: "Neon and helium are among the smallest atoms, yet they are the least reactive." },
      },
      is({
        t: "atomic-structure-and-bonding",
        stem: "An element has the electronic configuration 2, 8, 6. What charge is on the ion it forms when it reacts with a metal?",
        o: ["−2", "+6", "+2", "−6"], ans: 0, d: 1,
        e: "With six outer electrons, the atom needs two more to complete an octet. It gains two electrons from the metal, forming an ion with a charge of −2 (it is sulphur, forming S²⁻).",
        why: { B: "Losing six electrons takes far too much energy; non-metals gain electrons.", D: "The atom needs only two electrons to reach 2, 8, 8." },
      }, ox(6 - 8)),
      {
        t: "atomic-structure-and-bonding",
        stem: "Which pair of atoms contains the same number of neutrons?",
        o: ["¹⁴₆C and ¹⁶₈O", "¹²₆C and ¹⁴₆C", "¹⁴₇N and ¹⁶₈O", "¹⁹₉F and ²³₁₁Na"], ans: 0, d: 2,
        e: "Neutrons = mass number − atomic number. ¹⁴₆C: 14 − 6 = 8; ¹⁶₈O: 16 − 8 = 8. Both have 8 neutrons.",
        why: { B: "These isotopes have the same number of protons but 6 and 8 neutrons.", C: "¹⁴₇N has 7 neutrons while ¹⁶₈O has 8.", D: "¹⁹₉F has 10 neutrons while ²³₁₁Na has 12." },
      },
      {
        t: "atomic-structure-and-bonding",
        stem: "Sodium chloride has a high melting point (801 °C). This is because",
        o: ["strong electrostatic forces hold the oppositely charged ions together in a lattice", "weak van der Waals forces hold its molecules together", "its atoms share electrons in strong covalent bonds", "it contains a sea of delocalised electrons"], ans: 0, d: 2,
        e: "Sodium chloride is an ionic compound. Each Na⁺ is surrounded by Cl⁻ ions and each Cl⁻ by Na⁺ ions in a giant lattice. Breaking these strong attractions between oppositely charged ions needs a lot of energy, so the melting point is high.",
        why: { B: "Weak van der Waals forces give low melting points, as in simple molecular solids.", D: "A sea of delocalised electrons describes metallic bonding." },
      },
      num({
        t: "atomic-structure-and-bonding",
        stem: "How many orbitals make up a d sub-level?",
        o: ["5", "3", "7", "10"], ans: 0, d: 2,
        e: "An s sub-level has 1 orbital, p has 3, d has 5 and f has 7. Each holds two electrons, so a d sub-level holds up to 10 electrons in 5 orbitals.",
        why: { B: "3 orbitals make up a p sub-level.", D: "10 is the number of electrons a d sub-level can hold, not the number of orbitals." },
      }, 2 * 2 + 1),
      {
        t: "atomic-structure-and-bonding",
        stem: "The ions O²⁻, F⁻, Na⁺ and Mg²⁺ all have the electronic configuration 2, 8. Which of them has the largest radius?",
        o: ["O²⁻", "F⁻", "Na⁺", "Mg²⁺"], ans: 0, d: 3,
        e: "All four ions have 10 electrons, but their nuclear charges differ: O has 8 protons, F 9, Na 11 and Mg 12. With the fewest protons pulling on the same 10 electrons, O²⁻ holds them least tightly and is the largest.",
        why: { C: "Na⁺ has 11 protons pulling on 10 electrons, so it is smaller than O²⁻ and F⁻.", D: "Mg²⁺ has the greatest nuclear charge, so it is the smallest." },
      },
      approx({
        t: "atomic-structure-and-bonding",
        stem: "Magnesium consists of 79% ²⁴Mg, 10% ²⁵Mg and 11% ²⁶Mg. What is the relative atomic mass of magnesium?",
        o: ["24.3", "25.0", "24.0", "24.6"], ans: 0, d: 3,
        e: "Weighted average = (79 × 24 + 10 × 25 + 11 × 26)/100 = (1896 + 250 + 286)/100 = 2432/100 = 24.32 ≈ 24.3.",
        why: { B: "25.0 is the simple average of 24, 25 and 26, ignoring the abundances.", C: "24.0 uses only the most abundant isotope." },
      }, (79 * 24 + 10 * 25 + 11 * 26) / 100, 0.05),
      {
        t: "atomic-structure-and-bonding",
        stem: "The carbon atom in carbon(IV) oxide, O=C=O, has two double bonds and no lone pairs. What is the shape of the molecule?",
        o: ["linear", "bent (V-shaped)", "trigonal planar", "tetrahedral"], ans: 0, d: 2,
        e: "With only two regions of electron density (the two double bonds) and no lone pairs on carbon, the bonds point in opposite directions to be as far apart as possible. The O–C–O angle is 180°, so the molecule is linear.",
        why: { B: "A bent shape needs lone pairs on the central atom, as in water.", C: "Trigonal planar needs three regions of electron density around the central atom." },
      },
      num({
        t: "atomic-structure-and-bonding",
        stem: "Heavy water, D₂O, contains deuterium (²₁H) in place of ordinary hydrogen. How many neutrons are there in one molecule of D₂O made with oxygen-16 (¹⁶₈O)?",
        o: ["10", "8", "12", "20"], ans: 0, d: 3,
        e: "Each deuterium atom has 2 − 1 = 1 neutron, so two give 2 neutrons. Oxygen-16 has 16 − 8 = 8 neutrons. Total = 2 + 8 = 10 neutrons.",
        why: { B: "8 counts only the oxygen and misses the neutrons in deuterium.", D: "20 is the relative molecular mass of D₂O (protons + neutrons)." },
      }, 2 * (2 - 1) + (16 - 8)),

      // stoichiometry
      num({
        t: "stoichiometry",
        stem: "What volume is occupied by 2.0 mol of carbon(IV) oxide at s.t.p.? [Molar volume = 22.4 dm³ at s.t.p.]",
        o: ["44.8 dm³", "22.4 dm³", "11.2 dm³", "88.0 dm³"], ans: 0, d: 1,
        e: "One mole of any gas occupies 22.4 dm³ at s.t.p. Volume = moles × molar volume = 2.0 × 22.4 = 44.8 dm³.",
        why: { B: "22.4 dm³ is the volume of only one mole.", C: "11.2 dm³ divides by 2 instead of multiplying." },
      }, 2.0 * 22.4),
      num({
        t: "stoichiometry",
        stem: "How many moles of atoms are present in 1 mol of tetraoxosulphate(VI) acid, H₂SO₄?",
        o: ["7", "3", "4", "6"], ans: 0, d: 1,
        e: "Each H₂SO₄ unit contains 2 hydrogen + 1 sulphur + 4 oxygen = 7 atoms, so 1 mol of H₂SO₄ contains 7 mol of atoms.",
        why: { B: "3 counts the kinds of element, not the atoms.", C: "4 counts only the oxygen atoms." },
      }, 2 + 1 + 4),
      num({
        t: "stoichiometry",
        stem: "What is the mass of 3.01 × 10²³ molecules of carbon(IV) oxide? [C = 12, O = 16; Avogadro constant = 6.02 × 10²³ mol⁻¹]",
        o: ["22 g", "44 g", "11 g", "88 g"], ans: 0, d: 2,
        e: "Moles = number of molecules/Avogadro constant = 3.01 × 10²³/6.02 × 10²³ = 0.5 mol. Molar mass of CO₂ = 12 + 2(16) = 44 g mol⁻¹. Mass = 0.5 × 44 = 22 g.",
        why: { B: "44 g is the mass of a whole mole (6.02 × 10²³ molecules).", D: "88 g multiplies by 2 instead of halving." },
      }, (3.01e23 / 6.02e23) * (12 + 2 * 16)),
      num({
        t: "stoichiometry",
        stem: "5.85 g of sodium chloride is dissolved in water and made up to 500 cm³ of solution. What is the concentration of the solution? [Na = 23, Cl = 35.5]",
        o: ["0.20 mol dm⁻³", "0.10 mol dm⁻³", "0.05 mol dm⁻³", "2.0 mol dm⁻³"], ans: 0, d: 2,
        e: "Molar mass of NaCl = 23 + 35.5 = 58.5 g mol⁻¹, so moles = 5.85/58.5 = 0.10 mol. Volume = 500 cm³ = 0.500 dm³. Concentration = 0.10/0.500 = 0.20 mol dm⁻³.",
        why: { B: "0.10 is the number of moles; it must be divided by the volume in dm³.", C: "0.05 multiplies by 0.5 dm³ instead of dividing." },
      }, 5.85 / (23 + 35.5) / (500 / 1000)),
      (() => {
        const c = 85.7 / 12, h = 14.3 / 1, r = Math.round(h / c);
        return is({
          t: "stoichiometry",
          stem: "A hydrocarbon contains 85.7% carbon and 14.3% hydrogen by mass. What is its empirical formula? [H = 1, C = 12]",
          o: [`CH${sub(r)}`, "CH₃", "CH", "C₂H₅"], ans: 0, d: 2,
          e: "Divide each percentage by the relative atomic mass: C = 85.7/12 = 7.14; H = 14.3/1 = 14.3. Divide by the smaller value: C = 7.14/7.14 = 1, H = 14.3/7.14 = 2.0. The empirical formula is CH₂.",
          why: { B: "CH₃ would contain 20% hydrogen by mass.", C: "CH would contain only about 7.7% hydrogen by mass." },
        }, "CH₂");
      })(),
      {
        t: "stoichiometry",
        stem: "Pure water from a well in Kano and pure water from a borehole in Enugu both contain hydrogen and oxygen in the mass ratio 1 : 8. This illustrates the law of",
        o: ["definite (constant) proportions", "conservation of mass", "multiple proportions", "combining volumes"], ans: 0, d: 1,
        e: "The law of definite (constant) proportions states that a pure compound always contains the same elements combined in the same proportion by mass, wherever it comes from or however it is made.",
        why: { B: "Conservation of mass is about total mass staying the same during a reaction.", C: "Multiple proportions compares two different compounds of the same elements, such as CO and CO₂." },
      },
      approx({
        t: "stoichiometry",
        stem: "Under the same conditions, 100 cm³ of oxygen takes 40 s to diffuse through a small hole. How long will 100 cm³ of methane, CH₄, take? [H = 1, C = 12, O = 16]",
        o: ["28.3 s", "56.6 s", "20.0 s", "80.0 s"], ans: 0, d: 3,
        e: "By Graham's law, the time taken is proportional to √(molar mass). t(CH₄) = t(O₂) × √(16/32) = 40 × √0.5 = 40 × 0.707 = 28.3 s. Methane is lighter, so it diffuses faster.",
        why: { B: "56.6 s inverts the ratio; the lighter gas takes less time, not more.", C: "20.0 s uses the ratio of the molar masses without the square root." },
      }, 40 * Math.sqrt(16 / 32), 0.05),
      num({
        t: "stoichiometry",
        stem: "1.2 g of carbon burns completely in excess oxygen: C + O₂ → CO₂. What mass of carbon(IV) oxide is formed? [C = 12, O = 16]",
        o: ["4.4 g", "2.8 g", "3.2 g", "44 g"], ans: 0, d: 1,
        e: "Moles of C = 1.2/12 = 0.1 mol, which gives 0.1 mol CO₂ (1 : 1). Mass = 0.1 × 44 = 4.4 g.",
        why: { B: "2.8 g would be the mass of carbon(II) oxide, CO (0.1 × 28).", C: "3.2 g is the mass of oxygen used, not of the product." },
      }, (1.2 / 12) * 44),
      num({
        t: "stoichiometry",
        stem: "A gas mixture contains 0.2 mol of nitrogen and 0.3 mol of oxygen at a total pressure of 100 kPa. What is the partial pressure of the oxygen?",
        o: ["60 kPa", "40 kPa", "30 kPa", "100 kPa"], ans: 0, d: 3,
        e: "By Dalton's law of partial pressures, each gas contributes in proportion to its mole fraction. Mole fraction of O₂ = 0.3/(0.2 + 0.3) = 0.6. Partial pressure = 0.6 × 100 = 60 kPa.",
        why: { B: "40 kPa is the partial pressure of the nitrogen.", C: "30 kPa uses 0.3 directly as the fraction, ignoring the total of 0.5 mol." },
      }, (0.3 / (0.2 + 0.3)) * 100),
      num({
        t: "stoichiometry",
        stem: "What is the percentage by mass of oxygen in calcium trioxocarbonate(IV), CaCO₃? [C = 12, O = 16, Ca = 40]",
        o: ["48%", "16%", "40%", "12%"], ans: 0, d: 2,
        e: "Molar mass of CaCO₃ = 40 + 12 + 3(16) = 100. Mass of oxygen = 48. Percentage = 48/100 × 100 = 48%.",
        why: { B: "16% counts only one of the three oxygen atoms.", C: "40% is the percentage of calcium." },
      }, (100 * 3 * 16) / (40 + 12 + 3 * 16)),

      // acids-bases-and-salts
      {
        t: "acids-bases-and-salts",
        stem: "Which of the following is a strong alkali?",
        o: ["potassium hydroxide", "aqueous ammonia", "calcium trioxocarbonate(IV)", "magnesium oxide"], ans: 0, d: 1,
        e: "An alkali is a soluble base. Potassium hydroxide dissolves readily and ionises completely in water, giving a high concentration of OH⁻ ions, so it is a strong alkali.",
        why: { B: "Aqueous ammonia ionises only partly, so it is a weak alkali.", D: "Magnesium oxide is a base but is almost insoluble, so it is not an alkali." },
      },
      {
        t: "acids-bases-and-salts",
        stem: "Antacid tablets used to relieve indigestion caused by excess stomach acid often contain",
        o: ["magnesium hydroxide", "sodium chloride", "ethanoic acid", "calcium chloride"], ans: 0, d: 1,
        e: "Magnesium hydroxide is a mild base. It neutralises excess hydrochloric acid in the stomach: Mg(OH)₂ + 2HCl → MgCl₂ + 2H₂O.",
        why: { B: "Sodium chloride is a neutral salt and cannot neutralise acid.", C: "Ethanoic acid is an acid and would add to the problem." },
      },
      {
        t: "acids-bases-and-salts",
        stem: "Which of the following oxides dissolves in water to form an acidic solution?",
        o: ["sulphur(IV) oxide", "sodium oxide", "calcium oxide", "carbon(II) oxide"], ans: 0, d: 1,
        e: "Non-metal oxides such as SO₂ are acidic. Sulphur(IV) oxide dissolves in water to form trioxosulphate(IV) acid: SO₂ + H₂O → H₂SO₃.",
        why: { B: "Sodium oxide is a basic oxide; it forms sodium hydroxide, an alkali.", D: "Carbon(II) oxide is a neutral oxide and does not form an acid." },
      },
      {
        t: "acids-bases-and-salts",
        stem: "Which of the following is a basic salt?",
        o: ["Zn(OH)Cl", "NaHSO₄", "NaCl", "KAl(SO₄)₂·12H₂O"], ans: 0, d: 2,
        e: "A basic salt still contains hydroxide ions, because the base was only partly neutralised. Zn(OH)Cl contains both OH⁻ and Cl⁻, so it is a basic salt.",
        why: { B: "NaHSO₄ contains replaceable hydrogen, so it is an acid salt.", D: "Potash alum contains two metal cations, so it is a double salt." },
      },
      num({
        t: "acids-bases-and-salts",
        stem: "20.0 cm³ of 1.0 mol dm⁻³ sodium hydroxide is neutralised with dilute hydrochloric acid, and the solution is evaporated to dryness. What mass of sodium chloride is obtained? [Na = 23, Cl = 35.5]",
        o: ["1.17 g", "0.80 g", "2.34 g", "11.7 g"], ans: 0, d: 2,
        e: "Moles of NaOH = 1.0 × 20.0/1000 = 0.020 mol. NaOH + HCl → NaCl + H₂O, so 0.020 mol NaCl forms. Mass = 0.020 × 58.5 = 1.17 g.",
        why: { B: "0.80 g is the mass of the sodium hydroxide used, not of the salt.", D: "11.7 g comes from a decimal slip when converting 20.0 cm³ to dm³." },
      }, (20.0 / 1000) * 1.0 * (23 + 35.5)),
      approx({
        t: "acids-bases-and-salts",
        stem: "10 cm³ of hydrochloric acid of pH 2 is diluted with distilled water to 1000 cm³. What is the pH of the diluted solution?",
        o: ["4", "3", "2", "12"], ans: 0, d: 3,
        e: "pH 2 means [H⁺] = 10⁻² mol dm⁻³. Diluting 10 cm³ to 1000 cm³ is a 100-fold dilution, so [H⁺] = 10⁻²/100 = 10⁻⁴ mol dm⁻³ and pH = 4. Each tenfold dilution of a strong acid raises the pH by 1.",
        why: { B: "3 corresponds to a tenfold dilution only.", C: "Dilution lowers [H⁺], so the pH must change." },
      }, -Math.log10(1e-2 * 10 / 1000), 1e-6),
      {
        t: "acids-bases-and-salts",
        stem: "A white solid is warmed with sodium hydroxide solution and gives off a gas that turns damp red litmus paper blue. The solid contains",
        o: ["ammonium ions", "chloride ions", "trioxocarbonate(IV) ions", "sodium ions"], ans: 0, d: 2,
        e: "Ammonium salts react with alkalis on warming to release ammonia: NH₄⁺ + OH⁻ → NH₃ + H₂O. Ammonia is the common alkaline gas, so it turns damp red litmus blue.",
        why: { B: "Chloride ions do not give off a gas with sodium hydroxide.", C: "Trioxocarbonate(IV) ions give CO₂ with acids, not an alkaline gas with alkalis." },
      },
      num({
        t: "acids-bases-and-salts",
        stem: "What volume of 0.50 mol dm⁻³ potassium hydroxide solution is needed to neutralise 0.98 g of tetraoxosulphate(VI) acid, H₂SO₄? [H = 1, O = 16, S = 32]",
        o: ["40 cm³", "20 cm³", "80 cm³", "4.0 cm³"], ans: 0, d: 3,
        e: "Moles of H₂SO₄ = 0.98/98 = 0.010 mol. H₂SO₄ + 2KOH → K₂SO₄ + 2H₂O, so KOH needed = 0.020 mol. Volume = 0.020/0.50 = 0.040 dm³ = 40 cm³.",
        why: { B: "20 cm³ uses a 1 : 1 ratio, but H₂SO₄ is dibasic.", C: "80 cm³ uses a 1 : 4 ratio instead of 1 : 2." },
      }, ((0.98 / 98) * 2) / 0.50 * 1000),
      {
        t: "acids-bases-and-salts",
        stem: "Which of the following salts is insoluble in water?",
        o: ["silver chloride", "sodium chloride", "potassium trioxonitrate(V)", "ammonium chloride"], ans: 0, d: 1,
        e: "Most chlorides are soluble, but silver chloride (and lead(II) chloride in cold water) are exceptions. AgCl forms as a white precipitate when Ag⁺ and Cl⁻ ions meet.",
        why: { B: "All common sodium salts are soluble in water.", C: "All trioxonitrate(V) salts are soluble." },
      },
      {
        t: "acids-bases-and-salts",
        stem: "When concentrated tetraoxosulphate(VI) acid is added to sugar, the sugar turns into a black mass of carbon. In this reaction the acid acts as",
        o: ["a dehydrating agent", "a reducing agent", "a precipitating agent", "a catalyst"], ans: 0, d: 2,
        e: "Concentrated H₂SO₄ removes the elements of water (hydrogen and oxygen in the ratio 2 : 1) from sugar, C₁₂H₂₂O₁₁ → 12C + 11H₂O, leaving black carbon. Removing water like this is dehydration.",
        why: { B: "Concentrated H₂SO₄ is an oxidising agent, not a reducing agent, and here it removes water.", D: "The acid is used up as it absorbs the water, so it is not a catalyst." },
      },

      // redox-and-electrolysis
      {
        t: "redox-and-electrolysis",
        stem: "During electrolysis, oxidation takes place at the",
        o: ["anode", "cathode", "salt bridge", "external wire"], ans: 0, d: 1,
        e: "Negative ions move to the anode (the positive electrode) and lose electrons there. Loss of electrons is oxidation, so oxidation always happens at the anode and reduction at the cathode.",
        why: { B: "At the cathode, ions gain electrons, which is reduction.", D: "The external wire carries electrons; no chemical change happens there." },
      },
      is({
        t: "redox-and-electrolysis",
        stem: "What is the oxidation number of oxygen in an oxygen molecule, O₂?",
        o: ["0", "−2", "+2", "−1"], ans: 0, d: 1,
        e: "Atoms in an uncombined element have an oxidation number of zero, because both atoms in O₂ are identical and neither gains electrons from the other.",
        why: { B: "−2 is oxygen's usual oxidation number in compounds such as oxides.", D: "−1 is the oxidation number of oxygen in peroxides such as H₂O₂." },
      }, ox(0)),
      is({
        t: "redox-and-electrolysis",
        stem: "What is the oxidation number of iron in the hexacyanoferrate(II) ion, [Fe(CN)₆]⁴⁻? (The cyanide ion, CN⁻, has a charge of −1.)",
        o: ["+2", "+3", "−4", "+6"], ans: 0, d: 3,
        e: "The total charge of the complex is −4. Six cyanide ions contribute 6 × (−1) = −6. So Fe + (−6) = −4, giving Fe = +2, which matches the (II) in the name.",
        why: { B: "+3 is the oxidation number in the related [Fe(CN)₆]³⁻ ion.", C: "−4 is the overall charge of the ion, not the oxidation number of iron." },
      }, ox(-4 + 6)),
      {
        t: "redox-and-electrolysis",
        stem: "Copper(II) tetraoxosulphate(VI) solution is electrolysed for a long time using carbon (inert) electrodes. What happens to the solution?",
        o: ["Its blue colour fades and it becomes acidic.", "Its blue colour deepens and it becomes alkaline.", "Its colour and concentration stay the same.", "It turns green as iron ions form."], ans: 0, d: 2,
        e: "Cu²⁺ ions are discharged as copper at the cathode, so the blue colour fades. At the inert anode, OH⁻ ions from water are discharged as oxygen, leaving H⁺ and SO₄²⁻ ions behind, so the solution becomes tetraoxosulphate(VI) acid.",
        why: { B: "Cu²⁺ ions are removed, so the colour cannot deepen, and H⁺ ions build up.", C: "The colour stays the same only when a copper anode replaces the copper ions." },
      },
      num({
        t: "redox-and-electrolysis",
        stem: "How many coulombs of electricity are needed to liberate 0.50 mol of chlorine gas, Cl₂, during electrolysis? [F = 96 500 C mol⁻¹]",
        o: ["96 500 C", "48 250 C", "193 000 C", "9650 C"], ans: 0, d: 2,
        e: "2Cl⁻ → Cl₂ + 2e⁻, so each mole of Cl₂ needs 2 mol of electrons (2 F). For 0.50 mol: 0.50 × 2 = 1.0 F = 96 500 C.",
        why: { B: "48 250 C uses one electron per Cl₂ molecule; two are needed.", C: "193 000 C is the charge for a whole mole of Cl₂." },
      }, 0.50 * 2 * 96500),
      {
        t: "redox-and-electrolysis",
        stem: "Hot copper(II) oxide reacts with hydrogen: CuO + H₂ → Cu + H₂O. Which substance is the reducing agent?",
        o: ["hydrogen", "copper(II) oxide", "copper", "water"], ans: 0, d: 1,
        e: "Hydrogen removes oxygen from copper(II) oxide, reducing it to copper, and is itself oxidised to water. The substance that brings about reduction (and is oxidised) is the reducing agent: hydrogen.",
        why: { B: "Copper(II) oxide is reduced; it is the oxidising agent.", C: "Copper is the product formed by reduction." },
      },
      {
        t: "redox-and-electrolysis",
        stem: "Faraday's first law of electrolysis states that the mass of a substance liberated at an electrode is directly proportional to the",
        o: ["quantity of electricity passed", "charge on its ion", "volume of the electrolyte", "surface area of the electrodes"], ans: 0, d: 2,
        e: "Faraday's first law: mass liberated ∝ quantity of electricity (Q = It). Doubling the current or the time doubles the mass deposited.",
        why: { B: "The charge on the ion appears in Faraday's second law, and the mass is inversely related to it.", C: "The volume of electrolyte does not set the mass deposited." },
      },
      {
        t: "redox-and-electrolysis",
        stem: "In the reaction 2Fe³⁺ + 2I⁻ → 2Fe²⁺ + I₂, which change is an oxidation?",
        o: ["I⁻ to I₂", "Fe³⁺ to Fe²⁺", "I₂ to I⁻", "Fe²⁺ to Fe³⁺"], ans: 0, d: 2,
        e: "Iodide ions lose electrons, 2I⁻ → I₂ + 2e⁻, and their oxidation number rises from −1 to 0, so this is oxidation. Fe³⁺ gains those electrons and is reduced to Fe²⁺.",
        why: { B: "Fe³⁺ gains an electron (+3 → +2), which is reduction.", D: "Fe²⁺ is a product here; the reaction does not change it back to Fe³⁺." },
      },
      {
        t: "redox-and-electrolysis",
        stem: "Chlorine water is added to colourless potassium bromide solution, which turns orange-brown: Cl₂ + 2KBr → 2KCl + Br₂. This shows that",
        o: ["chlorine is a stronger oxidising agent than bromine", "bromine is a stronger oxidising agent than chlorine", "chlorine is reduced to bromine", "potassium is oxidised by chlorine"], ans: 0, d: 2,
        e: "Chlorine takes electrons from bromide ions (2Br⁻ → Br₂ + 2e⁻), releasing orange-brown bromine. Chlorine can oxidise bromide, so it is the stronger oxidising agent; oxidising power falls down Group VII.",
        why: { B: "If bromine were stronger, chlorine could not displace it.", D: "Potassium stays as K⁺ throughout; it is a spectator ion." },
      },
      num({
        t: "redox-and-electrolysis",
        stem: "Two cells are joined in series. One contains copper(II) tetraoxosulphate(VI) solution with copper electrodes; the other contains dilute tetraoxosulphate(VI) acid with platinum electrodes. When 0.32 g of copper is deposited in the first cell, what volume of hydrogen at s.t.p. is liberated in the second? [Cu = 64; molar volume = 22 400 cm³ at s.t.p.]",
        o: ["112 cm³", "224 cm³", "56 cm³", "448 cm³"], ans: 0, d: 3,
        e: "Moles of Cu = 0.32/64 = 0.005 mol. Cu²⁺ + 2e⁻ → Cu, so 0.01 mol of electrons passed. In the second cell, 2H⁺ + 2e⁻ → H₂, so 0.01 mol of electrons gives 0.005 mol H₂. Volume = 0.005 × 22 400 = 112 cm³.",
        why: { B: "224 cm³ assumes one mole of H₂ per mole of electrons.", C: "56 cm³ assumes four electrons are needed per H₂ molecule." },
      }, (0.32 / 64) * 2 / 2 * 22400),

      // organic-chemistry
      {
        t: "organic-chemistry",
        stem: "Successive members of a homologous series differ from each other by",
        o: ["a CH₂ unit", "a CH₃ unit", "an H₂ unit", "a C₂H₄ unit"], ans: 0, d: 1,
        e: "Each member of a homologous series has one more –CH₂– group than the member before it, e.g. methane CH₄, ethane C₂H₆, propane C₃H₈. Their molar masses therefore increase by 14 each time.",
        why: { B: "Adding CH₃ would give an odd number of hydrogens and not a valid next member.", D: "C₂H₄ is two steps, from one member to the member after next." },
      },
      {
        t: "organic-chemistry",
        stem: "Which gas, released by ripening fruits, is used to speed up the ripening of unripe plantain and bananas?",
        o: ["ethene", "methane", "ethyne", "ethane"], ans: 0, d: 1,
        e: "Ethene, C₂H₄, is a natural plant hormone given off by ripening fruit, and it triggers ripening in nearby fruit. That is why unripe plantain ripens faster when stored with ripe fruit.",
        why: { B: "Methane is a fuel gas with no ripening effect.", C: "Ethyne (from calcium dicarbide) is sometimes misused for ripening, but the natural ripening hormone is ethene." },
      },
      {
        t: "organic-chemistry",
        stem: "A saturated hydrocarbon has an unbranched chain of five carbon atoms joined only by single bonds. What is its IUPAC name?",
        o: ["pentane", "butane", "pentene", "hexane"], ans: 0, d: 1,
        e: "The stem 'pent-' means five carbon atoms and '-ane' means only single bonds, so it is pentane, C₅H₁₂.",
        why: { B: "Butane has only four carbon atoms.", C: "Pentene would contain a C=C double bond." },
      },
      {
        t: "organic-chemistry",
        stem: "Ethene reacts with steam at high temperature and pressure in the presence of a tetraoxophosphate(V) acid catalyst. What is the product?",
        o: ["ethanol", "ethanal", "ethanoic acid", "ethane"], ans: 0, d: 2,
        e: "Steam adds across the C=C double bond (hydration): CH₂=CH₂ + H₂O → CH₃CH₂OH. This is the main industrial route to ethanol from petroleum.",
        why: { B: "Ethanal would need oxidation, not the addition of water.", D: "Ethane forms by adding hydrogen, not water." },
      },
      {
        t: "organic-chemistry",
        stem: "Starch is completely hydrolysed by boiling with dilute acid. What is the final product?",
        o: ["glucose", "ethanol", "sucrose", "glycerol"], ans: 0, d: 2,
        e: "Starch is a natural polymer made of many glucose units joined together. Complete acid hydrolysis breaks all the links between the units, leaving glucose, C₆H₁₂O₆.",
        why: { B: "Ethanol comes from fermenting glucose, a separate step that needs yeast.", D: "Glycerol (propane-1,2,3-triol) comes from hydrolysing fats and oils, not starch." },
      },
      {
        t: "organic-chemistry",
        stem: "Which compound gives a silver mirror when warmed with Tollens' reagent (ammoniacal silver trioxonitrate(V))?",
        o: ["ethanal", "propanone", "ethanol", "ethanoic acid"], ans: 0, d: 3,
        e: "Alkanals (aldehydes) are easily oxidised. Ethanal reduces Ag⁺ ions in Tollens' reagent to silver metal, which coats the inside of the tube as a mirror, while ethanal is oxidised to ethanoic acid.",
        why: { B: "Propanone is a ketone and is not oxidised by Tollens' reagent.", D: "Ethanoic acid is already fully oxidised and gives no mirror." },
      },
      num({
        t: "organic-chemistry",
        stem: "How many moles of oxygen are needed to burn 1 mol of ethanol, C₂H₅OH, completely to carbon(IV) oxide and water?",
        o: ["3", "2", "3.5", "6"], ans: 0, d: 2,
        e: "C₂H₅OH + 3O₂ → 2CO₂ + 3H₂O. The products contain 2(2) + 3(1) = 7 oxygen atoms; ethanol supplies 1, so 6 O atoms (3 mol O₂) must come from oxygen.",
        why: { C: "3.5 is the figure for ethane, which has no oxygen of its own.", D: "6 is the number of oxygen atoms, not O₂ molecules." },
      }, (2 * 2 + 6 / 2 - 1) / 2),
      (() => {
        const x = Math.round(0.3 / 0.1), y = Math.round((2 * 0.3) / 0.1);
        return is({
          t: "organic-chemistry",
          stem: "0.1 mol of a hydrocarbon burns completely to give 0.3 mol of carbon(IV) oxide and 0.3 mol of water. What is its molecular formula?",
          o: [`C${sub(x)}H${sub(y)}`, "C₃H₈", "C₆H₆", "C₃H₃"], ans: 0, d: 3,
          e: "Each mole of hydrocarbon gives 0.3/0.1 = 3 mol CO₂, so it has 3 carbon atoms. Each mole gives 3 mol H₂O, containing 3 × 2 = 6 mol of H atoms, so it has 6 hydrogen atoms. The formula is C₃H₆.",
          why: { B: "C₃H₈ would give 4 mol of water per mole of hydrocarbon.", D: "C₃H₃ forgets that each water molecule contains two hydrogen atoms." },
        }, "C₃H₆");
      })(),
      {
        t: "organic-chemistry",
        stem: "Which of the following is a natural polymer?",
        o: ["starch", "nylon", "polythene", "poly(chloroethene)"], ans: 0, d: 1,
        e: "Starch is made by plants such as cassava and yam by joining many glucose units together, so it is a natural polymer. Proteins and natural rubber are other examples.",
        why: { B: "Nylon is a synthetic condensation polymer made in factories.", C: "Polythene is a synthetic addition polymer made from ethene." },
      },
      {
        t: "organic-chemistry",
        stem: "Soapless detergents lather well in hard water, whereas soap forms scum. This is because",
        o: ["the calcium and magnesium salts of soapless detergents are soluble in water", "soapless detergents contain no carbon atoms", "soap reacts with the sodium ions present in hard water", "soapless detergents remove hardness by precipitating calcium ions"], ans: 0, d: 3,
        e: "Hard water contains Ca²⁺ and Mg²⁺ ions. These react with soap to form insoluble calcium and magnesium salts (scum), wasting the soap. The calcium and magnesium salts of soapless detergents are soluble, so no scum forms and the detergent still lathers.",
        why: { B: "Soapless detergents are organic compounds with long carbon chains.", C: "Hardness is caused by calcium and magnesium ions, not sodium ions." },
      },
    ],
    free: FREE,
  },
};
