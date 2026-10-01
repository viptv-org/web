import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, type Client } from './lib/api';
import { cursorPage, isCursorToken, isPositiveId, type VodMatch } from './lib/v2';

type Page = { items: VodMatch[]; cursor: string | null; next: string | null; previous: string | null | undefined; offset: number };
type Retained = { pages: Page[]; extent: number };
const invalidRows = () => new Error('The server returned invalid unmatched-title data. Try again or update the server.');
function vodMatch(value: unknown): VodMatch {
  const row = value as VodMatch | null;
  if (!row || typeof row.vod_id !== 'string' || !row.vod_id || typeof row.name !== 'string' || !['movie', 'series'].includes(row.type) ||
      !isPositiveId(row.provider_id) || row.year !== null && !Number.isSafeInteger(row.year)) throw invalidRows();
  return row;
}
function decode(value: unknown, cursor: string | null, offset: number): Page {
  const page = cursorPage(value, 50, vodMatch);
  if (new Set(page.items.map(item => item.vod_id)).size !== page.items.length) throw invalidRows();
  const previous = (value as { previous_cursor?: unknown }).previous_cursor;
  if (previous !== undefined && previous !== null && !isCursorToken(previous)) throw new Error('The server returned an invalid reverse cursor. Update the server.');
  if (!page.items.length && (page.next_cursor !== null || previous)) throw new Error('The server interrupted a title page. Try again.');
  return { items: page.items, cursor, next: page.next_cursor, previous: previous as Page['previous'], offset };
}

/** Three real pages; only scalar travelled extent survives eviction. */
export function useVodWindow(api: Client, path: string, paused = false) {
  const pausedNow = useRef(paused); pausedNow.current = paused;
  const [view, setView] = useState<Retained>({ pages: [], extent: 0 });
  const current = useRef(view); current.current = view;
  const [loading, setLoading] = useState(true), [error, setError] = useState('');
  const [refreshRequired, setRefreshRequired] = useState(false);
  const [version, setVersion] = useState(0);
  const generation = useRef(0), pending = useRef(false);
  const abort = useRef<AbortController | undefined>(undefined);
  const failed = useRef<'next' | 'previous' | undefined>(undefined);
  const priorPath = useRef<string | undefined>(undefined);
  const reload = useCallback(() => setVersion(v => v + 1), []);
  useEffect(() => {
    const ticket = ++generation.current;
    abort.current?.abort(); const controller = new AbortController(); abort.current = controller;
    pending.current = true; failed.current = undefined; setLoading(true); setError(''); setRefreshRequired(false);
    if (priorPath.current !== path) { const empty = { pages: [], extent: 0 }; current.current = empty; setView(empty); }
    priorPath.current = path;
    void api<unknown>(path, 'GET', undefined, controller.signal).then(value => {
      if (controller.signal.aborted || ticket !== generation.current) return;
      const page = decode(value, null, 0);
      const next = { pages: [page], extent: page.items.length }; current.current = next; setView(next);
    }).catch(e => { if (!controller.signal.aborted && ticket === generation.current) setError(e instanceof Error ? e.message : 'Could not load titles.'); })
      .finally(() => { if (!controller.signal.aborted && ticket === generation.current) { pending.current = false; setLoading(false); } });
    return () => controller.abort();
  }, [api, path, version]);
  const move = useCallback((direction: 'next' | 'previous') => {
    if (pausedNow.current || pending.current || !abort.current || abort.current.signal.aborted) return;
    const before = current.current;
    const edge = direction === 'next' ? before.pages.at(-1) : before.pages[0];
    const cursor = direction === 'next' ? edge?.next : edge?.previous;
    if (!cursor) return;
    if (before.pages.some(page => page.cursor === cursor)) { setError('The server repeated a title cursor. Reload to continue.'); return; }
    const controller = abort.current, ticket = generation.current;
    pending.current = true; setLoading(true); setError('');
    void api<unknown>(`${path}&cursor=${encodeURIComponent(cursor)}`, 'GET', undefined, controller.signal).then(value => {
      if (pausedNow.current || controller.signal.aborted || ticket !== generation.current) return;
      const incoming = decode(value, cursor, 0);
      if (!incoming.items.length || incoming.next === cursor || incoming.previous === cursor) throw new Error('The server repeated or interrupted a title page. Try again.');
      const ids = new Set(before.pages.flatMap(page => page.items.map(item => item.vod_id)));
      for (const item of incoming.items) {
        if (ids.has(item.vod_id)) throw new Error('The server repeated title rows. Try again.');
        ids.add(item.vod_id);
      }
      incoming.offset = direction === 'next' ? edge!.offset + edge!.items.length : Math.max(0, edge!.offset - incoming.items.length);
      let pages = direction === 'next' ? [...before.pages, incoming] : [incoming, ...before.pages];
      if (pages.length > 3) {
        if (direction === 'next' && !pages[1].previous) throw new Error('Update the server to continue with bounded reverse title paging.');
        pages = direction === 'next' ? pages.slice(1) : pages.slice(0, 3);
      }
      const next = { pages, extent: Math.max(before.extent, incoming.offset + incoming.items.length) };
      failed.current = undefined; current.current = next; setView(next);
    }).catch(e => { if (!controller.signal.aborted && ticket === generation.current) { failed.current = direction; setRefreshRequired(e instanceof ApiError && e.errorCode === 'catalog_changed'); setError(e instanceof Error ? e.message : 'Could not load this title page.'); } })
      .finally(() => { if (!controller.signal.aborted && ticket === generation.current) { pending.current = false; setLoading(false); } });
  }, [api, path]);
  const more = useCallback(() => move('next'), [move]);
  const previous = useCallback(() => move('previous'), [move]);
  const retry = useCallback(() => failed.current ? move(failed.current) : reload(), [move, reload]);
  const setItems = useCallback((update: (items: VodMatch[]) => VodMatch[]) => {
    setView(old => {
      const items = update(old.pages.flatMap(page => page.items)); let index = 0;
      const next = { ...old, pages: old.pages.map(page => ({ ...page, items: items.slice(index, index += page.items.length) })) };
      current.current = next; return next;
    });
  }, []);
  return { items: view.pages.flatMap(page => page.items), base: view.pages[0]?.offset ?? 0, extent: view.extent,
    retainedPages: view.pages.length, cursorSlots: view.pages.reduce((count, page) => count + Number(!!page.cursor) + Number(!!page.next) + Number(!!page.previous), 0),
    next: view.pages.at(-1)?.next ?? null, previous: view.pages[0]?.previous ?? null,
    loading, error, refreshRequired, more, back: previous, retry, reload, setItems };
}
