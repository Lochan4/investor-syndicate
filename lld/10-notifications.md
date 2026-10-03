# Notification System

## Flow

```
Any server event (form approved, response submitted, stage complete, etc.)
      │
      │  await notify(db, user_id, project_id, kind)
      ▼
┌────────────────────────────────────────────────┐
│  INSERT notifications row                      │
│  enqueue send_notification_email(notif_id)     │
└──────────────────────┬─────────────────────────┘
                       │
          ┌────────────┴────────────┐
          ▼                         ▼
   In-app bell                 Arq worker
   (SSE or poll)               send_notification_email
   GET /notifications              │
                                   │  fetch notification + user email
                                   │  render template
                                   │  POST Resend API
                                   ▼
                              User inbox
```

## Notification Kinds & Recipients

```
Kind                 Trigger                             Recipients
──────────────────────────────────────────────────────────────────────
added_to_group       attendee/admin adds reviewer        the added reviewer
form_open            attendee approves form              all reviewers
reminder             cron: 7 days after form_open,       reviewers who
                     no response yet                     haven't submitted
collection_closed    all forms submitted                 all project members
rebuttal_open        Stage 4 complete                   all attendees
final_ready          Stage 5 complete                   all project members
```

## notify() Helper

```python
async def notify(db, user_id: UUID, project_id: UUID, kind: str):
    row = await db.fetchrow(
        "INSERT INTO notifications (user_id, project_id, kind) "
        "VALUES ($1, $2, $3) RETURNING id",
        user_id, project_id, kind
    )
    await arq_pool.enqueue_job('send_notification_email', str(row['id']))
```

Called once per recipient. For events with multiple recipients, caller loops:
```python
for member in project_members:
    await notify(db, member['user_id'], project_id, 'collection_closed')
```

## Email Templates

```
Kind                Subject line                     Body summary
──────────────────────────────────────────────────────────────────────
added_to_group      Added to [startup] deal          Deck link + form ETA
form_open           Review form ready: [startup]     Direct link to form
reminder            Reminder: [startup] review       Form link + context
collection_closed   Reviews in for [startup]         "Analysis is running"
rebuttal_open       Rebuttal form ready: [startup]   Direct link
final_ready         Final analysis: [startup]        Direct link to final view
```

All emails are plain text + minimal HTML. No tracking pixels. Use Resend SDK:

```python
resend.Emails.send({
    "from":    "deals@yourplatform.com",
    "to":      user.email,
    "subject": subject,
    "html":    render_template(kind, context),
})
```

## In-App Bell

```
GET /notifications?unread=true
→ [{id, kind, project_id, startup_name, created_at}]

Badge count = unread notifications count
              (notifications WHERE read_at IS NULL)

POST /notifications/{id}/read  → sets read_at = now()
```

Frontend polls `/notifications?unread=true` every 30s while app is open.
No WebSocket needed at this scale.
# ponytail: polling every 30s, switch to SSE/WebSocket when real-time bell matters.

## Reminder Cron

Runs daily at 09:00 UTC. Finds reviewers on open forms older than 7 days with no submission.

```sql
SELECT pm.user_id, pm.project_id
FROM project_members pm
JOIN forms f ON f.project_id = pm.project_id
LEFT JOIN responses r ON r.form_id = f.id AND r.user_id = pm.user_id
WHERE pm.role = 'reviewer'
  AND f.status = 'open'
  AND f.approved_at < now() - interval '7 days'
  AND r.id IS NULL;
```

## Files

```
app/
  services/
    notifications.py   notify() helper
  workers/
    notifications.py   send_notification_email Arq job
  templates/
    emails/            one HTML file per notification kind
```
