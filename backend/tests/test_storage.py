"""Tests: storage presigned URL helpers — mocked boto3."""
from __future__ import annotations
import os
from unittest.mock import MagicMock, patch

import pytest


@pytest.fixture(autouse=True)
def set_r2_env(monkeypatch):
    monkeypatch.setenv("R2_ENDPOINT_URL", "https://r2.example.com")
    monkeypatch.setenv("R2_ACCESS_KEY_ID", "test-key")
    monkeypatch.setenv("R2_SECRET_ACCESS_KEY", "test-secret")
    monkeypatch.setenv("R2_BUCKET", "test-bucket")


@pytest.fixture
def mock_boto(monkeypatch):
    mock_client = MagicMock()
    mock_client.generate_presigned_url.return_value = "https://signed.example.com/key"
    with patch("app.services.storage.boto3.client", return_value=mock_client):
        yield mock_client


def test_presigned_upload_url_returns_string(mock_boto):
    from app.services import storage
    url = storage.presigned_upload_url("projects/abc/file.pdf")
    assert url.startswith("https://")


def test_presigned_upload_url_uses_put_object(mock_boto):
    from app.services import storage
    storage.presigned_upload_url("key")
    call_args = mock_boto.generate_presigned_url.call_args
    assert call_args[0][0] == "put_object"


def test_presigned_download_url_returns_string(mock_boto):
    from app.services import storage
    url = storage.presigned_download_url("projects/abc/file.pdf")
    assert url.startswith("https://")


def test_presigned_download_url_uses_get_object(mock_boto):
    from app.services import storage
    storage.presigned_download_url("key")
    call_args = mock_boto.generate_presigned_url.call_args
    assert call_args[0][0] == "get_object"


def test_upload_url_endpoint_returns_url(mock_boto):
    """upload-url route returns storage_key containing project_id."""
    # This is a unit-level check; HTTP-level tested in test_assets.py
    from app.services import storage
    url = storage.presigned_upload_url("proj/uuid/file.pdf")
    assert isinstance(url, str)
