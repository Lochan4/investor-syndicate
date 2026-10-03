# Background Workers — Arq + Redis

## Worker Architecture

```
FastAPI process                    Arq worker process(es)
      │                                    │
      │  arq_pool.enqueue_job(...)         │
      ├──────────────────────────────────► │
      │                                    │  reads job from Redis
      │                                    │  connects to Postgres
      │                                    │  with service role key
      │                                    │  (bypasses RLS)
      │                                    │
      │  Redis key: job:{id}:progress      │  writes progress
      │ ◄─────────────────────────────────┤
      │                                    │
  SSE endpoint polls Redis                │  writes analyses /
  and streams to browser                  │  forms / notifications
```

## Job Registry

```
Job                          Enqueued by                 Idempotency key
──────────────────────────────────────────────────────────────────────────
create_project_from_email    ingest/email webhook        postmark message ID
link_transcript              ingest/transcript webhook   provider meeting ID
run_pitch_analysis           link_transcript             project_id
run_form_generator           run_pitch_analysis          project_id
run_group_consensus          maybe_close_collection()    form_id
run_rebuttal_form_generator  run_group_consensus         project_id
run_final_consensus          all rebuttals / /finalize   project_id
send_notification_email      any notification INSERT     notification_id
run_competitive_scan         project status → 'open'     project_id
                             OR POST .../competitive-scan (skips if
                             competitive_intel asset already exists)
build_cell_views             POST /flow/cells/{id}/analyse  cell_id
```

## Worker Config

```python
class WorkerSettings:
    functions     = [all job functions]
    redis_settings = RedisSettings.from_dsn(REDIS_URL)
    max_jobs       = 10
    job_timeout    = 180    # seconds; LLM calls can be slow
    retry_jobs     = True
    max_tries      = 3
```

## Idempotency Pattern

```python
async def run_pitch_analysis(ctx, project_id: str):
    # Check if already done (re-queued after crash)
    existing = await db.fetchrow(
        "SELECT id FROM analyses WHERE project_id=$1 AND stage='pitch'",
        project_id
    )
    if existing:
        return  # already ran, skip

    # ... do the work
```

## Progress Reporting

```
Each long job writes to Redis key:  job:{arq_job_id}:progress
TTL: 1 hour after job completion

Payload:
  {"job_id": "...", "status": "running", "stage": "pitch_analysis",
   "progress": 0.4, "message": "Analysing market section"}

Final states:
  {"status": "done",   "progress": 1.0}
  {"status": "failed", "error": "Model timeout after 3 retries"}

SSE endpoint: polls every 1s, closes stream on done/failed.
```

## Collection Close — Inline Trigger (not a job)

```
POST /forms/{id}/responses
  → validate + INSERT response
  → call maybe_close_collection(form_id)
      └── if all submitted:
            UPDATE forms SET status='closed'
            UPDATE projects SET status='consensus', collection_closed_at=now()
            enqueue run_group_consensus(form_id)
            notify all members: collection_closed

This runs synchronously in the request so the response
the reviewer sees reflects the closed state immediately.
```

## Failure Handling

```
Job fails after max_tries:
  1. INSERT audit_log (action='job_failed', payload={error, stage})
  2. UPDATE projects SET status='failed'  (pipeline jobs only)
  3. enqueue send_notification_email to super_admin
  4. Arq marks job as dead (visible in Arq dashboard)

send_notification_email:
  Fails → retry 3× with exponential backoff
  All retries exhausted → INSERT audit_log only (no further action)
  Email is non-critical; app still works without it.
```

## Reminder Cron (daily)

```python
# Runs as an Arq cron job at 09:00 UTC daily
async def send_pending_reminders(ctx):
    rows = await db.fetch("""
        SELECT pm.user_id, pm.project_id
        FROM project_members pm
        JOIN forms f ON f.project_id = pm.project_id
        LEFT JOIN responses r ON r.form_id = f.id AND r.user_id = pm.user_id
        WHERE pm.role = 'reviewer'
          AND f.status = 'open'
          AND f.approved_at < now() - interval '7 days'
          AND r.id IS NULL
    """)
    for row in rows:
        await notify(db, row['user_id'], row['project_id'], 'reminder')
```

## Files

```
app/
  worker.py              WorkerSettings, cron definitions
  workers/
    create_project.py    create_project_from_email
    link_transcript.py   link_transcript
    pipeline.py          all 5 AI stage jobs
    notifications.py     send_notification_email
  services/
    progress.py          write_progress(job_id, payload) → Redis
```
