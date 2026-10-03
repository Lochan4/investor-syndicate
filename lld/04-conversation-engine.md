# Conversation Engine — GraphRAG + Voice Input

## Overview

Each investor gets a private conversation session with the project's knowledge graph. They type or speak freely — asking whatever they want about the startup. The system walks the graph to answer, streaming the traversal visually. At the end (or at any point), the investor can also fill the structured form. Both inputs feed the group analysis.

## Conversation Session Model

```
One ConversationSession per (investor × project)
  id
  project_id
  user_id
  messages: [{role, content, traversal_summary, sources, created_at}]
  status: active | submitted
  created_at
```

Sessions are private — an investor cannot see another's conversation. Attendees see all sessions after collection closes.

## Input Modes

### Text Input (default)

```
POST /conversation/{session_id}/message
  body: {text: string}

  1. Save user message to session
  2. Open SSE stream (if client subscribed to /conversation/{session_id}/stream)
  3. Run GraphRAG traversal (see knowledge-graph.md Step 1-6)
     → stream node_visited events → stream answer tokens
  4. Save assistant message to session (with traversal_summary + sources)
  5. Return {message_id} (client was watching SSE)
```

### Voice Input

```
POST /conversation/{session_id}/voice
  body: multipart/form-data — audio file (webm/mp3/wav, max 25MB)

  1. Upload audio → S3 (temp key)
  2. Call Whisper API: openai.audio.transcriptions.create(file, model="whisper-1")
  3. transcript = response.text
  4. Continue exactly as text input (Step 1-6 above) with transcript as {text}
  5. Return {transcript, message_id}
     so frontend can show what was transcribed before the answer streams
```

Voice is recorded in the browser using `MediaRecorder API` and sent as a blob. No plugin needed.

## Conversation System Prompt

The system prompt is a versioned prompt in the Prompt Registry (`stage_key='conversation'`). Core directives:

```
You are a due diligence assistant for a venture syndicate.
You have access to structured information about {{startup_name}}.
Answer the investor's question using ONLY the provided context chunks.
If the context doesn't contain enough information, say so clearly.
Do not make up metrics, names, or facts.
Be concise and direct. Reference which part of the materials supports each claim.
```

## Conversation Capture for Group Analysis

The conversation is not just Q&A — it is also the investor's due diligence record. After an investor marks their session as submitted (or the admin closes collection), the group analysis stage reads all conversation sessions to extract each investor's stance, concerns, and conviction — the same way it previously read form responses.

```
Stage 3 Group Consensus now reads:
  - All conversation sessions (messages + traversal context)
  - All form responses (if investor also filled the form)
  
  Combined input → Claude Opus → group analysis output
```

## Session Submission

An investor submits their session (equivalent to "submitting the form") by:
- Explicitly clicking "Submit my review"
- OR: admin manually closes collection

On submit:
```
POST /conversation/{session_id}/submit
  - SET session.status = 'submitted'
  - maybe_close_collection(project_id)
    (same logic as form: if all invited investors submitted → close)
```

## Collection Close Logic

```
after each session submit:
  invited  = COUNT project_members WHERE role='reviewer'
  submitted = COUNT conversation_sessions
                WHERE project_id=$1 AND status='submitted'
  if submitted >= invited:
    UPDATE projects SET status='consensus', collection_closed_at=now()
    enqueue run_group_consensus(project_id)
    notify all members: collection_closed
```

## Voice Recording — Browser Side

```typescript
// MediaRecorder setup (client component)
const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
const chunks: Blob[] = [];

recorder.ondataavailable = e => chunks.push(e.data);
recorder.onstop = async () => {
  const blob = new Blob(chunks, { type: 'audio/webm' });
  const form = new FormData();
  form.append('audio', blob, 'recording.webm');
  const res = await fetch(`/api/v1/conversation/${sessionId}/voice`, {
    method: 'POST', body: form, headers: { Authorization: `Bearer ${token}` }
  });
  const { transcript } = await res.json();
  // Show transcript, then watch SSE for answer
};

recorder.start();
// ... user speaks ...
recorder.stop();
```

## SSE Connection

> **Note:** the frontend does NOT render traversal events. `node_visited` events are produced by the backend for internal context building only. The frontend only processes `answer_token` and `answer_done`. The "thinking" state is a simple typing indicator (···).

```typescript
// Frontend subscribes BEFORE sending message
const es = new EventSource(`/api/v1/conversation/${sessionId}/stream`);

// node_visited events are NOT consumed by the frontend — backend only

es.addEventListener('answer_token', e => {
  const { token } = JSON.parse(e.data);
  answerPanel.appendToken(token);
});

es.addEventListener('answer_done', e => {
  const { sources } = JSON.parse(e.data);
  answerPanel.showSourcePills(sources);  // render source pill badges
  es.close();
});
```

## Redis Cell Context Store

Every completed turn in a cell conversation is written to Redis alongside Postgres.

### Keys

```
cell_ctx:{project_id}:{cell_id}:{user_id}
  Type: Redis List (RPUSH per turn)
  TTL:  30 days
  Each entry (JSON):
    { role: 'user'|'assistant', text: str, timestamp: ISO8601, sources: [asset_id] }

cell_analysis:{project_id}:{cell_id}
  Type: Redis String (JSON)
  TTL:  no expiry (cleared on project delete)
  Value:
    {
      synthesis:          str,   // 2-3 para summary of all investor conversations
      top_concerns:       [str],
      top_positives:      [str],
      investor_count:     int,
      generated_at:       ISO8601
    }
```

### When cell_analysis is built

`build_cell_views` worker runs after admin clicks "Analyse Cell". It:
1. Reads all `cell_ctx:{project_id}:{cell_id}:*` keys (all investors)
2. Synthesises with Claude Sonnet
3. Writes result to `cell_analysis:{project_id}:{cell_id}`
4. Updates `flow_cells.output_cache` in Postgres (same data, for persistence)

### How downstream cells use it

When a user asks a question in Cell B (which has Cell A as upstream):

```python
upstream_context = redis.get(f"cell_analysis:{project_id}:{cell_a_id}")

# Injected into the RAG prompt as additional context block:
# [UPSTREAM: Team Analysis]
# {upstream_context.synthesis}
# Key concerns: {upstream_context.top_concerns}
```

This happens in `services/cell_traversal.py` before the GraphRAG query runs.
The upstream context is prepended to the LLM's system prompt, not retrieved — it is always injected regardless of the question asked.

## Files

```
app/
  routers/
    conversation.py      POST message, POST voice, POST submit,
                         GET session, GET /stream (SSE)
  services/
    conversation.py      session CRUD, maybe_close_collection
    stt.py               Whisper API call
    traversal.py         GraphRAG (shared with graph.py)
    cell_context.py      Redis cell_ctx write, cell_analysis read/write
```
