import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Badge, ErrorBox, Loading, PageTitle } from "@/components/ui";
import { api } from "@/services/api";

export default function LibraryPage() {
  const q = useQuery({ queryKey: ["exercises"], queryFn: api.exercises });
  return (
    <>
      <PageTitle sub="Vos séries d'exercices générées et validées">Bibliothèque</PageTitle>
      <ErrorBox error={q.error} />
      {q.isLoading && <Loading />}
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Séries d'exercices</caption>
          <thead className="bg-slate-100">
            <tr>
              <th scope="col" className="p-3">
                Compétence
              </th>
              <th scope="col" className="p-3">
                Difficulté
              </th>
              <th scope="col" className="p-3">
                Type
              </th>
              <th scope="col" className="p-3">
                Date
              </th>
              <th scope="col" className="p-3">
                Statut
              </th>
            </tr>
          </thead>
          <tbody>
            {q.data?.map((e) => (
              <tr key={e.id} className="border-t">
                <th scope="row" className="p-3 font-medium">
                  <Link className="text-brand underline" to={`/exercices/${e.id}`}>
                    {e.competency_code} · {e.competency_label}
                  </Link>
                </th>
                <td className="p-3">{e.difficulty}</td>
                <td className="p-3">{e.exercise_type}</td>
                <td className="p-3">{new Date(e.created_at).toLocaleDateString("fr-FR")}</td>
                <td className="p-3">
                  <Badge kind={e.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
