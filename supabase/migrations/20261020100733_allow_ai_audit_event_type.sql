/*
# Allow ai_audit event type in audit_events

1. Modified Tables
- `audit_events`: drop and recreate the event_type CHECK constraint to include 'ai_audit'.
  This lets the app log AI audit completion/failure events alongside deterministic ones.

2. Security
- No policy changes. Existing RLS policies remain in place.

3. Notes
- This is additive only — no data is lost. The new constraint accepts all previous values plus 'ai_audit'.
*/

ALTER TABLE audit_events DROP CONSTRAINT IF EXISTS audit_events_event_type_check;

ALTER TABLE audit_events ADD CONSTRAINT audit_events_event_type_check
  CHECK (event_type IN ('created','status_change','audit_finding','ai_audit'));
