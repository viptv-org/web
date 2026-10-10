import {useEffect,useState} from 'react';
import type {Client} from './lib/api';
import {useAction,useResource} from './hooks';
import {Card} from './components/ui/card';
import {Button} from './components/ui/button';
import {Feedback} from './shared';

type Status={connected:boolean;configured?:boolean;user_name?:string;last_sync?:number;error?:string;counts?:{imported?:number;exported?:number}};
type SimklList={id?:number;list_id?:number;name?:string;title?:string;items?:unknown[]};
type ListContent={error?:string;metas?:{id:string;name:string;simkl_url?:string;year?:number}[];pagination?:{pages?:number;page?:number}};
export function SimklConnection({api,profile}:{api:Client;profile:string}){
 const base=`/profiles/${encodeURIComponent(profile)}/integrations/simkl`;
 const resource=useResource<Status>(api,base);const action=useAction();
 const [lists,setLists]=useState<SimklList[]>([]);const [list,setList]=useState<ListContent>();const [premium,setPremium]=useState(false);
 const [page,setPage]=useState(1);const [selected,setSelected]=useState<number>();const [itemPage,setItemPage]=useState(1);
 useEffect(()=>{setLists([]);setList(undefined);setPremium(false)},[profile]);
 const status=resource.data;
 async function loadLists(){const result=await api<{premium_only?:boolean;error?:string;items?:SimklList[];lists?:SimklList[]}|SimklList[]>(`${base}/lists?page=${page}`);if(!Array.isArray(result)&&(result.premium_only||result.error==='premium_only')){setPremium(true);return;}setLists(previous=>[...previous,...(Array.isArray(result)?result:result.lists??result.items??[])]);setPage(page+1)}
 return <Card className="p-6 space-y-4"><h2>SIMKL · This profile</h2><p>Connect a separate SIMKL user for each VIPTV profile. Existing watched items and saved titles merge when you connect.</p>
 <Feedback error={action.error||resource.error||status?.error} success={action.success}/>
 {resource.loading?<p>Loading connection…</p>:status?.connected?<><p>Connected as <strong>{status.user_name}</strong></p><p>Last sync: {status.last_sync?new Date(status.last_sync*1000).toLocaleString():'Initial merge pending'}</p><p>{status.counts?.imported??0} imported · {status.counts?.exported??0} exported</p><div className="flex flex-wrap gap-3"><Button disabled={action.busy} onClick={()=>void action.run(async()=>{await api(`${base}/sync`,'POST',{});resource.reload()},'SIMKL synchronized.')}>Sync / retry</Button><Button variant="outline" disabled={action.busy} onClick={()=>void action.run(async()=>{await api(base,'DELETE');resource.reload()},'SIMKL disconnected. Local data retained.')}>Disconnect SIMKL</Button><Button variant="outline" disabled={action.busy} onClick={()=>void action.run(loadLists,'')}>Browse custom lists</Button></div></>:<Button disabled={action.busy||status?.configured===false} onClick={()=>void action.run(async()=>{const result=await api<{authorize_url:string}>(`${base}/connect`,'POST',{});window.location.assign(result.authorize_url)},'')}>Link SIMKL</Button>}
 {status?.configured===false&&<p>SIMKL is not configured on this server.</p>}
 {premium&&<p>SIMKL custom lists require PRO or VIP. Standard watchlist synchronization works independently.</p>}
 {lists.map(item=><Button key={item.id??item.list_id} variant="outline" disabled={action.busy} onClick={()=>void action.run(async()=>{const id=item.id??item.list_id;setSelected(id);setItemPage(1);const result=await api<ListContent>(`${base}/lists/${id}`);if(result.error==='premium_only'){setPremium(true);return;}setList(result)},'')}>{item.name??item.title??'Custom list'}</Button>)}
 {list!==undefined&&<div><p>Read-only SIMKL list</p><ul>{list.metas?.map(item=><li key={item.id}><a href={item.simkl_url} target="_blank" rel="noreferrer">{item.name} {item.year?`(${item.year})`:''} · View on SIMKL</a></li>)}</ul><Button variant="outline" disabled={action.busy} onClick={()=>void action.run(async()=>{const next=itemPage+1;const result=await api<ListContent>(`${base}/lists/${selected}?page=${next}`);setList({...result,metas:[...(list.metas??[]),...(result.metas??[])]});setItemPage(next)},'')}>Next list page</Button></div>}
 </Card>
}
