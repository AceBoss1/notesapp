// Importing publications (lib/publications-import.ts): BibTeX (as Google Scholar exports it), Crossref and ORCID, and the merge that
// never adds a paper twice. Uses saved responses, so no network. Run: npm run test:sites-import → "ALL OK".
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { bibAuthors, cleanDoi, cleanOrcid, delatex, fromBibtex, fromCrossref, fromOrcidBulk, mergePublications, orcidPutCodes, parseBibtex } from "../../lib/publications-import";

const fx = (n: string) => JSON.parse(readFileSync(new URL(`./fixtures/${n}`, import.meta.url), "utf8"));

// BibTeX, as Google Scholar's "Export → BibTeX" writes it, plus the awkward bits.
const bib = `
@comment{exported from Google Scholar}
@article{adeyemi2026graph,
  title={Graph learning for drug repurposing in sickle cell disease (SCD)},
  author={Adeyemi, Kemi and Bello, Tunde and Obi, Ada},
  journal={Nature Machine Intelligence},
  volume={8}, number={2}, pages={101--115},
  year={2026},
  publisher={Nature Publishing Group}
}
@inproceedings{obi2025fair,
  title = "Fairness audits for {N}igerian hospital data",
  author = "Obi, Ada and Adeyemi, Kemi and others",
  booktitle = {NeurIPS Workshop on ML for Health},
  year = 2025,
  doi = {https://doi.org/10.5555/ABC.123}
}
@misc{caf{\\'e}, title={Caf{\\'e} M{\\"u}ller \\& friends}, author={M{\\"u}ller, J{\\"o}rg}, year={2024}, url={http://insecure.example}}
@phdthesis{k2024, title={Small data}, author={Kemi Adeyemi}, school={University of Lagos}, year={2024}}
`;
assert.equal(parseBibtex(bib).length, 4, "@comment is skipped");
const b = fromBibtex(bib);
assert.deepEqual(b[0], { title: "Graph learning for drug repurposing in sickle cell disease (SCD)", authors: "Kemi Adeyemi, Tunde Bello, Ada Obi", venue: "Nature Machine Intelligence", year: "2026", url: "", note: "" });
assert.equal(b[1].authors, "Ada Obi, Kemi Adeyemi, et al."); assert.equal(b[1].title, "Fairness audits for Nigerian hospital data");
assert.equal(b[1].url, "https://doi.org/10.5555/ABC.123"); assert.equal(b[1].venue, "NeurIPS Workshop on ML for Health"); assert.equal(b[1].year, "2025");
assert.equal(b[2].title, "Café Müller & friends"); assert.equal(b[2].authors, "Jörg Müller"); assert.equal(b[2].url, "", "only https links");
assert.equal(b[3].venue, "University of Lagos"); assert.equal(b[3].authors, "Kemi Adeyemi");
assert.equal(delatex("pages 1--2"), "pages 1–2"); assert.equal(bibAuthors("Obi, A."), "A. Obi");
assert.deepEqual(fromBibtex("not a bib file"), []);

// DOI and ORCID iD checks
assert.equal(cleanDoi("doi:10.1038/nature14539"), "10.1038/nature14539"); assert.equal(cleanDoi("https://dx.doi.org/10.1038/x"), "10.1038/x"); assert.equal(cleanDoi("nope"), "");
assert.equal(cleanOrcid("https://orcid.org/0000-0002-1825-0097"), "0000-0002-1825-0097");
assert.equal(cleanOrcid("0000-0002-1825-0098"), "", "a wrong checksum");
assert.equal(cleanOrcid("0000-0002-1694-233x"), "0000-0002-1694-233X", "X as the checksum (ORCID's own example)");

// Crossref (a saved response for 10.1038/nature14539)
assert.deepEqual(fromCrossref(fx("crossref.json")), { title: "Deep learning", authors: "Yann LeCun, Yoshua Bengio, Geoffrey Hinton", venue: "Nature", year: "2015", url: "https://doi.org/10.1038/nature14539", note: "" });
assert.equal(fromCrossref({ message: {} }), null);

// ORCID (ORCID's own test record, 0000-0002-1825-0097)
assert.equal(orcidPutCodes(fx("orcid-works.json")).length, 6);
const o = fromOrcidBulk(fx("orcid-bulk.json"));
assert.equal(o.length, 6);
const plasmons = o.find((p) => p.title.startsWith("Bulk and surface plasmons"))!;
assert.equal(plasmons.venue, "IEEE Transactions on Plasma Science"); assert.equal(plasmons.year, "1987");
assert.equal(plasmons.authors, "Quinn, J.J., Carberry, J.S."); assert.equal(plasmons.url, "https://doi.org/10.1109/TPS.1987.4316723");
assert.ok(o.every((p) => p.url.startsWith("https://doi.org/")), "every work here has a DOI");

// Merging: by DOI or title, the member's own first, within the limit.
const mine = [{ title: "Deep Learning", authors: "me", venue: "", year: "", url: "", note: "Best paper" }];
const m = mergePublications(mine, [fromCrossref(fx("crossref.json"))!, ...b, b[0]], 4);
assert.equal(m.items[0].note, "Best paper", "the member's own entry stays as it is");
assert.equal(m.added, 3); assert.equal(m.skipped, 3, "Deep learning (same title), the repeat, and one over the limit");
assert.equal(mergePublications(m.items, [{ ...b[1], title: "Another title" }], 50).added, 0, "the same DOI under another title");
console.log("ALL OK");
