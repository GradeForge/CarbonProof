import type { EvidenceSubmissionInput } from './types';

function normalizeText(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function normalizeNumber(value: number): string {
  return Number(value).toFixed(6).replace(/\.?0+$/, '');
}

function normalizeDate(value: string): string {
  return value.trim();
}

export function canonicalizeEvidence(input: EvidenceSubmissionInput): string {
  const parts = [
    normalizeText(input.project_name),
    normalizeText(input.org_id),
    normalizeText(input.claim_category),
    normalizeText(input.country),
    normalizeText(input.location_description),
    normalizeDate(input.reporting_period_start),
    normalizeDate(input.reporting_period_end),
    normalizeNumber(input.claimed_quantity),
    normalizeText(input.unit),
    normalizeText(input.evidence_reference),
    normalizeText(input.evidence_description),
  ];
  return parts.join('|');
}

export async function sha256Hex(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const bytes = new Uint8Array(hashBuffer);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function computeFingerprint(
  input: EvidenceSubmissionInput
): Promise<string> {
  const canonical = canonicalizeEvidence(input);
  return sha256Hex(canonical);
}

export function shortFingerprint(fingerprint: string): string {
  if (!fingerprint) return '';
  return `${fingerprint.slice(0, 12)}…${fingerprint.slice(-8)}`;
}
