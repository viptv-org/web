import viptvMark from "./assets/viptv-mark.png";
import {useEffect, useState} from 'react';
import {Card} from '@/components/ui/card';
import {Button} from '@/components/ui/button';
import {Field, Feedback, Resource, Submit, Empty} from './shared';
import {useAction, useResource} from './hooks';
import {encode, type Client, type Profile} from './lib/api';

export const AVATAR_STYLES = ['critters', 'pixel-art', 'pixel-art-neutral', 'moods', 'thumbs', 'lorelei', 'notionists'] as const;
export type AvatarStyle = typeof AVATAR_STYLES[number];
const STYLE_NAMES: Record<AvatarStyle, string> = {critters:'Critter', 'pixel-art':'Pixel hero', 'pixel-art-neutral':'Pixel pal', moods:'Mood', thumbs:'Character', lorelei:'Friend', notionists:'Explorer'};
export function avatarUrl(style?: string, seed?: string) {
  if (!AVATAR_STYLES.includes(style as AvatarStyle) || !seed || !/^[A-Za-z0-9_-]{1,80}$/.test(seed)) return undefined;
  return `https://api.dicebear.com/10.x/${style}/png?seed=${encodeURIComponent(seed)}&size=256`;
}
export function ProfileAvatar({profile, size='large'}: {profile: Pick<Profile,'name'|'avatar_style'|'avatar_seed'|'avatar_url'>; size?: 'small'|'large'}) {
  const [failed, setFailed] = useState(false);
  const generated = avatarUrl(profile.avatar_style, profile.avatar_seed);
  const supplied = profile.avatar_url;
  const safeSupplied = supplied && (/^https:\/\/api\.dicebear\.com\/10\.x\/(critters|pixel-art|pixel-art-neutral|moods|thumbs|lorelei|notionists|pixelbot|voxel-bot|sprouts|planets|clay)\/png\?/.test(supplied) || /^https:\/\/static\.wikia\.nocookie\.net\/disney\/images\/[^\s#\\]+$/.test(supplied)) ? supplied : undefined;
  const src = safeSupplied ?? generated;
  const initials = profile.name.trim().split(/\s+/).slice(0,2).map(part => part[0]?.toUpperCase()).join('') || '?';
  return <span className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted [&_img]:size-full [&_img]:object-cover ${size==='small'?'size-10':'size-16'}`} aria-hidden="true">{src && !failed ? <img src={src} alt="" referrerPolicy="no-referrer" onError={() => setFailed(true)}/> : <span>{initials}</span>}</span>;
}

export type AuthMode = 'login'|'register'|'recover';
export type AuthBody = Record<string,string>;
export function AuthScreen({mode,onSubmit,onMode,busy,error,deviceCode}: {mode:AuthMode;onSubmit:(body:AuthBody)=>void|Promise<void>;onMode:(mode:AuthMode)=>void;busy:boolean;error?:string;deviceCode?:string}) {
  const action=useAction(); busy=busy||action.busy; error=error||action.error;
  const title={login:'Sign in',register:'Create your account',recover:'Recover your account'}[mode];
  return <Card className="p-6 space-y-5" aria-label={title}>
    <img className="account-auth-mark" src={viptvMark} alt="viptv"/>
    <p className="text-sm text-muted-foreground">Account access</p><h1>{title}</h1>
    <p className="text-sm text-muted-foreground">{deviceCode?<>Continue to securely connect the device showing <strong>{deviceCode}</strong>.</>:mode==='register'?'Create an account to start watching.':mode==='recover'?'Use a recovery code to choose a new password.':'Sign in to manage your account.'}</p>
    <form key={mode} className="grid gap-4" onSubmit={async event=>{event.preventDefault();if(busy)return;const form=new FormData(event.currentTarget);const body:AuthBody={username:String(form.get('username')).trim(),password:String(form.get('password'))};if(mode==='register'){body.name=String(form.get('name')).trim();if(body.password!==String(form.get('confirm_password'))) {action.clear(); return await action.run(async()=>{throw new Error('Passwords do not match.');},'');}}if(mode==='recover')body.recovery_code=String(form.get('recovery_code')).trim();await action.run(async()=>onSubmit(body),'');}}>
      <fieldset disabled={busy} className="space-y-4"><legend className="sr-only">{title}</legend>
        {mode==='register'&&<Field label="Display name" name="name" required maxLength={80} autoComplete="name"/>}
        <Field label="Username" name="username" required minLength={3} maxLength={64} autoComplete="username" autoCapitalize="none" spellCheck={false}/>
        {mode==='recover'&&<Field label="Recovery code" name="recovery_code" required autoComplete="off" spellCheck={false}/>}
        <Field label={mode==='recover'?'New password':'Password'} name="password" type="password" required minLength={12} autoComplete={mode==='login'?'current-password':'new-password'}/>
        {mode==='register'&&<Field label="Confirm password" name="confirm_password" type="password" required minLength={12} autoComplete="new-password"/>}
        <Feedback error={error}/><Submit busy={busy}>{title}</Submit>
      </fieldset>
    </form>
    <div className="flex flex-wrap gap-2">{mode!=='login'&&<Button variant="ghost" disabled={busy} onClick={()=>onMode('login')}>Back to sign in</Button>}{mode!=='register'&&<Button variant="outline" disabled={busy} onClick={()=>onMode('register')}>Create account</Button>}{mode!=='recover'&&<Button variant="ghost" disabled={busy} onClick={()=>onMode('recover')}>Forgot password?</Button>}</div>
    <p className="text-xs text-muted-foreground"></p>
  </Card>;
}

function AvatarPicker({value,onChange,disabled=false}: {value:AvatarStyle;onChange:(style:AvatarStyle)=>void;disabled?:boolean}) {
  return <fieldset className="space-y-3" disabled={disabled}><legend>Choose an avatar</legend><div className="grid grid-cols-2 min-[360px]:grid-cols-3 gap-3 [&_label]:grid [&_label]:justify-items-center [&_label]:gap-2 [&_label]:rounded-md [&_label]:border [&_label]:p-2 [&_label]:text-center [&_label]:text-xs [&_label:has(:checked)]:ring-2 [&_label:has(:focus-visible)]:ring-2">{AVATAR_STYLES.map((style,index)=><label key={style} className={value===style?'ring-2':''}><input className="sr-only" type="radio" name="avatar_style" value={style} checked={value===style} onChange={()=>onChange(style)}/><ProfileAvatar profile={{name:STYLE_NAMES[style],avatar_style:style,avatar_seed:`preview-${index+1}`}}/><span>{STYLE_NAMES[style]}</span></label>)}</div></fieldset>;
}
function ProfileForm({profile,onSave,busy}: {profile?:Profile;onSave:(name:string,style:AvatarStyle)=>void|Promise<void>;busy:boolean}) {
  const action=useAction();const [style,setStyle]=useState<AvatarStyle>(AVATAR_STYLES.includes(profile?.avatar_style as AvatarStyle)?profile!.avatar_style as AvatarStyle:'critters');
  return <form className="space-y-4" onSubmit={event=>{event.preventDefault();const name=String(new FormData(event.currentTarget).get('name')).trim();if(name&&!busy)void action.run(async()=>onSave(name,style),'');}}><fieldset disabled={busy||action.busy} className="space-y-4"><legend>{profile?'Edit profile':'Create a profile'}</legend><p>{profile?'Update this profile without losing its history.':'Give everyone their own favorites and watch history.'}</p><Field label="Profile name" name="name" required maxLength={80} defaultValue={profile?.name==='Default'?'':profile?.name}/><AvatarPicker value={style} onChange={setStyle} disabled={busy||action.busy}/><Feedback error={action.error}/><Submit busy={busy||action.busy}>{profile?'Save profile':'Create profile'}</Submit></fieldset></form>;
}
export function ProfileScreen({profiles,canCreate,onSelect,onCreate,onUpdate,onDelete,onLogout,busy,error}: {profiles:Profile[];canCreate:boolean;onSelect:(id:string)=>void|Promise<void>;onCreate:(name:string,style:AvatarStyle)=>void|Promise<void>;onUpdate?:(profile:Profile,name:string,style:AvatarStyle)=>void|Promise<void>;onDelete?:(profile:Profile)=>void|Promise<void>;onLogout:()=>void|Promise<void>;busy:boolean;error?:string}) {
  const action=useAction();const [creating,setCreating]=useState(profiles.length===0);const imported=profiles.find(profile=>profile.setup_complete===false);const[editing,setEditing]=useState<Profile>();const[deleting,setDeleting]=useState<Profile>();
  if(imported&&onUpdate)return <Card className="p-6 space-y-5"><div className="flex items-center gap-2 text-xl font-semibold"><span className="hidden">V</span><strong>VIPTV</strong></div><h1>Make this profile yours</h1><ProfileForm profile={imported} busy={busy} onSave={(name,style)=>onUpdate(imported,name,style)}/><Button variant="ghost" onClick={()=>void onLogout()}>Sign out</Button></Card>;
  if(editing&&onUpdate)return <Card className="p-6 space-y-5"><ProfileForm profile={editing} busy={busy} onSave={async(name,style)=>{await onUpdate(editing,name,style);setEditing(undefined)}}/><Button variant="ghost" disabled={busy} onClick={()=>setEditing(undefined)}>Cancel editing</Button></Card>;
  if(deleting&&onDelete)return <Card className="p-6 space-y-5" role="alertdialog" aria-label="Delete profile"><h1 className="break-words [overflow-wrap:anywhere]">Delete {deleting.name}?</h1><p>This permanently removes this profile’s watch history, favorites and preferences. Devices using it will need to choose a profile again.</p><Feedback error={error||action.error}/><Button disabled={busy||action.busy} onClick={()=>void action.run(async()=>{await onDelete(deleting);setDeleting(undefined)},'')}>Delete profile permanently</Button><Button variant="outline" disabled={busy} onClick={()=>setDeleting(undefined)}>Keep profile</Button></Card>;
  return <Card className="p-6 space-y-5" aria-label="Choose a profile"><div className="flex items-center gap-2 text-xl font-semibold"><span className="hidden">V</span><strong>VIPTV</strong></div><h1>Profiles</h1><p className="text-sm text-muted-foreground">Manage profiles used by your TV app.</p><Feedback error={error||action.error}/>
    {!!profiles.length&&<ul className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 [&_button]:rounded-md [&_button]:border [&_button]:p-4 [&_button]:space-y-2 [&_button]:focus-visible:outline-2">{profiles.map(item=><li className="min-w-0" key={item.id}><button className="flex w-full min-w-0 flex-wrap items-center gap-3 text-left" disabled={busy||action.busy} onClick={()=>void action.run(async()=>onSelect(item.id),'')}><ProfileAvatar profile={item}/><strong className="min-w-0 flex-1 break-words [overflow-wrap:anywhere]">{item.name}</strong></button>{onUpdate&&<Button className="h-auto w-full whitespace-normal break-words [overflow-wrap:anywhere]" variant="ghost" disabled={busy} onClick={()=>setEditing(item)}>Edit {item.name}</Button>}{onDelete&&!item.is_primary&&<Button className="h-auto w-full whitespace-normal break-words [overflow-wrap:anywhere]" variant="ghost" disabled={busy} onClick={()=>setDeleting(item)}>Delete {item.name}</Button>}{item.is_primary&&<p className="text-xs text-muted-foreground">Primary profile</p>}</li>)}</ul>}
    {!profiles.length&&!creating&&<Empty title="No profiles yet">Create the first profile to start watching.</Empty>}
    {canCreate&&(creating||!profiles.length)?<ProfileForm busy={busy||action.busy} onSave={onCreate}/>:canCreate&&<Button variant="outline" onClick={()=>setCreating(true)}>Add profile</Button>}
    {creating&&profiles.length>0&&<Button variant="ghost" onClick={()=>setCreating(false)}>Cancel</Button>}<Button variant="ghost" disabled={busy} onClick={()=>void onLogout()}>Sign out</Button>
  </Card>;
}

export type Device={id?:string;name?:string;device_name?:string;device_type?:string;model?:string;status?:string;last_seen_at?:string;created_at?:string;expires_at?:string};
export type PairLookup=Device&{device?:Device;user_code?:string;expires_at?:string};
function DeviceDetails({device}:{device:Device}){return <dl className="grid gap-2 text-sm [&_dt]:text-muted-foreground"><div><dt>Device</dt><dd>{device.name||device.device_name||'Unnamed TV'}</dd></div>{device.model&&<div><dt>Model</dt><dd>{device.model}</dd></div>}{device.expires_at&&<div><dt>Expires</dt><dd>{device.expires_at}</dd></div>}</dl>}
export function DeviceActivation({api,code,onComplete,onCancel}:{api:Client;code:string;onComplete:()=>void|Promise<void>;onCancel:()=>void|Promise<void>}){
 const a=useAction();const [request,setRequest]=useState<PairLookup>();
 useEffect(()=>{setRequest(undefined);void a.run(async()=>setRequest(await api<PairLookup>('/device/lookup','POST',{user_code:code})), '');},[api,code]);
 const expired=a.error&&/expired|invalid|not found/i.test(a.error);
 return <Card className="p-6 space-y-5 space-y-4" aria-label="Confirm TV sign in"><div className="flex items-center gap-2 text-xl font-semibold"><span className="hidden">V</span><strong>VIPTV</strong></div><p className="text-sm text-muted-foreground">TV sign in</p><h1>{expired?'That code has expired':'Connect this TV?'}</h1>{request&&<><p>Only continue if this is the TV in front of you and it shows this exact code.</p><strong className="block font-mono text-2xl tracking-widest">{code}</strong><DeviceDetails device={request.device??request}/></>}<Feedback error={a.error} success={a.success}/><div className="flex flex-wrap items-center gap-2">{request&&<Button disabled={a.busy} onClick={()=>void a.run(async()=>{await api('/device/approve','POST',{user_code:code});await onComplete();},'TV connected.')}>Confirm TV sign in</Button>}<Button variant="outline" disabled={a.busy} onClick={()=>void a.run(async()=>{if(!expired)await api('/device/deny','POST',{user_code:code});await onCancel();},'')}>{expired?'Continue to profiles':'Not my TV'}</Button></div></Card>;
}

export function DeviceManagement({api,path='/devices'}:{api:Client;path?:string}){const r=useResource<Device[]>(api,path);const a=useAction();const[remove,setRemove]=useState<Device>();return <Card className="p-6 space-y-4"><div className="flex items-center justify-between gap-4"><div><p className="text-sm text-muted-foreground">Security</p><h2>Signed-in televisions</h2></div><Button variant="outline" onClick={r.reload}>Refresh</Button></div><Feedback error={a.error} success={a.success}/><Resource {...r}>{!r.data?.length?<Empty title="No televisions connected">Scan the QR code in the TV app to connect one.</Empty>:<ul className="divide-y [&_li]:flex [&_li]:items-center [&_li]:justify-between [&_li]:gap-4 [&_li]:py-4">{r.data.map((device,index)=><li key={device.id??index}><DeviceDetails device={device}/><Button variant="outline" disabled={!device.id||a.busy} onClick={()=>setRemove(device)}>Sign out TV</Button></li>)}</ul>}</Resource>{remove&&<Card role="alertdialog" aria-label="Confirm device sign out" className="space-y-4 rounded-md border p-4"><h3>Sign out this TV?</h3><p>It will need a new QR code confirmation.</p><div className="flex flex-wrap items-center gap-2"><Button variant="destructive" onClick={()=>void a.run(async()=>{await api(`${path}/${encode(remove.id!)}`,'DELETE');setRemove(undefined);r.reload();},'TV signed out.')}>Sign out TV</Button><Button variant="ghost" onClick={()=>setRemove(undefined)}>Cancel</Button></div></Card>}</Card>}

export type Account={id:string;username:string;name?:string;role?:string;enabled?:boolean};
export function AccountManagement({api}:{api:Client}){const r=useResource<Account[]>(api,'/accounts');return <Card className="p-6 space-y-4"><p className="text-sm text-muted-foreground">Administration</p><h2>Accounts</h2><p>Review service accounts. Public registration creates ordinary members; administrator access cannot be granted here.</p><Resource {...r}>{!r.data?.length?<Empty title="No accounts found"/>:<ul className="divide-y [&_li]:flex [&_li]:justify-between [&_li]:gap-4 [&_li]:py-4 [&_li_span]:block">{r.data.map(account=><li key={account.id}><div><strong>{account.name||account.username}</strong><span>@{account.username}</span></div><span className="rounded-md border px-2 py-1 text-xs">{account.role==='owner'?'Administrator':'Member'}</span></li>)}</ul>}</Resource></Card>}
export type OnboardingState={household_name?:string;timezone?:string;language?:string;completed?:boolean};
export function Onboarding({api,onDone}:{api:Client;onDone:()=>void|Promise<void>}){const r=useResource<OnboardingState>(api,'/onboarding');const a=useAction();return <Card className="p-6 space-y-4"><p className="text-sm text-muted-foreground">Service setup</p><h2>Household defaults</h2><Resource {...r}>{r.data&&<form className="grid gap-4" onSubmit={event=>{event.preventDefault();const f=new FormData(event.currentTarget);void a.run(async()=>{await api('/onboarding','PATCH',{household_name:String(f.get('household_name')).trim(),timezone:String(f.get('timezone')),language:String(f.get('language')),completed:true});await onDone();},'Setup saved.')}}><Field label="Household name" name="household_name" defaultValue={r.data.household_name}/><Field label="Timezone" name="timezone" defaultValue={r.data.timezone||Intl.DateTimeFormat().resolvedOptions().timeZone}/><Field label="Language" name="language" defaultValue={r.data.language||'en'}/><Submit busy={a.busy}>Save defaults</Submit><Feedback error={a.error} success={a.success}/></form>}</Resource></Card>}
