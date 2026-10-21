/**
 * Tests for searchRecords input validation, routing, and error handling.
 *
 * Run with: npx tsx --test src/lib/__tests__/searchRecords.test.ts
 *
 * Covers:
 * 1. UUID search — valid UUID queries evidence_records.id
 * 2. SHA-256 fingerprint search — 64 hex chars queries evidence_records.fingerprint
 * 3. On-chain record ID hash search — 0x + 64 hex chars queries
 *    blockchain_registrations.record_id_hash, then evidence_records by record_id
 * 4. 0x prefix and casing normalization
 * 5. Invalid input — returns empty array, no DB call
 * 6. Empty input — returns empty array
 * 7. No results — valid format but no matching row
 * 8. Database error — real error message is thrown as Error
 * 9. On-chain hash with no registration — returns empty array, no evidence_records query
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Load .env before importing supabaseClient (which reads process.env as fallback)
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '../../../.env');
try {
  const envContent = readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx);
    const val = trimmed.slice(eqIdx + 1);
    if (!process.env[key]) process.env[key] = val;
  }
} catch {
  // .env not found — tests that need supabase will fail, but validation tests can still run
}

// Now import after env is set
const { supabase } = await import('../supabaseClient.ts');
const { searchRecords } = await import('../repository.ts');

// --- Mock infrastructure ---

interface CallRecord {
  table: string;
  filters: { col: string; val: unknown; op: string }[];
}

let calls: CallRecord[];
let responses: Map<string, { data: unknown[] | null; error: { message: string } | null }>;

function installMock() {
  calls = [];
  const originalFrom = supabase.from.bind(supabase);
  (supabase as unknown as { from: unknown }).from = (table: string) => {
    const filters: { col: string; val: unknown; op: string }[] = [];

    const thenable: Record<string, unknown> = {
      select: () => thenable,
      eq: (col: string, val: unknown) => { filters.push({ col, val, op: 'eq' }); return thenable; },
      in: (col: string, vals: unknown[]) => { filters.push({ col, val: vals, op: 'in' }); return thenable; },
      or: () => thenable,
      order: () => thenable,
      limit: () => thenable,
      maybeSingle: async () => ({ data: null, error: null }),
      single: async () => ({ data: null, error: null }),
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (thenable as any).then = (
      resolve: (v: { data: unknown[] | null; error: { message: string } | null }) => void,
    ) => {
      calls.push({ table, filters: [...filters] });
      const resp = responses.get(table) ?? { data: [], error: null };
      Promise.resolve(resp).then(resolve);
      return Promise.resolve() as unknown as Promise<never>;
    };
    return thenable as unknown as Record<string, unknown> & Promise<{ data: unknown[] | null; error: { message: string } | null }>;
  };
  return originalFrom;
}

let originalFrom: unknown;

beforeEach(() => {
  responses = new Map();
  originalFrom = installMock();
});

afterEach(() => {
  (supabase as unknown as { from: unknown }).from = originalFrom;
});

// --- Test data ---

const UUID = '12345678-1234-1234-1234-123456789abc';
const FINGERPRINT = 'a'.repeat(64);
const ON_CHAIN_HASH = '0xfd434eac893f685badc2445c1eb3d4e9f6c0f6db7bba0f2502c2ed42e4177a57';
const SAMPLE_RECORD = { id: UUID, project_name: 'Test Project', fingerprint: FINGERPRINT };

// --- Tests ---

describe('searchRecords — empty and invalid input', () => {
  it('returns [] for empty string', async () => {
    const result = await searchRecords('');
    assert.deepEqual(result, []);
    assert.equal(calls.length, 0, 'no DB call for empty input');
  });

  it('returns [] for whitespace-only input', async () => {
    const result = await searchRecords('   ');
    assert.deepEqual(result, []);
    assert.equal(calls.length, 0);
  });

  it('returns [] for arbitrary text', async () => {
    const result = await searchRecords('hello world');
    assert.deepEqual(result, []);
    assert.equal(calls.length, 0, 'no DB call for non-UUID, non-hex input');
  });

  it('returns [] for a short hex string', async () => {
    const result = await searchRecords('0xabc123');
    assert.deepEqual(result, []);
    assert.equal(calls.length, 0);
  });

  it('returns [] for 32-char hex (not 64)', async () => {
    const result = await searchRecords('a'.repeat(32));
    assert.deepEqual(result, []);
    assert.equal(calls.length, 0);
  });

  it('returns [] for 0x + 32-char hex', async () => {
    const result = await searchRecords('0x' + 'a'.repeat(32));
    assert.deepEqual(result, []);
    assert.equal(calls.length, 0);
  });

  it('returns [] for 66-char hex without 0x prefix', async () => {
    const result = await searchRecords('a'.repeat(66));
    assert.deepEqual(result, []);
    assert.equal(calls.length, 0);
  });
});

describe('searchRecords — UUID search', () => {
  it('queries evidence_records by id for a valid UUID', async () => {
    responses.set('evidence_records', { data: [SAMPLE_RECORD], error: null });
    const result = await searchRecords(UUID);
    assert.equal(result.length, 1);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].table, 'evidence_records');
    const idFilter = calls[0].filters.find((f) => f.col === 'id' && f.op === 'eq');
    assert.ok(idFilter, 'must filter by id');
    assert.equal(idFilter!.val, UUID);
  });

  it('accepts uppercase UUID', async () => {
    responses.set('evidence_records', { data: [SAMPLE_RECORD], error: null });
    const result = await searchRecords('12345678-1234-1234-1234-123456789ABC');
    assert.equal(result.length, 1);
    assert.equal(calls[0].table, 'evidence_records');
  });

  it('returns [] for valid UUID with no match', async () => {
    responses.set('evidence_records', { data: null, error: null });
    const result = await searchRecords('00000000-0000-0000-0000-000000000000');
    assert.deepEqual(result, []);
  });
});

describe('searchRecords — fingerprint search', () => {
  it('queries evidence_records by fingerprint for 64 hex chars', async () => {
    responses.set('evidence_records', { data: [SAMPLE_RECORD], error: null });
    const result = await searchRecords(FINGERPRINT);
    assert.equal(result.length, 1);
    assert.equal(calls[0].table, 'evidence_records');
    const fpFilter = calls[0].filters.find((f) => f.col === 'fingerprint' && f.op === 'eq');
    assert.ok(fpFilter, 'must filter by fingerprint');
    assert.equal(fpFilter!.val, FINGERPRINT);
  });

  it('normalizes uppercase fingerprint to lowercase', async () => {
    responses.set('evidence_records', { data: [SAMPLE_RECORD], error: null });
    await searchRecords('A'.repeat(64));
    const fpFilter = calls[0].filters.find((f) => f.col === 'fingerprint' && f.op === 'eq');
    assert.ok(fpFilter);
    assert.equal(fpFilter!.val, 'a'.repeat(64), 'must lowercase the fingerprint');
  });

  it('returns [] for valid fingerprint with no match', async () => {
    responses.set('evidence_records', { data: null, error: null });
    const result = await searchRecords('b'.repeat(64));
    assert.deepEqual(result, []);
  });
});

describe('searchRecords — on-chain record ID hash search', () => {
  it('queries blockchain_registrations by record_id_hash, then evidence_records by record_id', async () => {
    responses.set('blockchain_registrations', { data: [{ record_id: UUID }], error: null });
    responses.set('evidence_records', { data: [SAMPLE_RECORD], error: null });

    const result = await searchRecords(ON_CHAIN_HASH);

    assert.equal(result.length, 1);
    assert.equal((result[0] as { id: string }).id, UUID);

    assert.equal(calls[0].table, 'blockchain_registrations');
    const hashFilter = calls[0].filters.find((f) => f.col === 'record_id_hash' && f.op === 'eq');
    assert.ok(hashFilter, 'must filter by record_id_hash');
    assert.equal(hashFilter!.val, ON_CHAIN_HASH.toLowerCase());

    assert.equal(calls[1].table, 'evidence_records');
    const inFilter = calls[1].filters.find((f) => f.col === 'id' && f.op === 'in');
    assert.ok(inFilter, 'must filter by id (in)');
    assert.deepEqual(inFilter!.val, [UUID]);
  });

  it('normalizes uppercase on-chain hash to lowercase', async () => {
    responses.set('blockchain_registrations', { data: [{ record_id: UUID }], error: null });
    responses.set('evidence_records', { data: [SAMPLE_RECORD], error: null });

    const upperHash = '0x' + 'FD434EAC893F685BADC2445C1EB3D4E9F6C0F6DB7BBA0F2502C2ED42E4177A57';
    await searchRecords(upperHash);

    const hashFilter = calls[0].filters.find((f) => f.col === 'record_id_hash' && f.op === 'eq');
    assert.ok(hashFilter);
    assert.equal(hashFilter!.val, ON_CHAIN_HASH, 'must lowercase the hash');
  });

  it('returns [] when no blockchain registration matches the hash', async () => {
    responses.set('blockchain_registrations', { data: [], error: null });

    const result = await searchRecords(ON_CHAIN_HASH);

    assert.deepEqual(result, []);
    const evCall = calls.find((c) => c.table === 'evidence_records');
    assert.equal(evCall, undefined, 'should not query evidence_records when no registration found');
  });

  it('does not pass the on-chain hash to evidence_records.id (no UUID cast error)', async () => {
    responses.set('blockchain_registrations', { data: [], error: null });

    const result = await searchRecords(ON_CHAIN_HASH);
    assert.deepEqual(result, []);

    const evCall = calls.find((c) => c.table === 'evidence_records');
    assert.equal(evCall, undefined);
  });
});

describe('searchRecords — database errors', () => {
  it('throws Error with the database message on evidence_records error', async () => {
    responses.set('evidence_records', { data: null, error: { message: 'permission denied' } });

    await assert.rejects(
      searchRecords(UUID),
      (err: unknown) => {
        assert.ok(err instanceof Error, 'must throw an Error instance, not a plain object');
        assert.equal((err as Error).message, 'permission denied');
        return true;
      },
    );
  });

  it('throws Error with the database message on blockchain_registrations error', async () => {
    responses.set('blockchain_registrations', { data: null, error: { message: 'connection refused' } });

    await assert.rejects(
      searchRecords(ON_CHAIN_HASH),
      (err: unknown) => {
        assert.ok(err instanceof Error);
        assert.equal((err as Error).message, 'connection refused');
        return true;
      },
    );
  });
});
