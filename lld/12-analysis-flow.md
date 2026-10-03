# Analysis Flow Canvas

## Overview

The Analysis Flow Canvas is an admin-only page that lets the admin build a
visual pipeline of **task cells** — each cell covering a specific topic
(e.g. "Team", "Market Size", "Risks"). Cells connect in a directed flow so
the output context of one cell feeds the input of the next. Clicking any cell
opens a deep-dive view scoped to that topic: per-investor analysis cards and
a full-width chat interface backed by cell-scoped GraphRAG (backend only — no
graph visualization in the frontend).

This page is available once `project.status = 'consensus' | 'rebuttals' | 'final'`.

---

## Route Structure

```
app/(app)/projects/[id]/
  flow/
    page.tsx              Flow canvas (admin only)
    [cellId]/
      page.tsx            Cell deep-dive (topic graph + conversation)
```

---

## Flow Canvas Layout

```
┌──────────────────────────────────────────────────────────────────┐
│  Sidebar (240px)        │  Canvas (fills remaining width)        │
│                         │                                        │
│  ┌─────────────────┐    │  ┌──────┐       ┌──────┐              │
│  │  Cell Library   │    │  │INPUT │       │INPUT │              │
│  │  ─────────────  │    │  └──┬───┘       └──┬───┘              │
│  │  [Team]         │    │     │  ↗            │  ↗              │
│  │  [Market Size]  │ ◄─drag─  ▼              ▼                  │
│  │  [Risks]        │    │  ┌──────────┐  ┌──────────┐           │
│  │  [Financials]   │    │  │   CELL   │─►│   CELL   │           │
│  │  [Competition]  │    │  │  (topic) │  │  (topic) │           │
│  │  [Traction]     │    │  └──────────┘  └──────────┘           │
│  │  [+ Custom]     │    │        ↘            ↘                 │
│  └─────────────────┘    │     ┌──────┐     ┌──────┐             │
│                         │     │OUTPUT│     │OUTPUT│             │
│                         │     └──────┘     └──────┘             │
└──────────────────────────────────────────────────────────────────┘
```

Each **main cell** (the large rectangle) represents one analysis topic.
It has two satellite nodes:
- **Input node** (top-left): company documents + admin context prompt
- **Output node** (top-right): complete synthesised analysis for that cell

Arrows between cells mean the output context of the source cell is injected
into the input context of the target cell.

---

## Task Cell Model

### DB Tables

```sql
-- One row per cell placed on the canvas
CREATE TABLE flow_cells (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    uuid REFERENCES projects(id) ON DELETE CASCADE,
  topic         text NOT NULL,             -- display name, e.g. "Team"
  topic_prompt  text NOT NULL,             -- scoping instruction for LLM + traversal
  admin_context text DEFAULT '',           -- freetext the admin added to the input node
  asset_ids     uuid[] DEFAULT '{}',       -- company docs pinned to this cell
  output_cache  jsonb,                     -- cached analysis (null until generated)
  position_x    integer DEFAULT 0,
  position_y    integer DEFAULT 0,
  created_at    timestamptz DEFAULT now()
);

-- Directed edges between cells
CREATE TABLE flow_edges (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id     uuid REFERENCES projects(id) ON DELETE CASCADE,
  source_cell_id uuid REFERENCES flow_cells(id) ON DELETE CASCADE,
  target_cell_id uuid REFERENCES flow_cells(id) ON DELETE CASCADE,
  UNIQUE (source_cell_id, target_cell_id)
);
```

### Cell Prompt Construction

When the system needs to run or re-run analysis for a cell it walks
upstream in the flow graph, collects context in topological order, then
builds a single prompt. See **Flow Context Propagation** section below for
the full specification.

```
system_prompt = topic_prompt          # e.g. "Analyse the founding team only"

input_context =
  [upstream cell contexts, in flow order]   # ← see Flow Context Propagation
  + [company asset chunks — GraphRAG scoped to this cell's topic]
  + [admin_context]                         # what admin typed into input node
  + [AdminConversationTurn nodes for this cell, in turn order]

output =
  {summary, per_investor_views, key_insights, open_questions}
```

---

## Cell Deep Dive View

Clicking the main cell rectangle navigates to `/projects/[id]/flow/[cellId]`.

```
┌──────────────────────────────────────────────────────────────────┐
│  ← Topics     Team Analysis                    Vaulta · S-A     │
├──────────────────────────────────────────────────────────────────┤
│  Investor Views                                                  │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐        │
│  │ [Investor A]  │  │ [Investor B]  │  │ [Investor C]  │        │
│  │ "Strong team" │  │ "First-time   │  │ "GTM gap is   │        │
│  │              │  │  founders"    │  │  manageable"  │        │
│  └───────────────┘  └───────────────┘  └───────────────┘        │
├──────────────────────────────────────────────────────────────────┤
│  Chat (full-width, scrollable)                                   │
│    [admin]: Does the team have enterprise sales experience?      │
│    [system]: ···  (typing indicator while GraphRAG runs)         │
│    [system]: Based on the pitch deck and founder audio...        │
│              [📄 Slide 7]  [🎤 Founder audio]                   │
│                                                                  │
│  [ Ask about this topic...                    ] [🎤] [Send →]   │
└──────────────────────────────────────────────────────────────────┘
```

No graph panel. GraphRAG runs in the backend; only answers and source pills reach the frontend.

---

## Knowledge Graph: Investor View Nodes

Each investor's conversation analysis for a cell topic is materialised as a
new node type in Neo4j so it participates in traversal.

```
(:InvestorView)
  id            string  (uuid)
  project_id    string
  cell_id       string
  investor_id   string  (user UUID)
  investor_name string
  summary       string  (extracted view on this topic)
  sentiment     string  (positive | negative | neutral | mixed)
  embedding     list<float>   ← indexed for ANN search
```

Relationships:

```
(:InvestorView) -[:VIEW_OF]-> (:FlowCell {id})
(:InvestorView) -[:MENTIONS]-> (:Entity)   ← same entity extraction pipeline
(:Chunk)        -[:SUPPORTS|CONTRADICTS]-> (:InvestorView)   ← added during cell analysis
```

These nodes are built when admin triggers "Analyse Cell" for a specific cell
(a new worker job: `build_cell_views`).

### build_cell_views Worker

```
Input:  cell_id

Step 1  For each investor in project:
          Pull their conversation turns (conversation table)
          Filter to turns that mention cell.topic (simple keyword match + LLM filter)
          Extract investor's view on this topic → InvestorView node

Step 2  Embed each InvestorView.summary
        Link to entities mentioned (same NER pipeline used by asset processor)
        Find supporting/contradicting Chunk nodes via cosine similarity

Step 3  Mark cell.output_cache = { investor_views, key_agreements,
                                    key_disagreements, synthesis }
```

---

## Cell-Scoped GraphRAG Traversal

When admin sends a message in the cell deep-dive conversation panel, the
same GraphRAG traversal runs but with an additional topic scope filter:

```
Extra WHERE clause added to every Cypher query:
  AND (c.topic_tags IS NULL OR $topic IN c.topic_tags
       OR c.project_id = $project_id)

Seed node boost: chunks previously visited during build_cell_views get
  relevance × 1.2 so they seed the traversal first.

InvestorView nodes join the traversal as first-class nodes —
they are visited during BFS and their summaries contribute
to the LLM context window.
```

The backend emits `node_visited` SSE events internally (same shape as base traversal, extended with `node_label` and `investor_name` fields for InvestorView nodes). These events are used for context building only — the frontend does not consume them. The frontend only processes `answer_token` and `answer_done`.

---

---

## New API Endpoints

```
POST   /projects/{id}/flow/cells          Create cell
PATCH  /projects/{id}/flow/cells/{cellId} Update topic/prompt/context/assets/position
DELETE /projects/{id}/flow/cells/{cellId} Delete cell + cascade edges
GET    /projects/{id}/flow                List all cells + edges (canvas state)

POST   /projects/{id}/flow/edges          Create edge {source_cell_id, target_cell_id}
DELETE /projects/{id}/flow/edges/{edgeId} Delete edge

POST   /projects/{id}/flow/cells/{cellId}/analyse
  → enqueues build_cell_views job, returns job_id

GET    /projects/{id}/flow/cells/{cellId}/conversation/stream
  → SSE, cell-scoped GraphRAG (same shape as /conversation/{id}/stream)
POST   /projects/{id}/flow/cells/{cellId}/conversation
  → store conversation turn for this cell (separate from investor conversation)
```

All endpoints require `platform_role = 'super_admin'` or project role `reviewer`.

---

## Canvas State: React Flow

The canvas uses **React Flow**. There is no D3 dependency — the knowledge graph is backend-only.

```typescript
// Custom node types registered with React Flow
const nodeTypes = {
  taskCell:   TaskCellNode,    // main rectangle, clickable → deep dive
  inputNode:  InputNode,       // satellite: doc picker + admin text
  outputNode: OutputNode,      // satellite: synthesis preview
};

// Custom edge type
const edgeTypes = {
  flowEdge: FlowEdge,   // animated arrow, shows "context flows →"
};
```

Positions are persisted on `PATCH /flow/cells/{id}` on drag-end (debounced 500ms).

---

## Preset Cell Library

The sidebar offers pre-defined cells that ship with a sensible `topic_prompt`:

| Cell Name      | Default topic_prompt |
|----------------|----------------------|
| Team           | Focus only on founding team, key hires, background, gaps |
| Market Size    | Focus only on TAM/SAM/SOM claims, methodology, evidence |
| Traction       | Focus only on revenue, growth rate, customer evidence |
| Competition    | Focus only on competitive landscape and differentiation |
| Risks          | Focus only on stated and unstated risks and mitigants |
| Financials     | Focus only on unit economics, burn rate, runway, projections |
| Product        | Focus only on product maturity, roadmap, technical moat |
| + Custom       | Admin writes their own topic and prompt |

---

---

## Admin Conversation Ingestion into Knowledge Graph

Every completed turn in the cell deep-dive conversation is immediately
persisted as `AdminConversationTurn` nodes in Neo4j (see `03-knowledge-graph.md`).
The knowledge graph is **project-scoped** — these nodes live alongside the
asset chunks and are indexed for ANN search the same way.

### Ingestion flow (per turn)

```
Admin sends message in cell deep-dive
        │
        ▼
cell-scoped GraphRAG traversal runs
  → visited_chunks[], answer_text, cited_chunk_ids
        │
        ▼
After answer streams to frontend:

  1. Create admin turn node:
       INSERT AdminConversationTurn {
         role: 'admin', text: admin_message,
         cell_id, project_id, turn_index
       }
       embedding = embed(admin_message)
       INSERT into Neo4j

  2. Create system turn node:
       INSERT AdminConversationTurn {
         role: 'system', text: answer_text,
         cell_id, project_id, turn_index + 1
       }
       embedding = embed(answer_text)
       INSERT into Neo4j

  3. Link system turn → cited chunks:
       for chunk_id in cited_chunk_ids:
         CREATE (:AdminConversationTurn {id: system_turn_id})
                -[:CITED]->
                (:Chunk {id: chunk_id})

  4. Link admin turn → system turn:
       CREATE (admin_turn)-[:ANSWERED_BY]->(system_turn)

  5. NER pass on both texts (same pipeline as assets):
       CREATE [:MENTIONS] edges to Entity nodes

  6. SIMILAR_TO edges:
       cosine similarity between new turn embeddings and existing
       Chunk nodes — threshold 0.78 (slightly lower than 0.82 for
       cross-asset chunk similarity, to catch conceptual overlap)
```

### What this means for traversal

When the admin later asks a question in *any* cell (same project), the
GraphRAG traversal can reach `AdminConversationTurn` nodes as natural
neighbours. A system turn that answered "the team lacks enterprise sales
experience" will surface as a graph node when a downstream Risk cell
traverses for evidence about team risk — without any special handling.

---

## Flow Context Propagation

When a cell has one or more parent cells connected via `flow_edges`, the
downstream cell's analysis prompt is enriched with the upstream context.
This is the core mechanism that makes the flow useful: the admin's
intellectual work in Cell A (documents explored + conversation) becomes
structured input for Cell B.

### What "upstream context" contains

For each directly connected parent cell (in topological order):

```
{
  topic:              cell.topic,                       // e.g. "Team"
  analysis_synthesis: cell.output_cache.synthesis,      // the cell's analysis output
  conversation_summary: <derived — see below>           // admin's exploration notes
}
```

`conversation_summary` is built at analysis-run time:

```python
# pull all AdminConversationTurn nodes for parent cell, in order
turns = neo4j.query("""
  MATCH (t:AdminConversationTurn {cell_id: $cell_id, project_id: $project_id})
  RETURN t.role, t.text, t.turn_index
  ORDER BY t.turn_index
""")

# summarise with LLM if > 10 turns (keep it under ~800 tokens)
if len(turns) > 10:
    conversation_summary = claude.summarise(turns, instruction=
        "Summarise the key questions asked and insights found. "
        "Preserve specific facts, numbers, and concerns raised.")
else:
    conversation_summary = format_turns_verbatim(turns)
```

### Full prompt structure for a downstream cell

```
[SYSTEM]
{cell.topic_prompt}

You have access to upstream analysis from earlier topics in this pipeline.
Use it as additional context but focus your own analysis on {cell.topic}.

───────────────────────────────────────────────
UPSTREAM CONTEXT — {parent_cell.topic}
───────────────────────────────────────────────
Analysis:
{parent_cell.output_cache.synthesis}

Admin's exploration notes on {parent_cell.topic}:
{conversation_summary}

───────────────────────────────────────────────
COMPANY DOCUMENTS (relevant to {cell.topic})
───────────────────────────────────────────────
{GraphRAG top chunks scoped to this cell's topic}

───────────────────────────────────────────────
ADMIN ADDITIONAL CONTEXT
───────────────────────────────────────────────
{cell.admin_context}

───────────────────────────────────────────────
ADMIN'S OWN EXPLORATION NOTES ON {cell.topic}
───────────────────────────────────────────────
{this cell's AdminConversationTurn nodes, verbatim or summarised}
```

If the cell has multiple parents (fan-in), each parent gets its own
`UPSTREAM CONTEXT` block, ordered by the topological sort of the flow graph.

### When upstream context is stale

If an upstream cell's `output_cache` is `null` (not yet analysed), the
downstream cell cannot run. The `build_cell_views` job checks this before
starting and returns an error: `upstream_cells_not_ready: [cell_id, ...]`.

The frontend shows a warning on the downstream cell: "Waiting for Team
analysis to complete before this cell can run."

### Output cache schema (what flows downstream)

```jsonc
// flow_cells.output_cache
{
  "synthesis":          "string — 3-5 paragraph narrative analysis",
  "per_investor_views": [{ "investor_id", "investor_name", "summary", "sentiment" }],
  "key_insights":       ["string", ...],
  "open_questions":     ["string", ...],
  "conversation_turn_count": 12,     // how many admin turns contributed
  "generated_at":       "ISO8601"
}
```

`synthesis` + the conversation summary derived from `AdminConversationTurn`
nodes is what propagates. The full `per_investor_views` and `key_insights`
are available in the output node UI but are not passed upstream (too large).

---

## Files

```
app/
  (app)/projects/[id]/flow/
    page.tsx                  FlowCanvas (React Flow canvas + sidebar)
    [cellId]/page.tsx         CellDeepDive (graph + investor analyses + convo)

components/
  flow/
    FlowCanvas.tsx            React Flow wrapper, loads cells/edges
    TaskCellNode.tsx          Main cell rectangle custom node
    InputNode.tsx             Input satellite node (doc picker + text)
    OutputNode.tsx            Output satellite node (synthesis preview)
    CellSidebar.tsx           Preset library, drag to canvas
    CellDeepDive.tsx          Full deep-dive layout
    InvestorViewCards.tsx     Per-investor analysis accordion
    CellConversation.tsx      Conversation panel scoped to cell topic

app/
  services/
    cell_traversal.py         GraphRAG traversal with topic scope +
                              InvestorView + AdminConversationTurn nodes
    cell_context.py           build_upstream_context(), summarise_turns()
  workers/
    cell_analysis.py          build_cell_views job (checks upstream readiness)
  routers/
    flow.py                   All /flow/* endpoints
```
