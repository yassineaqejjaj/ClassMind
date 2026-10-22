import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  Eye,
  EyeOff,
  FileSpreadsheet,
  Minus,
  TrendingDown,
  TrendingUp,
  Upload,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Button, Card, Crumbs, ErrorBox, inputClass, Loading } from "@/components/ui";
import { cn } from "@/lib";
import { api, type Progress } from "@/services/api";

const TREND: Record<string, { icon: LucideIcon; tone: string; word: string }> = {
  hausse: { icon: TrendingUp, tone: "bg-teal-soft text-teal-deep", word: "En hausse" },
  stable: { icon: Minus, tone: "bg-slate-100 text-slate-700", word: "Stable" },
  baisse: { icon: TrendingDown, tone: "bg-amber-soft text-amber-deep", word: "En baisse" },
};
const pts = (d: number) => `${d > 0 ? "+" : ""}${Math.round(d * 100)} pts`;
const p = (r: number) => Math.round(r * 100);

function synthesis(g: Progress): string {
  const sorted = [...g.competencies].sort((a, b) => b.delta - a.delta);
  const lines = sorted
    .filter((c) => c.trend !== "stable")
    .map(
      (c) =>
        `la compétence « ${c.label} » passe de ${p(c.rate_before)} % à ${p(c.rate_after)} % de réussite`,
    );
  const stable = g.observations.stable.length;
  return `${lines.length ? lines.join(" ; ") + "." : "aucune compétence ne varie de plus de 5 points."}${stable ? ` ${stable} compétence${stable > 1 ? "s" : ""} évolue${stable > 1 ? "nt" : ""} peu.` : ""}`;
}

export default function ProgressPage() {
  const id = Number(useParams().id);
  const cls = useQuery({ queryKey: ["class", id], queryFn: () => api.classDetail(id) });
  const hist = useQuery({ queryKey: ["history", id], queryFn: () => api.history(id) });
  const [before, setBefore] = useState(0);
  const [after, setAfter] = useState(0);
  const list = useMemo(() => cls.data?.assessments ?? [], [cls.data]);
  useEffect(() => {
    if (list.length >= 2 && !before && !after) {
      setBefore(list[list.length - 2].id);
      setAfter(list[list.length - 1].id);
    }
  }, [list, before, after]);
  const ready = before > 0 && after > 0 && before !== after;
  const prog = useQuery({
    queryKey: ["progress", id, before, after],
    queryFn: () => api.progress(id, before, after),
    enabled: ready,
  });
  if (cls.isLoading) return <Loading />;
  const label = (a: (typeof list)[number]) => `${a.title} · ${a.held_on} · ${a.n_students} copies`;
  const g = prog.data;

  return (
    <div className="flex flex-col gap-7">
      <header className="flex min-h-[48px] flex-wrap items-center justify-between gap-4">
        <Crumbs
          items={[
            { label: cls.data?.name ?? "Classe", to: `/classes/${id}` },
            "Suivi de progression",
          ]}
        />
        <Button asChild variant="outline">
          <Link to={`/classes/${id}/import`}>
            <Upload size={18} aria-hidden="true" />
            Importer une évaluation
          </Link>
        </Button>
      </header>
      <section className="flex flex-col gap-2">
        <h1 className="text-balance text-3xl font-bold leading-tight tracking-tight md:text-[34px]">
          Nombres relatifs : où en est la {cls.data?.name} entre les deux évaluations ?
        </h1>
        <p className="text-base text-muted">
          Comparaison indicative : les questions diffèrent, les compétences sont les mêmes.
        </p>
      </section>

      <form
        aria-label="Évaluations comparées"
        className="grid grid-cols-[repeat(auto-fit,minmax(min(280px,100%),1fr))] gap-4"
      >
        {(
          [
            ["c1", "Résultats de départ", before, setBefore],
            ["c2", "Résultats après consolidation", after, setAfter],
          ] as const
        ).map(([fid, text, val, setter]) => (
          <div key={fid} className="flex flex-col gap-1.5">
            <label htmlFor={fid} className="text-sm font-semibold text-ink">
              {text}
            </label>
            <select
              id={fid}
              className={inputClass}
              value={val}
              onChange={(e) => setter(Number(e.target.value))}
            >
              <option value={0}>Choisir…</option>
              {list.map((a) => (
                <option key={a.id} value={a.id}>
                  {label(a)}
                </option>
              ))}
            </select>
          </div>
        ))}
      </form>
      {list.length < 2 && (
        <Card>
          <p className="text-sm text-muted">
            Il faut au moins deux évaluations importées pour comparer.{" "}
            <Link className="font-semibold text-brand-dark underline" to={`/classes/${id}/import`}>
              Importer une évaluation
            </Link>
          </p>
        </Card>
      )}
      {before > 0 && before === after && (
        <p role="alert" className="text-sm font-medium text-amber-deep">
          Choisissez deux évaluations différentes.
        </p>
      )}
      <ErrorBox error={prog.error} />
      {prog.isLoading && <Loading />}

      {g && (
        <>
          <div className="flex flex-wrap items-start gap-6">
            <Card className="flex min-w-0 flex-[3_1_480px] flex-col gap-5 !p-7">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-xl font-bold">Variation par compétence</h2>
                <div className="flex gap-4 text-sm text-muted">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#A5B4D4]" aria-hidden="true" />
                    Départ
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-brand" aria-hidden="true" />
                    Après
                  </span>
                </div>
              </div>
              {g.competencies.map((c) => {
                const t = TREND[c.trend];
                const Icon = t.icon;
                return (
                  <div key={c.code} className="flex flex-col gap-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[15px] font-medium text-ink">{c.label}</span>
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold",
                          t.tone,
                        )}
                      >
                        <Icon size={14} aria-hidden="true" />
                        {t.word} · {pts(c.delta)}
                      </span>
                    </div>
                    {(
                      [
                        ["Départ", c.rate_before, "#A5B4D4"],
                        ["Après", c.rate_after, "#4F46E5"],
                      ] as const
                    ).map(([w, r, fill]) => (
                      <div key={w} className="flex items-center gap-3">
                        <span className="w-14 text-xs text-muted">{w}</span>
                        <div className="h-2.5 flex-1 rounded-md bg-line" aria-hidden="true">
                          <div
                            className="h-2.5 rounded-md"
                            style={{ width: `${p(r)}%`, background: fill }}
                          />
                        </div>
                        <span className="w-12 text-right text-sm font-bold text-ink">{p(r)} %</span>
                      </div>
                    ))}
                  </div>
                );
              })}
            </Card>
            <Card
              title="Erreurs encore présentes"
              className="flex min-w-0 flex-[2_1_340px] flex-col gap-3 !p-7"
            >
              {g.errors.length === 0 && (
                <p className="text-sm text-muted">
                  Aucune erreur type saisie dans les deux fichiers.
                </p>
              )}
              {g.errors.map((e) => (
                <div
                  key={`${e.tag}-${e.competency_code}`}
                  className="flex flex-col gap-1 border-t border-[#EEF2F7] pt-3 first:border-0 first:pt-0"
                >
                  <span className="text-[15px] font-semibold text-ink">{e.tag}</span>
                  <span className="text-[13px] text-muted">{e.competency_code}</span>
                  <span className="flex items-center gap-1.5 text-sm text-slate-700">
                    {e.before} élèves au départ <ArrowRight size={14} aria-hidden="true" />{" "}
                    {e.after} élèves après
                  </span>
                </div>
              ))}
            </Card>
          </div>

          <Card className="flex flex-col gap-4 !p-7">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-bold">Synthèse pédagogique</h2>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold text-brand-deep">
                Calculée par ClassMind · à relire
              </span>
            </div>
            <p className="text-base leading-relaxed text-slate-700">
              Entre les deux évaluations, {synthesis(g)}
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-1.5 rounded-[14px] border border-[#99F6E4] bg-[#F0FDFA] p-4">
                <span className="flex items-center gap-2 text-sm font-bold text-teal-deep">
                  <Eye size={16} aria-hidden="true" />
                  Ce que l'on observe
                </span>
                <span className="text-sm leading-relaxed text-slate-700">
                  {g.observations.up.length
                    ? `Hausse sur ${g.observations.up.map((o) => o.code).join(", ")}.`
                    : "Pas de hausse nette."}{" "}
                  {g.observations.down.length
                    ? `Baisse sur ${g.observations.down.map((o) => o.code).join(", ")}.`
                    : ""}{" "}
                  {g.errors.length
                    ? `Erreurs saisies : ${g.errors.reduce((n, e) => n + e.before, 0)} au départ, ${g.errors.reduce((n, e) => n + e.after, 0)} après.`
                    : ""}
                </span>
              </div>
              <div className="flex flex-col gap-1.5 rounded-[14px] border border-amber/40 bg-amber-soft p-4">
                <span className="flex items-center gap-2 text-sm font-bold text-amber-deep">
                  <EyeOff size={16} aria-hidden="true" />
                  Ce que l'on ne peut pas affirmer
                </span>
                <ul className="list-disc pl-5 text-sm leading-relaxed text-slate-700">
                  {g.caveats.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              </div>
            </div>
          </Card>
        </>
      )}

      <section aria-labelledby="hi" className="flex flex-col gap-3">
        <h2 id="hi" className="text-xl font-bold">
          Historique des activités
        </h2>
        <div className="rounded-2xl border border-line bg-white px-6 py-2 shadow-sm">
          {hist.data?.length === 0 && <p className="py-3 text-sm text-muted">Aucune activité.</p>}
          {hist.data?.map((h, i) => (
            <div
              key={i}
              className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-[#EEF2F7] py-3 first:border-0"
            >
              <span className="w-28 text-sm text-muted">
                {new Date(h.at).toLocaleDateString("fr-FR")}
              </span>
              <FileSpreadsheet size={16} className="text-brand-dark" aria-hidden="true" />
              <span className="text-sm text-ink">{h.text}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
