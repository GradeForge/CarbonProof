import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  RefreshCw,
  Loader2,
  Fingerprint,
  Clock,
  AlertCircle,
  Info,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  History,
  Sparkles,
  Brain,
  HelpCircle,
  ListChecks,
  ShieldAlert,
} from 'lucide-react';
import { getRecord, getAuditEvents, reauditRecord } from '@/lib/repository';
import {
  runAIAudit,
  getAIAuditsForRecord,
  type StoredAIAudit,
} from '@/lib/aiRepository';
import type { AuditEvent, EvidenceRecord } from '@/lib/types';
import {
  STATUS_STYLES,
  SEVERITY_STYLES,
  AI_SUFFICIENCY_STYLES,
  AI_STATUS_STYLES,
  formatDate,
  formatQuantity,
  categoryLabel,
} from '@/lib/format';
import type { AIFinding } from '@/lib/aiSchema';
import { Badge, Card, LocalPrototypeBadge } from '@/components/ui';
import { BlockchainSection } from '@/components/BlockchainSection';
import { useRouter } from '@/lib/router';

export function RecordDetailPage({ id }: { id: string }) {
  const { navigate } = useRouter();
  const [record, setRecord] = useState<EvidenceRecord | null>(null);
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [aiAudits, setAiAudits] = useState<StoredAIAudit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reauditing, setReauditing] = useState(false);
  const [aiRunning, setAiRunning] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [r, ev, ai] = await Promise.all([
        getRecord(id),
        getAuditEvents(id),
        getAIAuditsForRecord(id),
      ]);
      setRecord(r);
      setEvents(ev);
      setAiAudits(ai);
      if (!r) setError('Record not found.');
      else setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load record.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleReaudit = async () => {
    if (reauditing) return;
    setReauditing(true);
    try {
      const { record: updated, events: newEvents } = await reauditRecord(id);
      setRecord(updated);
      setEvents((prev) => [...prev, ...newEvents]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Re-audit failed.');
    } finally {
      setReauditing(false);
    }
  };

  const handleRunAIAudit = async () => {
    if (aiRunning || !record) return; // prevent repeated clicks
    setAiRunning(true);
    setAiError(null);
    try {
      await runAIAudit(record);
      // Reload both AI audits and audit events (the edge function logs an event).
      const [ai, ev] = await Promise.all([
        getAIAuditsForRecord(id),
        getAuditEvents(id),
      ]);
      setAiAudits(ai);
      setEvents(ev);
    } catch (e) {
      setAiError(e instanceof Error ? e.message : 'AI audit failed.');
    } finally {
      setAiRunning(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-stone-400">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (error || !record) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => navigate({ name: 'registry' })}
          className="inline-flex items-center gap-1.5 text-sm text-stone-400 hover:text-stone-200"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Registry
        </button>
        <Card className="p-6 text-center">
          <AlertCircle className="mx-auto h-6 w-6 text-red-400" />
          <p className="mt-2 text-sm text-stone-300">
            {error ?? 'Record not found.'}
          </p>
        </Card>
      </div>
    );
  }

  const style = STATUS_STYLES[record.status];
  const deterministicFindings = events.filter(
    (e) => e.event_type === 'audit_finding'
  );
  const aiHistoryEvents = events.filter((e) => e.event_type === 'ai_audit');
  const hasErrors = deterministicFindings.some((e) => e.severity === 'error');
  const hasWarnings = deterministicFindings.some((e) => e.severity === 'warning');
  const latestAI = aiAudits[0] ?? null;

  return (
    <div className="space-y-6">
      <button
        onClick={() => navigate({ name: 'registry' })}
        className="inline-flex items-center gap-1.5 text-sm text-stone-400 hover:text-stone-200"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Registry
      </button>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-stone-100">
              {record.project_name}
            </h1>
            <Badge classes={style.classes} dot={style.dot}>
              {style.label}
            </Badge>
            {record.is_sample && (
              <span className="rounded border border-sky-800/60 bg-sky-900/30 px-2 py-0.5 text-xs font-medium text-sky-300">
                SAMPLE
              </span>
            )}
            <LocalPrototypeBadge />
          </div>
          <p className="mt-1 font-mono text-xs text-stone-500">
            Record ID: {record.id}
          </p>
        </div>
        <button
          onClick={handleReaudit}
          disabled={reauditing}
          className="inline-flex items-center gap-2 rounded-lg border border-stone-600 bg-stone-800/40 px-3.5 py-2 text-sm font-medium text-stone-200 hover:bg-stone-800 disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
        >
          {reauditing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Re-run Deterministic Audit
        </button>
      </div>

      {/* Local prototype notice */}
      <Card className="border-amber-800/50 bg-amber-900/10 px-5 py-3">
        <p className="flex items-center gap-2 text-xs text-amber-200">
          <Info className="h-4 w-4 shrink-0" />
          LOCAL PROTOTYPE. AI results and blockchain registrations are advisory
          and do not independently verify or certify any environmental claim.
        </p>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Claim metadata */}
        <Card className="p-5 lg:col-span-2">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-stone-400">
            Claim & Evidence Metadata
          </h2>
          <dl className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2">
            <DetailItem label="Project / Org ID" value={record.org_id} />
            <DetailItem label="Claim category" value={categoryLabel(record.claim_category)} />
            <DetailItem label="Country" value={record.country} />
            <DetailItem label="Location" value={record.location_description} />
            <DetailItem
              label="Reporting period"
              value={`${record.reporting_period_start} → ${record.reporting_period_end}`}
            />
            <DetailItem
              label="Claimed quantity"
              value={`${formatQuantity(record.claimed_quantity)} ${record.unit}`}
            />
            <div className="sm:col-span-2">
              <dt className="text-xs font-medium uppercase tracking-wider text-stone-500">
                Evidence reference
              </dt>
              <dd className="mt-1 break-all text-sm text-stone-200">
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
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs font-medium uppercase tracking-wider text-stone-500">
                Evidence description
              </dt>
              <dd className="mt-1 text-sm text-stone-200">
                {record.evidence_description}
              </dd>
            </div>
          </dl>
        </Card>

        {/* Fingerprint + provenance */}
        <div className="space-y-6">
          <Card className="p-5">
            <div className="flex items-center gap-2">
              <Fingerprint className="h-4 w-4 text-emerald-400" />
              <h2 className="text-sm font-semibold uppercase tracking-wider text-stone-400">
                Evidence Fingerprint
              </h2>
            </div>
            <p className="mt-3 break-all font-mono text-xs text-stone-300">
              {record.fingerprint}
            </p>
            <p className="mt-2 text-xs text-stone-500">
              SHA-256 of canonicalized evidence fields. Uniqueness only proves the
              canonical evidence has not been registered before — not that the
              claim is truthful.
            </p>
          </Card>

          <Card className="p-5">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-stone-400" />
              <h2 className="text-sm font-semibold uppercase tracking-wider text-stone-400">
                Provenance
              </h2>
            </div>
            <dl className="mt-3 space-y-3 text-sm">
              <DetailItem label="Created" value={formatDate(record.created_at)} />
              <DetailItem label="Last updated" value={formatDate(record.updated_at)} />
              <DetailItem label="Origin" value={record.is_sample ? 'Sample data' : 'User submission'} />
            </dl>
          </Card>
        </div>
      </div>

      {/* Deterministic audit findings */}
      <Card className="p-5">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          <h2 className="text-sm font-semibold uppercase tracking-wider text-stone-400">
            Deterministic Audit Findings
          </h2>
        </div>
        <p className="mt-1 text-xs text-stone-500">
          Rule-based checks that run identically every time. Reproducible and explainable.
        </p>
        <div className="mt-4 space-y-3">
          {deterministicFindings.length === 0 && (
            <p className="text-sm text-stone-400">
              No deterministic audit findings recorded yet.
            </p>
          )}
          {deterministicFindings.map((f) => (
            <FindingRow key={f.id} event={f} />
          ))}
        </div>
        <div className="mt-4 rounded-lg border border-stone-700/60 bg-stone-900/40 p-3">
          <p className="text-xs text-stone-400">
            {hasErrors
              ? 'Automated checks identified errors. This record is flagged for review.'
              : hasWarnings
                ? 'Automated checks found no errors but raised warnings. The record is ready for human review.'
                : 'Automated checks found no issues. A clean automated audit does not mean the claim is independently verified or certified.'}
          </p>
        </div>
      </Card>

      {/* AI Evidence Audit section */}
      <AIAuditSection
        latestAI={latestAI}
        aiHistoryEvents={aiHistoryEvents}
        running={aiRunning}
        error={aiError}
        onRun={handleRunAIAudit}
      />

      {/* Blockchain registration */}
      <BlockchainSection
        record={record}
        onEventsChanged={async () => {
          const ev = await getAuditEvents(id);
          setEvents(ev);
        }}
      />

      {/* Audit history */}
      <Card className="p-5">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-stone-400" />
          <h2 className="text-sm font-semibold uppercase tracking-wider text-stone-400">
            Audit History
          </h2>
        </div>
        <p className="mt-1 text-xs text-stone-500">
          Append-only. Previous findings are never overwritten when a new audit runs.
        </p>
        <ol className="mt-4 space-y-3 border-l border-stone-700 pl-5">
          {events.map((ev) => (
            <li key={ev.id} className="relative">
              <span
                className={`absolute -left-[26px] top-1 h-2.5 w-2.5 rounded-full ring-2 ring-stone-900 ${
                  ev.event_type === 'ai_audit'
                    ? 'bg-sky-500'
                    : ev.event_type === 'blockchain_registration'
                      ? 'bg-violet-500'
                      : 'bg-emerald-600'
                }`}
              />
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-stone-500">
                  {formatDate(ev.created_at)}
                </span>
                {ev.event_type === 'ai_audit' && (
                  <span className="rounded border border-sky-800/60 bg-sky-900/30 px-1.5 py-0.5 text-[10px] font-medium text-sky-300">
                    AI
                  </span>
                )}
                {ev.event_type === 'blockchain_registration' && (
                  <span className="rounded border border-violet-800/60 bg-violet-900/30 px-1.5 py-0.5 text-[10px] font-medium text-violet-300">
                    CHAIN
                  </span>
                )}
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
              {ev.suggestion && (
                <p className="mt-0.5 text-xs text-stone-400">
                  Suggested action: {ev.suggestion}
                </p>
              )}
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}

function AIAuditSection({
  latestAI,
  aiHistoryEvents,
  running,
  error,
  onRun,
}: {
  latestAI: StoredAIAudit | null;
  aiHistoryEvents: AuditEvent[];
  running: boolean;
  error: string | null;
  onRun: () => void;
}) {
  return (
    <Card className="border-sky-900/40 p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-sky-400" />
          <h2 className="text-sm font-semibold uppercase tracking-wider text-stone-400">
            AI Evidence Audit
          </h2>
          {latestAI && (
            <Badge
              classes={AI_STATUS_STYLES[latestAI.status].classes}
              dot={AI_STATUS_STYLES[latestAI.status].dot}
            >
              {AI_STATUS_STYLES[latestAI.status].label}
            </Badge>
          )}
        </div>
        <button
          onClick={onRun}
          disabled={running}
          className="inline-flex items-center gap-2 rounded-lg border border-sky-700/60 bg-sky-900/30 px-3.5 py-2 text-sm font-medium text-sky-200 hover:bg-sky-900/50 disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
        >
          {running ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Running AI Audit…
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Run AI Evidence Audit
            </>
          )}
        </button>
      </div>

      {/* Advisory notice — always visible */}
      <div className="mt-4 rounded-lg border border-amber-800/50 bg-amber-900/10 p-3">
        <p className="flex items-center gap-2 text-xs text-amber-200">
          <ShieldAlert className="h-4 w-4 shrink-0" />
          AI assessment — not independent certification. AI findings are advisory
          and require human review. They do not verify, certify, or prove the
          truth of any environmental claim.
        </p>
      </div>

      {/* Error state */}
      {error && (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-800/60 bg-red-900/20 p-3 text-sm text-red-200">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">AI audit could not complete</p>
            <p className="mt-0.5 text-xs text-red-200/80">{error}</p>
            <p className="mt-1 text-xs text-red-200/60">
              The original record and all previous audit history are preserved.
            </p>
          </div>
        </div>
      )}

      {/* Loading state */}
      {running && (
        <div className="mt-4 flex items-center gap-3 rounded-lg border border-sky-800/50 bg-sky-900/15 p-4 text-sm text-sky-200">
          <Loader2 className="h-5 w-5 animate-spin" />
          Contacting the AI evidence auditor. This may take a few seconds…
        </div>
      )}

      {/* Unavailable state */}
      {latestAI?.status === 'unavailable' && !running && (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-stone-700 bg-stone-900/40 p-3 text-sm text-stone-300">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-stone-400" />
          <div>
            <p className="font-medium">AI analysis is not available</p>
            <p className="mt-0.5 text-xs text-stone-400">
              {latestAI.error_message ??
                'No AI provider credentials are configured. The project owner must set the AI_API_KEY secret.'}
            </p>
            <p className="mt-1 text-xs text-stone-500">
              The deterministic audit continues to work independently. No AI
              response was simulated.
            </p>
          </div>
        </div>
      )}

      {/* Failed state */}
      {latestAI?.status === 'failed' && !running && (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-800/60 bg-red-900/20 p-3 text-sm text-red-200">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">AI audit failed</p>
            <p className="mt-0.5 text-xs text-red-200/80">
              {latestAI.error_message ?? 'The AI provider returned an error.'}
            </p>
            <p className="mt-1 text-xs text-red-200/60">
              You can retry. The record and all previous audit history are preserved.
            </p>
          </div>
        </div>
      )}

      {/* Success — structured AI results */}
      {latestAI?.status === 'completed' && latestAI.result && !running && (
        <AIResultDisplay audit={latestAI} />
      )}

      {/* AI audit history events */}
      {aiHistoryEvents.length > 0 && (
        <div className="mt-5 border-t border-stone-800 pt-4">
          <p className="text-xs font-medium uppercase tracking-wider text-stone-500">
            AI Audit Events
          </p>
          <ul className="mt-2 space-y-1.5">
            {aiHistoryEvents.map((ev) => (
              <li key={ev.id} className="text-xs text-stone-400">
                <span className="text-stone-500">{formatDate(ev.created_at)}</span>{' '}
                — {ev.description}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

function AIResultDisplay({ audit }: { audit: StoredAIAudit }) {
  const result = audit.result!;
  const sufficiencyStyle = AI_SUFFICIENCY_STYLES[result.evidence_sufficiency];

  return (
    <div className="mt-4 space-y-5">
      <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500">
        <span>Provider: <span className="text-stone-300">{audit.provider}</span></span>
        <span>·</span>
        <span>Model: <span className="text-stone-300">{audit.model}</span></span>
        <span>·</span>
        <span>Run: <span className="text-stone-300">{formatDate(audit.created_at)}</span></span>
      </div>

      {/* Summary + extracted claim + sufficiency */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-stone-500">Summary</p>
            <p className="mt-1 text-sm text-stone-200">{result.summary}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-stone-500">Extracted Environmental Claim</p>
            <p className="mt-1 text-sm text-stone-200">{result.extracted_claim}</p>
          </div>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-stone-500">Evidence Sufficiency</p>
          <div className="mt-1.5">
            <Badge classes={sufficiencyStyle.classes}>
              {sufficiencyStyle.label}
            </Badge>
          </div>
        </div>
      </div>

      {/* AI Findings */}
      <div>
        <div className="flex items-center gap-2">
          <ListChecks className="h-4 w-4 text-sky-400" />
          <p className="text-xs font-medium uppercase tracking-wider text-stone-500">
            AI Findings ({result.findings.length})
          </p>
        </div>
        <div className="mt-2 space-y-2">
          {result.findings.length === 0 && (
            <p className="text-sm text-stone-400">No AI findings reported.</p>
          )}
          {result.findings.map((f, i) => (
            <AIFindingRow key={i} finding={f} />
          ))}
        </div>
      </div>

      {/* Missing information */}
      {result.missing_information.length > 0 && (
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-stone-500">
            Missing Information
          </p>
          <ul className="mt-2 space-y-1">
            {result.missing_information.map((m, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-stone-300">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-amber-400" />
                {m}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Reviewer questions */}
      {result.reviewer_questions.length > 0 && (
        <div>
          <div className="flex items-center gap-2">
            <HelpCircle className="h-4 w-4 text-amber-400" />
            <p className="text-xs font-medium uppercase tracking-wider text-stone-500">
              Questions for the Human Reviewer
            </p>
          </div>
          <ul className="mt-2 space-y-1">
            {result.reviewer_questions.map((q, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-stone-300">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-amber-400" />
                {q}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Limitations */}
      {result.limitations.length > 0 && (
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-stone-500">
            Limitations & Uncertainty
          </p>
          <ul className="mt-2 space-y-1">
            {result.limitations.map((l, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-stone-400">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-stone-500" />
                {l}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function AIFindingRow({ finding }: { finding: AIFinding }) {
  const severity = finding.severity;
  const Icon =
    severity === 'error'
      ? AlertCircle
      : severity === 'warning'
        ? AlertTriangle
        : Info;
  const iconColor =
    severity === 'error'
      ? 'text-red-400'
      : severity === 'warning'
        ? 'text-amber-400'
        : 'text-sky-400';
  return (
    <div className="rounded-lg border border-sky-900/40 bg-sky-900/10 p-3">
      <div className="flex items-start gap-2.5">
        <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${iconColor}`} />
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge classes={SEVERITY_STYLES[severity].classes}>
              {SEVERITY_STYLES[severity].label}
            </Badge>
            <span className="font-mono text-[11px] text-stone-500">
              {finding.rule_id}
            </span>
          </div>
          <p className="mt-1 text-sm text-stone-200">{finding.explanation}</p>
          <p className="mt-1 text-xs text-stone-400">
            <span className="text-stone-500">Evidence basis:</span>{' '}
            {finding.evidence_basis}
          </p>
          <p className="mt-0.5 text-xs text-stone-400">
            <span className="text-stone-500">Recommended action:</span>{' '}
            {finding.recommended_action}
          </p>
        </div>
      </div>
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wider text-stone-500">
        {label}
      </dt>
      <dd className="mt-1 text-sm text-stone-200">{value}</dd>
    </div>
  );
}

function FindingRow({ event }: { event: AuditEvent }) {
  const severity = event.severity ?? 'info';
  const Icon =
    severity === 'error'
      ? AlertCircle
      : severity === 'warning'
        ? AlertTriangle
        : severity === 'info' && event.rule_id === 'NO_AUTOMATIC_ISSUES'
          ? CheckCircle2
          : Info;
  const iconColor =
    severity === 'error'
      ? 'text-red-400'
      : severity === 'warning'
        ? 'text-amber-400'
        : 'text-sky-400';
  return (
    <div className="rounded-lg border border-stone-700/60 bg-stone-900/40 p-3">
      <div className="flex items-start gap-2.5">
        <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${iconColor}`} />
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge classes={SEVERITY_STYLES[severity].classes}>
              {SEVERITY_STYLES[severity].label}
            </Badge>
            <span className="font-mono text-[11px] text-stone-500">
              {event.rule_id}
            </span>
            {event.field && (
              <span className="font-mono text-[11px] text-stone-500">
                field: {event.field}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-stone-200">{event.description}</p>
          {event.suggestion && (
            <p className="mt-1 text-xs text-stone-400">
              Suggested action: {event.suggestion}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
