// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {FamilyMatching} from './FamilyMatching';
import type {Client} from './lib/api';
afterEach(cleanup);
const fixture=()=>({settings:{confidence:95,ambiguity_margin:10,ambiguity_policy:'review',active_candidates:4},channels:[{id:'family:hbo-east',name:'HBO East',active:1,reserves:2,review:1,shortage:3},{id:'family:hbo-west',name:'HBO West',active:0,reserves:0,review:1,shortage:4}],matches:[{channel_id:'family:hbo-east',candidate_id:'iptv:1:1',name:'HBO HD',status:'review',score:70,reason:'region_language_or_feed_unverified',pinned:false,runner_up_margin:0,competing:[{channel_id:'family:hbo-east',score:70,reason:'unverified'},{channel_id:'family:hbo-west',score:70,reason:'unverified'}]}],aliases:[],providers:[{id:1,name:'Account one',upstream_group:''}]});
it('shows coast ambiguity and requires verification before pinning',async()=>{
 const api=vi.fn(async()=>fixture());render(<FamilyMatching api={api as Client} initialChannel="family:hbo-east" close={()=>{}} saved={()=>{}}/>);
 expect(await screen.findByText('Country, language or regional feed needs verification · margin 0')).toBeInTheDocument();
 expect(screen.getByText('Competing matches: HBO East (70), HBO West (70)')).toBeInTheDocument();
 expect(screen.getByRole('button',{name:'Pin HBO HD'})).toBeDisabled();
 fireEvent.click(screen.getByLabelText(/I verified HBO HD/));fireEvent.click(screen.getByRole('button',{name:'Pin HBO HD'}));
 await waitFor(()=>expect(api).toHaveBeenCalledWith('/lineup/family%3Ahbo-east/matching','PATCH',{candidate_id:'iptv:1:1',decision:'pin',observed_name:'HBO HD',verified:true}));
});
it('persists confidence and candidate target, then runs matching',async()=>{
 const api=vi.fn(async()=>fixture());render(<FamilyMatching api={api as Client} initialChannel="" close={()=>{}} saved={()=>{}}/>);
 fireEvent.change(await screen.findByLabelText('Automatic match confidence'),{target:{value:'90'}});
 fireEvent.change(screen.getByLabelText('Active candidates per channel'),{target:{value:'6'}});
 fireEvent.click(screen.getByRole('button',{name:'Save matching settings and match'}));
 await waitFor(()=>expect(api).toHaveBeenCalledWith('/lineup/matching','PATCH',expect.objectContaining({confidence:90,active_candidates:6})));
 await waitFor(()=>expect(api).toHaveBeenCalledWith('/lineup/matching/run','POST'));
});
it('keeps a failed correction visible and explains reserve shortages',async()=>{
 const api=vi.fn(async(_path:string,method='GET')=>{if(method==='PATCH')throw new Error('Catalog changed; reload');return fixture()});
 render(<FamilyMatching api={api as Client} initialChannel="family:hbo-east" close={()=>{}} saved={()=>{}}/>);
 expect(await screen.findByText('HBO East: 1 active, 2 reserves, 1 to review · 3 below your candidate target')).toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'Reject HBO HD'}));
 expect(await screen.findByText('Catalog changed; reload')).toBeInTheDocument();
 expect(screen.getByRole('dialog')).toBeInTheDocument();
});
