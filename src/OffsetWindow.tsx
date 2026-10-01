import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { CursorEnd } from './CursorEnd';
import { Feedback } from './shared';
import type { Client } from './lib/api';

export type OffsetPage<T> = { items: T[]; more: boolean; total?: number };
/** `{items,total,next_offset}` pages from the profile library endpoints. */
export function libraryPage<T>(value: unknown): OffsetPage<T> {
  const page = value as { items?: unknown; total?: unknown; next_offset?: unknown } | null;
  if (!page || !Array.isArray(page.items) || page.items.length > 100 || !Number.isSafeInteger(page.total) ||
      !(page.next_offset === null || Number.isSafeInteger(page.next_offset)))
    throw new Error('The server returned an invalid list page. Try again or update the server.');
  return { items: page.items as T[], more: page.next_offset !== null, total: page.total as number };
}
type Retained<T> = { items: T[]; start: number; end: number; more: boolean; total?: number };
type Options<T> = {
  keyOf: (item: T) => string;
  decode: (value: unknown) => OffsetPage<T>;
  /** Rows per request. A fixed-size endpoint ignores `limit` and accepts only `offset`. */
  limit: number;
  fixedSize?: boolean;
  /** Most rows kept in memory and in the DOM; older pages are evicted and reloaded on demand. */
  retain: number;
};

/** Library-style offset list: pages load as the reader nears either edge, never by a pager control. */
export function useOffsetWindow<T>(api: Client, path: string, options: Options<T>) {
  const settings = useRef(options); settings.current = options;
  const empty: Retained<T> = { items: [], start: 0, end: 0, more: false };
  const [state, setState] = useState<Retained<T>>(empty);
  const current = useRef(state);
  const [loading, setLoading] = useState(true), [error, setError] = useState('');
  const [version, setVersion] = useState(0), [edge, setEdge] = useState<'start' | 'end'>('end');
  const generation = useRef(0), edits = useRef(0), pending = useRef(false);
  const abort = useRef<AbortController | undefined>(undefined);
  const failed = useRef<'next' | 'previous' | undefined>(undefined);
  const priorPath = useRef<string | undefined>(undefined);
  const commit = (next: Retained<T>) => { current.current = next; setState(next); };
  const fetchPage = useCallback((offset: number, size: number, signal: AbortSignal) => {
    const { limit, fixedSize, decode } = settings.current;
    const url = fixedSize ? (offset ? `${path}?offset=${offset}` : path) : `${path}?limit=${Math.min(size, limit)}&offset=${offset}`;
    return api<unknown>(url, 'GET', undefined, signal).then(decode);
  }, [api, path]);
  const unique = (rows: T[], seen: Set<string>) => rows.filter(row => {
    const key = settings.current.keyOf(row); if (seen.has(key)) return false; seen.add(key); return true;
  });
  const reload = useCallback(() => setVersion(value => value + 1), []);
  useEffect(() => {
    const ticket = ++generation.current;
    abort.current?.abort(); const controller = new AbortController(); abort.current = controller;
    pending.current = true; failed.current = undefined; setEdge('end'); setLoading(true); setError('');
    if (priorPath.current !== path) commit(empty);
    priorPath.current = path;
    void fetchPage(0, settings.current.limit, controller.signal).then(page => {
      if (controller.signal.aborted || ticket !== generation.current) return;
      edits.current++;
      commit({ items: unique(page.items, new Set()), start: 0, end: page.items.length, more: page.more, total: page.total });
    }).catch(e => { if (!controller.signal.aborted && ticket === generation.current) setError(e instanceof Error ? e.message : 'Could not load this list.'); })
      .finally(() => { if (!controller.signal.aborted && ticket === generation.current) { pending.current = false; setLoading(false); } });
    return () => controller.abort();
  }, [fetchPage, path, version]);
  const move = useCallback((direction: 'next' | 'previous') => {
    const controller = abort.current;
    if (pending.current || !controller || controller.signal.aborted) return;
    const before = current.current, { limit, retain } = settings.current;
    if (direction === 'next' ? !before.more : before.start === 0) return;
    const offset = direction === 'next' ? before.end : Math.max(0, before.start - limit);
    const size = direction === 'next' ? limit : before.start - offset;
    const ticket = generation.current, epoch = edits.current;
    pending.current = true; setEdge(direction === 'next' ? 'end' : 'start'); setLoading(true); setError('');
    void fetchPage(offset, size, controller.signal).then(page => {
      // A local edit shifted server offsets; drop this page and let the edge sentinel ask again.
      if (controller.signal.aborted || ticket !== generation.current || epoch !== edits.current) return;
      if (!page.items.length && (direction === 'previous' || page.more)) throw new Error('The server interrupted this list. Try again.');
      const seen = new Set(before.items.map(settings.current.keyOf));
      let next: Retained<T>;
      if (direction === 'next') {
        let items = [...before.items, ...unique(page.items, seen)], start = before.start;
        const excess = items.length - retain;
        if (excess > 0) { items = items.slice(excess); start += excess; }
        next = { items, start, end: offset + page.items.length, more: page.more, total: page.total ?? before.total };
      } else {
        let items = [...unique(page.items.slice(0, size), seen), ...before.items], end = before.end, more = before.more;
        const excess = items.length - retain;
        if (excess > 0) { items = items.slice(0, retain); end -= excess; more = true; }
        next = { items, start: offset, end, more, total: page.total ?? before.total };
      }
      edits.current++; failed.current = undefined; commit(next);
    }).catch(e => { if (!controller.signal.aborted && ticket === generation.current && epoch === edits.current) { failed.current = direction; setError(e instanceof Error ? e.message : 'Could not load more of this list.'); } })
      .finally(() => { if (!controller.signal.aborted && ticket === generation.current) { pending.current = false; setLoading(false); } });
  }, [fetchPage]);
  /** Apply a confirmed local change; inserted or removed rows shift later server offsets. */
  const update = useCallback((change: (items: T[], start: number) => T[]) => {
    const before = current.current, items = change(before.items, before.start), delta = items.length - before.items.length;
    edits.current++;
    commit({ ...before, items, end: before.end + delta, total: before.total === undefined ? undefined : Math.max(0, before.total + delta) });
  }, []);
  const more = useCallback(() => move('next'), [move]);
  const back = useCallback(() => move('previous'), [move]);
  const retry = useCallback(() => failed.current ? move(failed.current) : reload(), [move, reload]);
  return { items: state.items, start: state.start, end: state.end, total: state.total, hasNext: state.more, hasPrevious: state.start > 0,
    loading, loadingEdge: loading ? edge : undefined, error, more, back, retry, reload, update };
}
export type OffsetWindow<T> = ReturnType<typeof useOffsetWindow<T>>;

function scrollRoot(node: HTMLElement): HTMLElement | null {
  let root = node.parentElement;
  while (root && !['auto', 'scroll'].includes(getComputedStyle(root).overflowY)) root = root.parentElement;
  return root;
}

/**
 * Renders the retained rows between two auto-loading edges: a skeleton first,
 * then a "Loading more…" spinner row at the loading edge, never a pager control.
 * When rows above the reader are evicted or loaded, the first visible row keeps
 * its screen position.
 */
export function OffsetWindowList<T>({ list, keyOf, label, className, rowsClassName, loadingLabel, children }: {
  list: OffsetWindow<T>; keyOf: (item: T) => string; label: string; className?: string; rowsClassName?: string; loadingLabel: string; children: (item: T) => ReactNode;
}) {
  const rows = useRef<HTMLUListElement>(null);
  const anchor = useRef<{ key: string; top: number } | undefined>(undefined);
  const remember = useCallback(() => {
    const node = rows.current; if (!node) return;
    const root = scrollRoot(node), top = root ? root.getBoundingClientRect().top : 0;
    anchor.current = undefined;
    for (const row of node.children as HTMLCollectionOf<HTMLElement>) {
      const rect = row.getBoundingClientRect();
      if (rect.bottom > top) { anchor.current = { key: row.dataset.windowKey!, top: rect.top }; return; }
    }
  }, []);
  useLayoutEffect(() => {
    const node = rows.current, saved = anchor.current;
    if (node && saved) {
      const row = [...node.children as HTMLCollectionOf<HTMLElement>].find(item => item.dataset.windowKey === saved.key);
      const shift = row ? row.getBoundingClientRect().top - saved.top : 0;
      if (shift) { const root = scrollRoot(node); if (root) root.scrollTop += shift; else window.scrollBy(0, shift); }
    }
    remember();
  }, [list.items, list.loadingEdge, remember]);
  useEffect(() => {
    const node = rows.current; if (!node) return;
    const target: HTMLElement | Window = scrollRoot(node) ?? window;
    target.addEventListener('scroll', remember, { passive: true }); window.addEventListener('resize', remember);
    return () => { target.removeEventListener('scroll', remember); window.removeEventListener('resize', remember); };
  }, [remember]);
  const loadingMore = (where: 'start' | 'end') => list.loadingEdge === where && !!list.items.length &&
    <div role="status" className="flex items-center justify-center gap-2.5 py-4 text-[13px] text-muted-foreground">
      <span aria-hidden="true" className="size-3 shrink-0 animate-spin rounded-full border-2 border-muted border-t-primary"/>
      {loadingLabel}{list.total !== undefined && ` ${Math.min(list.end, list.total)} of ${list.total}`}</div>;
  return <>
    <div className={className} style={{ overflowAnchor: 'none' }}>
      <CursorEnd onLoad={list.back} disabled={!list.hasPrevious || list.loading || !!list.error} generation={list.start}/>
      {loadingMore('start')}
      <ul ref={rows} aria-label={label} className={rowsClassName}>{list.items.map(item => { const key = keyOf(item); return <li key={key} data-window-key={key} className="min-w-0">{children(item)}</li>; })}</ul>
      {loadingMore('end')}
      <CursorEnd onLoad={list.more} disabled={!list.hasNext || list.loading || !!list.error} generation={list.end}/>
    </div>
    {list.loading && !list.items.length && <div role="status" aria-label="Loading" className="space-y-4"><div className="h-16 rounded-md bg-muted animate-pulse"/><div className="h-16 rounded-md bg-muted animate-pulse"/></div>}
    {list.error && <div className="space-y-3"><Feedback error={list.error}/><Button variant="outline" onClick={list.retry}>Try again</Button></div>}
  </>;
}
