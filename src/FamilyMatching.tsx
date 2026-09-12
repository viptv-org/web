import {useState} from 'react';
import {Button} from '@/components/ui/button';
import {Field,Feedback,Modal,Resource} from './shared';
import {useAction,useResource} from './hooks';
import {encode,type Client} from './lib/api';
type Policy={confidence:number;ambiguity_margin:number;ambiguity_policy:string;active_candidates:number};
type Match={channel_id:string;candidate_id:string;name:string;status:string;score:number;reason:string;pinned:boolean;runner_up_margin:number;competing:{channel_id:string;score:number;reason:string}[]};
type Summary={settings:Policy;channels:{id:string;name:string;active:number;reserves:number;review:number;shortage:number}[];matches:Match[];aliases:string[];providers:{id:number;name:string;upstream_group:string}[]};
const reasons:Record<string,string>={owner_pin:'Pinned by you',owner_rejection:'Rejected by you',verified_source_id:'Verified identifier from this provider',exact_normalized_name:'Exact name after removing quality labels',owner_alias:'Your saved alias',constrained_name_similarity:'Similar name; identity checks still apply',region_language_or_feed_conflict:'Conflicting country, language or regional feed',region_language_or_feed_unverified:'Country, language or regional feed needs verification',local_market_unverified:'Local market needs verification',pinned_name_changed:'Pinned stream was renamed; verify again',sibling_network_conflict:'Different sibling network'};
export function FamilyMatching({api,initialChannel,close,saved}:{api:Client;initialChannel:string;close:()=>void;saved:()=>void}){
 const[channel,setChannel]=useState(initialChannel);const[offset,setOffset]=useState(0);const action=useAction();
 const resource=useResource<Summary>(api,`/lineup/matching?${channel?`channel_id=${encode(channel)}&`:''}offset=${offset}`);
 const changed=()=>{resource.reload();saved()};
 return <Modal open onOpenChange={open=>{if(!open)close()}} title="Automatic channel matching" description="Match only the family channels you selected. Unmarked regional feeds stay in review until verified.">
 <div className="space-y-4"><Button disabled={action.busy} onClick={()=>void action.run(async()=>{await api('/lineup/matching/run','POST');changed()})}>Match imported channels</Button><Feedback error={action.error}/>
 <Resource {...resource}>{resource.data&&<>
 <MatchingSettings api={api} initial={resource.data.settings} saved={changed}/>
 <label className="grid gap-2 text-sm">Channel to review<select className="rounded-md border bg-background p-2" value={channel} onChange={e=>{setChannel(e.target.value);setOffset(0)}}><option value="">All selected channels</option>{resource.data.channels.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
 <ul>{resource.data.channels.filter(c=>!channel||c.id===channel).map(c=><li key={c.id}>{c.name}: {c.active} active, {c.reserves} reserves, {c.review} to review{c.shortage>0?` · ${c.shortage} below your candidate target`:''}</li>)}</ul>
 {channel&&<Aliases key={`${channel}:${resource.data.aliases.join('|')}`} api={api} channel={channel} initial={resource.data.aliases} saved={changed}/>}
 <p className="text-sm text-muted-foreground">Pins and rejections remain saved when a stream disappears. A pin verifies the exact feed, including an unmarked regional feed. Identifiers are trusted only within the provider you verified. Candidate diversity uses shared subscriptions and any upstream groups you specify.</p>
 <div className="space-y-3">{resource.data.matches.map(m=><MatchRow key={`${m.channel_id}:${m.candidate_id}:${m.status}:${m.name}`} api={api} match={m} channels={resource.data!.channels} saved={changed}/>)}</div>
 {resource.data.matches.length===0&&<p>No match observations yet. Run matching after importing channels.</p>}
 <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={offset===0} onClick={()=>setOffset(offset-100)}>Previous matches</Button><Button variant="outline" disabled={resource.data.matches.length<100} onClick={()=>setOffset(offset+100)}>Next matches</Button></div>
 <details><summary>Known upstream groups</summary><p className="text-sm text-muted-foreground">Give accounts the same group only when you know they share upstream infrastructure. Different seller names alone do not establish independence. This affects backup diversity; connection allowances are configured separately.</p>{resource.data.providers.map(p=><ProviderGroup key={`${p.id}:${p.upstream_group}`} api={api} provider={p} saved={changed}/>)}</details>
 </>}</Resource></div></Modal>
}
function MatchingSettings({api,initial,saved}:{api:Client;initial:Policy;saved:()=>void}){
 const[settings,setSettings]=useState(initial);const action=useAction();
 return <form className="space-y-3 rounded-md border p-3" onSubmit={e=>{e.preventDefault();void action.run(async()=>{await api('/lineup/matching','PATCH',settings);await api('/lineup/matching/run','POST');saved()})}}><p className="text-sm text-muted-foreground">Exact names score 98, aliases 97 and constrained similar names 90. Lowering confidence permits more suggestions to attach automatically; country, language, feed and sibling checks still apply.</p><div className="grid gap-3 sm:grid-cols-3"><Field label="Automatic match confidence" type="number" required min={80} max={100} value={settings.confidence} onChange={e=>setSettings({...settings,confidence:Number(e.target.value)})}/><Field label="Required margin over competing channel" type="number" required min={0} max={30} value={settings.ambiguity_margin} onChange={e=>setSettings({...settings,ambiguity_margin:Number(e.target.value)})}/><Field label="Active candidates per channel" type="number" required min={1} max={20} value={settings.active_candidates} onChange={e=>setSettings({...settings,active_candidates:Number(e.target.value)})}/></div><label className="grid gap-2 text-sm">Ambiguous matches<select className="rounded-md border bg-background p-2" value={settings.ambiguity_policy} onChange={e=>setSettings({...settings,ambiguity_policy:e.target.value})}><option value="review">Keep for review</option><option value="reject">Leave unattached</option></select></label><Button type="submit" variant="outline" disabled={action.busy}>Save matching settings and match</Button><Feedback error={action.error}/></form>
}
function MatchRow({api,match:m,channels,saved}:{api:Client;match:Match;channels:Summary['channels'];saved:()=>void}){
 const[verified,setVerified]=useState(false);const action=useAction();
 const apply=(decision:string)=>void action.run(async()=>{await api(`/lineup/${encode(m.channel_id)}/matching`,'PATCH',{candidate_id:m.candidate_id,decision,observed_name:m.name,verified});saved()});
 return <div className="space-y-2 rounded-md border p-3"><strong>{m.name}</strong><p>{channels.find(c=>c.id===m.channel_id)?.name??'Channel'} · {m.status} · confidence {m.score}</p><p>{reasons[m.reason]??m.reason} · margin {m.runner_up_margin}</p>{m.competing.length>1&&<p>Competing matches: {m.competing.map(c=>`${channels.find(v=>v.id===c.channel_id)?.name??'Channel'} (${c.score})`).join(', ')}</p>}
 {m.status!=='missing'&&<label className="flex flex-wrap gap-2"><input type="checkbox" checked={verified} onChange={e=>setVerified(e.target.checked)}/>I verified {m.name} is this exact US English channel and regional feed.</label>}
 <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={action.busy||!verified||m.status==='missing'} onClick={()=>apply('pin')}>Pin {m.name}</Button><Button variant="outline" disabled={action.busy} onClick={()=>apply('reject')}>Reject {m.name}</Button><Button variant="outline" disabled={action.busy} onClick={()=>apply('clear')}>Clear correction for {m.name}</Button></div><Feedback error={action.error}/></div>
}
function Aliases({api,channel,initial,saved}:{api:Client;channel:string;initial:string[];saved:()=>void}){
 const[value,setValue]=useState(initial.join('\n'));const action=useAction();
 return <form className="space-y-2" onSubmit={e=>{e.preventDefault();void action.run(async()=>{await api(`/lineup/${encode(channel)}/matching`,'PATCH',{aliases:value.split('\n').map(v=>v.trim()).filter(Boolean)});saved()})}}><label className="grid gap-2 text-sm">Network name aliases, one per line<textarea className="rounded-md border bg-background p-2" value={value} onChange={e=>setValue(e.target.value)}/></label><Button variant="outline" type="submit" disabled={action.busy}>Save aliases and match</Button><Feedback error={action.error}/></form>
}
function ProviderGroup({api,provider,saved}:{api:Client;provider:Summary['providers'][number];saved:()=>void}){
 const[value,setValue]=useState(provider.upstream_group);const action=useAction();
 return <form className="my-3 flex flex-wrap items-end gap-2" onSubmit={e=>{e.preventDefault();void action.run(async()=>{await api(`/lineup/matching/groups/${provider.id}`,'PATCH',{upstream_group:value});saved()})}}><Field label={`Upstream group for ${provider.name}`} maxLength={64} value={value} onChange={e=>setValue(e.target.value)}/><Button variant="outline" type="submit" disabled={action.busy}>Save group for {provider.name}</Button><Feedback error={action.error}/></form>
}
