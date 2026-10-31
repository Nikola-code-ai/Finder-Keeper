import hashlib

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select

from app.auth import current_owner
from app.database import Chunk, Document, Page, Session
from app.main import app
from app.seed import NOTES, make_pdf
from app.storage import storage


def upload(client, data, filename="note.txt", folder_id=None):
    response = client.post("/api/documents/upload", files={"file": (filename, data, "text/plain")}, data={"folder_id": folder_id} if folder_id else {})
    assert response.status_code == 202, response.text
    return response.json()


def test_local_owner_requires_loopback_and_known_host(client):
    assert client.get("/api/library").status_code == 200
    assert client.get("/api/library", headers={"Origin": "https://malicious.example"}).status_code == 403
    external = TestClient(app, base_url="http://127.0.0.1", client=("10.0.0.2", 123))
    assert external.get("/api/library").status_code == 403
    rebind = TestClient(app, base_url="http://evil.example", client=("127.0.0.1", 123))
    assert rebind.get("/api/library").status_code == 403


@pytest.mark.integration
def test_real_embedding_retrieves_paraphrase_and_exact_page(client):
    for note in NOTES[:3]:
        upload(client, make_pdf(note), note["slug"] + ".pdf")
    response = client.post("/api/search", json={"query": "different threads write nearby variables and invalidate each other's cached data"})
    assert response.status_code == 200
    results = response.json()["results"]
    best = results[0]
    assert best["document"]["filename"] == "false-sharing.pdf"
    assert best["page_number"] == 1
    assert "cache line" in best["excerpt"]
    assert best["semantic_score"] > 0.5
    detail = client.get("/api/documents/" + best["document"]["id"]).json()
    page = next(page for page in detail["pages"] if page["page_number"] == best["page_number"])
    assert page["text"][best["start_char"]:best["end_char"]] == best["excerpt"]
    with Session() as session:
        chunk = session.get(Chunk, best["chunk_id"])
        assert len(chunk.embedding) == 384
        assert chunk.embedding_model == "BAAI/bge-small-en-v1.5"
    assert client.post("/api/search", json={"query": "What is the capital of Peru?"}).json()["results"] == []


def test_dedup_folder_rehome_and_delete_removes_all_data(client):
    folder = client.post("/api/folders", json={"name": "Test collection"}).json()
    data = b"A unique test note explains ocean currents and how wind transports water across the surface."
    first = upload(client, data, folder_id=folder["id"])
    second = upload(client, data)
    assert first["document"]["id"] == second["document"]["id"]
    assert second["duplicate"] is True
    assert len(client.get("/api/library").json()["documents"]) == 1
    docid = first["document"]["id"]
    assert client.get("/api/jobs/" + first["job_id"]).json()["status"] == "completed"
    with Session() as session:
        document = session.get(Document, docid)
        path = storage.local_path(document.storage_key)
    assert path.exists()
    client.delete("/api/folders/" + folder["id"])
    assert client.get("/api/documents/" + docid).json()["folder_id"] is None
    assert client.get("/api/documents/" + docid + "/file").content == data
    assert client.delete("/api/documents/" + docid).status_code == 200
    assert not path.exists()
    assert client.get("/api/documents/" + docid + "/file").status_code == 404
    with Session() as session:
        assert session.scalar(select(func.count()).select_from(Chunk)) == 0
        assert session.scalar(select(func.count()).select_from(Page)) == 0


def test_owner_isolation_covers_files_search_and_folders(client):
    first = upload(client, b"Tenant alpha keeps private research about whale migration and feeding behavior.")
    folder = client.post("/api/folders", json={"name": "Alpha only"}).json()
    app.dependency_overrides[current_owner] = lambda: "another-user"
    assert client.get("/api/library").json()["documents"] == []
    docid = first["document"]["id"]
    for suffix in ["", "/file"]:
        assert client.get("/api/documents/" + docid + suffix).status_code == 404
    assert client.delete("/api/documents/" + docid).status_code == 404
    assert client.get("/api/jobs/" + first["job_id"]).status_code == 404
    assert client.post("/api/search", json={"query": "whale migration"}).json()["results"] == []
    assert client.delete("/api/folders/" + folder["id"]).status_code == 404
    assert client.post("/api/documents/upload", files={"file": ("other.txt", b"Another document containing enough text to create one valid passage.")}, data={"folder_id": folder["id"]}).status_code == 400


def test_failed_extraction_retains_file_and_job_reason(client):
    result = upload(client, b"too short")
    job = client.get("/api/jobs/" + result["job_id"]).json()
    assert job["status"] == "failed"
    assert "No readable text" in job["error"]
    doc = client.get("/api/documents/" + result["document"]["id"]).json()
    assert doc["status"] == "failed"
    assert client.get("/api/documents/" + doc["id"] + "/file").content == b"too short"


def test_restart_resumes_durable_queued_job(client, monkeypatch):
    import app.jobs as jobs
    import app.main as main

    monkeypatch.setattr(main, "dispatch", lambda _: None)
    result = upload(client, b"A durable queued note explains how a restarted process can resume unfinished document indexing.")
    assert client.get("/api/jobs/" + result["job_id"]).json()["status"] == "queued"
    monkeypatch.setattr(jobs, "dispatch", jobs.run_job)
    jobs.recover_jobs()
    assert client.get("/api/jobs/" + result["job_id"]).json()["status"] == "completed"
    jobs.run_job(result["job_id"])
    with Session() as session:
        assert session.scalar(select(func.count()).select_from(Chunk)) == 1


def test_cancel_queued_job_prevents_processing(client, monkeypatch):
    import app.main as main
    from app.jobs import run_job

    monkeypatch.setattr(main, "dispatch", lambda _: None)
    result = upload(client, b"A cancellable document with enough text to become a valid indexed library passage.")
    response = client.delete("/api/jobs/" + result["job_id"])
    assert response.json()["status"] == "cancelled"
    run_job(result["job_id"])
    with Session() as session:
        assert session.scalar(select(func.count()).select_from(Chunk)) == 0


def test_starter_pdfs_are_deterministic_and_labelled():
    first, second = make_pdf(NOTES[0]), make_pdf(NOTES[0])
    assert hashlib.sha256(first).hexdigest() == hashlib.sha256(second).hexdigest()
    from app.extraction import extract_pages
    pages = extract_pages(first, "PDF")
    assert len(pages) == 2
    assert "STARTER NOTE" in pages[0]["text"]
    assert "not a published research paper" in pages[1]["text"]
