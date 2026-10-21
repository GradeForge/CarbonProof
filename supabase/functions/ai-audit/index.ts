// AI Evidence Auditor edge function for CarbonProof.
// Accepts an evidence record's metadata + description, calls an AI provider
// server-side, validates the structured response, and persists the result.
//
// Secrets (configured in the Supabase dashboard / edge function secrets):
//   AI_API_KEY    — API key for the AI provider (required for live analysis)
//   AI_BASE_URL   — Base URL for an OpenAI-compatible chat completions API
//                   (optional; defaults to OpenAI's public endpoint)
//   AI_MODEL      — Model identifier to use (optional; defaults to gpt-4o-mini)
//
// If AI_API_KEY is absent, the function returns status "unavailable" and does
// NOT simulate an AI response. No secrets are ever returned to the client.

import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import {
  AI_AUDIT_SYSTEM_PROMPT,
  extractJSON,
  sanitizeAIAuditResult,
  type AIAuditResponse,
} from './aiSchema.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers':
    'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface EvidencePayload {
  record_id: string;
  project_name: string;
  org_id: string;
  claim_category: string;
  country: string;
  location_description: string;
  reporting_period_start: string;
  reporting_period_end: string;
  claimed_quantity: number;
  unit: string;
  evidence_reference: string;
  evidence_description: string;
}

const DEFAULT_BASE_URL = 'https://api.openai.com/v1';
const DEFAULT_MODEL = 'gpt-4o-mini';
const REQUEST_TIMEOUT_MS = 30_000;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  try {
    const body = await req.json();
    if (!isValidPayload(body)) {
      return json({ error: 'Invalid request body.' }, 400);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    const aiApiKey = Deno.env.get('AI_API_KEY');
    const aiBaseUrl = Deno.env.get('AI_BASE_URL') ?? DEFAULT_BASE_URL;
    const aiModel = Deno.env.get('AI_MODEL') ?? DEFAULT_MODEL;

    const providerName = inferProviderName(aiBaseUrl);

    // No credentials → report unavailable, persist that fact, do NOT simulate.
    if (!aiApiKey) {
      await persistUnavailable(supabaseUrl, serviceRoleKey, body.record_id, providerName, aiModel);
      const response: AIAuditResponse = {
        status: 'unavailable',
        result: null,
        provider: providerName,
        model: aiModel,
        error: 'AI analysis is not configured. Ask the project owner to set the AI_API_KEY secret.',
      };
      return json(response, 200);
    }

    // Call the AI provider.
    let aiResult;
    try {
      aiResult = await callAIProvider(aiBaseUrl, aiApiKey, aiModel, body);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'AI provider request failed.';
      await persistFailed(supabaseUrl, serviceRoleKey, body.record_id, providerName, aiModel, safeErrorMessage(message));
      const response: AIAuditResponse = {
        status: 'failed',
        result: null,
        provider: providerName,
        model: aiModel,
        error: safeErrorMessage(message),
      };
      return json(response, 200);
    }

    const sanitized = sanitizeAIAuditResult(aiResult.parsed);

    if (!sanitized) {
      await persistFailed(supabaseUrl, serviceRoleKey, body.record_id, providerName, aiModel, 'AI response did not match the expected schema.');
      const response: AIAuditResponse = {
        status: 'failed',
        result: null,
        provider: providerName,
        model: aiModel,
        error: 'AI response was malformed or did not match the expected schema.',
      };
      return json(response, 200);
    }

    // Persist the completed result server-side.
    const row = await persistCompleted(supabaseUrl, serviceRoleKey, body.record_id, sanitized, providerName, aiModel);

    const response: AIAuditResponse = {
      status: 'completed',
      result: sanitized,
      provider: providerName,
      model: aiModel,
      error: null,
    };
    return json({ ...response, result_id: row?.id ?? null }, 200);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error.';
    return json({ error: safeErrorMessage(message) }, 500);
  }
});

function json(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function safeErrorMessage(message: string): string {
  // Strip anything that looks like a key or token from error messages.
  return message
    .replace(/sk-[A-Za-z0-9_-]{10,}/g, 'sk-***')
    .replace(/Bearer\s+[^\s,]+/gi, 'Bearer ***')
    .slice(0, 300);
}

function inferProviderName(baseUrl: string): string {
  if (baseUrl.includes('openai.com')) return 'openai';
  if (baseUrl.includes('anthropic.com')) return 'anthropic';
  return 'custom';
}

function isValidPayload(value: unknown): value is EvidencePayload {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.record_id === 'string' && v.record_id.length > 0 &&
    typeof v.project_name === 'string' &&
    typeof v.org_id === 'string' &&
    typeof v.claim_category === 'string' &&
    typeof v.country === 'string' &&
    typeof v.location_description === 'string' &&
    typeof v.reporting_period_start === 'string' &&
    typeof v.reporting_period_end === 'string' &&
    typeof v.claimed_quantity === 'number' &&
    typeof v.unit === 'string' &&
    typeof v.evidence_reference === 'string' &&
    typeof v.evidence_description === 'string'
  );
}

function buildUserPrompt(payload: EvidencePayload): string {
  // Send only the minimum metadata needed for analysis. No credentials, no
  // unrelated records, and no URL fetching.
  return `Assess the following carbon evidence submission. You are given ONLY the metadata and description below — do not assume you have reviewed any linked documents or URLs.

Project name: ${payload.project_name}
Organisation ID: ${payload.org_id}
Claim category: ${payload.claim_category}
Country: ${payload.country}
Location: ${payload.location_description}
Reporting period: ${payload.reporting_period_start} to ${payload.reporting_period_end}
Claimed quantity: ${payload.claimed_quantity} ${payload.unit}
Evidence reference (string only, not reviewed): ${payload.evidence_reference}
Evidence description: ${payload.evidence_description}

Return ONLY the JSON object described in the system instructions.`;
}

interface AIProviderResult {
  parsed: unknown;
}

async function callAIProvider(
  baseUrl: string,
  apiKey: string,
  model: string,
  payload: EvidencePayload
): Promise<AIProviderResult> {
  const url = `${baseUrl.replace(/\/$/, '')}/chat/completions`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: AI_AUDIT_SYSTEM_PROMPT },
          { role: 'user', content: buildUserPrompt(payload) },
        ],
        temperature: 0.2,
        max_tokens: 1500,
      }),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeout);
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('AI provider request timed out.');
    }
    throw new Error('AI provider request failed.');
  } finally {
    clearTimeout(timeout);
  }

  if (response.status === 429) {
    throw new Error('AI provider rate limit reached. Try again later.');
  }
  if (response.status === 401 || response.status === 403) {
    throw new Error('AI provider rejected the API key.');
  }
  if (!response.ok) {
    throw new Error(`AI provider returned HTTP ${response.status}.`);
  }

  const data = await response.json();
  const content: string | undefined = data?.choices?.[0]?.message?.content;
  if (!content || typeof content !== 'string') {
    throw new Error('AI provider returned an empty response.');
  }

  const parsed = extractJSON(content);
  if (parsed === null) {
    throw new Error('AI response did not contain parseable JSON.');
  }

  return { parsed };
}

function adminClient(supabaseUrl: string, serviceRoleKey: string) {
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Server is missing database configuration.');
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
}

async function persistCompleted(
  supabaseUrl: string,
  serviceRoleKey: string,
  recordId: string,
  result: NonNullable<AIAuditResponse['result']>,
  provider: string,
  model: string
): Promise<{ id: string } | null> {
  const client = adminClient(supabaseUrl, serviceRoleKey);
  const { data, error } = await client
    .from('ai_audit_results')
    .insert({
      record_id: recordId,
      summary: result.summary,
      extracted_claim: result.extracted_claim,
      evidence_sufficiency: result.evidence_sufficiency,
      findings_json: result.findings,
      missing_information: result.missing_information,
      reviewer_questions: result.reviewer_questions,
      limitations: result.limitations,
      provider,
      model,
      status: 'completed',
      error_message: null,
    })
    .select('id')
    .single();
  if (error) throw new Error('Could not persist AI audit result.');

  await logAuditEvent(client, recordId, 'completed', `AI evidence audit completed (provider: ${provider}, model: ${model}). Advisory assessment — not independent certification.`);
  return data as { id: string } | null;
}

async function persistFailed(
  supabaseUrl: string,
  serviceRoleKey: string,
  recordId: string,
  provider: string,
  model: string,
  errorMessage: string
): Promise<void> {
  try {
    const client = adminClient(supabaseUrl, serviceRoleKey);
    await client.from('ai_audit_results').insert({
      record_id: recordId,
      summary: 'AI audit could not be completed.',
      extracted_claim: 'Unavailable.',
      evidence_sufficiency: 'insufficient',
      findings_json: [],
      missing_information: [],
      reviewer_questions: [],
      limitations: ['AI analysis failed — no assessment was produced.'],
      provider,
      model,
      status: 'failed',
      error_message: errorMessage,
    });
    await logAuditEvent(client, recordId, 'failed', `AI evidence audit failed: ${errorMessage}`);
  } catch {
    // Best-effort persistence. The client still gets the error response.
  }
}

async function persistUnavailable(
  supabaseUrl: string,
  serviceRoleKey: string,
  recordId: string,
  provider: string,
  model: string
): Promise<void> {
  try {
    const client = adminClient(supabaseUrl, serviceRoleKey);
    await client.from('ai_audit_results').insert({
      record_id: recordId,
      summary: 'AI analysis is not configured.',
      extracted_claim: 'Unavailable.',
      evidence_sufficiency: 'insufficient',
      findings_json: [],
      missing_information: [],
      reviewer_questions: [],
      limitations: ['AI analysis is unavailable because no provider credentials are configured.'],
      provider,
      model,
      status: 'unavailable',
      error_message: 'No AI provider credentials configured.',
    });
    await logAuditEvent(client, recordId, 'unavailable', 'AI evidence audit unavailable — no provider credentials configured.');
  } catch {
    // Best-effort.
  }
}

async function logAuditEvent(
  client: ReturnType<typeof createClient>,
  recordId: string,
  outcome: string,
  description: string
): Promise<void> {
  await client.from('audit_events').insert({
    record_id: recordId,
    event_type: 'ai_audit',
    rule_id: `AI_AUDIT_${outcome.toUpperCase()}`,
    severity: outcome === 'completed' ? 'info' : 'warning',
    description,
    field: null,
    suggestion:
      outcome === 'completed'
        ? 'AI findings are advisory and require human review. They do not certify the claim.'
        : 'Retry the AI audit later or contact the project owner to configure AI provider credentials.',
  });
}
