import { useEffect, useState } from 'react';
import { History, Loader2, ArrowRight } from 'lucide-react';
import { listRecords, getAuditEvents } from '@/lib/repository';
import type { AuditEvent } from '@/lib/types';
import { SEVERITY_STYLES, formatDate } from '@/lib/format';
import { Badge, Card, EmptyState, LocalPrototypeBadge, SectionTitle } from '@/components/ui';
import { useRouter } from '@/lib/router';

interface EnrichedEvent extends AuditEvent {
  projectName: string;
}

export function AuditHistoryPage() {
  const { navigate } = useRouter();
  const [events, setEvents] = useState<EnrichedEvent[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const records = await listRecords();
        const all = await Promise.all(
          records.map((r) => getAuditEvents(r.id))
        );
        const enriched: EnrichedEvent[] = [];
        records.forEach((r, i) => {
          for (const ev of all[i]) {
            enriched.push({ ...ev, projectName: r.project_name });
          }
        });
        enriched.sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        setEvents(enriched);
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load audit history.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-stone-100">
            Audit History
          </h1>
          <LocalPrototypeBadge />
        </div>
        <p className="mt-1 text-sm text-stone-400">
          A chronological, append-only log of every audit event across all records.
        </p>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12 text-stone-400">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-800/60 bg-red-900/20 p-3 text-sm text-red-200">
          {error}
        </div>
      )}

      {!loading && events && events.length === 0 && (
        <EmptyState
          title="No audit events yet"
          description="Create a submission to generate audit findings and history entries."
        />
      )}

      {!loading && events && events.length > 0 && (
        <Card className="p-5">
          <SectionTitle
            title={`${events.length} event${events.length === 1 ? '' : 's'}`}
            subtitle="Newest first. Click a record to view its full detail and history."
          />
          <ol className="mt-5 space-y-3 border-l border-stone-700 pl-5">
            {events.map((ev) => (
              <li key={ev.id} className="relative">
                <span className="absolute -left-[26px] top-1.5 h-2.5 w-2.5 rounded-full bg-emerald-600 ring-2 ring-stone-900" />
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
                  <button
                    onClick={() => navigate({ name: 'record', id: ev.record_id })}
                    className="inline-flex items-center gap-1 text-xs font-medium text-emerald-300 hover:text-emerald-200"
                  >
                    {ev.projectName}
                    <ArrowRight className="h-3 w-3" />
                  </button>
                </div>
                <p className="mt-0.5 text-sm text-stone-200">{ev.description}</p>
                {ev.suggestion && (
                  <p className="mt-0.5 text-xs text-stone-400">
                    Suggested action: {ev.suggestion}
                  </p>
                )}
              </li>
            ))}
          </ol>
        </Card>
      )}

      <Card className="px-5 py-4">
        <p className="flex items-center gap-2 text-xs text-stone-400">
          <History className="h-3.5 w-3.5" />
          Audit history is append-only. Re-running an audit adds new findings
          without erasing previous ones.
        </p>
      </Card>
    </div>
  );
}
