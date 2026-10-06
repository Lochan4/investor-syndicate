"""R2 presigned URL helpers via boto3 S3-compatible client."""
from __future__ import annotations
import os

import boto3
from botocore.config import Config

EXPIRY = 3600  # 1 hour


def _client():
    return boto3.client(
        "s3",
        endpoint_url=os.environ["R2_ENDPOINT_URL"],
        aws_access_key_id=os.environ["R2_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["R2_SECRET_ACCESS_KEY"],
        config=Config(signature_version="s3v4"),
        region_name="auto",
    )


def presigned_upload_url(key: str, content_type: str = "application/octet-stream") -> str:
    return _client().generate_presigned_url(
        "put_object",
        Params={"Bucket": os.environ["R2_BUCKET"], "Key": key, "ContentType": content_type},
        ExpiresIn=EXPIRY,
    )


def presigned_download_url(key: str) -> str:
    return _client().generate_presigned_url(
        "get_object",
        Params={"Bucket": os.environ["R2_BUCKET"], "Key": key},
        ExpiresIn=EXPIRY,
    )


def download_bytes(key: str) -> bytes:
    obj = _client().get_object(Bucket=os.environ["R2_BUCKET"], Key=key)
    return obj["Body"].read()
