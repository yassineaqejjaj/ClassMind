import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { Link } from "react-router-dom";
import { z } from "zod";
import { Button, Card, ErrorBox, Field, Loading, PageTitle } from "@/components/ui";
import { api } from "@/services/api";

const schema = z.object({
  name: z.string().min(1, "Le nom est obligatoire").max(100),
  school_year: z.string().regex(/^(\d{4}-\d{4})?$/, "Format attendu : 2026-2027"),
});
type Form = z.infer<typeof schema>;

export default function ClassesPage() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["classes"], queryFn: api.classes });
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", school_year: "" },
  });
  const create = useMutation({
    mutationFn: (f: Form) => api.createClass({ ...f, level: "5e" }),
    onSuccess: () => {
      reset();
      qc.invalidateQueries({ queryKey: ["classes"] });
    },
  });
  return (
    <>
      <PageTitle sub="Utilisez des classes fictives ou pseudonymisées tant que l'analyse de risque n'est pas validée">
        Mes classes
      </PageTitle>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ErrorBox error={q.error} />
          {q.isLoading && <Loading />}
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Liste de vos classes</caption>
              <thead className="bg-slate-100 text-ink">
                <tr>
                  <th scope="col" className="p-3">
                    Classe
                  </th>
                  <th scope="col" className="p-3">
                    Niveau
                  </th>
                  <th scope="col" className="p-3">
                    Élèves
                  </th>
                  <th scope="col" className="p-3">
                    Évaluations
                  </th>
                </tr>
              </thead>
              <tbody>
                {q.data?.map((c) => (
                  <tr key={c.id} className="border-t">
                    <th scope="row" className="p-3 font-medium">
                      <Link className="text-brand underline" to={`/classes/${c.id}`}>
                        {c.name}
                      </Link>
                    </th>
                    <td className="p-3">{c.level}</td>
                    <td className="p-3">{c.n_students}</td>
                    <td className="p-3">{c.n_assessments}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <Card title="Nouvelle classe">
          <form className="space-y-3" onSubmit={handleSubmit((f) => create.mutate(f))} noValidate>
            <Field label="Nom de la classe" {...register("name")} error={errors.name?.message} />
            <Field
              label="Année scolaire"
              hint="Ex. 2026-2027"
              {...register("school_year")}
              error={errors.school_year?.message}
            />
            <ErrorBox error={create.error} />
            <Button type="submit" disabled={create.isPending}>
              Créer la classe
            </Button>
          </form>
        </Card>
      </div>
    </>
  );
}
