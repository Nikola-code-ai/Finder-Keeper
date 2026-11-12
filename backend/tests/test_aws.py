import json

import boto3
import pytest

import app.jobs as jobs
from app.config import Settings, settings
from app.storage import storage


class FakeS3:
    def __init__(self):
        self.objects = {}

    def put_object(self, Bucket, Key, Body, ContentType, IfNoneMatch):
        assert IfNoneMatch == "*" and Key not in self.objects
        self.objects[Key] = Body

    def get_object(self, Bucket, Key):
        return {"Body": type("Body", (), {"read": lambda _: self.objects[Key]})()}

    def head_object(self, Bucket, Key):
        if Key not in self.objects:
            raise KeyError(Key)
        return {"ContentLength": len(self.objects[Key])}

    def delete_object(self, Bucket, Key):
        self.objects.pop(Key, None)

    def generate_presigned_post(self, bucket, key, Conditions, ExpiresIn):
        return {"url": f"https://{bucket}.s3.us-east-2.amazonaws.com/", "fields": {"key": key}}


@pytest.fixture
def s3(monkeypatch):
    fake = FakeS3()
    monkeypatch.setattr(settings, "storage_backend", "s3")
    monkeypatch.setattr(settings, "s3_bucket_name", "fk-test")
    monkeypatch.setattr(storage, "_s3", fake)
    return fake


def test_direct_upload_goes_through_s3_and_is_processed(client, s3):
    start = client.post("/api/uploads", json={"filename": "reef.txt", "content_type": "text/plain", "size": 120}).json()
    assert start["mode"] == "direct"
    key = start["fields"]["key"]
    assert key.startswith("incoming/") and key.endswith(start["upload_id"])
    s3.objects[key] = b"Parrotfish graze the reef flat every morning and keep the turf algae short so coral can recover."

    done = client.post(f"/api/uploads/{start['upload_id']}/complete", json={"filename": "reef.txt", "content_type": "text/plain"})
    assert done.status_code == 202, done.text
    assert key not in s3.objects
    stored = [k for k in s3.objects if not k.startswith("incoming/")]
    assert len(stored) == 1
    document = client.get(f"/api/documents/{done.json()['document']['id']}").json()
    assert document["status"] == "ready"
    assert client.get(f"/api/documents/{document['id']}/file").content.startswith(b"Parrotfish")


def test_direct_upload_rejects_other_owners_and_oversized_files(client, s3):
    assert client.post("/api/uploads", json={"filename": "a.pdf", "size": settings.max_bytes + 1}).status_code == 400
    assert client.post("/api/uploads/unknown/complete", json={"filename": "a.txt"}).status_code == 404
    assert client.post("/api/uploads/..%2Fx/complete", json={"filename": "a.txt"}).status_code == 404
    start = client.post("/api/uploads", json={"filename": "big.txt", "size": 10}).json()
    s3.objects[start["fields"]["key"]] = b"x" * (settings.max_bytes + 1)
    assert client.post(f"/api/uploads/{start['upload_id']}/complete", json={"filename": "big.txt"}).status_code == 400
    assert start["fields"]["key"] not in s3.objects


def test_local_storage_keeps_multipart_uploads(client):
    assert client.post("/api/uploads", json={"filename": "a.txt", "size": 5}).json() == {"mode": "multipart"}


def test_presigned_post_bounds_the_upload_size(monkeypatch):
    monkeypatch.setattr(settings, "s3_bucket_name", "fk-test")
    real = boto3.client("s3", region_name="us-east-2", aws_access_key_id="AKIDEXAMPLE", aws_secret_access_key="secret")
    monkeypatch.setattr(storage, "_s3", real)
    post = storage.presigned_upload("incoming/abc/upload", 1000)
    assert "fk-test" in post["url"]
    policy = json.loads(__import__("base64").b64decode(post["fields"]["policy"]))
    assert ["content-length-range", 1, 1000] in policy["conditions"]
    assert {"key": "incoming/abc/upload"} in policy["conditions"]


def test_jobs_dispatch_to_sqs_and_worker_reports_failures(client, monkeypatch):
    sent = []
    monkeypatch.setattr(settings, "jobs_queue_url", "https://sqs.us-east-2.amazonaws.com/1/fk-jobs")
    monkeypatch.setattr(jobs, "_sqs", type("SQS", (), {"send_message": lambda _, **kw: sent.append(kw)})())
    jobs.dispatch("job-1")
    assert sent == [{"QueueUrl": settings.jobs_queue_url, "MessageBody": json.dumps({"job_id": "job-1"})}]

    import app.main as main
    assert client.post("/internal/sqs", json={"Records": []}).status_code == 404
    monkeypatch.setattr(settings, "worker_mode", True)
    ran = []

    def run(job_id):
        ran.append(job_id)
        if job_id == "bad":
            raise RuntimeError("retry me")

    monkeypatch.setattr(main, "run_job", run)
    event = {"Records": [{"messageId": "m1", "body": json.dumps({"job_id": "ok"})}, {"messageId": "m2", "body": json.dumps({"job_id": "bad"})}]}
    response = client.post("/internal/sqs", json=event)
    assert ran == ["ok", "bad"]
    assert response.json() == {"batchItemFailures": [{"itemIdentifier": "m2"}]}


def test_production_accepts_the_aws_configuration():
    aws = Settings(app_env="production", auth_mode="firebase", firebase_project_id="fk", storage_backend="s3", s3_bucket_name="b",
                   database_url="postgresql://finder_keeper@host:5432/finder_keeper", jobs_queue_url="https://sqs/q")
    aws.validate_runtime()
    with pytest.raises(RuntimeError, match="S3"):
        Settings(app_env="production", auth_mode="firebase", firebase_project_id="fk", storage_backend="s3",
                 database_url="postgresql://h/d", jobs_queue_url="q").validate_runtime()
    with pytest.raises(RuntimeError, match="SQS"):
        Settings(app_env="production", auth_mode="firebase", firebase_project_id="fk", storage_backend="s3", s3_bucket_name="b",
                 database_url="postgresql://h/d").validate_runtime()
