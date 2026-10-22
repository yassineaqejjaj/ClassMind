import { overview, parseCsv } from "./csv";

describe("parseCsv", () => {
  it("détecte le séparateur et ignore le BOM", () => {
    const p = parseCsv("﻿pseudonyme;Q1;Q2\nE-AAA11;2;1\nE-BBB22;;0\n");
    expect(p.headers).toEqual(["pseudonyme", "Q1", "Q2"]);
    expect(p.rows).toHaveLength(2);
  });
  it("gère les guillemets et les virgules dans les cellules", () => {
    const p = parseCsv('pseudonyme,Q1,Q1_erreur\nE-AAA11,"1,5","oubli, signe"\n');
    expect(p.rows[0]).toEqual(["E-AAA11", "1,5", "oubli, signe"]);
  });
});

describe("overview", () => {
  it("liste les questions (sans colonnes d'erreur) et les réponses vides", () => {
    const o = overview(parseCsv("pseudonyme,Q1,Q2,Q2_erreur\nE-AAA11,2,,\nE-BBB22,1,1,\n"));
    expect(o.questions).toEqual(["Q1", "Q2"]);
    expect(o.pseudonyms).toEqual(["E-AAA11", "E-BBB22"]);
    expect(o.empty).toEqual({ Q2: ["E-AAA11"] });
  });
  it("signale l'absence de colonne pseudonyme", () => {
    expect(overview(parseCsv("nom,Q1\nA,1\n")).pseudoIndex).toBe(-1);
  });
});
