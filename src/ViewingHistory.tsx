import {useState} from 'react';
import {Button} from '@/components/ui/button';
import {Card} from '@/components/ui/card';
import {Input} from '@/components/ui/input';
import {Feedback,Resource} from './shared';
import {useAction,useResource} from './hooks';
import {LibraryPoster,type LibraryItem} from './MyList';
import type {Client} from './lib/api';
type Page={items:LibraryItem[];total:number;next_offset:number|null};
function HistoryCard({item,busy,correct}:{item:LibraryItem;busy:boolean;correct:(item:LibraryItem,action:string,position?:number)=>void}){
 const[seconds,setSeconds]=useState(String(Math.floor(item.position??0)));const watched=item.watched??((item.duration??0)>0&&(item.position??0)/(item.duration??1)>=.95);
 return <Card className="flex min-w-0 flex-row gap-3 p-3"><LibraryPoster url={item.poster}/><div className="min-w-0 flex-1 space-y-3"><h3 className="break-words font-semibold">{item.name}</h3><p className="text-sm text-muted-foreground">{item.type==='series'?`S${item.season??'?'} · E${item.episode??'?'}`:'Movie'} · {watched?'Watched':(item.position??0)>0?'In progress':'Unwatched'}</p><Button variant="outline" disabled={busy} onClick={()=>correct(item,watched?'unwatched':'watched')}>{watched?'Mark unwatched':'Mark watched'}</Button><form className="flex flex-wrap items-end gap-2" onSubmit={e=>{e.preventDefault();correct(item,'position',Number(seconds))}}><label className="min-w-0 flex-1 text-sm">Resume at (seconds)<Input type="number" min="0" max={item.duration&&item.duration>0?item.duration:1e9} step="1" required value={seconds} onChange={e=>setSeconds(e.target.value)} className="mt-1"/></label><Button variant="outline" disabled={busy}>Save position</Button></form></div></Card>
}
export function ViewingHistory({api,profile}:{api:Client;profile:string}){
 const[offset,setOffset]=useState(0);const a=useAction();const base=`/profiles/${encodeURIComponent(profile)}/progress`;const r=useResource<Page>(api,`${base}/page?limit=20&offset=${offset}`);
 function correct(item:LibraryItem,action:string,position?:number){void a.run(async()=>{await api(`${base}/correct`,'PUT',{...item,action,...(position!==undefined?{position}:{})});r.reload()},'Viewing progress updated.')}
 return <section className="space-y-4"><p className="text-sm text-muted-foreground">Correct a movie or episode below. Your TV picks up changes when you reopen the series or Home.</p><Feedback error={a.error} success={a.success}/><Resource {...r}>{r.data&&<><p>{r.data.total} watched or started items</p>{!r.data.items.length&&<p>No viewing history yet.</p>}<div className="grid gap-3 md:grid-cols-2">{r.data.items.map(item=><HistoryCard key={`${item.type}:${item.id}:${item.position}`} item={item} busy={a.busy} correct={correct}/>)}</div><div className="flex justify-between gap-3"><Button variant="outline" disabled={!offset||a.busy} onClick={()=>setOffset(Math.max(0,offset-20))}>Previous</Button><Button variant="outline" disabled={r.data.next_offset===null||a.busy} onClick={()=>setOffset(r.data!.next_offset!)}>Next</Button></div></>}</Resource></section>
}
