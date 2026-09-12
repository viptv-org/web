import {useState} from 'react';
import {Button} from '@/components/ui/button';
import {Field,Feedback,Modal,Submit} from './shared';
import {useAction} from './hooks';
import {encode,type Client,type Provider} from './lib/api';
type ImportResult={row:number;status:string;provider_id?:number};
const outcomes:Record<string,string>={imported:'Imported',duplicate:'Already configured',invalid_entry:'Check the entry format',validation_failed:'Login validation failed',save_failed:'Could not save; refresh your sign-in and retry'};
export function BulkProviders({api,saved}:{api:Client;saved:()=>void}){
 const[open,setOpen]=useState(false);const[entries,setEntries]=useState('');const[results,setResults]=useState<ImportResult[]>([]);const action=useAction();
 const close=(next:boolean)=>{if(action.busy)return;setOpen(next);setEntries('');setResults([]);action.clear()};
 return <><Button variant="outline" onClick={()=>close(true)}>Import accounts</Button><Modal open={open} onOpenChange={close} title="Import Xtream accounts" description="Paste up to 20 Xtream URLs, one per line, or a JSON array of account objects. Each entry gets its own result.">
 <form className="space-y-4" onSubmit={e=>{e.preventDefault();void action.run(async()=>{const response=await api<{results:ImportResult[]}>('/providers/import','POST',{entries});setEntries('');setResults(response.results);saved()},'Validation finished. Review each row below.')}}>
 <p>New imports default to Live TV only. You can turn Movies and Series on in each account’s content scopes afterward.</p>
 <label className="grid gap-2">Xtream accounts<textarea className="min-h-40 rounded-md border bg-background p-2 font-mono text-sm" required maxLength={65536} value={entries} autoComplete="off" spellCheck={false} onChange={e=>setEntries(e.target.value)} placeholder="https://provider.example/get.php?username=YOUR_USER&password=YOUR_PASSWORD"/></label>
 <p className="text-sm text-muted-foreground">JSON fields: name, url, username, password. Optional fields: enable_live, enable_movies, enable_series, max_connections, warp. Credentials are cleared from this form after the results arrive. A duplicate keeps the existing account; use Renew credentials to update it.</p>
 <Feedback error={action.error} success={action.success}/><Submit busy={action.busy}>Validate and import</Submit>
 {results.length>0&&<ol className="space-y-2" aria-label="Import results">{results.map(result=><li key={result.row}>Row {result.row}: {outcomes[result.status]??'Could not import'}{result.provider_id?` · Account #${result.provider_id}`:''}</li>)}</ol>}
 </form></Modal></>
}
export function RenewProvider({api,provider,saved}:{api:Client;provider:Provider;saved:()=>void}){
 const[open,setOpen]=useState(false);const action=useAction();
 return <><Button variant="outline" size="sm" onClick={()=>{action.clear();setOpen(true)}} aria-label={`Renew credentials for ${provider.name}`}>Renew credentials</Button><Modal open={open} onOpenChange={next=>{if(!action.busy)setOpen(next)}} title={`Renew ${provider.name}`} description="Validates the new login before saving. Provider identity, imported channels, content scopes and enabled state stay in place.">
 {open&&<form className="space-y-4" onSubmit={e=>{e.preventDefault();const form=e.currentTarget;const values=Object.fromEntries(new FormData(form));const body={url:values.url,password:values.password,...(String(values.username).trim()?{username:values.username}:{})};void action.run(async()=>{await api(`/providers/${encode(provider.id)}/credentials`,'POST',body);form.reset();setOpen(false);saved()})}}>
 <Field label="Server URL" name="url" type="url" required defaultValue={provider.url}/><Field label="New username (leave blank to keep current)" name="username" autoComplete="off" maxLength={512}/><Field label="New password" name="password" type="password" autoComplete="new-password" required maxLength={2048}/>
 <Feedback error={action.error}/><Submit busy={action.busy}>Validate and save</Submit>
 </form>}</Modal></>
}
