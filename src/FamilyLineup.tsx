import {useState} from 'react';
import {CatalogAutomation} from './CatalogAutomation';
import {FamilyHealth} from './FamilyHealth';
import {FamilyGuides} from './FamilyGuides';
import {FamilyActivity,type FamilyAction} from './FamilyActivity';
import {Connections} from './Admin';
import {FamilyMatching} from './FamilyMatching';
import {Button} from '@/components/ui/button';
import {Field,Feedback,Modal,Resource,Submit} from './shared';
import {useAction,useResource} from './hooks';
import {encode,type Client} from './lib/api';

type Candidate={id:string;name:string;provider?:string;available?:boolean;verified?:boolean;current_name?:string;status?:string};
type Channel={id?:string;name:string;network:string;feed:string;market:string;category:string;number:number;enabled:boolean;candidates:Candidate[];last_startup?:{at:number;attempts:{candidate_id:string;reason:string;estimated_free_before?:number;confidence?:string;recent_success?:boolean;alternatives?:{candidate_id:string;estimated_free:number;reason:string}[]}[]}};
type Recovery={stall_seconds:number;attempt_seconds:number;deadline_seconds:number;max_recoveries:number};
type Settings={enabled:boolean;limit:number;recovery?:Recovery};
const defaultRecovery:Recovery={stall_seconds:20,attempt_seconds:20,deadline_seconds:45,max_recoveries:2};
type Lineup={settings:Settings;channels:Channel[]};
const blank=(number:number):Channel=>({name:'',network:'',feed:'east',market:'',category:'Kids',number,enabled:true,candidates:[]});

export function FamilyLineup({api}:{api:Client}){
 const resource=useResource<Lineup>(api,'/lineup');
 const [editing,setEditing]=useState<Channel>();
 const [settings,setSettings]=useState<Settings>();
 const [matching,setMatching]=useState<string>();
 const [catalog,setCatalog]=useState(false);
 const [panel,setPanel]=useState<FamilyAction|'activity'>();
 const [panelChannel,setPanelChannel]=useState<string>();
 const openPanel=(value:FamilyAction,channel?:string)=>{setPanel(undefined);setPanelChannel(channel);if(value==='matching')setMatching(channel??'');else if(value==='catalog')setCatalog(true);else setPanel(value)};
 const action=useAction();
 return <div className="space-y-4">
  <p>Choose the US English channels your family watches. East, West and local stations each keep their own channel and backups.</p>
  <p className="text-sm text-muted-foreground">The TV guide groups recognized US English networks into sections. Adult and foreign channels are excluded. Use the network field for the station identity; your channel display name can be personalized.</p>
  <Feedback error={action.error} success={action.success}/>
  <Resource {...resource}>
   {resource.data&&<>
    <div className="flex flex-wrap items-center gap-3"><p>{resource.data.channels.filter(c=>c.enabled).length} / {resource.data.settings.limit} visible · {resource.data.settings.enabled?'Family lineup active':'Full provider inventory active'}</p><Button variant="outline" onClick={()=>setSettings(resource.data!.settings)}>Lineup settings</Button><Button onClick={()=>setEditing(blank(Math.max(0,...resource.data!.channels.map(c=>c.number))+1))}>Add channel</Button><Button variant="outline" onClick={()=>setMatching('')}>Automatic matching</Button><Button variant="outline" onClick={()=>setCatalog(true)}>Catalog refresh</Button><Button variant="outline" onClick={()=>setPanel('health')}>Stream health</Button><Button variant="outline" onClick={()=>setPanel('guides')}>Programme guides</Button><Button variant="outline" onClick={()=>setPanel('activity')}>Activity and attention</Button></div>
    {resource.data.channels.length===0&&<p>No family channels yet. Add a channel, attach its matching streams, then activate the family lineup in settings.</p>}
    <ul className="space-y-2">{resource.data.channels.map(c=><li key={c.id} className="grid grid-cols-2 items-center gap-3 rounded-md border p-4 sm:flex sm:justify-between"><div className="col-span-2 min-w-0 sm:flex-1"><strong>{c.number}. {c.name}</strong><p className="text-sm text-muted-foreground">{c.category} · {c.feed}{c.market?` · ${c.market}`:''} · {c.candidates.length} candidates · {c.enabled?'Visible':'Hidden'}</p></div><Button variant="outline" aria-label={`Edit ${c.name}`} onClick={()=>setEditing(c)}>Edit</Button><Button variant="outline" aria-label={`Matches for ${c.name}`} onClick={()=>setMatching(c.id)}>Matches</Button></li>)}</ul>
   </>}
  </Resource>
  {panel==='health'&&<FamilyHealth api={api} initialChannel={panelChannel} close={()=>setPanel(undefined)}/>}
  {panel==='guides'&&<FamilyGuides api={api} initialChannel={panelChannel} close={()=>setPanel(undefined)}/>}
  {panel==='activity'&&<FamilyActivity api={api} close={()=>setPanel(undefined)} open={openPanel}/>}
  {panel==='accounts'&&<Modal open onOpenChange={value=>{if(!value)setPanel(undefined)}} title="Provider accounts" description="Renew credentials and manage subscription capacity."><Connections api={api} kind="providers"/></Modal>}
  {catalog&&<CatalogAutomation api={api} close={()=>setCatalog(false)} saved={resource.reload}/>}
  {matching!==undefined&&<FamilyMatching api={api} initialChannel={matching} close={()=>setMatching(undefined)} saved={resource.reload}/>}
  {editing&&<ChannelEditor api={api} initial={editing} close={()=>setEditing(undefined)} saved={()=>{setEditing(undefined);resource.reload()}}/>}
  <Modal open={!!settings} onOpenChange={open=>{if(!open)setSettings(undefined)}} title="Lineup settings" description="Activating the family lineup changes the channels listed on your TV. Existing provider data stays available.">
   {settings&&<form className="space-y-4" onSubmit={e=>{e.preventDefault();void action.run(async()=>{await api('/lineup/settings','PATCH',settings);setSettings(undefined);resource.reload()})}}>
    <label className="flex gap-2"><input type="checkbox" checked={settings.enabled} onChange={e=>setSettings({...settings,enabled:e.target.checked})}/>Use family lineup on TV</label>
    <Field label="Visible channel limit" type="number" min={1} max={1000} required value={settings.limit} onChange={e=>setSettings({...settings,limit:Number(e.target.value)})}/>
    <fieldset className="space-y-3"><legend>Automatic recovery</legend><p className="text-sm text-muted-foreground">Applies when a viewing session starts. A shorter stall timeout reacts sooner but may interrupt slow streams. Backups may briefly rebuffer. Set maximum recoveries to zero to stop after an interruption.</p>
    {([{key:'stall_seconds',label:'Stall timeout (seconds)',min:5,max:60},{key:'attempt_seconds',label:'Backup attempt timeout (seconds)',min:5,max:30},{key:'deadline_seconds',label:'Recovery deadline (seconds)',min:10,max:45},{key:'max_recoveries',label:'Maximum recoveries per viewing session',min:0,max:5}] as const).map(field=><Field key={field.key} label={field.label} type="number" required min={field.min} max={field.max} value={(settings.recovery??defaultRecovery)[field.key]} onChange={e=>setSettings({...settings,recovery:{...(settings.recovery??defaultRecovery),[field.key]:Number(e.target.value)}})}/>)}</fieldset>
    <Feedback error={action.error}/><Submit busy={action.busy}>Save settings</Submit>
   </form>}
  </Modal>
 </div>
}
function ChannelEditor({api,initial,close,saved}:{api:Client;initial:Channel;close:()=>void;saved:()=>void}){
 const [channel,setChannel]=useState(initial);
 const [search,setSearch]=useState('');const [query,setQuery]=useState('');const[offset,setOffset]=useState(0);
 const inventory=useResource<{candidates:Candidate[]}>(api,`/lineup/candidates?search=${encode(query)}&offset=${offset}`);
 const [verified,setVerified]=useState(false);const action=useAction();
 const change=(next:Partial<Channel>)=>{setChannel(c=>({...c,...next}));};
 const add=(c:Candidate)=>{change({candidates:[...channel.candidates,c]});setVerified(false)};
 const move=(index:number,delta:number)=>{const cs=[...channel.candidates];[cs[index],cs[index+delta]]=[cs[index+delta],cs[index]];change({candidates:cs})};
 return <Modal open onOpenChange={open=>{if(!open)close()}} title={initial.id?'Edit channel':'Add channel'} description="Attach only streams you have verified match this network or station, region and English feed. Free connections decide the playback account. Recent successful playback and startup speed break ties, followed by your preferred quality order.">
  <form className="space-y-4" onSubmit={e=>{e.preventDefault();void action.run(async()=>{await api(initial.id?`/lineup/${encode(initial.id)}`:'/lineup',initial.id?'PATCH':'POST',{...channel,candidates:channel.candidates.map(c=>({id:c.id,name:c.current_name??c.name,verified:true}))});saved()})}}>
   <Field label="Channel name" required maxLength={128} value={channel.name} onChange={e=>change({name:e.target.value})}/>
   <Field label="Network or station" required disabled={!!initial.id} maxLength={128} value={channel.network} onChange={e=>change({network:e.target.value})}/>
   <label className="grid gap-2">Feed<select className="rounded-md border bg-background p-2" disabled={!!initial.id} value={channel.feed} onChange={e=>change({feed:e.target.value})}><option value="east">East</option><option value="west">West</option><option value="national">National</option><option value="local">Local station</option></select></label>
   {channel.feed==='local'&&<Field label="Local market" required disabled={!!initial.id} maxLength={128} value={channel.market} onChange={e=>change({market:e.target.value})}/>}
   {initial.id&&<p className="text-sm text-muted-foreground">To change the station or regional feed, create a new channel so existing favorites and history keep their meaning.</p>}
   <div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><Field label="Group" required maxLength={64} value={channel.category} onChange={e=>change({category:e.target.value})}/><Field label="Channel number" required type="number" min={1} max={99999} value={channel.number} onChange={e=>change({number:Number(e.target.value)})}/></div>
   <label className="flex gap-2"><input type="checkbox" checked={channel.enabled} onChange={e=>change({enabled:e.target.checked})}/>Visible on TV</label>
   <fieldset className="space-y-2"><legend>Playback candidates, preferred quality order</legend>
    {channel.candidates.length===0&&<p>No candidates. The channel will remain listed but cannot play yet.</p>}
    {channel.candidates.map((c,i)=><div key={c.id} className="rounded border p-2 space-y-2"><p>{i+1}. {c.name}</p>{c.current_name&&c.current_name!==c.name&&<p>Provider now lists: {c.current_name}. Verify this is still the same channel before saving.</p>}{c.status&&c.status!=='available'&&<p className="text-sm text-muted-foreground">{c.status==='missing'?'No longer in the provider catalog':c.status==='disabled'?'Provider disabled':'Needs re-verification'}</p>}<div className="flex flex-wrap gap-2"><Button type="button" variant="outline" disabled={i===0} onClick={()=>move(i,-1)} aria-label={`Move ${c.name} up`}>Up</Button><Button type="button" variant="outline" disabled={i===channel.candidates.length-1} onClick={()=>move(i,1)} aria-label={`Move ${c.name} down`}>Down</Button><Button type="button" variant="outline" onClick={()=>change({candidates:channel.candidates.filter(x=>x.id!==c.id)})}>Remove {c.name}</Button></div></div>)}
   </fieldset>
   <div className="flex flex-wrap items-end gap-2"><Field label="Search provider channels" value={search} onChange={e=>setSearch(e.target.value)}/><Button type="button" variant="outline" onClick={()=>{setQuery(search);setOffset(0)}}>Search</Button></div>
   <Resource {...inventory}><div className="max-h-48 space-y-2 overflow-y-auto">{inventory.data?.candidates.map(c=><label key={c.id} className="flex gap-2"><input type="checkbox" checked={channel.candidates.some(x=>x.id===c.id)} disabled={!c.available||(!channel.candidates.some(x=>x.id===c.id)&&channel.candidates.length>=20)} onChange={e=>e.target.checked?add(c):change({candidates:channel.candidates.filter(x=>x.id!==c.id)})}/>{c.name} · {c.provider}{!c.available?' (disabled)':''}</label>)}{inventory.data?.candidates.length===0&&<p>No matching provider channels.</p>}</div><div className="flex flex-wrap gap-2"><Button type="button" variant="outline" disabled={offset===0} onClick={()=>setOffset(offset-100)}>Previous candidates</Button><Button type="button" variant="outline" disabled={(inventory.data?.candidates.length??0)<100} onClick={()=>setOffset(offset+100)}>Next candidates</Button></div></Resource>
   {channel.candidates.length>0&&<label className="flex gap-2"><input type="checkbox" checked={verified} onChange={e=>setVerified(e.target.checked)}/>I verified every selected stream is this exact US English network or station and regional feed.</label>}
   {channel.last_startup&&<div className="space-y-2"><h3>Last playback attempt</h3><p className="text-sm">{new Date(channel.last_startup.at*1000).toLocaleString()}</p><ul>{channel.last_startup.attempts.map((attempt,i)=><li key={i}>{channel.candidates.find(c=>c.id===attempt.candidate_id)?.name??'Removed candidate'}: {({selected:'Selected',connections_busy:'Connections busy',startup_failed:'Could not start',startup_timed_out:'Startup timed out',unavailable_or_changed:'Unavailable or needs verification',recent_input_failure:'Recent playback failure; retry after cooldown'} as Record<string,string>)[attempt.reason]??'Unavailable'}{attempt.reason==='selected'&&attempt.estimated_free_before!=null&&<><p>Selected with {attempt.estimated_free_before} estimated free slots · {attempt.confidence??'unknown'} usage report.</p><p>{attempt.recent_success?'Recently played successfully with these device settings.':'Media compatibility checked during this startup.'}</p>{attempt.alternatives?.map(other=><p key={other.candidate_id}>{channel.candidates.find(c=>c.id===other.candidate_id)?.name??'Removed candidate'}: {other.estimated_free} estimated free slots; lower selection rank.</p>)}</>}</li>)}</ul></div>}
   <Feedback error={action.error}/><Button type="submit" disabled={action.busy||(channel.candidates.length>0&&!verified)}>{action.busy?'Saving…':'Save channel'}</Button>
  </form>
 </Modal>
}
