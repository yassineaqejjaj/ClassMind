import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Info, Sparkles } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Badge, Button, Card, Chip, Crumbs, ErrorBox, LevelBar, Loading } from "@/components/ui";
import { api } from "@/services/api";

const RANK: Record<string, number> = { à_retravailler: 0, en_cours: 1, acquise: 2 };

export default function AnalysisPage() {
  const id = Number(useParams().id);
  const q = useQuery({ queryKey: ["analysis", id], queryFn: () => api.analysis(id) });
  const ai = useMutation({ mutationFn: () => api.summary(id) });
  const [picked, setPicked] = useState<string | null>(null);
  const [ignored, setIgnored] = useState<string[]>([]);
  if (q.isLoading) return <Loading />;
  if (!q.data) return <ErrorBox error={q.error} />;
  const a = q.data;
  const comps = [...a.competencies].sort(
    (x, y) => RANK[x.level] - RANK[y.level] || x.rate - y.rate,
  );
  const weakest = comps.find((c) => c.level !== "acquise") ?? comps[0];
  const studio = `/exercices/nouveau${weakest ? `?competence=${weakest.code}` : ""}`;
  const question = a.questions.find((x) => x.code === picked) ?? a.questions[0];
  const rows = question
    ? [
        { label: "Points complets", n: question.full, fill: "#14B8A6", kind: "acquise" },
        { label: "Points partiels", n: question.partial, fill: "#6366F1", kind: "en_cours" },
        { label: "Aucun point", n: question.none, fill: "#F59E0B", kind: "à_retravailler" },
      ]
    : [];
  const checks = [
    ...(a.n_missing > 0
      ? [
          {
            title: `${a.n_missing} réponse${a.n_missing > 1 ? "s" : ""} vide${a.n_missing > 1 ? "s" : ""}`,
            meta: "Comptées comme non traitées, pas comme fausses. Corrigez le fichier et réimportez si besoin.",
          },
        ]
      : []),
    ...a.questions
      .filter((x) => x.n > 0 && x.none / x.n >= 0.7)
      .map((x) => ({
        title: `${x.code} : ${x.none} copies sur ${x.n} sans point`,
        meta: "Vérifiez l'énoncé et le barème avant de conclure à une difficulté de l'élève.",
      })),
    ...(a.error_list.length === 0
      ? [
          {
            title: "Aucune erreur type saisie",
            meta: "Ajoutez des colonnes Qn_erreur au CSV pour identifier les erreurs fréquentes.",
          },
        ]
      : []),
  ];

  return (
    <div className="flex flex-col gap-7">
      <header className="flex min-h-[48px] flex-wrap items-center justify-between gap-4">
        <Crumbs
          items={[
            {
              label: a.class_name ?? "Classe",
              to: a.class_id ? `/classes/${a.class_id}` : "/classes",
            },
            "Analyse pédagogique",
          ]}
        />
        {a.class_name && <Chip>Classe active · {a.class_name} · Mathématiques</Chip>}
      </header>
      <section className="flex flex-wrap items-end justify-between gap-5">
        <div className="flex flex-col gap-2">
          <span className="inline-flex items-center gap-1.5 self-start rounded-full bg-teal-soft px-3 py-1 text-xs font-semibold text-teal-deep">
            <CheckCircle2 size={14} aria-hidden="true" />
            Analyse terminée
          </span>
          <h1 className="text-3xl font-bold leading-tight tracking-tight md:text-[34px]">
            {a.title}
          </h1>
          <p className="text-base text-muted">
            {a.n_students} copies · {a.n_questions} questions · {a.competencies.length} compétences
            · évaluation du {a.held_on}
          </p>
        </div>
        <Button asChild>
          <Link to={studio}>
            <Sparkles size={18} aria-hidden="true" />
            Préparer des exercices adaptés
          </Link>
        </Button>
      </section>

      <div className="flex flex-wrap items-start gap-6">
        <Card className="flex min-w-0 flex-[3_1_480px] flex-col gap-5 !p-7">
          <div>
            <h2 className="text-xl font-bold">Taux de réussite par compétence</h2>
            <p className="text-sm text-muted">
              Les compétences à retravailler sont placées en premier.
            </p>
          </div>
          {comps.map((c) => (
            <LevelBar key={c.code} label={`${c.code} · ${c.label}`} level={c.level} rate={c.rate} />
          ))}
        </Card>
        <Card className="flex min-w-0 flex-[2_1_340px] flex-col gap-4 !p-7">
          <div>
            <h2 className="text-xl font-bold">Répartition des réponses</h2>
            <p className="text-sm text-muted">Choisissez une question.</p>
          </div>
          <div role="group" aria-label="Question affichée" className="flex flex-wrap gap-2">
            {a.questions.map((x) => (
              <button
                key={x.code}
                type="button"
                aria-pressed={x.code === question?.code}
                onClick={() => setPicked(x.code)}
                className="min-h-[44px] rounded-full border border-slate-300 bg-white px-4 text-sm font-semibold text-ink aria-pressed:border-brand aria-pressed:bg-brand-soft aria-pressed:text-brand-deep"
              >
                {x.code}
              </button>
            ))}
          </div>
          {question && (
            <p className="text-sm text-muted">
              {question.code} ·{" "}
              {a.competencies.find((c) => c.code === question.competency_code)?.label} · sur{" "}
              {question.max_points} pt{question.max_points > 1 ? "s" : ""}
            </p>
          )}
          {rows.map((r) => {
            const p = question && question.n ? Math.round((r.n / question.n) * 100) : 0;
            return (
              <div key={r.label} className="flex flex-col gap-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="font-semibold text-ink">{r.label}</span>
                  <span className="text-muted">
                    {r.n} élèves · {p} %
                  </span>
                </div>
                <div className="h-2.5 rounded-md bg-line" aria-hidden="true">
                  <div
                    className="h-2.5 rounded-md"
                    style={{ width: `${p}%`, background: r.fill }}
                  />
                </div>
              </div>
            );
          })}
        </Card>
      </div>

      <section aria-labelledby="ef" className="flex flex-col gap-4">
        <h2 id="ef" className="text-xl font-bold">
          Erreurs les plus fréquentes
        </h2>
        {a.error_list.length === 0 ? (
          <Card>
            <p className="text-sm text-muted">Aucune erreur type n'a été saisie dans le CSV.</p>
          </Card>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(280px,100%),1fr))] gap-4">
            {a.error_list.slice(0, 6).map((e) => (
              <Card key={`${e.tag}-${e.competency_code}`} className="flex flex-col gap-2 !p-5">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-semibold text-muted">
                    {e.questions.join(", ")} · {e.competency_label}
                  </span>
                  <span className="whitespace-nowrap text-sm font-bold text-ink">
                    {e.count} élèves
                  </span>
                </div>
                <p className="text-base font-semibold text-ink">{e.tag}</p>
              </Card>
            ))}
          </div>
        )}
      </section>

      <div className="flex flex-wrap items-start gap-6">
        <Card className="flex min-w-0 flex-[3_1_480px] flex-col gap-4 !p-7">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-soft text-brand-deep">
              <Sparkles size={18} aria-hidden="true" />
            </span>
            <h2 className="text-xl font-bold">Ce que ClassMind vous suggère</h2>
          </div>
          {a.groups.length > 0 && (
            <div className="flex flex-col gap-2 rounded-[14px] border border-line p-4">
              <Badge kind="draft" />
              <p className="text-sm text-slate-700">Groupes proposés, à valider par vos soins :</p>
              <ul className="text-sm">
                {a.groups.map((g) => (
                  <li key={g.competency_code}>
                    <strong className="text-ink">{g.label}</strong> : {g.pseudonyms.join(", ")}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {!ai.data && (
            <>
              <p className="text-sm text-muted">
                Seules des statistiques agrégées (sans pseudonymes) sont envoyées au modèle. Les
                hypothèses sont à valider par vos soins.
              </p>
              <Button className="self-start" onClick={() => ai.mutate()} disabled={ai.isPending}>
                {ai.isPending ? "Analyse en cours…" : "Générer des suggestions"}
              </Button>
            </>
          )}
          <div aria-live="polite" className="flex flex-col gap-3">
            <ErrorBox error={ai.error} />
            {ai.data && <p className="text-sm leading-relaxed text-slate-700">{ai.data.summary}</p>}
            {ai.data?.hypotheses
              .filter((h) => !ignored.includes(h.competency_code))
              .map((h) => (
                <div
                  key={h.competency_code}
                  className="flex flex-col gap-2 rounded-[14px] border border-line p-4"
                >
                  <Badge kind="ai" />
                  <p className="text-sm text-slate-700">
                    <strong className="text-ink">{h.competency_code}</strong> — {h.hypothesis}{" "}
                    <em>Piste : {h.suggested_action}</em>
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button asChild className="min-h-[40px]">
                      <Link to={`/exercices/nouveau?competence=${h.competency_code}`}>
                        Accepter
                      </Link>
                    </Button>
                    <Button
                      variant="outline"
                      className="min-h-[40px]"
                      onClick={() => setIgnored([...ignored, h.competency_code])}
                    >
                      Ignorer
                    </Button>
                  </div>
                </div>
              ))}
          </div>
          <div className="mt-1 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
            <p className="max-w-md text-sm text-muted">
              Les suggestions s'appuient sur les réponses de cette évaluation. Vous gardez la
              décision.
            </p>
            <Button asChild>
              <Link to={studio}>Préparer des exercices adaptés</Link>
            </Button>
          </div>
        </Card>
        <Card title="À vérifier" className="flex min-w-0 flex-[2_1_340px] flex-col gap-3 !p-7">
          {checks.length === 0 && (
            <p className="flex items-center gap-2 text-sm text-teal-deep">
              <CheckCircle2 size={18} aria-hidden="true" />
              Rien à signaler sur ce fichier.
            </p>
          )}
          {checks.map((c) => (
            <div
              key={c.title}
              className="flex gap-3 border-t border-[#EEF2F7] pt-3 first:border-0 first:pt-0"
            >
              {c.title.startsWith("Aucune") ? (
                <Info size={20} className="mt-0.5 flex-none text-brand-dark" aria-hidden="true" />
              ) : (
                <AlertTriangle
                  size={20}
                  className="mt-0.5 flex-none text-amber-deep"
                  aria-hidden="true"
                />
              )}
              <div className="flex flex-col">
                <span className="text-[15px] font-semibold text-ink">{c.title}</span>
                <span className="text-[13px] leading-snug text-muted">{c.meta}</span>
              </div>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}
