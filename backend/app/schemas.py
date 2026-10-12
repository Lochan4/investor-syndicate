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
    is_investable: bool | None = None
    decision_notes: str | None = None
    decided_at: datetime | None = None
    created_at: datetime


class ProjectDecision(BaseModel):
    is_investable: bool
    notes: str | None = None


# ── Admin / Invites ───────────────────────────────────────

class InviteCreate(BaseModel):
    email: EmailStr
    project_id: uuid.UUID
    role: str = "admin"


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


# ── Workspaces ────────────────────────────────────────────

class WorkspaceCreate(BaseModel):
    name: str
    description: str | None = None


class WorkspaceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    description: str | None
    created_by: str | None
    created_at: datetime
    member_count: int | None = None


class WorkspaceMemberAdd(BaseModel):
    email: EmailStr
    role: str = "member"


# ── Applications ──────────────────────────────────────────

class ApplicationCreate(BaseModel):
    founder_name: str
    founder_email: EmailStr
    startup_name: str
    sector: str | None = None
    stage: str | None = None
    one_liner: str | None = None
    website: str | None = None
    pitch_doc_key: str | None = None
    pitch_doc_name: str | None = None


class ApplicationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    founder_name: str
    founder_email: str
    startup_name: str
    sector: str | None
    stage: str | None
    one_liner: str | None
    website: str | None
    pitch_doc_key: str | None
    pitch_doc_name: str | None
    status: str
    status_token: str
    workspace_id: uuid.UUID | None
    project_id: uuid.UUID | None
    reviewed_by: str | None
    reviewed_at: datetime | None
    created_at: datetime


class ApplicationStatusUpdate(BaseModel):
    status: str


class AddToWorkspaceBody(BaseModel):
    workspace_id: uuid.UUID


class ApplyUploadRequest(BaseModel):
    filename: str
    content_type: str = "application/pdf"


# ── Webhook ───────────────────────────────────────────────

class WorkOSWebhookPayload(BaseModel):
    event: str
    data: dict
