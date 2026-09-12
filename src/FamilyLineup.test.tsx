// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {FamilyLineup} from './FamilyLineup';
import type {Client} from './lib/api';
afterEach(()=>{cleanup();vi.restoreAllMocks()});

it('creates an East channel only after owner verifies its candidate',async()=>{
 const api=vi.fn(async(path:string,method='GET')=>{
  if(path==='/lineup'&&method==='GET')return{settings:{enabled:false,limit:100},channels:[]};
  if(path.startsWith('/lineup/candidates'))return{candidates:[{id:'iptv:1:1',name:'Cartoon Network East',provider:'One',available:true}]};
  return{};
 });
 render(<FamilyLineup api={api as Client}/>);
 fireEvent.click(await screen.findByRole('button',{name:'Add channel'}));
 fireEvent.change(screen.getByLabelText('Channel name'),{target:{value:'Cartoon Network East'}});
 fireEvent.change(screen.getByLabelText('Network or station'),{target:{value:'Cartoon Network'}});
 fireEvent.change(screen.getByLabelText('Feed'),{target:{value:'east'}});
 fireEvent.click(await screen.findByLabelText('Cartoon Network East · One'));
 expect(screen.getByRole('button',{name:'Save channel'})).toBeDisabled();
 fireEvent.click(screen.getByLabelText(/I verified/));
 fireEvent.click(screen.getByRole('button',{name:'Save channel'}));
 await waitFor(()=>expect(api).toHaveBeenCalledWith('/lineup','POST',expect.objectContaining({feed:'east',network:'Cartoon Network',candidates:[expect.objectContaining({id:'iptv:1:1',verified:true})]})));
});

it('edits channel number and visibility while preserving its identity and empty candidates',async()=>{
 const channel={id:'family:news-west',name:'News West',network:'News',feed:'west',market:'',category:'News',number:2,enabled:true,candidates:[]};
 const api=vi.fn(async(path:string,method='GET')=>{
  if(path==='/lineup'&&method==='GET')return{settings:{enabled:true,limit:100},channels:[channel]};
  if(path.startsWith('/lineup/candidates'))return{candidates:[]};
  return{};
 });
 render(<FamilyLineup api={api as Client}/>);
 fireEvent.click(await screen.findByRole('button',{name:'Edit News West'}));
 expect(screen.getByLabelText('Feed')).toBeDisabled();
 expect(screen.getByText(/No candidates. The channel/)).toBeInTheDocument();
 fireEvent.change(screen.getByLabelText('Channel number'),{target:{value:'7'}});
 fireEvent.click(screen.getByLabelText('Visible on TV'));
 fireEvent.click(screen.getByRole('button',{name:'Save channel'}));
 await waitFor(()=>expect(api).toHaveBeenCalledWith('/lineup/family%3Anews-west','PATCH',expect.objectContaining({id:channel.id,number:7,enabled:false,candidates:[]})));
});

it('reports a rejected limit without closing settings',async()=>{
 const api=vi.fn(async(path:string,method='GET')=>{
  if(method==='PATCH')throw new Error('Disable channels before lowering the limit');
  if(path==='/lineup')return{settings:{enabled:true,limit:100},channels:[]};
  return{};
 });
 render(<FamilyLineup api={api as Client}/>);
 fireEvent.click(await screen.findByRole('button',{name:'Lineup settings'}));
 fireEvent.change(screen.getByLabelText('Visible channel limit'),{target:{value:'1'}});
 fireEvent.click(screen.getByRole('button',{name:'Save settings'}));
 await waitFor(()=>expect(screen.getByRole('dialog')).toHaveTextContent('Disable channels before lowering the limit'));
});

it('shows a renamed provider candidate and verifies the name the owner reviewed',async()=>{
 const channel={id:'family:cartoon-east',name:'Cartoon Network East',network:'Cartoon Network',feed:'east',market:'',category:'Kids',number:1,enabled:true,candidates:[{id:'iptv:1:1',name:'Cartoon East',current_name:'Cartoon Network East HD',status:'changed',verified:true}]};
 const api=vi.fn(async(path:string,method='GET')=>{
  if(path==='/lineup'&&method==='GET')return{settings:{enabled:true,limit:100},channels:[channel]};
  if(path.startsWith('/lineup/candidates'))return{candidates:[]};
  return{};
 });
 render(<FamilyLineup api={api as Client}/>);
 fireEvent.click(await screen.findByRole('button',{name:'Edit Cartoon Network East'}));
 expect(screen.getByText(/Provider now lists: Cartoon Network East HD/)).toBeInTheDocument();
 fireEvent.click(screen.getByLabelText(/I verified/));
 fireEvent.click(screen.getByRole('button',{name:'Save channel'}));
 await waitFor(()=>expect(api).toHaveBeenCalledWith('/lineup/family%3Acartoon-east','PATCH',expect.objectContaining({candidates:[{id:'iptv:1:1',name:'Cartoon Network East HD',verified:true}]})));
});

it('lets the owner save bounded recovery controls for future playback',async()=>{
 const recovery={stall_seconds:20,attempt_seconds:20,deadline_seconds:45,max_recoveries:2};
 const api=vi.fn(async()=>({settings:{enabled:true,limit:100,recovery},channels:[]}));
 render(<FamilyLineup api={api as Client}/>);
 fireEvent.click(await screen.findByRole('button',{name:'Lineup settings'}));
 fireEvent.change(screen.getByLabelText('Stall timeout (seconds)'),{target:{value:'30'}});
 fireEvent.change(screen.getByLabelText('Maximum recoveries per viewing session'),{target:{value:'3'}});
 fireEvent.click(screen.getByRole('button',{name:'Save settings'}));
 await waitFor(()=>expect(api).toHaveBeenCalledWith('/lineup/settings','PATCH',expect.objectContaining({recovery:{...recovery,stall_seconds:30,max_recoveries:3}})));
});

it('explains selected free slots and uncertain reports without exposing provider details',async()=>{
 const channel={id:'family:cartoon-east',name:'Cartoon East',network:'Cartoon',feed:'east',market:'',category:'Kids',number:1,enabled:true,candidates:[{id:'iptv:1:1',name:'Cartoon first'},{id:'iptv:2:1',name:'Cartoon backup'}],last_startup:{at:1,attempts:[{candidate_id:'iptv:2:1',reason:'selected',estimated_free_before:3,confidence:'stale',recent_success:false,alternatives:[{candidate_id:'iptv:1:1',estimated_free:1,reason:'lower_selection_rank'}]}]}};
 const api=vi.fn(async(path:string)=>path==='/lineup'?{settings:{enabled:true,limit:100},channels:[channel]}:{candidates:[]});
 render(<FamilyLineup api={api as Client}/>);
 fireEvent.click(await screen.findByRole('button',{name:'Edit Cartoon East'}));
 expect(screen.getByText('Selected with 3 estimated free slots · stale usage report.')).toBeInTheDocument();
 expect(screen.getByText('Cartoon first: 1 estimated free slots; lower selection rank.')).toBeInTheDocument();
 expect(screen.getByText(/Media compatibility checked/)).toBeInTheDocument();
});
