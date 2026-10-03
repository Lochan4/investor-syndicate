# Frontend Architecture — Next.js 14 App Router

## Route Structure

```
app/
  (auth)/
    login/               Login + TOTP challenge
    accept-invite/       Complete sign-up

  (app)/                 Auth guard in layout.tsx
    layout.tsx           Sidebar nav + notification bell
    dashboard/           Project list (admin/reviewer view)
    investments/
      page.tsx           My Investments — all projects the logged-in
                         investor has been added to (attendee role)
    projects/
      new/               Create project (manual, no auto-creation)
      [id]/
        page.tsx         Project hub — status-driven
        assets/
          page.tsx       Asset upload + processing status + per-asset analysis
        flow/
          page.tsx       Flow canvas — investor entry point (read-only) + admin view
          [cellId]/
            page.tsx     Cell chat interface (full-width, no graph panel)

  (admin)/               super_admin guard
    users/
    audit/

  (developer)/           developer guard
    prompts/[stage]/
```

## Dashboard — Two Entry Points

The dashboard header shows two CTAs based on the user's role:

```
[+ New Project]          (visible to super_admin only)
[My Investments →]       (visible to all — links to /investments)
```

## My Investments Page (/investments)

For investors (platform_role = 'investor'), this is their primary view.
For admins, it shows projects they've been added to as a reviewer/attendee.

```
┌──────────────────────────────────────────────────────────────────┐
│  My Investments                                                  │
├──────────────────────────────────────────────────────────────────┤
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  Acme Inc · Series A                     [open]            │  │
│  │  Added 12 Oct 2026                                         │  │
│  │  Your status: Conversation pending · Form not started      │  │
│  │                              [Continue →]                  │  │
│  └────────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  BetaCo · Seed                           [final]           │  │
│  │  Completed 30 Sep 2026                                     │  │
│  │  Your status: Submitted · Final analysis available         │  │
│  │                              [View Analysis →]             │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

Data comes from `GET /investments` — returns all `project_members` rows
where `user_id = auth.uid()`, joined to project status and the user's
own conversation/form completion state.

```typescript
// app/(app)/investments/page.tsx (server component)
const investments = await fetchInvestments();
// investments: [{
//   project_id, project_name, status,
//   added_at, my_role,
//   conversation_submitted: bool,
//   form_submitted: bool,
//   final_available: bool
// }]
```

New endpoint: `GET /investments`
  Returns project_members for auth.uid(), joined to projects + completion state.

---

## Project Hub — Status-Driven UI

```
Status              Admin sees                 Investor sees
────────────────────────────────────────────────────────────
draft               Asset upload panel         —
building_graph      Processing indicator       —
open                Flow canvas (progress)     Flow canvas (explore)
consensus           "Analysis running"         "Analysis running"
final               Final report               Final report
```

## Conversation Interface — Cell Chat

The cell deep-dive page is a **full-width chat interface**. There is no graph panel. The GraphRAG retrieval runs in the backend; the frontend only consumes `answer_token` and `answer_done` SSE events — it never receives or renders `node_visited` events.

### Layout

```
┌────────────────────────────────────────────────────────────────┐
│  ← Topics     Team Analysis                    Vaulta · S-A   │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  Chat history (scrollable, fills viewport)                     │
│    [investor]: How strong is the team?                         │
│    [system]:   Based on the pitch deck and the founder         │
│                recording, the founding team has...   [sources] │
│    ...                                                         │
│                                                                │
├────────────────────────────────────────────────────────────────┤
│  [ Ask about this topic...              ] [🎤] [Send →]       │
└────────────────────────────────────────────────────────────────┘
```

### Thinking state

While the backend runs GraphRAG traversal + LLM generation, the frontend shows a simple typing indicator (three animated dots). No traversal details are shown.

```
[system]: ···
```

### Source pills

After each system answer, source pills show which assets were cited:

```
[📄 Slide 7]  [🎤 Founder audio · 03:41]
```

These come from the `answer_done` SSE event `sources` field.

### Voice Button Flow

```
Tap 🎤 → MediaRecorder starts → button turns red + pulse animation
Tap again → recording stops → audio blob POSTed to /conversation/{cellId}/voice
             → transcribed text appears in input box → auto-send
```

## Asset Upload Page

```
Drag-and-drop zone (accepts all file types)
Per-asset status cards:
  filename  |  kind badge  |  size  |  status (pending/processing/embedding/ready/failed)
  
"Processing" state shows: "Extracting text from audio..." with a spinner
"Ready" state shows:      "482 knowledge nodes created"
"Failed" state shows:     error message + retry button
```

## Key Dependencies

| Package | Purpose |
| --- | --- |
| `reactflow` | Flow canvas node editor (flow page only) |
| `@supabase/ssr` | Auth in App Router |
| `@tanstack/react-query` | Server state + cache |
| `shadcn/ui` | UI components |
| Tailwind CSS | Styling |

No state management library beyond React Query + useState.

## Files

```
app/
  (app)/dashboard/                 Project list (admin/reviewer)
  (app)/investments/               My Investments (investor portfolio view)
  (app)/projects/new/              Create project form
  (app)/projects/[id]/assets/      Asset upload + status + per-asset analysis
  (app)/projects/[id]/flow/        Flow canvas
  (app)/projects/[id]/flow/[cellId]/ Cell chat interface

components/
  CellChat.tsx               Full-width chat — history + input + voice + source pills
  AssetUpload.tsx            Drag-drop + status cards + per-asset analysis panel
  FlowCanvas.tsx             React Flow canvas (investor read-only + admin view)
```

## Per-Asset Analysis Panel

After an asset reaches `status = 'ready'`, the asset card expands to show an analysis panel below it:

```
┌─────────────────────────────────────────────────────────────────┐
│  📄 Vaulta_SeriesA_Deck.pdf                    [✓ Ready]        │
│  PDF · 4.2 MB · 482 chunks · processed 2h ago                  │
├─────────────────────────────────────────────────────────────────┤
│  KEY ENTITIES                                                   │
│  👤 Aryan Mehta   👤 Tanvi Shah   🏢 Vaulta   🏢 Stripe       │
│  📊 $1.2M ARR   📊 40% MoM   📊 $8M raise   📍 Series A       │
│                                                                 │
│  SUMMARY                                                        │
│  AI-powered AP automation for mid-market enterprises. Team of  │
│  2 with Stanford/IIT backgrounds. Strong traction at $1.2M ARR │
│  with 18 enterprise customers. Raising $8M Series A.           │
│                                                                 │
│  TOPICS COVERED                                                 │
│  Team ·  Market Size ·  Traction ·  Product ·  Financials      │
└─────────────────────────────────────────────────────────────────┘
```

The analysis is generated by a `run_asset_analysis(asset_id)` worker job that runs after `build_graph_edges` completes. Output stored in `assets.analysis_cache (jsonb)`.

## Admin Settings — Flow Template Editor

Route: `(admin)/settings/flow-template/page.tsx`

The admin edits the global flow template from the Settings page. This is the only place the cell sequence and prompts can be changed. Changes are versioned — existing projects are never affected.

```
┌─────────────────────────────────────────────────────────────────┐
│  Settings → Flow Template                    [Publish New v4]  │
│  Current live: v3 · 6 cells · published 2026-09-15            │
├─────────────────────────────────────────────────────────────────┤
│  CELLS (drag to reorder)                                        │
│  ≡  1. Team          [edit prompt ↗]                           │
│  ≡  2. Market Size   [edit prompt ↗]                           │
│  ≡  3. Traction      [edit prompt ↗]                           │
│  ≡  4. Competition   [edit prompt ↗]                           │
│  ≡  5. Risks         [edit prompt ↗]                           │
│  ≡  6. Financials    [edit prompt ↗]                           │
│                               [+ Add Cell]                      │
├─────────────────────────────────────────────────────────────────┤
│  VERSION HISTORY                                                │
│  v3  live    published 2026-09-15  (current)                   │
│  v2  archived  2026-08-01                                       │
│  v1  archived  2026-07-10                                       │
└─────────────────────────────────────────────────────────────────┘
```

Endpoints: `GET /admin/flow-template/versions`, `POST /admin/flow-template/publish`, `GET /admin/flow-template/cells/{version_id}`
