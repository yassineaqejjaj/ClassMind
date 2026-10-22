import { useMutation, useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  FileSpreadsheet,
  Upload,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button, Chip, Crumbs, ErrorBox, Field, inputClass } from "@/components/ui";
import { cn } from "@/lib";
import { overview, parseCsv, type ParsedCsv } from "@/features/csv";
import { api } from "@/services/api";

const STEPS = ["Fichier", "Association", "Résumé"];

export default function ImportCsv() {
  const id = Number(useParams().id);
  const nav = useNavigate();
  const comps = useQuery({ queryKey: ["competencies"], queryFn: api.competencies });
  const cls = useQuery({ queryKey: ["class", id], queryFn: () => api.classDetail(id) });
  const [step, setStep] = useState(1);
  const [file, setFile] = useState<File | null>(null);
  const [csv, setCsv] = useState<ParsedCsv | null>(null);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [map, setMap] = useState<
    Record<string, { competency_code: string; max_points: number; confirmed: boolean }>
  >({});
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const ov = useMemo(() => (csv ? overview(csv) : null), [csv]);

  async function load(f: File | null) {
    setFile(f);
    setCsv(null);
    if (!f) return;
    const parsed = parseCsv(await f.text());
    const o = overview(parsed);
    setCsv(parsed);
    setMap(
      Object.fromEntries(
        o.questions.map((q) => [q, { competency_code: "", max_points: 1, confirmed: false }]),
      ),
    );
    if (!title) setTitle(f.name.replace(/\.csv$/i, "").replace(/[_-]+/g, " "));
  }

  const readable =
    !!ov && ov.pseudoIndex >= 0 && ov.questions.length > 0 && ov.pseudonyms.length > 0;
  const questions = ov?.questions ?? [];
  const confirmed = questions.filter((q) => map[q]?.confirmed).length;
  const emptyCount = ov ? Object.values(ov.empty).reduce((n, l) => n + l.length, 0) : 0;
  const nComp = new Set(questions.map((q) => map[q]?.competency_code)).size;

  const imp = useMutation({
    mutationFn: () => {
      const fd = new FormData();
      fd.set("title", title);
      fd.set("held_on", date);
      fd.set(
        "mapping",
        JSON.stringify(
          questions.map((code) => ({
            code,
            competency_code: map[code].competency_code,
            max_points: map[code].max_points,
          })),
        ),
      );
      fd.set("file", file!);
      return api.importAssessment(id, fd);
    },
    onSuccess: (r) => nav(`/evaluations/${r.assessment_id}`),
  });

  const stepState = (n: number) => (n < step ? "Terminé" : n === step ? "En cours" : "À faire");

  return (
    <div className="flex flex-col gap-7">
      <header className="flex min-h-[48px] flex-wrap items-center justify-between gap-4">
        <Crumbs
          items={[
            { label: "Mes classes", to: "/classes" },
            { label: cls.data?.name ?? "Classe", to: `/classes/${id}` },
            "Importer",
          ]}
        />
        <Chip>Classe active · {cls.data?.name} · Mathématiques</Chip>
      </header>
      <section className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold leading-tight tracking-tight md:text-[34px]">
          Importer les résultats de l'évaluation
        </h1>
        <p className="text-base text-muted">
          Trois étapes. Rien n'est enregistré avant votre validation.
        </p>
      </section>

      <ol
        aria-label="Étapes de l'import"
        className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(min(220px,100%),1fr))] gap-3 p-0"
      >
        {STEPS.map((label, i) => {
          const n = i + 1;
          const done = n < step;
          const cur = n === step;
          return (
            <li
              key={label}
              aria-current={cur ? "step" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-[14px] border px-4 py-3.5",
                cur
                  ? "border-[#C7D2FE] bg-[#FAFBFF]"
                  : done
                    ? "border-[#99F6E4] bg-[#F0FDFA]"
                    : "border-line bg-white",
              )}
            >
              <span
                className={cn(
                  "flex h-8 w-8 flex-none items-center justify-center rounded-full text-sm font-bold",
                  done
                    ? "bg-teal-soft text-teal-deep"
                    : cur
                      ? "bg-brand text-white"
                      : "bg-line text-slate-700",
                )}
              >
                {done ? <Check size={16} aria-hidden="true" /> : n}
              </span>
              <span className="flex flex-col">
                <span className="text-[15px] font-bold text-ink">{label}</span>
                <span className="text-xs text-muted">{stepState(n)}</span>
              </span>
            </li>
          );
        })}
      </ol>

      {step === 1 && (
        <section className="flex flex-col gap-6 rounded-2xl border border-line bg-white p-8 shadow-sm">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Titre de l'évaluation"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <Field
              label="Date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setOver(true);
            }}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setOver(false);
              void load(e.dataTransfer.files[0] ?? null);
            }}
            className={cn(
              "flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-[#A5B4FC] px-6 py-10 text-center",
              over ? "bg-brand-soft" : "bg-[#F5F7FF]",
            )}
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-soft text-brand-deep">
              <Upload size={28} aria-hidden="true" />
            </div>
            <p className="text-lg font-semibold text-ink">Déposez votre fichier CSV ici</p>
            <p className="max-w-xl text-sm text-muted">
              Une ligne par élève, une colonne par question. Les noms ne sont pas nécessaires :
              utilisez les identifiants pseudonymes.
            </p>
            <input
              ref={input}
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              aria-label="Fichier CSV"
              tabIndex={-1}
              onChange={(e) => void load(e.target.files?.[0] ?? null)}
            />
            <Button type="button" variant="outline" onClick={() => input.current?.click()}>
              Choisir un fichier
            </Button>
          </div>
          {file && csv && ov && (
            <div
              role="status"
              className={cn(
                "flex flex-wrap items-center gap-x-4 gap-y-3 rounded-[14px] border px-5 py-4",
                readable ? "border-[#99F6E4] bg-[#F0FDFA]" : "border-amber/40 bg-amber-soft",
              )}
            >
              <FileSpreadsheet
                size={22}
                className={readable ? "text-teal-deep" : "text-amber-deep"}
                aria-hidden="true"
              />
              <div className="flex min-w-[240px] flex-1 flex-col">
                <span className="text-[15px] font-semibold text-ink">{file.name}</span>
                <span className="text-[13px] text-muted">
                  {readable
                    ? `${ov.pseudonyms.length} lignes · ${ov.questions.length} questions détectées · identifiants ${ov.pseudonyms[0]} à ${ov.pseudonyms[ov.pseudonyms.length - 1]}`
                    : "Colonne « pseudonyme » ou questions introuvables : vérifiez l'en-tête du fichier."}
                </span>
              </div>
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold",
                  readable ? "bg-teal-soft text-teal-deep" : "bg-white text-amber-deep",
                )}
              >
                {readable ? (
                  <CheckCircle2 size={14} aria-hidden="true" />
                ) : (
                  <AlertTriangle size={14} aria-hidden="true" />
                )}
                {readable ? "Fichier lisible" : "Fichier à corriger"}
              </span>
            </div>
          )}
          <div className="flex justify-end">
            <Button disabled={!readable || !title.trim()} onClick={() => setStep(2)}>
              Continuer vers l'association
              <ArrowRight size={18} aria-hidden="true" />
            </Button>
          </div>
        </section>
      )}

      {step === 2 && (
        <section className="flex flex-col gap-5 rounded-2xl border border-line bg-white p-8 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-col gap-1">
              <h2 className="text-xl font-bold">Associer chaque question à une compétence</h2>
              <p className="text-sm text-muted">
                Choisissez la compétence évaluée par chaque question, puis confirmez.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold text-ink" aria-live="polite">
                {confirmed} sur {questions.length} confirmées
              </span>
              <Button
                variant="outline"
                className="min-h-[40px]"
                onClick={() =>
                  setMap(
                    Object.fromEntries(
                      Object.entries(map).map(([k, v]) => [
                        k,
                        { ...v, confirmed: !!v.competency_code },
                      ]),
                    ),
                  )
                }
              >
                Tout confirmer
              </Button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left">
              <thead>
                <tr className="text-xs font-semibold uppercase tracking-[0.06em] text-muted">
                  <th scope="col" className="w-20 pb-2.5 pl-1">
                    Question
                  </th>
                  <th scope="col" className="pb-2.5">
                    Compétence
                  </th>
                  <th scope="col" className="w-28 pb-2.5">
                    Barème
                  </th>
                  <th scope="col" className="w-64 pb-2.5">
                    Statut
                  </th>
                </tr>
              </thead>
              <tbody>
                {questions.map((q) => {
                  const m = map[q];
                  const set = (patch: Partial<typeof m>) =>
                    setMap({ ...map, [q]: { ...m, ...patch } });
                  return (
                    <tr key={q} className="border-t border-[#EEF2F7]">
                      <th scope="row" className="py-3 pl-1 text-[15px] font-bold text-ink">
                        {q}
                      </th>
                      <td className="py-3 pr-4">
                        <label className="sr-only" htmlFor={`c-${q}`}>
                          Compétence de la question {q}
                        </label>
                        <select
                          id={`c-${q}`}
                          className={inputClass}
                          value={m.competency_code}
                          onChange={(e) =>
                            set({ competency_code: e.target.value, confirmed: false })
                          }
                        >
                          <option value="">Choisir…</option>
                          {comps.data?.map((k) => (
                            <option key={k.code} value={k.code}>
                              {k.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-3 pr-4">
                        <label className="sr-only" htmlFor={`p-${q}`}>
                          Barème de la question {q}
                        </label>
                        <input
                          id={`p-${q}`}
                          type="number"
                          min={0.5}
                          step={0.5}
                          className={inputClass}
                          value={m.max_points}
                          onChange={(e) =>
                            set({ max_points: Number(e.target.value), confirmed: false })
                          }
                        />
                      </td>
                      <td className="py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold",
                              m.confirmed
                                ? "bg-teal-soft text-teal-deep"
                                : "bg-amber-soft text-amber-deep",
                            )}
                          >
                            {m.confirmed ? (
                              <CheckCircle2 size={14} aria-hidden="true" />
                            ) : (
                              <AlertTriangle size={14} aria-hidden="true" />
                            )}
                            {m.confirmed ? "Confirmé" : "À confirmer"}
                          </span>
                          <Button
                            variant="outline"
                            className="min-h-[40px]"
                            disabled={!m.competency_code || m.max_points <= 0}
                            aria-pressed={m.confirmed}
                            onClick={() => set({ confirmed: !m.confirmed })}
                          >
                            {m.confirmed ? "Modifier" : "Confirmer"}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <Button variant="outline" onClick={() => setStep(1)}>
              Retour
            </Button>
            <Button disabled={confirmed < questions.length} onClick={() => setStep(3)}>
              Vérifier le résumé
              <ArrowRight size={18} aria-hidden="true" />
            </Button>
          </div>
        </section>
      )}

      {step === 3 && ov && (
        <section className="flex flex-col gap-6 rounded-2xl border border-line bg-white p-8 shadow-sm">
          <h2 className="text-xl font-bold">Résumé avant validation</h2>
          <dl className="m-0 grid grid-cols-[repeat(auto-fit,minmax(min(180px,100%),1fr))] gap-4">
            {[
              [ov.pseudonyms.length, "copies"],
              [questions.length, "questions"],
              [nComp, "compétences évaluées"],
              [ov.pseudonyms.length * questions.length - emptyCount, "résultats importés"],
            ].map(([v, l]) => (
              <div
                key={l}
                className="flex flex-col gap-1 rounded-[14px] border border-line bg-slate-50 p-[18px]"
              >
                <dd className="order-1 m-0 text-3xl font-bold leading-none text-ink">{v}</dd>
                <dt className="order-2 text-sm text-muted">{l}</dt>
              </div>
            ))}
          </dl>
          {emptyCount > 0 && (
            <div className="flex gap-3 rounded-[14px] border border-amber/40 bg-amber-soft p-4 text-amber-deep">
              <AlertTriangle size={20} className="mt-0.5 flex-none" aria-hidden="true" />
              <div className="flex flex-col gap-1">
                <span className="text-[15px] font-semibold">
                  {emptyCount} réponse{emptyCount > 1 ? "s" : ""} vide{emptyCount > 1 ? "s" : ""} à
                  vérifier
                </span>
                <span className="text-sm leading-relaxed">
                  {Object.entries(ov.empty)
                    .map(
                      ([q, who]) =>
                        `${q} : ${who.slice(0, 6).join(", ")}${who.length > 6 ? "…" : ""}`,
                    )
                    .join(" · ")}
                  . Elles seront comptées comme non traitées, pas comme fausses. Vous pouvez
                  corriger le fichier et le réimporter.
                </span>
              </div>
            </div>
          )}
          <ErrorBox error={imp.error} />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button variant="outline" onClick={() => setStep(2)}>
              Retour
            </Button>
            <Button disabled={imp.isPending} onClick={() => imp.mutate()}>
              <CheckCircle2 size={18} aria-hidden="true" />
              {imp.isPending ? "Import en cours…" : "Valider l'import et voir l'analyse"}
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}
