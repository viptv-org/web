// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {BulkProviders,RenewProvider} from './ProviderAccounts';
import type {Client} from './lib/api';
afterEach(cleanup);
it('imports twenty pasted URLs and shows independent private results',async()=>{
 const results=Array.from({length:20},(_,i)=>({row:i+1,status:i===9?'validation_failed':i===19?'duplicate':'imported',provider_id:i+1}));
 const api=vi.fn().mockResolvedValue({results});const saved=vi.fn();
 render(<BulkProviders api={api as Client} saved={saved}/>);
 fireEvent.click(screen.getByRole('button',{name:'Import accounts'}));
 expect(screen.getByText(/New imports default to Live TV only/)).toBeInTheDocument();
 const entries=Array.from({length:20},(_,i)=>`https://provider.example/get.php?username=private-${i}&password=secret`).join('\n');
 fireEvent.change(screen.getByLabelText('Xtream accounts'),{target:{value:entries}});
 fireEvent.click(screen.getByRole('button',{name:'Validate and import'}));
 await waitFor(()=>expect(api).toHaveBeenCalledWith('/providers/import','POST',{entries}));
 expect(await screen.findByText(/Row 10: Login validation failed/)).toBeInTheDocument();
 expect(screen.getByText(/Row 20: Already configured/)).toBeInTheDocument();
 expect(screen.getByLabelText('Xtream accounts')).toHaveValue('');expect(saved).toHaveBeenCalled();
});
it('renews a password on the same provider without resending scopes or revealing its login',async()=>{
 const api=vi.fn().mockResolvedValue({});const saved=vi.fn();
 render(<RenewProvider api={api as Client} provider={{id:'17',name:'Family',url:'https://provider.example',enabled:false}} saved={saved}/>);
 fireEvent.click(screen.getByRole('button',{name:'Renew credentials for Family'}));
 fireEvent.change(screen.getByLabelText('New password'),{target:{value:'private-new'}});
 fireEvent.click(screen.getByRole('button',{name:'Validate and save'}));
 await waitFor(()=>expect(api).toHaveBeenCalledWith('/providers/17/credentials','POST',{url:'https://provider.example',password:'private-new'}));
 expect(saved).toHaveBeenCalled();
});
