# Auth & Access Control

## Component Diagram

```
  Browser / Next.js
       │
       │  (hosted WorkOS login UI)
       ▼
  ┌─────────────────────────────────────────┐
  │           WorkOS AuthKit                │
  │                                         │
  │  Hosted login page (email/password)     │
  │  MFA (TOTP) managed by WorkOS           │
  │  Invite emails sent by WorkOS           │
  │  Session → signed JWT returned          │
  └──────────────┬──────────────────────────┘
                 │
                 │  Authorization: Bearer <workos_jwt>
                 ▼
  ┌─────────────────────────────────────────┐
  │           FastAPI  /api/v1              │
  │                                         │
  │  auth.py middleware                     │
  │  1. Decode WorkOS JWT (JWKS verify)     │
  │  2. Extract user_id from sub claim      │
  │  3. Lookup platform_role in users table │
  │  4. Inject CurrentUser into request     │
  └──────────────┬──────────────────────────┘
                 │
                 ▼
  ┌─────────────────────────────────────────┐
  │         Postgres (Supabase)             │
  │                                         │
  │  users table  (mirrors WorkOS users)    │
  │  pending_invites table                  │
  │  project_members table                  │
  │  Access control enforced in FastAPI     │
  │  (RLS disabled — FastAPI is only client)│
  └─────────────────────────────────────────┘
```

## Invite Flow

```
super_admin
    │
    │  POST /admin/invite  {email, project_id, role}
    ▼
FastAPI
    │  INSERT pending_invites(email, project_id, role)
    │  workos_client.user_management.send_invitation(email, org_id)
    │  ──► WorkOS sends invite email to user
    ▼
User clicks WorkOS invite link → completes signup
    │
    │  WorkOS fires webhook: user.created
    ▼
POST /webhooks/workos
    │  INSERT users(id=workos_user_id, email, platform_role='investor')
    │  SELECT pending_invites WHERE email = new user's email
    │  INSERT project_members(project_id, user_id, role) for each pending invite
    │  UPDATE pending_invites SET accepted_at = now()
    ▼
User is active — can log in immediately
```

## Token Model

```
┌────────────────────────────────────────────────────────┐
│  WorkOS JWT (access token)  │  short-lived │  memory   │
│  WorkOS session cookie      │  managed by AuthKit       │
└────────────────────────────────────────────────────────┘

Next.js middleware (middleware.ts):
  every request → authkitMiddleware()
  no session → redirect to WorkOS hosted login
  valid session → attach access token to API requests

Next.js app layout (app/(app)/layout.tsx):
  getUser({ ensureSignedIn: true })
  passes user + access token to all child server components
```

## FastAPI Auth Dependency Chain

```
Request  (Authorization: Bearer <workos_jwt>)
  │
  ▼
get_current_user()
  │  verify JWT signature against WorkOS JWKS endpoint
  │  check exp
  │  extract sub → workos_user_id
  │  SELECT users WHERE id = workos_user_id → platform_role
  ▼
require_role('super_admin') ──► 403 if wrong role
  OR
require_project_role('attendee', project_id) ──► 403 if not member
```

## Access Control Map

```
Table               Enforced by
──────────────────────────────────────────────────────────
users               FastAPI: user can only read/update own row
projects            FastAPI: require_project_role check on all routes
project_members     FastAPI: super_admin only for write; read scoped to project
assets              FastAPI: require_project_role('attendee')
analyses            FastAPI: require_project_role('attendee')
notifications       FastAPI: user_id = current user only
llm_runs            FastAPI: require_role('developer' | 'super_admin')
audit_log           FastAPI: require_role('super_admin'), no delete
```

Note: Supabase RLS is **disabled**. FastAPI is the sole database client and
enforces all access control. This is intentional — WorkOS issues JWTs, not
Supabase Auth tokens, so RLS `auth.uid()` would not work.

## Platform Roles

```
super_admin  ──  manage users, invite to projects, see audit log
developer    ──  edit prompts/models/schemas, see LLM run logs
investor     ──  base role; project role (attendee/reviewer) is per-project
```

## Frontend — 3 Files Total

```
middleware.ts
  authkitMiddleware()
  — intercepts every request, redirects unauthenticated users to WorkOS login

app/callback/route.ts
  handleAuth()
  — WorkOS redirects here after login; exchanges code for session

app/(app)/layout.tsx
  const { user, accessToken } = await getUser({ ensureSignedIn: true })
  — wraps all authenticated routes; all child pages receive user + token
```

## Backend Files

```
app/
  dependencies.py      get_current_user, require_role, require_project_role
  routers/
    admin.py           POST /admin/invite, POST /webhooks/workos
  services/
    workos.py          WorkOS SDK client wrapper (singleton)
```
