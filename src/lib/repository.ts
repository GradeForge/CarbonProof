import { supabase } from './supabaseClient';
import { auditSubmission, auditExistingRecord } from './audit';
import { computeFingerprint } from './fingerprint';
import type {
  AuditEvent,
  AuditFinding,
  EvidenceRecord,
  EvidenceSubmissionInput,
} from './types';

function toInsertable(input: EvidenceSubmissionInput) {
  return {
    project_name: input.project_name,
    org_id: input.org_id,
    claim_category: input.claim_category,
    country: input.country,
    location_description: input.location_description,
    reporting_period_start: input.reporting_period_start,
    reporting_period_end: input.reporting_period_end,
    claimed_quantity: input.claimed_quantity,
    unit: input.unit,
    evidence_reference: input.evidence_reference,
    evidence_description: input.evidence_description,
  };
}

export interface CreateResult {
  record: EvidenceRecord;
  events: AuditEvent[];
}

export interface DuplicateResult {
  duplicate: true;
  existingRecord: EvidenceRecord;
}

export async function findByFingerprint(
  fingerprint: string
): Promise<EvidenceRecord | null> {
  const { data, error } = await supabase
    .from('evidence_records')
    .select('*')
    .eq('fingerprint', fingerprint)
    .maybeSingle();
  if (error) throw error;
  return (data as EvidenceRecord) ?? null;
}

export async function createRecord(
  input: EvidenceSubmissionInput,
  isSample = false
): Promise<CreateResult | DuplicateResult> {
  const fingerprint = await computeFingerprint(input);
  const existing = await findByFingerprint(fingerprint);
  const audit = auditSubmission(input, !!existing, existing ?? undefined);

  if (existing) {
    return { duplicate: true, existingRecord: existing };
  }

  const { data, error } = await supabase
    .from('evidence_records')
    .insert({
      ...toInsertable(input),
      fingerprint,
      status: audit.status,
      is_sample: isSample,
    })
    .select('*')
    .single();
  if (error) throw error;
  const record = data as EvidenceRecord;

  const events = await persistAudit(record, audit.findings, 'created');
  return { record, events };
}

async function persistAudit(
  record: EvidenceRecord,
  findings: AuditFinding[],
  initialEventType: 'created' | 'audit_finding'
): Promise<AuditEvent[]> {
  const rows: {
    record_id: string;
    event_type: 'created' | 'status_change' | 'audit_finding';
    rule_id: string | null;
    severity: AuditFinding['severity'] | null;
    description: string;
    field: string | null;
    suggestion: string | null;
  }[] = [];

  rows.push({
    record_id: record.id,
    event_type: 'status_change',
    rule_id: null,
    severity: 'info',
    description: `Record created with status "${record.status}".`,
    field: null,
    suggestion: null,
  });

  for (const finding of findings) {
    rows.push({
      record_id: record.id,
      event_type: 'audit_finding',
      rule_id: finding.rule_id,
      severity: finding.severity,
      description: finding.description,
      field: finding.field,
      suggestion: finding.suggestion,
    });
  }

  if (findings.length === 0 && initialEventType === 'created') {
    rows.push({
      record_id: record.id,
      event_type: 'audit_finding',
      rule_id: 'NO_AUTOMATIC_ISSUES',
      severity: 'info',
      description:
        'Automated audit completed. No issues were identified by the implemented checks.',
      field: null,
      suggestion:
        'A clean automated audit does not mean the claim is verified. Human review is still required.',
    });
  }

  const { data, error } = await supabase
    .from('audit_events')
    .insert(rows)
    .select('*');
  if (error) throw error;
  return (data as AuditEvent[]) ?? [];
}

export async function getRecord(id: string): Promise<EvidenceRecord | null> {
  const { data, error } = await supabase
    .from('evidence_records')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return (data as EvidenceRecord) ?? null;
}

export async function getAuditEvents(recordId: string): Promise<AuditEvent[]> {
  const { data, error } = await supabase
    .from('audit_events')
    .select('*')
    .eq('record_id', recordId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data as AuditEvent[]) ?? [];
}

export async function listRecords(): Promise<EvidenceRecord[]> {
  const { data, error } = await supabase
    .from('evidence_records')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as EvidenceRecord[]) ?? [];
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HEX64_RE = /^0x[0-9a-f]{64}$/i;
const FINGERPRINT_RE = /^[0-9a-f]{64}$/i;

/**
 * Search evidence records by UUID, SHA-256 fingerprint, or on-chain record ID hash.
 *
 * Input is validated before any database filter is constructed so that
 * non-UUID strings never reach the `id.eq` filter (which would cause a
 * PostgreSQL uuid cast error).
 *
 * - UUID: queries evidence_records.id directly
 * - SHA-256 fingerprint (64 hex chars, no 0x): queries evidence_records.fingerprint
 * - On-chain record ID hash (0x + 64 hex chars): queries blockchain_registrations.record_id_hash,
 *   then follows the record_id foreign key to return the associated evidence record
 */
export async function searchRecords(
  query: string
): Promise<EvidenceRecord[]> {
  const q = query.trim();
  if (!q) return [];

  if (UUID_RE.test(q)) {
    const { data, error } = await supabase
      .from('evidence_records')
      .select('*')
      .eq('id', q)
      .limit(5);
    if (error) throw new Error(error.message);
    return (data as EvidenceRecord[]) ?? [];
  }

  if (FINGERPRINT_RE.test(q)) {
    const { data, error } = await supabase
      .from('evidence_records')
      .select('*')
      .eq('fingerprint', q.toLowerCase())
      .limit(5);
    if (error) throw new Error(error.message);
    return (data as EvidenceRecord[]) ?? [];
  }

  if (HEX64_RE.test(q)) {
    const normalized = q.toLowerCase();
    const { data: regData, error: regError } = await supabase
      .from('blockchain_registrations')
      .select('record_id')
      .eq('record_id_hash', normalized)
      .limit(5);
    if (regError) throw new Error(regError.message);
    if (!regData || regData.length === 0) return [];

    const recordIds = (regData as { record_id: string }[]).map((r) => r.record_id);
    const { data, error } = await supabase
      .from('evidence_records')
      .select('*')
      .in('id', recordIds)
      .limit(5);
    if (error) throw new Error(error.message);
    return (data as EvidenceRecord[]) ?? [];
  }

  return [];
}

export async function reauditRecord(
  recordId: string
): Promise<{ record: EvidenceRecord; events: AuditEvent[] }> {
  const record = await getRecord(recordId);
  if (!record) throw new Error('Record not found');
  const audit = auditExistingRecord(record);

  const { data, error } = await supabase
    .from('evidence_records')
    .update({ status: audit.status, updated_at: new Date().toISOString() })
    .eq('id', recordId)
    .select('*')
    .single();
  if (error) throw error;
  const updated = data as EvidenceRecord;

  const statusRow = {
    record_id: recordId,
    event_type: 'status_change' as const,
    rule_id: null,
    severity: 'info' as const,
    description: `Re-audit run. Status set to "${updated.status}".`,
    field: null,
    suggestion: null,
  };
  const findingRows = audit.findings.map((f) => ({
    record_id: recordId,
    event_type: 'audit_finding' as const,
    rule_id: f.rule_id,
    severity: f.severity,
    description: f.description,
    field: f.field,
    suggestion: f.suggestion,
  }));
  const allRows =
    audit.findings.length === 0
      ? [
          statusRow,
          {
            record_id: recordId,
            event_type: 'audit_finding' as const,
            rule_id: 'NO_AUTOMATIC_ISSUES',
            severity: 'info' as const,
            description:
              'Automated re-audit completed. No issues were identified by the implemented checks.',
            field: null,
            suggestion:
              'A clean automated audit does not mean the claim is verified. Human review is still required.',
          },
        ]
      : [statusRow, ...findingRows];

  const { data: inserted, error: insertError } = await supabase
    .from('audit_events')
    .insert(allRows)
    .select('*');
  if (insertError) throw insertError;

  return { record: updated, events: (inserted as AuditEvent[]) ?? [] };
}

export async function deleteSampleRecords(): Promise<number> {
  const { data, error } = await supabase
    .from('evidence_records')
    .delete()
    .eq('is_sample', true)
    .select('id');
  if (error) throw error;
  return data?.length ?? 0;
}
