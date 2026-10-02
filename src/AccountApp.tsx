import {ParentalControls,ParentUnlock} from './ParentalControls';
import {PlaybackPreferences} from "./PlaybackPreferences";
import {StremioImport} from './StremioImport';
import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {Card,CardContent,CardHeader,CardTitle} from '@/components/ui/card';
import {Button} from '@/components/ui/button';
import {ViewingHistory} from './ViewingHistory';
import {MyList} from './MyList';
import {ViewingQueue} from './ViewingQueue';
import { AdminShell, type AdminPage } from './AdminShell';
import { V2Connections, V2Addons } from './V2Connections';
import { V2Gateways } from './V2Gateways';
import { VodMatches } from './VodMatches';
import { OperatorOverview } from './OperatorOverview';
import {Feedback,Modal} from './shared';
import {ApiError,type Client,type Profile} from './lib/api';
import {createAccountClient} from './lib/accountApi';
import {AuthScreen,ProfileScreen,ProfileAvatar,AccountManagement,DeviceManagement,DeviceActivation,type AuthMode,type AvatarStyle} from './AccountScreens';
import {LinkTv} from './LinkTv';
import {ProtectedPresentation} from './ProtectedPresentation';

type Identity={id:string;name?:string;username?:string;role?:string};
type Me={account?:Identity;user?:Identity;id?:string;account_id?:string|number;name?:string;username?:string;role?:string;capabilities?:{create_profiles?:boolean;can_create_profile?:boolean};can_create_profile?:boolean;restricted?:boolean;profile_id?:string|null};
type State='boot'|'device-code'|'auth'|'recovery-codes'|'activate'|'profiles'|'ready'|'unavailable';
function normalizeMe(data:Me):Me{if(!data.account&&!data.user&&(data.account_id!=null||data.id!=null))return{...data,account:{id:String(data.account_id??data.id),name:data.name,username:data.username,role:data.role}};return data}
function isDeviceEntryRoute(){return typeof window!=='undefined'&&['/device','/activate'].includes(window.location.pathname)}
function initialDeviceCode(){if(!isDeviceEntryRoute())return'';const value=new URLSearchParams(window.location.search).get('code')?.trim().toUpperCase()??'';return/^[A-Z0-9]{6,12}$/.test(value)?value:''}

export default function AccountApp(){
 const[state,setState]=useState<State>(()=>isDeviceEntryRoute()&&!initialDeviceCode()?'device-code':'boot');const[mode,setMode]=useState<AuthMode>('login');const[me,setMe]=useState<Me>();const[profiles,setProfiles]=useState<Profile[]>([]);const[profile,setProfile]=useState('');const[page,setPage]=useState<AdminPage>('Account');const[error,setError]=useState('');const[busy,setBusy]=useState(false);const[codes,setCodes]=useState<string[]>([]);const[deviceCode,setDeviceCode]=useState(initialDeviceCode);const generation=useRef(0);
 const[confirmLogout,setConfirmLogout]=useState(false);const[pendingLogout,setPendingLogout]=useState(false);
 const[parentUntil,setParentUntil]=useState(0);const[parentRequired,setParentRequired]=useState(false);const[pendingProfile,setPendingProfile]=useState('');
 const protectedBlocked=useRef(false);const protectedRequests=useRef(new AbortController());const presentedScope=useRef<string|undefined>(undefined);const protectedEpoch=useRef(0);
 useEffect(()=>{if(!parentUntil)return;const timer=setTimeout(()=>setParentUntil(0),Math.max(0,parentUntil-Date.now()));return()=>clearTimeout(timer)},[parentUntil]);
 const expired=useCallback(()=>{generation.current++;protectedEpoch.current++;protectedRequests.current.abort();presentedScope.current=undefined;setMe(undefined);setPendingLogout(false);setParentUntil(0);setParentRequired(false);setPendingProfile('');setProfiles([]);setProfile('');setPage('Account');setMode('login');setState('auth');setError('Your session expired. Sign in again.');},[]);
 const connection=useMemo(()=>createAccountClient(expired),[expired]);const{api}=connection;const identity=me?.account??me?.user;const owner=(identity?.role??me?.role)==='owner';const canCreate=me?.can_create_profile!==false&&me?.capabilities?.can_create_profile!==false;
 function clearDeviceCode(){setDeviceCode('');if(typeof history!=='undefined')history.replaceState({},'', '/');}
 function acceptDeviceCode(code:string){history.replaceState({},'',`/device?code=${encodeURIComponent(code)}`);setDeviceCode(code)}
 async function action(work:()=>Promise<void>,propagate=false){setBusy(true);setError('');try{await work()}catch(e){if(!(e instanceof DOMException&&e.name==='AbortError')){if(e instanceof ApiError&&e.errorCode==='parent_required')setParentRequired(true);else setError(e instanceof Error?e.message:'Request failed.')}if(propagate)throw e}finally{setBusy(false)}}
 async function loadProfiles(){const assigned=await api<Profile[]>('/profiles');if(!Array.isArray(assigned))throw new Error('Could not load profiles.');setProfiles(assigned);setProfile('');setState('profiles')}
 async function authenticated(){const data=normalizeMe(await api<Me>('/auth/me'));if(!data.account&&!data.user&&!data.id)throw new Error('The server returned no account identity.');setMe(data);if(deviceCode)setState('activate');else await loadProfiles()}
 const startSession=useCallback(async()=>{const current=++generation.current;setState('boot');setError('');try{const status=await api<{authenticated?:boolean}>('/auth/status');if(current!==generation.current)return;if(status.authenticated===false){setState('auth');return}try{const data=normalizeMe(await api<Me>('/auth/me'));if(current!==generation.current)return;setMe(data);if(deviceCode){setState('activate');return}const assigned=await api<Profile[]>('/profiles');if(current!==generation.current)return;setProfiles(assigned);const remembered=data.profile_id&&assigned.find(item=>item.id===String(data.profile_id)&&item.setup_complete!==false);if(remembered){setProfile(remembered.id);setState('ready')}else{setProfile('');setState('profiles')}}catch(e){if(current!==generation.current)return;if(e instanceof ApiError&&e.status===401)setState('auth');else throw e}}catch(e){if(current===generation.current){setState('unavailable');setError(e instanceof Error?e.message:'Cannot reach VIPTV.')}}},[api,deviceCode]);
 useEffect(()=>{if(isDeviceEntryRoute()&&!deviceCode)return;void startSession();return()=>{generation.current++;connection.clear()}},[startSession,connection,deviceCode]);
 async function submitAuth(body:Record<string,string>){await action(async()=>{const path=mode==='register'?'/auth/register':mode==='recover'?'/auth/recover':'/auth/login';const result=await api<{recovery_codes?:string[];recovery_code?:string}>(path,'POST',body);const received=result?.recovery_codes?.length?result.recovery_codes:result?.recovery_code?[result.recovery_code]:[];if(received.length){setCodes(received);setState('recovery-codes');return}if(mode==='recover'){setMode('login');setState('auth');return}await authenticated()})}
 async function select(id:string){await action(async()=>{const chosen=profiles.find(p=>p.id===id);if(!chosen||chosen.setup_complete===false)throw new Error('Finish setting up this profile first.');try{await api('/auth/profile','POST',{profile_id:id})}catch(e){if(e instanceof ApiError&&e.errorCode==='parent_required'){setPendingProfile(id);setParentRequired(true);return}throw e}setPendingProfile('');setParentUntil(0);setParentRequired(false);setMe(normalizeMe(await api<Me>('/auth/me')));setProfile(id);setPage('Account');setState('ready')})}
 async function create(name:string,avatar_style:AvatarStyle){await action(async()=>{const created=await api<Profile>('/profiles','POST',{name,avatar_style});if(!created?.id)throw new Error('The server did not return the new profile.');const assigned=await api<Profile[]>('/profiles');setProfiles(assigned);if(!assigned.some(p=>p.id===created.id))throw new Error('The new profile is not available.');await api('/auth/profile','POST',{profile_id:created.id});setProfile(created.id);setState('ready')})}
 async function removeProfile(item:Profile){await action(async()=>{await api(`/profiles/${encodeURIComponent(item.id)}`,'DELETE');generation.current++;await loadProfiles()},true)}
 async function update(imported:Profile,name:string,avatar_style:AvatarStyle){await action(async()=>{await api(`/profiles/${encodeURIComponent(imported.id)}`,'PATCH',{name,avatar_style,setup_complete:true});await loadProfiles()},true)}
 function logout(){setConfirmLogout(true)}
 async function performLogout(){setConfirmLogout(false);await action(async()=>{try{await api('/auth/logout','POST',{})}catch(e){if(e instanceof ApiError&&e.errorCode==='parent_required'){setPendingLogout(true);setParentRequired(true);return}throw e}connection.clear();generation.current++;protectedEpoch.current++;protectedRequests.current.abort();presentedScope.current=undefined;setMe(undefined);setPendingLogout(false);setParentUntil(0);setParentRequired(false);setPendingProfile('');setProfiles([]);setProfile('');setCodes([]);setPage('Account');setMode('login');setState('auth');await api('/auth/status')})}
 function blockProtected(){protectedBlocked.current=true;protectedRequests.current.abort();setParentUntil(0);setParentRequired(true)}
 function allowProtected(){protectedBlocked.current=false;if(protectedRequests.current.signal.aborted)protectedRequests.current=new AbortController()}
 function discardProfile(){protectedEpoch.current++;protectedRequests.current.abort();presentedScope.current=undefined;setParentRequired(false);setParentUntil(0);setPendingProfile('');setPendingLogout(false);setProfile('');setProfiles([]);setState('profiles');setError('Choose a profile to continue.');generation.current++;void loadProfiles().catch(()=>setError('Could not load profiles. Reload to try again.'))}
 const revokedProfile=(e:unknown)=>e instanceof ApiError&&e.status===403&&['profile_access_denied','profile_revoked','profile_required','profile_policy_changed'].includes(e.errorCode??'');
 const scopedApi=useMemo<Client>(()=>{const epoch=protectedEpoch.current;return async(path,method,body,signal)=>{if(epoch!==protectedEpoch.current)throw new DOMException('Cancelled','AbortError');if(protectedBlocked.current)throw new ApiError('Parent PIN required',403,'parent_required');try{return await api(path,method,body,AbortSignal.any([protectedRequests.current.signal,...(signal?[signal]:[])]))}catch(e){if(e instanceof ApiError&&e.errorCode==='parent_required')blockProtected();if(revokedProfile(e))discardProfile();throw e}}},[api,profile]);
 const parentApi=useMemo<Client>(()=>async(path,method,body,signal)=>{try{return await api(path,method,body,signal)}catch(e){if(revokedProfile(e))discardProfile();throw e}},[api]);
 const logoutDialog=<Modal open={confirmLogout} onOpenChange={setConfirmLogout} title="Sign out?" description="Sign out of your account in this browser."><div className="flex justify-end gap-2"><Button variant="outline" onClick={()=>setConfirmLogout(false)}>Cancel</Button><Button disabled={busy} onClick={()=>void performLogout()}>Sign out</Button></div></Modal>;
 const needsParent=parentRequired||(state==='ready'&&me?.restricted===true&&parentUntil<=Date.now());
 protectedBlocked.current=needsParent;
 const scopeKey=`${identity?.id}:${profile}`;
 if(state!=='ready')presentedScope.current=undefined;
 const preserveReady=state==='ready'&&presentedScope.current===scopeKey;
 if(state==='ready'&&!needsParent)presentedScope.current=scopeKey;
 useEffect(()=>{if(needsParent)protectedRequests.current.abort();else if(protectedRequests.current.signal.aborted)protectedRequests.current=new AbortController()},[needsParent,state,profile]);
 async function parentUnlocked(){
  if(preserveReady){
   const verified=normalizeMe(await api<Me>('/auth/me'));
   if(!identity?.id||!(verified.account??verified.user)?.id||(verified.account??verified.user)?.id!==identity?.id||String(verified.profile_id??'')!==profile||((verified.account??verified.user)?.role??verified.role)!==(identity?.role??me?.role)){setMe(verified);discardProfile();return}
   setMe(verified);
  }
  allowProtected();setParentRequired(false);setParentUntil(Date.now()+110000);
  if(pendingLogout)await performLogout();else if(pendingProfile)await select(pendingProfile);
 }
 function cancelParent(){setPendingProfile('');setParentRequired(false);setError('');if(pendingLogout){setPendingLogout(false);allowProtected()}else{protectedEpoch.current++;protectedRequests.current.abort();presentedScope.current=undefined;setProfile('');setState('profiles')}}
 const parentPanel=<div className="mx-auto max-w-md space-y-5 p-4 sm:p-8"><h1 className="text-xl font-semibold">Parent access</h1><ParentUnlock api={parentApi} onUnlocked={parentUnlocked} onCancel={cancelParent}/></div>;
 if(state==='device-code')return <LinkTv onCode={acceptDeviceCode}/>;
 if(needsParent&&!preserveReady&&state!=='auth'&&state!=='boot')return <>{parentPanel}{logoutDialog}</>;
 if(state!=='ready')return <div className={`account-gateway ${state==='auth'?'account-auth-gateway':''}`}><main className="account-gateway-content space-y-6">
  {state==='boot'&&<section className="rounded-xl border p-6 space-y-4"><div className="flex items-center gap-2 text-xl font-semibold"><strong>VIPTV</strong></div><p role="status">Opening your account…</p></section>}
  {state==='auth'&&<AuthScreen mode={mode} onSubmit={submitAuth} onMode={next=>{setMode(next);setError('')}} busy={busy} error={error} deviceCode={deviceCode}/>}
  {state==='unavailable'&&<section className="rounded-xl border p-6 space-y-4"><h1>We couldn't reach VIPTV</h1><Feedback error={error}/><Button onClick={()=>void startSession()}>Try again</Button></section>}
  {state==='recovery-codes'&&<section className="rounded-xl border p-6 space-y-4"><p className="text-sm text-muted-foreground">One-time safety step</p><h1>Save your recovery codes</h1><p>Store these somewhere private. They will not be shown again.</p><ul>{codes.map(code=><li key={code}><code>{code}</code></li>)}</ul><Button disabled={busy} onClick={()=>void action(async()=>{setCodes([]);await authenticated()})}>I've saved my recovery codes</Button></section>}
  {state==='activate'&&deviceCode&&<DeviceActivation api={api} code={deviceCode} onComplete={async()=>{clearDeviceCode();await loadProfiles()}} onCancel={async()=>{clearDeviceCode();await loadProfiles()}}/>}
  {state==='profiles'&&<ProfileScreen profiles={profiles} canCreate={canCreate} onSelect={select} onCreate={create} onUpdate={update} onDelete={removeProfile} onLogout={logout} busy={busy} error={error}/>}
 </main>{logoutDialog}</div>;
 const selected=profiles.find(item=>item.id===profile);
 return <><ProtectedPresentation.Provider value={needsParent}><div hidden={needsParent} inert={needsParent} aria-hidden={needsParent||undefined}><AdminShell page={page} owner={owner} profile={selected?.name} navigate={setPage} signOut={logout}>
  <Feedback error={error}/><section key={`${identity?.id}:${profile}:${page}`}>
   {page==='Account'&&<div className="space-y-6"><Card><CardHeader><CardTitle>{identity?.name??identity?.username}</CardTitle></CardHeader><CardContent className="space-y-4"><p>@{identity?.username} · {owner?'Owner':'Member'}</p><div className="flex min-w-0 flex-wrap items-center gap-4"><ProfileAvatar profile={selected??{name:'Profile'}} size="small"/><span className="min-w-0 flex-1 break-words [overflow-wrap:anywhere]">{selected?.name}</span><Button className="w-full sm:w-auto" variant="outline" onClick={()=>{setProfile('');void action(loadProfiles)}}>Manage profiles</Button></div></CardContent></Card><PlaybackPreferences key={profile} api={scopedApi} profile={profile}/><StremioImport key={`import:${profile}`} api={scopedApi} profile={profile} profileName={selected?.name??'Selected profile'} restricted={me?.restricted===true} onManageAddons={()=>setPage('Add-ons')}/><ParentalControls api={scopedApi} profiles={profiles} onChanged={async()=>{const data=normalizeMe(await api<Me>('/auth/me'));setMe(data);setProfiles(await api<Profile[]>('/profiles'))}}/></div>}
   {page==='Devices'&&<DeviceManagement api={scopedApi}/>}
   {page==='History'&&<ViewingHistory key={profile} api={scopedApi} profile={profile}/>}
   {page==='My List'&&<MyList key={profile} api={scopedApi} profile={profile}/>}
   {page==='Continue Watching'&&<ViewingQueue key={profile} api={scopedApi} profile={profile}/>}
   {page==='Add-ons'&&<V2Addons api={scopedApi}/>}
   {page==='Xtream connections'&&<V2Connections api={scopedApi}/>}
   {page==='VOD matches'&&<VodMatches api={scopedApi}/>}
   {page==='Gateways'&&<V2Gateways api={scopedApi} operator={owner}/>}
   {owner&&page==='Overview'&&<OperatorOverview api={scopedApi}/>}
   {owner&&page==='Gateway grants'&&<V2Gateways api={scopedApi} operator grantsOnly/>}
   {owner&&page==='Accounts'&&<AccountManagement api={scopedApi}/>}
  </section>{logoutDialog}
 </AdminShell></div></ProtectedPresentation.Provider>{needsParent&&parentPanel}</>
}
