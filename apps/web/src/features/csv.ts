export interface ParsedCsv {
  headers: string[];
  rows: string[][];
}

const META = /^(pseudonyme|pseudo|identifiant)$/i;

/** Lecture minimale d'un CSV (séparateur , ; ou tabulation, guillemets doubles). */
export function parseCsv(text: string): ParsedCsv {
  const clean = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const first = clean.split(/\r?\n/, 1)[0] ?? "";
  const delim = [";", "\t", ","].reduce(
    (best, d) => (first.split(d).length > first.split(best).length ? d : best),
    ",",
  );
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (quoted) {
      if (ch === '"' && clean[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delim) {
      row.push(cell.trim());
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && clean[i + 1] === "\n") i++;
      row.push(cell.trim());
      cell = "";
      if (row.some((c) => c !== "")) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell.trim());
  if (row.some((c) => c !== "")) rows.push(row);
  const [headers = [], ...body] = rows;
  return { headers, rows: body };
}

export interface CsvOverview {
  pseudoIndex: number;
  questions: string[];
  pseudonyms: string[];
  /** Cellules vides par question : pseudonymes concernés. */
  empty: Record<string, string[]>;
}

export function overview(csv: ParsedCsv): CsvOverview {
  const pseudoIndex = csv.headers.findIndex((h) => META.test(h));
  const questions = csv.headers.filter((h, i) => i !== pseudoIndex && h && !/_erreur$/i.test(h));
  const pseudonyms = pseudoIndex >= 0 ? csv.rows.map((r) => r[pseudoIndex] ?? "") : [];
  const empty: Record<string, string[]> = {};
  for (const q of questions) {
    const qi = csv.headers.indexOf(q);
    const who = csv.rows.filter((r) => (r[qi] ?? "") === "").map((r) => r[pseudoIndex] ?? "?");
    if (who.length) empty[q] = who;
  }
  return { pseudoIndex, questions, pseudonyms, empty };
}
