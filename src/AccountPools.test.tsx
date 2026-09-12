// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {AccountPools} from './AccountPools';
import type {Client} from './lib/api';
afterEach(cleanup);
it('shows separate local and stale reported usage and saves an external reserve',async()=>{
 const pool={id:7,name:'Family subscription',provider_ids:[1,2],configured_limit:3,external_reserve:0,local_reservations:1,reported_limit:2,reported_usage:2,limit_age_seconds:120,usage_age_seconds:120,effective_limit:2,estimated_free:0,confidence:'stale'};
 const api=vi.fn().mockResolvedValue({pools:[pool]});const saved=vi.fn();
 render(<AccountPools api={api as Client} providers={[{id:'1',name:'One',url:'https://one.example',enabled:true},{id:'2',name:'Alias',url:'https://alias.example',enabled:true}]} saved={saved}/>);
 expect(await screen.findByText('Local reservations: 1')).toBeInTheDocument();
 expect(screen.getByText(/Provider-reported usage: 2/)).toBeInTheDocument();
 expect(screen.getByText(/Old report retained conservatively/)).toBeInTheDocument();
 fireEvent.change(screen.getByLabelText('Reserved outside VIPTV for Family subscription'),{target:{value:'1'}});
 fireEvent.click(screen.getByRole('button',{name:'Save allowance for Family subscription'}));
 await waitFor(()=>expect(api).toHaveBeenCalledWith('/account-pools/7','PATCH',{configured_limit:3,external_reserve:1}));
});
it('lets an owner associate an alias with an existing subscription',async()=>{
 const api=vi.fn().mockResolvedValue({pools:[{id:1,name:'One',provider_ids:[1],configured_limit:2,external_reserve:0,local_reservations:0,effective_limit:2,estimated_free:2,confidence:'unknown'},{id:2,name:'Alias',provider_ids:[2],configured_limit:2,external_reserve:0,local_reservations:0,effective_limit:2,estimated_free:2,confidence:'unknown'}]});
 render(<AccountPools api={api as Client} providers={[{id:'1',name:'One',url:'https://one.example',enabled:true},{id:'2',name:'Alias',url:'https://alias.example',enabled:true}]} saved={()=>{}}/>);
 fireEvent.change(await screen.findByLabelText('Subscription for Alias'),{target:{value:'1'}});
 fireEvent.click(screen.getByRole('button',{name:'Save subscription for Alias'}));
 await waitFor(()=>expect(api).toHaveBeenCalledWith('/providers/2/pool','PATCH',{pool_id:1}));
});
