import { useEffect, useMemo, useState } from 'react';
import {
  FileText,
  Fingerprint,
  AlertTriangle,
  ClipboardList,
  Plus,
  FlaskConical,
  Loader2,
} from 'lucide-react';
import { listRecords } from '@/lib/repository';
import { seedSampleData } from '@/lib/sampleData';
import type { EvidenceRecord } from '@/lib/types';
import {
  STATUS_STYLES,
  formatDate,
  formatQuantity,
  categoryLabel,
} from '@/lib/format';
import { Badge, Card, EmptyState, LocalPrototypeBadge, SectionTitle } from '@/components/ui';
import { useRouter } from '@/lib/router';

export function OverviewPage() {
  const { navigate } = useRouter();
  const [records, setRecords] = useState<EvidenceRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [seedMessage, setSeedMessage] = useState<string | null>(null);

  const load = async () => {
    try {
      const data = await listRecords();
      setRecords(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load records.');
    }
  };

  useEffect(() => {
    load();
  }, []);

  const stats = useMemo(() => {
    if (!records) return null;
    const fingerprints = new Set(records.map((r) => r.fingerprint));
    const flagged = records.filter((r) => r.status === 'flagged_for_review').length;
    const incomplete = records.filter(
      (r) =>
        r.status === 'ready_for_human_review' ||
        r.status === 'flagged_for_review'
    ).length;
    return {
      total: records.length,
      uniqueFingerprints: fingerprints.size,
      flagged,
      incomplete,
    };
  }, [records]);

  const handleSeed = async () => {
    setSeeding(true);
    setSeedMessage(null);
    try {
      const result = await seedSampleData();
      setSeedMessage(
        `Added ${result.created} sample record${result.created === 1 ? '' : 's'}.` +
          (result.duplicates > 0
            ? ` ${result.duplicates} duplicate${result.duplicates === 1 ? '' : 's'} skipped.`
            : '')
      );
      await load();
    } catch (e) {
      setSeedMessage(
        e instanceof Error ? e.message : 'Could not add sample data.'
      );
    } finally {
      setSeeding(false);
    }
  };

  if (error) {
    return (
      <div className="rounded-xl border border-red-800/60 bg-red-900/20 p-4 text-sm text-red-200">
        Could not load dashboard data: {error}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-stone-100">
              Overview
            </h1>
            <LocalPrototypeBadge />
          </div>
          <p className="mt-1 text-sm text-stone-400">
            Live statistics calculated from stored evidence records.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => navigate({ name: 'new-submission' })}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
          >
            <Plus className="h-4 w-4" />
            New Submission
          </button>
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            label="Total Evidence Records"
            value={stats.total}
            icon={FileText}
          />
          <StatCard
            label="Unique Fingerprints"
            value={stats.uniqueFingerprints}
            icon={Fingerprint}
          />
          <StatCard
            label="Flagged for Review"
            value={stats.flagged}
            icon={AlertTriangle}
            accent="danger"
          />
          <StatCard
            label="Incomplete Evidence"
            value={stats.incomplete}
            icon={ClipboardList}
            accent="warning"
          />
        </div>
      )}

      {records && records.length === 0 && (
        <EmptyState
          title="No evidence records yet"
          description="Create your first evidence submission, or load clearly-labelled sample data to explore the dashboard, audit findings, and duplicate detection."
          action={
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                onClick={() => navigate({ name: 'new-submission' })}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
              >
                <Plus className="h-4 w-4" />
                New Submission
              </button>
              <button
                onClick={handleSeed}
                disabled={seeding}
                className="inline-flex items-center gap-2 rounded-lg border border-stone-600 bg-stone-800/60 px-4 py-2 text-sm font-medium text-stone-200 hover:bg-stone-800 disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
              >
                {seeding ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FlaskConical className="h-4 w-4" />
                )}
                Load Sample Data
              </button>
            </div>
          }
        />
      )}

      {seedMessage && (
        <div className="rounded-lg border border-emerald-800/50 bg-emerald-900/20 px-4 py-3 text-sm text-emerald-200">
          {seedMessage}
        </div>
      )}

      {records && records.length > 0 && (
        <>
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-emerald-900/40 px-5 py-4">
              <SectionTitle
                title="Recent Submissions"
                subtitle="Latest evidence records, newest first."
              />
              <button
                onClick={() => navigate({ name: 'registry' })}
                className="text-sm font-medium text-emerald-300 hover:text-emerald-200"
              >
                View all →
              </button>
            </div>
            <SubmissionsTable
              records={records.slice(0, 6)}
              onOpen={(id) => navigate({ name: 'record', id })}
            />
          </Card>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleSeed}
              disabled={seeding}
              className="inline-flex items-center gap-2 rounded-lg border border-stone-600 bg-stone-800/40 px-3 py-1.5 text-xs font-medium text-stone-300 hover:bg-stone-800 disabled:opacity-60"
            >
              {seeding ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <FlaskConical className="h-3.5 w-3.5" />
              )}
              Load Sample Data
            </button>
            <p className="text-xs text-stone-500">
              Sample records are clearly labelled and can be reset from the
              Evidence Registry without deleting your own submissions.
            </p>
          </div>
        </>
      )}

      <Card className="px-5 py-4">
        <p className="text-xs leading-relaxed text-stone-400">
          <strong className="text-stone-300">Important:</strong> Statistics and
          audit results reflect deterministic local checks only. A clean audit
          means the implemented rules found no problem — it does not mean a
          claim is independently verified, certified, or truthful. No
          blockchain transaction hashes, AI results, or environmental
          certifications are shown in this prototype.
        </p>
      </Card>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: number;
  icon: typeof FileText;
  accent?: 'danger' | 'warning';
}) {
  const valueColor =
    accent === 'danger'
      ? 'text-red-300'
      : accent === 'warning'
        ? 'text-amber-300'
        : 'text-stone-100';
  return (
    <Card className="px-5 py-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wider text-stone-500">
          {label}
        </p>
        <Icon className="h-4 w-4 text-stone-500" />
      </div>
      <p className={`mt-2 text-3xl font-semibold tabular-nums ${valueColor}`}>
        {value}
      </p>
    </Card>
  );
}

function SubmissionsTable({
  records,
  onOpen,
}: {
  records: EvidenceRecord[];
  onOpen: (id: string) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="text-xs uppercase tracking-wider text-stone-500">
          <tr>
            <th className="px-5 py-3 font-medium">Record ID</th>
            <th className="px-5 py-3 font-medium">Project</th>
            <th className="px-5 py-3 font-medium">Category</th>
            <th className="px-5 py-3 text-right font-medium">Quantity</th>
            <th className="px-5 py-3 font-medium">Submitted</th>
            <th className="px-5 py-3 font-medium">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-800/70">
          {records.map((r) => {
            const style = STATUS_STYLES[r.status];
            return (
              <tr
                key={r.id}
                onClick={() => onOpen(r.id)}
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
                <td className="px-5 py-3 text-right tabular-nums text-stone-300">
                  {formatQuantity(r.claimed_quantity)} {r.unit}
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
  );
}
