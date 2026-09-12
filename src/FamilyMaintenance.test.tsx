// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {FamilyHealth} from './FamilyHealth';
import {FamilyGuides} from './FamilyGuides';
import {FamilyActivity} from './FamilyActivity';
import type {Client} from './lib/api';
afterEach(cleanup);
it('saves health budgets and candidate exclusions and requests a manual media check',async()=>{
 const api=vi.fn(async()=>({settings:{enabled:false,interval_minutes:360,sample_seconds:8,concurrency:2,startup_seconds:10,budget_seconds:30,max_sample_mib:32,retry_minutes:[5,15,60,360],reserve_multiplier:2},checking:[],candidates:[{id:'iptv:1:1',name:'Cartoon Network East',provider:'Family account',disabled:false,excluded_until:0,state:'cooling_down',reason:'invalid_media',at:100,next_check:400,sample:null}]}));
 render(<FamilyHealth api={api as Client} close={()=>{}}/>);
 fireEvent.click(await screen.findByLabelText('Enable automatic health checks'));
 fireEvent.change(screen.getByLabelText('Failure retry 1 (minutes)'),{target:{value:'7'}});
 fireEvent.click(screen.getByRole('button',{name:'Save health settings'}));
 await waitFor(()=>expect(api).toHaveBeenCalledWith('/stream-health','PATCH',expect.objectContaining({enabled:true,retry_minutes:[7,15,60,360]})));
 fireEvent.click(screen.getByRole('button',{name:'Check Cartoon Network East'}));
 await waitFor(()=>expect(api).toHaveBeenCalledWith('/stream-health/iptv%3A1%3A1/check','POST'));
 fireEvent.click(screen.getByLabelText('Manually disable Cartoon Network East'));
 fireEvent.click(screen.getByRole('button',{name:'Save exclusion for Cartoon Network East'}));
 await waitFor(()=>expect(api).toHaveBeenCalledWith('/stream-health/iptv%3A1%3A1','PATCH',{disabled:true,exclude_minutes:0}));
});
it('keeps guide refresh disabled while cancellation is pending',async()=>{
 const api=vi.fn(async(path:string)=>path==='/providers'?[]:{settings:{enabled:false,timezone:'America/New_York',refresh_minutes:360,audit_minutes:60,automatic_repair:true},sources:[],channels:[],guide_channels:[],last_run:{state:'cancel_requested',reason:null,last_start:1,last_finish:null},next_audit:0});
 render(<FamilyGuides api={api as Client} close={()=>{}}/>);
 expect(await screen.findByRole('button',{name:'Refresh guides now'})).toBeDisabled();
});
it('routes attention to correction controls and pauses automation without a playback request',async()=>{
 const open=vi.fn();const api=vi.fn(async()=>({paused:false,sharing:{viewers:2,workers:1},pools:[],attention:[{id:'guide:one',title:'Cartoon Network East',reason:'guide_coverage_below_24_hours',action:'guides',channel_id:'family:one'}],changes:[],recovery_events:[],selections:[],catalog:{next_run:null,last_run:null},guide:{state:'idle',last_finish:null,reason:null}}));
 render(<FamilyActivity api={api as Client} close={()=>{}} open={open}/>);
 fireEvent.click(await screen.findByRole('button',{name:'Resolve Cartoon Network East'}));expect(open).toHaveBeenCalledWith('guides','family:one');
 fireEvent.click(screen.getByRole('button',{name:'Pause all automation'}));await waitFor(()=>expect(api).toHaveBeenCalledWith('/activity/pause','POST',{paused:true}));
 expect(screen.getByText('2 viewers · 1 shared media workers')).toBeInTheDocument();
});
