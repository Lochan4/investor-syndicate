# Competitive Intelligence Scan

## Overview

After all project assets are processed and the knowledge graph is ready, the
system automatically runs a **competitive scan**: it extracts the startup's
value proposition from the graph, generates targeted web search queries, pulls
competitor data from the web, and ingests the results as a first-class
`competitive_intel` asset. The resulting chunks are embedded and added to the
Neo4j graph exactly like any other asset — no special traversal code needed.

When an investor or admin asks "who are the competitors?" or "what is the
market landscape?", the GraphRAG traversal finds these nodes automatically.

---

## Trigger

```
Project status transitions to 'open'
  (all assets ready + ≥1 investor added)
      │
      └── enqueue run_competitive_scan(project_id)
               idempotency key: project_id
               (skip if asset with kind='competitive_intel' already exists)
```

Admin can also manually re-trigger from the assets page:
`POST /projects/{id}/assets/competitive-scan`

---

## Worker: run_competitive_scan

```
Input: project_id

Step 1 — Extract startup profile from existing graph

  Query Neo4j for the top Chunk nodes from PDF/PPTX assets
  (the pitch deck material — most likely to contain value prop):

    MATCH (c:Chunk)-[:PART_OF]->(a:Asset {project_id: $pid})
    WHERE a.kind IN ['pdf', 'presentation']
    RETURN c.text ORDER BY c.chunk_index LIMIT 20

  LLM call (claude-sonnet-4-6):
    Prompt: extract startup profile
    Output (structured):
      {
        "company_name": str,
        "one_liner": str,           // ≤ 25 words
        "market_category": str,     // e.g. "B2B SaaS, HR tech"
        "problem_solved": str,
        "target_customer": str,
        "search_queries": [str × 5] // diverse angles, see below
      }

  Store as project metadata:
    UPDATE projects SET competitive_profile = <output> WHERE id = $pid

Step 2 — Generate search queries

  The LLM generates 5 queries covering different angles:
    q1: "companies similar to {one_liner}"
    q2: "{market_category} startups competitors {current_year}"
    q3: "{problem_solved} software solutions"
    q4: "alternatives to {company_name}"
    q5: "{target_customer} {market_category} tools"

  (LLM writes the actual queries, not a template — these are examples)

Step 3 — Web search (Serper API — Google Search)

  For each query:
    response = httpx.post(
      "https://google.serper.dev/search",
      headers={"X-API-KEY": SERPER_API_KEY, "Content-Type": "application/json"},
      json={"q": query, "num": 10, "gl": "us"},
    )
    results = response.json().get("organic", [])
    # Each result: {title, link, snippet, position}

  Collect up to 50 raw results total (5 queries × 10 each).
  Deduplicate by domain (keep first result per domain, Google already ranks).
  Drop results with no snippet or snippet length < 40 chars.
  Target: 8–15 unique competitor candidates.

Step 4 — Assess and summarise competitors

  Single LLM call (claude-sonnet-4-6) with all raw snippets:
    Prompt: "For each search result below, assess its relevance as a competitor
             to {company_name} ({one_liner}). Return JSON array."
    Output per competitor:
      {
        "name":               str,
        "url":                str,
        "description":        str,     // ≤ 80 words
        "similarity_reason":  str,     // why it competes
        "overlap":            "direct" | "adjacent" | "indirect",
        "known_differentiator": str,   // what makes them different
        "relevance_score":    float    // 0–1
      }

  Filter: keep overlap != 'indirect' OR relevance_score ≥ 0.6
  Drop: the startup itself if it appears in results

Step 5 — Build competitive intel text

  Compose a structured text document from the competitor assessments:

    # Competitive Landscape — {company_name}
    Generated: {date}

    ## Market Category
    {market_category}

    ## Direct Competitors
    ### {name}  [{url}]
    {description}
    Why it competes: {similarity_reason}
    Differentiator: {known_differentiator}

    ## Adjacent Players
    ... (same format)

    ## Market Summary
    {LLM-synthesised overview from all Serper snippets combined}

Step 6 — Ingest as asset (standard pipeline)

  INSERT assets row:
    kind        = 'competitive_intel'
    filename    = 'competitive_scan_{date}.md'
    status      = 'pending'
    storage_key = upload text to S3

  enqueue process_asset(asset_id)
    → standard chunker + embedding + Neo4j ingestion
    → NER extracts competitor company names as Entity nodes
    → cross-asset similarity edges link competitor chunks to pitch deck
       chunks that mention the same entities/concepts

  On completion: UPDATE assets SET status='ready'
                 emit notification: 'competitive_scan_complete'
```

---

## Graph Impact

After ingestion the graph gains:

```
(:Chunk {asset_kind: 'competitive_intel'})
  — participates in all existing traversal with no changes
  — SIMILAR_TO edges link it to pitch deck chunks mentioning same market
  — MENTIONS edges link it to (:Entity {kind: 'company'}) nodes
     one per competitor name extracted by NER

(:Entity {kind: 'company', name: 'CompetitorX'})
  — RELATED_TO edges to (:Entity {kind: 'market_category'}) nodes
     already in graph from pitch deck
```

No new node labels or relationship types needed. The standard pipeline
handles all of this once the text is chunked and embedded.

---

## UI — Assets Page

The asset card for `competitive_intel` shows:

```
┌────────────────────────────────────────────────────────────┐
│  competitive_scan_2026-10-02.md    [competitive intel]     │
│  Auto-generated · 14 competitors found                     │
│  status: ready  |  112 knowledge nodes created             │
│                                          [Re-run Scan]     │
└────────────────────────────────────────────────────────────┘
```

"Re-run Scan" calls `POST /projects/{id}/assets/competitive-scan`, which
deletes the old competitive_intel asset and enqueues a fresh scan.

---

## Competitive Profile in Cell Deep Dive

When the admin opens the **Competition** task cell in the Analysis Flow Canvas
(`lld/12-analysis-flow.md`), the cell's GraphRAG traversal naturally surfaces
`competitive_intel` chunks because they embed into the same vector space.

The admin can ask:
- "Which competitor is most similar to us on go-to-market?"
- "What do investors think about our competitive moat vs Competitor X?"

The traversal will find `competitive_intel` chunks AND `InvestorView` nodes
in the same search, giving a unified answer.

---

## Failure Handling

```
Scenario                          Action
──────────────────────────────────────────────────────────────────
Serper API error / timeout        Retry 3× with exponential backoff;
                                  if all fail, mark asset status='failed',
                                  notify admin
< 3 competitors found             Proceed with what was found; log warning
                                  in asset metadata: {"low_result_warning": true}
LLM assessment fails validation   Retry once; on second fail skip assessment
                                  step, ingest raw Serper snippets directly
Competitive scan already exists   Idempotency key blocks re-queue;
                                  only Re-run Scan button can override
```

---

## New Dependency

`httpx` is already in the FastAPI stack. No new package needed.

One new env var: `SERPER_API_KEY`

---

## Files

```
app/
  workers/
    competitive_scan.py   run_competitive_scan job
  services/
    competitive.py        extract_startup_profile(), assess_competitors(),
                          build_competitive_text()
  routers/
    assets.py             +POST /projects/{id}/assets/competitive-scan (re-run)
```

`competitive_scan.py` calls `process_asset` directly at the end (no separate
enqueue) so the full pipeline runs in the same worker process in sequence.
```
