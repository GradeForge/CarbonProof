import type {
  ClaimCategory,
  EvidenceSubmissionInput,
  FieldError,
} from './types';

const MAX_TEXT = 500;
const MAX_DESC = 2000;
const MAX_QUANTITY = 1_000_000_000;

const VALID_CATEGORIES: ClaimCategory[] = [
  'reforestation',
  'renewable_energy',
  'methane_reduction',
  'energy_efficiency',
  'other',
];

function isBlank(value: string): boolean {
  return value == null || value.trim().length === 0;
}

function isValidISODate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + 'T00:00:00Z');
  return !Number.isNaN(date.getTime());
}

function looksLikeUrlOrRef(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length === 0) return false;
  if (/^https?:\/\//i.test(trimmed)) return true;
  if (/^doi:\s*10\./i.test(trimmed)) return true;
  return trimmed.length >= 3;
}

export function validateSubmission(
  input: EvidenceSubmissionInput
): FieldError[] {
  const errors: FieldError[] = [];

  if (isBlank(input.project_name)) {
    errors.push({ field: 'project_name', message: 'Project name is required.' });
  } else if (input.project_name.length > MAX_TEXT) {
    errors.push({
      field: 'project_name',
      message: `Project name must be ${MAX_TEXT} characters or fewer.`,
    });
  }

  if (isBlank(input.org_id)) {
    errors.push({
      field: 'org_id',
      message: 'Project or organisation identifier is required.',
    });
  } else if (input.org_id.length > MAX_TEXT) {
    errors.push({
      field: 'org_id',
      message: `Identifier must be ${MAX_TEXT} characters or fewer.`,
    });
  }

  if (!VALID_CATEGORIES.includes(input.claim_category)) {
    errors.push({
      field: 'claim_category',
      message: 'Select a valid claim category.',
    });
  }

  if (isBlank(input.country)) {
    errors.push({ field: 'country', message: 'Country is required.' });
  } else if (input.country.length > MAX_TEXT) {
    errors.push({
      field: 'country',
      message: `Country must be ${MAX_TEXT} characters or fewer.`,
    });
  }

  if (isBlank(input.location_description)) {
    errors.push({
      field: 'location_description',
      message: 'Location description is required.',
    });
  } else if (input.location_description.length > MAX_DESC) {
    errors.push({
      field: 'location_description',
      message: `Location description must be ${MAX_DESC} characters or fewer.`,
    });
  }

  if (!isValidISODate(input.reporting_period_start)) {
    errors.push({
      field: 'reporting_period_start',
      message: 'Reporting period start must be a valid date (YYYY-MM-DD).',
    });
  }

  if (!isValidISODate(input.reporting_period_end)) {
    errors.push({
      field: 'reporting_period_end',
      message: 'Reporting period end must be a valid date (YYYY-MM-DD).',
    });
  }

  if (
    isValidISODate(input.reporting_period_start) &&
    isValidISODate(input.reporting_period_end)
  ) {
    if (input.reporting_period_end < input.reporting_period_start) {
      errors.push({
        field: 'reporting_period_end',
        message: 'Reporting period end must be on or after the start date.',
      });
    }
  }

  if (
    typeof input.claimed_quantity !== 'number' ||
    Number.isNaN(input.claimed_quantity) ||
    input.claimed_quantity <= 0
  ) {
    errors.push({
      field: 'claimed_quantity',
      message: 'Claimed quantity must be a positive number greater than zero.',
    });
  } else if (input.claimed_quantity > MAX_QUANTITY) {
    errors.push({
      field: 'claimed_quantity',
      message: `Claimed quantity is implausibly large (max ${MAX_QUANTITY.toLocaleString()}).`,
    });
  }

  if (isBlank(input.unit)) {
    errors.push({ field: 'unit', message: 'Unit is required.' });
  } else if (input.unit.length > 50) {
    errors.push({
      field: 'unit',
      message: 'Unit must be 50 characters or fewer.',
    });
  }

  if (isBlank(input.evidence_reference)) {
    errors.push({
      field: 'evidence_reference',
      message: 'Evidence reference or URL is required.',
    });
  } else if (!looksLikeUrlOrRef(input.evidence_reference)) {
    errors.push({
      field: 'evidence_reference',
      message:
        'Evidence reference must be a URL (http/https), a DOI, or a meaningful reference.',
    });
  } else if (input.evidence_reference.length > MAX_TEXT) {
    errors.push({
      field: 'evidence_reference',
      message: `Evidence reference must be ${MAX_TEXT} characters or fewer.`,
    });
  }

  if (isBlank(input.evidence_description)) {
    errors.push({
      field: 'evidence_description',
      message: 'Supporting evidence description is required.',
    });
  } else if (input.evidence_description.length > MAX_DESC) {
    errors.push({
      field: 'evidence_description',
      message: `Evidence description must be ${MAX_DESC} characters or fewer.`,
    });
  }

  return errors;
}
