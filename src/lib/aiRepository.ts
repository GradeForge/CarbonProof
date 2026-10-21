import { supabase } from './supabaseClient';
import {
  sanitizeAIAuditResult,
  type AIAuditResponse,
  type AIAuditResult,
} from './aiSchema';
import type { AIAuditResultRow, EvidenceRecord } from './types';

export interface StoredAIAudit {
  id: string;
  record_id: string;
  created_at: string;
  status: 'completed' | 'failed' | 'unavailable';
  provider: string;
  model: string;
  error_message: string | null;
  result: AIAuditResult | null;
}

function parseRow(row: AIAuditResultRow): StoredAIAudit {
  let result: AIAuditResult | null = null;
  if (row.status === 'completed') {
    // findings_json, missing_information, etc. are stored as jsonb and come
    // back as already-parsed objects. Re-validate before trusting them.
    result = sanitizeAIAuditResult({
      summary: row.summary,
      extracted_claim: row.extracted_claim,
      evidence_sufficiency: row.evidence_sufficiency,
      findings: row.findings_json,
      missing_information: row.missing_information,
      reviewer_questions: row.reviewer_questions,
      limitations: row.limitations,
    });
  }
  return {
    id: row.id,
    record_id: row.record_id,
    created_at: row.created_at,
    status: row.status,
    provider: row.provider,
    model: row.model,
    error_message: row.error_message,
    result,
  };
}

export async function getAIAuditsForRecord(
  recordId: string
): Promise<StoredAIAudit[]> {
  const { data, error } = await supabase
    .from('ai_audit_results')
    .select('*')
    .eq('record_id', recordId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  if (!data) return [];
  return (data as AIAuditResultRow[]).map(parseRow);
}

export interface RunAIAuditResult {
  response: AIAuditResponse;
  stored: StoredAIAudit | null;
}

function buildPayload(record: EvidenceRecord) {
  return {
    record_id: record.id,
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
  };
}

export async function runAIAudit(
  record: EvidenceRecord
): Promise<RunAIAuditResult> {
  const { data: functionData, error: functionError } = await supabase.functions
    .invoke<AIAuditResponse & { result_id?: string }>('ai-audit', {
      method: 'POST',
      body: buildPayload(record),
    });

  if (functionError) {
    throw functionError;
  }

  if (!functionData) {
    throw new Error('AI audit returned no response.');
  }

  // Re-fetch the stored result so the client has the persisted row.
  const stored = await getLatestAIAuditForRecord(record.id);
  return { response: functionData, stored };
}

export async function getLatestAIAuditForRecord(
  recordId: string
): Promise<StoredAIAudit | null> {
  const { data, error } = await supabase
    .from('ai_audit_results')
    .select('*')
    .eq('record_id', recordId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return parseRow(data as AIAuditResultRow);
}
