import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field } from './shared';
import type { Provider, ProviderPatch, ProviderScopes } from './lib/api';

const scopes = [
  ['enable_live', 'Live TV'],
  ['enable_movies', 'Movies'],
  ['enable_series', 'Series'],
] as const;

function ScopeControls({ value, busy, name, update }: { value: ProviderScopes; busy: boolean; name?: string; update: (patch: ProviderScopes) => void }) {
  return <fieldset className="space-y-4" disabled={busy}>
    <legend className="font-medium text-xs">Content scopes</legend>
    <div className="flex flex-wrap items-center gap-2">{scopes.map(([key, label]) => {
      const enabled = value[key] ?? true;
      return <Button key={key} type="button" role="switch" aria-label={name ? `${label} for ${name}` : label} aria-checked={enabled} variant={enabled ? 'secondary' : 'outline'} size="sm" disabled={busy} onClick={() => update({ [key]: !enabled })}>{label}: {enabled ? 'On' : 'Off'}</Button>;
    })}</div>
    <p className="text-sm text-muted-foreground">Choose which content this provider supplies. Other providers keep their own scopes.</p>
  </fieldset>;
}

export function ProviderScopeFields({ busy }: { busy: boolean }) {
  const [value, setValue] = useState<ProviderScopes>({ enable_live: true, enable_movies: true, enable_series: true });
  return <>
    {scopes.map(([key]) => <input key={key} type="hidden" name={key} value={String(value[key] ?? true)}/>)}
    <ScopeControls value={value} busy={busy} update={patch => setValue(current => ({ ...current, ...patch }))}/>
  </>;
}

export function ProviderSettings({ provider, busy, update }: { provider: Provider; busy: boolean; update: (patch: ProviderPatch) => void }) {
  const [cap, setCap] = useState(String(provider.max_connections ?? 1));
  useEffect(() => setCap(String(provider.max_connections ?? 1)), [provider.max_connections]);
  const value = Number(cap);
  const valid = cap.trim() !== '' && Number.isInteger(value) && value >= 1 && value <= 32;
  const enabledScopes = scopes.filter(([key]) => provider[key] ?? true).map(([, label]) => label);
  return <div className="space-y-4 w-full border-t pt-4">
    <div className="flex flex-wrap items-center gap-2 justify-between"><div><div className="font-medium text-xs">Provider availability & allowance</div><p className="text-sm text-muted-foreground">Disabled providers remain configured. Renew credentials to replace an expired login without recreating this account.</p></div><Button type="button" role="switch" aria-label={`Enable ${provider.name}`} aria-checked={provider.enabled} variant={provider.enabled ? 'secondary' : 'outline'} size="sm" disabled={busy} onClick={() => update({ enabled: !provider.enabled })}><span className={`h-2 w-2 rounded-full ${provider.enabled ? 'bg-primary' : 'bg-muted-foreground'}`}/>{provider.enabled ? 'Enabled' : 'Disabled'}</Button></div>
    <p className="text-sm text-muted-foreground" aria-label={`Content scopes for ${provider.name}`}>Scopes: {enabledScopes.length ? enabledScopes.join(', ') : 'None (all scopes off)'}</p>
    <Button type="button" role="switch" aria-label={`Use WARP for ${provider.name}`} aria-checked={provider.warp??false} variant={provider.warp?'secondary':'outline'} disabled={busy} onClick={()=>update({warp:!provider.warp})}>Connection: {provider.warp?'WARP':'Direct'}</Button>
    <p className="text-sm text-muted-foreground">This account’s catalog, schedules and streams use the selected connection. WARP must be configured on the server.</p>
    <ScopeControls value={provider} busy={busy} name={provider.name} update={update}/>
    <form className="flex flex-wrap items-center gap-2 items-end" onSubmit={e => { e.preventDefault(); if (valid) update({ max_connections: value }); }}><Field label={`Concurrent upstream streams for ${provider.name}`} type="number" min={1} max={32} step={1} required value={cap} disabled={busy} onChange={e => setCap(e.target.value)}/><Button type="submit" size="sm" variant="outline" disabled={busy || !valid || value === (provider.max_connections ?? 1)}>{busy ? 'Saving…' : 'Save stream limit'}</Button></form>
    <p className="text-sm text-muted-foreground">The configured cap is an upper bound for this subscription on this server. Shared aliases use the same allowance, and a lower valid provider report reduces admission. Stop the subscription’s local streams before editing its allowance.</p>
  </div>;
}
