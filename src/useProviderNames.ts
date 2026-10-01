import { useCallback, useEffect, useRef, useState } from 'react';
import type { Client } from './lib/api';
import { cursorPage, isPositiveId, type IptvConnection } from './lib/v2';

function provider(value: unknown): IptvConnection {
  const row = value as IptvConnection | null;
  if (!row || !isPositiveId(row.id) || typeof row.name !== 'string') throw new Error('The server returned invalid provider names. Try again.');
  return { ...row, id: String(row.id) };
}

/** Small provider metadata, not VOD rows; every owned metadata cursor is followed. */
export function useProviderNames(api: Client) {
  const [items, setItems] = useState<IptvConnection[]>([]), [error, setError] = useState('');
  const [version, setVersion] = useState(0); const generation = useRef(0);
  const priorApi = useRef<Client | undefined>(undefined);
  const reload = useCallback(() => setVersion(v => v + 1), []);
  useEffect(() => {
    const ticket = ++generation.current, controller = new AbortController(); setError('');
    if (priorApi.current !== api) setItems([]);
    priorApi.current = api;
    void (async () => {
      const rows: IptvConnection[] = [], ids = new Set<string>(), cursors = new Set<string>();
      let cursor: string | null = null;
      do {
        const page: { items: IptvConnection[]; next_cursor: string | null } = cursorPage(await api<unknown>(`/v2/iptv/connections?limit=200${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`, 'GET', undefined, controller.signal), 200, provider);
        if (controller.signal.aborted || ticket !== generation.current) return;
        if (!page.items.length && page.next_cursor) throw new Error('The provider page was interrupted. Try again.');
        for (const row of page.items) { const id = row.id; if (ids.has(id)) throw new Error('The server repeated provider metadata. Try again.'); ids.add(id); rows.push(row); }
        if (page.next_cursor && cursors.has(page.next_cursor)) throw new Error('The server repeated a provider cursor. Try again.');
        cursor = page.next_cursor; if (cursor) cursors.add(cursor);
        setItems([...rows]);
      } while (cursor);
    })().catch(e => { if (!controller.signal.aborted && ticket === generation.current) setError(e instanceof Error ? e.message : 'Could not load provider names.'); });
    return () => controller.abort();
  }, [api, version]);
  return { items, error, reload };
}
