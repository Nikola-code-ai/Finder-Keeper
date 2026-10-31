# Finder-Keeper backend

Runs entirely on this computer by default. No cloud account or paid API is required. Original files, metadata, pages, passage vectors, and durable jobs live in `backend/.data/` (ignored by Git).

```sh
cd backend
uv sync --frozen
uv run uvicorn app.main:app --host 127.0.0.1 --port 8010
```

The first start downloads the quantized BGE-small embedding model (about 65 MB in the verified cache). Later starts load its cached files without network access. The six starter PDFs are original educational demonstration notes, labeled as such; they are not research papers. They are generated once, and deleting one does not make it reappear. Bundled DejaVu fonts provide repeatable PDF rendering; their license is in `assets/fonts/LICENSE.txt`.

If Next.js is already running, restore only the existing local backend from the repository root:

```sh
python3 scripts/backend.py start
python3 scripts/backend.py status
python3 scripts/backend.py stop
```

This Linux helper uses the existing `.venv`, cached embedding model, library database, and `scripts/dev.py` environment reader. It creates a transient `finder-keeper-backend.service` under your systemd user session, so the backend survives a terminal or agent finishing and restarts on failure. `start` is safe to repeat and recreates the service after `stop`; it leaves an unrelated process on the backend port untouched. No packages, persistent system configuration, or login/reboot autostart are installed. The service lasts for the current user-manager/login session. The normal `./scripts/dev.sh` workflow still starts both services in the foreground; stop the independent backend before using that workflow. Read service logs with `journalctl --user-unit=finder-keeper-backend.service -n 40`.

## Local answers and retrieval

- **Embeddings:** FastEmbed / `BAAI/bge-small-en-v1.5`, CPU, 384 dimensions, two inference threads and batches of 16 passages to bound memory during long-book indexing. SQLite stores the actual normalized passage vectors. Queries use actual query embeddings plus keyword and title signals. Scores rank relevance; they are not confidence probabilities.
- **Grounded answers:** If the already-installed `qwen2.5:3b` is available at `http://127.0.0.1:11434`, the app uses Ollama with a bounded context/output and one concurrent answer. It does not install or download an LLM. Each request uses a one-minute keep-alive without changing global server settings. Structured citation IDs are checked against supplied passages. Model failure or invalid citations falls back to exact extracts, visibly labeled `grounded-extractive`.
- **Offline:** Saved-document search, file access, and local answers work without the internet after initial installation/model download. Online discovery and remote imports naturally need connectivity.
- **Pinpointing:** PDF extraction retains physical page numbers, releases each page’s layout cache, and stops at the text-size bound while parsing. HTML/text uses numbered sections. Each returned excerpt is a contiguous source span with exact character offsets; the full passage is retained separately for answer context. The UI can open the original PDF page and highlight the excerpt.

EPUB reading follows the package spine, preserves chapter headings in numbered sections, and rejects encrypted/DRM archives, external dependencies, malformed paths, excessive expansion, and oversized books. The reader can jump to a section and highlight its matching passage.

The supported ingestion formats are text-bearing PDFs, EPUB 2/3 books, UTF-8 `.txt`/`.md`, and HTML articles. OCR for scanned PDFs is not implemented. A scanned/image-only PDF produces a useful processing error and retains the original for download/retry.

## API

`GET /health`, `GET /api/status`, and `GET /api/library` expose health, capabilities, and owner-scoped library data. All `/api` routes enforce the owner.

Folders: `POST /api/folders`, `PATCH /api/folders/{id}`, `DELETE /api/folders/{id}`. Deleting a folder preserves its documents and rehomes them to the unfiled collection.

Documents: `POST /api/documents/upload` (multipart `file`, optional `folder_id`), `GET/PATCH/DELETE /api/documents/{id}`, `GET /api/documents/{id}/file?download=true`, and `POST /api/documents/{id}/retry`.

Retrieval: `POST /api/search` and `POST /api/ask`, with `{query, folder_id?, limit?}`. Search returns `{results, query, method, embedding_model}`. A result contains the document, page number, exact excerpt, full passage, start/end character positions, chunk ID, rank score, and match explanation. Ask returns `{answer, citations, mode, model?}`.

Discovery: `POST /api/discover` with `{query, kind?: "any"|"book"|"paper"}` returns `{results, unavailable_results, warnings, provider, search_terms}`. Default results contain only downloaded resources verified for substantive text, compatible file type, access gates, preview markers, and plausible document identity. Catalogs, abstracts, restricted copies, and unchecked matches remain separate. Explicit titles and title-case requests distinguish related works before provider fallback; this is a conservative heuristic, not an edition guarantee. A candidate exposes `read_url`, `import_url`, `format` (PDF/HTML/EPUB/TEXT), per-copy `assets`, `access_status`, and `importable`. The verification scope is returned honestly: a valid resource and plausible identity do not independently certify every edition's completeness.

Books search OpenStax/Gutendex and OAPEN before OpenAlex/Crossref. Other searches use OpenAlex/Crossref with open-book fallback when the type is unspecified. Each provider continues when it yields no usable copy; alternate locations are checked within bounded time, size, and concurrency limits. Discovery has an 85-second overall budget, with separately bounded provider requests; metadata for copies not checked before the limit is retained. Verified content checks are cached for ten minutes without storing downloaded bytes. During live checks, OAPEN returned HTTP 403 and Gutendex text searches timed out; those failures are surfaced. Some free OpenStax books exceed the 25 MB download cap and are accurately shown as unavailable within the app's limits.

Import: `POST /api/import` with `{url, title?, folder_id?, source_url?, license?, rights_confirmed?}`. Automatic imports require a recent server-stored candidate with a verified, specific full-text asset and applicable reuse license. Caller-provided license strings and old catalog-only records cannot bypass that check. A verified readable copy with unknown rights retains a read link and import URL, but `importable:false`; storing it requires `rights_confirmed:true`, the user's explicit assertion of permission. Gutenberg public-domain-US metadata is not treated as a universal license. Imported files are downloaded and checked again before saving/embedding, including direct links with confirmed permission. Explicitly uploaded files remain user-provided content. Returns a durable `{job_id}`; uploads return `{job_id, document, duplicate}`.

Jobs: `GET /api/jobs/{id}`, `DELETE /api/jobs/{id}` (cancel), and `POST /api/jobs/{id}/retry`. Stages distinguish downloading, saving, reading, embedding, and completion. Local restarts recover queued/interrupted work. Repeated bytes are deduplicated within an owner's library.

## Configuration

See the repository `.env.example`. Backend settings are case-insensitive environment variables, also read from `backend/.env`:

| Variable | Default / purpose |
| --- | --- |
| `DATA_DIR` | Absolute `backend/.data` path |
| `DATABASE_URL` | SQLite under the data directory; optional `postgresql+psycopg://…` |
| `AUTH_MODE` | `local`; optional `firebase` |
| `APP_ENV` | `development`; production rejects local auth/storage/database configuration |
| `EMBEDDING_PROVIDER` | `fastembed`; optional `vertex` |
| `EMBEDDING_MODEL` | `BAAI/bge-small-en-v1.5`; Vertex uses `gemini-embedding-001` |
| `EMBEDDING_DIMENSIONS` | `384`; changing provider/model requires reindexing the library |
| `OLLAMA_ENABLED` | `true`; only uses a model already present on the configured server |
| `OLLAMA_URL` / `OLLAMA_MODEL` | `http://127.0.0.1:11434` / `qwen2.5:3b` |
| `OPENALEX_API_KEY` | Optional; anonymous discovery uses the provider's shared limit |
| `UNPAYWALL_EMAIL` | Optional; enables DOI access lookup during Crossref fallback |
| `CONTACT_EMAIL` | Optional provider contact identifier |
| `MAX_UPLOAD_MB` / `MAX_PAGES` | `25` / `1000` |
| `MAX_DOCUMENTS` / `MAX_JOBS_PER_HOUR` | `500` / `30` |
| `SEED_LIBRARY` | `true` in local mode; starter notes never seed into real accounts |
| `STORAGE_BACKEND` / `GCS_BUCKET_NAME` | `local`; optional private `gcs` bucket |

Local mode accepts only loopback peers and recognized localhost hostnames, and rejects cross-origin browser requests. Do not expose it through an unrestricted public proxy. Firebase mode verifies the ID token (including revocation) and applies the UID to folders, files, jobs, and retrieval.

Optional GCP adapters are supplied, but were not deployed or acceptance-tested against cloud resources. They require ADC/service accounts, a PostgreSQL database with `vector`, a private bucket, Firebase, and configured Cloud Tasks. `uv run python -m app.init_db` creates the schema and vector/FTS indexes. Cloud SQL and external model usage can incur costs; local mode avoids them. Keep the CPU embedding model when moving storage if you want to reuse its vectors, or reindex every document before changing embedding models.

## Trust and limits

Remote imports allow public HTTPS on port 443. Every DNS answer and redirect is checked, and connections are pinned to a validated public IP while preserving TLS hostname validation. This blocks private addresses, cloud metadata endpoints, and DNS rebinding. Downloads and incoming streamed uploads are bounded. HTML downloads are served as attachments with a sandbox policy; the reader uses extracted text.

Documents are untrusted evidence. Their contents are never tool instructions, and the answering model has no file/network tools. Citation validation checks location references, not the factual correctness of every generated sentence; readers can always inspect the actual source. OpenAlex/Crossref availability, source download permission, scanned PDFs, and provider rate limits are surfaced rather than simulated.

## Verification

```sh
uv run pytest -q
uv run ruff check app tests
```

Tests use a separate temporary database/storage directory and the cached real embedding model. They cover semantic paraphrases and source offsets, unrelated queries, ownership, local-origin restrictions, SSRF and redirects, file lifecycle, duplicates, quotas, cancellation/restart/retry, model citation validation, deterministic starter PDFs, and streamed upload limits. Live OpenAlex discovery, a CC-BY arXiv download/index/delete (11 pages, 42 chunks), local Ollama cited generation, and embedding startup with connections disabled were also checked during implementation. No cloud deployment is claimed.
