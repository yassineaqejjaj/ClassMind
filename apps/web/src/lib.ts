import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export const cn = (...i: ClassValue[]) => twMerge(clsx(i));
export const pct = (r: number) => `${Math.round(r * 100)} %`;
// Vocabulaire de la maquette : on parle de compétences à retravailler, jamais d'élèves en échec.
export const LEVEL_LABEL: Record<string, string> = {
  acquise: "Maîtrisé",
  en_cours: "En progrès",
  à_retravailler: "À retravailler",
};
export const LEVEL_FILL: Record<string, string> = {
  acquise: "#2DD4BF",
  en_cours: "#6366F1",
  à_retravailler: "#F59E0B",
};
