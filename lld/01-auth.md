# Auth & Access Control

## Component Diagram

```
  Browser / Next.js
       │
       │  POST /auth/login  {email, password}
       ▼
  ┌─────────────────────────────────────────┐
  │           FastAPI  /auth                │
  │                                         │
  │  1. supabase.auth.sign_in_with_password │
  │  2. check aal level                     │
  │  3. if TOTP enrolled → challenge        │
  │  4. return access JWT + refresh cookie  │
  └──────────────┬──────────────────────────┘
                 │
                 ▼
  ┌─────────────────────────────────────────┐
  │         Supabase Auth                   │
  │                                         │
  │  auth.users        ← source of truth    │
  │  JWT secret        ← used to sign JWTs  │
  │  MFA (TOTP)        ← aal1 → aal2        │
  │  Invite links      ← one-time magic URL │
  └──────────────┬──────────────────────────┘
                 │
                 ▼
  ┌─────────────────────────────────────────┐
  │         Postgres (Supabase)             │
  │                                         │
  │  users table  (mirrors auth.users)      │
  │  invites table                          │
  │  RLS policies on every table            │
  │    auth.uid() = current user UUID       │
  └─────────────────────────────────────────┘
```

## Invite Flow

```
super_admin
    │
    │  POST /admin/invites  {email}
    ▼
FastAPI
    │  INSERT invites row
    │  supabase.auth.admin.generate_link('invite', email)
    │  ──► Supabase sends one-time email
    ▼
User clicks link
    │
    │  GET /accept-invite?token=...
    ▼
FastAPI
    │  Supabase validates token, creates auth.users row
    │  App sets platform_role on users table
    │  marks invite used_at = now()
    ▼
User is active (TOTP enrolment required on next login)
```

## Token Model

```
┌────────────────────────────────────────────────────────┐
│  Access JWT           │  1 hour   │  memory only       │
│  Refresh token        │  7 days   │  httpOnly cookie    │
└────────────────────────────────────────────────────────┘

Next.js middleware:
  every request → supabase.auth.getSession()
  expired access JWT → auto-refresh via cookie
  no session → redirect /login
  aal < aal2 → redirect /auth/2fa
```

## FastAPI Auth Dependency Chain

```
Request
  │
  ▼
get_current_user()
  │  decode JWT with Supabase secret (python-jose)
  │  check exp
  │  fetch users row
  ▼
require_role('super_admin') ──► 403 if wrong role
  OR
require_project_role('attendee', project_id) ──► 403 if not member
```

## RLS Policy Map

```
Table               Policy
──────────────────────────────────────────────────────────
users               id = auth.uid()
projects            EXISTS project_members WHERE user_id = auth.uid()
project_members     project_id IN (user's projects)
assets              project_id IN (user's projects)
analyses            project_id IN (user's projects)
forms               project_id IN (user's projects)
responses           user_id = auth.uid()
                    OR (attendee AND form.status = 'closed')
attendee_takes      user_id = auth.uid()
                    OR (member AND collection_closed_at IS NOT NULL)
notifications       user_id = auth.uid()
llm_runs            platform_role IN ('developer','super_admin')
audit_log           platform_role = 'super_admin'  (no DELETE policy)
```

## Platform Roles

```
super_admin  ──  manage users, add to projects, see audit log
developer    ──  edit prompts/models/schemas, see LLM run logs
investor     ──  base role; project role (attendee/reviewer) is per-project
```

## Files

```
app/
  dependencies.py      get_current_user, require_role, require_project_role
  routers/
    auth.py            login, 2fa, refresh, accept-invite, logout
  services/
    supabase.py        supabase admin client wrapper
```
