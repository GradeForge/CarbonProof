import { useEffect, useMemo, useState } from 'react';
import { FlaskConical, Loader2, Plus, RotateCcw, Search, FileSearch } from 'lucide-react';
import { listRecords, deleteSampleRecords } from '@/lib/repository';
import { seedSampleData } from '@/lib/sampleData';
import type { EvidenceRecord, RecordStatus } from '@/lib/types';
import { STATUS_STYLES, formatDate, formatQuantity, categoryLabel } from '@/lib/format';
import { Badge, Card, EmptyState, LocalPrototypeBadge } from '@/components/ui';
import { useRouter } from '@/lib/router';

const STATUS_FILTERS: { value: 'all' | RecordStatus; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'ready_for_human_review', label: 'Ready for Review' },
  { value: 'flagged_for_review', label: 'Flagged' },
];

export function RegistryPage() {
  const { navigate } = useRouter();
  const [records, setRecords] = useState<EvidenceRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | RecordStatus>('all');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await listRecords();
      setRecords(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    if (!records) return [];
    const q = query.trim().toLowerCase();
    return records.filter((r) => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (!q) return true;
      return (
        r.project_name.toLowerCase().includes(q) ||
        r.org_id.toLowerCase().includes(q) ||
        r.country.toLowerCase().includes(q) ||
        r.id.toLowerCase().includes(q) ||
        r.fingerprint.toLowerCase().includes(q)
      );
    });
  }, [records, query, statusFilter]);

  const handleResetSamples = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const removed = await deleteSampleRecords();
      await load();
      setMessage(
        removed > 0
          ? `Removed ${removed} sample record${removed === 1 ? '' : 's'}. Your own submissions were not affected.`
          : 'No sample records to remove.'
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Could not reset sample data.');
    } finally {
      setBusy(false);
    }
  };

  const handleLoadSamples = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const result = await seedSampleData();
      await load();
      setMessage(
        `Added ${result.created} sample record${result.created === 1 ? '' : 's'}.` +
          (result.duplicates > 0
            ? ` ${result.duplicates} duplicate${result.duplicates === 1 ? '' : 's'} skipped.`
            : '')
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Could not add sample data.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-stone-100">
              Evidence Registry
            </h1>
            <LocalPrototypeBadge />
          </div>
          <p className="mt-1 text-sm text-stone-400">
            All registered evidence records. Sample records are clearly labelled.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => navigate({ name: 'new-submission' })}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-3.5 py-2 text-sm font-medium text-white hover:bg-emerald-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
          >
            <Plus className="h-4 w-4" />
            New Submission
          </button>
        </div>
      </div>

      <Card className="px-4 py-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-500" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by project, ID, fingerprint, country…"
              className="w-full rounded-lg border border-stone-700 bg-stone-900/60 py-2 pl-9 pr-3 text-sm text-stone-100 placeholder:text-stone-500 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
            />
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setStatusFilter(f.value)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  statusFilter === f.value
                    ? 'bg-emerald-900/40 text-emerald-200'
                    : 'text-stone-400 hover:bg-stone-800/60 hover:text-stone-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={handleLoadSamples}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-md border border-stone-600 bg-stone-800/40 px-3 py-1.5 text-xs font-medium text-stone-300 hover:bg-stone-800 disabled:opacity-60"
        >
          <FlaskConical className="h-3.5 w-3.5" />
          Load Sample Data
        </button>
        <button
          onClick={handleResetSamples}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-md border border-stone-600 bg-stone-800/40 px-3 py-1.5 text-xs font-medium text-stone-300 hover:bg-stone-800 disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
          Reset Sample Data
        </button>
        {message && (
          <span className="text-xs text-stone-400">{message}</span>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-800/60 bg-red-900/20 p-3 text-sm text-red-200">
          {error}
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-12 text-stone-400">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      )}

      {!loading && filtered.length === 0 && !error && (
        <EmptyState
          title={records && records.length === 0 ? 'No evidence records yet' : 'No matching records'}
          description={
            records && records.length === 0
              ? 'Create a new submission or load sample data to get started.'
              : 'Try adjusting your search or status filter.'
          }
          action={
            records && records.length === 0 ? (
              <div className="flex gap-2">
                <button
                  onClick={() => navigate({ name: 'new-submission' })}
                  className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-600"
                >
                  <Plus className="h-4 w-4" />
                  New Submission
                </button>
                <button
                  onClick={handleLoadSamples}
                  disabled={busy}
                  className="inline-flex items-center gap-2 rounded-lg border border-stone-600 bg-stone-800/60 px-4 py-2 text-sm font-medium text-stone-200 hover:bg-stone-800 disabled:opacity-60"
                >
                  <FlaskConical className="h-4 w-4" />
                  Load Sample Data
                </button>
              </div>
            ) : undefined
          }
        />
      )}

      {!loading && filtered.length > 0 && (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wider text-stone-500">
                <tr>
                  <th className="px-5 py-3 font-medium">Record ID</th>
                  <th className="px-5 py-3 font-medium">Project</th>
                  <th className="px-5 py-3 font-medium">Category</th>
                  <th className="px-5 py-3 font-medium">Country</th>
                  <th className="px-5 py-3 text-right font-medium">Quantity</th>
                  <th className="px-5 py-3 font-medium">Fingerprint</th>
                  <th className="px-5 py-3 font-medium">Submitted</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-800/70">
                {filtered.map((r) => {
                  const style = STATUS_STYLES[r.status];
                  return (
                    <tr
                      key={r.id}
                      onClick={() => navigate({ name: 'record', id: r.id })}
                      className="cursor-pointer transition-colors hover:bg-stone-800/40"
                    >
                      <td className="px-5 py-3 font-mono text-xs text-stone-300">
                        {r.id.slice(0, 8)}
                      </td>
                      <td className="px-5 py-3 text-stone-200">
                        <div className="flex items-center gap-2">
                          {r.project_name}
                          {r.is_sample && (
                            <span className="rounded border border-sky-800/60 bg-sky-900/30 px-1.5 py-0.5 text-[10px] font-medium text-sky-300">
                              SAMPLE
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3 text-stone-400">
                        {categoryLabel(r.claim_category)}
                      </td>
                      <td className="px-5 py-3 text-stone-400">{r.country}</td>
                      <td className="px-5 py-3 text-right tabular-nums text-stone-300">
                        {formatQuantity(r.claimed_quantity)} {r.unit}
                      </td>
                      <td className="px-5 py-3 font-mono text-xs text-stone-500">
                        {r.fingerprint.slice(0, 10)}…
                      </td>
                      <td className="px-5 py-3 text-stone-400">
                        {formatDate(r.created_at)}
                      </td>
                      <td className="px-5 py-3">
                        <Badge classes={style.classes} dot={style.dot}>
                          {style.label}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {!loading && records && records.length > 0 && (
        <p className="flex items-center gap-2 text-xs text-stone-500">
          <FileSearch className="h-3.5 w-3.5" />
          Showing {filtered.length} of {records.length} records. Click any row to view details and audit history.
        </p>
      )}
    </div>
  );
}
