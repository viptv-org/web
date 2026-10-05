import {useState} from 'react';
import {Film} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Card} from '@/components/ui/card';
import {Feedback} from './shared';
import {useAction} from './hooks';
import {OffsetWindowList,libraryPage,useOffsetWindow} from './OffsetWindow';
import {safeImage,type Client} from './lib/api';
export type LibraryItem={id:string;type:string;name:string;poster?:string;position?:number;duration?:number;watched?:boolean;resume_active?:boolean;completion_only?:boolean;watch_date_known?:boolean;series_id?:string;season?:number;episode?:number};
export const libraryKey=(item:{type:string;id:string})=>`${item.type}:${item.id}`;
export function LibraryPoster({url}:{url?:string}){const[failed,setFailed]=useState(false);const src=safeImage(url);return <div className="flex h-24 w-16 shrink-0 items-center justify-center overflow-hidden rounded bg-muted text-muted-foreground">{src&&!failed?<img src={src} alt="" loading="lazy" className="h-full w-full object-contain" onError={()=>setFailed(true)}/>:<Film aria-hidden="true"/>}</div>}
export function MyList({api,profile}:{api:Client;profile:string}){
 const a=useAction();const base=`/profiles/${encodeURIComponent(profile)}/favorites`;
 const list=useOffsetWindow<LibraryItem>(api,`${base}/page`,{keyOf:libraryKey,decode:libraryPage,limit:20,retain:100});
 async function remove(item:LibraryItem){await a.run(async()=>{await api(`${base}/${encodeURIComponent(item.type)}/${encodeURIComponent(item.id)}`,'DELETE');list.update(items=>items.filter(row=>libraryKey(row)!==libraryKey(item)))},'Removed from My List.')}
 return <section className="space-y-5"><Feedback error={a.error} success={a.success}/>{list.total!==undefined&&<p className="text-sm text-muted-foreground">{list.total} saved titles</p>}{!list.loading&&!list.error&&!list.items.length&&<p>Save a title from your TV to find it here.</p>}
 <OffsetWindowList list={list} keyOf={libraryKey} label="Saved titles" rowsClassName="grid gap-3 md:grid-cols-2" loadingLabel="Loading more titles…">{item=><Card className="flex h-full min-w-0 flex-row gap-3 p-3"><LibraryPoster url={item.poster}/><div className="min-w-0 flex-1 space-y-2"><h2 className="break-words font-semibold">{item.name}</h2><p className="text-sm capitalize text-muted-foreground">{item.type}</p><Button variant="outline" disabled={a.busy} aria-label={`Remove ${item.name}`} onClick={()=>void remove(item)}>Remove</Button></div></Card>}</OffsetWindowList></section>
}
