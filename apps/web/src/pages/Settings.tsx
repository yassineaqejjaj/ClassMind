import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Button, Card, ErrorBox, Field, Loading, PageTitle } from "@/components/ui";
import { api } from "@/services/api";

export default function SettingsPage() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["settings"], queryFn: api.settings });
  const [cap, setCap] = useState(0);
  const [ret, setRet] = useState(365);
  useEffect(() => {
    if (q.data) {
      setCap(q.data.monthly_llm_cap_eur);
      setRet(q.data.retention_days);
    }
  }, [q.data]);
  const save = useMutation({
    mutationFn: () => api.saveSettings({ monthly_llm_cap_eur: cap, retention_days: ret }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["settings"] }),
  });
  if (q.isLoading) return <Loading />;
  const s = q.data;
  return (
    <>
      <PageTitle sub={s?.establishment}>Paramètres</PageTitle>
      <ErrorBox error={q.error} />
      {s && (
        <div className="grid max-w-3xl gap-4">
          <Card title="Consommation IA">
            <p className="text-sm">
              Dépenses du mois : <strong>{s.month_spend_eur.toFixed(2)} €</strong> sur un plafond de{" "}
              <strong>{s.monthly_llm_cap_eur.toFixed(2)} €</strong>.
            </p>
            <p className="text-sm">
              Service IA :{" "}
              {s.llm_model_configured ? "configuré" : "non configuré (génération indisponible)"}.
            </p>
          </Card>
          <Card title="Plafond et conservation (administrateurs)">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                label="Plafond mensuel IA (€)"
                type="number"
                min={0}
                value={cap}
                onChange={(e) => setCap(Number(e.target.value))}
              />
              <Field
                label="Durée de conservation (jours)"
                type="number"
                min={30}
                value={ret}
                onChange={(e) => setRet(Number(e.target.value))}
              />
            </div>
            <ErrorBox error={save.error} />
            {save.isSuccess && (
              <p role="status" className="mt-2 text-sm text-ok">
                Paramètres enregistrés.
              </p>
            )}
            <Button className="mt-3" onClick={() => save.mutate()}>
              Enregistrer
            </Button>
          </Card>
        </div>
      )}
    </>
  );
}
