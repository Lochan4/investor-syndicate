# Handover: ai auditor

Last updated: 2026-11-18 02:54

*Source of truth: `handover_ai auditor.json`*


## Task
Diagnosed and resolved backend startup failure by identifying missing DATABASE_URL environment variable and uvicorn --env-file configuration requirement; consolidated investor application flow to modal-only pattern; removed LinkedIn references from advisor pages.

## Discussion
The project has a FastAPI backend (uvicorn on port 8000) that requires DATABASE_URL and Redis (docker-compose). Session 1 identified the startup failure root cause; Session 2 consolidated the investor apply flow into a single ApplySection modal and removed LinkedIn from advisors; Session 3 provided the exact uvicorn startup command and diagnosed that the app never loads .env because uvicorn needs the --env-file flag. The backend is now ready to start once DATABASE_URL is set and Redis is running.

## Accomplishments
- [x] Identified backend startup command: uvicorn app.main:app --reload --port 8000 --env-file .env
- [x] Diagnosed root cause of KeyError: 'DATABASE_URL' — app.main.py never calls load_dotenv(), so uvicorn must load .env via --env-file flag
- [x] Consolidated investor application flow to modal-only ApplySection pattern; deleted /apply and /apply/status/[token] pages
- [x] Removed all LinkedIn button references and data fields from advisor page
- [x] Updated .gitignore to exclude __pycache__ directories

## Next Actions
1. Set DATABASE_URL in backend/.env with a valid PostgreSQL connection string (e.g., postgresql://user:pass@localhost/investors) matching your database setup
   *Why: Backend startup fails without this environment variable; it is read during app lifespan initialization*
2. Verify Redis is running: cd backend && docker compose up -d
   *Why: Backend depends on Redis for session/cache management; docker-compose.yml defines the service*
3. Start backend with: cd backend && source .venv/bin/activate && uvicorn app.main:app --reload --port 8000 --env-file .env
   *Why: Correct startup command that loads .env file and starts uvicorn on port 8000 where frontend expects it*
4. Create backend/README.md documenting startup steps: docker compose up -d, source .venv/bin/activate, uvicorn command with --env-file flag
   *Why: Prevents future confusion about backend startup; documents the --env-file requirement that is not obvious from code*
5. Verify frontend Stage1Client, Stage2Client, Stage3Client, and CellChat components reflect modal-only investor flow without references to deleted /apply page
   *Why: Session 2 deleted /apply but frontend may still have stale links or routing logic pointing to it*
6. Commit all uncommitted changes with message indicating modal-only apply flow consolidation, LinkedIn removal, and backend startup documentation
   *Why: Consolidate Sessions 1–3 work into a single coherent commit on main branch*

## Decisions
- Landing page has single 'Apply →' CTA button instead of dual 'Become An Investor' + 'Join Our Portfolio' buttons — User removed 'Join Our Portfolio' for legal compliance (QCI Club members are already in the club, not joining a portfolio); single button simplifies UX and messaging
- Secondary pages (/advisor, /portfolio, /pitched, /resources) use 'Pitch to us' button instead of 'Apply →' nav link — Consistent with landing page CTA; opens ApplySection modal for investor pitch flow; clearer intent than generic 'Apply'
- Entire /apply page and /apply/status/[token] sub-page deleted; no separate apply flow — Consolidates all investor pitch entry points to single ApplySection modal; removes dead status tracking link; simplifies frontend routing and reduces code duplication
- All LinkedIn button references and data fields removed from advisor page — User explicitly requested removal of all LinkedIn mentions; simplifies advisor card UI and reduces external dependencies
- Backend uvicorn startup requires --env-file .env flag to load DATABASE_URL and other environment variables — app.main.py does not call load_dotenv(); uvicorn must be explicitly told to load the .env file or environment variables will not be available at app startup

## Failed Approaches
- Running uvicorn without --env-file flag — app.main.py never loads .env, so DATABASE_URL is not available in os.environ; app crashes with KeyError during lifespan initialization

## Files In Play
- `backend/app/main.py`
- `backend/.env`
- `backend/docker-compose.yml`
- `backend/app/routers/conversation.py`
- `backend/app/routers/investor.py`
- `frontend/app/(app)/investor/Stage1Client.tsx`
- `frontend/app/(app)/investor/[projectId]/Stage2Client.tsx`
- `frontend/app/(app)/investor/[projectId]/activities/[cellId]/Stage3Client.tsx`
- `frontend/components/CellChat.tsx`
- `frontend/components/WindowCanvas.tsx`
- `frontend/lib/api.ts`
- `.gitignore`

## Relational Files
- `backend/requirements.txt` (configures): Must include python-dotenv if uvicorn --env-file is used; verify dependency is listed
- `askr_state/decisions.jsonl` (imported_by): Project decision history; contains all architectural choices including modal-only apply flow and LinkedIn removal

## Blockers
- DATABASE_URL environment variable must be set in backend/.env before backend can start
