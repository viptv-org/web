import {useState} from 'react';
import {Button} from '@/components/ui/button';
import {Feedback,Modal,Resource} from './shared';
import {useAction,useResource} from './hooks';
import type {Client} from './lib/api';
type Category={key:string;name:string;count:number;enabled:boolean;reason:string|null};
type Policy={categories:Category[];require_schedule:boolean};
export function LiveCategories({api}:{api:Client}){
 const[open,setOpen]=useState(false);
 return <><Button variant="outline" onClick={()=>setOpen(true)}>Live TV categories</Button><Modal open={open} onOpenChange={setOpen} title="Live TV categories" description="Foreign, adult and SD channels are excluded automatically. Your category choices also apply to future imports with the same category name.">{open&&<CategorySettings api={api}/>}</Modal></>;
}
function CategorySettings({api}:{api:Client}){
 const r=useResource<Policy>(api,'/live-policy');const a=useAction();const[search,setSearch]=useState('');const[page,setPage]=useState(0);
 const rows=(r.data?.categories??[]).filter(c=>c.name.toLowerCase().includes(search.toLowerCase()));
 const save=(body:unknown)=>void a.run(async()=>{await api('/live-policy','PUT',body);r.reload()},'Guide settings saved.');
 return <div className="space-y-4"><Feedback error={a.error} success={a.success}/><Resource {...r}>{r.data&&<>
 <label className="flex min-h-11 items-center gap-3"><input type="checkbox" checked={r.data.require_schedule} disabled={a.busy} onChange={e=>save({require_schedule:e.target.checked})}/><span>Hide channels without a usable schedule</span></label>
 <p className="text-sm text-muted-foreground">Previously saved schedules remain usable during temporary refresh failures. Family lineup matching and guide refresh try available backups before a channel is hidden.</p>
 <label className="grid gap-2">Search categories<input className="min-h-11 rounded-md border bg-background px-3" value={search} onChange={e=>{setSearch(e.target.value);setPage(0)}}/></label>
 <p className="text-sm text-muted-foreground">{rows.length} categories</p>
 <div className="divide-y">{rows.slice(page*20,page*20+20).map(c=><label key={c.key} className="flex min-h-14 items-center gap-3 py-3"><input type="checkbox" aria-label={`Show ${c.name}`} checked={c.enabled&&!c.reason} disabled={a.busy||!!c.reason} onChange={e=>save({category:c.key,enabled:e.target.checked})}/><span className="min-w-0 flex-1 break-words">{c.name}<span className="block text-sm text-muted-foreground">{c.count} channels · {c.reason?`Automatically excluded: ${c.reason}`:c.enabled?'Included':'Hidden by you'}</span></span></label>)}</div>
 <div className="flex justify-between gap-3"><Button variant="outline" disabled={page===0} onClick={()=>setPage(p=>p-1)}>Previous</Button><Button variant="outline" disabled={(page+1)*20>=rows.length} onClick={()=>setPage(p=>p+1)}>Next</Button></div>
 </>}</Resource></div>;
}
