import pytest
from ai.schemas.analysis import CompetencyHypothesis, ResultsSummary
from ai.schemas.exercise import GeneratedExercises, GeneratedQuestion, GeneratedVariant

from app.models import LLMUsage
from tests.test_import_and_analysis import CSV1, make_class, upload


def gen(answer="2"):
    q = GeneratedQuestion(statement="Calculer (-3)+(+5)", expression="(-3)+(+5)", answer=answer, explanation="e")
    free = GeneratedQuestion(statement="Place -2 sur la droite", answer="point à gauche de 0", explanation="e")
    v = lambda t: GeneratedVariant(title=t, questions=[q, free])  # noqa: E731
    return GeneratedExercises(variants=[v("A"), v("B"), v("C")])


BODY = {"competency_code": "NR4", "difficulty": "facile", "exercise_type": "calcul", "n_questions": 2}


def test_generation_verification_and_validation_flow(client, provider):
    provider.responses.append(gen(answer="3"))  # le LLM se trompe
    r = client.post("/api/exercises/generate", json=BODY)
    assert r.status_code == 201, r.text
    ex = r.json()
    assert [q["check"] for q in ex["variants"][0]["questions"]] == ["mismatch", "unverifiable"]
    assert ex["variants"][0]["questions"][0]["verified_answer"] == "2"
    assert ex["status"] == "draft"
    # validation refusée tant que SymPy contredit la réponse ; export PDF refusé
    assert client.post(f"/api/exercises/{ex['id']}/validate").status_code == 409
    assert client.get(f"/api/exercises/{ex['id']}/pdf").status_code == 409
    # l'enseignant corrige
    for v in ex["variants"]:
        v["questions"][0]["answer"] = "2"
    edited = client.put(f"/api/exercises/{ex['id']}", json={"variants": ex["variants"]}).json()
    assert edited["variants"][0]["questions"][0]["check"] == "verified"
    ok = client.post(f"/api/exercises/{ex['id']}/validate")
    assert ok.status_code == 200 and ok.json()["status"] == "validated"
    hist = client.get(f"/api/exercises/{ex['id']}").json()["history"]
    assert [h["action"] for h in hist] == ["generated", "edited", "validated"]
    # modifier après validation repasse en brouillon
    assert client.put(f"/api/exercises/{ex['id']}", json={"variants": ex["variants"]}).json()["status"] == "draft"


def test_pdf_export(client, provider):
    try:
        import weasyprint  # noqa: F401
    except OSError:
        pytest.skip("bibliothèques système WeasyPrint (Pango) absentes")
    provider.responses.append(gen())
    ex = client.post("/api/exercises/generate", json=BODY).json()
    client.post(f"/api/exercises/{ex['id']}/validate")
    try:
        r = client.get(f"/api/exercises/{ex['id']}/pdf", params={"answers": True})
    except OSError:  # pragma: no cover
        pytest.skip("bibliothèques système WeasyPrint (Pango) absentes")
    assert r.status_code == 200 and r.content.startswith(b"%PDF")


def test_rejects_bad_structure_and_pii_constraints(client, provider):
    bad = gen()
    bad.variants = bad.variants[:2]
    provider.responses.append(bad)
    assert client.post("/api/exercises/generate", json=BODY).status_code == 422
    assert client.post("/api/exercises/generate", json=BODY | {"constraints": "écrire à a@b.fr"}).status_code == 422
    assert client.post("/api/exercises/generate", json=BODY | {"competency_code": "XX"}).status_code == 422


def test_budget_cap_and_cost_tracking(client, provider, session_factory):
    from app.core.config import get_settings

    get_settings().llm_price_input_per_m = 1000.0  # 1000 tokens => 1 EUR
    try:
        provider.responses += [gen(), gen()]
        client.put("/api/settings", json={"monthly_llm_cap_eur": 1, "retention_days": 365})  # non admin
        assert client.post("/api/exercises/generate", json=BODY).status_code == 201
        with session_factory() as s:
            usage = s.query(LLMUsage).one()
            assert (usage.input_tokens, usage.output_tokens) == (1000, 500) and usage.cost_eur >= 1.0
            from app.models import Establishment

            s.get(Establishment, 1).monthly_llm_cap_eur = 1.0
            s.commit()
        assert client.post("/api/exercises/generate", json=BODY).status_code == 429
    finally:
        get_settings().llm_price_input_per_m = 0.0


def test_summary_sends_only_aggregates(client, provider):
    cid = make_class(client)
    aid = upload(client, cid, CSV1).json()["assessment_id"]
    provider.responses.append(
        ResultsSummary(
            summary="s", hypotheses=[CompetencyHypothesis(competency_code="NR5", hypothesis="h", suggested_action="a")]
        )
    )
    r = client.post(f"/api/assessments/{aid}/summary")
    assert r.status_code == 200 and "valider" in r.json()["notice"]
    sent = provider.calls[0]["user"]
    assert "E-AAA11" not in sent and "NR5" in sent


def test_settings_cap_admin_only(client, make_client):
    body = {"monthly_llm_cap_eur": 5, "retention_days": 90}
    assert client.put("/api/settings", json=body).status_code == 403
    admin = make_client(sub="adm", roles=("establishment_admin",))
    assert admin.put("/api/settings", json=body).status_code == 200
    assert admin.get("/api/settings").json()["monthly_llm_cap_eur"] == 5


def test_reject_blocks_export(client, provider):
    provider.responses.append(gen())
    ex = client.post("/api/exercises/generate", json=BODY).json()
    assert client.post(f"/api/exercises/{ex['id']}/reject").json()["status"] == "rejected"
    assert client.get(f"/api/exercises/{ex['id']}/pdf").status_code == 409
