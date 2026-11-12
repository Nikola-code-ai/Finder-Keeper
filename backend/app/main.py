import hashlib
import json
import logging
import secrets
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
from .auth import current_email, current_owner, verify_worker
from .community import router as community_router
from .config import settings
from .database import (
    Candidate,
    Chunk,
    Document,
    Folder,
    Job,
    Page,
    Session,
    Share,
    document_dict,
    init_db,
    now,
)
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
    # On Lambda the schema is migrated by a one-off bootstrap and frozen threads cannot finish start-up work.
    if settings.startup_tasks:
        init_db()
    retrieval.detect_ollama()
    if settings.startup_tasks:
        executor.submit(initialize_library)
    yield


app = FastAPI(title="Finder-Keeper", version="0.1.0", lifespan=lifespan)
app.add_middleware(BodySizeLimitMiddleware, max_bytes=settings.max_bytes + 1024 * 1024)
app.add_middleware(CORSMiddleware, allow_origins=settings.allowed_origins.split(","), allow_credentials=False, allow_methods=["GET", "POST", "PATCH", "DELETE"], allow_headers=["Authorization", "Content-Type"])
Owner = Annotated[str, Depends(current_owner)]
Email = Annotated[str, Depends(current_email)]
# The commons: reading flows, readers, open shelves, reviews, comments and follows.
app.include_router(community_router)


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
    return {"id": folder.id, "name": folder.name, "color": folder.color, "parent_id": folder.parent_id, "count": sum(doc.folder_id == folder.id for doc in documents), "published": bool(folder.published), "published_at": folder.published_at, "description": folder.description or ""}


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


class ShareInput(BaseModel):
    email: str | None = Field(default=None, max_length=320)
    link: bool = False
    role: Literal["viewer"] = "viewer"


def share_dict(share, folder=None):
    return {"id": share.id, "folder_id": share.folder_id, "email": share.grantee_email, "role": share.role, "link": f"/shared/{share.token}" if share.token else None, "owner_email": share.owner_email, "folder_name": folder.name if folder else None}


def shared_folder_ids(session, email):
    """Collections lent to this address, plus the dividers inside them."""
    if not email:
        return {}
    shares = session.scalars(select(Share).where(Share.grantee_email == email)).all()
    access = {}
    for share in shares:
        access[share.folder_id] = share
        for child in session.scalars(select(Folder.id).where(Folder.parent_id == share.folder_id)).all():
            access[child] = share
    return access


def readable_document(session, document_id, owner, email):
    """Your own document, or one inside a collection a friend lent you."""
    document = session.get(Document, document_id)
    if not document:
        raise HTTPException(404, "Document not found")
    if document.owner_id == owner:
        return document
    if document.folder_id and document.folder_id in shared_folder_ids(session, email):
        return document
    raise HTTPException(404, "Document not found")


def link_folder(session, token):
    share = session.scalar(select(Share).where(Share.token == token)) if token else None
    folder = session.get(Folder, share.folder_id) if share else None
    if not share or not folder:
        raise HTTPException(404, "This link does not open anything")
    return share, folder


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
        "storage": {"local": "Local private files", "s3": "Amazon S3"}.get(settings.storage_backend, "Google Cloud Storage"),
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
def library(owner: Owner, email: Email):
    with Session() as session:
        documents = session.scalars(select(Document).where(Document.owner_id == owner).order_by(Document.created_at.desc())).all()
        folders = session.scalars(select(Folder).where(Folder.owner_id == owner).order_by(Folder.created_at)).all()
        return {"folders": [folder_dict(folder, documents) for folder in folders], "documents": [document_dict(doc) for doc in documents], "shared": shared_with_me(session, email)}


def shared_with_me(session, email):
    """Collections friends have lent to this address, with what is in them."""
    out = []
    seen = set()
    for share in session.scalars(select(Share).where(Share.grantee_email == email).order_by(Share.created_at)).all():
        if share.folder_id in seen:
            continue
        seen.add(share.folder_id)
        folder = session.get(Folder, share.folder_id)
        if not folder:
            continue
        ids = [folder.id, *session.scalars(select(Folder.id).where(Folder.parent_id == folder.id)).all()]
        docs = session.scalars(select(Document).where(Document.folder_id.in_(ids), Document.status == "ready").order_by(Document.created_at.desc())).all()
        out.append({"id": folder.id, "name": folder.name, "color": folder.color, "owner_email": share.owner_email, "role": share.role, "count": len(docs), "documents": [document_dict(doc) for doc in docs]})
    return out


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
    return accept_upload(data, file.filename or "document.pdf", file.content_type or "", owner, folder_id or None)


class UploadInput(BaseModel):
    filename: str = Field(min_length=1, max_length=500)
    content_type: str = Field("", max_length=200)
    size: int = Field(ge=0)


class UploadComplete(BaseModel):
    filename: str = Field(min_length=1, max_length=500)
    content_type: str = Field("", max_length=200)
    folder_id: str | None = None


def incoming_prefix(owner):
    return f"incoming/{hashlib.sha256(owner.encode()).hexdigest()[:24]}/"


@app.post("/api/uploads")
def start_upload(payload: UploadInput, owner: Owner):
    """Large files go straight to S3 on AWS; other backends keep the multipart upload."""
    if settings.storage_backend != "s3":
        return {"mode": "multipart"}
    if not 0 < payload.size <= settings.max_bytes:
        raise HTTPException(400, f"Choose a non-empty document smaller than {settings.max_upload_mb} MB")
    upload_id = secrets.token_urlsafe(18)
    post = storage.presigned_upload(incoming_prefix(owner) + upload_id, settings.max_bytes)
    return {"mode": "direct", "upload_id": upload_id, "url": post["url"], "fields": post["fields"]}


@app.post("/api/uploads/{upload_id}/complete", status_code=202)
def complete_upload(upload_id: str, payload: UploadComplete, owner: Owner):
    if settings.storage_backend != "s3" or not upload_id.replace("-", "").replace("_", "").isalnum():
        raise HTTPException(404, "Upload not found")
    key = incoming_prefix(owner) + upload_id
    try:
        if storage.size(key) > settings.max_bytes:
            raise HTTPException(400, f"Choose a non-empty document smaller than {settings.max_upload_mb} MB")
        data = storage.get(key)
    except HTTPException:
        storage.delete(key)
        raise
    except Exception:
        raise HTTPException(404, "Upload not found") from None
    storage.delete(key)
    return accept_upload(data, payload.filename, payload.content_type, owner, payload.folder_id or None)


def accept_upload(data, filename, content_type, owner, folder_id):
    try:
        document, duplicate = store_document(data, filename, owner, folder_id, content_type, metadata={"license": "User-provided document"})
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
def get_document(document_id: str, owner: Owner, email: Email):
    with Session() as session:
        document = readable_document(session, document_id, owner, email)
        pages = session.scalars(select(Page).where(Page.document_id == document_id).order_by(Page.page_number)).all()
        chunks = session.scalars(select(Chunk).where(Chunk.document_id == document_id).order_by(Chunk.position)).all()
        return {**document_dict(document), "pages": [{"page_number": page.page_number, "text": page.text} for page in pages], "chunks": [{"id": chunk.id, "page_number": chunk.page_number, "start_char": chunk.start_char, "end_char": chunk.end_char, "embedding_model": chunk.embedding_model} for chunk in chunks]}


def document_file_response(document, download):
    disposition = "attachment" if download or document.kind == "Article" else "inline"
    # Imported HTML is never rendered in the app's origin; the extracted-text reader is safe.
    if settings.storage_backend == "local":
        return FileResponse(storage.local_path(document.storage_key), media_type=document.mime_type, filename=document.filename, content_disposition_type=disposition, headers={"Content-Security-Policy": "sandbox"})
    from urllib.parse import quote
    return Response(storage.get(document.storage_key), media_type=document.mime_type, headers={"Content-Disposition": f"{disposition}; filename*=UTF-8''{quote(document.filename)}", "Content-Security-Policy": "sandbox"})


@app.get("/api/folders/{folder_id}/shares")
def list_shares(folder_id: str, owner: Owner):
    with Session() as session:
        folder = session.get(Folder, folder_id)
        if not folder or folder.owner_id != owner:
            raise HTTPException(404, "Folder not found")
        return {"shares": [share_dict(s, folder) for s in session.scalars(select(Share).where(Share.folder_id == folder_id).order_by(Share.created_at)).all()]}


@app.post("/api/folders/{folder_id}/shares", status_code=201)
def create_share(folder_id: str, payload: ShareInput, owner: Owner, email: Email):
    with Session.begin() as session:
        folder = session.get(Folder, folder_id)
        if not folder or folder.owner_id != owner:
            raise HTTPException(404, "Folder not found")
        if folder.parent_id:
            raise HTTPException(400, "Share the drawer this divider sits in; dividers travel with it")
        if payload.link:
            existing = session.scalar(select(Share).where(Share.folder_id == folder_id, Share.token.is_not(None)))
            if existing:
                return share_dict(existing, folder)
            share = Share(folder_id=folder_id, owner_id=owner, owner_email=email, token=secrets.token_urlsafe(24), role="viewer")
        else:
            grantee = (payload.email or "").strip().lower()
            if "@" not in grantee or len(grantee) < 5:
                raise HTTPException(400, "Give your friend's email address")
            if grantee == email:
                raise HTTPException(400, "That is your own address")
            existing = session.scalar(select(Share).where(Share.folder_id == folder_id, Share.grantee_email == grantee))
            if existing:
                return share_dict(existing, folder)
            share = Share(folder_id=folder_id, owner_id=owner, owner_email=email, grantee_email=grantee, role=payload.role)
        session.add(share)
        session.flush()
        return share_dict(share, folder)


@app.delete("/api/shares/{share_id}")
def revoke_share(share_id: str, owner: Owner):
    with Session.begin() as session:
        share = session.get(Share, share_id)
        if not share or share.owner_id != owner:
            raise HTTPException(404, "Share not found")
        session.delete(share)
    return {"revoked": True}


@app.get("/api/shared/{token}")
def open_link(token: str):
    """Anyone holding the link may read the collection; nothing else of the owner's is visible."""
    with Session() as session:
        share, folder = link_folder(session, token)
        ids = [folder.id, *session.scalars(select(Folder.id).where(Folder.parent_id == folder.id)).all()]
        docs = session.scalars(select(Document).where(Document.folder_id.in_(ids), Document.status == "ready").order_by(Document.created_at.desc())).all()
        return {"name": folder.name, "owner_email": share.owner_email, "documents": [document_dict(doc) for doc in docs]}


@app.get("/api/shared/{token}/documents/{document_id}")
def open_link_document(token: str, document_id: str):
    with Session() as session:
        share, folder = link_folder(session, token)
        ids = [folder.id, *session.scalars(select(Folder.id).where(Folder.parent_id == folder.id)).all()]
        document = session.get(Document, document_id)
        if not document or document.folder_id not in ids:
            raise HTTPException(404, "Document not found")
        pages = session.scalars(select(Page).where(Page.document_id == document_id).order_by(Page.page_number)).all()
        return {**document_dict(document), "pages": [{"page_number": page.page_number, "text": page.text} for page in pages]}


@app.get("/api/shared/{token}/documents/{document_id}/file")
def open_link_file(token: str, document_id: str, download: bool = False):
    with Session() as session:
        share, folder = link_folder(session, token)
        ids = [folder.id, *session.scalars(select(Folder.id).where(Folder.parent_id == folder.id)).all()]
        document = session.get(Document, document_id)
        if not document or document.folder_id not in ids:
            raise HTTPException(404, "Document not found")
        return document_file_response(document, download)


@app.get("/api/documents/{document_id}/file")
def get_document_file(document_id: str, owner: Owner, email: Email, download: bool = False):
    with Session() as session:
        document = readable_document(session, document_id, owner, email)
        return document_file_response(document, download)



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
def search_library(payload: SearchInput, owner: Owner, email: Email):
    if not embeddings.ready:
        raise HTTPException(503, "The embedding model is warming up. Please try again in a moment.")
    with Session() as session:
        owners, scope = search_scope(session, owner, email, payload.folder_id)
    results = retrieval.search(payload.query.strip(), owners, scope, payload.limit)
    return {"results": results, "query": payload.query, "method": "hybrid-semantic", "embedding_model": settings.embedding_model}


@app.post("/api/ask")
def ask_library(payload: SearchInput, owner: Owner, email: Email):
    if not embeddings.ready:
        raise HTTPException(503, "The embedding model is warming up. Please try again in a moment.")
    with Session() as session:
        owners, scope = search_scope(session, owner, email, payload.folder_id)
    return retrieval.ask(payload.query.strip(), owners, scope)


def search_scope(session, owner, email, folder_id):
    """Your own library, or one friend's lent collection when that is what you pointed at."""
    if not folder_id:
        return [owner], None
    folder = session.get(Folder, folder_id)
    if folder and folder.owner_id == owner:
        return [owner], folder_scope(session, owner, folder_id)
    share = shared_folder_ids(session, email).get(folder_id)
    if not share:
        raise HTTPException(404, "That collection does not exist")
    children = session.scalars(select(Folder.id).where(Folder.parent_id == folder_id)).all()
    return [share.owner_id], [folder_id, *children]


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


@app.post("/internal/sqs")
def process_sqs_batch(event: dict):
    """SQS events forwarded by the Lambda Web Adapter on the worker function only (AWS_LWA_PASS_THROUGH_PATH)."""
    if not settings.worker_mode:
        raise HTTPException(404, "Not found")
    failures = []
    for record in event.get("Records", []):
        try:
            run_job(json.loads(record["body"])["job_id"])
        except Exception:
            logger.exception("Job message %s failed", record.get("messageId"))
            failures.append({"itemIdentifier": record.get("messageId")})
    return {"batchItemFailures": failures}


@app.post("/internal/jobs/{job_id}", dependencies=[Depends(verify_worker)])
def process_cloud_task(job_id: str):
    run_job(job_id)
    return {"accepted": True}
