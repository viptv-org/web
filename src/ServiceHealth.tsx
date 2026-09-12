import {useEffect, useState} from 'react';
import {Button} from '@/components/ui/button';
import {Card} from '@/components/ui/card';
import {Feedback, Resource} from './shared';
import {useAction, useLiveResource} from './hooks';
import {CatalogAutomation} from './CatalogAutomation';
import {FamilyGuides} from './FamilyGuides';
import type {Client} from './lib/api';

type Run = {accounts?:{status:string}[];state:string;reason:string|null;finished_at?:number|null;last_finish?:number|null};
type ProviderHealth = {id:number;name:string;enabled:boolean;last_catalog_at:number|null;catalog_state:string;retry_at:number|null;pool:null|{id:number;estimated_free:number;effective_limit:number;local_reservations:number;confidence:string}};
type Summary = {at:number;active_sessions:number;paused:boolean;providers:{total:number;next_offset:number|null;items:ProviderHealth[]};catalog:{settings:{provider_ids:number[]};next_run:number|null;last_run:Run|null};guides:{enabled_channels:number;current_channels:number;enabled_sources:number;failed_sources:number;last_updated_at:number|null;last_run:Run}};
const date = (at:number|null|undefined) => at ? new Date(at*1000).toLocaleString() : 'Not observed';
const words = (text:string) => text.replaceAll('_',' ');
const active = (run:Run|null|undefined) => ['queued','running','cancel_requested'].includes(run?.state??'');

export function ServiceHealth({api,navigate}:{api:Client;navigate:(page:string)=>void}) {
 const [offset,setOffset] = useState(0);
 const resource = useLiveResource<Summary>(api,`/service-health?offset=${offset}`,0);
 const action = useAction();
 const [modal,setModal] = useState<'catalog'|'guides'>();
 const summary = resource.data;
 const working = active(summary?.catalog.last_run)||active(summary?.guides.last_run);
 const reload = resource.reload;
 // Only observe saved state while a job is active; no idle polls or provider probes.
 useEffect(()=>{if(!working)return;const timer=setInterval(()=>{if(document.visibilityState!=='hidden')reload()},5000);return()=>clearInterval(timer)},[working,reload]);
 const run = (kind:'catalog'|'guides') => void action.run(async()=>{
  await api(kind==='catalog'?'/automation/catalog/run':'/guides/run','POST');reload();
 },`${kind==='catalog'?'Catalog':'Guide'} refresh queued. Results will update here; playback keeps its current sources.`);
 return <div className="min-w-0 space-y-4">
  <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-semibold">Service health</h2><p className="text-sm text-muted-foreground">Saved observations, without opening test streams.</p></div><Button variant="outline" onClick={reload}>Refresh status</Button></div>
  <Feedback error={action.error} success={action.success}/>
  <Resource {...resource}>{summary&&<>
   {summary.paused&&<p role="status" className="rounded-md border p-3">Automatic maintenance is paused. Manual refresh is still available.</p>}
   <div className="grid gap-3 sm:grid-cols-3">
    <Metric label="Active playback sessions" value={String(summary.active_sessions)}/>
    <Metric label="Channels with a programme now" value={`${summary.guides.current_channels} / ${summary.guides.enabled_channels}`}/>
    <Metric label="Guide sources needing attention" value={`${summary.guides.failed_sources} / ${summary.guides.enabled_sources}`}/>
   </div>
   <div className="grid gap-4 lg:grid-cols-2">
    <Card className="gap-3 p-4"><h3 className="font-semibold">Movies, series and channel catalogs</h3><RunStatus run={summary.catalog.last_run}/><p className="text-sm text-muted-foreground">Next refresh: {date(summary.catalog.next_run)}</p><div className="flex flex-wrap gap-2"><Button disabled={action.busy||active(summary.catalog.last_run)||!summary.catalog.settings.provider_ids.length} onClick={()=>run('catalog')}>Refresh catalogs</Button><Button variant="outline" onClick={()=>setModal('catalog')}>Catalog settings</Button></div>{!summary.catalog.settings.provider_ids.length&&<p className="text-sm">Choose accounts in Catalog settings before refreshing.</p>}</Card>
    <Card className="gap-3 p-4"><h3 className="font-semibold">TV guide</h3><RunStatus run={summary.guides.last_run}/><p className="text-sm text-muted-foreground">Latest source update: {date(summary.guides.last_updated_at)}</p>{summary.guides.current_channels<summary.guides.enabled_channels&&<p className="text-sm">Some enabled Family channels have no current schedule. Guide settings can repair mappings.</p>}<div className="flex flex-wrap gap-2"><Button disabled={action.busy||active(summary.guides.last_run)||!summary.guides.enabled_sources} onClick={()=>run('guides')}>Refresh guides</Button><Button variant="outline" onClick={()=>setModal('guides')}>Guide settings</Button></div></Card>
   </div>
   <Card className="gap-4 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">Providers ({summary.providers.total})</h3><Button variant="outline" onClick={()=>navigate('Providers')}>Manage providers</Button></div>
    <p className="text-sm text-muted-foreground">Free connections are estimates for each shared account pool, not a guarantee of playback. Shared pool limits must not be added together. Catalog times reflect retained scheduled refresh history; missing observations do not mean a provider is broken.</p>
    <div className="grid gap-3 md:grid-cols-2">{summary.providers.items.map(provider=><article key={provider.id} className="min-w-0 space-y-2 rounded-md border p-3"><div className="flex flex-wrap justify-between gap-2"><strong className="break-words">{provider.name}</strong><span className="text-sm text-muted-foreground">{provider.enabled?'Enabled':'Disabled'}</span></div><p className="text-sm">{provider.pool?`${provider.pool.estimated_free} of ${provider.pool.effective_limit} connections estimated free · ${provider.pool.local_reservations} reserved here`:'Capacity has not been observed.'}</p>{provider.pool&&<p className="text-xs text-muted-foreground">Pool #{provider.pool.id} · {words(provider.pool.confidence)} observation{!provider.enabled?' · account disabled for selection':''}</p>}<p className="text-sm">Catalog: {words(provider.catalog_state)}<br/>Last successful refresh: {date(provider.last_catalog_at)}</p>{provider.retry_at&&<p className="text-sm">Cooling down until {date(provider.retry_at)}</p>}</article>)}</div>
    {!summary.providers.total&&<p>No IPTV providers configured yet.</p>}
    <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={offset===0} onClick={()=>setOffset(Math.max(0,offset-20))}>Previous providers</Button><Button variant="outline" disabled={summary.providers.next_offset===null} onClick={()=>setOffset(summary.providers.next_offset!)}>Next providers</Button></div>
   </Card><p className="text-xs text-muted-foreground">Snapshot: {date(summary.at)}</p>
  </>}</Resource>
  {modal==='catalog'&&<CatalogAutomation api={api} close={()=>setModal(undefined)} saved={reload}/>}
  {modal==='guides'&&<FamilyGuides api={api} close={()=>setModal(undefined)}/>}
 </div>;
}
function Metric({label,value}:{label:string;value:string}) {return <Card className="gap-1 p-4"><p className="text-2xl font-semibold">{value}</p><p className="text-sm text-muted-foreground">{label}</p></Card>}
function RunStatus({run}:{run:Run|null}) {const failed=run?.accounts?.filter(account=>account.status==='failed').length??0;return <div className="space-y-1 text-sm" role="status"><p>{run?`Last run: ${words(run.state)}`:'No refresh recorded'}</p>{failed>0&&<p>{failed} account refresh{failed===1?'':'es'} failed. Open Catalog settings for the reason and retry status.</p>}{run?.reason&&<p>Needs attention: {words(run.reason)}</p>}{run&&(run.finished_at||run.last_finish)&&<p className="text-muted-foreground">Finished: {date(run.finished_at??run.last_finish)}</p>}</div>}
