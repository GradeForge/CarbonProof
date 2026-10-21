/*
# CarbonProof — blockchain registration metadata + blockchain audit event type

1. New Tables
- `blockchain_registrations`
  - `id` (uuid, primary key)
  - `record_id` (uuid, not null, references evidence_records(id) on delete cascade) — the local record this registration refers to
  - `evidence_fingerprint` (text, not null) — the SHA-256 fingerprint that was registered on-chain
  - `record_id_hash` (text, not null) — the keccak256 hash of the record ID that was submitted to the contract
  - `transaction_hash` (text, not null) — the actual Sepolia transaction hash returned by the wallet
  - `block_number` (integer, not null) — the block number from the transaction receipt
  - `registrar_address` (text, not null) — the wallet address that signed the transaction
  - `contract_address` (text, not null) — the contract address the transaction was sent to
  - `network` (text, not null, default 'sepolia') — the blockchain network
  - `local_persist_error` (text, nullable) — if local persistence failed after on-chain success, the error message
  - `created_at` (timestamptz, not null, default now())

2. Indexes
- Index on `blockchain_registrations.record_id` for per-record lookups.
- Index on `blockchain_registrations.evidence_fingerprint` for fingerprint-based queries.
- Index on `blockchain_registrations.transaction_hash` for transaction lookups.

3. Modified Tables
- `audit_events`: drop and recreate the event_type CHECK constraint to include 'blockchain_registration'.

4. Security
- Single-tenant prototype, NO sign-in screen. RLS enabled on `blockchain_registrations`.
- CRUD policies scoped to `anon, authenticated` — consistent with existing tables.
- No private keys or wallet secrets are stored. Only the public registrar address and transaction hash.

5. Notes
- A locally stored transaction hash is a LOCATOR, not proof of registration. The actual
  contract state (read via RPC) is the only authority. The UI always verifies on-chain.
- This table is additive — existing evidence records and audit history are preserved.
*/

CREATE TABLE IF NOT EXISTS blockchain_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id uuid NOT NULL REFERENCES evidence_records(id) ON DELETE CASCADE,
  evidence_fingerprint text NOT NULL,
  record_id_hash text NOT NULL,
  transaction_hash text NOT NULL,
  block_number integer NOT NULL,
  registrar_address text NOT NULL,
  contract_address text NOT NULL,
  network text NOT NULL DEFAULT 'sepolia',
  local_persist_error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS blockchain_registrations_record_id_idx
  ON blockchain_registrations (record_id);

CREATE INDEX IF NOT EXISTS blockchain_registrations_fingerprint_idx
  ON blockchain_registrations (evidence_fingerprint);

CREATE INDEX IF NOT EXISTS blockchain_registrations_tx_hash_idx
  ON blockchain_registrations (transaction_hash);

ALTER TABLE blockchain_registrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_blockchain_registrations" ON blockchain_registrations;
CREATE POLICY "anon_select_blockchain_registrations" ON blockchain_registrations FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_blockchain_registrations" ON blockchain_registrations;
CREATE POLICY "anon_insert_blockchain_registrations" ON blockchain_registrations FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_blockchain_registrations" ON blockchain_registrations;
CREATE POLICY "anon_update_blockchain_registrations" ON blockchain_registrations FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_blockchain_registrations" ON blockchain_registrations;
CREATE POLICY "anon_delete_blockchain_registrations" ON blockchain_registrations FOR DELETE
  TO anon, authenticated USING (true);

-- Add blockchain_registration to the audit_events event_type CHECK constraint.
ALTER TABLE audit_events DROP CONSTRAINT IF EXISTS audit_events_event_type_check;

ALTER TABLE audit_events ADD CONSTRAINT audit_events_event_type_check
  CHECK (event_type IN ('created','status_change','audit_finding','ai_audit','blockchain_registration'));
