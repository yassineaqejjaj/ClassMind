import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Pencil, RefreshCw, Save, Sparkles, ThumbsDown, ThumbsUp } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { z } from "zod";
import { Badge, Button, Card, ErrorBox, Field, inputClass, Loading } from "@/components/ui";
import { cn } from "@/lib";
import { api, type Exercise, type Variant } from "@/services/api";

const schema = z.object({
  competency_code: z.string().min(1, "Choisissez une compétence"),
  difficulty: z.enum(["facile", "moyen", "difficile"]),
  exercise_type: z.enum(["calcul", "problème", "vrai_faux", "qcm", "droite_graduée"]),
  n_questions: z.coerce.number().int().min(1, "Au moins 1").max(10, "10 au maximum"),
  constraints: z.string().max(500, "500 caractères maximum"),
});
type Form = z.infer<typeof schema>;

const verification = (v: Variant) => {
  const checks = v.questions.map((q) => q.check);
  if (checks.includes("mismatch")) return "mismatch";
  if (checks.every((c) => c === "verified")) return "verified";
  return checks.includes("verified") ? "partial" : "unverifiable";
};
const editable = (vs: Variant[]) =>
  JSON.stringify(
    vs.map((v) =>
      v.questions.map(({ statement, expression, answer, explanation }) => [
        statement,
        expression,
        answer,
        explanation,
      ]),
    ),
  );

export default function Studio() {
  const id = Number(useParams().id) || null;
  const nav = useNavigate();
  const qc = useQueryClient();
  const [params] = useSearchParams();
  const comps = useQuery({ queryKey: ["competencies"], queryFn: api.competencies });
  const ex = useQuery({
    queryKey: ["exercise", id],
    queryFn: () => api.exercise(id!),
    enabled: id !== null,
  });
  const form = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: {
      competency_code: params.get("competence") ?? "",
      difficulty: "moyen",
      exercise_type: "calcul",
      n_questions: 5,
      constraints: "",
    },
  });
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = form;
  const wanted = params.get("competence");
  // Les options n'existent qu'après le chargement du référentiel : on applique alors la compétence de l'URL.
  useEffect(() => {
    if (wanted && comps.data && id === null) setValue("competency_code", wanted);
  }, [wanted, comps.data, id, setValue]);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [tab, setTab] = useState(0);
  const [editing, setEditing] = useState(false);
  const [withAnswers, setWithAnswers] = useState(true);

  useEffect(() => {
    if (!ex.data) return;
    setVariants(structuredClone(ex.data.variants));
    setEditing(false);
    reset({
      competency_code: ex.data.competency_code,
      difficulty: ex.data.difficulty as Form["difficulty"],
      exercise_type: ex.data.exercise_type as Form["exercise_type"],
      n_questions: ex.data.n_questions,
      constraints: ex.data.constraints,
    });
  }, [ex.data, reset]);

  const gen = useMutation({
    mutationFn: (f: Form) => api.generateExercises(f),
    onSuccess: (e) => nav(`/exercices/${e.id}`),
  });
  const done = (e: Exercise) =>
    qc.setQueryData(["exercise", id], (old: Exercise | undefined) => ({ ...old, ...e }));
  const save = useMutation({
    mutationFn: () => api.saveExercise(id!, variants),
    onSuccess: (e) => {
      done(e);
      setEditing(false);
    },
  });
  const validate = useMutation({ mutationFn: () => api.validateExercise(id!), onSuccess: done });
  const reject = useMutation({ mutationFn: () => api.rejectExercise(id!), onSuccess: done });
  const pdf = useMutation({ mutationFn: () => api.downloadPdf(id!, withAnswers) });

  const saved = ex.data;
  const dirty = !!saved && editable(variants) !== editable(saved.variants);
  const cur = variants[tab];
  const set = (qi: number, k: "statement" | "expression" | "answer" | "explanation", val: string) =>
    setVariants(
      variants.map((v, i) =>
        i !== tab
          ? v
          : { ...v, questions: v.questions.map((x, j) => (j === qi ? { ...x, [k]: val } : x)) },
      ),
    );
  const compLabel = comps.data?.find((c) => c.code === saved?.competency_code)?.label;
  const busy = save.isPending || validate.isPending || reject.isPending;
  const hint = !saved
    ? ""
    : saved.status === "rejected"
      ? "Cette série a été rejetée : générez-en une nouvelle."
      : saved.status === "validated"
        ? "Série validée : vous pouvez l'exporter en PDF."
        : dirty
          ? "Modifications non enregistrées : enregistrez-les pour revérifier les calculs."
          : "Relisez chaque variante, corrigez si besoin, puis validez pour débloquer l'export PDF.";

  return (
    <div className="flex flex-col gap-7">
      <header className="flex min-h-[48px] items-center">
        <h1 className="text-sm font-semibold tracking-wide text-muted">Studio IA</h1>
      </header>
      <section className="flex flex-col gap-2">
        <h2 className="text-3xl font-bold leading-tight tracking-tight md:text-[34px]">
          Préparer des exercices adaptés
        </h2>
        <p className="text-base text-muted">
          Trois variantes sont proposées. Aucune n'est utilisable avant votre validation.
        </p>
      </section>

      <div className="flex flex-wrap items-start gap-6">
        <form
          aria-label="Paramètres de génération"
          onSubmit={handleSubmit((f) => gen.mutate(f))}
          noValidate
          className="flex min-w-0 flex-[1_1_320px] flex-col gap-4 rounded-2xl border border-line bg-white p-6 shadow-sm lg:max-w-[380px]"
        >
          <h3 className="text-lg font-bold">Paramètres</h3>
          <div className="space-y-1">
            <label htmlFor="comp" className="block text-sm font-medium text-ink">
              Compétence
            </label>
            <select
              id="comp"
              className={inputClass}
              aria-invalid={!!errors.competency_code}
              {...register("competency_code")}
            >
              <option value="">Choisir…</option>
              {comps.data?.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </select>
            {errors.competency_code && (
              <p role="alert" className="text-xs text-bad">
                {errors.competency_code.message}
              </p>
            )}
          </div>
          <div className="space-y-1">
            <label htmlFor="diff" className="block text-sm font-medium text-ink">
              Difficulté
            </label>
            <select id="diff" className={inputClass} {...register("difficulty")}>
              <option value="facile">Facile</option>
              <option value="moyen">Intermédiaire</option>
              <option value="difficile">Difficile</option>
            </select>
          </div>
          <div className="space-y-1">
            <label htmlFor="type" className="block text-sm font-medium text-ink">
              Type d'exercice
            </label>
            <select id="type" className={inputClass} {...register("exercise_type")}>
              <option value="calcul">Calcul</option>
              <option value="problème">Problème</option>
              <option value="vrai_faux">Vrai / faux</option>
              <option value="qcm">QCM</option>
              <option value="droite_graduée">Droite graduée</option>
            </select>
          </div>
          <Field
            label="Nombre de questions"
            type="number"
            min={1}
            max={10}
            {...register("n_questions")}
            error={errors.n_questions?.message}
          />
          <div className="space-y-1">
            <label htmlFor="constraints" className="block text-sm font-medium text-ink">
              Consignes particulières
            </label>
            <textarea
              id="constraints"
              rows={4}
              className={cn(inputClass, "py-2")}
              {...register("constraints")}
            />
            <p className="text-xs text-muted">
              N'indiquez aucune donnée personnelle : ce texte est transmis au modèle.
            </p>
            {errors.constraints && (
              <p role="alert" className="text-xs text-bad">
                {errors.constraints.message}
              </p>
            )}
          </div>
          <ErrorBox error={gen.error} />
          <Button type="submit" disabled={gen.isPending}>
            <Sparkles size={18} aria-hidden="true" />
            {gen.isPending
              ? "Génération en cours…"
              : saved
                ? "Générer de nouvelles variantes"
                : "Générer les variantes"}
          </Button>
        </form>

        <div className="flex min-w-0 flex-[3_1_480px] flex-col gap-4">
          {gen.isPending && (
            <div
              role="status"
              className="flex items-center gap-2 rounded-xl bg-brand-soft p-3 text-sm font-medium text-brand-deep"
            >
              <RefreshCw size={16} className="animate-spin" aria-hidden="true" />
              Analyse en cours : génération des trois variantes…
            </div>
          )}
          {id !== null && ex.isLoading && <Loading />}
          <ErrorBox error={ex.error} />
          {!saved && !gen.isPending && id === null && (
            <Card className="flex flex-col items-start gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-[14px] bg-brand-soft text-brand-dark">
                <Sparkles size={22} aria-hidden="true" />
              </div>
              <p className="text-[15px] font-semibold text-ink">Aucune variante pour le moment</p>
              <p className="text-sm text-muted">
                Choisissez une compétence à consolider puis lancez la génération. Les calculs sont
                ensuite vérifiés automatiquement.
              </p>
            </Card>
          )}
          {saved && cur && (
            <>
              <div
                role="group"
                aria-label="Variantes proposées"
                className="grid grid-cols-[repeat(auto-fit,minmax(min(200px,100%),1fr))] gap-3"
              >
                {variants.map((v, i) => (
                  <button
                    key={v.label}
                    type="button"
                    aria-pressed={i === tab}
                    onClick={() => setTab(i)}
                    className="flex min-h-[44px] flex-col items-start gap-2 rounded-2xl border border-line bg-white p-4 text-left aria-pressed:border-brand aria-pressed:bg-[#FAFBFF] aria-pressed:ring-2 aria-pressed:ring-brand/30"
                  >
                    <span className="flex items-center gap-2">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-soft text-sm font-bold text-brand-deep">
                        {v.label}
                      </span>
                      <span className="text-[15px] font-bold text-ink">{v.title}</span>
                    </span>
                    <Badge kind={verification(saved.variants[i] ?? v)} />
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2.5">
                {editing ? (
                  <Button variant="outline" disabled={!dirty || busy} onClick={() => save.mutate()}>
                    <Save size={18} aria-hidden="true" />
                    Enregistrer
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    disabled={saved.status === "rejected"}
                    onClick={() => setEditing(true)}
                  >
                    <Pencil size={18} aria-hidden="true" />
                    Modifier
                  </Button>
                )}
                <Button
                  variant="outline"
                  disabled={gen.isPending}
                  onClick={() => handleSubmit((f) => gen.mutate(f))()}
                >
                  <RefreshCw size={18} aria-hidden="true" />
                  Régénérer
                </Button>
                <Button
                  variant="outline"
                  disabled={dirty || busy || saved.status !== "draft"}
                  onClick={() => validate.mutate()}
                >
                  <ThumbsUp size={18} aria-hidden="true" />
                  Valider
                </Button>
                <Button
                  variant="outline"
                  disabled={busy || saved.status === "rejected"}
                  onClick={() => reject.mutate()}
                >
                  <ThumbsDown size={18} aria-hidden="true" />
                  Rejeter
                </Button>
                <div className="flex-1" />
                <label className="flex min-h-[44px] items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={withAnswers}
                    onChange={(e) => setWithAnswers(e.target.checked)}
                  />
                  Avec corrigé
                </label>
                <Button
                  disabled={saved.status !== "validated" || dirty || pdf.isPending}
                  onClick={() => pdf.mutate()}
                >
                  <Download size={18} aria-hidden="true" />
                  Exporter en PDF
                </Button>
              </div>
              <p className="text-sm text-muted" aria-live="polite">
                {hint}
              </p>
              {pdf.isSuccess && (
                <div
                  role="status"
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-teal-soft p-3 text-sm font-medium text-teal-deep"
                >
                  <span>Fiche exportée : exercices-{saved.id}.pdf</span>
                  <Link className="underline" to="/classes">
                    Après la séance : comparer deux évaluations
                  </Link>
                </div>
              )}
              <ErrorBox error={save.error ?? validate.error ?? reject.error ?? pdf.error} />

              <article
                aria-labelledby="doc"
                className="rounded-2xl border border-line bg-white p-7 shadow-sm"
              >
                <header className="mb-5 flex flex-wrap items-start justify-between gap-3 border-b border-line pb-4">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-semibold uppercase tracking-[0.06em] text-muted">
                      5e · Mathématiques · Nombres relatifs · {saved.difficulty}
                    </span>
                    <h3 id="doc" className="text-xl font-bold">
                      {compLabel ?? saved.competency_label} · Variante {cur.label}
                    </h3>
                  </div>
                  <Badge kind={saved.status} />
                </header>
                <ol className="flex flex-col gap-5">
                  {cur.questions.map((x, qi) => {
                    const check = saved.variants[tab]?.questions[qi]?.check ?? "unverifiable";
                    const computed = saved.variants[tab]?.questions[qi]?.verified_answer;
                    return (
                      <li key={qi} className="flex gap-4">
                        <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-ink">
                          {qi + 1}
                        </span>
                        <div className="flex min-w-0 flex-1 flex-col gap-2">
                          {editing ? (
                            <>
                              <label className="text-sm">
                                Énoncé
                                <textarea
                                  className={cn(inputClass, "py-2")}
                                  rows={2}
                                  value={x.statement}
                                  onChange={(e) => set(qi, "statement", e.target.value)}
                                />
                              </label>
                              <div className="grid gap-2 sm:grid-cols-2">
                                <label className="text-sm">
                                  Calcul à vérifier (facultatif)
                                  <input
                                    className={inputClass}
                                    value={x.expression ?? ""}
                                    onChange={(e) => set(qi, "expression", e.target.value)}
                                  />
                                </label>
                                <label className="text-sm">
                                  Réponse
                                  <input
                                    className={inputClass}
                                    value={x.answer}
                                    onChange={(e) => set(qi, "answer", e.target.value)}
                                  />
                                </label>
                              </div>
                              <label className="text-sm">
                                Explication
                                <textarea
                                  className={cn(inputClass, "py-2")}
                                  rows={2}
                                  value={x.explanation}
                                  onChange={(e) => set(qi, "explanation", e.target.value)}
                                />
                              </label>
                            </>
                          ) : (
                            <>
                              <p className="text-base text-slate-900">{x.statement}</p>
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                                <span className="text-slate-700">
                                  <strong className="text-ink">Corrigé :</strong> {x.answer}
                                </span>
                                <span className="text-muted">{x.explanation}</span>
                              </div>
                            </>
                          )}
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge kind={check} />
                            {check === "mismatch" && (
                              <span role="alert" className="text-sm font-medium text-amber-deep">
                                Le calcul donne {computed}. Corrigez la réponse avant validation.
                              </span>
                            )}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </article>
              {saved.history && (
                <Card title="Historique">
                  <ul className="text-sm">
                    {saved.history.map((h, i) => (
                      <li key={i}>
                        {new Date(h.at).toLocaleString("fr-FR")} —{" "}
                        {(
                          {
                            generated: "Génération",
                            edited: "Modification",
                            validated: "Validation",
                            rejected: "Rejet",
                          } as Record<string, string>
                        )[h.action] ?? h.action}
                      </li>
                    ))}
                  </ul>
                </Card>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
