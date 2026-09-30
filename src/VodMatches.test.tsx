// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { VodMatches } from './VodMatches';

afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });
const provider = { id: '1', name: 'My IPTV' };
const titles = (offset = 0, count = 50, prefix = 'Title') => Array.from({ length: count }, (_, index) => ({ vod_id: `vod:1:${offset + index}`, provider_id: '1', type: 'movie', name: `${prefix} ${offset + index}`, year: 2000 + index % 20 }));
function fixture() {
  return vi.fn().mockImplementation((path: string, method: string) => {
    if (path.startsWith('/v2/iptv/connections')) return Promise.resolve({ items: [provider], next_cursor: null });
    if (method === 'PUT') return Promise.resolve({ ok: true });
    const cursor = new URLSearchParams(path.split('?')[1]).get('cursor'); const offset = cursor ? Number(cursor.slice(7)) : 0;
    return Promise.resolve({ items: titles(offset), next_cursor: offset < 99950 ? `cursor_${offset + 50}` : null, previous_cursor: offset ? `cursor_${offset - 50}` : null });
  });
}
function scrollNearEnd(region: HTMLElement, offset: number) {
  Object.defineProperty(region, 'clientHeight', { configurable: true, value: 336 });
  region.scrollTop = offset * 112; fireEvent.scroll(region);
}
describe('bounded v2 VOD matching', () => {
  it('includes the 208th owned provider and keeps its raw ID in the filter', async () => {
    const api=fixture(); const ordinary=api.getMockImplementation()!;
    api.mockImplementation((path,...args)=>path.startsWith('/v2/iptv/connections') ? Promise.resolve({items:Array.from({length:path.includes('cursor')?8:200},(_,i)=>({id:String(i+(path.includes('cursor')?201:1)),name:`Provider ${i+(path.includes('cursor')?201:1)}`})),next_cursor:path.includes('cursor')?null:'providers_200'}) : ordinary(path,...args));
    render(<VodMatches api={api}/>);
    await screen.findByRole('option',{name:'Provider 208'});
    fireEvent.change(screen.getByLabelText('Provider'),{target:{value:'208'}});
    await waitFor(()=>expect(api.mock.calls.some(([path])=>path==='/v2/iptv/matches?limit=50&provider_id=208')).toBe(true));
  });
  it('account change aborts saves and clears old dialog, filters and late results', async () => {
    const first=fixture(),second=fixture();let finish!: (value:unknown)=>void;
    const ordinary=first.getMockImplementation()!;
    first.mockImplementation((...args)=>args[1]==='PUT'?new Promise(done=>{finish=done}):ordinary(...args));
    const view=render(<VodMatches api={first}/>);
    fireEvent.click((await screen.findAllByRole('button',{name:'Match title'}))[0]);
    fireEvent.change(screen.getByLabelText('Metadata ID'),{target:{value:'old-account-draft'}});
    fireEvent.click(screen.getByRole('button',{name:'Save match'}));
    const signal=first.mock.calls.find(([,method])=>method==='PUT')![3];
    view.rerender(<VodMatches api={second}/>);
    expect(signal.aborted).toBe(true);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await screen.findByText('Title 0');
    await act(async()=>finish({ok:true}));
    expect(screen.queryByText('Metadata match saved')).not.toBeInTheDocument();
    expect(screen.queryByRole('button',{name:'Edit match'})).not.toBeInTheDocument();
  });
  it('browser Back closes only the dialog and restores its opener',async()=>{
    const api=fixture();render(<VodMatches api={api}/>);
    const opener=(await screen.findAllByRole('button',{name:'Match title'}))[0];opener.focus();fireEvent.click(opener);
    act(()=>history.back());
    await waitFor(()=>expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(()=>expect(opener).toHaveFocus());
    expect(api.mock.calls.some(([,method])=>method==='PUT')).toBe(false);
  });
  it('rejects malformed or duplicate rows with a recoverable error instead of publishing them', async () => {
    for (const items of [[{vod_id:'broken',provider_id:'1',name:'Malformed',type:'movie'}], [titles(0,1)[0],titles(0,1)[0]]]) {
      const api = vi.fn().mockImplementation(path => Promise.resolve(path.startsWith('/v2/iptv/connections') ? {items:[provider],next_cursor:null} : {items,next_cursor:null}));
      render(<VodMatches api={api}/>);
      expect(await screen.findByRole('alert')).toHaveTextContent('invalid unmatched-title data');
      expect(screen.queryByRole('button',{name:'Match title'})).not.toBeInTheDocument();
      expect(screen.getByRole('button',{name:'Try again'})).toBeEnabled();
      cleanup();
    }
  });
  it('loads 50 initially, debounces search for 250ms and preserves every filter on cursor requests', async () => {
    vi.useFakeTimers(); const api = fixture(); render(<VodMatches api={api}/>);
    await act(async () => { await Promise.resolve(); });
    expect(api).toHaveBeenCalledWith('/v2/iptv/matches?limit=50', 'GET', undefined, expect.any(AbortSignal));
    fireEvent.change(screen.getByLabelText('Provider'), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText('Type'), { target: { value: 'movie' } });
    fireEvent.change(screen.getByLabelText('Search titles'), { target: { value: 'needle' } });
    await act(async () => { vi.advanceTimersByTime(249); await Promise.resolve(); });
    expect(api.mock.calls.some(([path]) => path.includes('search=needle'))).toBe(false);
    await act(async () => { vi.advanceTimersByTime(1); await Promise.resolve(); });
    const path = '/v2/iptv/matches?limit=50&provider_id=1&kind=movie&search=needle';
    expect(api).toHaveBeenCalledWith(path, 'GET', undefined, expect.any(AbortSignal));
    await act(async () => { scrollNearEnd(screen.getByRole('region'), 40); await Promise.resolve(); });
    expect(api).toHaveBeenCalledWith(`${path}&cursor=cursor_50`, 'GET', undefined, expect.any(AbortSignal));
    expect(document.querySelectorAll('[data-match-id]').length).toBeLessThanOrEqual(20);
  });
  it('ignores an old response after a provider change even when the transport resolves after abort', async () => {
    let late!: (value: unknown) => void;
    const api = vi.fn().mockImplementation((path: string) => path.startsWith('/v2/iptv/connections') ? Promise.resolve({items:[provider],next_cursor:null}) : path.includes('provider_id=1') ? Promise.resolve({items:titles(0,1,'Current'),next_cursor:null}) : new Promise(done => { late = done; }));
    render(<VodMatches api={api}/>); await screen.findByRole('option', {name:'My IPTV'});
    const original = api.mock.calls.find(([path]) => path === '/v2/iptv/matches?limit=50')!;
    fireEvent.change(screen.getByLabelText('Provider'), {target:{value:'1'}});
    expect(await screen.findByText('Current 0')).toBeInTheDocument();
    expect(original[3].aborted).toBe(true);
    await act(async () => late({items:titles(0,1,'Stale'),next_cursor:null}));
    expect(screen.queryByText('Stale 0')).not.toBeInTheDocument();
    expect(screen.getByText('Current 0')).toBeInTheDocument();
  });
  it('saves exactly the selected mapping and updates its row without reloading the catalog', async () => {
    const api = fixture(); const {container} = render(<VodMatches api={api}/>); await screen.findByText('Title 0');
    const initialGets = api.mock.calls.filter(([path,method]) => path.startsWith('/v2/iptv/matches') && method === 'GET').length;
    const row = container.querySelector('[data-match-id="vod:1:0"]')!;
    const opener = within(row as HTMLElement).getByRole('button', {name:'Match title'}); opener.focus(); fireEvent.click(opener);
    fireEvent.change(screen.getByLabelText('Metadata ID'), {target:{value:'tt0133093'}});
    fireEvent.click(screen.getByRole('button', {name:'Save match'}));
    await waitFor(() => expect(api).toHaveBeenCalledWith('/v2/iptv/matches','PUT',{vod_id:'vod:1:0',metadata_id:'tt0133093',type:'movie'},expect.any(AbortSignal)));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(within(row as HTMLElement).getByText('Matched')).toBeInTheDocument();
    expect(within(row as HTMLElement).getByRole('button',{name:'Edit match'})).toBeInTheDocument();
    expect(api.mock.calls.filter(([path,method]) => path.startsWith('/v2/iptv/matches') && method === 'GET')).toHaveLength(initialGets);
    await waitFor(() => expect(opener).toHaveFocus());
  });
  it('retains draft and filters on failure; pending submissions are disabled', async () => {
    const api = fixture(); let reject!: (error: Error) => void; const ordinary = api.getMockImplementation()!;
    api.mockImplementation((...args) => args[1] === 'PUT' ? new Promise((_, fail) => {reject=fail}) : ordinary(...args));
    render(<VodMatches api={api}/>); fireEvent.click((await screen.findAllByRole('button',{name:'Match title'}))[0]);
    fireEvent.change(screen.getByLabelText('Metadata ID'),{target:{value:'tmdb:42'}});
    fireEvent.click(screen.getByRole('button',{name:'Save match'}));
    expect(screen.getByRole('button',{name:'Saving…'})).toBeDisabled();
    await act(async()=>reject(new Error('This source is unavailable. Try again.')));
    expect(await screen.findByRole('alert')).toHaveTextContent('source is unavailable');
    expect(screen.getByLabelText('Metadata ID')).toHaveValue('tmdb:42');
    expect(screen.getByRole('button',{name:'Save match'})).toBeEnabled();
    expect(api.mock.calls.filter(([,method])=>method==='PUT')).toHaveLength(1);
  });
  it.each(['Cancel','Escape'])('%s closes without mutation and restores the opener and scroll anchor',async mode=>{
    const api=fixture();render(<VodMatches api={api}/>);await screen.findByText('Title 0');
    const region=screen.getByRole('region');scrollNearEnd(region,3);
    const opener=screen.getAllByRole('button',{name:'Match title'})[1];opener.focus();fireEvent.click(opener);
    expect(screen.getByLabelText('Metadata ID')).toHaveFocus();
    if(mode==='Cancel')fireEvent.click(screen.getByRole('button',{name:'Cancel'}));
    else fireEvent.keyDown(document,{key:'Escape',code:'Escape'});
    await waitFor(()=>expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(()=>expect(opener).toHaveFocus());expect(region.scrollTop).toBe(336);
    expect(api.mock.calls.some(([,method])=>method==='PUT')).toBe(false);
  });
  it('keeps at most 20 rows mounted after several pages and restores earlier rows when scrolling back',async()=>{
    const api=fixture();render(<VodMatches api={api}/>);await screen.findByText('Title 0');const region=screen.getByRole('region');
    for(const offset of [40,90,140,190]){
      scrollNearEnd(region,offset);
      await waitFor(()=>expect(api.mock.calls.some(([path])=>path.includes(`cursor=cursor_${offset+10}`))).toBe(true));
      await waitFor(()=>expect(document.querySelectorAll('[data-match-id]').length).toBeLessThanOrEqual(20));
    }
    scrollNearEnd(region,0);expect(await screen.findByText('Title 0')).toBeInTheDocument();
    expect(document.querySelectorAll('[data-match-id]').length).toBeLessThanOrEqual(20);
    expect(document.body.textContent).not.toContain('100000');
  });
});
