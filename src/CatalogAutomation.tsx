import {useEffect,useState} from 'react';
import {Button} from '@/components/ui/button';
import {Field,Feedback,Modal,Resource} from './shared';
import {useAction,useResource} from './hooks';
import type {Client} from './lib/api';
type Policy={enabled:boolean;interval_minutes:number;concurrency:number;retries:number;request_timeout_seconds:number;provider_ids:number[]};
type Summary={settings:Policy;next_run:number|null;last_run:null|{id:string;state:string;created_at:number;finished_at:number|null;reason:string|null;matching_state:string;accounts:{provider_id:number;status:string;attempts:number;reason:string|null;next_retry:number|null}[]}};
type Provider={id:number;name:string;enabled:boolean;enable_live:boolean;enable_movies:boolean;enable_series:boolean};
const date=(at:number|null)=>at?new Date(at*1000).toLocaleString():'—';
const reason=(value:string|null)=>({authentication_failed:'Credentials expired or rejected',rate_limited:'Provider rate limit',empty_catalog:'Empty response; previous catalog retained',invalid_metadata:'Invalid metadata; previous catalog retained',provider_unavailable:'Account disabled or removed',request_failed:'Request failed or timed out',authorization_lost:'Schedule owner no longer authorized',run_deadline:'Run time limit reached',incomplete_results:'Some results could not be saved',cancelled:'Cancelled'}[value??'']??value);
export function CatalogAutomation({api,close,saved}:{api:Client;close:()=>void;saved:()=>void}){
 const resource=useResource<Summary>(api,'/automation/catalog');
 const[previous,setPrevious]=useState<Summary>();
 useEffect(()=>{if(resource.data)setPrevious(resource.data)},[resource.data]);
 const status=resource.data??previous;
 const providers=useResource<Provider[]>(api,'/providers');
 const action=useAction();
 const active=['queued','running','cancel_requested'].includes(status?.last_run?.state??'');
 const reload=resource.reload;
 useEffect(()=>{if(!active)return;const timer=setInterval(reload,2000);return()=>clearInterval(timer)},[active,reload]);
 const apply=(path:string)=>void action.run(async()=>{await api(path,'POST');reload();saved()});
 return <Modal open onOpenChange={open=>{if(!open)close()}} title="Catalog refresh" description="Refresh selected accounts and match new backups automatically. Each account uses its enabled Live, Movies and Series scopes.">
 <div className="space-y-4"><Feedback error={action.error}/><Resource {...providers}><Resource {...resource} loading={resource.loading&&!status}>{status&&providers.data&&<>
 <Schedule api={api} initial={status.settings} providers={providers.data} saved={()=>{reload();saved()}}/>
 <p>Next scheduled run: {date(status.next_run)}</p>
 <div className="flex flex-wrap gap-2"><Button disabled={action.busy||active||!status.settings.provider_ids.length} onClick={()=>apply('/automation/catalog/run')}>Refresh now</Button><Button variant="outline" disabled={action.busy||!active} onClick={()=>apply('/automation/catalog/cancel')}>Cancel current run</Button><Button variant="outline" onClick={reload}>Reload status</Button></div>
 {status.last_run&&<div className="space-y-2"><p>Last run: {status.last_run.state} · started {date(status.last_run.created_at)} · finished {date(status.last_run.finished_at)}</p><p>{reason(status.last_run.reason)}</p><p>Channel matching: {status.last_run.matching_state==='retry_required'?'Needs another matching pass; use Automatic matching or the next refresh.':status.last_run.matching_state}</p><ul className="space-y-2">{status.last_run.accounts.map(row=><li key={row.provider_id} className="rounded-md border p-3">{providers.data!.find(p=>p.id===row.provider_id)?.name??`Removed account ${row.provider_id}`}: {row.status} · {row.attempts} attempts{row.reason&&<p>{reason(row.reason)}</p>}{row.next_retry&&<p>Eligible to retry after {date(row.next_retry)}</p>}</li>)}</ul></div>}
 </>}</Resource></Resource></div></Modal>
}
function Schedule({api,initial,providers,saved}:{api:Client;initial:Policy;providers:Provider[];saved:()=>void}){
 const[settings,setSettings]=useState(initial);const action=useAction();
 return <form className="space-y-3" onSubmit={e=>{e.preventDefault();void action.run(async()=>{await api('/automation/catalog','PATCH',settings);saved()})}}>
 <label className="flex flex-wrap gap-2"><input type="checkbox" checked={settings.enabled} onChange={e=>setSettings({...settings,enabled:e.target.checked})}/>Enable scheduled refresh</label>
 <p className="text-sm text-muted-foreground">Enabling runs a refresh immediately. Saving with scheduling disabled pauses future runs and cancels the current run. Manual refresh remains available. Successful account results stay saved if another account fails.</p>
 <fieldset className="space-y-2"><legend>Accounts to refresh ({settings.provider_ids.length} / 20)</legend>{providers.map(p=><label key={p.id} className="flex flex-wrap gap-2"><input type="checkbox" checked={settings.provider_ids.includes(p.id)} disabled={!settings.provider_ids.includes(p.id)&&settings.provider_ids.length>=20} onChange={e=>setSettings({...settings,provider_ids:e.target.checked?[...settings.provider_ids,p.id]:settings.provider_ids.filter(id=>id!==p.id)})}/>{p.name}{!p.enabled?' (disabled)':''} · {[p.enable_live?'Live':'',p.enable_movies?'Movies':'',p.enable_series?'Series':''].filter(Boolean).join(', ')||'No scopes enabled'}</label>)}</fieldset>
 <div className="grid gap-3 sm:grid-cols-2">{([{key:'interval_minutes',label:'Refresh interval (minutes)',min:15,max:10080},{key:'concurrency',label:'Accounts refreshed at once',min:1,max:4},{key:'retries',label:'Retries for temporary failures',min:0,max:3},{key:'request_timeout_seconds',label:'Account attempt timeout (seconds)',min:5,max:60}] as const).map(field=><Field key={field.key} label={field.label} type="number" required min={field.min} max={field.max} value={settings[field.key]} onChange={e=>setSettings({...settings,[field.key]:Number(e.target.value)})}/>)}</div>
 <Button type="submit" variant="outline" disabled={action.busy||settings.enabled&&!settings.provider_ids.length}>Save refresh settings</Button><Feedback error={action.error}/>
 </form>
}
