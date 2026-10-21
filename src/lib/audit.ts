import type {
  AuditFinding,
  EvidenceRecord,
  EvidenceSubmissionInput,
  RecordStatus,
} from './types';

export interface AuditResult {
  findings: AuditFinding[];
  status: RecordStatus;
}

function isBlank(value: string): boolean {
  return value == null || value.trim().length === 0;
}

function isValidISODate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + 'T00:00:00Z');
  return !Number.isNaN(date.getTime());
}

function looksLikeUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim());
}

export function auditSubmission(
  input: EvidenceSubmissionInput,
  isDuplicateFingerprint: boolean,
  existingRecord?: EvidenceRecord
): AuditResult {
  const findings: AuditFinding[] = [];

  if (isBlank(input.evidence_reference)) {
    findings.push({
      rule_id: 'MISSING_EVIDENCE_REF',
      severity: 'error',
      description: 'No evidence reference or URL was provided.',
      field: 'evidence_reference',
      suggestion:
        'Attach a publicly accessible URL or a verifiable reference to the supporting evidence.',
    });
  } else if (!looksLikeUrl(input.evidence_reference)) {
    findings.push({
      rule_id: 'MALFORMED_EVIDENCE_REF',
      severity: 'warning',
      description:
        'Evidence reference is not an http/https URL. Manual review is needed to confirm it is verifiable.',
      field: 'evidence_reference',
      suggestion:
        'Where possible, provide a direct URL so reviewers can inspect the source.',
    });
  }

  if (
    !isValidISODate(input.reporting_period_start) ||
    !isValidISODate(input.reporting_period_end)
  ) {
    findings.push({
      rule_id: 'INVALID_REPORTING_PERIOD',
      severity: 'error',
      description: 'Reporting period start or end is not a valid date.',
      field: 'reporting_period_start',
      suggestion: 'Correct the reporting period dates before submission.',
    });
  } else if (input.reporting_period_end < input.reporting_period_start) {
    findings.push({
      rule_id: 'REPORTING_PERIOD_ORDER',
      severity: 'error',
      description: 'Reporting period end date is before the start date.',
      field: 'reporting_period_end',
      suggestion: 'Set the end date on or after the start date.',
    });
  }

  if (
    typeof input.claimed_quantity !== 'number' ||
    Number.isNaN(input.claimed_quantity) ||
    input.claimed_quantity <= 0
  ) {
    findings.push({
      rule_id: 'INVALID_QUANTITY',
      severity: 'error',
      description: 'Claimed quantity is missing, zero, negative, or non-numeric.',
      field: 'claimed_quantity',
      suggestion: 'Enter a positive numeric quantity.',
    });
  } else if (input.claimed_quantity > 1_000_000_000) {
    findings.push({
      rule_id: 'IMPLAUSIBLE_QUANTITY',
      severity: 'warning',
      description:
        'Claimed quantity is implausibly large and likely a data-entry error.',
      field: 'claimed_quantity',
      suggestion: 'Confirm the unit and the magnitude of the claimed reduction.',
    });
  }

  if (isBlank(input.project_name) || isBlank(input.org_id)) {
    findings.push({
      rule_id: 'MISSING_PROJECT_METADATA',
      severity: 'error',
      description: 'Project name or organisation identifier is missing.',
      field: 'project_name',
      suggestion:
        'Complete the project name and organisation identifier fields.',
    });
  }

  if (isDuplicateFingerprint) {
    findings.push({
      rule_id: 'DUPLICATE_FINGERPRINT',
      severity: 'error',
      description:
        existingRecord
          ? `Canonical evidence matches existing record ${existingRecord.id}. This appears to be a duplicate registration of the same evidence.`
          : 'Canonical evidence matches an existing record. This appears to be a duplicate registration.',
      field: 'fingerprint',
      suggestion:
        'Do not register the same evidence twice. If this is a correction, update the existing record instead.',
    });
  }

  if (isBlank(input.country) || isBlank(input.location_description)) {
    findings.push({
      rule_id: 'INCOMPLETE_LOCATION',
      severity: 'warning',
      description: 'Country or location description is missing.',
      field: 'location_description',
      suggestion: 'Add country and a clear location description for traceability.',
    });
  }

  if (isBlank(input.evidence_description)) {
    findings.push({
      rule_id: 'MISSING_EVIDENCE_DESCRIPTION',
      severity: 'warning',
      description: 'No supporting evidence description was provided.',
      field: 'evidence_description',
      suggestion:
        'Describe what the evidence contains and how it supports the claimed quantity.',
    });
  }

  return { findings, status: deriveStatus(findings) };
}

export function deriveStatus(findings: AuditFinding[]): RecordStatus {
  const hasError = findings.some((f) => f.severity === 'error');
  const hasWarning = findings.some((f) => f.severity === 'warning');
  if (hasError) return 'flagged_for_review';
  if (hasWarning) return 'ready_for_human_review';
  return 'submitted';
}

export function auditExistingRecord(record: EvidenceRecord): AuditResult {
  return auditSubmission(
    {
      project_name: record.project_name,
      org_id: record.org_id,
      claim_category: record.claim_category,
      country: record.country,
      location_description: record.location_description,
      reporting_period_start: record.reporting_period_start,
      reporting_period_end: record.reporting_period_end,
      claimed_quantity: record.claimed_quantity,
      unit: record.unit,
      evidence_reference: record.evidence_reference,
      evidence_description: record.evidence_description,
    },
    false
  );
}
