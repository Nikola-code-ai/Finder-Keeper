import hashlib
import json
import logging
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from pathlib import Path
from threading import Lock
from urllib.parse import urlparse

from sqlalchemy import delete, func, select, update
from sqlalchemy.exc import IntegrityError

from .acquisition import verify_document
from .config import settings
from .database import Chunk, Document, Folder, Job, Page, Session, now, uid
from .discovery import download_public
from .embeddings import embeddings
from .extraction import chunk_pages, detect_type, extract_pages
from .storage import storage

logger = logging.getLogger(__name__)
executor = ThreadPoolExecutor(max_workers=2, thread_name_prefix="keeper")
_mutation_lock = Lock()


def set_stage(job_id, stage, status="processing"):
    with Session.begin() as session:
        job = session.get(Job, job_id)
        if not job or job.status == "cancelled":
            raise ValueError("This task was cancelled")
        job.stage, job.status = stage, status


def validate_folder(session, folder_id, owner):
    if folder_id:
        folder = session.get(Folder, folder_id)
        if not folder or folder.owner_id != owner:
            raise ValueError("Folder not found")


def check_quota(session, owner, document_limit=True, job_limit=True):
    count = session.scalar(select(func.count()).select_from(Document).where(Document.owner_id == owner))
    if document_limit and count >= settings.max_documents:
        raise ValueError(f"Your library has reached its {settings.max_documents}-document limit")
    recent = session.scalar(select(func.count()).select_from(Job).where(Job.owner_id == owner, Job.created_at >= now() - timedelta(hours=1)))
    if job_limit and recent >= settings.max_jobs_per_hour:
        raise ValueError(f"The import limit is {settings.max_jobs_per_hour} documents per hour. Please try again later.")


def store_document(data, filename, owner, folder_id=None, content_type="", title=None, metadata=None, check_rate=True):
    metadata = metadata or {}
    if not data or len(data) > settings.max_bytes:
        raise ValueError(f"Choose a non-empty document smaller than {settings.max_upload_mb} MB")
    kind, mime, extension = detect_type(data, filename, content_type)
    if not filename.lower().endswith((".pdf", ".txt", ".md", ".html", ".htm", ".epub")):
        filename += extension
    digest = hashlib.sha256(data).hexdigest()
    with _mutation_lock, Session() as session:
        validate_folder(session, folder_id, owner)
        existing = session.scalar(select(Document).where(Document.owner_id == owner, Document.content_hash == digest))
        if existing:
            return existing, True
        check_quota(session, owner, job_limit=check_rate)
        document_id = uid()
        owner_key = hashlib.sha256(owner.encode()).hexdigest()[:24]
        key = f"{owner_key}/{document_id}{extension}"
        storage.put(key, data, mime)
        document = Document(
            id=document_id, owner_id=owner, title=(title or Path(filename).stem.replace("_", " "))[:500],
            filename=Path(filename).name[:500], kind=kind, mime_type=mime, file_size=len(data),
            folder_id=folder_id, content_hash=digest, storage_key=key,
            source_url=metadata.get("source_url"), license=metadata.get("license"),
            authors=metadata.get("authors", []), year=metadata.get("year"), is_starter=metadata.get("is_starter", False),
        )
        session.add(document)
        try:
            session.commit()
        except IntegrityError:
            session.rollback()
            storage.delete(key)
            existing = session.scalar(select(Document).where(Document.owner_id == owner, Document.content_hash == digest))
            if existing:
                return existing, True
            raise
        return document, False


def process_document(document_id, job_id):
    with Session() as session:
        document = session.get(Document, document_id)
        if not document or document.status == "deleting":
            raise ValueError("The document was removed")
        document.status = "processing"
        document.error = None
        session.commit()
        data = storage.get(document.storage_key)
        kind, owner, title = document.kind, document.owner_id, document.title
    set_stage(job_id, "Reading document pages")
    pages = extract_pages(data, kind)
    chunks = chunk_pages(pages)
    set_stage(job_id, "Creating semantic embeddings")
    vectors = embeddings.embed([f"{title}\n\n{chunk['text']}" for chunk in chunks])
    set_stage(job_id, "Adding passages to your library")
    with _mutation_lock, Session.begin() as session:
        document = session.scalar(select(Document).where(Document.id == document_id).with_for_update())
        job = session.scalar(select(Job).where(Job.id == job_id).with_for_update())
        if not document or not job or job.status == "cancelled" or document.status == "deleting":
            raise ValueError("The document was removed or processing was cancelled")
        session.execute(delete(Page).where(Page.document_id == document_id))
        session.execute(delete(Chunk).where(Chunk.document_id == document_id))
        session.add_all([Page(document_id=document_id, **page) for page in pages])
        session.add_all([Chunk(document_id=document_id, owner_id=owner, embedding=vector, embedding_model=settings.embedding_model, **chunk) for chunk, vector in zip(chunks, vectors, strict=True)])
        document.page_count = len(pages)
        document.summary = pages[0]["text"][:280].replace("\n", " ")
        document.embedding_model = settings.embedding_model
        document.status = "ready"
        job.status, job.stage, job.error = "completed", "Ready to read and search", None


def run_job(job_id):
    with Session.begin() as session:
        claimed = session.execute(update(Job).where(Job.id == job_id, Job.status == "queued").values(status="processing", stage="Starting", updated_at=now()))
        if not claimed.rowcount:
            return
        job = session.get(Job, job_id)
        payload, owner, document_id = job.payload, job.owner_id, job.document_id
    try:
        if payload.get("operation") == "import" and not document_id:
            set_stage(job_id, "Retrieving the permitted copy")
            data, content_type, final_url = download_public(payload["url"])
            set_stage(job_id, "Verifying full text and document identity")
            metadata = payload.get("metadata") or {}
            verified = verify_document(data, content_type, final_url, expected_title=metadata.get("title"), expected_doi=metadata.get("doi"), expected_kind="book" if metadata.get("kind", "").lower() == "book" else None)
            if not verified["import_supported"]:
                raise ValueError(f"The verified document exceeds the {settings.max_pages}-page processing limit")
            content_type = verified["mime_type"]
            set_stage(job_id, "Saving the original document")
            filename = Path(urlparse(final_url).path).name or "document.pdf"
            document, duplicate = store_document(
                data, filename, owner, payload.get("folder_id"), content_type,
                payload.get("title"), payload.get("metadata"), check_rate=False,
            )
            document_id = document.id
            with Session.begin() as session:
                job = session.get(Job, job_id)
                if job.status == "cancelled":
                    if not duplicate:
                        storage.delete(document.storage_key)
                        session.delete(session.get(Document, document.id))
                    return
                job.document_id = document_id
                if duplicate and document.status == "ready":
                    job.status, job.stage = "completed", "Already in your library"
                    return
        if document_id:
            process_document(document_id, job_id)
        else:
            raise ValueError("This task has no document")
    except Exception as exc:
        logger.warning("Processing failed for job %s: %s", job_id, type(exc).__name__)
        message = str(exc) if isinstance(exc, ValueError) else f"Processing failed ({type(exc).__name__}). Retry after checking the source and connection."
        with Session.begin() as session:
            job = session.get(Job, job_id)
            if job and job.status != "cancelled":
                job.status, job.stage, job.error = "failed", "Could not finish", message[:500]
            document = session.get(Document, document_id) if document_id else None
            if document and document.status != "ready":
                document.status, document.error = "failed", message[:500]
        if settings.tasks_queue and not isinstance(exc, ValueError):
            with Session.begin() as session:
                job = session.get(Job, job_id)
                if job and job.status != "cancelled":
                    job.status, job.stage = "queued", "Waiting for an automatic retry"
            raise


def dispatch(job_id):
    if settings.tasks_queue:
        from google.cloud import tasks_v2
        client = tasks_v2.CloudTasksClient()
        client.create_task(parent=settings.tasks_queue, task={
            "http_request": {
                "http_method": tasks_v2.HttpMethod.POST,
                "url": f"{settings.worker_url.rstrip('/')}/internal/jobs/{job_id}",
                "headers": {"Content-Type": "application/json"}, "body": json.dumps({}).encode(),
                "oidc_token": {"service_account_email": settings.tasks_service_account, "audience": settings.worker_url},
            },
            "dispatch_deadline": {"seconds": 900},
        })
    else:
        executor.submit(run_job, job_id)


def recover_jobs():
    with Session.begin() as session:
        query = select(Job).where(Job.status.in_(["queued", "processing"]))
        if settings.app_env == "production":
            query = query.where(Job.updated_at < now() - timedelta(minutes=20))
        pending = session.scalars(query).all()
        ids = []
        for job in pending:
            job.status, job.stage = "queued", "Resuming interrupted work"
            ids.append(job.id)
    for job_id in ids:
        dispatch(job_id)
