// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {CatalogAutomation} from './CatalogAutomation';
import type {Client} from './lib/api';
afterEach(cleanup);
const fixture=()=>({settings:{enabled:false,interval_minutes:360,concurrency:2,retries:1,request_timeout_seconds:30,provider_ids:[1]},next_run:null,last_run:{id:'run-one',state:'completed',created_at:1,finished_at:2,reason:null,matching_state:'completed',accounts:[{provider_id:1,status:'failed',attempts:1,reason:'authentication_failed',next_retry:100}]}});
const providers=Array.from({length:21},(_,i)=>({id:i+1,name:`Account ${i+1}`,enabled:true,enable_live:true,enable_movies:false,enable_series:false}));
it('saves bounded schedule and selected accounts, and starts a manual run',async()=>{
 const api=vi.fn(async(path:string)=>path==='/providers'?providers:fixture());
 render(<CatalogAutomation api={api as Client} close={()=>{}} saved={()=>{}}/>);
 fireEvent.click(await screen.findByLabelText('Enable scheduled refresh'));
 fireEvent.click(screen.getByLabelText('Account 2 · Live'));
 fireEvent.change(screen.getByLabelText('Refresh interval (minutes)'),{target:{value:'60'}});
 fireEvent.click(screen.getByRole('button',{name:'Save refresh settings'}));
 await waitFor(()=>expect(api).toHaveBeenCalledWith('/automation/catalog','PATCH',expect.objectContaining({enabled:true,interval_minutes:60,provider_ids:[1,2]})));
 fireEvent.click(screen.getByRole('button',{name:'Refresh now'}));
 await waitFor(()=>expect(api).toHaveBeenCalledWith('/automation/catalog/run','POST'));
 expect(screen.getByText('Credentials expired or rejected')).toBeInTheDocument();
 expect(screen.getByText(/Eligible to retry after/)).toBeInTheDocument();
});
it('limits account selection to twenty and preserves draft edits during status reload',async()=>{
 const api=vi.fn(async(path:string)=>path==='/providers'?providers:fixture());
 render(<CatalogAutomation api={api as Client} close={()=>{}} saved={()=>{}}/>);
 await screen.findByLabelText('Enable scheduled refresh');
 for(let id=2;id<=20;id++)fireEvent.click(screen.getByLabelText(`Account ${id} · Live`));
 expect(screen.getByLabelText('Account 21 · Live')).toBeDisabled();
 fireEvent.change(screen.getByLabelText('Refresh interval (minutes)'),{target:{value:'90'}});
 fireEvent.click(screen.getByRole('button',{name:'Reload status'}));
 await waitFor(()=>expect(api.mock.calls.filter(([path])=>path==='/automation/catalog').length).toBeGreaterThan(1));
 expect(screen.getByLabelText('Refresh interval (minutes)')).toHaveValue(90);
});
it('cancels an active run and exposes errors without losing the controls',async()=>{
 const result=fixture();result.last_run.state='running';
 const api=vi.fn(async(path:string,method='GET')=>{if(method==='POST')throw new Error('Cancellation could not be saved');return path==='/providers'?providers:result});
 render(<CatalogAutomation api={api as Client} close={()=>{}} saved={()=>{}}/>);
 expect(await screen.findByRole('button',{name:'Refresh now'})).toBeDisabled();
 fireEvent.click(screen.getByRole('button',{name:'Cancel current run'}));
 expect(await screen.findByText('Cancellation could not be saved')).toBeInTheDocument();
 expect(api).toHaveBeenCalledWith('/automation/catalog/cancel','POST');
});
