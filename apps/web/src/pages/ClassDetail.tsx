import * as Tabs from "@radix-ui/react-tabs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileSpreadsheet, Sparkles, Upload } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Button, Card, Chip, Crumbs, ErrorBox, Loading, LevelBar } from "@/components/ui";
import { cn, pct } from "@/lib";
import { api, type ClassDetail } from "@/services/api";

const GROUP = {
  acquise: { label: "Maîtrise solide", bar: "#14B8A6" },
  en_cours: { label: "En progrès", bar: "#6366F1" },
  à_retravailler: { label: "À accompagner", bar: "#F59E0B" },
} as Record<string, { label: string; bar: string }>;

const tabClass =
  "flex min-h-[44px] items-center border-b-[3px] border-transparent px-0.5 text-[15px] font-semibold text-muted hover:text-ink data-[state=active]:border-brand data-[state=active]:text-ink";

function Evaluations({ c }: { c: ClassDetail }) {
  return (
    <Card title="Évaluations" className="flex-[3_1_480px]">
      {c.assessments.length === 0 ? (
        <p className="text-sm text-muted">Aucune évaluation importée.</p>
      ) : (
        <ul>
          {[...c.assessments].reverse().map((a) => (
            <li key={a.id} className="border-t border-[#EEF2F7]">
              <Link
                to={`/evaluations/${a.id}`}
                className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3.5"
              >
                <FileSpreadsheet size={20} className="text-brand-dark" aria-hidden="true" />
                <span className="flex min-w-[200px] flex-1 flex-col">
                  <span className="text-[15px] font-semibold text-ink">{a.title}</span>
                  <span className="text-[13px] text-muted">
                    {a.held_on} · {a.n_students} copies · {a.n_questions} questions
                  </span>
                </span>
                <span className="text-sm font-semibold text-ink">
                  Moyenne de classe {pct(a.overall_rate)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export default function ClassDetailPage() {
  const id = Number(useParams().id);
  const nav = useNavigate();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["class", id], queryFn: () => api.classDetail(id) });
  const settings = useQuery({ queryKey: ["settings"], queryFn: api.settings });
  const [count, setCount] = useState(5);
  const refresh = () => qc.invalidateQueries({ queryKey: ["class", id] });
  const gen = useMutation({ mutationFn: () => api.generateIds(id, count), onSuccess: refresh });
  const del = useMutation({
    mutationFn: () => api.deleteClass(id),
    onSuccess: () => nav("/classes"),
  });
  const exp = useMutation({
    mutationFn: () => api.exportClass(id),
    onSuccess: (data) => {
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
      );
      Object.assign(document.createElement("a"), {
        href: url,
        download: `classe-${id}.json`,
      }).click();
      URL.revokeObjectURL(url);
    },
  });
  if (q.isLoading) return <Loading />;
  if (!q.data) return <ErrorBox error={q.error} />;
  const c = q.data;
  const total = c.distribution.reduce((n, g) => n + g.pseudonyms.length, 0);
  const comps = c.latest
    ? [...c.latest.competencies].sort((a, b) => a.code.localeCompare(b.code))
    : [];

  return (
    <div className="flex flex-col gap-7">
      <header className="flex min-h-[48px] flex-wrap items-center justify-between gap-4">
        <Crumbs items={[{ label: "Mes classes", to: "/classes" }, c.name]} />
        <Chip>Classe active · {c.name}</Chip>
      </header>
      <section className="flex flex-wrap items-end justify-between gap-5">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold leading-tight tracking-tight md:text-[34px]">
            {c.name} <span className="font-normal text-slate-400">|</span> Mathématiques
          </h1>
          <p className="text-base text-muted">
            Chapitre en cours : Nombres relatifs · {c.n_students} élèves
            {settings.data ? ` · ${settings.data.establishment}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button asChild variant="outline">
            <Link to={`/classes/${id}/import`}>
              <Upload size={18} aria-hidden="true" />
              Importer une évaluation
            </Link>
          </Button>
          <Button asChild>
            <Link to="/exercices/nouveau">
              <Sparkles size={18} aria-hidden="true" />
              Préparer des exercices
            </Link>
          </Button>
        </div>
      </section>

      <Tabs.Root defaultValue="overview">
        <div className="mb-6 flex flex-wrap gap-x-7 border-b border-line">
          <Tabs.List aria-label="Sections de la classe" className="contents">
            <Tabs.Trigger className={tabClass} value="overview">
              Vue générale
            </Tabs.Trigger>
            <Tabs.Trigger className={tabClass} value="evals">
              Évaluations
            </Tabs.Trigger>
            <Tabs.Trigger className={tabClass} value="students">
              Élèves
            </Tabs.Trigger>
            <Tabs.Trigger className={tabClass} value="data">
              Données
            </Tabs.Trigger>
          </Tabs.List>
          <Link className={cn(tabClass, "border-b-[3px]")} to="/competences">
            Compétences
          </Link>
          <Link className={cn(tabClass, "border-b-[3px]")} to="/bibliotheque">
            Exercices
          </Link>
          <Link className={cn(tabClass, "border-b-[3px]")} to={`/classes/${id}/progression`}>
            Progression
          </Link>
        </div>

        <Tabs.Content value="overview" className="flex flex-col gap-6">
          <div className="flex flex-wrap items-start gap-6">
            <Card className="flex min-w-0 flex-[3_1_480px] flex-col gap-5 !p-7">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-xl font-bold">Maîtrise par compétence</h2>
                {c.latest && (
                  <Link
                    className="text-sm font-semibold text-brand-dark underline"
                    to={`/evaluations/${c.latest.assessment_id}`}
                  >
                    Voir l'analyse détaillée
                  </Link>
                )}
              </div>
              {comps.length === 0 && (
                <p className="text-sm text-muted">
                  Importez une évaluation pour voir la maîtrise par compétence.
                </p>
              )}
              {comps.map((s) => (
                <LevelBar key={s.code} label={s.label} level={s.level} rate={s.rate} />
              ))}
            </Card>
            <Card className="flex min-w-0 flex-[2_1_320px] flex-col gap-5 !p-7">
              <h2 className="text-xl font-bold">Répartition des élèves</h2>
              <p className="text-sm leading-relaxed text-muted">
                Positionnement sur l'ensemble de la dernière évaluation. Les élèves sont désignés
                par un identifiant pseudonyme.
              </p>
              {total > 0 && (
                <div
                  className="flex h-3.5 gap-[3px] overflow-hidden rounded-lg"
                  role="img"
                  aria-label={c.distribution
                    .map((g) => `${g.pseudonyms.length} élèves : ${GROUP[g.level].label}`)
                    .join(", ")}
                >
                  {c.distribution
                    .filter((g) => g.pseudonyms.length)
                    .map((g) => (
                      <div
                        key={g.level}
                        style={{ flex: g.pseudonyms.length, background: GROUP[g.level].bar }}
                      />
                    ))}
                </div>
              )}
              {c.distribution.map((g) => (
                <div key={g.level} className="flex flex-col gap-1 border-t border-[#EEF2F7] pt-3">
                  <div className="flex justify-between text-sm">
                    <span className="font-semibold text-ink">{GROUP[g.level].label}</span>
                    <span className="font-bold text-ink">{g.pseudonyms.length} élèves</span>
                  </div>
                  <span className="text-[13px] leading-normal text-muted">
                    {g.pseudonyms.join(", ") || "—"}
                  </span>
                </div>
              ))}
            </Card>
          </div>
          <div className="flex flex-wrap items-start gap-6">
            <Evaluations c={c} />
            <Card
              title="Exercices"
              className="flex min-w-0 flex-[2_1_320px] flex-col items-start gap-3.5 !p-7"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-[14px] bg-[#EEF2FF] text-brand-dark">
                <Sparkles size={22} aria-hidden="true" />
              </div>
              <p className="text-[15px] font-semibold text-ink">
                Préparer des exercices pour ce chapitre
              </p>
              <p className="text-sm leading-relaxed text-muted">
                Partez de la compétence à consolider : le Studio IA propose trois variantes que vous
                relisez avant toute utilisation.
              </p>
              <Button asChild>
                <Link to="/exercices/nouveau">Ouvrir le Studio IA</Link>
              </Button>
            </Card>
          </div>
        </Tabs.Content>

        <Tabs.Content value="evals">
          <div className="flex">
            <Evaluations c={c} />
          </div>
        </Tabs.Content>

        <Tabs.Content value="students">
          <Card>
            <p className="mb-3 text-sm text-slate-700">
              Aucun nom n'est enregistré : gardez la correspondance pseudonyme ↔ élève hors de
              ClassMind.
            </p>
            <div className="mb-4 flex items-end gap-2">
              <label className="text-sm">
                Nombre d'identifiants à générer
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={count}
                  onChange={(e) => setCount(Number(e.target.value))}
                  className="ml-2 min-h-[44px] w-20 rounded-xl border border-slate-300 bg-white p-2"
                />
              </label>
              <Button onClick={() => gen.mutate()} disabled={gen.isPending}>
                Générer
              </Button>
            </div>
            <ErrorBox error={gen.error} />
            <ul
              className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6"
              aria-label="Pseudonymes"
            >
              {c.students.map((s) => (
                <li key={s.id} className="rounded-lg bg-slate-100 px-2 py-1 font-mono text-sm">
                  {s.pseudonym}
                </li>
              ))}
            </ul>
          </Card>
        </Tabs.Content>

        <Tabs.Content value="data">
          <Card title="Export et suppression">
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => exp.mutate()}>
                Exporter les données (JSON)
              </Button>
              <Button
                variant="danger"
                onClick={() =>
                  window.confirm("Supprimer définitivement cette classe et ses résultats ?") &&
                  del.mutate()
                }
              >
                Supprimer la classe
              </Button>
            </div>
            <ErrorBox error={exp.error ?? del.error} />
          </Card>
        </Tabs.Content>
      </Tabs.Root>
    </div>
  );
}
