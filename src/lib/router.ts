import { useEffect, useState, useCallback } from 'react';

export type Route =
  | { name: 'overview' }
  | { name: 'registry' }
  | { name: 'new-submission' }
  | { name: 'audit-history' }
  | { name: 'public-verification' }
  | { name: 'record'; id: string };

function parseHash(hash: string): Route {
  const clean = hash.replace(/^#\/?/, '');
  const parts = clean.split('/').filter(Boolean);
  if (parts.length === 0) return { name: 'overview' };
  switch (parts[0]) {
    case 'registry':
      return { name: 'registry' };
    case 'new-submission':
      return { name: 'new-submission' };
    case 'audit-history':
      return { name: 'audit-history' };
    case 'public-verification':
      return { name: 'public-verification' };
    case 'record':
      if (parts[1]) return { name: 'record', id: parts[1] };
      return { name: 'overview' };
    default:
      return { name: 'overview' };
  }
}

export function routeToHash(route: Route): string {
  switch (route.name) {
    case 'overview':
      return '#/overview';
    case 'registry':
      return '#/registry';
    case 'new-submission':
      return '#/new-submission';
    case 'audit-history':
      return '#/audit-history';
    case 'public-verification':
      return '#/public-verification';
    case 'record':
      return `#/record/${route.id}`;
  }
}

export function useRouter() {
  const [route, setRoute] = useState<Route>(() =>
    parseHash(window.location.hash)
  );

  useEffect(() => {
    const onChange = () => setRoute(parseHash(window.location.hash));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  const navigate = useCallback((next: Route) => {
    const hash = routeToHash(next);
    if (window.location.hash !== hash) {
      window.location.hash = hash;
    } else {
      setRoute(parseHash(hash));
    }
  }, []);

  return { route, navigate };
}
