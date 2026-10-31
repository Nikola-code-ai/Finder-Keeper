
from .config import settings


class Storage:
    def __init__(self):
        self.base = settings.data_dir / "files"
        self.base.mkdir(parents=True, exist_ok=True)
        self._bucket = None

    @property
    def bucket(self):
        if self._bucket is None:
            from google.cloud import storage
            self._bucket = storage.Client(project=settings.google_cloud_project or None).bucket(settings.gcs_bucket_name)
        return self._bucket

    def local_path(self, key):
        path = (self.base / key).resolve()
        if not path.is_relative_to(self.base.resolve()):
            raise ValueError("Invalid storage key")
        return path

    def put(self, key: str, data: bytes, mime_type: str):
        if settings.storage_backend == "gcs":
            self.bucket.blob(key).upload_from_string(data, content_type=mime_type, if_generation_match=0)
        else:
            path = self.local_path(key)
            path.parent.mkdir(parents=True, exist_ok=True)
            temporary = path.with_suffix(".partial")
            temporary.write_bytes(data)
            temporary.replace(path)

    def get(self, key):
        if settings.storage_backend == "gcs":
            return self.bucket.blob(key).download_as_bytes()
        return self.local_path(key).read_bytes()

    def delete(self, key):
        if settings.storage_backend == "gcs":
            from google.api_core.exceptions import NotFound
            try:
                self.bucket.blob(key).delete()
            except NotFound:
                pass
        else:
            self.local_path(key).unlink(missing_ok=True)


storage = Storage()
