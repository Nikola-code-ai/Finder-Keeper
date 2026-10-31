# Optional infrastructure and migration

The current product runs locally with no cloud account. Nothing in this directory is started by `setup-local.sh` or `dev.sh`. No GCP/Azure resource has been created. The infrastructure is a future starting point, not a verified deployment under the owner's $20/month ceiling.

## Local files

- `Dockerfile.frontend`: production Next.js standalone container; reads API and Firebase settings at runtime.
- `Dockerfile.backend`: FastAPI container with a project-local Python environment and a non-root user.
- `compose.postgres.yaml`: optional loopback PostgreSQL/pgvector database for adapter testing.
- `terraform`: optional GCP foundation. Provider initialization, formatting, and schema validation were completed locally. An authenticated plan and apply were not run.

The machine used for this build had Docker and uv, but no gcloud command, no default GCP credentials, no gcloud configuration, and no selected project environment variable. This does not affect local use. There is no reason to register a cloud account to try the application.

## Preserve portability

The original documents, metadata, page/chunk locations, ownership, and embeddings are distinct records. Moving to another provider should preserve the source URL, license, file hash, embedding model name, model dimension, and passage offsets. A model with the same vector dimension still produces a different vector space: changing the model requires re-embedding all documents and query text together.

For a cloud migration:

1. Stop imports and make a verified local backup. Keep a manifest of document IDs, content hashes, and counts of pages/chunks.
2. Create the chosen private object store and copy files, preserving storage keys. Verify SHA-256 hashes rather than assuming upload completion means parity.
3. Initialize PostgreSQL with the vector extension. Export the relational records from SQLite and load them in foreign-key order. Map the local owner to the chosen real identity. Requeue only unfinished jobs; never replay completed imports blindly.
4. Preserve existing vectors only when using the exact same embedding model and preprocessing. Otherwise re-index from the originals. Compare retrieval against a small known-answer corpus.
5. Deploy the API, worker, and frontend with authenticated service calls, a shared persistent database, and private file access. Set per-user quotas before accepting traffic.
6. Compare library counts, file hashes, retrieval citations, page locations, delete behavior, and an unauthorized-user request. Keep the local backup until the hosted flow passes.

The current project includes storage/configuration seams for local files and GCS, local SQLite and PostgreSQL, local embeddings and Vertex, and local jobs and Cloud Tasks. It does not yet provide a one-command cross-provider migration.

## GCP foundation

The optional Terraform configuration uses an existing billing-enabled project, private GCS, PostgreSQL 16 with backups, separate frontend/API/worker/task identities, an Artifact Registry repository, a bounded Cloud Tasks queue, Secret Manager, and optional Firebase email/password authentication.

The bucket has public-access prevention and uniform access. It has a seven-day soft-delete window, which can retain deleted bytes and incur storage costs during that window. No lifecycle rule expires saved library documents. Cloud SQL and the bucket have deletion safeguards. Database credentials are stored in Secret Manager; **Terraform state also contains the generated database password**, so state must be kept private and later moved to an access-controlled remote backend.

The default `db-g1-small` is retained as an example with room for a small vector index, but its compute cost alone exceeds the current budget. The configuration explicitly refuses a paid-resource plan until `acknowledge_paid_cloud_resources=true` is supplied. Do not enable it as part of the local workflow. An existing Firebase project should be imported before management, or `enable_firebase_auth` should be false to avoid replacing configuration it already uses.

Preparation, once a project and affordable architecture have actually been selected:

```sh
# These initialize tooling and inspect configuration; they do not deploy resources.
terraform -chdir=infra/terraform init
terraform -chdir=infra/terraform validate
```

An authenticated plan needs Application Default Credentials and actual values in `terraform.tfvars`. Review its cost and ownership before applying. Provider lock files are included. The Firebase public web configuration may be exposed to the browser, while the database secret must never be included in frontend settings.

The foundation does not create Cloud Run services. To finish a GCP deployment after the budget decision:

- Build each Dockerfile from the repository root and push immutable image tags to the Artifact Registry output.
- Run `python -m app.init_db` as a one-off Cloud Run migration job using the backend image, worker identity, database secret, and Cloud SQL socket mount.
- Deploy a private worker and private API from the backend image. Mount `/cloudsql/INSTANCE_CONNECTION_NAME`. Grant only the frontend identity permission to invoke the API, and only the task identity permission to invoke the worker. Set zero minimum instances; start with one worker instance and concurrency one.
- Supply production backend variables: `APP_ENV=production`, `AUTH_MODE=firebase`, `DATABASE_URL` from its pinned secret version, `FIREBASE_PROJECT_ID`, `STORAGE_BACKEND=gcs`, `GCS_BUCKET_NAME`, the queue path, `TASKS_SERVICE_ACCOUNT`, and `WORKER_URL`. Select either local model weights baked/cached in the container or a priced Vertex embedding model. Production must not inherit local-auth settings.
- Deploy the frontend with `API_INTERNAL_URL` pointing to the API service, `CLOUD_RUN_PROXY_AUTH=true`, and the four Firebase public client values. The proxy uses `X-Serverless-Authorization` for service identity while preserving the user's Firebase bearer token in `Authorization`.
- Add the frontend hostname to Firebase authorized domains and test an authenticated import, signed-in library retrieval, unauthorized access, worker retry, and deletion. Keep the source bucket private; file reads go through authorization.

Cloud SQL socket connections require the Cloud SQL Client role. Cloud Tasks uses an OIDC task identity and a Cloud Run Invoker binding; the backend checks the expected task audience and service account. [Cloud SQL connections](https://docs.cloud.google.com/sql/docs/postgres/connect-run), [Cloud Tasks authentication](https://docs.cloud.google.com/tasks/docs/creating-http-target-tasks), [Cloud Run service authentication](https://docs.cloud.google.com/run/docs/authenticating/service-to-service).

Large scanned PDFs needing OCR and processing beyond a task's request deadline require a separately tested jobs/OCR path. Do not claim support by merely raising the upload limit.

## Azure mapping

The same containers can be adapted to Azure Container Apps; its HTTP scaling can reach zero replicas. Azure Blob Storage would replace the local/GCS storage adapter with managed-identity access. Azure Database for PostgreSQL supports pgvector after extension allowlisting. A queue adapter and identity verification/configuration also need implementation and tests. These are a migration design, not shipped Azure integration. [Container Apps scaling](https://learn.microsoft.com/en-us/azure/container-apps/scale-app), [Blob Storage Python authentication](https://learn.microsoft.com/en-us/azure/storage/blobs/storage-blob-python-get-started), [Azure pgvector](https://learn.microsoft.com/en-us/azure/postgresql/extensions/how-to-use-pgvector).

Do not assume Azure managed PostgreSQL is within the ceiling. Select a region, measure the working set and monthly usage, and price the complete configuration first.

## Budget sizing

The local default uses 0 paid cloud requests. A future planning workload might be 200 imports/month at 20 pages each, 1 GB of original documents, and 1,000 library queries/month. Those are assumptions, not measured usage. Benchmark extraction seconds, memory, query tokens, and chunk counts locally before turning them into a cost estimate.

For an illustrative Cloud Run request-billed workload of 10,000 vCPU-seconds and 10,000 GiB-seconds/month, Iowa on-demand CPU and memory rates give $0.24 + $0.025 = **$0.265 before free-tier credits**, request counts, builds, network transfer, storage, database, and AI. This is arithmetic for those assumptions, not a project quote. Cold starts and concurrent requests change actual billed time. [Cloud Run pricing](https://cloud.google.com/run/pricing), checked October 19, 2026.

The fixed database can dominate this application: `db-g1-small` at $0.035/hour is $25.55 per 730-hour month before other charges. Therefore it is not an acceptable default deployment for this $20 requirement. [Cloud SQL pricing](https://cloud.google.com/sql/pricing?hl=en), checked October 19, 2026.

Before any hosted release, set application usage quotas, maximum instances, bounded retries, explicit retention, log limits, and billing notifications. Notifications alone are not a hard cap. Keep at least a small margin for backups and outbound file downloads; test the chosen provider's actual billing behavior before describing hosting as budget-compliant.
