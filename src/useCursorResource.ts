import { useCallback, useEffect, useRef, useState } from 'react';
import type { Client } from './lib/api';
import { cursorPage } from './lib/v2';

/** Transport paging only. Renderers virtualize retained rows and never request a total. */
export function useCursorResource<T>(api: Client, path: string) {
  const [items, setItems] = useState<T[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0);
  const generation = useRef(0);
  const pending = useRef(false);
  const priorPath = useRef<string | undefined>(undefined);
  const controller = useRef<AbortController | undefined>(undefined);
  const reload = useCallback(() => setVersion(value => value + 1), []);
  useEffect(() => {
    const ticket = ++generation.current;
    controller.current?.abort();
    const scope = new AbortController(); controller.current = scope;
    pending.current = true; setLoading(true); setError('');
    if (priorPath.current !== path) { setItems([]); setNext(null); }
    priorPath.current = path;
    void api<unknown>(path, 'GET', undefined, scope.signal).then(value => {
      if (scope.signal.aborted || ticket !== generation.current) return;
      const page = cursorPage<T>(value); setItems(page.items); setNext(page.next_cursor);
    }).catch(error => { if (!scope.signal.aborted && ticket === generation.current) setError(error instanceof Error ? error.message : 'Could not load this catalog.'); })
      .finally(() => { if (ticket === generation.current && !scope.signal.aborted) { pending.current = false; setLoading(false); } });
    return () => scope.abort();
  }, [api, path, version]);
  const more = useCallback(() => {
    if (!next || pending.current) return;
    const scope = controller.current;
    if (!scope || scope.signal.aborted) return;
    const ticket = generation.current;
    pending.current = true; setLoading(true); setError('');
    void api<unknown>(`${path}&cursor=${encodeURIComponent(next)}`, 'GET', undefined, scope.signal).then(value => {
      if (scope.signal.aborted || ticket !== generation.current) return;
      const page = cursorPage<T>(value);
      if (!page.items.length && page.next_cursor !== null || page.next_cursor === next) throw new Error('The server repeated or interrupted a catalog page. Reload to continue.');
      setItems(previous => [...previous, ...page.items]); setNext(page.next_cursor);
    }).catch(error => { if (!scope.signal.aborted && ticket === generation.current) setError(error instanceof Error ? error.message : 'Could not load more titles.'); })
      .finally(() => { if (ticket === generation.current && !scope.signal.aborted) { pending.current = false; setLoading(false); } });
  }, [api, path, next]);
  return { items, setItems, next, loading, error, reload, more };
}
