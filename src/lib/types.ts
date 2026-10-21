export type ClaimCategory =
  | 'reforestation'
  | 'renewable_energy'
  | 'methane_reduction'
  | 'energy_efficiency'
  | 'other';

export type RecordStatus =
  | 'draft'
  | 'submitted'
  | 'flagged_for_review'
  | 'ready_for_human_review';

export type Severity = 'info' | 'warning' | 'error';

export type AuditEventType = 'created' | 'status_change' | 'audit_finding' | 'ai_audit' | 'blockchain_registration';

export const CLAIM_CATEGORIES: { value: ClaimCategory; label: string }[] = [
  { value: 'reforestation', label: 'Reforestation' },
  { value: 'renewable_energy', label: 'Renewable Energy' },
  { value: 'methane_reduction', label: 'Methane Reduction' },
  { value: 'energy_efficiency', label: 'Energy Efficiency' },
  { value: 'other', label: 'Other' },
];

export const STATUS_LABELS: Record<RecordStatus, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  flagged_for_review: 'Flagged for Review',
  ready_for_human_review: 'Ready for Human Review',
};

export interface EvidenceRecord {
  id: string;
  project_name: string;
  org_id: string;
  claim_category: ClaimCategory;
  country: string;
  location_description: string;
  reporting_period_start: string;
  reporting_period_end: string;
  claimed_quantity: number;
  unit: string;
  evidence_reference: string;
  evidence_description: string;
  fingerprint: string;
  status: RecordStatus;
  is_sample: boolean;
  created_at: string;
  updated_at: string;
}

export interface AuditFinding {
  rule_id: string;
  severity: Severity;
  description: string;
  field: string | null;
  suggestion: string;
}

export interface AuditEvent {
  id: string;
  record_id: string;
  event_type: AuditEventType;
  rule_id: string | null;
  severity: Severity | null;
  description: string;
  field: string | null;
  suggestion: string | null;
  created_at: string;
}

export interface EvidenceSubmissionInput {
  project_name: string;
  org_id: string;
  claim_category: ClaimCategory;
  country: string;
  location_description: string;
  reporting_period_start: string;
  reporting_period_end: string;
  claimed_quantity: number;
  unit: string;
  evidence_reference: string;
  evidence_description: string;
}

export interface FieldError {
  field: keyof EvidenceSubmissionInput;
  message: string;
}

export interface AIAuditResultRow {
  id: string;
  record_id: string;
  summary: string;
  extracted_claim: string;
  evidence_sufficiency: 'insufficient' | 'limited' | 'potentially_adequate';
  findings_json: unknown;
  missing_information: unknown;
  reviewer_questions: unknown;
  limitations: unknown;
  provider: string;
  model: string;
  status: 'completed' | 'failed' | 'unavailable';
  error_message: string | null;
  created_at: string;
}

export interface BlockchainRegistrationRow {
  id: string;
  record_id: string;
  evidence_fingerprint: string;
  record_id_hash: string;
  transaction_hash: string;
  block_number: number;
  registrar_address: string;
  contract_address: string;
  network: string;
  local_persist_error: string | null;
  created_at: string;
}
