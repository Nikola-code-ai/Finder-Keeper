from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    app_env: str = "development"
    auth_mode: str = "local"
    data_dir: Path = Path(__file__).resolve().parent.parent / ".data"
    database_url: str = ""
    storage_backend: str = "local"
    gcs_bucket_name: str = ""
    # AWS deployment (infra/aws): S3 files, SQS jobs, Aurora IAM database authentication.
    aws_region: str = ""
    s3_bucket_name: str = ""
    jobs_queue_url: str = ""
    db_iam_auth: bool = False
    worker_mode: bool = False
    startup_tasks: bool = True
    firebase_check_revoked: bool = True
    model_dir: Path | None = None
    google_cloud_project: str = ""
    firebase_project_id: str = ""
    gcp_location: str = "us-central1"
    embedding_provider: str = "fastembed"
    embedding_model: str = "BAAI/bge-small-en-v1.5"
    embedding_dimensions: int = 384
    gemini_model: str = ""
    openalex_api_key: str = ""
    unpaywall_email: str = ""
    contact_email: str = ""
    max_upload_mb: int = 25
    max_pages: int = 1000
    max_documents: int = 500
    max_jobs_per_hour: int = 30
    seed_library: bool = True
    allowed_origins: str = "http://localhost:3000,http://127.0.0.1:3000"
    tasks_queue: str = ""
    tasks_service_account: str = ""
    worker_url: str = ""
    ollama_url: str = "http://127.0.0.1:11434"
    ollama_model: str = "qwen2.5:3b"
    ollama_enabled: bool = True

    @property
    def db_url(self):
        url = self.database_url or f"sqlite:///{self.data_dir / 'library.db'}"
        if url.startswith("postgresql://"):
            url = url.replace("postgresql://", "postgresql+psycopg://", 1)
        return url

    @property
    def models_path(self):
        return self.model_dir or self.data_dir / "models"

    @property
    def queued(self):
        """Jobs run on a durable external queue (SQS or Cloud Tasks) rather than the local thread pool."""
        return bool(self.jobs_queue_url or self.tasks_queue)

    @property
    def max_bytes(self):
        return self.max_upload_mb * 1024 * 1024

    def validate_runtime(self):
        if self.auth_mode not in {"local", "firebase"}:
            raise RuntimeError("AUTH_MODE must be local or firebase")
        if self.app_env == "production":
            if self.auth_mode != "firebase":
                raise RuntimeError("Production requires AUTH_MODE=firebase")
            if not self.firebase_project_id:
                raise RuntimeError("Production requires FIREBASE_PROJECT_ID")
            if not ((self.storage_backend == "gcs" and self.gcs_bucket_name) or (self.storage_backend == "s3" and self.s3_bucket_name)):
                raise RuntimeError("Production requires private GCS or S3 storage")
            if not self.db_url.startswith("postgresql"):
                raise RuntimeError("Production requires PostgreSQL")
            if not (self.jobs_queue_url or all([self.tasks_queue, self.tasks_service_account, self.worker_url])):
                raise RuntimeError("Production requires an SQS queue or a Cloud Tasks queue, identity, and worker URL")
        if self.storage_backend not in {"local", "gcs", "s3"}:
            raise RuntimeError("STORAGE_BACKEND must be local, gcs or s3")
        if self.embedding_provider not in {"fastembed", "vertex"}:
            raise RuntimeError("EMBEDDING_PROVIDER must be fastembed or vertex")
        if self.embedding_provider == "vertex" and self.embedding_model.startswith("BAAI/"):
            self.embedding_model = "gemini-embedding-001"
        if self.embedding_provider == "fastembed" and self.embedding_dimensions != 384:
            raise RuntimeError("Local bge-small embeddings require 384 dimensions")


settings = Settings()
