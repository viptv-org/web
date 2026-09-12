import {useState} from 'react';
import {Film} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Card} from '@/components/ui/card';
import {Feedback,Resource} from './shared';
import {useAction,useResource} from './hooks';
import {safeImage,type Client} from './lib/api';
export type LibraryItem={id:string;type:string;name:string;poster?:string;position?:number;duration?:number;watched?:boolean;series_id?:string;season?:number;episode?:number};
type Page={items:LibraryItem[];total:number;next_offset:number|null};
export function LibraryPoster({url}:{url?:string}){const[failed,setFailed]=useState(false);const src=safeImage(url);return <div className="flex h-24 w-16 shrink-0 items-center justify-center overflow-hidden rounded bg-muted text-muted-foreground">{src&&!failed?<img src={src} alt="" loading="lazy" className="h-full w-full object-contain" onError={()=>setFailed(true)}/>:<Film aria-hidden="true"/>}</div>}
export function MyList({api,profile}:{api:Client;profile:string}){
 const[offset,setOffset]=useState(0);const a=useAction();const base=`/profiles/${encodeURIComponent(profile)}/favorites`;
 const r=useResource<Page>(api,`${base}/page?limit=20&offset=${offset}`);
 async function remove(item:LibraryItem){await a.run(async()=>{await api(`${base}/${encodeURIComponent(item.type)}/${encodeURIComponent(item.id)}`,'DELETE');if(r.data?.items.length===1&&offset>0)setOffset(Math.max(0,offset-20));else r.reload()},'Removed from My List.')}
 return <section className="space-y-5"><Feedback error={a.error} success={a.success}/><Resource {...r}>{r.data&&<><p className="text-sm text-muted-foreground">{r.data.total} saved titles</p>{!r.data.items.length&&<p>Save a title from your TV to find it here.</p>}<div className="grid gap-3 md:grid-cols-2">{r.data.items.map(item=><Card key={`${item.type}:${item.id}`} className="flex min-w-0 flex-row gap-3 p-3"><LibraryPoster url={item.poster}/><div className="min-w-0 flex-1 space-y-2"><h2 className="break-words font-semibold">{item.name}</h2><p className="text-sm capitalize text-muted-foreground">{item.type}</p><Button variant="outline" disabled={a.busy} aria-label={`Remove ${item.name}`} onClick={()=>void remove(item)}>Remove</Button></div></Card>)}</div><div className="flex justify-between gap-3"><Button variant="outline" disabled={!offset||a.busy} onClick={()=>setOffset(Math.max(0,offset-20))}>Previous</Button><Button variant="outline" disabled={r.data.next_offset===null||a.busy} onClick={()=>setOffset(r.data!.next_offset!)}>Next</Button></div></>}</Resource></section>
}
