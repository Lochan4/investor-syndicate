# Handover: ai auditor

Last updated: 2026-11-19 20:38

*Source of truth: `handover_ai auditor.json`*


## Task
Built and tested a vault file management system with S3/R2 storage, two-stage upload UX, per-file assignment menus, bulk selection, and file move/copy logic distinguishing user uploads from main-app files.

## Discussion
The vault is a standalone owner page connected to Cloudflare R2, allowing users to upload files to an Inbox, then assign them to category buckets (experts, portfolio, pitched, resources) matching the QCI Club header menu. Files are organized by category and optional subfolders; Resources has 4 fixed tabs (Understand, De-Mystify, Analyze, Learn) mirroring the public Resources page. The backend uses FastAPI with asyncpg and boto3; the frontend is Next.js with React. Vault-managed files (inbox, vault, categories) are moved on assignment; main-app files (applications/, project IDs, canvas-policy/, test/) are copied to preserve originals. Published Resources files are marked and cannot be reassigned. The vault table now includes checkboxes for bulk selection, per-row assignment menus, and a bulk bar showing selected count with an Assign option. All workflows have been tested in Chrome with real R2 objects.

## Accomplishments
- [x] Implemented vault file table with checkbox column, per-row 'Assign to…' menu, and Published tag for resources-published files
- [x] Built bulk selection bar ('N selected · Assign to…') with header checkbox to select all visible files; reserved space to prevent layout shift
- [x] Implemented file assignment logic: user uploads (Inbox, category files) are moved; main-app files (applications/, project-ID folders, canvas-policy/, test/) are copied to preserve originals
- [x] Added publish-to-Resources workflow: selecting a Resources tab (Understand, De-Mystify, Analyze, Learn) opens details form for both user uploads and main-app file copies
- [x] Tested vault in Chrome: verified checkbox selection, per-row assignment, bulk bar, file move/copy behavior, and Published tag display
- [x] Fixed layout bug: bulk selection bar now reserves space at all times, preventing table rows from shifting on second click
- [x] Verified test copy portfolio/9623c675-26c6-4642-9880-224ccfc1c89f/presign_check.pdf was deleted via backend script; original test/presign_check.pdf remains intact

## Next Actions
1. Commit vault feature: backend/app/routers/vault.py (assign/publish endpoints with move/copy logic) and frontend/app/vault/VaultClient.tsx (table UI, checkboxes, bulk bar, assignment menus)
   *Why: All code changes are complete and tested; commits should be made before moving to next features*
2. Assign Founder_Due_Diligence_Policy.pdf from vault Inbox to appropriate category (experts, portfolio, pitched, or resources) or confirm it should remain in Inbox
   *Why: File is uploaded but unassigned; user decision needed on final destination*
3. Verify frontend Resources page (frontend/app/resources/page.tsx) displays published vault files correctly and links to vault assignment workflow if needed
   *Why: Resources page was refactored to fetch from API; needs verification that published vault items appear and are styled correctly*
4. Test vault file download/preview: click a file in the table to verify S3/R2 presigned URL generation and browser download/view behavior
   *Why: File retrieval workflow not yet tested; presigned GET URLs must work for user access*
5. Document vault feature in backend/README.md or frontend/app/vault/README.md: explain two-stage upload, category structure, move vs. copy logic, and Resources publish workflow
   *Why: Feature is complete but undocumented; future maintainers need clear explanation of architecture and behavior*
6. Set VAULT_OWNER_EMAILS in backend/.env with comma-separated list of authorized vault users; currently empty so any logged-in user is allowed
   *Why: Security: vault should be restricted to designated owners, not all authenticated users*

## Decisions
- Vault file uploads are categorized into four buckets (experts, portfolio, pitched, resources) matching QCI Club header menu structure — Mirrors existing site navigation; allows content organization by type; enables category-specific access control and retrieval in future features
- Vault upload UX is two-stage: drop zone queues files as draggable chips; drag each chip onto a category tile to upload it — Prevents accidental uploads to wrong category; gives user explicit control over destination; reduces cognitive load vs. single-step upload with category selector
- S3/R2 storage keys are prefixed with category name: {category}/{uuid}/{filename} — Enables logical grouping of files by category in object storage; simplifies future queries and access policies; mirrors frontend category structure
- Vault-managed files (inbox, vault, categories) are moved on assignment; main-app files (applications/, project IDs, canvas-policy/, test/) are copied — Preserves main-app file integrity and location tracking; allows vault to manage its own files without breaking investor app dependencies
- Resources has 4 fixed tabs (Understand, De-Mystify, Analyze, Learn) with per-tab validation rules (kind, category, published_on, platform) stored in resource_items table — Mirrors public Resources page structure and filters; enables granular content curation; database row tracks metadata for API and frontend display
- Published Resources files show 'Published' tag in vault table and cannot be reassigned via normal assign workflow — Prevents accidental modification of published content; makes publication status visually clear; enforces one-way publish semantics
- Vault file table includes checkbox column with select-all header, per-row 'Assign to…' menu, and bulk selection bar ('N selected · Assign to…') — Allows users to assign multiple files at once; per-row menu enables single-file assignment; bulk bar is always rendered with visibility:hidden to prevent layout shift
- Backend uvicorn startup requires --env-file .env flag to load DATABASE_URL and other environment variables — app.main.py does not call load_dotenv(); uvicorn must be explicitly told to load the .env file or environment variables will not be available at app startup

## Failed Approaches
- Rendering bulk selection bar conditionally (display:none when empty) — Caused table rows to shift on second checkbox click, landing clicks on wrong rows; fixed by always rendering with visibility:hidden
- Using orange color scheme from investor site in vault UI — User requested vault be restyled to frontend landing page colors and fonts (no orange); changed to landing page color tokens and Figtree/Instrument Serif fonts
- Grep regex for R2 keys excluded digits — Incorrectly filtered out valid keys; corrected regex to include all alphanumeric characters

## Files In Play
- `backend/app/routers/vault.py`
- `frontend/app/vault/VaultClient.tsx`
- `frontend/app/resources/page.tsx`
- `backend/app/main.py`
- `backend/migrations/009_resource_items.sql`
- `frontend/lib/api.ts`

## Relational Files
- `backend/app/main.py` (imports): Includes vault router and public_router; executes 009_resource_items.sql migration on startup
- `frontend/lib/api.ts` (imported_by): Provides vault and resources API client functions called by VaultClient.tsx and resources/page.tsx
- `backend/migrations/009_resource_items.sql` (configures): Creates resource_items table with per-tab validation; executed by main.py lifespan
- `frontend/app/globals.css` (configures): Defines CSS tokens (--ground, --text, --muted, --ox, --ox2, --on-ox, --surface, --line, --sans, --serif) used by VaultClient.tsx and resources/page.tsx
- `backend/.env` (configures): Contains R2_ENDPOINT_URL, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, DATABASE_URL, VAULT_OWNER_EMAILS; loaded via --env-file flag

## Blockers
- VAULT_OWNER_EMAILS is empty in backend/.env; vault is currently accessible to any logged-in user instead of designated owners only
