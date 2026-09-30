// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import AccountApp from './AccountApp';

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); localStorage.clear(); sessionStorage.clear(); history.replaceState({}, '', '/'); });
const json=(value:unknown,status=200)=>new Response(JSON.stringify(value),{status});
const connection={id:1,name:'Fixture IPTV',enabled:true,enable_live:true,enable_movies:true,enable_series:true,credentials_encrypted:true,refresh:{state:'completed'}};
const gateway={id:'gateway1',name:'Fixture gateway',endpoint:'https://gateway.example/',namespace:'fixture',priority:100,enabled:true,revision:1,can_manage:true};
function fixture() {
  const state={locked:false,profile:'1' as string|null,account:'1',role:'owner',revoked:''};
  const saves:{path:string;body:unknown}[]=[];
  const fetch=vi.fn(async(path:string,request?:RequestInit)=>{
    const method=request?.method??'GET';const body=request?.body?JSON.parse(String(request.body)):undefined;
    if(path==='/api/auth/status')return json({authenticated:true,csrf_token:'fixture'});
    if(path==='/api/auth/me')return json({account:{id:state.account,name:'Fixture account',username:'fixture',role:state.role},profile_id:state.profile,restricted:false});
    if(path==='/api/auth/refresh')return json({error:'Session expired'},401);
    if(path==='/api/profiles')return json([{id:'1',name:'Viewer',setup_complete:true},{id:'2',name:'Other profile',setup_complete:true}]);
    if(path==='/api/auth/profile'){state.profile=body.profile_id;state.locked=false;return json({})}
    if(path==='/api/parent/unlock'){
      if(state.revoked==='session')return json({error:'Session expired'},401);
      if(state.revoked==='profile')return json({error:'Profile revoked',error_code:'profile_revoked'},403);
      if(body.pin!=='1234')return json({error:'Incorrect parent PIN',error_code:'invalid_parent_pin'},403);
      state.locked=false;return json({unlocked:true});
    }
    const save=method!=='GET'&&['/api/v2/iptv/connections','/api/v2/addons','/api/v2/gateways','/api/v2/iptv/matches','/api/v2/gateways/gateway1/grants'].includes(path);
    if(save){
      saves.push({path,body});
      if(saves.length===1){state.locked=true;return json({error:'Parent PIN required',error_code:'parent_required'},403)}
      if(path.includes('/grants'))return json({ok:true});
      if(path.includes('/connections'))return json({...connection,id:2,name:body.name});
      if(path==='/api/v2/addons')return json({id:8,name:'Added add-on',enabled:true,credentials_encrypted:true});
      if(path==='/api/v2/gateways')return json({...gateway,id:'new',name:body.name});
      return json({ok:true});
    }
    if(path.startsWith('/api/v2/iptv/connections?'))return json({items:[connection],next_cursor:null});
    if(path==='/api/v2/iptv/live-default')return json({catalog_id:1});
    if(path.startsWith('/api/v2/addons?'))return json({items:[],next_cursor:null});
    if(path==='/api/v2/gateways')return json({items:[gateway],secret_storage_configured:true});
    if(path.includes('/grants?'))return json({items:[],next_cursor:null});
    if(path.startsWith('/api/v2/iptv/matches?'))return json({items:[{vod_id:'vod:1:1',provider_id:1,name:'Fixture title',type:'movie',year:2020}],next_cursor:null});
    if(path.endsWith('/preferences'))return json({audio_language:'en',subtitle_language:'en',subtitles_enabled:false,subtitle_size:'normal',subtitle_style:'system',autoplay:false});
    if(path==='/api/parent/status')return json({pin_configured:false,unlocked:true,restricted:false});
    if(path.endsWith('/kids'))return json({enabled:false,max_age:12});
    if(path.endsWith('/approvals'))return json([]);
    return json({});
  });
  vi.stubGlobal('fetch',fetch);return {state,fetch,saves};
}
const cases=[
  {kind:'Xtream',page:'Xtream connections',opener:'Add Xtream connection',submit:'Save connection',field:'Password',value:'draft-password',fields:[['Connection name','Draft TV'],['Server URL','http://provider.example'],['Username','draft-user'],['Password','draft-password']]},
  {kind:'add-on',page:'Add-ons',opener:'Add add-on',submit:'Add add-on',field:'Manifest URL',value:'https://addon.example/private-fixture/manifest.json',fields:[['Manifest URL','https://addon.example/private-fixture/manifest.json']]},
  {kind:'gateway',page:'Gateways',opener:'Add gateway',submit:'Save gateway',field:'New integration key',value:'pgk_'+'a'.repeat(64),fields:[['Gateway name','Draft gateway'],['HTTPS endpoint','https://gateway.example/'],['Namespace','fixture'],['New integration key','pgk_'+'a'.repeat(64)]]},
  {kind:'match',page:'VOD matches',opener:'Match title',submit:'Save match',field:'Metadata ID',value:'tt0133093',fields:[['Metadata ID','tt0133093']]},
];
async function prepare(item:typeof cases[number]) {
  await screen.findByRole('navigation',{name:'Main navigation'});
  fireEvent.click(screen.getByRole('button',{name:item.page}));
  fireEvent.click(await screen.findByRole('button',{name:item.opener}));
  for(const[label,value]of item.fields)fireEvent.change(screen.getByLabelText(label),{target:{value}});
}
async function pin(value='1234') {
  fireEvent.change(await screen.findByLabelText('Parent PIN'),{target:{value}});
  fireEvent.click(screen.getByRole('button',{name:'Unlock'}));
}
describe('same-profile drafts through parent authorization',()=>{
  it.each(cases)('preserves $kind draft through a late challenge and wrong PIN without replay or storage',async item=>{
    const f=fixture();const stored=vi.spyOn(Storage.prototype,'setItem');render(<AccountApp/>);await prepare(item);
    const dialog=screen.getByRole('dialog');fireEvent.click(within(dialog).getByRole('button',{name:item.submit}));
    const input=await screen.findByLabelText('Parent PIN');await waitFor(()=>expect(input).toHaveFocus());
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(0);
    expect(screen.queryByLabelText(item.field)).not.toBeInTheDocument();expect(f.saves).toHaveLength(1);
    // Even programmatic activation of an inert background control cannot issue API work.
    const refresh=[...document.querySelectorAll('button')].find(button=>button.textContent==='Refresh list');
    const before=f.fetch.mock.calls.length;if(refresh){fireEvent.click(refresh);await act(async()=>{await Promise.resolve()});expect(f.fetch).toHaveBeenCalledTimes(before)}
    await pin('0000');expect(await screen.findByRole('alert')).toHaveTextContent('Incorrect parent PIN');expect(screen.getByLabelText('Parent PIN')).toHaveValue('');
    await waitFor(()=>expect(screen.getByLabelText('Parent PIN')).toHaveFocus());expect(f.saves).toHaveLength(1);
    await pin();expect(await screen.findByLabelText(item.field)).toHaveValue(item.value);expect(f.saves).toHaveLength(1);
    await waitFor(()=>expect(screen.getByRole('dialog')).toContainElement(document.activeElement as HTMLElement));
    expect(stored).not.toHaveBeenCalled();
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button',{name:item.submit}));
    await waitFor(()=>expect(f.saves).toHaveLength(2));expect(f.saves[1].body).toEqual(f.saves[0].body);
  });
  it('cancelling the challenge discards secrets before choosing a profile again',async()=>{
    const f=fixture();render(<AccountApp/>);await prepare(cases[0]);fireEvent.click(screen.getByRole('button',{name:'Save connection'}));
    await screen.findByLabelText('Parent PIN');fireEvent.click(screen.getByRole('button',{name:'Cancel'}));
    fireEvent.click(await screen.findByRole('button',{name:'Viewer'}));
    await screen.findByRole('navigation');fireEvent.click(screen.getByRole('button',{name:'Xtream connections'}));fireEvent.click(await screen.findByRole('button',{name:'Add Xtream connection'}));
    expect(screen.getByLabelText('Password')).toHaveValue('');expect(screen.getByLabelText('Connection name')).toHaveValue('');expect(f.saves).toHaveLength(1);
  });
  it.each(['session','profile'])('%s revocation while entering PIN discards protected drafts',async revoked=>{
    const f=fixture();render(<AccountApp/>);await prepare(cases[2]);fireEvent.click(screen.getByRole('button',{name:'Save gateway'}));await screen.findByLabelText('Parent PIN');
    f.state.revoked=revoked;await pin();
    if(revoked==='session')expect(await screen.findByRole('heading',{name:'Sign in'})).toBeInTheDocument();
    else expect(await screen.findByRole('button',{name:'Viewer'})).toBeInTheDocument();
    expect(screen.queryByLabelText('New integration key')).not.toBeInTheDocument();expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(0);expect(f.saves).toHaveLength(1);
  });
  it.each(['profile','account','role'])('discards drafts when authoritative $kind changed before PIN success',async kind=>{
    const f=fixture();render(<AccountApp/>);await prepare(cases[2]);fireEvent.click(screen.getByRole('button',{name:'Save gateway'}));await screen.findByLabelText('Parent PIN');
    if(kind==='profile')f.state.profile='2';if(kind==='account')f.state.account='2';if(kind==='role')f.state.role='member';
    await pin();expect(await screen.findByRole('button',{name:'Viewer'})).toBeInTheDocument();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();expect(screen.queryByLabelText('New integration key')).not.toBeInTheDocument();expect(f.saves).toHaveLength(1);
  });
  it('preserves an operator grant confirmation while its portal is suspended',async()=>{
    const f=fixture();render(<AccountApp/>);await screen.findByRole('navigation');fireEvent.click(screen.getByRole('button',{name:'Gateway grants'}));
    fireEvent.click(await screen.findByRole('button',{name:'Manage grants for Fixture gateway'}));
    fireEvent.change(await screen.findByLabelText('Account ID'),{target:{value:'9'}});fireEvent.click(screen.getByRole('button',{name:'Grant access'}));fireEvent.click(screen.getByRole('button',{name:'Confirm grant'}));
    await screen.findByLabelText('Parent PIN');await pin();expect(await screen.findByLabelText('Account ID')).toHaveValue(9);
    expect(screen.getByRole('button',{name:'Confirm grant'})).toBeInTheDocument();expect(f.saves).toHaveLength(1);
  });
  it('ignores duplicate PIN and save submissions while preserving the pending draft',async()=>{
    const f=fixture();render(<AccountApp/>);await prepare(cases[0]);fireEvent.click(screen.getByRole('button',{name:'Save connection'}));await screen.findByLabelText('Parent PIN');
    const ordinary=f.fetch.getMockImplementation()!;let unlock!:(value:Response)=>void;
    f.fetch.mockImplementation((path,request)=>path==='/api/parent/unlock'?new Promise(resolve=>{unlock=resolve}):ordinary(path,request));
    const input=screen.getByLabelText('Parent PIN');fireEvent.change(input,{target:{value:'1234'}});fireEvent.submit(input.closest('form')!);fireEvent.submit(input.closest('form')!);
    expect(f.fetch.mock.calls.filter(([path])=>path==='/api/parent/unlock')).toHaveLength(1);expect(screen.getByRole('button',{name:'Unlocking…'})).toBeDisabled();
    await act(async()=>unlock(json({unlocked:true})));await screen.findByLabelText('Password');
    let save!:(value:Response)=>void;f.fetch.mockImplementation((path,request)=>path==='/api/v2/iptv/connections'&&request?.method==='POST'?new Promise(resolve=>{save=resolve}):ordinary(path,request));
    const form=screen.getByLabelText('Password').closest('form')!;fireEvent.submit(form);fireEvent.submit(form);
    expect(f.fetch.mock.calls.filter(([path,request])=>path==='/api/v2/iptv/connections'&&request?.method==='POST')).toHaveLength(2);
    expect(screen.getByLabelText('Password')).toBeDisabled();await act(async()=>save(json({...connection,id:2,name:'Draft TV'})));
  });
});
