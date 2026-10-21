/*
# CarbonProof — evidence records and audit history

1. New Tables

- `evidence_records`
  - `id` (uuid, primary key) — stable record identifier shown to users
  - `project_name` (text, not null) — name of the climate project
  - `org_id` (text, not null) — project or organisation identifier
  - `claim_category` (text, not null) — one of: reforestation, renewable_energy, methane_reduction, energy_efficiency, other
  - `country` (text, not null) — country of the project
  - `location_description` (text, not null) — free-text location description
  - `reporting_period_start` (date, not null) — start of reporting period
  - `reporting_period_end` (date, not null) — end of reporting period
  - `claimed_quantity` (numeric, not null) — claimed emissions reduction/removal
  - `unit` (text, not null, default 'tCO2e') — unit of the claimed quantity
  - `evidence_reference` (text, not null) — URL or reference to supporting evidence
  - `evidence_description` (text, not null) — description of the supporting evidence
  - `fingerprint` (text, not null, unique) — SHA-256 fingerprint of canonical evidence
  - `status` (text, not null, default 'submitted') — draft | submitted | flagged_for_review | ready_for_human_review
  - `is_sample` (boolean, not null, default false) — marks records seeded as sample data
  - `created_at` (timestamptz, not null, default now())
  - `updated_at` (timestamptz, not null, default now())

- `audit_events`
  - `id` (uuid, primary key)
  - `record_id` (uuid, not null, references evidence_records(id) on delete cascade)
  - `event_type` (text, not null) — status_change | audit_finding | created
  - `rule_id` (text, nullable) — identifier of the audit rule that produced a finding
  - `severity` (text, nullable) — info | warning | error
  - `description` (text, not null) — human-readable description of the event
  - `field` (text, nullable) — field or evidence reference involved
  - `suggestion` (text, nullable) — suggested next action
  - `created_at` (timestamptz, not null, default now())

2. Indexes

- Unique index on `evidence_records.fingerprint` to enforce uniqueness at the DB level.
- Index on `evidence_records.created_at` for recent-submissions ordering.
- Index on `audit_events.record_id` and `audit_events.created_at` for history queries.

3. Security

- This is a single-tenant prototype with NO sign-in screen. The frontend uses the anon key.
- RLS enabled on both tables.
- CRUD policies scoped to `anon, authenticated` because data is intentionally shared/local.
- `USING (true)` is documented as intentional for this public local-prototype dataset.

4. Notes

- Fingerprint uniqueness is enforced both in application logic and by a unique DB index.
- Audit history is append-only by convention (application never deletes or overwrites events).
*/

CREATE TABLE IF NOT EXISTS evidence_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_name text NOT NULL,
  org_id text NOT NULL,
  claim_category text NOT NULL CHECK (claim_category IN ('reforestation','renewable_energy','methane_reduction','energy_efficiency','other')),
  country text NOT NULL,
  location_description text NOT NULL,
  reporting_period_start date NOT NULL,
  reporting_period_end date NOT NULL,
  claimed_quantity numeric NOT NULL,
  unit text NOT NULL DEFAULT 'tCO2e',
  evidence_reference text NOT NULL,
  evidence_description text NOT NULL,
  fingerprint text NOT NULL,
  status text NOT NULL DEFAULT 'submitted' CHECK (status IN ('draft','submitted','flagged_for_review','ready_for_human_review')),
  is_sample boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS evidence_records_fingerprint_unique_idx
  ON evidence_records (fingerprint);

CREATE INDEX IF NOT EXISTS evidence_records_created_at_idx
  ON evidence_records (created_at DESC);

CREATE TABLE IF NOT EXISTS audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id uuid NOT NULL REFERENCES evidence_records(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('created','status_change','audit_finding')),
  rule_id text,
  severity text CHECK (severity IN ('info','warning','error')),
  description text NOT NULL,
  field text,
  suggestion text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_events_record_id_idx
  ON audit_events (record_id);

CREATE INDEX IF NOT EXISTS audit_events_created_at_idx
  ON audit_events (created_at DESC);

ALTER TABLE evidence_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_evidence_records" ON evidence_records;
CREATE POLICY "anon_select_evidence_records" ON evidence_records FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_evidence_records" ON evidence_records;
CREATE POLICY "anon_insert_evidence_records" ON evidence_records FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_evidence_records" ON evidence_records;
CREATE POLICY "anon_update_evidence_records" ON evidence_records FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_evidence_records" ON evidence_records;
CREATE POLICY "anon_delete_evidence_records" ON evidence_records FOR DELETE
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_select_audit_events" ON audit_events;
CREATE POLICY "anon_select_audit_events" ON audit_events FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_audit_events" ON audit_events;
CREATE POLICY "anon_insert_audit_events" ON audit_events FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_audit_events" ON audit_events;
CREATE POLICY "anon_update_audit_events" ON audit_events FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_audit_events" ON audit_events;
CREATE POLICY "anon_delete_audit_events" ON audit_events FOR DELETE
  TO anon, authenticated USING (true);
