import {useState} from 'react';
import {Film} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Card} from '@/components/ui/card';
import {Feedback,Resource} from './shared';
import {useAction,useResource} from './hooks';
import {safeImage,type Client} from './lib/api';
type Item={id:string;type:string;series_id?:string;name:string;poster?:string;season?:number;episode?:number;queue_status?:string};
type Page={items:Item[];offset:number;total:number;next_offset:number|null};
function QueuePoster({url}:{url?:string}){const[failed,setFailed]=useState(false);const src=safeImage(url);return <div className="flex h-24 w-16 shrink-0 items-center justify-center overflow-hidden rounded bg-muted text-muted-foreground">{src&&!failed?<img className="h-full w-full object-contain" src={src} alt="" loading="lazy" onError={()=>setFailed(true)}/>:<Film aria-hidden="true" className="h-7 w-7"/>}</div>}
export function ViewingQueue({api,profile}:{api:Client;profile:string}){
 const[offset,setOffset]=useState(0);const[undo,setUndo]=useState<Item>();const a=useAction();
 const base=`/profiles/${encodeURIComponent(profile)}/continue`;
 const r=useResource<Page>(api,`${base}/page?limit=20&offset=${offset}`);
 const settings=useResource<{autoplay:boolean}>(api,`${base}/settings`);
 const visibility=(item:Item,hidden:boolean)=>void a.run(async()=>{await api(`${base}/visibility`,'PUT',{id:item.id,type:item.type,series_id:item.series_id,hidden});setUndo(hidden?item:undefined);r.reload()},hidden?'Removed from Continue Watching. Watched history is preserved.':'Restored to Continue Watching.');
 return <section className="space-y-5"><Feedback error={a.error} success={a.success}/>
 <Resource {...settings}>{settings.data&&<label className="flex min-h-11 items-center gap-3"><input type="checkbox" checked={settings.data.autoplay} disabled={a.busy} onChange={e=>{const autoplay=e.target.checked;void a.run(async()=>{await api(`${base}/settings`,'PUT',{autoplay});settings.reload()},'Autoplay preference saved.')}}/><span>Automatically play the next episode</span></label>}</Resource>
 {undo&&<Button variant="outline" disabled={a.busy} onClick={()=>visibility(undo,false)}>Undo removal of {undo.name}</Button>}
 <Resource {...r}>{r.data&&<><p className="text-sm text-muted-foreground">{r.data.total} titles · Managed separately for each profile</p>
 {!r.data.items.length&&<p>No titles on this page.</p>}
 <div className="grid gap-3 md:grid-cols-2">{r.data.items.map(item=><Card key={`${item.type}:${item.series_id??item.id}`} className="flex min-w-0 flex-row gap-3 p-3"><QueuePoster url={item.poster}/><div className="min-w-0 flex-1 space-y-2"><h2 className="break-words font-semibold">{item.name}</h2><p className="text-sm text-muted-foreground">{item.queue_status==='next'?`Up next · S${item.season} E${item.episode}`:item.queue_status==='caught_up'?"You're caught up":item.queue_status==='upcoming'?'Next episode not released':item.queue_status?'Next episode checked when you open this title':item.type==='series'?`Resume · S${item.season??'?'} E${item.episode??'?'}`:'Resume movie'}</p><Button variant="outline" disabled={a.busy} onClick={()=>visibility(item,true)}>Remove</Button></div></Card>)}</div>
 <div className="flex justify-between gap-3"><Button variant="outline" disabled={offset===0||a.busy} onClick={()=>setOffset(n=>Math.max(0,n-20))}>Previous</Button><Button variant="outline" disabled={r.data.next_offset===null||a.busy} onClick={()=>setOffset(r.data!.next_offset!)}>Next</Button></div></>}</Resource></section>;
}
