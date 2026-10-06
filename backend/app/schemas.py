from __future__ import annotations
import uuid
from datetime import datetime
from pydantic import BaseModel, ConfigDict, EmailStr


# ── Projects ──────────────────────────────────────────────

class ProjectCreate(BaseModel):
    startup_name: str
    sector: str | None = None
    stage: str | None = None


class ProjectResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    startup_name: str
    sector: str | None
    stage: str | None
    status: str
    created_at: datetime


# ── Admin / Invites ───────────────────────────────────────

class InviteCreate(BaseModel):
    email: EmailStr
    project_id: uuid.UUID
    role: str = "attendee"


class InviteResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    project_id: uuid.UUID
    role: str
    created_at: datetime


# ── Assets ────────────────────────────────────────────────

class AssetCreate(BaseModel):
    filename: str
    kind: str
    storage_key: str
    file_size_bytes: int | None = None


class AssetResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    filename: str
    kind: str
    status: str
    file_size_bytes: int | None
    chunk_count: int | None
    analysis_cache: dict | None
    created_at: datetime
    processed_at: datetime | None


# ── Upload URL ───────────────────────────────────────────

class UploadUrlRequest(BaseModel):
    filename: str
    kind: str
    content_type: str = "application/octet-stream"


class UploadUrlResponse(BaseModel):
    upload_url: str
    storage_key: str
    content_type: str


# ── Webhook ───────────────────────────────────────────────

class WorkOSWebhookPayload(BaseModel):
    event: str
    data: dict
