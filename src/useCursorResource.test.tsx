// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { useCursorResource } from './useCursorResource';
import type { Client } from './lib/api';

afterEach(cleanup);
const key = (row: {id: string}) => row.id;
const row = (id: string) => ({id});
const path = '/v2/iptv/matches?limit=50';
describe('cursor page integrity', () => {
  it('rejects duplicate initial rows and empty pages that claim a continuation', async () => {
    for (const items of [[row('one'), row('one')], []]) {
      const api = vi.fn().mockResolvedValue({items, next_cursor:'cursor_a'}) as Client;
      const {result,unmount} = renderHook(() => useCursorResource(api,path,key));
      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.error).not.toBe('');
      expect(result.current.items).toEqual([]);
      expect(result.current.next).toBeNull();
      unmount();
    }
  });
  it('refuses overlapping continuation rows without changing committed rows', async () => {
    const api = vi.fn().mockResolvedValueOnce({items:[row('one')],next_cursor:'cursor_a'})
      .mockResolvedValueOnce({items:[row('one'),row('two')],next_cursor:'cursor_b'}) as Client;
    const {result} = renderHook(() => useCursorResource(api,path,key));
    await waitFor(() => expect(result.current.items).toHaveLength(1));
    act(() => result.current.more());
    await waitFor(() => expect(result.current.error).toContain('repeated catalog rows'));
    expect(result.current.items).toEqual([row('one')]);
    expect(result.current.next).toBe('cursor_a');
  });
  it('detects a multi-page cursor cycle, then resets that scope on reload', async () => {
    const api = vi.fn().mockResolvedValueOnce({items:[row('one')],next_cursor:'cursor_a'})
      .mockResolvedValueOnce({items:[row('two')],next_cursor:'cursor_b'})
      .mockResolvedValueOnce({items:[row('three')],next_cursor:'cursor_a'})
      .mockResolvedValueOnce({items:[row('one')],next_cursor:null}) as Client;
    const {result} = renderHook(() => useCursorResource(api,path,key));
    await waitFor(() => expect(result.current.items).toHaveLength(1));
    act(() => result.current.more());
    await waitFor(() => expect(result.current.items).toHaveLength(2));
    act(() => result.current.more());
    await waitFor(() => expect(result.current.error).toContain('repeated or interrupted'));
    expect(result.current.items).toEqual([row('one'),row('two')]);
    act(() => result.current.reload());
    await waitFor(() => expect(result.current.next).toBeNull());
    expect(result.current.error).toBe('');
    expect(result.current.items).toEqual([row('one')]);
  });
  it('retries a failed continuation and accepts an empty terminal page', async () => {
    const api = vi.fn().mockResolvedValueOnce({items:[row('one')],next_cursor:'cursor_a'})
      .mockRejectedValueOnce(new Error('Temporary catalog failure.'))
      .mockResolvedValueOnce({items:[row('two')],next_cursor:'cursor_b'})
      .mockResolvedValueOnce({items:[],next_cursor:null}) as Client;
    const {result} = renderHook(() => useCursorResource(api,path,key));
    await waitFor(() => expect(result.current.items).toHaveLength(1));
    act(() => result.current.more());
    await waitFor(() => expect(result.current.error).toContain('Temporary'));
    act(() => result.current.more());
    await waitFor(() => expect(result.current.items).toHaveLength(2));
    act(() => result.current.more());
    await waitFor(() => expect(result.current.next).toBeNull());
    expect(result.current.error).toBe('');
    expect(result.current.items).toEqual([row('one'),row('two')]);
    expect(api).toHaveBeenCalledTimes(4);
  });
  it('preserves committed row identity guards when a same-scope refresh fails', async () => {
    const api = vi.fn().mockResolvedValueOnce({items:[row('one')],next_cursor:'cursor_a'})
      .mockRejectedValueOnce(new Error('Refresh temporarily unavailable.'))
      .mockResolvedValueOnce({items:[row('one')],next_cursor:'cursor_b'}) as Client;
    const {result} = renderHook(() => useCursorResource(api,path,key));
    await waitFor(() => expect(result.current.items).toHaveLength(1));
    act(() => result.current.reload());
    await waitFor(() => expect(result.current.error).toContain('Refresh temporarily'));
    act(() => result.current.more());
    await waitFor(() => expect(result.current.error).toContain('repeated catalog rows'));
    expect(result.current.items).toEqual([row('one')]);
  });
});
