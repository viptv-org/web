import { useEffect, useState } from 'react';
import { Puzzle, Server } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Empty, Feedback, Field, Modal, Submit, words } from './shared';
import { useAction } from './hooks';
import { useCursorResource } from './useCursorResource';
import { encode, safeImage, type Client } from './lib/api';
import { isPositiveId, type IptvConnection } from './lib/v2';
import { displayError } from './lib/displayError';
import { CursorEnd } from './CursorEnd';

const invalid = () => new Error('The server returned invalid connection settings. Try again or update the server.');
const connectionKey = (item: IptvConnection) => item.id;
function connection(value: unknown): IptvConnection {
  const row = value as IptvConnection;
  if (!row || !isPositiveId(row.id) || typeof row.name !== 'string' ||
      ['enabled', 'enable_live', 'enable_movies', 'enable_series', 'credentials_encrypted'].some(key => typeof row[key as keyof IptvConnection] !== 'boolean') ||
      !row.refresh || typeof row.refresh.state !== 'string') throw invalid();
  return { id: String(row.id), name: row.name, enabled: row.enabled, enable_live: row.enable_live,
    enable_movies: row.enable_movies, enable_series: row.enable_series, credentials_encrypted: row.credentials_encrypted,
    refresh: { state: row.refresh.state, error: row.refresh.error ? displayError(row.refresh.error, 503) : null } };
}
function Paging({ resource, label }: { resource: Pick<ReturnType<typeof useCursorResource<unknown>>, 'items' | 'error' | 'loading' | 'reload' | 'next' | 'more'>; label: string }) {
  return <><Feedback error={resource.error}/>{resource.loading && <p role="status">{label}</p>}{resource.error && <Button variant="outline" onClick={resource.reload}>Try again</Button>}<CursorEnd onLoad={resource.more} disabled={!resource.next || resource.loading || !!resource.error} generation={resource.items.length}/></>;
}
type Scopes = Pick<IptvConnection, 'enabled' | 'enable_live' | 'enable_movies' | 'enable_series'>;
const allScopes: Scopes = { enabled: true, enable_live: true, enable_movies: true, enable_series: true };
function ScopeFields({ value, change, disabled }: { value: Scopes; change: (value: Scopes) => void; disabled: boolean }) {
  return <fieldset disabled={disabled} className="grid gap-3"><legend className="mb-2 text-sm font-medium">Available content</legend>{([
    ['enabled', 'Connection enabled'], ['enable_live', 'Live TV'], ['enable_movies', 'Movies'], ['enable_series', 'Series'],
  ] as const).map(([key, label]) => <label key={key} className="flex items-center gap-3"><input type="checkbox" checked={value[key]} onChange={event => change({ ...value, [key]: event.target.checked })}/>{label}</label>)}</fieldset>;
}

export function V2Connections({ api }: { api: Client }) {
  const resource = useCursorResource<IptvConnection>(api, '/v2/iptv/connections?limit=50', connectionKey, connection);
  const action = useAction();
  const [defaultLive, setDefaultLive] = useState<string | null>(null); const [defaultError, setDefaultError] = useState('');
  const [defaultVersion, setDefaultVersion] = useState(0);
  const [mode, setMode] = useState<'create' | 'edit' | 'password' | 'delete' | 'default'>();
  const [selected, setSelected] = useState<IptvConnection>(); const [scopes, setScopes] = useState<Scopes>(allScopes);
  const [draft, setDraft] = useState({ name: '', url: '', username: '', password: '' });
  useEffect(() => {
    const abort = new AbortController(); setDefaultError('');
    void api<{ catalog_id: number | string | null }>('/v2/iptv/live-default', 'GET', undefined, abort.signal).then(value => {
      if (!value || !(value.catalog_id === null || ['number', 'string'].includes(typeof value.catalog_id))) throw invalid();
      if (!abort.signal.aborted) setDefaultLive(value.catalog_id === null ? null : String(value.catalog_id));
    }).catch(error => { if (!abort.signal.aborted) setDefaultError(error instanceof Error ? error.message : 'Could not load the default live playlist.'); });
    return () => abort.abort();
  }, [api, defaultVersion]);
  function open(next: typeof mode, row?: IptvConnection) {
    action.clear(); setSelected(row); setMode(next); setDraft({ name: next === 'edit' ? row?.name ?? '' : '', url: '', username: '', password: '' });
    setScopes(row ? { enabled: row.enabled, enable_live: row.enable_live, enable_movies: row.enable_movies, enable_series: row.enable_series } : allScopes);
  }
  function close() { setMode(undefined); setDraft({ name: '', url: '', username: '', password: '' }); }
  function save() {
    void action.run(async () => {
      const path = `/v2/iptv/connections${selected ? `/${encode(selected.id)}` : ''}`;
      if (mode === 'delete') { await api(path, 'DELETE'); resource.setItems(rows => rows.filter(row => row.id !== selected!.id)); setDefaultVersion(value => value + 1); }
      else if (mode === 'default') { const result = await api<{catalog_id: number | string}>('/v2/iptv/live-default', 'PUT', { catalog_id: Number(selected!.id) }); setDefaultLive(String(result.catalog_id)); }
      else {
        const value = mode === 'password' ? await api(`${path}/credentials`, 'PUT', { password: draft.password }) :
          await api(path, mode === 'create' ? 'POST' : 'PATCH', mode === 'create' ? { ...draft, ...scopes } : { name: draft.name, ...scopes });
        const row = connection(value); resource.setItems(rows => selected ? rows.map(old => old.id === row.id ? row : old) : [row, ...rows]);
        setDefaultVersion(value => value + 1);
      }
      close();
    }, mode === 'default' ? 'Default live playlist saved.' : mode === 'delete' ? 'Connection removed.' : 'Connection saved.');
  }
  return <div className="space-y-4"><div className="admin-toolbar"><p>Your IPTV connections and live playlist.</p><Button disabled={action.busy} onClick={() => open('create')}>Add Xtream connection</Button><Button variant="outline" disabled={resource.loading} onClick={() => { resource.reload(); setDefaultVersion(value => value + 1); }}>Refresh list</Button></div>
    <Feedback error={action.error} success={action.success}/><Feedback error={defaultError}/>{defaultError && <Button variant="outline" onClick={() => setDefaultVersion(value => value + 1)}>Retry default playlist</Button>}
    {resource.items.map(row => <Card key={row.id} className="admin-state-row"><Server className="admin-row-icon" aria-hidden="true"/><div className="admin-row-main"><div><h3>{row.name}</h3><p className="admin-status">{row.enabled ? 'Enabled' : 'Disabled'} · Sync: {words(row.refresh.state)}{defaultLive === row.id && ' · Default live playlist'}</p><p>{[row.enable_live && 'Live TV', row.enable_movies && 'Movies', row.enable_series && 'Series'].filter(Boolean).join(' · ') || 'No content enabled'}</p>{row.refresh.error && <p role="alert">{displayError(row.refresh.error, 503)}</p>}{!row.credentials_encrypted && <p>Operator migration required before this connection can be changed.</p>}</div></div>
      <div className="admin-row-actions"><Button variant="outline" disabled={action.busy || !row.credentials_encrypted} onClick={() => open('edit', row)} aria-label={`Edit ${row.name}`}>Edit</Button><Button variant="outline" disabled={action.busy || !row.credentials_encrypted} onClick={() => open('password', row)} aria-label={`Replace password for ${row.name}`}>Replace password</Button><Button variant="outline" disabled={action.busy || !row.credentials_encrypted || ['queued', 'running'].includes(row.refresh.state)} onClick={() => action.run(async () => {
        const state = await api<IptvConnection['refresh']>(`/v2/iptv/connections/${encode(row.id)}/refresh`, 'POST');
        if (!state || typeof state.state !== 'string') throw invalid();
        resource.setItems(rows => rows.map(old => old.id === row.id ? { ...old, refresh: state } : old));
      }, 'Sync requested. Refresh the list to check progress.')} aria-label={`Sync ${row.name}`}>Sync now</Button>
      {row.enabled && row.enable_live && defaultLive !== row.id && <Button variant="outline" disabled={action.busy} onClick={() => open('default', row)} aria-label={`Use ${row.name} as default live playlist`}>Use as default live</Button>}<Button variant="outline" disabled={action.busy || !row.credentials_encrypted} onClick={() => open('delete', row)} aria-label={`Delete ${row.name}`}>Delete</Button></div></Card>)}
    {!resource.loading && !resource.error && !resource.items.length && <Empty title="No Xtream connections">Add a connection to browse your IPTV catalog.</Empty>}<Paging resource={resource} label="Loading connections…"/>
    <Modal open={!!mode} onOpenChange={value => { if (!value) close(); }} title={mode === 'create' ? 'Add Xtream connection' : mode === 'edit' ? 'Edit connection' : mode === 'password' ? 'Replace password' : mode === 'default' ? 'Change default live playlist' : 'Delete connection'} description={mode === 'delete' ? `Remove ${selected?.name}? Its catalog and active sources become unavailable. Viewing history is retained.` : mode === 'default' ? `Use ${selected?.name} for future default live browsing. Current playback continues.` : 'Credentials are private. Stored passwords and server addresses are never filled in.'}>
      <form className="grid gap-4" onSubmit={event => { event.preventDefault(); save(); }}><fieldset disabled={action.busy} className="grid min-w-0 gap-4">
        {(mode === 'create' || mode === 'edit') && <Field label="Connection name" required maxLength={200} value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })}/>}
        {mode === 'create' && <><Field label="Server URL" type="url" required value={draft.url} onChange={event => setDraft({ ...draft, url: event.target.value })}/><Field label="Username" required autoComplete="off" value={draft.username} onChange={event => setDraft({ ...draft, username: event.target.value })}/></>}
        {(mode === 'create' || mode === 'password') && <Field label="Password" type="password" autoComplete="new-password" required maxLength={2048} value={draft.password} onChange={event => setDraft({ ...draft, password: event.target.value })}/>}
        {(mode === 'create' || mode === 'edit') && <ScopeFields value={scopes} change={setScopes} disabled={action.busy}/>}</fieldset><Feedback error={action.error}/><div className="flex flex-wrap gap-3"><Submit busy={action.busy}>{mode === 'delete' ? 'Delete connection' : mode === 'default' ? 'Use this playlist' : mode === 'password' ? 'Replace password' : 'Save connection'}</Submit><Button variant="outline" type="button" onClick={close}>Cancel</Button></div></form>
    </Modal></div>;
}

type Addon = { id: string; name: string; enabled: boolean; logo?: string | null; credentials_encrypted: boolean; configuration_error?: string | null };
const addonKey = (item: Addon) => item.id;
function addon(value: unknown): Addon {
  const row = value as Addon;
  if (!row || !isPositiveId(row.id) || typeof row.name !== 'string' || typeof row.enabled !== 'boolean' || typeof row.credentials_encrypted !== 'boolean') throw invalid();
  return { id: String(row.id), name: row.name, enabled: row.enabled, credentials_encrypted: row.credentials_encrypted, logo: typeof row.logo === 'string' ? safeImage(row.logo) : null,
    configuration_error: typeof row.configuration_error === 'string' ? displayError(row.configuration_error, 503) : null };
}
function AddonIcon({ logo }: { logo?: string | null }) {
  const [failed, setFailed] = useState(false);
  return logo && !failed ? <img className="admin-row-icon" src={logo} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)}/> : <Puzzle className="admin-row-icon" aria-hidden="true"/>;
}
export function V2Addons({ api }: { api: Client }) {
  const resource = useCursorResource<Addon>(api, '/v2/addons?limit=50', addonKey, addon); const action = useAction();
  const [open, setOpen] = useState(false); const [remove, setRemove] = useState<Addon>(); const [url, setUrl] = useState('');
  function close() { setOpen(false); setRemove(undefined); setUrl(''); }
  return <div className="space-y-4"><div className="admin-toolbar"><p>Your account’s catalog add-ons.</p><Button disabled={action.busy} onClick={() => { action.clear(); setOpen(true); }}>Add add-on</Button><Button variant="outline" disabled={resource.loading} onClick={resource.reload}>Refresh list</Button></div><Feedback error={action.error} success={action.success}/>
    {resource.items.map(row => <Card className="admin-state-row" key={row.id}><AddonIcon logo={row.logo}/><div className="admin-row-main"><div><h3>{row.name}</h3><p className="admin-status">{row.enabled ? 'Enabled' : 'Disabled'}</p>{!row.credentials_encrypted && <p>Operator migration required before updating this add-on.</p>}<Feedback error={row.configuration_error??undefined}/></div></div><div className="admin-row-actions"><Button variant="outline" role="switch" aria-checked={row.enabled} aria-label={`Enable ${row.name}`} disabled={action.busy} onClick={() => action.run(async () => {
      const updated = addon(await api(`/v2/addons/${encode(row.id)}`, 'PATCH', { enabled: !row.enabled })); resource.setItems(rows => rows.map(old => old.id === row.id ? updated : old));
    }, 'Add-on updated.')}>{row.enabled ? 'Disable' : 'Enable'}</Button><Button variant="outline" disabled={action.busy} aria-label={`Delete ${row.name}`} onClick={() => { action.clear(); setRemove(row); }}>Delete</Button></div></Card>)}
    {!resource.loading && !resource.error && !resource.items.length && <Empty title="No add-ons">Add an add-on to find more catalogs and sources.</Empty>}<Paging resource={resource} label="Loading add-ons…"/>
    <Modal open={open || !!remove} onOpenChange={value => { if (!value && !action.busy) close(); }} title={remove ? 'Delete add-on' : 'Add add-on'} description={remove ? `Remove ${remove.name}? New discovery cannot use this add-on. Viewing history is retained.` : 'Enter the manifest address supplied by your add-on.'}><form className="grid gap-4" onSubmit={event => { event.preventDefault(); action.run(async () => {
      if (remove) { await api(`/v2/addons/${encode(remove.id)}`, 'DELETE'); resource.setItems(rows => rows.filter(row => row.id !== remove.id)); }
      else { const added = addon(await api('/v2/addons', 'POST', { manifest_url: url })); resource.setItems(rows => [added, ...rows]); }
      close();
    }, remove ? 'Add-on removed.' : 'Add-on added.'); }}>
      {!remove && <Field label="Manifest URL" type="url" required autoComplete="off" disabled={action.busy} value={url} onChange={event => setUrl(event.target.value)}/>}<Feedback error={action.error}/><div className="flex flex-wrap gap-3"><Submit busy={action.busy}>{remove ? 'Delete add-on' : 'Add add-on'}</Submit><Button type="button" variant="outline" disabled={action.busy} onClick={close}>Cancel</Button></div></form></Modal></div>;
}
