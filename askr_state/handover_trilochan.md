# Handover: trilochan

Last updated: 2026-10-03 13:34

*Source of truth: `handover_trilochan.json`*


## Task
Designed and documented a 10-day parallel build plan for an AI-powered investor syndicate platform using WorkOS AuthKit for auth, pgvector (Supabase) for knowledge graph storage, FastAPI + Next.js 14 for backend/frontend, and created an interactive HTML timeline showing daily deliverables, service dependencies, and LLM API cost implications.

## Discussion
Session 1 proposed a 7-day build plan with Neo4j; this session pivoted to pgvector on Supabase (eliminating a separate service and guaranteeing project isolation via FK constraints), replaced custom auth with WorkOS AuthKit (removing password reset, TOTP enrollment, and invite token management from scope), and extended the timeline to 10 days to account for realistic integration complexity. The user rejected the initial 7-day estimate as inflated and requested a 10-day breakdown with clear daily milestones, service costs, and LLM API usage callouts. WorkOS replaces Supabase Auth entirely; FastAPI now validates WorkOS JWTs directly. All external services (Claude, OpenAI, Redis, R2, Resend, Serper) are documented with free-tier coverage and cost implications.

## Accomplishments
- [x] Rewrote 7-day plan to 10-day parallel build plan with realistic time estimates: MVP in 4-5 weeks, production-ready in 6-7 weeks
- [x] Replaced Neo4j with pgvector on Supabase — eliminates separate graph service, guarantees project isolation via FK constraints, simplifies deployment
- [x] Replaced custom auth system with WorkOS AuthKit — removes invites table, TOTP enrollment, password reset, session management from backend scope
- [x] Created interactive HTML build plan (build-plan.html) with 10-day timeline table at top, daily backend/frontend task breakdown, service dependency matrix, and LLM API cost callouts
- [x] Documented all 8 external services with free-tier coverage: Supabase, WorkOS, Claude API, OpenAI, Upstash Redis, Cloudflare R2, Resend, Serper
- [x] Provided detailed Day 1-10 breakdown: Day 1 (foundation + auth), Day 2 (asset pipeline), Day 3 (GraphRAG + conversation), Day 4 (flow canvas), Day 5 (analysis pipeline), Day 6-7 (wire remaining mocks + error states), Day 8-9 (integration testing + deployment), Day 10 (polish + production validation)
- [x] Removed email ingestion, notetaker webhook, and Neo4j from architecture entirely
- [x] Updated database schema to use pgvector instead of Neo4j: chunks, entities, chunk_mentions, chunk_edges, cell_conversation_turns all in Postgres with HNSW indexes
- [x] Documented WorkOS integration: JWT validation in FastAPI, webhook handler for user.created events, pending_invites table for pre-signup project assignment

## Next Actions
1. Verify build-plan.html renders correctly in browser — check 10-day timeline table, collapsible day sections, service matrix, and LLM cost callouts are all visible and properly formatted
   *Why: The HTML is the single source of truth for the build plan; any rendering issues will confuse implementation and timeline tracking*
2. Create .env.example file documenting all required API keys and environment variables: WORKOS_API_KEY, WORKOS_CLIENT_ID, WORKOS_COOKIE_PASSWORD, ANTHROPIC_API_KEY, OPENAI_API_KEY, DATABASE_URL, REDIS_URL, R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, RESEND_API_KEY, SERPER_API_KEY
   *Why: Developers need a clear reference for all external service credentials before Day 1 begins*
3. Create pre-Day-1 checklist (checklist.md) with all service signup links, credential setup steps, local environment validation commands, and Docker Compose setup for local Redis
   *Why: Eliminates setup friction and ensures both backend and frontend agents start with identical environments*
4. Update 00-overview.md to reflect pgvector instead of Neo4j, WorkOS instead of custom auth, and 10-day build timeline
   *Why: LLD files must reflect the current architecture; stale docs cascade into implementation errors*
5. Create 01-auth-workos.md documenting WorkOS AuthKit setup, JWT validation in FastAPI, webhook handling for user.created events, pending_invites table schema, and session lifecycle
   *Why: Auth is the entry point to the system; explicit docs prevent integration bugs*
6. Create 02-pgvector-schema.md with full SQL schema (chunks, entities, chunk_mentions, chunk_edges, cell_conversation_turns), HNSW index strategy, and BFS traversal query examples in Python
   *Why: pgvector replaces Neo4j; developers need explicit SQL patterns for graph traversal*
7. Begin Day 1 implementation: create Supabase project, enable pgvector extension, run all migrations, scaffold FastAPI + Next.js projects, set up WorkOS organization
   *Why: Day 1 is the foundation; all other days depend on these services being live*

## Decisions
- Use pgvector on Supabase instead of Neo4j for knowledge graph storage — Eliminates a separate service, guarantees project isolation via FK constraints, HNSW index is fast enough for syndicate scale, simplifies deployment and cost
- Replace custom auth system with WorkOS AuthKit — Removes password reset, TOTP enrollment, invite token management, and session management from scope; WorkOS handles MFA, invitations, and user lifecycle end-to-end
- Extend build timeline from 7 days to 10 days — Realistic integration complexity, service setup overhead, and UI iteration rounds require buffer; MVP still ships in 4-5 weeks, production in 6-7 weeks
- Disable Supabase RLS and enforce access control in FastAPI instead — WorkOS issues JWTs, not Supabase Auth tokens; FastAPI is the only DB client and has full context of user identity and role; cleaner than filtering every query
- Use Serper free tier for competitive scan (deferred to Day 5) — Free tier covers MVP scale; can upgrade to paid if volume exceeds limits
- Defer voice input (Whisper + MediaRecorder) to Week 2 — Non-critical path; text-only chat is sufficient for MVP; voice adds UI complexity without blocking core flow
- Defer admin user management UI and audit log UI to Week 2 — Can manage users via Supabase dashboard and WorkOS console; internal tools can be added after MVP

## User-Rejected Approaches
- **7-day build plan with inflated time estimates** — "bro lets be real here, these are over inflated values, tell me the real time that is going to take" (domain: build-plan.html, timeline estimates)
- **Keep Neo4j as the knowledge graph backend** — "instead of using neo4j is there any other way we can make sure that the graphrag can be independent for each of the project" (domain: architecture, database choice)
- **Include email ingestion and auto-project-creation in the 10-day plan** — "even this should be built in the first week saar. [remove] drop all of this [Image #7]" (domain: feature scope, Day 1-7 deliverables)

## Failed Approaches
- 7-day parallel build plan with Neo4j and custom auth — User rejected as inflated; Neo4j adds operational overhead and project isolation complexity; custom auth duplicates WorkOS functionality

## Files In Play
- `/Users/saitrilochan/Documents/investors/build-plan.html`

## Relational Files
- `/Users/saitrilochan/Documents/investors/lld/00-overview.md` (configures): Must be updated to reflect pgvector, WorkOS, and 10-day timeline
- `/Users/saitrilochan/Documents/investors/lld/01-auth.md` (imported_by): Auth is the entry point; needs rewrite for WorkOS AuthKit

## Uncommitted Files
- `idea/ats-idea.md`
- `idea/core-idea.md`
- `idea/product.md`
- `investors/askr_state/decisions.jsonl`
- `investors/askr_state/failed_approaches.md`
- `investors/askr_state/goals.jsonl`
- `investors/askr_state/implementation_trilochan.jsonl`
- `investors/askr_state/rejected_decisions.jsonl`
- `trilochan-website/askr_state/architecture.md`
- `trilochan-website/askr_state/blockers.md`
- `trilochan-website/askr_state/current_task_trilochan.md`
- `trilochan-website/askr_state/decisions.md`
- `trilochan-website/askr_state/failed_approaches.md`
- `trilochan-website/askr_state/goals.md`
- `trilochan-website/askr_state/handover_trilochan.md`
- `trilochan-website/askr_state/implementation_state.md`
- `trilochan-website/askr_state/notifications.log`
- `trilochan-website/askr_state/project_brief.md`
- `.DS_Store`
- `AI-Audit-Engine/`
- `Heuretos/`
- `Research_Buddy/`
- `askr/`
- `financials/`
- `heuretos pitch/`
- `investors/.claude/`
- `investors/.gitattributes`
- `investors/.gitignore`
- `investors/CLAUDE.md`
- `investors/askr_state/sessions/d278cf35-24ba-4efa-a9c2-c546e9e4b5b9.json`
- `investors/build-plan.html`
- `investors/demo.html`
- `investors/lld-diagram.html`
- `investors/lld/`
- `leaps-pitch-deck/`
- `leaps-preseed.pdf`
- `leaps_bippin/`
- `leaps_vercel/`
- `mitigata/`
- `pitch pdfs/`
- `projects/`
- `trilochan-website/.gitignore`
- `trilochan-website/GalgoVF.ttf`
- `trilochan-website/index.html`
- `trilochan-website/script.js`
- `trilochan-website/style.css`
- `vaultsql/`
- `vee/`
