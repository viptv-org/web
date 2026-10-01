import {useState} from 'react';
import {Button} from '@/components/ui/button';
import {Card} from '@/components/ui/card';
import {Feedback,Resource} from './shared';
import {useAction,useResource} from './hooks';
import {LibraryPoster} from './MyList';
import {OffsetWindowList,libraryPage,useOffsetWindow} from './OffsetWindow';
import type {Client} from './lib/api';
type Item={id:string;type:string;series_id?:string;name:string;poster?:string;season?:number;episode?:number;queue_status?:string};
const queueKey=(item:Item)=>`${item.type}:${item.series_id??item.id}`;
export function ViewingQueue({api,profile}:{api:Client;profile:string}){
 const[undo,setUndo]=useState<{item:Item;position:number}>();const a=useAction();
 const base=`/profiles/${encodeURIComponent(profile)}/continue`;
 const list=useOffsetWindow<Item>(api,`${base}/page`,{keyOf:queueKey,decode:libraryPage,limit:20,retain:100});
 const settings=useResource<{autoplay:boolean}>(api,`${base}/settings`);
 const visibility=(item:Item,hidden:boolean)=>api(`${base}/visibility`,'PUT',{id:item.id,type:item.type,series_id:item.series_id,hidden});
 const hide=(item:Item)=>void a.run(async()=>{
  await visibility(item,true);let position=0;
  list.update((items,start)=>{const index=items.findIndex(row=>queueKey(row)===queueKey(item));if(index<0)return items;position=start+index;return items.filter((_,at)=>at!==index)});
  setUndo({item,position});
 },'Removed from Continue Watching. Watched history is preserved.');
 // Restore in place while that position is still loaded; otherwise start the list again.
 const restore=({item,position}:{item:Item;position:number})=>void a.run(async()=>{
  await visibility(item,false);setUndo(undefined);let restored=false;
  list.update((items,start)=>{const index=position-start;if(index<0||index>items.length)return items;restored=true;return [...items.slice(0,index),item,...items.slice(index)]});
  if(!restored)list.reload();
 },'Restored to Continue Watching.');
 return <section className="space-y-5"><Feedback error={a.error} success={a.success}/>
 <Resource {...settings}>{settings.data&&<label className="flex min-h-11 items-center gap-3"><input type="checkbox" checked={settings.data.autoplay} disabled={a.busy} onChange={e=>{const autoplay=e.target.checked;void a.run(async()=>{await api(`${base}/settings`,'PUT',{autoplay});settings.reload()},'Autoplay preference saved.')}}/><span>Automatically play the next episode</span></label>}</Resource>
 {undo&&<Button variant="outline" disabled={a.busy} onClick={()=>restore(undo)}>Undo removal of {undo.item.name}</Button>}
 {list.total!==undefined&&<p className="text-sm text-muted-foreground">{list.total} titles · Managed separately for each profile</p>}
 {!list.loading&&!list.error&&!list.items.length&&<p>Nothing to continue yet.</p>}
 <OffsetWindowList list={list} keyOf={queueKey} label="Continue Watching titles" rowsClassName="grid gap-3 md:grid-cols-2" loadingLabel="Loading more titles…">{item=><Card className="flex h-full min-w-0 flex-row gap-3 p-3"><LibraryPoster url={item.poster}/><div className="min-w-0 flex-1 space-y-2"><h2 className="break-words font-semibold">{item.name}</h2><p className="text-sm text-muted-foreground">{item.queue_status==='next'?`Up next · S${item.season} E${item.episode}`:item.queue_status==='caught_up'?"You're caught up":item.queue_status==='upcoming'?'Next episode not released':item.queue_status?'Next episode checked when you open this title':item.type==='series'?`Resume · S${item.season??'?'} E${item.episode??'?'}`:'Resume movie'}</p><Button variant="outline" disabled={a.busy} onClick={()=>hide(item)}>Remove</Button></div></Card>}</OffsetWindowList></section>;
}
