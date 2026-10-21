import type { RecordStatus, Severity } from './types';

export function formatDate(iso: string): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDateShort(iso: string): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatQuantity(value: number): string {
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 2,
  }).format(value);
}

export const STATUS_STYLES: Record<
  RecordStatus,
  { label: string; classes: string; dot: string }
> = {
  draft: {
    label: 'Draft',
    classes: 'bg-stone-700/60 text-stone-200 border-stone-600',
    dot: 'bg-stone-400',
  },
  submitted: {
    label: 'Submitted',
    classes: 'bg-emerald-900/40 text-emerald-200 border-emerald-700/60',
    dot: 'bg-emerald-400',
  },
  flagged_for_review: {
    label: 'Flagged for Review',
    classes: 'bg-red-900/40 text-red-200 border-red-700/60',
    dot: 'bg-red-400',
  },
  ready_for_human_review: {
    label: 'Ready for Human Review',
    classes: 'bg-amber-900/40 text-amber-200 border-amber-700/60',
    dot: 'bg-amber-400',
  },
};

export const SEVERITY_STYLES: Record<Severity, { label: string; classes: string }> = {
  info: {
    label: 'Info',
    classes: 'bg-sky-900/40 text-sky-200 border-sky-700/60',
  },
  warning: {
    label: 'Warning',
    classes: 'bg-amber-900/40 text-amber-200 border-amber-700/60',
  },
  error: {
    label: 'Error',
    classes: 'bg-red-900/40 text-red-200 border-red-700/60',
  },
};

export function categoryLabel(value: string): string {
  const map: Record<string, string> = {
    reforestation: 'Reforestation',
    renewable_energy: 'Renewable Energy',
    methane_reduction: 'Methane Reduction',
    energy_efficiency: 'Energy Efficiency',
    other: 'Other',
  };
  return map[value] ?? value;
}

export const AI_SUFFICIENCY_STYLES: Record<
  'insufficient' | 'limited' | 'potentially_adequate',
  { label: string; classes: string }
> = {
  insufficient: {
    label: 'Insufficient',
    classes: 'bg-red-900/40 text-red-200 border-red-700/60',
  },
  limited: {
    label: 'Limited',
    classes: 'bg-amber-900/40 text-amber-200 border-amber-700/60',
  },
  potentially_adequate: {
    label: 'Potentially Adequate',
    classes: 'bg-emerald-900/40 text-emerald-200 border-emerald-700/60',
  },
};

export const AI_STATUS_STYLES: Record<
  'completed' | 'failed' | 'unavailable',
  { label: string; classes: string; dot: string }
> = {
  completed: {
    label: 'AI Audit Completed',
    classes: 'bg-emerald-900/40 text-emerald-200 border-emerald-700/60',
    dot: 'bg-emerald-400',
  },
  failed: {
    label: 'AI Audit Failed',
    classes: 'bg-red-900/40 text-red-200 border-red-700/60',
    dot: 'bg-red-400',
  },
  unavailable: {
    label: 'AI Unavailable',
    classes: 'bg-stone-700/60 text-stone-300 border-stone-600',
    dot: 'bg-stone-400',
  },
};
