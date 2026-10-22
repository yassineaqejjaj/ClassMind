MAPPING = '[{"code":"Q1","competency_code":"NR4","max_points":2},{"code":"Q2","competency_code":"NR5","max_points":2}]'
CSV1 = (
    "pseudonyme,Q1,Q2,Q2_erreur\nE-AAA11,2,0,oubli du signe\nE-BBB22,1,1,\nE-CCC33,0,0,oubli du signe\nE-DDD44,2,2,\n"
)
CSV2 = "pseudonyme,Q1,Q2\nE-AAA11,2,2\nE-BBB22,2,1\nE-CCC33,1,1\nE-DDD44,2,2\n"


def make_class(client):
    return client.post("/api/classes", json={"name": "5A fictive"}).json()["id"]


def upload(client, cid, csv, title="Éval", date="2026-10-01", mapping=MAPPING):
    return client.post(
        f"/api/classes/{cid}/assessments",
        data={"title": title, "held_on": date, "mapping": mapping},
        files={"file": ("r.csv", csv.encode(), "text/csv")},
    )


def test_import_and_analysis(client):
    cid = make_class(client)
    r = upload(client, cid, CSV1)
    assert r.status_code == 201, r.text
    assert r.json()["students_created"] == 4 and r.json()["results"] == 8
    a = client.get(f"/api/assessments/{r.json()['assessment_id']}/analysis").json()
    nr4 = next(c for c in a["competencies"] if c["code"] == "NR4")
    nr5 = next(c for c in a["competencies"] if c["code"] == "NR5")
    assert nr4["rate"] == 0.625 and nr4["level"] == "en_cours"
    assert nr5["rate"] == 0.375 and nr5["level"] == "à_retravailler"
    assert nr5["errors"] == [{"tag": "oubli du signe", "count": 2}]
    assert {g["competency_code"] for g in a["groups"]} == {"NR4", "NR5"}
    assert "_per_student" not in a


def test_import_rejects_bad_data(client):
    cid = make_class(client)
    for csv in (
        "pseudonyme,Q1,Q2\nJean Dupont,1,1\n",  # nom réel interdit
        "pseudonyme,Q1,Q2\nE-AAA11,5,1\n",  # hors barème
        "pseudonyme,Q1,Q2\nE-AAA11,abc,1\n",
        "pseudonyme,Q1\nE-AAA11,1\n",  # colonne Q2 absente
        "pseudonyme,Q1,Q2\nE-AAA11,1,1\nE-AAA11,1,1\n",  # doublon
        "nom,Q1,Q2\nE-AAA11,1,1\n",
    ):
        r = upload(client, cid, csv)
        assert r.status_code == 422, csv
    assert client.get(f"/api/classes/{cid}").json()["n_assessments"] == 0


def test_progress_comparison(client):
    cid = make_class(client)
    a = upload(client, cid, CSV1).json()["assessment_id"]
    b = upload(client, cid, CSV2, title="Éval 2", date="2026-11-15").json()["assessment_id"]
    p = client.get(f"/api/classes/{cid}/progress", params={"before": a, "after": b}).json()
    nr5 = next(c for c in p["competencies"] if c["code"] == "NR5")
    assert nr5["delta"] > 0 and nr5["trend"] == "hausse"
    assert p["common_students"] == 4
    assert "attribuer" in p["disclaimer"]
    assert client.get(f"/api/classes/{cid}/progress", params={"before": a, "after": a}).status_code == 422


def test_pseudonym_generation_and_export(client):
    cid = make_class(client)
    ids = client.post(f"/api/classes/{cid}/students/generate", json={"count": 5}).json()["pseudonyms"]
    assert len(set(ids)) == 5
    assert client.post(f"/api/classes/{cid}/students", json={"pseudonyms": ["Jean Dupont"]}).status_code == 422
    upload(client, cid, CSV1)
    exp = client.get(f"/api/classes/{cid}/export").json()
    assert exp["assessments"][0]["results"][0]["pseudonym"].startswith("E-")
    assert client.delete(f"/api/classes/{cid}").status_code == 204
    assert client.get(f"/api/classes/{cid}").status_code == 404


def test_detail_overview_distribution_and_errors(client):
    cid = make_class(client)
    upload(client, cid, CSV1)
    d = client.get(f"/api/classes/{cid}").json()
    assert d["assessments"][0]["overall_rate"] == 0.5
    groups = {g["level"]: g["pseudonyms"] for g in d["distribution"]}
    assert groups["acquise"] == ["E-DDD44"] and groups["à_retravailler"] == ["E-CCC33"]
    a = client.get(f"/api/assessments/{d['assessments'][0]['id']}/analysis").json()
    assert a["error_list"][0] == {
        "tag": "oubli du signe",
        "count": 2,
        "competency_code": "NR5",
        "competency_label": "Soustraire des nombres relatifs",
        "questions": ["Q2"],
    }
    assert a["questions"][1]["none"] == 2 and a["n_missing"] == 0
    hist = client.get(f"/api/classes/{cid}/history").json()
    assert hist[0]["kind"] == "import"


def test_progress_errors_and_caveats(client):
    cid = make_class(client)
    a = upload(client, cid, CSV1).json()["assessment_id"]
    b = upload(client, cid, CSV2, title="Éval 2", date="2026-11-15").json()["assessment_id"]
    p = client.get(f"/api/classes/{cid}/progress", params={"before": a, "after": b}).json()
    assert p["errors"][0]["before"] == 2 and p["errors"][0]["after"] == 0
    assert any("exercices préparés" in c for c in p["caveats"])
    assert {o["code"] for o in p["observations"]["up"]} >= {"NR5"}
