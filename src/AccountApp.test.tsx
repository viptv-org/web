// @vitest-environment jsdom
import {afterEach,describe,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import AccountApp from './AccountApp';
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status});
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.unstubAllGlobals();history.replaceState({},'','/');localStorage.clear();sessionStorage.clear()});
function baseFetch({authenticated=false,profiles=[{id:'p1',name:'Viewer',avatar_style:'critters',avatar_seed:'v'}]}:{authenticated?:boolean;profiles?:any[]}={}){return vi.fn(async(url:string,init?:RequestInit)=>{if(url==='/api/auth/status')return json({authenticated,csrf_token:'anon'});if(url==='/api/auth/login'||url==='/api/auth/register')return json({csrf_token:'session'});if(url==='/api/auth/me')return json({account:{id:'a1',name:'Alex',username:'alex',role:'member'},can_create_profile:true});if(url==='/api/profiles'&&init?.method==='POST'){const created={id:'new',name:'Kid',avatar_style:'pixel-art',avatar_seed:'kid'};profiles.push(created);return json(created)}if(url==='/api/profiles')return json(profiles);if(url==='/api/catalogs')return json([]);if(url.startsWith('/api/discover'))return json({metas:[]});if(url==='/api/devices')return json([]);return json({})})}
async function login(){fireEvent.change(await screen.findByLabelText('Username'),{target:{value:'alex'}});fireEvent.change(screen.getByLabelText('Password'),{target:{value:'long-password'}});fireEvent.click(screen.getByRole('button',{name:'Sign in'}))}
describe('public account-only dashboard',()=>{
 it('starts an unlinked TV at code entry, then carries the code through sign-in',async()=>{history.replaceState({},'','/device');const f=baseFetch();f.mockImplementation(async(url:string,init?:RequestInit)=>url==='/api/device/lookup'?json({device_name:'Living room TV'}):baseFetch()(url,init));vi.stubGlobal('fetch',f);render(<AccountApp/>);expect(screen.getByRole('heading',{name:'Link your TV'})).toBeInTheDocument();expect(f).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'Link TV'}));expect(screen.getByRole('alert')).toHaveTextContent('Enter the 6–12 character code');fireEvent.change(screen.getByLabelText('Code'),{target:{value:'ab12cd34'}});fireEvent.click(screen.getByRole('button',{name:'Link TV'}));expect(location.pathname+location.search).toBe('/device?code=AB12CD34');await screen.findByRole('heading',{name:'Sign in'});await login();expect(await screen.findByText('Living room TV')).toBeInTheDocument()});
 it('offers sign in and public registration with no legacy token path',async()=>{const f=baseFetch();vi.stubGlobal('fetch',f);render(<AccountApp/>);expect(await screen.findByRole('heading',{name:'Sign in'})).toBeInTheDocument();fireEvent.click(screen.getByRole('button',{name:'Create account'}));expect(screen.getByRole('heading',{name:'Create your account'})).toBeInTheDocument();expect(screen.queryByText(/legacy/i)).not.toBeInTheDocument();expect(screen.queryByLabelText(/token/i)).not.toBeInTheDocument()});
 it('registers, requires recovery acknowledgement, then opens zero-profile creation',async()=>{const profiles:any[]=[];const f=baseFetch({profiles});f.mockImplementation(async(url:string,init?:RequestInit)=>{if(url==='/api/auth/register')return json({csrf_token:'session',recovery_codes:['save-this-code']});return baseFetch({profiles})(url,init)});vi.stubGlobal('fetch',f);const stored=vi.spyOn(Storage.prototype,'setItem');render(<AccountApp/>);fireEvent.click(await screen.findByRole('button',{name:'Create account'}));for(const[label,value]of[['Display name','Alex'],['Username','alex'],['Password','long-password'],['Confirm password','long-password']])fireEvent.change(screen.getByLabelText(label),{target:{value}});fireEvent.click(screen.getByRole('button',{name:'Create your account'}));expect(await screen.findByText('save-this-code')).toBeInTheDocument();expect(screen.queryByLabelText('Profile name')).not.toBeInTheDocument();fireEvent.click(screen.getByRole('button',{name:"I've saved my recovery codes"}));expect(await screen.findByLabelText('Profile name')).toBeInTheDocument();expect(f).toHaveBeenCalledWith('/api/auth/register',expect.objectContaining({body:'{"username":"alex","password":"long-password","name":"Alex"}'}));expect(stored).not.toHaveBeenCalled()});
 it('creates a profile with avatar style and selects only the returned ID',async()=>{const profiles:any[]=[];const f=baseFetch({profiles});vi.stubGlobal('fetch',f);render(<AccountApp/>);await login();fireEvent.change(await screen.findByLabelText('Profile name'),{target:{value:'Kid'}});fireEvent.click(screen.getByLabelText('Pixel hero'));fireEvent.click(screen.getByRole('button',{name:'Create profile'}));expect(await screen.findByRole('navigation',{name:'Main navigation'})).toBeInTheDocument();expect(f).toHaveBeenCalledWith('/api/profiles',expect.objectContaining({method:'POST',body:'{"name":"Kid","avatar_style":"pixel-art"}'}));expect(f).toHaveBeenCalledWith('/api/auth/profile',expect.objectContaining({body:'{"profile_id":"new"}'}))});
 it('keeps a deep-link code through login and confirms it without target grants',async()=>{history.replaceState({},'','/device?code=abcd1234');const f=baseFetch();f.mockImplementation(async(url:string,init?:RequestInit)=>{if(url==='/api/device/lookup')return json({device:{device_name:'Living room Roku'}});return baseFetch()(url,init)});vi.stubGlobal('fetch',f);render(<AccountApp/>);expect(await screen.findByText(/ABCD1234/)).toBeInTheDocument();await login();expect(await screen.findByText('Living room Roku')).toBeInTheDocument();fireEvent.click(screen.getByRole('button',{name:'Confirm TV sign in'}));await waitFor(()=>expect(f).toHaveBeenCalledWith('/api/device/approve',expect.objectContaining({body:'{"user_code":"ABCD1234"}'})));expect(String(f.mock.calls)).not.toContain('profile-grants');expect(String(f.mock.calls)).not.toContain('account_id')});
 it('preserves a TV code through registration and recovery-code acknowledgement',async()=>{history.replaceState({},'','/device?code=JOIN1234');const base=baseFetch({profiles:[]});const f=vi.fn(async(url:string,init?:RequestInit)=>url==='/api/auth/register'?json({csrf_token:'session',recovery_codes:['safe-code']}):url==='/api/device/lookup'?json({device_name:'Kids room Roku'}):base(url,init));vi.stubGlobal('fetch',f);render(<AccountApp/>);fireEvent.click(await screen.findByRole('button',{name:'Create account'}));for(const[label,value]of[['Display name','Alex'],['Username','alex'],['Password','long-password'],['Confirm password','long-password']])fireEvent.change(screen.getByLabelText(label),{target:{value}});fireEvent.click(screen.getByRole('button',{name:'Create your account'}));await screen.findByText('safe-code');fireEvent.click(screen.getByRole('button',{name:"I've saved my recovery codes"}));expect(await screen.findByText('Kids room Roku')).toBeInTheDocument();expect(screen.getByText('JOIN1234')).toBeInTheDocument()});
 it('sends an already authenticated activation link directly to confirmation',async()=>{history.replaceState({},'','/activate?code=READY123');const f=baseFetch({authenticated:true});f.mockImplementation(async(url:string,init?:RequestInit)=>url==='/api/device/lookup'?json({device_name:'Bedroom Roku'}):baseFetch({authenticated:true})(url,init));vi.stubGlobal('fetch',f);render(<AccountApp/>);expect(await screen.findByText('Bedroom Roku')).toBeInTheDocument();expect(screen.queryByRole('heading',{name:'Sign in'})).not.toBeInTheDocument()});
 it('patches imported profile presentation while preserving its ID',async()=>{const imported=[{id:'42',name:'Default',setup_complete:false}];const f=baseFetch({profiles:imported});vi.stubGlobal('fetch',f);render(<AccountApp/>);await login();expect(await screen.findByRole('heading',{name:'Make this profile yours'})).toBeInTheDocument();fireEvent.change(screen.getByLabelText('Profile name'),{target:{value:'Owner'}});fireEvent.click(screen.getByRole('button',{name:'Save profile'}));await waitFor(()=>expect(f).toHaveBeenCalledWith('/api/profiles/42',expect.objectContaining({method:'PATCH',body:'{"name":"Owner","avatar_style":"critters","setup_complete":true}'})))});
 it('restores only a server-selected profile without browser storage',async()=>{const f=baseFetch({authenticated:true});f.mockImplementation(async(url:string,init?:RequestInit)=>url==='/api/auth/me'?json({account:{id:'a1',name:'Alex',username:'alex',role:'member'},profile_id:'p1'}):baseFetch({authenticated:true})(url,init));const stored=vi.spyOn(Storage.prototype,'setItem');vi.stubGlobal('fetch',f);render(<AccountApp/>);expect(await screen.findByRole('navigation',{name:'Main navigation'})).toBeInTheDocument();expect(screen.getByText('Viewer',{selector:'span'})).toBeInTheDocument();expect(stored).not.toHaveBeenCalled()});
 it('shows grouped settings and retains owner administration',async()=>{const f=baseFetch({authenticated:true});f.mockImplementation(async(url:string,init?:RequestInit)=>url==='/api/auth/me'?json({account:{id:'a1',name:'Owner',username:'owner',role:'owner'},can_create_profile:true}):baseFetch({authenticated:true})(url,init));vi.stubGlobal('fetch',f);render(<AccountApp/>);fireEvent.click(await screen.findByRole('button',{name:'Viewer'}));await screen.findByRole('navigation',{name:'Main navigation'});fireEvent.click(screen.getByRole('button',{name:'Account'}));expect(await screen.findByRole('heading',{name:'Signed-in televisions'})).toBeInTheDocument();expect(screen.getByRole('button',{name:'Providers'})).toBeInTheDocument();expect(screen.getByRole('button',{name:'Manage profiles'})).toBeInTheDocument()});
 it('shows members account addons and requires logout confirmation',async()=>{
 const f=baseFetch({authenticated:true});vi.stubGlobal('fetch',f);render(<AccountApp/>);
 fireEvent.click(await screen.findByRole('button',{name:'Viewer'}));
 await screen.findByRole('navigation',{name:'Main navigation'});
 expect(screen.getByRole('button',{name:'Addons'})).toBeInTheDocument();
 expect(screen.queryByRole('button',{name:'Providers'})).not.toBeInTheDocument();
 expect(screen.queryByRole('button',{name:'Discover'})).not.toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'Sign out'}));
 await screen.findByRole('dialog',{name:'Sign out?'});
 expect(f.mock.calls.some(([path])=>path==='/api/auth/logout')).toBe(false);
 fireEvent.click(screen.getByRole('button',{name:'Cancel'}));
 expect(screen.getByRole('navigation')).toBeInTheDocument();
 });
});
it('gates restricted management and retries the exact protected profile after PIN entry',async()=>{
 let unlocked=false;let selected='kid';
 const profiles=[{id:'kid',name:'Child',kids:true},{id:'adult',name:'Parent'}];
 const f=vi.fn(async(url:string,init?:RequestInit)=>{
 if(url==='/api/auth/me')return json({account:{id:'a1',name:'Alex',username:'alex',role:'owner'},profile_id:selected,restricted:selected==='kid'});
 if(url==='/api/parent/unlock'){unlocked=true;return json({unlocked:true})}
 if(url==='/api/auth/profile'){if(!unlocked)return json({error:'Parent PIN required',error_code:'parent_required'},403);selected=JSON.parse(String(init?.body)).profile_id;return json({})}
 return baseFetch({authenticated:true,profiles})(url,init);
 });
 vi.stubGlobal('fetch',f);render(<AccountApp/>);
 expect(await screen.findByRole('heading',{name:'Parent access'})).toBeInTheDocument();
 expect(f.mock.calls.some(([path])=>path==='/api/devices'||path==='/api/providers')).toBe(false);
 fireEvent.click(screen.getByRole('button',{name:'Cancel'}));fireEvent.click(await screen.findByRole('button',{name:'Parent'}));
 fireEvent.change(await screen.findByLabelText('Parent PIN'),{target:{value:'1234'}});fireEvent.click(screen.getByRole('button',{name:'Unlock'}));
 await screen.findByRole('navigation',{name:'Main navigation'});expect(selected).toBe('adult');
 expect(f.mock.calls.filter(([path])=>path==='/api/auth/profile')).toHaveLength(2);
});
it('preserves the session when cancelling protected sign-out and retries only after unlock',async()=>{
 let unlocked=false;let logoutCalls=0;
 const f=vi.fn(async(url:string,init?:RequestInit)=>{
 if(url==='/api/auth/me')return json({account:{id:'a1',name:'Alex',username:'alex',role:'member'},profile_id:'p1'});
 if(url==='/api/auth/logout'){logoutCalls++;return unlocked?json({}):json({error:'Parent PIN required',error_code:'parent_required'},403)}
 if(url==='/api/parent/unlock'){unlocked=true;return json({unlocked:true})}
 return baseFetch({authenticated:true})(url,init);
 });
 vi.stubGlobal('fetch',f);render(<AccountApp/>);await screen.findByRole('navigation');
 fireEvent.click(screen.getByRole('button',{name:'Sign out'}));fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button',{name:'Sign out'}));
 await screen.findByLabelText('Parent PIN');fireEvent.click(screen.getByRole('button',{name:'Cancel'}));
 expect(await screen.findByRole('navigation')).toBeInTheDocument();expect(logoutCalls).toBe(1);
 fireEvent.click(screen.getByRole('button',{name:'Sign out'}));fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button',{name:'Sign out'}));
 fireEvent.change(await screen.findByLabelText('Parent PIN'),{target:{value:'1234'}});fireEvent.click(screen.getByRole('button',{name:'Unlock'}));
 await screen.findByRole('heading',{name:'Sign in'});expect(logoutCalls).toBe(3);
});
it('discards account content and returns to profile selection when policy changes',async()=>{
 const f=vi.fn(async(url:string,init?:RequestInit)=>{
 if(url==='/api/auth/me')return json({account:{id:'a1',name:'Alex',username:'alex',role:'member'},profile_id:'p1'});
 if(url==='/api/devices')return json({error:'Profile policy changed',error_code:'profile_policy_changed'},403);
 return baseFetch({authenticated:true})(url,init);
 });
 vi.stubGlobal('fetch',f);render(<AccountApp/>);
 expect(await screen.findByRole('button',{name:'Viewer'})).toBeInTheDocument();
 expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
});
