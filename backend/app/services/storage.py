"""Object storage — local filesystem for zero-infra dev, MinIO/S3 in production.

STORAGE_BACKEND=local (default) writes uploads under STORAGE_DIR and serves them via a
short-lived signed URL (``/api/v1/documents/file/{token}``) — no server required.
Set STORAGE_BACKEND=minio to use MinIO/S3 (e.g. in Docker).
"""
import io
import os
from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt

from app.core.config import settings


class _LocalStorage:
    """Filesystem-backed storage. Files served through signed token URLs."""

    def __init__(self) -> None:
        self._dir = os.path.abspath(settings.storage_dir)
        os.makedirs(self._dir, exist_ok=True)

    def _path(self, key: str) -> str:
        rel = key.replace("\\", "/").lstrip("/").replace("..", "")
        path = os.path.join(self._dir, *rel.split("/"))
        os.makedirs(os.path.dirname(path), exist_ok=True)
        return path

    def upload(self, key: str, data: bytes, content_type: str) -> None:
        with open(self._path(key), "wb") as fh:
            fh.write(data)
        with open(self._path(key) + ".ct", "w", encoding="utf-8") as fh:
            fh.write(content_type or "application/octet-stream")

    def download(self, key: str) -> bytes:
        with open(self._path(key), "rb") as fh:
            return fh.read()

    def content_type(self, key: str) -> str:
        try:
            with open(self._path(key) + ".ct", encoding="utf-8") as fh:
                return fh.read().strip() or "application/octet-stream"
        except OSError:
            return "application/octet-stream"

    def delete(self, key: str) -> None:
        for path in (self._path(key), self._path(key) + ".ct"):
            if os.path.exists(path):
                os.remove(path)

    def presigned_url(self, key: str, minutes: int = 15) -> str:
        exp = datetime.now(timezone.utc) + timedelta(minutes=minutes)
        token = jwt.encode({"k": key, "exp": exp}, settings.jwt_secret_key,
                           algorithm=settings.jwt_algorithm)
        return f"{settings.api_v1_prefix}/documents/file/{token}"


class _MinioStorage:
    def __init__(self) -> None:
        from minio import Minio
        self._client = Minio(
            settings.s3_endpoint,
            access_key=settings.s3_access_key,
            secret_key=settings.s3_secret_key,
            secure=settings.s3_secure,
        )
        self._bucket = settings.s3_bucket

    def ensure_bucket(self) -> None:
        if not self._client.bucket_exists(self._bucket):
            self._client.make_bucket(self._bucket)

    def upload(self, key: str, data: bytes, content_type: str) -> None:
        self.ensure_bucket()
        self._client.put_object(self._bucket, key, io.BytesIO(data), length=len(data),
                                content_type=content_type)

    def download(self, key: str) -> bytes:
        response = self._client.get_object(self._bucket, key)
        try:
            return response.read()
        finally:
            response.close()
            response.release_conn()

    def content_type(self, key: str) -> str:  # pragma: no cover - external URL is used directly
        return "application/octet-stream"

    def presigned_url(self, key: str, minutes: int = 15) -> str:
        return self._client.presigned_get_object(self._bucket, key, expires=timedelta(minutes=minutes))

    def delete(self, key: str) -> None:
        self._client.remove_object(self._bucket, key)


def verify_file_token(token: str) -> str | None:
    """Return the storage key embedded in a local-storage file token, or None."""
    try:
        payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
        return payload.get("k")
    except JWTError:
        return None


def _make_storage():
    if settings.storage_backend.lower() == "minio":
        return _MinioStorage()
    return _LocalStorage()


storage = _make_storage()
