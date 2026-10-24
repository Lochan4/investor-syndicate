from __future__ import annotations

import asyncpg
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.dependencies import CurrentUser, get_current_user, get_db

router = APIRouter(tags=["financier"])

_ALLOWED = {"super_admin", "admin"}


def _require_admin(user: CurrentUser) -> None:
    if user.platform_role not in _ALLOWED:
        raise HTTPException(403, "Admin access required")


# ── GET /financier/prospects ─────────────────────────────────

@router.get("/financier/prospects")
async def list_prospects(
    user: CurrentUser = Depends(get_current_user),
    db: asyncpg.Pool = Depends(get_db),
):
    _require_admin(user)
    rows = await db.fetch(
        """
        SELECT
          p.id, p.startup_name, p.sector, p.stage, p.status,
          COALESCE(SUM(fc.amount_promised), 0) AS total_promised,
          COALESCE(SUM(fc.amount_given),   0) AS total_given,
          COUNT(fc.id) AS commitment_count
        FROM projects p
        LEFT JOIN financial_commitments fc ON fc.project_id = p.id
        GROUP BY p.id
        ORDER BY p.created_at DESC
        """
    )
    return [
        {
            "id": str(r["id"]),
            "startup_name": r["startup_name"],
            "sector": r.get("sector"),
            "stage": r.get("stage"),
            "status": r["status"],
            "total_promised": float(r["total_promised"]),
            "total_given": float(r["total_given"]),
            "total_remaining": float(r["total_promised"]) - float(r["total_given"]),
            "commitment_count": r["commitment_count"],
        }
        for r in rows
    ]


# ── GET /financier/prospects/{project_id} ────────────────────

@router.get("/financier/prospects/{project_id}")
async def get_prospect_breakdown(
    project_id: str,
    user: CurrentUser = Depends(get_current_user),
    db: asyncpg.Pool = Depends(get_db),
):
    _require_admin(user)
    project = await db.fetchrow(
        "SELECT id, startup_name, sector, stage, status FROM projects WHERE id=$1",
        project_id,
    )
    if not project:
        raise HTTPException(404, "Project not found")

    rows = await db.fetch(
        """
        SELECT fc.id, fc.user_id, u.email, fc.amount_promised, fc.amount_given,
               fc.currency, fc.notes, fc.updated_at
        FROM financial_commitments fc
        JOIN users u ON u.id = fc.user_id
        WHERE fc.project_id = $1
        ORDER BY fc.amount_promised DESC
        """,
        project_id,
    )
    commitments = [
        {
            "id": str(r["id"]),
            "user_id": str(r["user_id"]),
            "email": r["email"],
            "amount_promised": float(r["amount_promised"]),
            "amount_given": float(r["amount_given"]),
            "amount_remaining": float(r["amount_promised"]) - float(r["amount_given"]),
            "currency": r["currency"],
            "notes": r.get("notes"),
            "updated_at": r["updated_at"].isoformat() if r["updated_at"] else None,
        }
        for r in rows
    ]
    total_promised = sum(c["amount_promised"] for c in commitments)
    total_given    = sum(c["amount_given"]    for c in commitments)
    return {
        "project": {
            "id": str(project["id"]),
            "startup_name": project["startup_name"],
            "sector": project.get("sector"),
            "stage": project.get("stage"),
            "status": project["status"],
        },
        "commitments": commitments,
        "total_promised": total_promised,
        "total_given": total_given,
        "total_remaining": total_promised - total_given,
    }


# ── POST /financier/prospects/{project_id}/commitments ───────

class CommitmentBody(BaseModel):
    user_id: str
    amount_promised: float
    amount_given: float = 0.0
    currency: str = "USD"
    notes: str | None = None


@router.post("/financier/prospects/{project_id}/commitments")
async def upsert_commitment(
    project_id: str,
    body: CommitmentBody,
    user: CurrentUser = Depends(get_current_user),
    db: asyncpg.Pool = Depends(get_db),
):
    _require_admin(user)
    row = await db.fetchrow(
        """
        INSERT INTO financial_commitments
          (project_id, user_id, amount_promised, amount_given, currency, notes, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, now())
        ON CONFLICT (project_id, user_id) DO UPDATE
          SET amount_promised = EXCLUDED.amount_promised,
              amount_given    = EXCLUDED.amount_given,
              currency        = EXCLUDED.currency,
              notes           = EXCLUDED.notes,
              updated_at      = now()
        RETURNING id, amount_promised, amount_given, currency, notes
        """,
        project_id, body.user_id,
        body.amount_promised, body.amount_given,
        body.currency, body.notes,
    )
    return {
        "id": str(row["id"]),
        "amount_promised": float(row["amount_promised"]),
        "amount_given": float(row["amount_given"]),
        "amount_remaining": float(row["amount_promised"]) - float(row["amount_given"]),
        "currency": row["currency"],
        "notes": row.get("notes"),
    }


# ── DELETE /financier/commitments/{commitment_id} ────────────

@router.delete("/financier/commitments/{commitment_id}", status_code=204)
async def delete_commitment(
    commitment_id: str,
    user: CurrentUser = Depends(get_current_user),
    db: asyncpg.Pool = Depends(get_db),
):
    _require_admin(user)
    await db.execute(
        "DELETE FROM financial_commitments WHERE id=$1", commitment_id
    )
