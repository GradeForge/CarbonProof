import { supabase } from './supabaseClient';
import type { BlockchainRegistrationRow } from './types';

export interface StoredBlockchainRegistration {
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

function parseRow(row: BlockchainRegistrationRow): StoredBlockchainRegistration {
  return {
    id: row.id,
    record_id: row.record_id,
    evidence_fingerprint: row.evidence_fingerprint,
    record_id_hash: row.record_id_hash,
    transaction_hash: row.transaction_hash,
    block_number: row.block_number,
    registrar_address: row.registrar_address,
    contract_address: row.contract_address,
    network: row.network,
    local_persist_error: row.local_persist_error,
    created_at: row.created_at,
  };
}

export async function getBlockchainRegistrations(
  recordId: string
): Promise<StoredBlockchainRegistration[]> {
  const { data, error } = await supabase
    .from('blockchain_registrations')
    .select('*')
    .eq('record_id', recordId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  if (!data) return [];
  return (data as BlockchainRegistrationRow[]).map(parseRow);
}

export async function saveBlockchainRegistration(input: {
  record_id: string;
  evidence_fingerprint: string;
  record_id_hash: string;
  transaction_hash: string;
  block_number: number;
  registrar_address: string;
  contract_address: string;
  network: string;
}): Promise<StoredBlockchainRegistration | null> {
  const { data, error } = await supabase
    .from('blockchain_registrations')
    .insert(input)
    .select('*')
    .maybeSingle();
  if (error) {
    // Return null to indicate persistence failure — the caller preserves the tx hash.
    return null;
  }
  if (!data) return null;
  return parseRow(data as BlockchainRegistrationRow);
}

export async function logBlockchainEvent(
  recordId: string,
  description: string,
  severity: 'info' | 'warning' | 'error' = 'info',
  suggestion?: string
): Promise<void> {
  await supabase.from('audit_events').insert({
    record_id: recordId,
    event_type: 'blockchain_registration',
    rule_id: 'BLOCKCHAIN_REGISTRATION',
    severity,
    description,
    field: null,
    suggestion: suggestion ?? null,
  });
}
