# Investor Syndicate Platform — Component LLD Overview

## System Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                          CLIENTS                                      │
│  Next.js App Router (browser)        Developer Browser (prompt ed.)  │
└──────────┬───────────────────────────────────────┬───────────────────┘
           │ HTTPS / WebSocket / SSE               │ HTTPS
           ▼                                       ▼
┌──────────────────────────────────────────────────────────────────────┐
│                        FastAPI  /api/v1                               │
│  auth │ admin │ projects │ assets │ graph │ conversation │ analyses  │
│                           forms │ prompts │ notifications             │
│                                                                       │
│  Supabase JWT validation + role check on every route                 │
└─────┬──────────────────┬──────────────────────┬──────────────────────┘
      │ async SQL        │ enqueue_job()        │ Cypher queries
      ▼                  ▼                      ▼
┌──────────────┐  ┌────────────────┐  ┌────────────────────────────┐
│  Supabase    │  │  Arq + Redis   │  │  Neo4j                     │
│  Postgres    │  │                │  │                            │
│  RLS enabled │  │  process_asset │  │  Project · Asset · Chunk   │
│  Supabase    │  │  build_graph   │  │  Entity nodes              │
│  Auth        │  │  run_convo_    │  │  SIMILAR_TO · NEXT ·       │
│  (JWT,TOTP)  │  │    analysis    │  │  MENTIONS · RELATED_TO     │
│              │  │  run_group_    │  │  edges                     │
│              │  │    consensus   │  │                            │
│              │  │  run_rebuttal  │  │  Vector index on Chunk     │
│              │  │  run_final     │  │  embeddings (ANN search)   │
│              │  │  send_notif    │  │                            │
└──────────────┘  └────────┬───────┘  └────────────────────────────┘
                           │ LLM calls + STT
                           ▼
          ┌────────────────────────────────────┐
          │  External APIs                     │
          │  Claude API  — LLM (Opus/Sonnet)   │
          │  Whisper API — voice → text (STT)  │
          │  S3-compatible — raw file storage  │
          │  Resend       — email              │
          │  Serper API  — competitive web search (Google)  │
          └────────────────────────────────────┘
```

### Redis Key Namespaces (context store)

```
cell_ctx:{project_id}:{cell_id}:{user_id}  — conversation turns per cell (List, 30d TTL)
cell_analysis:{project_id}:{cell_id}       — synthesised cell analysis (String, no expiry)
```

## Component Files

| File | Component |
| --- | --- |
| `01-auth.md` | Auth & Access Control (Supabase + RLS) |
| `02-asset-pipeline.md` | Asset Upload + Processing Pipeline |
| `03-knowledge-graph.md` | Neo4j Schema, Graph Construction, Traversal |
| `04-conversation-engine.md` | GraphRAG Conversation (text + voice) + Traversal SSE |
| `05-ai-pipeline.md` | Group Analysis → Rebuttal → Final (5 stages) |
| `06-form-system.md` | Form Schema, Editing, Responses (complementary to conversation) |
| `07-database.md` | Postgres Schema + Constraints + RLS Policies |
| `08-api.md` | All FastAPI Routers & Endpoints |
| `09-workers.md` | Arq Job Queue, Retries, SSE Progress |
| `10-notifications.md` | In-app + Email Notification System |
| `11-frontend.md` | Next.js App Router + Knowledge Graph Visualization |
| `12-analysis-flow.md` | Analysis Flow Canvas — admin cell pipeline + cell deep-dive (graph + per-investor views + scoped traversal) |
| `13-competitive-scan.md` | Competitive Intelligence Scan — auto web search on project open, ingested as `competitive_intel` asset into graph |

## Project Status Lifecycle

```
Admin creates project manually
      │
      ▼
  draft               ◄── project exists, no assets yet
      │
      │  assets uploaded + processed
      ▼
  building_graph      ◄── Neo4j nodes/edges being constructed
      │
      │  graph ready
      ▼
  open                ◄── investors invited, can converse + fill form
      │
      │  all investors submitted (conversation + optional form)
      │  OR admin closes manually
      ▼
  consensus           ◄── group analysis running (Stage 3)
      │
      │  Stage 3 done
      ▼
  rebuttals           ◄── attendees fill rebuttal form (Stage 4 output)
      │
      │  all rebuttals in OR attendee clicks Finalize
      ▼
  final               ◄── Stage 5 done, visible to all members
```

## Tech Stack

| Layer | Choice |
| --- | --- |
| Frontend | Next.js 14 App Router + Tailwind + shadcn/ui |
| Graph Visualization | None — GraphRAG is backend-only; frontend shows chat + source pills |
| Backend API | FastAPI + Pydantic + SQLAlchemy (async) |
| Database | Supabase Postgres (RLS enabled) |
| Knowledge Graph | Neo4j (nodes, edges, vector index for ANN search) |
| Auth | Supabase Auth (TOTP 2FA, invite-only, JWT) |
| Job Queue | Arq + Redis |
| LLM | Claude API (Opus 4.6 / Sonnet 4.6) |
| STT (voice input) | OpenAI Whisper API |
| Storage | S3-compatible (all raw asset files) |
| Email | Resend |

## What Changed from Original Design

| Removed | Replaced with |
| --- | --- |
| Email ingestion (Postmark inbound) | Manual project + asset creation by admin |
| Notetaker webhook (Fireflies/Otter) | Any file type uploadable as asset (incl. MP3) |
| Auto-project creation | Admin manually creates project, adds members |
| Per-investor LLM form analysis | Conversation engine (GraphRAG) captures investor views |
| Form as primary input | Conversation as primary; form as complementary |
| Flat asset model (deck + transcript only) | Rich asset model: PDF, MP3, images, Excel, any file |
