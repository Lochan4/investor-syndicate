# Knowledge Graph — Neo4j Schema & Traversal

> **Frontend note:** The knowledge graph is a backend retrieval engine only. No graph visualization is shown to users. The frontend chat interface shows only answers and source pills. All GraphRAG traversal, BFS expansion, and SSE `node_visited` events are internal — the frontend only consumes `answer_token` and `answer_done`.

## Why Neo4j

Assets are not independent documents — they reference the same people, metrics, markets, and claims. A graph captures these cross-asset relationships naturally. When an investor asks "what do you know about the founder's background?", the traversal follows edges across the pitch deck, the founder image description, the audio recording, and any Excel with team data — returning a connected, multi-source answer.

## Node Labels

```
(:Project)
  id          string  (Postgres project UUID)
  name        string

(:Asset)
  id          string  (Postgres asset UUID)
  project_id  string
  kind        string  (pdf | audio | image | spreadsheet | text | video)
  filename    string
  storage_key string

(:Chunk)
  id              string  (uuid)
  asset_id        string
  project_id      string
  text            string
  chunk_index     int
  page_number     int?    (PDF/PPTX only)
  timestamp_start float?  (audio/video only)
  embedding       list<float>   ← 1536-dim, indexed for ANN search

(:Entity)
  id      string
  name    string
  kind    string  (person | company | location | metric | concept | product)
  project_id string

(:AdminConversationTurn)
  id          string  (uuid)
  project_id  string
  cell_id     string  (flow_cells.id — which topic cell this turn belongs to)
  role        string  (admin | system)
  text        string  (full message text)
  turn_index  int     (order within this cell's conversation)
  embedding   list<float>   ← indexed for ANN search
```

## Relationship Types

```
(:Asset)    -[:BELONGS_TO]->  (:Project)
(:Chunk)    -[:PART_OF]->     (:Asset)
(:Chunk)    -[:NEXT]->        (:Chunk)          sequential within asset
(:Chunk)    -[:SIMILAR_TO {score: float}]-> (:Chunk)  cosine sim > 0.82
(:Chunk)    -[:MENTIONS]->    (:Entity)
(:Entity)   -[:RELATED_TO {via: chunk_id}]-> (:Entity)  co-mentioned in same chunk

-- Admin conversation turns (from cell deep-dive, see 12-analysis-flow.md)
(:AdminConversationTurn {role:'admin'})  -[:ANSWERED_BY]->  (:AdminConversationTurn {role:'system'})
(:AdminConversationTurn {role:'system'}) -[:CITED]->        (:Chunk)   chunks used in that answer
(:AdminConversationTurn)                 -[:MENTIONS]->     (:Entity)  entities in the turn text
(:AdminConversationTurn)                 -[:SIMILAR_TO {score: float}]-> (:Chunk)  cosine sim > 0.78
```

## Vector Index (ANN Search)

```cypher
CREATE VECTOR INDEX chunk_embeddings
FOR (c:Chunk) ON (c.embedding)
OPTIONS {indexConfig: {
  `vector.dimensions`: 1536,
  `vector.similarity_function`: 'cosine'
}}
```

Used for seed node lookup: embed the query → find the K closest Chunk nodes by cosine similarity.

## Graph Traversal Algorithm (GraphRAG)

This runs every time an investor sends a message (text or voice).

```
Input:  query_text, project_id, max_depth=3, seed_k=5, max_nodes=40

Step 1 — Seed nodes (vector similarity)
  query_embedding = embed(query_text)
  seeds = Neo4j vector index search:
    CALL db.index.vector.queryNodes('chunk_embeddings', seed_k, query_embedding)
    YIELD node, score
    WHERE node.project_id = $project_id
    RETURN node, score

Step 2 — BFS expansion
  visited = {seed.id: seed for seed in seeds}
  queue = seeds (sorted by score desc)

  while queue not empty AND len(visited) < max_nodes:
    current = queue.pop()
    if current.depth >= max_depth: continue

    neighbors = Neo4j:
      MATCH (c:Chunk {id: $id})-[r:NEXT|SIMILAR_TO|MENTIONS*1..1]-(neighbor)
      WHERE neighbor.project_id = $project_id
        AND NOT neighbor.id IN $visited_ids
      RETURN neighbor, type(r) as edge_type, r.score as edge_score

    for neighbor in neighbors:
      relevance = cosine_sim(query_embedding, neighbor.embedding)
                  * decay(hop_distance)          # 0.85 per hop
      if relevance > 0.45:
        visited[neighbor.id] = {node: neighbor, relevance, edge_type, parent: current.id}
        queue.push(neighbor)

Step 3 — Stream traversal to frontend (SSE)
  For each node as it is visited in step 2:
    yield SSE event:
      {
        type: "node_visited",
        node_id: str,
        text_preview: first 120 chars,
        edge_type: "SIMILAR_TO" | "NEXT" | "MENTIONS",
        score: float,
        asset_kind: "pdf" | "audio" | "image" | ...
        parent_node_id: str | null
      }

Step 4 — Build context
  top_chunks = top 12 nodes by relevance score
  context = "\n\n".join([f"[{node.asset_kind}] {node.text}" for node in top_chunks])

Step 5 — LLM answer
  answer = claude.messages.create(
    model="claude-opus-4-6",
    system=CONVERSATION_SYSTEM_PROMPT,
    messages=[
      ...conversation_history,
      {"role":"user","content": f"Context:\n{context}\n\nQuestion: {query_text}"}
    ]
  )

Step 6 — Return
  {
    answer: str,
    traversal: [{node_id, text_preview, score, edge_type, asset_kind}],
    sources: [unique asset_ids used in top_chunks]
  }
```

## Traversal SSE Stream

The frontend subscribes to `GET /conversation/{session_id}/stream` before sending the message. Events arrive in this order:

```
event: traversal_start
data: {"query": "...", "seed_count": 5}

event: node_visited                    ← one per node, as traversal runs
data: {"node_id": "...", "text_preview": "...", "score": 0.91, "edge_type": "SIMILAR_TO", "asset_kind": "pdf", "parent_node_id": "..."}

event: traversal_complete
data: {"total_nodes": 28, "top_chunks": 12}

event: answer_token                    ← streaming LLM response
data: {"token": "The founder..."}

event: answer_done
data: {"sources": ["asset_id_1", "asset_id_2"]}
```

## Frontend Surface

The frontend does not visualize the graph. After each completed traversal the `answer_done` SSE event carries `sources: [asset_id, ...]` — these are rendered as source pills in the chat UI (e.g. `[📄 Slide 7]`, `[🎤 Founder audio · 03:41]`). That is the only traversal output the frontend consumes.

## Cypher Queries Reference

```cypher
-- All chunks for a project
MATCH (c:Chunk {project_id: $project_id}) RETURN c

-- Full graph for a project (for frontend initial load)
MATCH (c:Chunk {project_id: $project_id})-[r]-(n)
WHERE n.project_id = $project_id
RETURN c, r, n

-- Entity mentions across assets
MATCH (c:Chunk {project_id: $project_id})-[:MENTIONS]->(e:Entity {name: $name})
RETURN c, e

-- Path between two entities
MATCH path = shortestPath(
  (e1:Entity {id: $id1})-[*..6]-(e2:Entity {id: $id2})
)
RETURN path
```

## Files

```
app/
  services/
    neo4j.py           Neo4j driver wrapper, session management
    graph_builder.py   create nodes, build edges
    traversal.py       GraphRAG BFS traversal, SSE streaming
  routers/
    graph.py           GET /projects/{id}/graph (full graph for frontend)
                       GET /conversation/{id}/stream (SSE)
```
