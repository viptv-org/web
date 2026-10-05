import {useState} from 'react';
import {Button} from '@/components/ui/button';
import {Card} from '@/components/ui/card';
import {Input} from '@/components/ui/input';
import {Feedback} from './shared';
import {useAction} from './hooks';
import {LibraryPoster,libraryKey,type LibraryItem} from './MyList';
import {OffsetWindowList,libraryPage,useOffsetWindow} from './OffsetWindow';
import type {Client} from './lib/api';
function HistoryCard({item,busy,correct}:{item:LibraryItem;busy:boolean;correct:(item:LibraryItem,action:string,position?:number)=>void}){
 const[seconds,setSeconds]=useState(String(Math.floor(item.position??0)));const watched=item.watched??((item.duration??0)>0&&(item.position??0)/(item.duration??1)>=.95);
 return <Card className="flex h-full min-w-0 flex-row gap-3 p-3"><LibraryPoster url={item.poster}/><div className="min-w-0 flex-1 space-y-3"><h3 className="break-words font-semibold">{item.name}</h3><p className="text-sm text-muted-foreground">{item.type==='series'?`S${item.season??'?'} · E${item.episode??'?'}`:'Movie'} · {watched?'Watched':(item.position??0)>0?'In progress':'Unwatched'}{watched&&item.resume_active===true?' · Rewatch in progress':''}</p>{item.completion_only===true&&item.watch_date_known===false&&<p className="text-sm text-muted-foreground">Imported — date unknown</p>}<Button variant="outline" disabled={busy} onClick={()=>correct(item,watched?'unwatched':'watched')}>{watched?'Mark unwatched':'Mark watched'}</Button><form className="flex flex-wrap items-end gap-2" onSubmit={e=>{e.preventDefault();correct(item,'position',Number(seconds))}}><label className="min-w-0 flex-1 text-sm">Resume at (seconds)<Input type="number" min="0" max={item.duration&&item.duration>0?item.duration:1e9} step="1" required value={seconds} onChange={e=>setSeconds(e.target.value)} className="mt-1"/></label><Button variant="outline" disabled={busy}>Save position</Button></form></div></Card>
}
export function ViewingHistory({api,profile}:{api:Client;profile:string}){
 const a=useAction();const base=`/profiles/${encodeURIComponent(profile)}/progress`;
 const list=useOffsetWindow<LibraryItem>(api,`${base}/page`,{keyOf:libraryKey,decode:libraryPage,limit:20,retain:100});
 // The corrected row stays where the reader is; the server's recency order applies on the next visit.
 function correct(item:LibraryItem,action:string,position?:number){void a.run(async()=>{
  const result=await api<{position?:unknown;duration?:unknown;watched?:boolean;resume_active?:boolean;completion_only?:boolean;watch_date_known?:boolean}|undefined>(`${base}/correct`,'PUT',{...item,action,...(position!==undefined?{position}:{})});
  const duration=typeof result?.duration==='number'?result.duration:item.duration;
  const saved=typeof result?.position==='number'?result.position:action==='watched'?duration:action==='unwatched'?0:position;
  list.update(items=>items.map(row=>libraryKey(row)===libraryKey(item)?{...row,position:saved,duration,watched:result?.watched??(action==='watched'?true:action==='unwatched'?false:undefined),resume_active:result?.resume_active,completion_only:result?.completion_only??false,watch_date_known:result?.watch_date_known??true}:row));
 },'Viewing progress updated.')}
 return <section className="space-y-4"><p className="text-sm text-muted-foreground">Correct a movie or episode below. Your TV picks up changes when you reopen the series or Home. Dated activity appears first; imported completions with unknown watch dates appear last and do not add items to Continue Watching.</p><Feedback error={a.error} success={a.success}/>{list.total!==undefined&&<p>{list.total} watched or started items</p>}{!list.loading&&!list.error&&!list.items.length&&<p>No viewing history yet.</p>}
 <OffsetWindowList list={list} keyOf={libraryKey} label="Viewing history" rowsClassName="grid gap-3 md:grid-cols-2" loadingLabel="Loading more titles…">{item=><HistoryCard key={String(item.position)} item={item} busy={a.busy} correct={correct}/>}</OffsetWindowList></section>
}
