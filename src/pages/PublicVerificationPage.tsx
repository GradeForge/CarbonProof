import { useState } from 'react';
import { Search, Loader2, ShieldCheck, AlertCircle, Fingerprint, ExternalLink, Info } from 'lucide-react';
import { searchRecords, getAuditEvents } from '@/lib/repository';
import type { AuditEvent, EvidenceRecord } from '@/lib/types';
import {
  STATUS_STYLES,
  SEVERITY_STYLES,
  formatDate,
  formatQuantity,
  categoryLabel,
} from '@/lib/format';
import { Badge, Card, LocalPrototypeBadge } from '@/components/ui';
import { BlockchainVerification } from '@/components/BlockchainVerification';
import { useRouter } from '@/lib/router';

export function PublicVerificationPage() {
  const { navigate } = useRouter();
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<EvidenceRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [eventsByRecord, setEventsByRecord] = useState<Record<string, AuditEvent[]>>({});

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    const q = query.trim();
    if (!q) {
      setResults([]);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const found = await searchRecords(q);
      setResults(found);
      if (found.length > 0) {
        const allEvents = await Promise.all(
          found.map((r) => getAuditEvents(r.id))
        );
        const map: Record<string, AuditEvent[]> = {};
        found.forEach((r, i) => {
          map[r.id] = allEvents[i];
        });
        setEventsByRecord(map);
      }
    } catch (err) {
      const message = err instanceof Error
        ? err.message
        : (err as { message?: string })?.message ?? 'Search failed.';
      setError(message);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-stone-100">
            Public Verification
          </h1>
          <LocalPrototypeBadge />
        </div>
        <p className="mt-1 text-sm text-stone-400">
          Look up a record by its ID or SHA-256 fingerprint to inspect its
          evidence metadata and audit status.
        </p>
      </div>

      <Card className="p-5">
        <form onSubmit={handleSearch} className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-500" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Enter record ID or fingerprint…"
              className="w-full rounded-lg border border-stone-700 bg-stone-900/60 py-2.5 pl-9 pr-3 text-sm text-stone-100 placeholder:text-stone-500 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Verify
          </button>
        </form>
        <p className="mt-2 text-xs text-stone-500">
          Search matches the full record ID (UUID) or the full SHA-256 fingerprint.
        </p>
      </Card>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-800/60 bg-red-900/20 p-3 text-sm text-red-200">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {results && results.length === 0 && !error && (
        <Card className="p-6 text-center">
          <ShieldCheck className="mx-auto h-6 w-6 text-stone-500" />
          <p className="mt-2 text-sm text-stone-300">
            No record found matching "{query}".
          </p>
          <p className="mt-1 text-xs text-stone-500">
            Check the ID or fingerprint and try again.
          </p>
        </Card>
      )}

      {results && results.length > 0 && (
        <div className="space-y-6">
          {results.map((r) => (
            <VerificationResult
              key={r.id}
              record={r}
              events={eventsByRecord[r.id] ?? []}
              onView={() => navigate({ name: 'record', id: r.id })}
            />
          ))}
        </div>
      )}

      <Card className="px-5 py-3">
        <p className="flex items-center gap-2 text-xs text-amber-200">
          <Info className="h-4 w-4 shrink-0" />
          Results show local evidence metadata, audit findings, and live on-chain
          registration status when a smart contract is configured. No AI result
          or blockchain registration proves that an environmental claim is true.
        </p>
      </Card>
    </div>
  );
}

function VerificationResult({
  record,
  events,
  onView,
}: {
  record: EvidenceRecord;
  events: AuditEvent[];
  onView: () => void;
}) {
  const style = STATUS_STYLES[record.status];
  return (
    <Card className="p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-stone-100">
            {record.project_name}
          </h2>
          <p className="mt-0.5 font-mono text-xs text-stone-500">
            {record.id}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge classes={style.classes} dot={style.dot}>
            {style.label}
          </Badge>
          <span className="rounded-md border border-amber-700/60 bg-amber-900/30 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-amber-200">
            Local Record
          </span>
        </div>
      </div>

      <dl className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-2">
        <Item label="Organisation ID" value={record.org_id} />
        <Item label="Category" value={categoryLabel(record.claim_category)} />
        <Item label="Country" value={record.country} />
        <Item label="Quantity" value={`${formatQuantity(record.claimed_quantity)} ${record.unit}`} />
        <Item label="Reporting period" value={`${record.reporting_period_start} → ${record.reporting_period_end}`} />
        <Item label="Created" value={formatDate(record.created_at)} />
      </dl>

      <div className="mt-4 rounded-lg border border-stone-700/60 bg-stone-900/40 p-3">
        <div className="flex items-center gap-2">
          <Fingerprint className="h-4 w-4 text-emerald-400" />
          <p className="text-xs font-medium uppercase tracking-wider text-stone-500">
            SHA-256 Evidence Fingerprint
          </p>
        </div>
        <p className="mt-1 break-all font-mono text-xs text-stone-300">
          {record.fingerprint}
        </p>
      </div>

      {record.evidence_reference && (
        <div className="mt-3 text-sm">
          <span className="text-xs font-medium uppercase tracking-wider text-stone-500">
            Evidence reference
          </span>
          <p className="mt-1 break-all text-stone-200">
            {/^https?:\/\//i.test(record.evidence_reference) ? (
              <a
                href={record.evidence_reference}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-emerald-300 hover:text-emerald-200 hover:underline"
              >
                {record.evidence_reference}
                <ExternalLink className="h-3 w-3" />
              </a>
            ) : (
              record.evidence_reference
            )}
          </p>
        </div>
      )}

      {/* Provenance events */}
      <div className="mt-5">
        <p className="text-xs font-medium uppercase tracking-wider text-stone-500">
          Provenance Events
        </p>
        <ol className="mt-2 space-y-2 border-l border-stone-700 pl-4">
          {events.map((ev) => (
            <li key={ev.id} className="relative">
              <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-emerald-600 ring-2 ring-stone-900" />
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-stone-500">
                  {formatDate(ev.created_at)}
                </span>
                {ev.severity && (
                  <Badge classes={SEVERITY_STYLES[ev.severity].classes}>
                    {SEVERITY_STYLES[ev.severity].label}
                  </Badge>
                )}
                {ev.rule_id && (
                  <span className="font-mono text-[11px] text-stone-500">
                    {ev.rule_id}
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-sm text-stone-200">{ev.description}</p>
            </li>
          ))}
        </ol>
      </div>

      {/* Blockchain verification */}
      <div className="mt-4">
        <BlockchainVerification recordId={record.id} fingerprint={record.fingerprint} />
      </div>

      <div className="mt-5 flex justify-end">
        <button
          onClick={onView}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-300 hover:text-emerald-200"
        >
          View full record →
        </button>
      </div>
    </Card>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wider text-stone-500">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm text-stone-200">{value}</dd>
    </div>
  );
}
