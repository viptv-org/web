// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { V2Connections, V2Addons } from './V2Connections';
afterEach(() => {cleanup();vi.unstubAllGlobals();});
const row = { id: 1, name: 'My IPTV', enabled: true, enable_live: true, enable_movies: true, enable_series: true, credentials_encrypted: true, refresh: { state: 'idle' }, url: 'https://provider.invalid/private-secret', username: 'private-user', password: 'private-password' };
function connectionApi() {
  return vi.fn().mockImplementation((path, method, body) => {
    if (path === '/v2/iptv/live-default') return Promise.resolve({ catalog_id: body?.catalog_id ?? 2 });
    if (path.endsWith('/refresh')) return Promise.resolve({ state: 'queued' });
    if (method === 'PATCH') return Promise.resolve({ ...row, ...body });
    if (method === 'POST' || path.endsWith('/credentials')) return Promise.resolve(row);
    if (method === 'DELETE') return Promise.resolve({ ok: true });
    return Promise.resolve({ items: [row], next_cursor: null });
  });
}
describe('v2 Xtream connection management', () => {
  it('edits account scopes without prefilling or sending stored credentials', async () => {
    const api = connectionApi(); render(<V2Connections api={api}/>);
    fireEvent.click(await screen.findByRole('button', { name: 'Edit My IPTV' }));
    expect(screen.queryByLabelText('Server URL')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Password')).not.toBeInTheDocument();
    expect(document.body.textContent).not.toContain('private-user');
    expect(document.body.textContent).not.toContain('private-secret');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Live TV' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save connection' }));
    await waitFor(() => expect(api).toHaveBeenCalledWith('/v2/iptv/connections/1', 'PATCH', { name: 'My IPTV', enabled: true, enable_live: false, enable_movies: true, enable_series: true }));
  });
  it('creates with strict scopes and retains the draft after a failed save', async () => {
    const api = connectionApi(); api.mockImplementation((path, method) => method === 'POST' ? Promise.reject(new Error('Provider unavailable. Try again.')) : Promise.resolve(path.endsWith('live-default') ? { catalog_id: null } : { items: [], next_cursor: null }));
    render(<V2Connections api={api}/>); fireEvent.click(screen.getByRole('button', { name: 'Add Xtream connection' }));
    for (const [label, value] of [['Connection name', 'New TV'], ['Server URL', 'http://provider.example'], ['Username', 'new-user'], ['Password', 'new-private']]) fireEvent.change(screen.getByLabelText(label), { target: { value } });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Series' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save connection' }));
    await waitFor(() => expect(screen.getAllByRole('alert').some(alert => alert.textContent?.includes('Provider unavailable'))).toBe(true));
    expect(screen.getByLabelText('Connection name')).toHaveValue('New TV');
    expect(screen.getByLabelText('Password')).toHaveValue('new-private');
    expect(api).toHaveBeenCalledWith('/v2/iptv/connections', 'POST', { name: 'New TV', url: 'http://provider.example', username: 'new-user', password: 'new-private', enabled: true, enable_live: true, enable_movies: true, enable_series: false });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add Xtream connection' }));
    expect(screen.getByLabelText('Password')).toHaveValue('');
  });
  it('requires explicit default and delete confirmation and never changes playback', async () => {
    const api = connectionApi(); render(<V2Connections api={api}/>);
    fireEvent.click(await screen.findByRole('button', { name: 'Use My IPTV as default live playlist' }));
    expect(api.mock.calls.some(([, method]) => method === 'PUT')).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Use this playlist' }));
    await waitFor(() => expect(api).toHaveBeenCalledWith('/v2/iptv/live-default', 'PUT', { catalog_id: 1 }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Delete My IPTV' }));
    expect(api.mock.calls.some(([, method]) => method === 'DELETE')).toBe(false);
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete connection' }));
    await waitFor(() => expect(api).toHaveBeenCalledWith('/v2/iptv/connections/1', 'DELETE'));
    expect(api.mock.calls.some(([path]) => path.includes('playback'))).toBe(false);
  });
  it('replaces only the password and prevents duplicate pending submissions', async () => {
    const api = connectionApi(); let resolve!: (value: unknown) => void;
    const ordinary = api.getMockImplementation()!;
    api.mockImplementation((...args) => args[0].endsWith('/credentials') ? new Promise(done => { resolve = done; }) : ordinary(...args));
    render(<V2Connections api={api}/>); fireEvent.click(await screen.findByRole('button', { name: 'Replace password for My IPTV' }));
    expect(screen.getByLabelText('Password')).toHaveValue('');
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'replacement' } });
    const form = screen.getByLabelText('Password').closest('form')!;
    fireEvent.submit(form); fireEvent.submit(form);
    expect(api.mock.calls.filter(([path]) => path.endsWith('/credentials'))).toHaveLength(1);
    expect(api).toHaveBeenCalledWith('/v2/iptv/connections/1/credentials', 'PUT', { password: 'replacement' });
    expect(screen.getByLabelText('Password')).toBeDisabled();
    await act(async () => resolve(row));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
  it('shows bounded malformed/slow states and safe provider refresh failures', async () => {
    const api = connectionApi(); api.mockImplementation(path => Promise.resolve(path.endsWith('live-default') ? { catalog_id: null } : { items: [{ name: 'Malformed' }], next_cursor: null }));
    render(<V2Connections api={api}/>);
    expect(await screen.findByRole('alert')).toHaveTextContent('invalid connection settings');
    cleanup();
    const slow = vi.fn().mockImplementation(path => path.endsWith('live-default') ? Promise.resolve({catalog_id:null}) : new Promise(() => {}));
    render(<V2Connections api={slow}/>); expect(screen.getByText('Loading connections…')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add Xtream connection' })).toBeEnabled();
    cleanup();
    const safe = connectionApi(); safe.mockImplementation(path => Promise.resolve(path.endsWith('live-default') ? {catalog_id:null} : {items:[{...row,refresh:{state:'failed',error:'https://provider.invalid/password=private-secret'}}],next_cursor:null}));
    render(<V2Connections api={safe}/>); expect(await screen.findByRole('alert')).toHaveTextContent('temporarily unavailable');
    expect(document.body.textContent).not.toContain('private-secret');
  });
});

describe('v2 account add-ons', () => {
  it('retains safe per-addon key/configuration failures instead of hiding why catalogs are unavailable', async () => {
    const api=vi.fn().mockResolvedValue({items:[{id:7,name:'Locked add-on',enabled:true,credentials_encrypted:true,configuration_error:'The operator must restore the saved source key.',configuration_error_code:'secret_key_unavailable'}],next_cursor:null});
    render(<V2Addons api={api}/>);
    expect(await screen.findByRole('alert')).toHaveTextContent('restore the saved source key');
  });
  const addon = { id: 7, name: 'My add-on', enabled: true, credentials_encrypted: true, logo: 'https://logo.example/icon.png', manifest_url: 'https://addon.example/private-password/manifest.json' };
  it('renders declared icons without manifest addresses and falls back safely', async () => {
    const api = vi.fn().mockResolvedValue({ items: [addon], next_cursor: null }); render(<V2Addons api={api}/>);
    await screen.findByText('My add-on');
    const icon = document.querySelector('img')!; expect(icon).toHaveAttribute('referrerpolicy', 'no-referrer');
    expect(document.body.innerHTML).not.toContain('private-password');
    fireEvent.error(icon); expect(document.querySelector('img')).toBeNull();
  });
  it('toggles only enabled and confirms removal', async () => {
    const api = vi.fn().mockImplementation((_path, method, body) => Promise.resolve(method === 'PATCH' ? {...addon,...body} : method === 'DELETE' ? {ok:true} : {items:[addon],next_cursor:null}));
    render(<V2Addons api={api}/>); fireEvent.click(await screen.findByRole('switch', {name:'Enable My add-on'}));
    await waitFor(() => expect(api).toHaveBeenCalledWith('/v2/addons/7','PATCH',{enabled:false}));
    fireEvent.click(screen.getByRole('button',{name:'Delete My add-on'}));
    expect(api.mock.calls.some(([,method])=>method==='DELETE')).toBe(false);
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button',{name:'Delete add-on'}));
    await waitFor(()=>expect(api).toHaveBeenCalledWith('/v2/addons/7','DELETE'));
  });
  it('loads the next bounded page without exposing configuration URLs', async () => {
    const observers: IntersectionObserverCallback[]=[];
    vi.stubGlobal('IntersectionObserver',class {constructor(callback:IntersectionObserverCallback){observers.push(callback)}observe(){}disconnect(){}unobserve(){}});
    const api = vi.fn().mockImplementation(path => Promise.resolve(path.includes('cursor=next_page') ? {items:[{...addon,id:8,name:'Another add-on',logo:'javascript:alert(1)'}],next_cursor:null} : {items:[addon],next_cursor:'next_page'}));
    render(<V2Addons api={api}/>);
    await screen.findByText('My add-on');
    await act(async()=>observers.at(-1)!([{isIntersecting:true}] as IntersectionObserverEntry[],{} as IntersectionObserver));
    expect(await screen.findByText('Another add-on')).toBeInTheDocument();
    expect(api).toHaveBeenCalledWith('/v2/addons?limit=50&cursor=next_page','GET',undefined,expect.any(AbortSignal));
    expect(document.body.innerHTML).not.toContain('javascript:');
    expect(document.body.innerHTML).not.toContain('private-password');
  });
});
