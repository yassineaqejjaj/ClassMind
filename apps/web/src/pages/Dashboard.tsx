import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, BookCheck, GraduationCap, Sparkles, Upload, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge, Button, Card, ErrorBox, Loading } from "@/components/ui";
import { useCurrentUser } from "@/components/Layout";
import { LEVEL_FILL, LEVEL_LABEL, pct } from "@/lib";
import { api, type Analysis, type CompStat } from "@/services/api";

export default function Dashboard() {
  const user = useCurrentUser();
  const dash = useQuery({ queryKey: ["dashboard"], queryFn: api.dashboard });
  const classes = useQuery({ queryKey: ["classes"], queryFn: api.classes });
  const rows = dash.data ?? [];

  // Point d'attention : la compétence la moins réussie parmi les dernières évaluations de chaque classe.
  let focus: { cls: string; analysis: Analysis; comp: CompStat } | null = null;
  for (const r of rows)
    for (const c of r.latest?.competencies ?? [])
      if (c.level !== "acquise" && (!focus || c.rate < focus.comp.rate))
        focus = { cls: r.name, analysis: r.latest!, comp: c };
  const topError = focus?.comp.errors[0];

  const kpis = [
    {
      icon: GraduationCap,
      label: "Classes",
      value: rows.length,
      bg: "bg-brand-soft",
      fg: "text-brand-deep",
    },
    {
      icon: Users,
      label: "Élèves (pseudonymes)",
      value: rows.reduce((n, r) => n + r.n_students, 0),
      bg: "bg-teal-soft",
      fg: "text-teal-deep",
    },
    {
      icon: BookCheck,
      label: "Évaluations importées",
      value: (classes.data ?? []).reduce((n, c) => n + c.n_assessments, 0),
      bg: "bg-brand-soft",
      fg: "text-brand-deep",
    },
    {
      icon: AlertTriangle,
      label: "Compétences à retravailler",
      value: rows.reduce((n, r) => n + (r.latest?.to_rework.length ?? 0), 0),
      bg: "bg-amber-soft",
      fg: "text-amber-deep",
    },
  ];

  return (
    <div className="flex flex-col gap-8">
      <header className="flex min-h-[48px] flex-wrap items-center justify-between gap-4">
        <h1 className="text-sm font-semibold tracking-wide text-muted">Tableau de bord</h1>
        <Button asChild>
          <Link to="/classes">
            <Upload size={18} aria-hidden="true" />
            Importer une évaluation
          </Link>
        </Button>
      </header>
      <section className="flex flex-col gap-2">
        <h2 className="text-balance text-3xl font-bold leading-tight tracking-tight md:text-[34px]">
          {user.data?.first ? `Bonjour ${user.data.first}, ` : "Bonjour, "}voici ce qu'il faut
          retenir de vos classes.
        </h2>
        <p className="text-base text-muted">
          {focus
            ? "Un point demande votre attention."
            : rows.length
              ? "Importez une évaluation pour obtenir une analyse."
              : "Créez une première classe pour commencer."}
        </p>
      </section>
      <ErrorBox error={dash.error ?? classes.error} />
      {dash.isLoading && <Loading />}

      <section
        aria-label="Indicateurs"
        className="grid grid-cols-[repeat(auto-fit,minmax(min(220px,100%),1fr))] gap-4"
      >
        {kpis.map(({ icon: Icon, label, value, bg, fg }) => (
          <div
            key={label}
            className="flex items-center gap-4 rounded-2xl border border-line bg-white p-5 shadow-sm"
          >
            <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${bg} ${fg}`}>
              <Icon size={22} aria-hidden="true" />
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-3xl font-bold leading-none tracking-tight text-ink">
                {value}
              </span>
              <span className="text-sm font-medium text-slate-700">{label}</span>
            </div>
          </div>
        ))}
      </section>

      {focus && (
        <section
          aria-labelledby="att"
          className="flex flex-wrap items-center gap-10 rounded-[20px] bg-ink p-9 text-white"
        >
          <div className="flex flex-[1_1_380px] flex-col gap-4">
            <span className="inline-flex items-center gap-1.5 self-start rounded-full bg-amber-soft px-3 py-1 text-xs font-semibold text-amber-deep">
              <AlertTriangle size={14} aria-hidden="true" />
              Point d'attention · {focus.cls}
            </span>
            <h2
              id="att"
              className="text-balance text-[28px] font-bold leading-tight tracking-tight !text-white"
            >
              {focus.comp.label} : {pct(focus.comp.rate)} de réussite
            </h2>
            <p className="text-base leading-relaxed text-[#D6DEF0]">
              {topError
                ? `Erreur la plus saisie : « ${topError.tag} » (${topError.count} fois).`
                : "Aucune erreur type n'a été saisie dans le CSV."}{" "}
              Évaluation « {focus.analysis.title} » du {focus.analysis.held_on}.
            </p>
            <div className="mt-2 flex flex-wrap gap-3">
              <Button asChild variant="onDark">
                <Link to={`/exercices/nouveau?competence=${focus.comp.code}`}>
                  <Sparkles size={18} aria-hidden="true" />
                  Préparer des exercices adaptés
                </Link>
              </Button>
              <Button asChild variant="ghostDark">
                <Link to={`/evaluations/${focus.analysis.assessment_id}`}>
                  Voir l'analyse complète
                </Link>
              </Button>
            </div>
          </div>
          <div className="flex flex-[1_1_340px] flex-col gap-3.5">
            <h3 className="text-xs font-semibold uppercase tracking-[0.06em] !text-[#A5B4D4]">
              Réussite par compétence · {focus.cls}
            </h3>
            {focus.analysis.competencies.map((b) => (
              <div key={b.code} className="flex flex-col gap-1.5">
                <div className="flex justify-between gap-3 text-sm">
                  <span className="font-medium">{b.label}</span>
                  <span className="whitespace-nowrap font-semibold">
                    {pct(b.rate)} · {LEVEL_LABEL[b.level]}
                  </span>
                </div>
                <div className="h-2.5 rounded-md bg-white/15" aria-hidden="true">
                  <div
                    className="h-2.5 rounded-md"
                    style={{
                      width: `${Math.round(b.rate * 100)}%`,
                      background: LEVEL_FILL[b.level],
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section aria-labelledby="cl" className="flex flex-col gap-4">
        <div className="flex items-baseline justify-between">
          <h2 id="cl" className="text-xl font-bold">
            Vos classes
          </h2>
          <Link className="text-sm font-semibold text-brand-dark underline" to="/classes">
            Toutes les classes
          </Link>
        </div>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(260px,100%),1fr))] gap-4">
          {rows.map((c) => {
            const weak = c.latest?.competencies
              .filter((k) => k.level === "à_retravailler")
              .sort((a, b) => a.rate - b.rate)[0];
            return (
              <Card key={c.class_id} className="flex flex-col gap-4 !p-5">
                <div>
                  <h3 className="text-[22px] font-bold">
                    <Link className="hover:underline" to={`/classes/${c.class_id}`}>
                      {c.name}
                    </Link>
                  </h3>
                  <p className="text-sm text-muted">Mathématiques · {c.n_students} élèves</p>
                </div>
                {c.latest ? (
                  <>
                    <p className="text-sm">Dernière évaluation · {c.latest.held_on}</p>
                    {weak ? (
                      <div className="flex items-center justify-between gap-2 text-sm">
                        <span>{weak.label}</span>
                        <span className="font-bold text-ink">{pct(weak.rate)}</span>
                      </div>
                    ) : (
                      <span className="self-start">
                        <Badge kind="acquise" />
                      </span>
                    )}
                    <Link
                      className="text-sm font-semibold text-brand-dark underline"
                      to={`/evaluations/${c.latest.assessment_id}`}
                    >
                      Ouvrir l'analyse
                    </Link>
                  </>
                ) : (
                  <Link
                    className="text-sm font-semibold text-brand-dark underline"
                    to={`/classes/${c.class_id}/import`}
                  >
                    Importer une évaluation
                  </Link>
                )}
              </Card>
            );
          })}
        </div>
      </section>
    </div>
  );
}
