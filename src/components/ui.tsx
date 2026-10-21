import type { ReactNode } from 'react';

interface BadgeProps {
  children: ReactNode;
  classes: string;
  dot?: string;
}

export function Badge({ children, classes, dot }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${classes}`}
    >
      {dot && <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />}
      {children}
    </span>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-xl border border-emerald-900/40 bg-stone-900/60 ${className}`}
    >
      {children}
    </div>
  );
}

export function SectionTitle({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-stone-100">
          {title}
        </h2>
        {subtitle && (
          <p className="mt-1 text-sm text-stone-400">{subtitle}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-stone-700 bg-stone-900/40 px-6 py-14 text-center">
      <p className="text-base font-medium text-stone-200">{title}</p>
      <p className="mt-2 max-w-md text-sm text-stone-400">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function LocalPrototypeBadge() {
  return (
    <span className="inline-flex items-center rounded-md border border-amber-700/60 bg-amber-900/30 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-amber-200">
      Local Prototype
    </span>
  );
}
