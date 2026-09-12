import {useState} from 'react';
import {Button} from '@/components/ui/button';
import {Field,Feedback,Resource} from './shared';
import {useAction,useResource} from './hooks';
import {encode,type Client,type Provider} from './lib/api';
type Pool={id:number;name:string;provider_ids:number[];configured_limit:number;external_reserve:number;local_reservations:number;effective_limit:number;estimated_free:number;reported_limit?:number|null;reported_usage?:number|null;limit_age_seconds?:number|null;usage_age_seconds?:number|null;confidence:string};
const age=(seconds?:number|null)=>seconds==null?'not observed':seconds<60?`${seconds}s ago`:`${Math.floor(seconds/60)}m ago`;
export function AccountPools({api,providers,saved}:{api:Client;providers:Provider[];saved:()=>void}){
 const r=useResource<{pools:Pool[]}>(api,'/account-pools');const pools=r.data?.pools??[];
 const changed=()=>{r.reload();saved()};
 return <section className="space-y-4 rounded-md border p-4"><div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between"><h2>Shared subscription allowances</h2><Button variant="outline" onClick={r.reload}>Refresh local usage</Button></div>
 <p className="text-sm text-muted-foreground">Known duplicate logins share one allowance. Associate other aliases only when they use the same subscription. Local reservations include playing streams, startup and probes across Live TV, Movies and Series.</p>
 <Resource {...r}>
 {pools.map(pool=><PoolControls key={`${pool.id}:${pool.configured_limit}:${pool.external_reserve}`} api={api} pool={pool} providers={providers} saved={changed}/>)}
 {pools.length>0&&<div className="space-y-3"><h3>Provider assignments</h3><p className="text-sm text-muted-foreground">Known duplicate logins move together. Regrouping and allowance edits wait until the affected subscriptions have no local reservations.</p>{providers.map(provider=><Assignment key={`${provider.id}:${pools.find(p=>p.provider_ids.some(id=>String(id)===String(provider.id)))?.id}`} api={api} provider={provider} pools={pools} saved={changed}/>)}</div>}
 </Resource></section>
}
function PoolControls({api,pool,providers,saved}:{api:Client;pool:Pool;providers:Provider[];saved:()=>void}){
 const[limit,setLimit]=useState(pool.configured_limit);const[reserve,setReserve]=useState(pool.external_reserve);const action=useAction();
 const reporter=providers.find(p=>p.enabled&&pool.provider_ids.some(id=>String(id)===String(p.id)));
 const valid=Number.isInteger(limit)&&limit>=1&&limit<=32&&Number.isInteger(reserve)&&reserve>=0&&reserve<=limit;
 return <div className="space-y-3 rounded-md border p-3"><h3>{pool.name} · Pool #{pool.id}</h3><p className="text-sm">{pool.provider_ids.map(id=>providers.find(p=>String(p.id)===String(id))?.name??`Account #${id}`).join(', ')}</p>
 <div className="grid gap-2 sm:grid-cols-2"><p>Local reservations: {pool.local_reservations}</p><p>Estimated free slots: {pool.estimated_free}</p><p>Provider-reported usage: {pool.reported_usage??'Unknown'} · {age(pool.usage_age_seconds)}</p><p>Provider-reported limit: {pool.reported_limit??'Unknown'} · {age(pool.limit_age_seconds)}</p><p>Effective allowance: {pool.effective_limit}</p><p>Reserved outside VIPTV: {pool.external_reserve}</p></div>
 <p className="text-sm text-muted-foreground">{pool.confidence==='stale'?'Old report retained conservatively. Refresh the report before expecting released capacity.':pool.confidence==='unknown'?'No usable usage report. Free slots are an estimate from your configured allowance and local reservations.':'Reported usage may include local viewers. The estimate accounts for that overlap; provider reports can lag behind other players.'}</p>
 <Button variant="outline" disabled={action.busy||!reporter} onClick={()=>void action.run(async()=>{await api(`/providers/${encode(reporter!.id)}/status`,'POST');saved()})}>Refresh report for {pool.name}</Button>
 <form className="flex flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-end" onSubmit={e=>{e.preventDefault();if(valid)void action.run(async()=>{await api(`/account-pools/${pool.id}`,'PATCH',{configured_limit:limit,external_reserve:reserve});saved()})}}>
 <Field label={`Allowance for ${pool.name}`} type="number" min={1} max={32} required value={limit} onChange={e=>setLimit(Number(e.target.value))}/><Field label={`Reserved outside VIPTV for ${pool.name}`} type="number" min={0} max={limit} required value={reserve} onChange={e=>setReserve(Number(e.target.value))}/><Button type="submit" variant="outline" disabled={action.busy||!valid} aria-label={`Save allowance for ${pool.name}`}>Save allowance</Button>
 </form><Feedback error={action.error}/></div>
}
function Assignment({api,provider,pools,saved}:{api:Client;provider:Provider;pools:Pool[];saved:()=>void}){
 const current=pools.find(p=>p.provider_ids.some(id=>String(id)===String(provider.id)))?.id;
 const[target,setTarget]=useState(String(current??''));const action=useAction();
 return <form className="flex flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-end" onSubmit={e=>{e.preventDefault();void action.run(async()=>{await api(`/providers/${encode(provider.id)}/pool`,'PATCH',{pool_id:target==='separate'?null:Number(target)});saved()})}}><label className="grid gap-2 text-sm">Subscription for {provider.name}<select className="rounded-md border bg-background p-2" value={target} onChange={e=>setTarget(e.target.value)}>{pools.map(pool=><option key={pool.id} value={pool.id}>{pool.name} · #{pool.id}</option>)}<option value="separate">Separate subscription</option></select></label><Button type="submit" variant="outline" disabled={action.busy||target===String(current)} aria-label={`Save subscription for ${provider.name}`}>Save subscription</Button><Feedback error={action.error}/></form>
}
