import {useState} from 'react';
import {Button} from '@/components/ui/button';
import {Card} from '@/components/ui/card';
import {Feedback,Resource} from './shared';
import {useAction,useResource} from './hooks';
import type {Client} from './lib/api';
export type Preferences={audio_language:string;subtitle_language:string;subtitles_enabled:boolean;subtitle_size:string;subtitle_style:string;quality:string;autoplay:boolean};
const languages=[['en','English'],['es','Spanish'],['fr','French'],['de','German'],['it','Italian'],['pt','Portuguese'],['ja','Japanese'],['ko','Korean'],['zh','Chinese'],['hi','Hindi'],['ar','Arabic']];
function PreferenceForm({initial,save}:{initial:Preferences;save:(value:Preferences)=>Promise<void>}){
 const[value,setValue]=useState(initial);const a=useAction();
 const select=(key:keyof Preferences,label:string,options:string[][])=><label className="grid gap-2" key={key}>{label}<select className="min-h-11 w-full rounded-md border bg-background px-3" value={String(value[key])} onChange={e=>setValue({...value,[key]:e.target.value})}>{options.map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label>;
 return <form onSubmit={e=>{e.preventDefault();void a.run(()=>save(value),'Playback preferences saved.')}}><fieldset disabled={a.busy} className="grid gap-5"><legend className="mb-3 text-lg font-semibold">Playback preferences</legend><p className="text-sm text-muted-foreground">Applies to your next playback on every device. Manual track choices keep priority. A preferred language is used when available.</p><div className="grid gap-4 sm:grid-cols-2">{select('audio_language','Preferred audio',languages)}{select('subtitle_language','Preferred subtitles',languages)}{select('subtitle_size','Subtitle size',[['small','Small'],['normal','System default'],['large','Large']])}{select('subtitle_style','Subtitle appearance',[['system','System default'],['shadow','Text with shadow'],['opaque','White text on black']])}{select('quality','Maximum quality',[['auto','Auto · device capability'],['1080p','1080p'],['720p','720p'],['480p','480p · save data']])}</div><label className="flex min-h-11 items-center gap-3"><input type="checkbox" checked={value.subtitles_enabled} onChange={e=>setValue({...value,subtitles_enabled:e.target.checked})}/>Start with subtitles enabled</label><Feedback error={a.error} success={a.success}/><Button type="submit">{a.busy?'Saving…':'Save preferences'}</Button></fieldset></form>
}
export function PlaybackPreferences({api,profile}:{api:Client;profile:string}){
 const path=`/profiles/${encodeURIComponent(profile)}/preferences`;const r=useResource<Preferences>(api,path);
 return <Card className="p-4 sm:p-6"><Resource {...r}>{r.data&&<PreferenceForm key={profile} initial={r.data} save={value=>api(path,'PUT',value).then(()=>undefined)}/>}</Resource></Card>
}
