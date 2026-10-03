# Asset Upload & Processing Pipeline

## Overview

An admin or attendee uploads any file related to the startup. Every uploaded file is an "asset." Assets are the raw material that builds the knowledge graph. There is no restriction on file type — the pipeline detects the type and routes it to the appropriate extractor.

## Supported Asset Types

| Kind | Extensions | Extractor | Output |
| --- | --- | --- | --- |
| Document | .pdf | pdfplumber | text chunks per page |
| Presentation | .pptx, .ppt | python-pptx | text chunks per slide |
| Audio | .mp3, .m4a, .wav, .ogg | Whisper API | transcript → text chunks |
| Image | .jpg, .jpeg, .png, .webp | Claude Vision API | description + OCR text |
| Spreadsheet | .xlsx, .csv | pandas | structured rows → text representation |
| Text | .txt, .md | direct | text chunks |
| Video | .mp4, .mov | ffmpeg → audio → Whisper | transcript → text chunks |
| Competitive Intel | auto-generated | Tavily + Claude | competitor summaries → text chunks (see `13-competitive-scan.md`) |

## Upload Flow

```
Admin/Attendee
    │
    │  POST /projects/{id}/assets/upload-url
    │  ← returns presigned S3 PUT URL
    │
    │  PUT file directly to S3 (browser → S3, no FastAPI proxy)
    │
    │  POST /projects/{id}/assets/confirm
    │  body: {storage_key, filename, kind, file_size}
    ▼
FastAPI
    │  INSERT assets row (status='pending')
    │  enqueue process_asset(asset_id)
    ▼
Arq Worker: process_asset
    │
    ├── detect type from MIME + extension
    │
    ├── download raw file from S3
    │
    ├── route to extractor:
    │     PDF/PPTX  → extract_text_chunks()
    │     MP3/audio → whisper_transcribe() → chunk_text()
    │     Image     → claude_vision_describe() → chunk_text()
    │     Excel/CSV → pandas_to_text() → chunk_text()
    │     Text      → chunk_text()
    │     Video     → ffmpeg_extract_audio() → whisper_transcribe() → chunk_text()
    │
    ├── for each chunk:
    │     generate embedding (text-embedding-3-large)
    │     INSERT pg chunks table (for audit/search)
    │     CREATE Neo4j Chunk node
    │
    ├── UPDATE assets SET status='ready', chunk_count=N
    │
    └── enqueue build_graph_edges(asset_id)
              │
              ├── CREATE sequential edges (Chunk)-[:NEXT]->(Chunk)
              ├── CREATE similarity edges  cosine_sim > 0.82
              │     (computed pairwise within the same asset, then cross-asset)
              ├── extract entities (NER via Claude) → CREATE Entity nodes
              └── CREATE MENTIONS edges (Chunk)-[:MENTIONS]->(Entity)
                  CREATE RELATED_TO edges between co-mentioned entities
```

## Chunking Strategy

```python
# app/services/chunker.py
def chunk_text(text: str, asset_id: str, metadata: dict) -> list[Chunk]:
    # Sliding window: 512 tokens, 64 token overlap
    # Preserves paragraph boundaries where possible
    # Each chunk stores: text, chunk_index, page_number (if PDF),
    #   timestamp_start (if audio), source_metadata
```

```
Chunk size:  512 tokens
Overlap:     64 tokens  (context continuity)
Min chunk:   50 tokens  (discard smaller)
Max chunks:  no hard limit
```

## Asset Status States

```
pending   → file uploaded to S3, job enqueued
processing → extractor running
embedding  → chunks being embedded + pushed to Neo4j
ready      → all chunks in graph, edges built
failed     → extractor or embedding failed
```

## Project Graph Readiness

```
Project status = 'building_graph' while ANY asset is in (pending, processing, embedding)
Project status = 'open' when ALL assets are status='ready'
                         AND at least 1 investor has been added
```

When ALL assets become `ready` AND project transitions to `open`:
- enqueue `run_competitive_scan(project_id)` (see `13-competitive-scan.md`)
- This produces a `competitive_intel` asset automatically; no admin action needed

If a new asset is uploaded while project is 'open':
- Process it in background
- Do NOT change project status to building_graph
- New chunks are added to graph; existing conversations are not re-run

## Entity Extraction (NER)

Run a single Claude Sonnet call per asset after all chunks are processed:
```
Prompt: "Extract all named entities from this text.
         Return JSON: {people: [], companies: [], locations: [],
                       metrics: [], concepts: [], products: []}"
Input: full asset text (truncated to 32K tokens if needed)
```

Each entity → Neo4j Entity node.
Each mention in a chunk → `(Chunk)-[:MENTIONS]->(Entity)` edge.
If same entity appears in multiple assets → single Entity node, multiple MENTIONS edges.

## Files

```
app/
  routers/
    assets.py              upload-url, confirm, list, delete
  workers/
    process_asset.py       process_asset job
    build_graph.py         build_graph_edges job
  services/
    extractors/
      pdf.py               pdfplumber extraction
      audio.py             Whisper API call
      image.py             Claude Vision API call
      spreadsheet.py       pandas structured → text
    chunker.py             sliding window chunker
    embeddings.py          text-embedding-3-large calls
    ner.py                 entity extraction via Claude
    neo4j.py               Neo4j driver wrapper
```
