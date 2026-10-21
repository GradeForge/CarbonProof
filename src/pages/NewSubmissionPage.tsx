import { useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2, ArrowLeft, Fingerprint, Info } from 'lucide-react';
import { validateSubmission } from '@/lib/validation';
import { computeFingerprint, shortFingerprint } from '@/lib/fingerprint';
import { createRecord, type DuplicateResult } from '@/lib/repository';
import {
  CLAIM_CATEGORIES,
  type ClaimCategory,
  type EvidenceSubmissionInput,
  type FieldError,
} from '@/lib/types';
import { Card, LocalPrototypeBadge } from '@/components/ui';
import { useRouter } from '@/lib/router';

type FormState = EvidenceSubmissionInput;

const EMPTY: FormState = {
  project_name: '',
  org_id: '',
  claim_category: 'reforestation',
  country: '',
  location_description: '',
  reporting_period_start: '',
  reporting_period_end: '',
  claimed_quantity: 0,
  unit: 'tCO2e',
  evidence_reference: '',
  evidence_description: '',
};

export function NewSubmissionPage() {
  const { navigate } = useRouter();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<FieldError[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState<DuplicateResult | null>(null);
  const [liveFingerprint, setLiveFingerprint] = useState<string | null>(null);
  const [fingerprinting, setFingerprinting] = useState(false);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setDuplicate(null);
    setSubmitError(null);
  };

  const computePreview = async () => {
    setFingerprinting(true);
    try {
      const fp = await computeFingerprint(form);
      setLiveFingerprint(fp);
    } finally {
      setFingerprinting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitError(null);
    setDuplicate(null);

    const validationErrors = validateSubmission(form);
    setErrors(validationErrors);
    if (validationErrors.length > 0) return;

    setSubmitting(true);
    try {
      const result = await createRecord(form);
      if ('duplicate' in result) {
        setDuplicate(result);
        setSubmitting(false);
        return;
      }
      navigate({ name: 'record', id: result.record.id });
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : 'Could not save the submission.'
      );
      setSubmitting(false);
    }
  };

  const fieldError = (field: keyof FormState): string | undefined =>
    errors.find((e) => e.field === field)?.message;

  return (
    <div className="space-y-6">
      <div>
        <button
          onClick={() => navigate({ name: 'registry' })}
          className="mb-3 inline-flex items-center gap-1.5 text-sm text-stone-400 hover:text-stone-200"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Registry
        </button>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-stone-100">
            New Evidence Submission
          </h1>
          <LocalPrototypeBadge />
        </div>
        <p className="mt-1 text-sm text-stone-400">
          Submit a carbon-related claim with its supporting evidence. Required
          fields are marked with an asterisk.
        </p>
      </div>

      <Card className="px-4 py-3">
        <div className="flex items-start gap-2.5 text-sm text-amber-200">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
          <p>
            Passing validation confirms the submission is well-formed. It does
            <strong> not</strong> mean the claimed quantity is scientifically
            verified, certified, or truthful. Fingerprint uniqueness only checks
            for duplicate evidence registration.
          </p>
        </div>
      </Card>

      <form onSubmit={handleSubmit} className="space-y-6" noValidate>
        <Card className="space-y-5 p-5">
          <fieldset className="space-y-4">
            <legend className="text-sm font-semibold uppercase tracking-wider text-stone-400">
              Project Identification
            </legend>
            <TextField
              label="Project name"
              required
              value={form.project_name}
              onChange={(v) => update('project_name', v)}
              error={fieldError('project_name')}
              maxLength={500}
            />
            <TextField
              label="Project or organisation identifier"
              required
              value={form.org_id}
              onChange={(v) => update('org_id', v)}
              error={fieldError('org_id')}
              maxLength={500}
              hint="A stable identifier such as a registry ID or organisation code."
            />
          </fieldset>
        </Card>

        <Card className="space-y-5 p-5">
          <fieldset className="space-y-4">
            <legend className="text-sm font-semibold uppercase tracking-wider text-stone-400">
              Claim Details
            </legend>
            <SelectField
              label="Claim category"
              required
              value={form.claim_category}
              onChange={(v) => update('claim_category', v as ClaimCategory)}
              options={CLAIM_CATEGORIES.map((c) => ({ value: c.value, label: c.label }))}
              error={fieldError('claim_category')}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="Country"
                required
                value={form.country}
                onChange={(v) => update('country', v)}
                error={fieldError('country')}
                maxLength={500}
              />
              <TextField
                label="Location description"
                required
                value={form.location_description}
                onChange={(v) => update('location_description', v)}
                error={fieldError('location_description')}
                maxLength={2000}
                hint="Region, coordinates, or site description."
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <DateField
                label="Reporting period start"
                required
                value={form.reporting_period_start}
                onChange={(v) => update('reporting_period_start', v)}
                error={fieldError('reporting_period_start')}
              />
              <DateField
                label="Reporting period end"
                required
                value={form.reporting_period_end}
                onChange={(v) => update('reporting_period_end', v)}
                error={fieldError('reporting_period_end')}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <NumberField
                label="Claimed quantity"
                required
                value={form.claimed_quantity}
                onChange={(v) => update('claimed_quantity', v)}
                error={fieldError('claimed_quantity')}
                hint="Must be a positive number."
              />
              <TextField
                label="Unit"
                required
                value={form.unit}
                onChange={(v) => update('unit', v)}
                error={fieldError('unit')}
                maxLength={50}
              />
              <div className="sm:col-span-3" />
            </div>
          </fieldset>
        </Card>

        <Card className="space-y-5 p-5">
          <fieldset className="space-y-4">
            <legend className="text-sm font-semibold uppercase tracking-wider text-stone-400">
              Evidence
            </legend>
            <TextField
              label="Evidence reference or URL"
              required
              value={form.evidence_reference}
              onChange={(v) => update('evidence_reference', v)}
              error={fieldError('evidence_reference')}
              maxLength={500}
              hint="A public URL (http/https) or a verifiable reference such as a DOI."
              placeholder="https://…"
            />
            <TextAreaField
              label="Supporting evidence description"
              required
              value={form.evidence_description}
              onChange={(v) => update('evidence_description', v)}
              error={fieldError('evidence_description')}
              maxLength={2000}
              hint="Describe what the evidence contains and how it supports the claim."
            />
          </fieldset>
        </Card>

        {/* Fingerprint preview */}
        <Card className="space-y-3 p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Fingerprint className="h-4 w-4 text-emerald-400" />
              <p className="text-sm font-semibold text-stone-200">
                Evidence fingerprint preview
              </p>
            </div>
            <button
              type="button"
              onClick={computePreview}
              disabled={fingerprinting}
              className="inline-flex items-center gap-1.5 rounded-md border border-stone-600 bg-stone-800/40 px-3 py-1.5 text-xs font-medium text-stone-300 hover:bg-stone-800 disabled:opacity-60"
            >
              {fingerprinting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Compute SHA-256
            </button>
          </div>
          <p className="font-mono text-xs break-all text-stone-400">
            {liveFingerprint ? shortFingerprint(liveFingerprint) : 'Compute to preview the canonical evidence fingerprint.'}
          </p>
          <p className="text-xs text-stone-500">
            The fingerprint is a SHA-256 hash of the canonicalized evidence fields.
            Equivalent submissions produce the same fingerprint; exact duplicates are
            rejected.
          </p>
        </Card>

        {duplicate && (
          <Card className="border-red-800/60 bg-red-900/15 p-5">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
              <div className="space-y-2">
                <p className="font-semibold text-red-200">
                  Duplicate evidence detected
                </p>
                <p className="text-sm text-red-100/90">
                  This submission's canonical evidence matches existing record{' '}
                  <button
                    type="button"
                    onClick={() => navigate({ name: 'record', id: duplicate.existingRecord.id })}
                    className="font-mono underline decoration-red-500/60 underline-offset-2 hover:text-red-50"
                  >
                    {duplicate.existingRecord.id.slice(0, 8)}
                  </button>{' '}
                  ({duplicate.existingRecord.project_name}). Registering the same
                  evidence twice is prevented to keep the evidence history traceable.
                </p>
                <p className="text-xs text-red-200/70">
                  Note: fingerprint uniqueness only catches exact canonical
                  duplicates. Two different records may still describe the same
                  real-world activity — human review is still required.
                </p>
              </div>
            </div>
          </Card>
        )}

        {submitError && (
          <div className="flex items-start gap-2 rounded-lg border border-red-800/60 bg-red-900/20 p-3 text-sm text-red-200">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {submitError}
          </div>
        )}

        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate({ name: 'registry' })}
            className="rounded-lg border border-stone-600 px-4 py-2 text-sm font-medium text-stone-300 hover:bg-stone-800/60"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-600 disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" />
                Save Submission
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

interface FieldProps {
  label: string;
  required?: boolean;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  hint?: string;
  placeholder?: string;
  maxLength?: number;
}

function baseInputClasses(error?: string): string {
  return `w-full rounded-lg border bg-stone-900/60 px-3 py-2 text-sm text-stone-100 placeholder:text-stone-500 focus:outline-none focus:ring-1 ${
    error
      ? 'border-red-700 focus:border-red-500 focus:ring-red-500'
      : 'border-stone-700 focus:border-emerald-600 focus:ring-emerald-600'
  }`;
}

function FieldLabel({ label, required }: { label: string; required?: boolean }) {
  return (
    <label className="mb-1.5 block text-sm font-medium text-stone-200">
      {label}
      {required && <span className="ml-0.5 text-emerald-400">*</span>}
    </label>
  );
}

function FieldHint({ hint, error }: { hint?: string; error?: string }) {
  if (error) return <p className="mt-1 text-xs text-red-300">{error}</p>;
  if (hint) return <p className="mt-1 text-xs text-stone-500">{hint}</p>;
  return null;
}

function TextField({ label, required, value, onChange, error, hint, placeholder, maxLength }: FieldProps) {
  return (
    <div>
      <FieldLabel label={label} required={required} />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        className={baseInputClasses(error)}
      />
      <FieldHint hint={hint} error={error} />
    </div>
  );
}

function NumberField({ label, required, value, onChange, error, hint }: Omit<FieldProps, 'value' | 'onChange' | 'placeholder' | 'maxLength'> & { value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <FieldLabel label={label} required={required} />
      <input
        type="number"
        inputMode="decimal"
        step="any"
        min="0"
        value={value === 0 ? '' : value}
        onChange={(e) => {
          const raw = e.target.value;
          onChange(raw === '' ? 0 : Number(raw));
        }}
        className={baseInputClasses(error)}
      />
      <FieldHint hint={hint} error={error} />
    </div>
  );
}

function DateField({ label, required, value, onChange, error }: Omit<FieldProps, 'hint' | 'placeholder' | 'maxLength'>) {
  return (
    <div>
      <FieldLabel label={label} required={required} />
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={baseInputClasses(error)}
      />
      <FieldHint error={error} />
    </div>
  );
}

function SelectField({
  label,
  required,
  value,
  onChange,
  options,
  error,
}: FieldProps & { options: { value: string; label: string }[] }) {
  return (
    <div>
      <FieldLabel label={label} required={required} />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={baseInputClasses(error)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <FieldHint error={error} />
    </div>
  );
}

function TextAreaField({ label, required, value, onChange, error, hint, maxLength }: FieldProps) {
  return (
    <div>
      <FieldLabel label={label} required={required} />
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={maxLength}
        rows={4}
        className={`${baseInputClasses(error)} resize-y`}
      />
      <FieldHint hint={hint} error={error} />
    </div>
  );
}
