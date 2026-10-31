import httpx

from app import retrieval
from app.config import settings
from app.database import Candidate, Job, Session

CONTENT = b"Cache coherence operates on a cache line rather than one individual variable. If two threads write different counters on the same cache line, each core can invalidate the other cached copy. This problem is called false sharing."


def test_import_at_hourly_limit_is_processed_once(client, monkeypatch):
    import app.jobs as jobs
    import app.main as main

    monkeypatch.setattr(settings, "max_jobs_per_hour", 1)
    monkeypatch.setattr(main, "public_target", lambda _: ("https://93.184.216.34/note.txt", "example.org"))
    monkeypatch.setattr(jobs, "download_public", lambda _: (b"Open note\n\n" + CONTENT * 10, "text/plain", "https://example.org/note.txt"))
    with Session.begin() as session:
        session.add(Candidate(owner_id="local-user", url="https://example.org/note.txt", metadata_json={"license": "cc-by", "title": "Open note", "verification_version": 2, "access_status": "verified_full_text", "importable": True, "import_url": "https://example.org/note.txt", "assets": [{"url": "https://example.org/note.txt", "access_status": "verified_full_text", "license": "cc-by", "import_supported": True}]}))
    response = client.post("/api/import", json={"url": "https://example.org/note.txt"})
    assert response.status_code == 202
    job = client.get("/api/jobs/" + response.json()["job_id"]).json()
    assert job["status"] == "completed", job
    assert client.post("/api/import", json={"url": "https://example.org/note.txt"}).status_code == 400


def test_retry_redispatches_queued_job_even_at_document_limit(client, monkeypatch):
    import app.main as main

    monkeypatch.setattr(main, "dispatch", lambda _: None)
    result = client.post("/api/documents/upload", files={"file": ("note.txt", CONTENT)}).json()
    monkeypatch.setattr(settings, "max_documents", 1)
    calls = []
    monkeypatch.setattr(main, "dispatch", calls.append)
    response = client.post("/api/documents/" + result["document"]["id"] + "/retry")
    assert response.status_code == 202
    assert calls == [result["job_id"]]


def test_invalid_model_citations_fall_back_to_real_excerpts(client, monkeypatch):
    client.post("/api/documents/upload", files={"file": ("caches.txt", CONTENT)})
    monkeypatch.setattr(retrieval, "ollama_available", True)
    monkeypatch.setattr(httpx, "post", lambda *args, **kwargs: httpx.Response(200, json={"message": {"content": '{"answer":"An invented answer [99]", "supported":true, "citation_ids":[99]}'}}, request=httpx.Request("POST", "http://localhost")))
    response = client.post("/api/ask", json={"query": "Why do nearby counters slow independent threads?"}).json()
    assert response["mode"] == "grounded-extractive"
    assert "invented" not in response["answer"]
    assert "false sharing" in response["answer"]


def test_valid_structured_citations_are_rendered(client, monkeypatch):
    client.post("/api/documents/upload", files={"file": ("caches.txt", CONTENT)})
    monkeypatch.setattr(retrieval, "ollama_available", True)
    monkeypatch.setattr(httpx, "post", lambda *args, **kwargs: httpx.Response(200, json={"message": {"content": '{"answer":"Writing separate counters can invalidate a shared cache line.", "supported":true, "citation_ids":[1]}'}}, request=httpx.Request("POST", "http://localhost")))
    response = client.post("/api/ask", json={"query": "Why do nearby counters slow independent threads?"}).json()
    assert response["mode"] == "ollama-grounded"
    assert response["answer"].endswith("[1]")
    assert len(response["citations"]) == 1


def test_cancelled_import_retry_respects_owner(client, monkeypatch):
    import app.main as main
    monkeypatch.setattr(main, "dispatch", lambda _: None)
    with Session.begin() as session:
        job = Job(owner_id="another-user", status="failed", payload={"operation": "import", "url": "https://example.org/a"})
        session.add(job)
        session.flush()
        job_id = job.id
    assert client.post("/api/jobs/" + job_id + "/retry").status_code == 404
