// @vitest-environment jsdom
import {afterEach,describe,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import {AccountManagement,AuthScreen,DeviceActivation,DeviceManagement,Onboarding,ProfileAvatar,ProfileScreen,avatarUrl} from './AccountScreens';

afterEach(()=>{cleanup();vi.restoreAllMocks()});
const profile={id:'p1',name:'Alex Doe',avatar_style:'critters',avatar_seed:'alex'};
const props=()=>({onSelect:vi.fn(),onCreate:vi.fn(),onUpdate:vi.fn(),onLogout:vi.fn(),busy:false});
describe('public authentication',()=>{
 it('registers a public account without claim or token fields',async()=>{const onSubmit=vi.fn();render(<AuthScreen mode="register" onSubmit={onSubmit} onMode={vi.fn()} busy={false}/>);fireEvent.change(screen.getByLabelText('Display name'),{target:{value:'Alex'}});fireEvent.change(screen.getByLabelText('Username'),{target:{value:'alex'}});fireEvent.change(screen.getByLabelText('Password'),{target:{value:'long-password'}});fireEvent.change(screen.getByLabelText('Confirm password'),{target:{value:'long-password'}});fireEvent.click(screen.getByRole('button',{name:'Create your account'}));await waitFor(()=>expect(onSubmit).toHaveBeenCalledWith({name:'Alex',username:'alex',password:'long-password'}));expect(screen.queryByLabelText(/token/i)).not.toBeInTheDocument()});
 it('preserves and displays a TV code while switching auth modes',()=>{const onMode=vi.fn();render(<AuthScreen mode="login" onSubmit={vi.fn()} onMode={onMode} busy={false} deviceCode="ABCD1234"/>);expect(screen.getByText(/ABCD1234/)).toBeInTheDocument();fireEvent.click(screen.getByRole('button',{name:'Create account'}));expect(onMode).toHaveBeenCalledWith('register')});
 it('blocks mismatched registration passwords',async()=>{const onSubmit=vi.fn();render(<AuthScreen mode="register" onSubmit={onSubmit} onMode={vi.fn()} busy={false}/>);for(const[label,value]of[['Display name','A'],['Username','alex'],['Password','long-password'],['Confirm password','different-pass']])fireEvent.change(screen.getByLabelText(label),{target:{value}});fireEvent.click(screen.getByRole('button',{name:'Create your account'}));expect(await screen.findByRole('alert')).toHaveTextContent('Passwords do not match');expect(onSubmit).not.toHaveBeenCalled()});
});
describe('profile gateway',()=>{
 it('renders allowlisted DiceBear images with no-referrer and initials fallback',()=>{const {container}=render(<ProfileAvatar profile={profile}/>);const image=container.querySelector('img')!;expect(image).toHaveAttribute('src','https://api.dicebear.com/10.x/critters/png?seed=alex&size=256');expect(image).toHaveAttribute('referrerpolicy','no-referrer');fireEvent.error(image);expect(screen.getByText('AD')).toBeInTheDocument();expect(avatarUrl('unsafe','x')).toBeUndefined()});
 it('creates the first zero-profile viewer with selected avatar style',async()=>{const p=props();render(<ProfileScreen {...p} profiles={[]} canCreate/>);fireEvent.change(screen.getByLabelText('Profile name'),{target:{value:'Kid'}});fireEvent.click(screen.getByLabelText('Pixel hero'));fireEvent.click(screen.getByRole('button',{name:'Create profile'}));await waitFor(()=>expect(p.onCreate).toHaveBeenCalledWith('Kid','pixel-art'));expect(p.onSelect).not.toHaveBeenCalled()});
 it('selects only when the viewer clicks a profile',async()=>{const p=props();render(<ProfileScreen {...p} profiles={[profile]} canCreate/>);expect(p.onSelect).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'Alex Doe'}));await waitFor(()=>expect(p.onSelect).toHaveBeenCalledWith('p1'))});
 it('forces imported profiles through presentation setup without changing identity',async()=>{const p=props();const imported={...profile,name:'Default',setup_complete:false};render(<ProfileScreen {...p} profiles={[imported]} canCreate/>);expect(screen.getByRole('heading',{name:'Make this profile yours'})).toBeInTheDocument();expect(screen.getByLabelText('Profile name')).toHaveValue('');fireEvent.change(screen.getByLabelText('Profile name'),{target:{value:'Owner'}});fireEvent.click(screen.getByLabelText('Friend'));fireEvent.click(screen.getByRole('button',{name:'Save profile'}));await waitFor(()=>expect(p.onUpdate).toHaveBeenCalledWith(imported,'Owner','lorelei'))});
});
describe('TV activation',()=>{
 it('looks up and confirms for the signed-in account with one click',async()=>{const api=vi.fn().mockImplementation(async(path:string)=>path==='/device/lookup'?{device:{device_name:'Living room Roku',model:'Ultra'}}:{});const done=vi.fn();render(<DeviceActivation api={api} code="ABCD1234" onComplete={done} onCancel={vi.fn()}/>);expect(await screen.findByText('Living room Roku')).toBeInTheDocument();expect(api).toHaveBeenCalledWith('/device/lookup','POST',{user_code:'ABCD1234'});expect(screen.queryByLabelText(/Target account/i)).not.toBeInTheDocument();fireEvent.click(screen.getByRole('button',{name:'Confirm TV sign in'}));await waitFor(()=>expect(api).toHaveBeenCalledWith('/device/approve','POST',{user_code:'ABCD1234'}));await waitFor(()=>expect(done).toHaveBeenCalled())});
 it('explicitly denies a TV the account does not recognize',async()=>{const cancel=vi.fn();const api=vi.fn().mockImplementation(async(path:string)=>path==='/device/lookup'?{device_name:'Unknown Roku'}:{});render(<DeviceActivation api={api} code="NOTMINE1" onComplete={vi.fn()} onCancel={cancel}/>);await screen.findByText('Unknown Roku');fireEvent.click(screen.getByRole('button',{name:'Not my TV'}));await waitFor(()=>expect(api).toHaveBeenCalledWith('/device/deny','POST',{user_code:'NOTMINE1'}));expect(cancel).toHaveBeenCalled()});
 it('explains an expired code and safely continues',async()=>{const cancel=vi.fn();const api=vi.fn().mockRejectedValue(new Error('Invalid or expired pairing code'));render(<DeviceActivation api={api} code="EXPIRED1" onComplete={vi.fn()} onCancel={cancel}/>);expect(await screen.findByRole('heading',{name:'That code has expired'})).toBeInTheDocument();fireEvent.click(screen.getByRole('button',{name:'Continue to profiles'}));expect(cancel).toHaveBeenCalled()});
});
it('revokes account-owned devices through an explicit confirmation',async()=>{const api=vi.fn().mockResolvedValue([{id:'tv/1',device_name:'Bedroom Roku'}]);render(<DeviceManagement api={api}/>);fireEvent.click(await screen.findByRole('button',{name:'Sign out TV'}));expect(screen.getByRole('alertdialog')).toBeInTheDocument();fireEvent.click(screen.getAllByRole('button',{name:'Sign out TV'})[1]);await waitFor(()=>expect(api).toHaveBeenCalledWith('/devices/tv%2F1','DELETE'))});
it('shows owner account inventory without account creation or role escalation',async()=>{const api=vi.fn().mockResolvedValue([{id:'a1',username:'viewer',name:'Viewer',role:'member'}]);render(<AccountManagement api={api}/>);expect(await screen.findByText('@viewer')).toBeInTheDocument();expect(screen.queryByRole('button',{name:/create account/i})).not.toBeInTheDocument();expect(screen.queryByRole('option',{name:/owner|administrator/i})).not.toBeInTheDocument()});
it('keeps owner service defaults available',async()=>{const api=vi.fn().mockResolvedValue({household_name:'Home',timezone:'UTC',language:'en'});render(<Onboarding api={api} onDone={vi.fn()}/>);expect(await screen.findByLabelText('Household name')).toHaveValue('Home');fireEvent.click(screen.getByRole('button',{name:'Save defaults'}));await waitFor(()=>expect(api).toHaveBeenCalledWith('/onboarding','PATCH',{household_name:'Home',timezone:'UTC',language:'en',completed:true}))});
const profiles=[{id:'1',name:'Primary',is_primary:true},{id:'2',name:'Guest',is_primary:false}];
describe('household profile management',()=>{
 it('edits an existing profile without selecting it',async()=>{
 const update=vi.fn();const select=vi.fn();
 render(<ProfileScreen profiles={profiles} canCreate onSelect={select} onCreate={vi.fn()} onUpdate={update} onDelete={vi.fn()} onLogout={vi.fn()} busy={false}/>);
 fireEvent.click(screen.getByRole('button',{name:'Edit Guest'}));
 fireEvent.change(screen.getByLabelText('Profile name'),{target:{value:'Family'}});
 fireEvent.click(screen.getByRole('button',{name:'Save profile'}));
 await screen.findByRole('button',{name:'Edit Guest'});
 expect(update).toHaveBeenCalledWith(profiles[1],'Family','critters');expect(select).not.toHaveBeenCalled();
 });
 it('protects primary and confirms deletion with an explicit cancel path',async()=>{
 const remove=vi.fn();
 render(<ProfileScreen profiles={profiles} canCreate onSelect={vi.fn()} onCreate={vi.fn()} onUpdate={vi.fn()} onDelete={remove} onLogout={vi.fn()} busy={false}/>);
 expect(screen.queryByRole('button',{name:'Delete Primary'})).not.toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'Delete Guest'}));
 expect(remove).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'Keep profile'}));
 expect(remove).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'Delete Guest'}));
 fireEvent.click(screen.getByRole('button',{name:'Delete profile permanently'}));
 await screen.findByRole('button',{name:'Edit Guest'});expect(remove).toHaveBeenCalledWith(profiles[1]);
 });
});
