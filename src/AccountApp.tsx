import {ParentalControls,ParentUnlock} from './ParentalControls';
import {PlaybackPreferences} from "./PlaybackPreferences";
import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {LogOut} from 'lucide-react';
import {Card,CardContent,CardHeader,CardTitle} from '@/components/ui/card';
import {Button} from '@/components/ui/button';
import {ViewingHistory} from './ViewingHistory';
import {MyList} from './MyList';
import {ViewingQueue} from './ViewingQueue';
import {FamilyLineup} from './FamilyLineup';
import {Connections,Matches,Overview} from './Admin';
import {Feedback,Modal} from './shared';
import {ApiError,type Client,type Profile} from './lib/api';
import {createAccountClient} from './lib/accountApi';
import {AuthScreen,ProfileScreen,ProfileAvatar,AccountManagement,Onboarding,DeviceManagement,DeviceActivation,type AuthMode,type AvatarStyle} from './AccountScreens';

type Identity={id:string;name?:string;username?:string;role?:string};
type Me={account?:Identity;user?:Identity;id?:string;account_id?:string|number;name?:string;username?:string;role?:string;capabilities?:{create_profiles?:boolean;can_create_profile?:boolean};can_create_profile?:boolean;restricted?:boolean;profile_id?:string|null};
type State='boot'|'auth'|'recovery-codes'|'activate'|'profiles'|'ready'|'unavailable';
type Page='Viewing history'|'My List'|'Continue Watching'|'Account'|'Addons'|'Overview'|'Providers'|'Family lineup'|'VOD matches'|'Accounts'|'Service setup';
const NAV:Page[]=['Account','Continue Watching','My List','Viewing history','Addons'];
const ADMIN:Page[]=['Overview','Providers','Family lineup','VOD matches','Accounts','Service setup'];
function normalizeMe(data:Me):Me{if(!data.account&&!data.user&&(data.account_id!=null||data.id!=null))return{...data,account:{id:String(data.account_id??data.id),name:data.name,username:data.username,role:data.role}};return data}
function initialDeviceCode(){if(typeof window==='undefined')return'';if(!['/device','/activate'].includes(window.location.pathname))return'';const value=new URLSearchParams(window.location.search).get('code')?.trim().toUpperCase()??'';return/^[A-Z0-9]{6,12}$/.test(value)?value:''}

export default function AccountApp(){
 const[state,setState]=useState<State>('boot');const[mode,setMode]=useState<AuthMode>('login');const[me,setMe]=useState<Me>();const[profiles,setProfiles]=useState<Profile[]>([]);const[profile,setProfile]=useState('');const[page,setPage]=useState<Page>('Account');const[error,setError]=useState('');const[busy,setBusy]=useState(false);const[codes,setCodes]=useState<string[]>([]);const[deviceCode,setDeviceCode]=useState(initialDeviceCode);const generation=useRef(0);
 const[confirmLogout,setConfirmLogout]=useState(false);const[pendingLogout,setPendingLogout]=useState(false);
 const[parentUntil,setParentUntil]=useState(0);const[parentRequired,setParentRequired]=useState(false);const[pendingProfile,setPendingProfile]=useState('');
 useEffect(()=>{if(!parentUntil)return;const timer=setTimeout(()=>setParentUntil(0),Math.max(0,parentUntil-Date.now()));return()=>clearTimeout(timer)},[parentUntil]);
 const expired=useCallback(()=>{generation.current++;setMe(undefined);setPendingLogout(false);setParentUntil(0);setParentRequired(false);setPendingProfile('');setProfiles([]);setProfile('');setPage('Account');setMode('login');setState('auth');setError('Your session expired. Sign in again.');},[]);
 const connection=useMemo(()=>createAccountClient(expired),[expired]);const{api}=connection;const identity=me?.account??me?.user;const owner=(identity?.role??me?.role)==='owner';const canCreate=me?.can_create_profile!==false&&me?.capabilities?.can_create_profile!==false;
 function clearDeviceCode(){setDeviceCode('');if(typeof history!=='undefined')history.replaceState({},'', '/');}
 async function action(work:()=>Promise<void>,propagate=false){setBusy(true);setError('');try{await work()}catch(e){if(!(e instanceof DOMException&&e.name==='AbortError')){if(e instanceof ApiError&&e.errorCode==='parent_required')setParentRequired(true);else setError(e instanceof Error?e.message:'Request failed.')}if(propagate)throw e}finally{setBusy(false)}}
 async function loadProfiles(){const assigned=await api<Profile[]>('/profiles');if(!Array.isArray(assigned))throw new Error('Could not load profiles.');setProfiles(assigned);setProfile('');setState('profiles')}
 async function authenticated(){const data=normalizeMe(await api<Me>('/auth/me'));if(!data.account&&!data.user&&!data.id)throw new Error('The server returned no account identity.');setMe(data);if(deviceCode)setState('activate');else await loadProfiles()}
 const startSession=useCallback(async()=>{const current=++generation.current;setState('boot');setError('');try{const status=await api<{authenticated?:boolean}>('/auth/status');if(current!==generation.current)return;if(status.authenticated===false){setState('auth');return}try{const data=normalizeMe(await api<Me>('/auth/me'));if(current!==generation.current)return;setMe(data);if(deviceCode){setState('activate');return}const assigned=await api<Profile[]>('/profiles');if(current!==generation.current)return;setProfiles(assigned);const remembered=data.profile_id&&assigned.find(item=>item.id===String(data.profile_id)&&item.setup_complete!==false);if(remembered){setProfile(remembered.id);setState('ready')}else{setProfile('');setState('profiles')}}catch(e){if(current!==generation.current)return;if(e instanceof ApiError&&e.status===401)setState('auth');else throw e}}catch(e){if(current===generation.current){setState('unavailable');setError(e instanceof Error?e.message:'Cannot reach VIPTV.')}}},[api,deviceCode]);
 useEffect(()=>{void startSession();return()=>{generation.current++;connection.clear()}},[startSession,connection]);
 async function submitAuth(body:Record<string,string>){await action(async()=>{const path=mode==='register'?'/auth/register':mode==='recover'?'/auth/recover':'/auth/login';const result=await api<{recovery_codes?:string[];recovery_code?:string}>(path,'POST',body);const received=result?.recovery_codes?.length?result.recovery_codes:result?.recovery_code?[result.recovery_code]:[];if(received.length){setCodes(received);setState('recovery-codes');return}if(mode==='recover'){setMode('login');setState('auth');return}await authenticated()})}
 async function select(id:string){await action(async()=>{const chosen=profiles.find(p=>p.id===id);if(!chosen||chosen.setup_complete===false)throw new Error('Finish setting up this profile first.');try{await api('/auth/profile','POST',{profile_id:id})}catch(e){if(e instanceof ApiError&&e.errorCode==='parent_required'){setPendingProfile(id);setParentRequired(true);return}throw e}setPendingProfile('');setParentUntil(0);setParentRequired(false);setMe(normalizeMe(await api<Me>('/auth/me')));setProfile(id);setPage('Account');setState('ready')})}
 async function create(name:string,avatar_style:AvatarStyle){await action(async()=>{const created=await api<Profile>('/profiles','POST',{name,avatar_style});if(!created?.id)throw new Error('The server did not return the new profile.');const assigned=await api<Profile[]>('/profiles');setProfiles(assigned);if(!assigned.some(p=>p.id===created.id))throw new Error('The new profile is not available.');await api('/auth/profile','POST',{profile_id:created.id});setProfile(created.id);setState('ready')})}
 async function removeProfile(item:Profile){await action(async()=>{await api(`/profiles/${encodeURIComponent(item.id)}`,'DELETE');generation.current++;await loadProfiles()},true)}
 async function update(imported:Profile,name:string,avatar_style:AvatarStyle){await action(async()=>{await api(`/profiles/${encodeURIComponent(imported.id)}`,'PATCH',{name,avatar_style,setup_complete:true});await loadProfiles()},true)}
 function logout(){setConfirmLogout(true)}
 async function performLogout(){setConfirmLogout(false);await action(async()=>{try{await api('/auth/logout','POST',{})}catch(e){if(e instanceof ApiError&&e.errorCode==='parent_required'){setPendingLogout(true);setParentRequired(true);return}throw e}setPendingLogout(false);connection.clear();generation.current++;setMe(undefined);setPendingLogout(false);setParentUntil(0);setParentRequired(false);setPendingProfile('');setProfiles([]);setProfile('');setCodes([]);setPage('Account');setMode('login');setState('auth');await api('/auth/status')})}
 const scopedApi=useMemo<Client>(()=>async(path,method,body,signal)=>{try{return await api(path,method,body,signal)}catch(e){if(e instanceof ApiError&&e.errorCode==='parent_required'){setParentUntil(0);setParentRequired(true)}if(e instanceof ApiError&&e.status===403&&['profile_access_denied','profile_revoked','profile_required','profile_policy_changed'].includes(e.errorCode??'')){setProfile('');setProfiles([]);setState('profiles');setError('Choose a profile to continue.');generation.current++;void loadProfiles().catch(()=>setError('Could not load profiles. Reload to try again.'))}throw e}},[api,profile]);
 const logoutDialog=<Modal open={confirmLogout} onOpenChange={setConfirmLogout} title="Sign out?" description="Sign out of your account in this browser."><div className="flex justify-end gap-2"><Button variant="outline" onClick={()=>setConfirmLogout(false)}>Cancel</Button><Button disabled={busy} onClick={()=>void performLogout()}>Sign out</Button></div></Modal>;
 const needsParent=parentRequired||(state==='ready'&&me?.restricted===true&&parentUntil<=Date.now());
 if(needsParent&&state!=='auth'&&state!=='boot')return <div className="mx-auto max-w-md space-y-5 p-4 sm:p-8"><h1 className="text-xl font-semibold">Parent access</h1><ParentUnlock api={api} onUnlocked={async()=>{setParentRequired(false);setParentUntil(Date.now()+110000);if(pendingLogout)await performLogout();else if(pendingProfile)await select(pendingProfile)}} onCancel={()=>{setPendingProfile('');setParentRequired(false);setError('');if(pendingLogout){setPendingLogout(false)}else{setProfile('');setState('profiles')}}}/>{logoutDialog}</div>;
 if(state!=='ready')return <div className="mx-auto max-w-xl p-6"><main className="space-y-6">
  {state==='boot'&&<section className="rounded-xl border p-6 space-y-4"><div className="flex items-center gap-2 text-xl font-semibold"><span className="hidden">V</span><strong>VIPTV</strong></div><p role="status">Opening your account…</p></section>}
  {state==='auth'&&<AuthScreen mode={mode} onSubmit={submitAuth} onMode={next=>{setMode(next);setError('')}} busy={busy} error={error} deviceCode={deviceCode}/>}
  {state==='unavailable'&&<section className="rounded-xl border p-6 space-y-4"><h1>We couldn't reach VIPTV</h1><Feedback error={error}/><Button onClick={()=>void startSession()}>Try again</Button></section>}
  {state==='recovery-codes'&&<section className="rounded-xl border p-6 space-y-4"><p className="text-sm text-muted-foreground">One-time safety step</p><h1>Save your recovery codes</h1><p>Store these somewhere private. They will not be shown again.</p><ul>{codes.map(code=><li key={code}><code>{code}</code></li>)}</ul><Button disabled={busy} onClick={()=>void action(async()=>{setCodes([]);await authenticated()})}>I've saved my recovery codes</Button></section>}
  {state==='activate'&&deviceCode&&<DeviceActivation api={api} code={deviceCode} onComplete={async()=>{clearDeviceCode();await loadProfiles()}} onCancel={async()=>{clearDeviceCode();await loadProfiles()}}/>}
  {state==='profiles'&&<ProfileScreen profiles={profiles} canCreate={canCreate} onSelect={select} onCreate={create} onUpdate={update} onDelete={removeProfile} onLogout={logout} busy={busy} error={error}/>}
 </main>{logoutDialog}</div>;
 const selected=profiles.find(item=>item.id===profile);const links=owner?[...NAV,...ADMIN]:NAV;
 return <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-8">
  <header className="flex items-center justify-between gap-4"><div><h1 className="text-2xl font-semibold">VIPTV</h1><p className="text-sm text-muted-foreground">Account and server management</p></div><Button variant="outline" onClick={logout}><LogOut/>Sign out</Button></header>
  <nav aria-label="Main navigation" className="flex flex-wrap gap-2">{links.map(name=><Button key={name} variant={page===name?'default':'outline'} aria-current={page===name?'page':undefined} onClick={()=>setPage(name)}>{name}</Button>)}</nav>
  <main className="space-y-6"><h2 className="text-xl font-semibold">{page}</h2><Feedback error={error}/><section key={`${identity?.id}:${profile}:${page}`}>
   {page==='Account'&&<div className="space-y-6"><Card><CardHeader><CardTitle>{identity?.name??identity?.username}</CardTitle></CardHeader><CardContent className="space-y-4"><p>@{identity?.username} · {owner?'Owner':'Member'}</p><div className="flex min-w-0 flex-wrap items-center gap-4"><ProfileAvatar profile={selected??{name:'Profile'}} size="small"/><span className="min-w-0 flex-1 break-words [overflow-wrap:anywhere]">{selected?.name}</span><Button className="w-full sm:w-auto" variant="outline" onClick={()=>{setProfile('');void action(loadProfiles)}}>Manage profiles</Button></div></CardContent></Card><PlaybackPreferences key={profile} api={scopedApi} profile={profile}/><ParentalControls api={scopedApi} profiles={profiles} onChanged={async()=>{const data=normalizeMe(await api<Me>('/auth/me'));setMe(data);setProfiles(await api<Profile[]>('/profiles'))}}/><DeviceManagement api={scopedApi}/></div>}
   {page==='Viewing history'&&<ViewingHistory key={profile} api={scopedApi} profile={profile}/>}
   {page==='My List'&&<MyList key={profile} api={scopedApi} profile={profile}/>}
   {page==='Continue Watching'&&<ViewingQueue key={profile} api={scopedApi} profile={profile}/>}
   {page==='Addons'&&<Connections api={scopedApi} kind="addons"/>}
   {owner&&page==='Overview'&&<Overview api={scopedApi} navigate={value=>setPage(value as Page)}/>}
   {owner&&page==='Providers'&&<Connections api={scopedApi} kind="providers"/>}
   {owner&&page==='Family lineup'&&<FamilyLineup api={scopedApi}/>}
   {owner&&page==='VOD matches'&&<Matches api={scopedApi}/>}
   {owner&&page==='Accounts'&&<AccountManagement api={scopedApi}/>}
   {owner&&page==='Service setup'&&<Onboarding api={scopedApi} onDone={()=>setPage('Account')}/>}
  </section></main>{logoutDialog}
 </div>
}
