"""MinIO/S3 object storage service."""
import io
from datetime import timedelta

from minio import Minio

from app.core.config import settings


class StorageService:
    def __init__(self) -> None:
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

    def presigned_url(self, key: str, minutes: int = 15) -> str:
        return self._client.presigned_get_object(self._bucket, key, expires=timedelta(minutes=minutes))

    def delete(self, key: str) -> None:
        self._client.remove_object(self._bucket, key)


storage = StorageService()
