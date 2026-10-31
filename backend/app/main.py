import logging
from contextlib import asynccontextmanager
from datetime import timedelta
from typing import Annotated, Literal

from fastapi import Depends, FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response
from pydantic import BaseModel, Field
from sqlalchemy import delete, func, select, update

from . import retrieval
from .acquisition import trusted_import_candidate
from .auth import current_owner, verify_worker
from .config import settings
from .database import Candidate, Chunk, Document, Folder, Job, Page, Session, document_dict, init_db, now
from .discovery import discover, public_target
from .embeddings import embeddings
from .jobs import (
    _mutation_lock,
    check_quota,
    dispatch,
    executor,
    recover_jobs,
    run_job,
    store_document,
    validate_folder,
)
from .middleware import BodySizeLimitMiddleware
from .seed import seed_library
from .storage import storage

logger = logging.getLogger(__name__)
startup_error = None


def initialize_library():
    global startup_error
    try:
        embeddings.warmup()
        seed_library()
        recover_jobs()
    except Exception as exc:
        logger.exception("Library initialization failed")
        startup_error = f"Library initialization needs attention ({type(exc).__name__})"


@asynccontextmanager
async def lifespan(app):
    settings.validate_runtime()
    init_db()
    retrieval.detect_ollama()
    executor.submit(initialize_library)
    yield


app = FastAPI(title="Finder-Keeper", version="0.1.0", lifespan=lifespan)
app.add_middleware(BodySizeLimitMiddleware, max_bytes=settings.max_bytes + 1024 * 1024)
app.add_middleware(CORSMiddleware, allow_origins=settings.allowed_origins.split(","), allow_credentials=False, allow_methods=["GET", "POST", "PATCH", "DELETE"], allow_headers=["Authorization", "Content-Type"])
Owner = Annotated[str, Depends(current_owner)]


@app.middleware("http")
async def safe_response_headers(request: Request, call_next):
    # Reject oversized uploads before the multipart parser writes spooled temporary files.
    length = request.headers.get("content-length")
    if length:
        try:
            if int(length) > settings.max_bytes + 1024 * 1024:
                return Response("Upload exceeds the file-size limit", status_code=413)
        except ValueError:
            return Response("Invalid content length", status_code=400)
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Cache-Control"] = "no-store"
    return response


class FolderInput(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    color: str = Field(default="sage", max_length=20)
    parent_id: str | None = None


def folder_dict(folder, documents=()):
    return {"id": folder.id, "name": folder.name, "color": folder.color, "parent_id": folder.parent_id, "count": sum(doc.folder_id == folder.id for doc in documents)}


def folder_scope(session, owner, folder_id):
    """A collection's scope includes the collections inside it, one level down."""
    if not folder_id:
        return None
    children = session.scalars(select(Folder.id).where(Folder.owner_id == owner, Folder.parent_id == folder_id)).all()
    return [folder_id, *children]


def checked_parent(session, owner, parent_id, folder_id=None):
    if not parent_id:
        return None
    parent = session.get(Folder, parent_id)
    if not parent or parent.owner_id != owner:
        raise HTTPException(404, "That collection does not exist")
    if parent.id == folder_id:
        raise HTTPException(400, "A collection cannot sit inside itself")
    if parent.parent_id:
        raise HTTPException(400, "Collections nest one level deep: put this one inside a top-level collection")
    return parent.id


class DocumentPatch(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=500)
    folder_id: str | None = None


class SearchInput(BaseModel):
    query: str = Field(min_length=1, max_length=2000, pattern=r"\S")
    folder_id: str | None = None
    limit: int = Field(default=8, ge=1, le=20)


class DiscoveryInput(SearchInput):
    kind: Literal["any", "book", "paper"] = "any"


class ImportInput(BaseModel):
    url: str = Field(min_length=8, max_length=3000)
    title: str | None = Field(default=None, max_length=500)
    folder_id: str | None = None
    source_url: str | None = None
    license: str | None = None
    rights_confirmed: bool = False


def owned_document(session, document_id, owner):
    document = session.get(Document, document_id)
    if not document or document.owner_id != owner:
        raise HTTPException(404, "Document not found")
    return document


def queue_or_report(job_id):
    try:
        dispatch(job_id)
    except Exception:
        # The durable queued record remains available for restart recovery.
        logger.exception("Could not dispatch job %s", job_id)
        raise HTTPException(503, "The document is saved, but its processing queue is unavailable. Retry shortly.") from None


@app.get("/health")
def health():
    return {"ok": True, "service": "finder-keeper"}


@app.get("/api/status")
def status(owner: Owner):
    with Session() as session:
        count = session.scalar(select(func.count()).select_from(Chunk).where(Chunk.owner_id == owner))
        docs = session.scalar(select(func.count()).select_from(Document).where(Document.owner_id == owner))
    return {
        "mode": "local" if settings.auth_mode == "local" else "cloud",
        "storage": "Local private files" if settings.storage_backend == "local" else "Google Cloud Storage",
        "embedding_model": settings.embedding_model, "embedding_provider": settings.embedding_provider,
        "embedding_ready": embeddings.ready, "embedding_dimensions": settings.embedding_dimensions,
        "embedding_error": embeddings.error, "auth_required": settings.auth_mode != "local",
        "document_count": docs, "chunk_count": count, "startup_error": startup_error,
        "answer_mode": "ollama-grounded" if retrieval.ollama_available else "grounded-extractive",
        "answer_model": settings.ollama_model if retrieval.ollama_available else None,
        "max_upload_mb": settings.max_upload_mb, "max_pages": settings.max_pages,
        "discovery_provider": "OpenAlex / Crossref / OpenStax / Gutenberg / OAPEN", "offline_library": settings.embedding_provider == "fastembed",
    }


@app.get("/api/library")
def library(owner: Owner):
    with Session() as session:
        documents = session.scalars(select(Document).where(Document.owner_id == owner).order_by(Document.created_at.desc())).all()
        folders = session.scalars(select(Folder).where(Folder.owner_id == owner).order_by(Folder.created_at)).all()
        return {"folders": [folder_dict(folder, documents) for folder in folders], "documents": [document_dict(doc) for doc in documents]}


@app.post("/api/folders", status_code=201)
def create_folder(payload: FolderInput, owner: Owner):
    name = payload.name.strip()
    if not name:
        raise HTTPException(400, "Give the folder a name")
    with Session.begin() as session:
        folder = Folder(owner_id=owner, name=name, color=payload.color, parent_id=checked_parent(session, owner, payload.parent_id))
        session.add(folder)
        session.flush()
        return folder_dict(folder)


@app.patch("/api/folders/{folder_id}")
def edit_folder(folder_id: str, payload: FolderInput, owner: Owner):
    with Session.begin() as session:
        folder = session.get(Folder, folder_id)
        if not folder or folder.owner_id != owner:
            raise HTTPException(404, "Folder not found")
        if not payload.name.strip():
            raise HTTPException(400, "Give the folder a name")
        parent = checked_parent(session, owner, payload.parent_id, folder.id)
        if parent and session.scalar(select(func.count()).select_from(Folder).where(Folder.parent_id == folder.id)):
            raise HTTPException(400, "This collection holds others, so it stays at the top level")
        folder.name, folder.color, folder.parent_id = payload.name.strip(), payload.color, parent
        return folder_dict(folder)


@app.delete("/api/folders/{folder_id}")
def delete_folder(folder_id: str, owner: Owner):
    with Session.begin() as session:
        folder = session.get(Folder, folder_id)
        if not folder or folder.owner_id != owner:
            raise HTTPException(404, "Folder not found")
        session.execute(update(Document).where(Document.folder_id == folder_id, Document.owner_id == owner).values(folder_id=None))
        # Collections inside a removed one step up to where it was.
        session.execute(update(Folder).where(Folder.parent_id == folder_id, Folder.owner_id == owner).values(parent_id=folder.parent_id))
        session.delete(folder)
    return {"deleted": True, "documents_preserved": True}


@app.post("/api/documents/upload", status_code=202)
async def upload_document(owner: Owner, file: UploadFile = File(...), folder_id: str | None = Form(None)):
    data = await file.read(settings.max_bytes + 1)
    await file.close()
    try:
        document, duplicate = store_document(data, file.filename or "document.pdf", owner, folder_id or None, file.content_type or "", metadata={"license": "User-provided document"})
    except (ValueError, UnicodeDecodeError) as exc:
        raise HTTPException(400, str(exc)) from None
    with Session.begin() as session:
        existing = session.scalar(select(Job).where(Job.owner_id == owner, Job.document_id == document.id).order_by(Job.created_at.desc()))
        if duplicate and existing and existing.status in ("queued", "processing", "completed"):
            return {"job_id": existing.id, "document": document_dict(document), "duplicate": True}
        job = Job(owner_id=owner, document_id=document.id, payload={"operation": "upload"})
        session.add(job)
        session.flush()
        job_id = job.id
    queue_or_report(job_id)
    return {"job_id": job_id, "document": document_dict(document), "duplicate": duplicate}


@app.get("/api/documents/{document_id}")
def get_document(document_id: str, owner: Owner):
    with Session() as session:
        document = owned_document(session, document_id, owner)
        pages = session.scalars(select(Page).where(Page.document_id == document_id).order_by(Page.page_number)).all()
        chunks = session.scalars(select(Chunk).where(Chunk.document_id == document_id).order_by(Chunk.position)).all()
        return {**document_dict(document), "pages": [{"page_number": page.page_number, "text": page.text} for page in pages], "chunks": [{"id": chunk.id, "page_number": chunk.page_number, "start_char": chunk.start_char, "end_char": chunk.end_char, "embedding_model": chunk.embedding_model} for chunk in chunks]}


@app.get("/api/documents/{document_id}/file")
def get_document_file(document_id: str, owner: Owner, download: bool = False):
    with Session() as session:
        document = owned_document(session, document_id, owner)
        disposition = "attachment" if download or document.kind == "Article" else "inline"
        # Imported HTML is never rendered in the app's origin; the extracted-text reader is safe.
        if settings.storage_backend == "local":
            return FileResponse(storage.local_path(document.storage_key), media_type=document.mime_type, filename=document.filename, content_disposition_type=disposition, headers={"Content-Security-Policy": "sandbox"})
        from urllib.parse import quote
        return Response(storage.get(document.storage_key), media_type=document.mime_type, headers={"Content-Disposition": f"{disposition}; filename*=UTF-8''{quote(document.filename)}", "Content-Security-Policy": "sandbox"})


@app.patch("/api/documents/{document_id}")
def edit_document(document_id: str, payload: DocumentPatch, owner: Owner):
    with Session.begin() as session:
        document = owned_document(session, document_id, owner)
        if "title" in payload.model_fields_set:
            if not payload.title or not payload.title.strip():
                raise HTTPException(400, "Give the document a title")
            document.title = payload.title.strip()
        if "folder_id" in payload.model_fields_set:
            try:
                validate_folder(session, payload.folder_id, owner)
            except ValueError as exc:
                raise HTTPException(404, str(exc)) from None
            document.folder_id = payload.folder_id
        return document_dict(document)


@app.delete("/api/documents/{document_id}")
def delete_document(document_id: str, owner: Owner):
    with _mutation_lock, Session.begin() as session:
        document = session.scalar(select(Document).where(Document.id == document_id, Document.owner_id == owner).with_for_update())
        if not document:
            raise HTTPException(404, "Document not found")
        # Deletion and worker publication share a local lock and lock the document row in PostgreSQL.
        document.status = "deleting"
        session.execute(update(Job).where(Job.document_id == document_id, Job.owner_id == owner, Job.status.in_(["queued", "processing"])).values(status="cancelled", stage="Document removed"))
        storage.delete(document.storage_key)
        session.delete(document)
    return {"deleted": True}


@app.post("/api/documents/{document_id}/retry", status_code=202)
def retry_document(document_id: str, owner: Owner):
    with Session.begin() as session:
        document = owned_document(session, document_id, owner)
        existing = session.scalar(select(Job).where(Job.document_id == document_id, Job.owner_id == owner, Job.status.in_(["queued", "processing"])))
        if existing and existing.status == "processing":
            return {"job_id": existing.id, "document": document_dict(document)}
        if existing:
            job = existing
        else:
            try:
                check_quota(session, owner, document_limit=False)
            except ValueError as exc:
                raise HTTPException(429, str(exc)) from None
            job = Job(owner_id=owner, document_id=document_id, payload={"operation": "upload"})
            session.add(job)
            session.flush()
        document.status, document.error = "processing", None
        job_id = job.id
    queue_or_report(job_id)
    return {"job_id": job_id, "document": document_dict(document)}


@app.post("/api/jobs/{job_id}/retry", status_code=202)
def retry_job(job_id: str, owner: Owner):
    with Session.begin() as session:
        job = session.get(Job, job_id)
        if not job or job.owner_id != owner:
            raise HTTPException(404, "Task not found")
        if job.status in ("processing", "completed"):
            return {"job_id": job.id, "status": job.status}
        job.status, job.stage, job.error = "queued", "Waiting to retry", None
    queue_or_report(job_id)
    return {"job_id": job_id, "status": "queued"}


@app.post("/api/search")
def search_library(payload: SearchInput, owner: Owner):
    if not embeddings.ready:
        raise HTTPException(503, "The embedding model is warming up. Please try again in a moment.")
    with Session() as session:
        scope = folder_scope(session, owner, payload.folder_id)
    results = retrieval.search(payload.query.strip(), owner, scope, payload.limit)
    return {"results": results, "query": payload.query, "method": "hybrid-semantic", "embedding_model": settings.embedding_model}


@app.post("/api/ask")
def ask_library(payload: SearchInput, owner: Owner):
    if not embeddings.ready:
        raise HTTPException(503, "The embedding model is warming up. Please try again in a moment.")
    with Session() as session:
        scope = folder_scope(session, owner, payload.folder_id)
    return retrieval.ask(payload.query.strip(), owner, scope)


@app.post("/api/discover")
def discover_online(payload: DiscoveryInput, owner: Owner):
    try:
        response = discover(payload.query.strip(), kind=payload.kind)
    except ValueError as exc:
        raise HTTPException(503, str(exc)) from None
    with Session.begin() as session:
        session.execute(delete(Candidate).where(Candidate.owner_id == owner, Candidate.created_at < now() - timedelta(days=1)))
        for candidate in response["results"]:
            if candidate.get("import_url") and trusted_import_candidate(candidate, candidate["import_url"]):
                session.add(Candidate(owner_id=owner, url=candidate["import_url"], metadata_json=candidate))
    return {**response, "query": payload.query, "warning": " ".join(response["warnings"]) or None}


@app.post("/api/import", status_code=202)
def import_document(payload: ImportInput, owner: Owner):
    try:
        public_target(payload.url)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from None
    with Session.begin() as session:
        try:
            validate_folder(session, payload.folder_id, owner)
            check_quota(session, owner)
        except ValueError as exc:
            raise HTTPException(400, str(exc)) from None
        candidate = session.scalar(select(Candidate).where(Candidate.owner_id == owner, Candidate.url == payload.url, Candidate.created_at >= now() - timedelta(days=1)).order_by(Candidate.created_at.desc()))
        trusted = candidate and trusted_import_candidate(candidate.metadata_json, payload.url)
        if not trusted and not payload.rights_confirmed:
            raise HTTPException(400, "This URL has no verified full-text copy with a usable import license. Discover it again, or confirm your permission; the actual document will still be checked before import.")
        metadata = candidate.metadata_json if trusted else {"license": "User-confirmed permission", "source_url": payload.source_url or payload.url, "title": payload.title}
        existing = session.scalars(select(Job).where(Job.owner_id == owner, Job.status.in_(["queued", "processing"]))).all()
        for job in existing:
            if job.payload.get("url") == payload.url:
                return {"job_id": job.id, "duplicate": True}
        job = Job(owner_id=owner, payload={"operation": "import", "url": payload.url, "title": payload.title or metadata.get("title"), "folder_id": payload.folder_id, "metadata": metadata})
        session.add(job)
        session.flush()
        job_id = job.id
    queue_or_report(job_id)
    return {"job_id": job_id}


@app.get("/api/jobs/{job_id}")
def get_job(job_id: str, owner: Owner):
    with Session() as session:
        job = session.get(Job, job_id)
        if not job or job.owner_id != owner:
            raise HTTPException(404, "Task not found")
        return {"id": job.id, "status": job.status, "stage": job.stage, "document_id": job.document_id, "error": job.error}


@app.delete("/api/jobs/{job_id}")
def cancel_job(job_id: str, owner: Owner):
    with _mutation_lock, Session.begin() as session:
        job = session.get(Job, job_id)
        if not job or job.owner_id != owner:
            raise HTTPException(404, "Task not found")
        if job.status in ("queued", "processing"):
            job.status, job.stage = "cancelled", "Cancelled"
            document = session.get(Document, job.document_id) if job.document_id else None
            if document and document.status != "ready":
                document.status, document.error = "failed", "Processing was cancelled. You can retry."
        return {"id": job.id, "status": job.status, "stage": job.stage}


@app.post("/internal/jobs/{job_id}", dependencies=[Depends(verify_worker)])
def process_cloud_task(job_id: str):
    run_job(job_id)
    return {"accepted": True}
