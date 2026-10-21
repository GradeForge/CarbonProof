import { useState, type ReactNode } from 'react';
import {
  LayoutDashboard,
  FileSearch,
  FilePlus2,
  History,
  ShieldCheck,
  Leaf,
  Menu,
  X,
} from 'lucide-react';
import { useRouter, type Route } from '@/lib/router';
import { LocalPrototypeBadge } from './ui';

interface NavItem {
  route: Route;
  label: string;
  icon: typeof LayoutDashboard;
}

const NAV_ITEMS: NavItem[] = [
  { route: { name: 'overview' }, label: 'Overview', icon: LayoutDashboard },
  { route: { name: 'registry' }, label: 'Evidence Registry', icon: FileSearch },
  { route: { name: 'new-submission' }, label: 'New Submission', icon: FilePlus2 },
  { route: { name: 'audit-history' }, label: 'Audit History', icon: History },
  {
    route: { name: 'public-verification' },
    label: 'Public Verification',
    icon: ShieldCheck,
  },
];

function isActive(current: Route, item: Route): boolean {
  if (current.name === item.name) return true;
  if (item.name === 'registry' && current.name === 'record') return true;
  return false;
}

export function AppShell({ children }: { children: ReactNode }) {
  const { route, navigate } = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleNavigate = (next: Route) => {
    navigate(next);
    setMobileOpen(false);
  };

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-emerald-950/60 bg-stone-900/80 px-4 py-5 lg:flex">
        <Brand />
        <nav className="mt-7 flex flex-1 flex-col gap-1">
          {NAV_ITEMS.map((item) => {
            const active = isActive(route, item.route);
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                onClick={() => handleNavigate(item.route)}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? 'bg-emerald-900/30 text-emerald-200'
                    : 'text-stone-400 hover:bg-stone-800/60 hover:text-stone-100'
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            );
          })}
        </nav>
        <SidebarFooter />
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-emerald-950/60 bg-stone-950/95 px-4 py-3 lg:hidden">
        <Brand compact />
        <button
          onClick={() => setMobileOpen((v) => !v)}
          className="rounded-md border border-stone-700 p-2 text-stone-300 hover:bg-stone-800"
          aria-label="Toggle navigation"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </header>

      {mobileOpen && (
        <div className="z-30 border-b border-emerald-950/60 bg-stone-900/95 px-4 py-3 lg:hidden">
          <nav className="flex flex-col gap-1">
            {NAV_ITEMS.map((item) => {
              const active = isActive(route, item.route);
              const Icon = item.icon;
              return (
                <button
                  key={item.label}
                  onClick={() => handleNavigate(item.route)}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium ${
                    active
                      ? 'bg-emerald-900/30 text-emerald-200'
                      : 'text-stone-300 hover:bg-stone-800/60'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>
      )}

      <main className="lg:pl-64">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
          {children}
        </div>
      </main>
    </div>
  );
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-800/40 text-emerald-300 ring-1 ring-emerald-700/50">
        <Leaf className="h-5 w-5" />
      </div>
      <div className={compact ? '' : ''}>
        <p className="text-sm font-semibold tracking-tight text-stone-100">
          CarbonProof
        </p>
        <p className="text-[11px] text-stone-500">Climate Evidence Verification</p>
      </div>
    </div>
  );
}

function SidebarFooter() {
  return (
    <div className="mt-4 space-y-2 border-t border-stone-800 pt-4">
      <LocalPrototypeBadge />
      <p className="text-[11px] leading-relaxed text-stone-500">
        Deterministic local audit. No blockchain or AI claims are made in this
        prototype.
      </p>
    </div>
  );
}
