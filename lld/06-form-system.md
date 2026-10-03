# Form System & Conversational Editing

## Form Lifecycle

```
Stage 2 complete
      │
      ▼  forms(kind='review', status='draft')
      │
      │  Attendee opens form preview
      │  ┌────────────────────────────────────────┐
      │  │  Form Preview (read-only render)        │
      │  │  ────────────────────────────────────   │
      │  │  [Field 1] Overall score  1-10          │
      │  │  [Field 2] Would you invest?            │
      │  │  [Field 3] Conviction  1-5              │
      │  │  [Field 4] Biggest risk                 │
      │  │  [Field 5] AI-generated question...     │
      │  │  ...                                    │
      │  │                                         │
      │  │  ─── Chat panel ───────────────────     │
      │  │  > "Remove question 5, it's too vague"  │
      │  │  < "Removed. Updated form:"  [diff]     │
      │  │  > "Add a question about unit econ"     │
      │  │  < "Added. Updated form:"  [diff]       │
      │  │                                         │
      │  │  [Approve Form]                         │
      │  └────────────────────────────────────────┘
      │
      │  POST /projects/{id}/form/approve
      │  forms.status = 'open'
      │  notify all reviewers (added_to_group → form_open)
      ▼
  collecting
      │
      │  Each reviewer:
      │  GET  /projects/{id}/form      ← schema + own answers
      │  POST /forms/{id}/responses    ← submit / update answers
      │
      │  After each submit:
      │  maybe_close_collection()
      │    submitted_count == invited_count → close form
      │                                     → status='consensus'
      │                                     → enqueue Stage 3
      ▼
  [all submitted]
```

## Fixed Core Fields (always present, never removable)

```
id              type          label                  constraints
──────────────────────────────────────────────────────────────────
overall_score   rating        Overall score          1–10
invest_stance   single_choice Would you invest?      Yes/No/Maybe
conviction      rating        Conviction level       1–5
biggest_risk    long_text     What is the biggest risk?
```

## Conversational Edit — Request/Response Contract

```
POST /projects/{id}/form/chat
Request:
  {
    message:        string,
    current_schema: FormSchema,
    history:        [{role, content}]   ← client manages history
  }

Response:
  {
    reply:           string,            ← LLM's explanation
    updated_schema:  FormSchema | null  ← null if no change
  }

Schema is NOT saved server-side until Approve is clicked.
Chat history is ephemeral — client passes full history each turn.
```

## Conversational Edit — LLM Constraints (system prompt)

```
- Core fields (overall_score, invest_stance, conviction, biggest_risk)
  cannot be removed, reordered, or retyped.
- Dynamic questions: reword, remove, change type, reorder freely.
- Max total fields: 12.
- New questions: allowed, must specify type.
- Response MUST be JSON: {reply: str, updated_schema: FormSchema | null}
```

## Form Schema Structure

```typescript
type FieldType = 'text' | 'long_text' | 'rating' | 'single_choice' | 'multi_choice';

interface FormField {
  id:       string;       // stable slug e.g. 'market_size'
  type:     FieldType;
  label:    string;
  required: boolean;
  options?: string[];     // single_choice / multi_choice only
  min?:     number;       // rating only
  max?:     number;       // rating only
}

interface FormSchema {
  version: number;
  fields:  FormField[];   // first 4 = fixed core
}
```

## Response Validation

```
For each field in schema:
  required + missing value  → 422
  rating out of range       → 422
  single/multi_choice with  → 422
    invalid option value

Validated in FastAPI before INSERT.
```

## Collection Close Logic

```
After every POST /forms/{id}/responses:
  invited  = COUNT project_members WHERE role='reviewer'
  submitted = COUNT responses WHERE form_id=$1
  if submitted >= invited:
    forms.status      = 'closed'
    projects.status   = 'consensus'
    projects.collection_closed_at = now()
    enqueue run_group_consensus(form_id)
    notify all members: collection_closed
```

## Files

```
app/
  routers/
    forms.py           GET form, POST chat, POST approve,
                       POST responses, POST rebuttal-responses
  services/
    forms.py           maybe_close_collection(), validate_answers()
    form_chat.py       LLM conversational edit call
  workers/
    notifications.py   send_notification_email job
```
