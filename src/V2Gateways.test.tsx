// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { V2Gateways } from './V2Gateways';
afterEach(cleanup);
const gateway = {id:'gateway/1',name:'My gateway',endpoint:'https://gateway.example/',namespace:'home',priority:100,enabled:true,revision:1,can_manage:true,integration_key:'stored-private-secret'};
function apiFixture() {
  return vi.fn().mockImplementation((path, method, body) => {
    if(path.includes('/grants?')) return Promise.resolve({items:[{account_id:'2',enabled:true}],next_cursor:null});
    if(path.endsWith('/check')) return Promise.resolve({ready:true,version:1,available:null});
    if(method==='PUT'||method==='POST') return Promise.resolve({...gateway,...body});
    return Promise.resolve({items:[gateway],secret_storage_configured:true});
  });
}
describe('v2 gateway management',()=>{
  it('uses explicit fresh replacement keys and retains errors and edits',async()=>{
    const api=apiFixture();api.mockImplementation((path,method)=>method==='PUT'?Promise.reject(new Error('Gateway unavailable. Try again.')):Promise.resolve({items:[gateway],secret_storage_configured:true}));
    render(<V2Gateways api={api}/>);fireEvent.click(await screen.findByRole('button',{name:'Replace key for My gateway'}));
    expect(screen.getByLabelText('New integration key')).toHaveValue('');
    expect(document.body.innerHTML).not.toContain('stored-private-secret');
    fireEvent.change(screen.getByLabelText('New integration key'),{target:{value:'new-private-key'}});
    fireEvent.change(screen.getByLabelText('Priority'),{target:{value:'7'}});
    fireEvent.click(screen.getByRole('button',{name:'Save gateway'}));
    await waitFor(()=>expect(screen.getAllByRole('alert').some(row=>row.textContent?.includes('Gateway unavailable'))).toBe(true));
    expect(screen.getByLabelText('New integration key')).toHaveValue('new-private-key');
    expect(api).toHaveBeenCalledWith('/v2/gateways/gateway%2F1','PUT',{name:'My gateway',endpoint:'https://gateway.example/',namespace:'home',priority:7,integration_key:'new-private-key'});
    fireEvent.click(screen.getByRole('button',{name:'Cancel'}));
    fireEvent.click(screen.getByRole('button',{name:'Replace key for My gateway'}));
    expect(screen.getByLabelText('New integration key')).toHaveValue('');
  });
  it('shows missing capacity as unknown and zero as a genuine hint',async()=>{
    const api=apiFixture();render(<V2Gateways api={api}/>);
    fireEvent.click(await screen.findByRole('button',{name:'Check My gateway'}));
    expect(await screen.findByText('Capacity unknown — the gateway did not report capacity hints.')).toBeInTheDocument();
    api.mockImplementation((path)=>Promise.resolve(path.endsWith('/check')?{ready:true,version:1,available:{inputs:0,outputs:2,viewers:3}}:{items:[gateway],secret_storage_configured:true}));
    fireEvent.click(screen.getByRole('button',{name:'Check My gateway'}));
    expect(await screen.findByText('Available inputs: 0 · Outputs: 2 · Viewers: 3')).toBeInTheDocument();
  });
  it('granted recipients can check capacity but never manage another registration',async()=>{
    const api=apiFixture();api.mockResolvedValue({items:[{...gateway,can_manage:false}],secret_storage_configured:true});
    render(<V2Gateways api={api} operator/>);await screen.findByText('Granted access',{exact:false});
    expect(screen.getByRole('button',{name:'Check My gateway'})).toBeEnabled();
    expect(screen.queryByRole('button',{name:'Replace key for My gateway'})).not.toBeInTheDocument();
    expect(screen.queryByRole('button',{name:'Manage grants for My gateway'})).not.toBeInTheDocument();
    cleanup();render(<V2Gateways api={api} operator grantsOnly/>);
    expect(await screen.findByText('No owned gateways')).toBeInTheDocument();
  });
  it('gates operator routes locally and confirms paged grant revocation',async()=>{
    const api=apiFixture();render(<V2Gateways api={api} grantsOnly/>);
    expect(screen.getByRole('alert')).toHaveTextContent('Operator access');expect(api).not.toHaveBeenCalled();
    cleanup();render(<V2Gateways api={api} operator grantsOnly/>);
    fireEvent.click(await screen.findByRole('button',{name:'Manage grants for My gateway'}));
    fireEvent.click(await screen.findByRole('button',{name:'Revoke account 2'}));
    expect(api.mock.calls.some(([,method])=>method==='PUT')).toBe(false);
    fireEvent.click(screen.getByRole('button',{name:'Confirm revoke'}));
    await waitFor(()=>expect(api).toHaveBeenCalledWith('/v2/gateways/gateway%2F1/grants','PUT',{account_id:2,enabled:false}));
    expect(await screen.findByText('No gateway grants.')).toBeInTheDocument();
  });
  it('requires confirmation for new grants and sends only account ID and enabled',async()=>{
    const api=apiFixture();render(<V2Gateways api={api} operator grantsOnly/>);
    fireEvent.click(await screen.findByRole('button',{name:'Manage grants for My gateway'}));
    fireEvent.change(await screen.findByLabelText('Account ID'),{target:{value:'12'}});
    fireEvent.click(screen.getByRole('button',{name:'Grant access'}));
    expect(api.mock.calls.some(([,method])=>method==='PUT')).toBe(false);
    fireEvent.click(screen.getByRole('button',{name:'Confirm grant'}));
    await waitFor(()=>expect(api).toHaveBeenCalledWith('/v2/gateways/gateway%2F1/grants','PUT',{account_id:12,enabled:true}));
  });
  it('blocks duplicate saves while pending and uses delete confirmation',async()=>{
    const api=apiFixture();let resolve!:(value:unknown)=>void;const ordinary=api.getMockImplementation()!;
    api.mockImplementation((...args)=>args[1]==='POST'?new Promise(done=>{resolve=done}):ordinary(...args));
    render(<V2Gateways api={api}/>);await screen.findByText('My gateway');
    fireEvent.click(screen.getByRole('button',{name:'Add gateway'}));
    for(const[label,value]of [['Gateway name','New gateway'],['HTTPS endpoint','https://new.example/'],['Namespace','home'],['New integration key','new-private-key']])fireEvent.change(screen.getByLabelText(label),{target:{value}});
    const form=screen.getByLabelText('Gateway name').closest('form')!;fireEvent.submit(form);fireEvent.submit(form);
    expect(api.mock.calls.filter(([,method])=>method==='POST')).toHaveLength(1);
    expect(screen.getByLabelText('New integration key')).toBeDisabled();
    await act(async()=>resolve({...gateway,id:'new',name:'New gateway'}));
    fireEvent.click(screen.getByRole('button',{name:'Delete My gateway'}));
    expect(api.mock.calls.some(([,method])=>method==='DELETE')).toBe(false);
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button',{name:'Delete gateway'}));
    await waitFor(()=>expect(api).toHaveBeenCalledWith('/v2/gateways/gateway%2F1','DELETE'));
  });
  it('rejects malformed gateway and capacity data without inventing quotas',async()=>{
    const api=apiFixture();api.mockResolvedValue({items:[{name:'Malformed'}],secret_storage_configured:true});
    render(<V2Gateways api={api}/>);expect(await screen.findByRole('alert')).toHaveTextContent('invalid gateway settings');
    cleanup();const checked=apiFixture();checked.mockImplementation(path=>Promise.resolve(path.endsWith('/check')?{ready:true,version:1,available:{inputs:-1,outputs:2,viewers:3}}:{items:[gateway],secret_storage_configured:true}));
    render(<V2Gateways api={checked}/>);fireEvent.click(await screen.findByRole('button',{name:'Check My gateway'}));
    expect(await screen.findByRole('alert')).toHaveTextContent('invalid gateway settings');
    expect(screen.queryByText(/Available inputs/)).not.toBeInTheDocument();
  });
});
