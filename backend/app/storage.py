
from .config import settings


class Storage:
    def __init__(self):
        self.base = settings.data_dir / "files"
        self.base.mkdir(parents=True, exist_ok=True)
        self._bucket = None
        self._s3 = None

    @property
    def bucket(self):
        if self._bucket is None:
            from google.cloud import storage
            self._bucket = storage.Client(project=settings.google_cloud_project or None).bucket(settings.gcs_bucket_name)
        return self._bucket

    @property
    def s3(self):
        if self._s3 is None:
            import boto3
            from botocore.config import Config
            # Regional virtual-host addressing so presigned browser uploads are not redirected.
            self._s3 = boto3.client("s3", region_name=settings.aws_region or None, config=Config(signature_version="s3v4", s3={"addressing_style": "virtual"}))
        return self._s3

    def local_path(self, key):
        path = (self.base / key).resolve()
        if not path.is_relative_to(self.base.resolve()):
            raise ValueError("Invalid storage key")
        return path

    def put(self, key: str, data: bytes, mime_type: str):
        if settings.storage_backend == "gcs":
            self.bucket.blob(key).upload_from_string(data, content_type=mime_type, if_generation_match=0)
        elif settings.storage_backend == "s3":
            self.s3.put_object(Bucket=settings.s3_bucket_name, Key=key, Body=data, ContentType=mime_type, IfNoneMatch="*")
        else:
            path = self.local_path(key)
            path.parent.mkdir(parents=True, exist_ok=True)
            temporary = path.with_suffix(".partial")
            temporary.write_bytes(data)
            temporary.replace(path)

    def get(self, key):
        if settings.storage_backend == "gcs":
            return self.bucket.blob(key).download_as_bytes()
        if settings.storage_backend == "s3":
            return self.s3.get_object(Bucket=settings.s3_bucket_name, Key=key)["Body"].read()
        return self.local_path(key).read_bytes()

    def delete(self, key):
        if settings.storage_backend == "gcs":
            from google.api_core.exceptions import NotFound
            try:
                self.bucket.blob(key).delete()
            except NotFound:
                pass
        elif settings.storage_backend == "s3":
            self.s3.delete_object(Bucket=settings.s3_bucket_name, Key=key)
        else:
            self.local_path(key).unlink(missing_ok=True)

    def presigned_upload(self, key: str, max_bytes: int, expires=600):
        """A browser form POST straight to S3, so large files bypass the 6 MB Lambda request limit."""
        return self.s3.generate_presigned_post(
            settings.s3_bucket_name, key, Conditions=[["content-length-range", 1, max_bytes]], ExpiresIn=expires,
        )

    def size(self, key):
        return self.s3.head_object(Bucket=settings.s3_bucket_name, Key=key)["ContentLength"]


storage = Storage()
