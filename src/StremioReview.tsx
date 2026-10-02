import { useEffect, useMemo, useState } from 'react';
import { Film, Tv, Puzzle } from 'lucide-react';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';

export type Counts = Record<string, number>;
export type Action = 'add' | 'update' | 'preserve' | 'already_imported' | 'none';
export type ReviewItem = {
  item_id: string; name: string; type: 'movie' | 'series';
  favorite_action: Action; progress_action: Action; status: 'ready' | 'preserved' | 'needs_review';
  reason?: string; season?: number; episode?: number; position?: number; duration?: number;
  watched?: boolean; watch_date_known?: boolean; counts: Counts; selectable: boolean;
};
export type AddonItem = { item_id: string; name: string; resources: string[]; status: 'add' | 'existing' | 'unavailable'; reason?: string };
export const rowCountKeys = ['favorites_to_add', 'progress_to_add', 'progress_to_update', 'existing_preserved', 'already_imported'] as const;
const actions: Record<Action, string> = { add: 'Add', update: 'Update older entry', preserve: 'Keep existing entry', already_imported: 'Already imported', none: 'No change' };
const states = { ready: 'Ready to import', preserved: 'Preserving existing data', needs_review: 'Needs review — left unchanged' };
export function reasonText(code?: string) {
  const reasons: Record<string, string> = {
    metadata_unavailable: 'Compatible metadata could not be verified.',
    unsupported_identity: 'The title identity could not be verified with the available metadata.',
    unmatched_identity: 'The title identity could not be verified with the available metadata.',
    ambiguous_identity: 'Conflicting title identities need manual review.',
    episode_metadata_missing: 'The episode could not be verified against its series metadata.',
    watched_anchor_missing: 'The watched flags do not align with the verified episode list.',
    watch_date_unknown: 'Watched state is known, but the episode watch date is unavailable. Left unchanged.',
    invalid_progress: 'The resume position or date could not be verified.',
    addon_unavailable: 'This add-on could not be safely verified.',
    secret_store_not_configured: 'Encrypted configuration storage is unavailable.',
    vault_unavailable: 'Encrypted configuration storage is unavailable.',
    unsupported_transport: 'This add-on uses an unsupported connection method.',
  };
  return reasons[code ?? ''] ?? 'This entry needs more verified information and will be left unchanged.';
}
export function selectedCounts(summary: Counts, items: ReviewItem[], excluded: Set<string>): Counts {
  const result = { ...summary };
  for (const item of items) if (excluded.has(item.item_id)) for (const key of rowCountKeys) result[key] = Math.max(0, result[key] - item.counts[key]);
  return result;
}
const time = (seconds: number) => `${Math.floor(seconds / 60)}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`;

export function AddonReview({ items, selected, onChange, disabled, failed = new Set<string>() }: { items: AddonItem[]; selected: Set<string>; onChange: (value: Set<string>) => void; disabled: boolean; failed?: ReadonlySet<string> }) {
  return <div className="space-y-3">
    <p className="text-sm text-muted-foreground">Metadata add-ons can help verify titles and episode identities. Stream-only add-ons do not supply episode metadata.</p>
    {items.length === 0 && <p role="status">No Stremio add-ons were found. Your existing account add-ons can still assist.</p>}
    {items.map(item => <label key={item.item_id} className="flex min-w-0 items-start gap-3 rounded-lg border p-4">
      <input type="checkbox" className="mt-1 shrink-0" aria-label={`Use add-on ${item.name}`} checked={selected.has(item.item_id)} disabled={disabled || item.status === 'unavailable'} onChange={event => { const next = new Set(selected); if (event.target.checked) next.add(item.item_id); else next.delete(item.item_id); onChange(next); }}/>
      <Puzzle size={20} aria-hidden="true" className="mt-1 shrink-0 text-muted-foreground"/>
      <span className="grid min-w-0 gap-2 text-sm"><strong className="break-words [overflow-wrap:anywhere]">{item.name}</strong><span>{item.status === 'existing' ? 'Already configured in your account' : item.status === 'add' ? 'Add to your account on confirmation' : 'Unavailable — not added'}</span><span className="text-muted-foreground">{item.resources.includes('meta') ? 'Metadata available' : 'No metadata resource'}{item.resources.includes('stream') ? ' · Stream resource' : ''}</span>{item.status === 'unavailable' && <span className="text-muted-foreground">{reasonText(item.reason)}</span>}{failed.has(item.item_id) && <span className="text-destructive">Could not verify this add-on. Uncheck it or continue without add-ons.</span>}</span>
    </label>)}
    <p className="text-sm text-muted-foreground">Selected new add-ons are account-wide, not limited to this profile. Their private configuration is encrypted and is never shown here. Nothing is added until final confirmation.</p>
  </div>;
}

export function ItemReview({ items, excluded, onChange, disabled }: { items: ReviewItem[]; excluded: Set<string>; onChange: (value: Set<string>) => void; disabled: boolean }) {
  const [search, setSearch] = useState(''); const [filter, setFilter] = useState('all'); const [page, setPage] = useState(0);
  const filtered = useMemo(() => items.filter(item => item.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()) && (filter === 'all' || filter === item.status || (filter === 'selected' && item.selectable && !excluded.has(item.item_id)) || (filter === 'excluded' && excluded.has(item.item_id)))), [items, search, filter, excluded]);
  useEffect(() => setPage(0), [search, filter]);
  const pages = Math.max(1, Math.ceil(filtered.length / 50)); const current = Math.min(page, pages - 1);
  const visible = filtered.slice(current * 50, (current + 1) * 50);
  const included = items.filter(item => item.selectable && !excluded.has(item.item_id)).length;
  function change(rows: ReviewItem[], include: boolean) { const next = new Set(excluded); for (const row of rows) if (row.selectable) { if (include) next.delete(row.item_id); else next.add(row.item_id); } onChange(next); }
  return <section className="space-y-4" aria-label="Items to review">
    <p className="text-sm" role="status">{included} review items included · {excluded.size} excluded · {items.length} shown in this preview</p>
    <div className="grid min-w-0 gap-3 sm:grid-cols-2"><label className="grid min-w-0 gap-2 text-sm font-medium"><span>Find a title</span><Input type="search" maxLength={120} autoComplete="off" value={search} onChange={event => setSearch(event.target.value)} disabled={disabled}/></label><label className="grid min-w-0 gap-2 text-sm font-medium"><span>Show items</span><select className="h-12 min-w-0 rounded-md border bg-muted px-3" value={filter} disabled={disabled} onChange={event => setFilter(event.target.value)}><option value="all">All items</option><option value="ready">Ready to import</option><option value="preserved">Preserving existing data</option><option value="needs_review">Needs review / unmatched</option><option value="selected">Included items</option><option value="excluded">Excluded items</option></select></label></div>
    <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={disabled} onClick={() => change(items, true)}>Include all</Button><Button variant="outline" disabled={disabled} onClick={() => change(items, false)}>Exclude all</Button><Button variant="outline" disabled={disabled || !filtered.some(item => item.selectable)} onClick={() => change(filtered, true)}>Include matching</Button><Button variant="outline" disabled={disabled || !filtered.some(item => item.selectable)} onClick={() => change(filtered, false)}>Exclude matching</Button></div>
    {visible.length === 0 && <p role="status">{items.length ? 'No items match this filter.' : 'No supported items were found.'}</p>}
    <div role="region" aria-label="Review results" tabIndex={0} className="max-h-[min(60vh,36rem)] space-y-3 overflow-y-auto overscroll-contain pr-1 focus-visible:outline-2 focus-visible:outline-ring">{visible.map(item => {
      const checked = item.selectable && !excluded.has(item.item_id); const Icon = item.type === 'series' ? Tv : Film;
      return <label key={item.item_id} className={`flex min-w-0 items-start gap-3 rounded-lg border p-4 ${item.selectable && !checked ? 'opacity-60' : ''}`}>
        <input type="checkbox" className="mt-1 shrink-0" aria-label={`Include ${item.name}${item.season != null && item.episode != null ? ` season ${item.season} episode ${item.episode}` : ''}`} checked={checked} disabled={disabled || !item.selectable} onChange={event => change([item], event.target.checked)}/>
        <Icon size={20} aria-hidden="true" className="mt-1 shrink-0 text-muted-foreground"/>
        <span className="grid min-w-0 gap-2 text-sm"><strong className="break-words [overflow-wrap:anywhere]">{item.name}</strong><span className="text-muted-foreground">{item.type === 'series' ? 'Series' : 'Movie'}{item.season != null && item.episode != null ? ` · Season ${item.season}, episode ${item.episode}` : ''}</span><span className={item.status === 'needs_review' ? 'text-muted-foreground' : ''}>{checked ? states[item.status] : item.selectable ? 'Excluded — will not be imported' : states[item.status]}</span>
          {item.favorite_action !== 'none' && <span>My List: {actions[item.favorite_action]}</span>}{item.progress_action !== 'none' && <span>History/resume: {actions[item.progress_action]}</span>}
          {item.position != null && item.duration != null && item.duration > 0 && <span className="text-muted-foreground">Resume {time(item.position)} of {time(item.duration)}</span>}
          {item.watched && <span className="text-muted-foreground">Watched{item.watch_date_known === false ? ' · watch date unavailable' : ''}</span>}{item.status === 'needs_review' && <span className="text-muted-foreground">{reasonText(item.reason)}</span>}
        </span>
      </label>;
    })}</div>
    {pages > 1 && <div className="flex flex-wrap items-center justify-between gap-3"><Button variant="outline" disabled={disabled || current === 0} onClick={() => setPage(current - 1)}>Previous items</Button><span className="text-sm">Page {current + 1} of {pages} · {filtered.length} matching</span><Button variant="outline" disabled={disabled || current + 1 >= pages} onClick={() => setPage(current + 1)}>Next items</Button></div>}
    <p className="text-sm text-muted-foreground">Excluding an item only limits this import. It never removes anything from Stremio or VIPTV. Entries needing review remain unchanged.</p>
  </section>;
}
