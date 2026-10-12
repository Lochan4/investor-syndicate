"""Public endpoints — no authentication required."""
import secrets
import uuid as _uuid

import asyncpg
from fastapi import APIRouter, Depends, HTTPException

from app.dependencies import get_db
from app.schemas import ApplicationCreate, ApplyUploadRequest
from app.services import storage

router = APIRouter(tags=["apply"])


@router.post("/apply", status_code=201)
async def submit_application(
    body: ApplicationCreate,
    db: asyncpg.Pool = Depends(get_db),
):
    token = secrets.token_hex(32)
    row = await db.fetchrow(
        """
        INSERT INTO startup_applications (
            founder_name, founder_email, startup_name, sector, stage,
            one_liner, website, pitch_doc_key, pitch_doc_name, status_token
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING id, startup_name, status, status_token, created_at
        """,
        body.founder_name, str(body.founder_email), body.startup_name,
        body.sector, body.stage, body.one_liner, body.website,
        body.pitch_doc_key, body.pitch_doc_name, token,
    )
    return dict(row)


@router.post("/apply/upload-url")
async def apply_upload_url(body: ApplyUploadRequest):
    key = f"applications/pitch-{_uuid.uuid4()}-{body.filename}"
    url = storage.presigned_upload_url(key, body.content_type)
    return {"upload_url": url, "storage_key": key}


@router.get("/apply/status/{token}")
async def get_application_status(
    token: str,
    db: asyncpg.Pool = Depends(get_db),
):
    row = await db.fetchrow(
        """SELECT id, startup_name, founder_name, status, created_at
           FROM startup_applications WHERE status_token = $1""",
        token,
    )
    if not row:
        raise HTTPException(404, "Application not found")
    return dict(row)
