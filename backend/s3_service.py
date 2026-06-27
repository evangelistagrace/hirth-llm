import os
from pathlib import Path

import boto3
from botocore.exceptions import ClientError
from dotenv import load_dotenv

load_dotenv()

S3_ENDPOINT_URL = os.getenv("S3_ENDPOINT_URL", "http://localhost:4566")
S3_BUCKET_NAME = os.getenv("S3_BUCKET_NAME", "hirth-knowledge-base")
AWS_ACCESS_KEY_ID = os.getenv("AWS_ACCESS_KEY_ID", "test")
AWS_SECRET_ACCESS_KEY = os.getenv("AWS_SECRET_ACCESS_KEY", "test")
AWS_DEFAULT_REGION = os.getenv("AWS_DEFAULT_REGION", "eu-central-1")


def get_s3_client():
    return boto3.client(
        "s3",
        endpoint_url=S3_ENDPOINT_URL,
        aws_access_key_id=AWS_ACCESS_KEY_ID,
        aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
        region_name=AWS_DEFAULT_REGION,
    )


def ensure_bucket_exists():
    s3 = get_s3_client()

    try:
        s3.head_bucket(Bucket=S3_BUCKET_NAME)
    except ClientError:
        s3.create_bucket(Bucket=S3_BUCKET_NAME)

    return S3_BUCKET_NAME


def upload_file_to_s3(local_path: Path, s3_key: str) -> str:
    ensure_bucket_exists()

    s3 = get_s3_client()
    s3.upload_file(
        Filename=str(local_path),
        Bucket=S3_BUCKET_NAME,
        Key=s3_key,
    )

    return s3_key


def download_file_from_s3(s3_key: str, destination: Path) -> Path:
    ensure_bucket_exists()

    destination.parent.mkdir(parents=True, exist_ok=True)

    s3 = get_s3_client()
    s3.download_file(
        Bucket=S3_BUCKET_NAME,
        Key=s3_key,
        Filename=str(destination),
    )

    return destination


def list_s3_objects(prefix: str = "") -> list[str]:
    ensure_bucket_exists()

    s3 = get_s3_client()
    response = s3.list_objects_v2(
        Bucket=S3_BUCKET_NAME,
        Prefix=prefix,
    )

    return [item["Key"] for item in response.get("Contents", [])]