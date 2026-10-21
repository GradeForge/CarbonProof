/*
# CarbonProof — AI audit results storage

1. New Tables

- `ai_audit_results`
  - `id` (uuid, primary key)
  - `record_id` (uuid, not null, references evidence_records(id) on delete cascade) — the evidence record this AI audit assessed
  - `summary` (text, not null) — short AI-generated audit summary
  - `extracted_claim` (text, not null) — the environmental claim the AI extracted from the submission
  - `evidence_sufficiency` (text, not null) — one of: insufficient, limited, potentially_adequate
  - `findings_json` (jsonb, not null) — array of structured AI findings (rule_id, severity, explanation, evidence_basis, recommended_action)
  - `missing_information` (jsonb, not null) — array of strings describing missing information
  - `reviewer_questions` (jsonb, not null) — array of strings with questions for a human reviewer
  - `limitations` (jsonb, not null) — array of strings describing AI limitations and uncertainty
  - `provider` (text, not null) — name of the AI provider used (e.g. "openai")
  - `model` (text, not null) — model identifier used for the audit
  - `status` (text, not null) — one of: completed, failed, unavailable
  - `error_message` (text, nullable) — safe, non-sensitive error message if status is failed/unavailable
  - `created_at` (timestamptz, not null, default now())

2. Indexes

- Index on `ai_audit_results.record_id` for per-record lookups.
- Index on `ai_audit_results.created_at` for newest-first ordering.

3. Security

- Single-tenant prototype, NO sign-in screen. Frontend uses anon key.
- RLS enabled on `ai_audit_results`.
- CRUD policies scoped to `anon, authenticated` because data is intentionally shared/local.
- `USING (true)` is documented as intentional for this public local-prototype dataset.
- No secrets, API keys, or provider credentials are stored in this table. Only the provider name and model identifier are recorded for transparency.

4. Notes

- AI audit results are stored separately from the deterministic audit_events table so AI findings and deterministic findings remain visibly separate.
- A status of "completed" means the AI returned a structured response — it does NOT mean the claim is verified, certified, or fraud-free.
- The edge function inserts these rows server-side; the client reads them.
*/

CREATE TABLE IF NOT EXISTS ai_audit_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id uuid NOT NULL REFERENCES evidence_records(id) ON DELETE CASCADE,
  summary text NOT NULL,
  extracted_claim text NOT NULL,
  evidence_sufficiency text NOT NULL CHECK (evidence_sufficiency IN ('insufficient','limited','potentially_adequate')),
  findings_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  missing_information jsonb NOT NULL DEFAULT '[]'::jsonb,
  reviewer_questions jsonb NOT NULL DEFAULT '[]'::jsonb,
  limitations jsonb NOT NULL DEFAULT '[]'::jsonb,
  provider text NOT NULL,
  model text NOT NULL,
  status text NOT NULL CHECK (status IN ('completed','failed','unavailable')),
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_audit_results_record_id_idx
  ON ai_audit_results (record_id);

CREATE INDEX IF NOT EXISTS ai_audit_results_created_at_idx
  ON ai_audit_results (created_at DESC);

ALTER TABLE ai_audit_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_ai_audit_results" ON ai_audit_results;
CREATE POLICY "anon_select_ai_audit_results" ON ai_audit_results FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_ai_audit_results" ON ai_audit_results;
CREATE POLICY "anon_insert_ai_audit_results" ON ai_audit_results FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_ai_audit_results" ON ai_audit_results;
CREATE POLICY "anon_update_ai_audit_results" ON ai_audit_results FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_ai_audit_results" ON ai_audit_results;
CREATE POLICY "anon_delete_ai_audit_results" ON ai_audit_results FOR DELETE
  TO anon, authenticated USING (true);
