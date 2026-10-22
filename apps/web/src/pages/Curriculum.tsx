import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Card, ErrorBox, Loading, PageTitle } from "@/components/ui";
import { api } from "@/services/api";

export default function CurriculumPage() {
  const q = useQuery({ queryKey: ["competencies"], queryFn: api.competencies });
  return (
    <>
      <PageTitle sub="Cinquième — Nombres relatifs : compétences, prérequis et exemples">
        Les liens entre les notions du chapitre
      </PageTitle>
      <ErrorBox error={q.error} />
      {q.isLoading && <Loading />}
      <ol className="grid gap-4 md:grid-cols-2">
        {q.data?.map((c) => (
          <li key={c.code}>
            <Card title={`${c.code} · ${c.label}`}>
              <p className="text-sm">{c.description}</p>
              <p className="mt-2 text-sm text-slate-700">
                <strong>Exemple :</strong> {c.example}
              </p>
              <p className="mt-2 text-sm">
                <strong>Prérequis :</strong>{" "}
                {c.prerequisites.length ? c.prerequisites.join(", ") : "aucun"}
              </p>
              <Link
                className="mt-2 inline-block text-sm text-brand underline"
                to={`/exercices/nouveau?competence=${c.code}`}
              >
                Générer des exercices
              </Link>
            </Card>
          </li>
        ))}
      </ol>
    </>
  );
}
