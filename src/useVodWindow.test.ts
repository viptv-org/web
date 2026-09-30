// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ApiError, type Client } from './lib/api';
import { useVodWindow } from './useVodWindow';

afterEach(cleanup);
it('freezes rows when a dialog opens during an adjacent request', async () => {
  let finish!: (value: unknown) => void;
  const api = vi.fn((path: string) => path.includes('cursor') ? new Promise(done => {finish=done;}) : Promise.resolve({items:[{vod_id:'opener'}],next_cursor:'next',previous_cursor:null})) as Client;
  const {result,rerender}=renderHook(({paused})=>useVodWindow(api,'/matches?limit=50',paused),{initialProps:{paused:false}});
  await waitFor(()=>expect(result.current.loading).toBe(false));
  act(()=>result.current.more()); rerender({paused:true});
  await act(async()=>finish({items:[{vod_id:'later'}],next_cursor:null,previous_cursor:null}));
  expect(result.current.items.map(row=>row.vod_id)).toEqual(['opener']);
  expect(result.current.loading).toBe(false);
  expect(result.current.next).toBe('next');
});
it('reloads evicted adjacent pages in both directions while retaining only 150 rows', async () => {
  const api = vi.fn(async (path: string) => {
    const offset = Number(new URLSearchParams(path.split('?')[1]).get('cursor')?.slice(1) ?? 0);
    return { items: Array.from({length: 50}, (_, i) => ({vod_id: String(offset+i)})), next_cursor: `p${offset+50}`, previous_cursor: offset ? `p${offset-50}` : null };
  }) as Client;
  const {result} = renderHook(() => useVodWindow(api, '/matches?limit=50'));
  await waitFor(() => expect(result.current.loading).toBe(false));
  for (let offset=50; offset<=500; offset+=50) {
    act(() => result.current.more());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.items.at(-1)?.vod_id).toBe(String(offset+49));
    expect(result.current.items.length).toBeLessThanOrEqual(150);
    expect(new Set(result.current.items.map(row=>row.vod_id)).size).toBe(result.current.items.length);
  }
  expect(result.current.base).toBe(400);
  for (let offset=350; offset>=0; offset-=50) {
    act(() => result.current.back());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.base).toBe(offset);
    expect(result.current.items[0].vod_id).toBe(String(offset));
    expect(result.current.items.length).toBe(150);
  }
  expect(result.current.previous).toBeNull();
  expect(result.current.extent).toBe(550);
});

it('preserves the failed direction and rows, and distinguishes a changed catalog', async () => {
  let fail = true;
  const api = vi.fn(async (path: string) => {
    if(path.includes('cursor') && fail) throw new Error('Temporarily unavailable');
    return {items:[{vod_id:path.includes('cursor')?'second':'first'}], next_cursor:path.includes('cursor')?null:'next', previous_cursor:null};
  }) as Client;
  const {result} = renderHook(() => useVodWindow(api, '/matches?limit=50'));
  await waitFor(() => expect(result.current.loading).toBe(false));
  act(() => result.current.more());
  await waitFor(() => expect(result.current.error).toBe('Temporarily unavailable'));
  expect(result.current.items[0].vod_id).toBe('first');
  fail=false; act(() => result.current.retry());
  await waitFor(() => expect(result.current.items.length).toBe(2));
  const changed = vi.fn(async (path:string) => {
    if(path.includes('cursor')) throw new ApiError('Catalog changed. Refresh titles.',409,'catalog_changed');
    return {items:[{vod_id:'fresh'}],next_cursor:'next',previous_cursor:null};
  }) as Client;
  const other = renderHook(() => useVodWindow(changed, '/matches?limit=50'));
  await waitFor(() => expect(other.result.current.loading).toBe(false));
  act(() => other.result.current.more());
  await waitFor(() => expect(other.result.current.refreshRequired).toBe(true));
  expect(other.result.current.items[0].vod_id).toBe('fresh');
  act(() => other.result.current.reload());
  await waitFor(() => expect(other.result.current.refreshRequired).toBe(false));
});
