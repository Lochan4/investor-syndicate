# AI Pipeline — 5 Stages

## Pipeline Flow

```
project.status = 'analysing'
        │
        ▼
┌───────────────────────────────────────────────────────────────┐
│  STAGE 1 — Pitch Analysis                                     │
│  model: claude-opus-4-6                                       │
│  input:  deck text + transcript text                          │
│  output: {problem, market, team, traction, risks,             │
│           open_questions, raw_summary}                        │
│  stores: analyses(stage='pitch')                              │
│  trigger: transcript linked                                   │
└──────────────────────────┬────────────────────────────────────┘
                           │  status → 'form_review'
                           ▼
┌───────────────────────────────────────────────────────────────┐
│  STAGE 2 — Form Generator                                     │
│  model: claude-sonnet-4-6                                     │
│  input:  Stage 1 output + attendee takes (if any)             │
│  output: FormSchema JSON                                      │
│           fixed core (4 fields, always)                       │
│           + 5-8 pitch-specific questions                      │
│  stores: forms(kind='review', status='draft')                 │
│  fallback: core-only form after 2 failed validations          │
└──────────────────────────┬────────────────────────────────────┘
                           │  attendee approves form
                           │  status → 'collecting'
                           │
                           │  [reviewers fill form]
                           │  [all submitted → form.status='closed']
                           │
                           ▼
┌───────────────────────────────────────────────────────────────┐
│  STAGE 3 — Group Consensus                                    │
│  model: claude-opus-4-6                                       │
│  input:  all responses.answers + Stage 1 output               │
│  output: {aggregate_score, invest_distribution,               │
│           agreement_points, disagreement_points,              │
│           top_risks, open_questions_raised}                   │
│  stores: analyses(stage='group')                              │
│  trigger: forms.status transitions to 'closed'                │
└──────────────────────────┬────────────────────────────────────┘
                           │  status → 'rebuttals'
                           ▼
┌───────────────────────────────────────────────────────────────┐
│  STAGE 4 — Rebuttal Form Generator                            │
│  model: claude-sonnet-4-6                                     │
│  input:  Stage 3 output + attendee takes + Stage 1 output     │
│  output: rebuttal FormSchema JSON                             │
│           1 question per disagreement / top risk /            │
│           contradiction with attendee take                    │
│  stores: forms(kind='rebuttal', status='open')                │
│  trigger: Stage 3 complete                                    │
└──────────────────────────┬────────────────────────────────────┘
                           │  [attendees fill rebuttal form]
                           │  [all submitted OR attendee clicks Finalize]
                           ▼
┌───────────────────────────────────────────────────────────────┐
│  STAGE 5 — Final Consensus                                    │
│  model: claude-opus-4-6                                       │
│  input:  Stage 3 output + all rebuttal answers                │
│  output: {addressed_points, final_summary, what_moved}        │
│  stores: analyses(stage='final')                              │
│  trigger: all rebuttal forms in OR POST /finalize             │
└──────────────────────────┬────────────────────────────────────┘
                           │  status → 'final'
                           ▼
                    visible to all members
```

## Prompt Registry

```
prompts table (one row per stage):
  stage_key: pitch | form_gen | group_consensus
             rebuttal_gen | final_consensus | form_editor

prompt_versions table:
  status: draft | live | archived
  UNIQUE INDEX on (prompt_id) WHERE status = 'live'

Flow: draft → test (side-by-side with live) → publish → archived (old live)
      rollback: re-publish previous archived version
```

## LLM Call Wrapper

```
run_stage(stage_key, inputs, project_id)
  │
  ├── fetch live prompt_version for stage_key
  ├── render template with inputs
  ├── call Claude API
  ├── parse + validate against output_schema (Pydantic)
  │     └── on failure: retry once with error appended
  │           └── on second failure: fallback or flag
  ├── INSERT analyses row (content=output, prompt_version_id)
  ├── INSERT llm_runs row (tokens, cost, latency)
  └── return output
```

## Retry & Fallback Policy

```
Scenario                    Action
──────────────────────────────────────────────────────────────
Validation fail (attempt 1) Retry with error message appended
Validation fail (attempt 2) Stage 2/4: fall back to core form
                            Stage 1/3/5: store raw, flag failed
Model timeout (>120s)       Exponential backoff × 3, then fail
Rate limit (429)            Defer 60s, retry up to 5×
Job hard fail               Mark project status='failed',
                            INSERT audit_log, notify admin
```

## Attendee Takes as Enrichment (not a gate)

```
Takes submitted BEFORE Stage 2 runs → included in form_gen prompt
Takes submitted AFTER  Stage 2 runs → NOT re-run, takes visible
                                       to reviewers alongside deck

Stage 1 does NOT re-run when takes arrive.
Takes feed Stage 2, Stage 4, Stage 5 only.
```

## Files

```
app/
  services/
    llm.py             run_stage(), parse_and_validate()
    prompt_registry.py fetch live version, render template
  workers/
    pipeline.py        run_pitch_analysis, run_form_generator,
                       run_group_consensus, run_rebuttal_form_generator,
                       run_final_consensus
  routers/
    prompts.py         developer CRUD + test + publish endpoints
    analyses.py        GET analyses, POST finalize, SSE events
```
