import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from './components/ui/button';
import { Field, Feedback, Modal } from './shared';
import { useAction } from './hooks';
import { useVodWindow } from './useVodWindow';
import { useProviderNames } from './useProviderNames';
import { CursorEnd } from './CursorEnd';
import type { Client } from './lib/api';
import { cursorPage, type IptvConnection, type VodMatch } from './lib/v2';

export function VodMatches({ api }: { api: Client }) {
  const scope = useRef({ api, generation: 0 });
  if (scope.current.api !== api) scope.current = { api, generation: scope.current.generation + 1 };
  return <ScopedVodMatches key={scope.current.generation} api={api} />;
}

function ScopedVodMatches({ api }: { api: Client }) {
  const saves = useRef(new AbortController());
  useEffect(() => {
    saves.current = new AbortController();
    return () => saves.current.abort();
  }, []);
  const checkedApi = useMemo<Client>(() => async <T,>(path: string, method?: string, body?: unknown, signal?: AbortSignal) => {
    const value = await api<unknown>(path, method, body, signal);
    if (method === 'GET' && path.startsWith('/v2/iptv/matches?')) {
      const page = cursorPage<VodMatch>(value);
      const ids = new Set<string>();
      for (const row of page.items) {
        if (!row || typeof row.vod_id !== 'string' || !row.vod_id || ids.has(row.vod_id) ||
            typeof row.name !== 'string' || !['movie', 'series'].includes(row.type) ||
            !/^[1-9][0-9]*$/.test(String(row.provider_id)) || row.year !== null && !Number.isSafeInteger(row.year))
          throw new Error('The server returned invalid unmatched-title data. Try again or update the server.');
        ids.add(row.vod_id);
      }
      return { ...page, previous_cursor: (value as { previous_cursor?: unknown }).previous_cursor } as T;
    }
    if (method === 'GET' && path.startsWith('/v2/iptv/connections?')) {
      const page = cursorPage<IptvConnection>(value, 200);
      if (page.items.some(row => !row || !/^[1-9][0-9]*$/.test(String(row.id)) || typeof row.name !== 'string'))
        throw new Error('The server returned invalid provider names. Try again.');
      return page as T;
    }
    return value as T;
  }, [api]);
  const providers = useProviderNames(checkedApi);
  const [provider, setProvider] = useState('');
  const [kind, setKind] = useState('');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [target, setTarget] = useState<VodMatch>();
  const [metadataDraft, setMetadataDraft] = useState('');
  const [typeDraft, setTypeDraft] = useState<'movie'|'series'>('movie');
  const [first, setFirst] = useState(0);
  const [rowHeight, setRowHeight] = useState(() => typeof matchMedia === 'function' && matchMedia('(max-width: 767px)').matches ? 184 : 112);
  const scroll = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLButtonElement | undefined>(undefined);
  const retained = useRef<{ top: number; id: string } | undefined>(undefined);
  const action = useAction();
  const path = `/v2/iptv/matches?limit=50${provider ? `&provider_id=${encodeURIComponent(provider)}` : ''}${kind ? `&kind=${kind}` : ''}${query ? `&search=${encodeURIComponent(query)}` : ''}`;
  const result = useVodWindow(checkedApi, path, !!target);
  useEffect(() => { const timer = setTimeout(() => setQuery(search.trim().slice(0, 128)), 250); return () => clearTimeout(timer); }, [search]);
  useEffect(() => { if (scroll.current) scroll.current.scrollTop = 0; setFirst(0); }, [path]);
  useEffect(() => {
    if (typeof matchMedia !== 'function') return;
    const media = matchMedia('(max-width: 767px)');
    const update = () => { setRowHeight(media.matches ? 184 : 112); setFirst(0); if (scroll.current) scroll.current.scrollTop = 0; };
    media.addEventListener('change', update); return () => media.removeEventListener('change', update);
  }, []);
  const localFirst = Math.max(0, first - result.base);
  const start = Math.max(0, localFirst - 4);
  const end = Math.min(result.items.length, localFirst + 16);
  const names = new Map(providers.items.map(item => [String(item.id), item.name]));
  useEffect(() => {
    if (target || result.loading || result.error || !result.items.length) return;
    // A scrollbar jump can land inside an evicted spacer. Refill toward it,
    // one actual adjacent page at a time, without retaining historical pages.
    if (first < result.base && result.previous) result.back();
    else if (first >= result.base + result.items.length && result.next) result.more();
  }, [first, result.base, result.items.length, result.loading, result.error, result.previous, result.next, target, result.back, result.more]);
  const close = () => {
    setTarget(undefined);setMetadataDraft(''); action.clear();
    requestAnimationFrame(() => {
      if (retained.current && scroll.current) scroll.current.scrollTop = retained.current.top;
      if (opener.current?.isConnected) opener.current.focus();
      else scroll.current?.focus();
    });
  };
  const closeDialog = useRef(close); closeDialog.current = close;
  useEffect(() => {
    if (!target) return;
    const marker = {};
    history.pushState({ ...history.state, vodMatchDialog: marker }, '');
    const pop = () => closeDialog.current();
    window.addEventListener('popstate', pop);
    return () => {
      window.removeEventListener('popstate', pop);
      if (history.state?.vodMatchDialog) history.back();
    };
  }, [!!target]);
  return <div>
    <p className="text-sm text-muted-foreground mb-6">Match your provider’s titles to metadata IDs so the right streams appear for movies and exact episodes.</p>
    <div className="admin-toolbar">
      <Field label="Search titles" value={search} maxLength={128} onChange={event => setSearch(event.target.value)} type="search" />
      <label className="grid gap-2 text-sm font-medium">Provider<select value={provider} onChange={event => setProvider(event.target.value)}><option value="">All providers</option>{providers.items.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label className="grid gap-2 text-sm font-medium">Type<select value={kind} onChange={event => setKind(event.target.value)}><option value="">All types</option><option value="movie">Movie</option><option value="series">Series</option></select></label>
    </div>
    <Feedback error={result.error || providers.error} success={!target ? action.success : ''} />
    {result.error && <Button variant="outline" onClick={result.refreshRequired ? () => { if (scroll.current) scroll.current.scrollTop = 0; setFirst(0); result.reload(); } : result.retry}>{result.refreshRequired ? 'Refresh titles' : 'Try again'}</Button>}
    {providers.error && <Button variant="outline" onClick={providers.reload}>Try again</Button>}
    <div className="admin-match-scroll" ref={scroll} role="region" aria-label="Unmatched provider titles" tabIndex={0}
      data-retained-rows={result.items.length} data-retained-pages={result.retainedPages} data-visited-extent={result.extent} data-window-base={result.base} data-cursor-slots={result.cursorSlots}
      onScroll={event => {
        const node = event.currentTarget;
        const index = Math.floor(node.scrollTop / rowHeight); setFirst(index);
        if (target || result.error) return;
        if (index <= result.base + 4 && result.previous) result.back();
        else if (index + Math.ceil(node.clientHeight / rowHeight) + 8 >= result.base + result.items.length) result.more();
      }}>
      <div aria-hidden="true" style={{ height: (result.base + start) * rowHeight }} />
      {result.items.slice(start, end).map(item => <div className="admin-match-row" data-match-id={item.vod_id} key={item.vod_id}>
        <div><h3>{item.name}</h3><p>{names.get(String(item.provider_id)) ?? `IPTV connection ${item.provider_id}`} · {item.type === 'series' ? 'Series' : 'Movie'} · {item.year ?? 'Year unavailable'}</p></div>
        <div className="admin-match-status"><span className="admin-status">{item.matched ? 'Matched' : 'Unmatched'}</span></div>
        <Button variant="outline" onClick={event => { action.clear(); opener.current = event.currentTarget; retained.current = { top: scroll.current?.scrollTop ?? 0, id: item.vod_id }; setMetadataDraft(item.metadataId??'');setTypeDraft(item.type);setTarget(item); }}>{item.matched ? 'Edit match' : 'Match title'}</Button>
      </div>)}
      <div aria-hidden="true" style={{ height: Math.max(0, result.extent - result.base - end) * rowHeight }} />
      <CursorEnd onLoad={result.more} disabled={!!target || result.loading || !!result.error || !result.next} generation={result.base + result.extent} />
      {result.loading && <p role="status" className="p-5 text-sm text-muted-foreground">Loading titles…</p>}
      {!result.loading && !result.items.length && !result.error && <div className="p-8"><h2>{query || provider || kind ? 'No matching titles' : 'No unmatched titles'}</h2><p className="text-sm text-muted-foreground mt-2">Try another filter, or wait for your provider’s next catalog refresh.</p></div>}
    </div>
    <Modal open={!!target} onOpenChange={open => { if (!open && !action.busy) close(); }} title="Match to metadata" description={target?.name ?? 'Choose a metadata ID for this title.'}>
      {target && <form className="grid gap-4" onSubmit={event => {
        event.preventDefault(); const form = event.currentTarget;
        if (!form.reportValidity() || action.busy) return;
        const fields = new FormData(form);
        const chosen = target;
        const controller = saves.current;
        void action.run(async () => {
          await api('/v2/iptv/matches', 'PUT', { vod_id: chosen.vod_id, metadata_id: String(fields.get('metadata_id')).trim(), type: fields.get('type') }, controller.signal);
          if (controller.signal.aborted) return;
          result.setItems(items => items.map(item => item.vod_id === chosen.vod_id ? { ...item, type: fields.get('type') as 'movie'|'series', matched: true, metadataId: String(fields.get('metadata_id')).trim() } : item));
          close();
        }, 'Metadata match saved');
      }}>
        <Field label="Metadata ID" name="metadata_id" value={metadataDraft} onChange={event=>setMetadataDraft(event.target.value)} placeholder="tt0133093" required maxLength={256} autoFocus />
        <label className="grid gap-2 text-sm font-medium">Type<select name="type" value={typeDraft} onChange={event=>setTypeDraft(event.target.value as 'movie'|'series')}><option value="movie">Movie</option><option value="series">Series</option></select></label>
        <Feedback error={action.error} />
        <div className="flex flex-wrap gap-3"><Button type="submit" disabled={action.busy}>{action.busy ? 'Saving…' : 'Save match'}</Button><Button type="button" variant="outline" disabled={action.busy} onClick={close}>Cancel</Button></div>
      </form>}
    </Modal>
  </div>;
}
