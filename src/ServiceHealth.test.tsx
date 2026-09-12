// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import {cleanup, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {afterEach, expect, it, vi} from 'vitest';
import {ServiceHealth} from './ServiceHealth';
import type {Client} from './lib/api';
afterEach(cleanup);
const snapshot = {at:100,active_sessions:2,paused:false,providers:{total:21,next_offset:20,items:[{id:1,name:'Family account',enabled:true,last_catalog_at:null,catalog_state:'not_observed',retry_at:null,pool:{id:1,estimated_free:3,effective_limit:4,local_reservations:1,confidence:'stale'}}]},catalog:{settings:{provider_ids:[1]},next_run:null,last_run:null},guides:{enabled_channels:88,current_channels:84,enabled_sources:3,failed_sources:1,last_updated_at:90,last_run:{state:'idle',last_finish:null,reason:null}}};
it('opens one saved snapshot, pages providers and queues bounded repair with honest feedback', async()=>{
 const api=vi.fn(async(path:string,method='GET')=>method==='POST'?{accepted:true}:path.includes('offset=20')?{...snapshot,providers:{total:21,next_offset:null,items:[{...snapshot.providers.items[0],id:21,name:'Next account'}]}}:snapshot);
 render(<ServiceHealth api={api as Client} navigate={()=>{}}/>);
 expect(await screen.findByText('Family account')).toBeInTheDocument();
 expect(screen.getByText('84 / 88')).toBeInTheDocument();
 expect(screen.getByText(/3 of 4/)).toBeInTheDocument();
 expect(api).toHaveBeenCalledTimes(1);
 fireEvent.click(screen.getByRole('button',{name:'Refresh guides'}));
 await waitFor(()=>expect(api).toHaveBeenCalledWith('/guides/run','POST'));
 expect(await screen.findByText(/Guide refresh queued/)).toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'Next providers'}));
 expect(await screen.findByText('Next account')).toBeInTheDocument();
 expect(screen.queryByText('Family account')).not.toBeInTheDocument();
});

it('keeps failed repair actionable and cancels requests on leaving the page',async()=>{
 const api=vi.fn(async(_path:string,method='GET')=>{if(method==='POST')throw new Error('A guide refresh is already active');return snapshot});
 const view=render(<ServiceHealth api={api as Client} navigate={()=>{}}/>);
 fireEvent.click(await screen.findByRole('button',{name:'Refresh guides'}));
 expect(await screen.findByText('A guide refresh is already active')).toBeInTheDocument();
 expect(screen.queryByText(/Guide refresh queued/)).not.toBeInTheDocument();
 const first=api.mock.calls[0] as unknown[];
 view.unmount();
 expect((first[3] as AbortSignal).aborted).toBe(true);
});

it('does not offer another refresh during an active job',async()=>{
 const api=vi.fn(async()=>({...snapshot,catalog:{...snapshot.catalog,last_run:{state:'running',reason:null}},guides:{...snapshot.guides,last_run:{state:'cancel_requested',reason:null}}}));
 render(<ServiceHealth api={api as Client} navigate={()=>{}}/>);
 expect(await screen.findByRole('button',{name:'Refresh guides'})).toBeDisabled();
 expect(screen.getByRole('button',{name:'Refresh catalogs'})).toBeDisabled();
});

it('surfaces partial catalog failures even when the batch completed',async()=>{
 const api=vi.fn(async()=>({...snapshot,catalog:{...snapshot.catalog,last_run:{state:'completed',reason:null,accounts:[{status:'failed'},{status:'completed'}]}}}));
 render(<ServiceHealth api={api as Client} navigate={()=>{}}/>);
 expect(await screen.findByText('1 account refresh failed. Open Catalog settings for the reason and retry status.')).toBeInTheDocument();
});
