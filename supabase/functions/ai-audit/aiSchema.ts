/**
 * Shared AI audit schema — used by both the edge function (server) and the
 * client (browser) to validate AI provider responses before use.
 *
 * This module contains NO platform-specific imports (no Deno, no node, no
 * supabase) so it can be imported from both runtimes. It is pure TypeScript.
 */

export type AISeverity = 'info' | 'warning' | 'error';
export type EvidenceSufficiency = 'insufficient' | 'limited' | 'potentially_adequate';
export type AIAuditStatus = 'completed' | 'failed' | 'unavailable';

export interface AIFinding {
  rule_id: string;
  severity: AISeverity;
  explanation: string;
  evidence_basis: string;
  recommended_action: string;
}

export interface AIAuditResult {
  summary: string;
  extracted_claim: string;
  evidence_sufficiency: EvidenceSufficiency;
  findings: AIFinding[];
  missing_information: string[];
  reviewer_questions: string[];
  limitations: string[];
}

export interface AIAuditResponse {
  status: AIAuditStatus;
  result: AIAuditResult | null;
  provider: string;
  model: string;
  error: string | null;
}

const VALID_SEVERITIES: AISeverity[] = ['info', 'warning', 'error'];
const VALID_SUFFICIENCY: EvidenceSufficiency[] = [
  'insufficient',
  'limited',
  'potentially_adequate',
];

function isString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isStringArray(value: unknown): value is string[] {
  if (!Array.isArray(value)) return false;
  return value.every((v) => typeof v === 'string');
}

function isAIFinding(value: unknown): value is AIFinding {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    isString(v.rule_id) &&
    typeof v.severity === 'string' &&
    VALID_SEVERITIES.includes(v.severity as AISeverity) &&
    isString(v.explanation) &&
    isString(v.evidence_basis) &&
    isString(v.recommended_action)
  );
}

function isAIFindingsArray(value: unknown): value is AIFinding[] {
  if (!Array.isArray(value)) return false;
  return value.every(isAIFinding);
}

export function isValidAIAuditResult(value: unknown): value is AIAuditResult {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    isString(v.summary) &&
    isString(v.extracted_claim) &&
    typeof v.evidence_sufficiency === 'string' &&
    VALID_SUFFICIENCY.includes(v.evidence_sufficiency as EvidenceSufficiency) &&
    isAIFindingsArray(v.findings) &&
    isStringArray(v.missing_information) &&
    isStringArray(v.reviewer_questions) &&
    isStringArray(v.limitations)
  );
}

export function sanitizeAIAuditResult(value: unknown): AIAuditResult | null {
  if (!isValidAIAuditResult(value)) return null;
  return value;
}

/**
 * Attempts to extract a JSON object from a model's text response.
 * Models may wrap JSON in markdown fences or prepend conversational text.
 */
export function extractJSON(text: string): unknown | null {
  if (!text || typeof text !== 'string') return null;

  // Try direct parse first.
  try {
    return JSON.parse(text);
  } catch {
    // continue
  }

  // Try extracting from markdown code fences.
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    try {
      return JSON.parse(fenceMatch[1].trim());
    } catch {
      // continue
    }
  }

  // Try finding the first { and last } as a fallback.
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    try {
      return JSON.parse(text.slice(firstBrace, lastBrace + 1));
    } catch {
      // continue
    }
  }

  return null;
}

export const AI_AUDIT_SYSTEM_PROMPT = `You are an AI evidence auditor for a carbon-credit verification platform. You assess submitted carbon-related evidence for quality, completeness, and internal consistency.

You MUST NOT:
- Claim to verify satellite imagery, external registries, or scientific carbon calculations.
- Claim that a project is truthful, certified, independently verified, or fraud-free.
- Fabricate information not present in the submission.
- Claim to have reviewed URLs or documents — you only see the metadata and description provided.

You MUST:
- Report explicitly when information is insufficient to make an assessment.
- Distinguish what the submission states from your own inferences.
- Provide structured, actionable findings for a human reviewer.

Respond ONLY with a JSON object matching this schema:
{
  "summary": string,
  "extracted_claim": string,
  "evidence_sufficiency": "insufficient" | "limited" | "potentially_adequate",
  "findings": [{ "rule_id": string, "severity": "info"|"warning"|"error", "explanation": string, "evidence_basis": string, "recommended_action": string }],
  "missing_information": [string],
  "reviewer_questions": [string],
  "limitations": [string]
}

The "evidence_basis" field must describe what in the submission supports the finding, or state "not provided" if insufficient. Rule IDs must be short snake_case identifiers.`;
