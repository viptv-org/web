// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup, act } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { Connections } from './Admin';
import { createAccountClient } from './lib/accountApi';
const cookieClient = () => createAccountClient(() => {}).api;
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
async function setup() {
  const api = vi.fn().mockResolvedValue([]);
  render(<Connections api={api} kind="providers"/>);
  await screen.findByText('No providers connected');
  fireEvent.click(screen.getByRole('button', { name: 'Add provider' }));
  for (const [label, value] of [['Provider name', 'My TV'], ['Server URL', 'https://tv.example'], ['Username', 'alice'], ['Password', 'private']]) fireEvent.change(screen.getByLabelText(label), { target: { value } });
  return api;
}
describe('provider connection allowance', () => {
  it('defaults to one and explains subscription and server-process limits', async () => {
    await setup(); expect(screen.getByLabelText('Concurrent upstream streams')).toHaveValue(1);
    expect(screen.getByText(/Must not exceed your subscription allowance/)).toHaveTextContent('per server process');
    expect(screen.getByText(/not automatically read from your provider account/)).toBeInTheDocument();
  });
  it('defaults new providers to all three scopes and sends strict booleans', async () => {
    const api = await setup();
    for (const name of ['Live TV', 'Movies', 'Series']) expect(screen.getByRole('switch', { name })).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Connect provider' }));
    await waitFor(() => expect(api).toHaveBeenCalledWith('/providers', 'POST', expect.objectContaining({ enable_live: true, enable_movies: true, enable_series: true })));
  });
  it('adds a VOD-only provider with live explicitly false', async () => {
    const api = await setup();
    fireEvent.click(screen.getByRole('switch', { name: 'Live TV' }));
    fireEvent.click(screen.getByRole('button', { name: 'Connect provider' }));
    await waitFor(() => expect(api).toHaveBeenCalledWith('/providers', 'POST', expect.objectContaining({ enable_live: false, enable_movies: true, enable_series: true, max_connections: 1 })));
  });
  it('sends a numeric configured cap in the provider POST', async () => {
    const api = await setup(); fireEvent.change(screen.getByLabelText('Concurrent upstream streams'), { target: { value: '4' } });
    fireEvent.click(screen.getByRole('button', { name: 'Connect provider' }));
    await waitFor(() => expect(api).toHaveBeenCalledWith('/providers', 'POST', expect.objectContaining({ max_connections: 4 })));
  });
  it.each(['0', '-1', '33', '1.5', ''])('rejects invalid concurrency %s without sending credentials', async value => {
    const api = await setup(); const input = screen.getByLabelText('Concurrent upstream streams');
    fireEvent.change(input, { target: { value } }); expect(input).toBeInvalid();
    fireEvent.click(screen.getByRole('button', { name: 'Connect provider' }));
    expect(api.mock.calls.some(([, method]) => method === 'POST')).toBe(false);
  });
  it('displays the server cap and offers private credential renewal', async () => {
    const api = vi.fn().mockResolvedValue([{ id: 'p1', name: 'My TV', url: 'https://tv.example', username: 'alice', enabled: true, max_connections: 3 }]);
    render(<Connections api={api} kind="providers"/>);
    expect(await screen.findByText('Concurrent upstream streams: 3 · per server process')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Renew credentials for My TV' })).toBeInTheDocument();
    expect(screen.queryByText('alice')).not.toBeInTheDocument();
  });
  it('toggles enabled through PATCH while keeping disabled rows visible', async () => {
    let provider = { id: 'p/1', name: 'My TV', url: 'https://tv.example', username: 'alice', enabled: true, max_connections: 1 };
    const api = vi.fn().mockImplementation((_path, method, body) => { if (method === 'PATCH') provider = { ...provider, ...body }; return Promise.resolve(method === 'PATCH' ? provider : [provider]); });
    render(<Connections api={api} kind="providers"/>); fireEvent.click(await screen.findByRole('switch', { name: 'Enable My TV' }));
    await waitFor(() => expect(api).toHaveBeenCalledWith('/providers/p%2F1', 'PATCH', { enabled: false }));
    await waitFor(() => expect(screen.getByRole('switch', { name: 'Enable My TV' })).toHaveAttribute('aria-checked', 'false'));
    expect(screen.getByText('My TV')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('switch', { name: 'Enable My TV' }));
    await waitFor(() => expect(api).toHaveBeenCalledWith('/providers/p%2F1', 'PATCH', { enabled: true }));
  });
  it('explicitly saves numeric caps and blocks conflicting mutations while pending', async () => {
    let resolve!: (value: unknown) => void; const pending = new Promise(done => { resolve = done; });
    const api = vi.fn().mockImplementation((_path, method) => method === 'PATCH' ? pending : Promise.resolve([{ id: 'p1', name: 'My TV', url: 'https://tv.example', username: 'alice', enabled: true, max_connections: 1 }]));
    render(<Connections api={api} kind="providers"/>); const input = await screen.findByLabelText('Concurrent upstream streams for My TV');
    expect(screen.getByRole('button', { name: 'Save stream limit' })).toBeDisabled();
    fireEvent.change(input, { target: { value: '4' } }); expect(api.mock.calls.some(([, method]) => method === 'PATCH')).toBe(false);
    const save = screen.getByRole('button', { name: 'Save stream limit' });
    await waitFor(() => expect(save).not.toBeDisabled());
    fireEvent.click(save);
    await waitFor(() => expect(api).toHaveBeenCalledWith('/providers/p1', 'PATCH', { max_connections: 4 }));
    expect(input).toBeDisabled(); expect(screen.getByRole('switch', { name: 'Enable My TV' })).toBeDisabled();
    for (const scope of ['Live TV', 'Movies', 'Series']) expect(screen.getByRole('switch', { name: `${scope} for My TV` })).toBeDisabled(); expect(screen.getByRole('button', { name: 'Sync' })).toBeDisabled();
    await act(async () => resolve({}));
    expect(await screen.findByText('Provider settings saved.')).toBeInTheDocument();
  });
  it('surfaces an active-permit 409 and preserves the editable cap for retry', async () => {
    const provider = { id: 'p1', name: 'My TV', url: 'https://tv.example', username: 'alice', enabled: true, max_connections: 1 };
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_input, options) => new Response(JSON.stringify(options?.method === 'PATCH' ? { error: 'Stop active provider streams before changing the connection limit.' } : [provider]), { status: options?.method === 'PATCH' ? 409 : 200 }));
    render(<Connections api={cookieClient()} kind="providers"/>);
    fireEvent.change(await screen.findByLabelText('Concurrent upstream streams for My TV'), { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save stream limit' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Stop active provider streams');
    expect(screen.getByLabelText('Concurrent upstream streams for My TV')).toHaveValue(3);
    expect(screen.getByRole('button', { name: 'Save stream limit' })).not.toBeDisabled();
    expect(screen.getByText('Concurrent upstream streams: 1 · per server process')).toBeInTheDocument();
  });
  it('shows VOD-only and all-scope providers without changing legacy defaults', async () => {
    const base = { url: 'https://tv.example', username: 'viewer', enabled: true, max_connections: 1 };
    const api = vi.fn().mockResolvedValue([
      { ...base, id: 'q', name: 'Queens', enable_live: false, enable_movies: true, enable_series: true },
      { ...base, id: 't', name: 'ThisIPTV', enable_live: true, enable_movies: true, enable_series: true },
      { ...base, id: 'old', name: 'Legacy' },
    ]);
    render(<Connections api={api} kind="providers"/>);
    expect(await screen.findByLabelText('Content scopes for Queens')).toHaveTextContent('Scopes: Movies, Series');
    expect(screen.getByRole('switch', { name: 'Live TV for Queens' })).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByLabelText('Content scopes for ThisIPTV')).toHaveTextContent('Scopes: Live TV, Movies, Series');
    expect(screen.getByLabelText('Content scopes for Legacy')).toHaveTextContent('Scopes: Live TV, Movies, Series');
    for (const scope of ['Live TV', 'Movies', 'Series']) expect(screen.getByRole('switch', { name: `${scope} for Legacy` })).toHaveAttribute('aria-checked', 'true');
  });
  it.each([['Live TV', 'enable_live'], ['Movies', 'enable_movies'], ['Series', 'enable_series']])('PATCHes only the changed %s scope and reloads server state', async (label, key) => {
    let provider = { id: 'p/1', name: 'My TV', url: 'https://tv.example', username: 'viewer', enabled: true, max_connections: 3 };
    const api = vi.fn().mockImplementation((_path, method, body) => { if (method === 'PATCH') provider = { ...provider, ...body }; return Promise.resolve(method === 'PATCH' ? provider : [provider]); });
    render(<Connections api={api} kind="providers"/>);
    fireEvent.click(await screen.findByRole('switch', { name: `${label} for My TV` }));
    await waitFor(() => expect(api).toHaveBeenCalledWith('/providers/p%2F1', 'PATCH', { [key]: false }));
    await waitFor(() => expect(screen.getByRole('switch', { name: `${label} for My TV` })).toHaveAttribute('aria-checked', 'false'));
    expect(screen.getByRole('switch', { name: 'Enable My TV' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByText('Concurrent upstream streams: 3 · per server process')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('switch', { name: `${label} for My TV` }));
    await waitFor(() => expect(api).toHaveBeenCalledWith('/providers/p%2F1', 'PATCH', { [key]: true }));
  });
  it('serializes add-form scope booleans through the real API client', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (_input, options) => new Response(JSON.stringify(options?.method === 'POST' ? { id: 'new' } : []), { status: 200 }));
    render(<Connections api={cookieClient()} kind="providers"/>);
    await screen.findByText('No providers connected');
    fireEvent.click(screen.getByRole('button', { name: 'Add provider' }));
    for (const [label, value] of [['Provider name', 'Fixture TV'], ['Server URL', 'https://tv.example'], ['Username', 'viewer'], ['Password', 'fixture']]) fireEvent.change(screen.getByLabelText(label), { target: { value } });
    fireEvent.click(screen.getByRole('switch', { name: 'Movies' }));
    fireEvent.click(screen.getByRole('switch', { name: 'Series' }));
    fireEvent.click(screen.getByRole('button', { name: 'Connect provider' }));
    await waitFor(() => {
      const post = fetchMock.mock.calls.find(([, options]) => options?.method === 'POST');
      expect(post?.[0]).toBe('/api/providers');
      expect(JSON.parse(String(post?.[1]?.body))).toMatchObject({ enable_live: true, enable_movies: false, enable_series: false, max_connections: 1 });
    });
  });
  it('serializes boolean scope PATCH through the real API client and displays the response', async () => {
    let provider = { id: 'wire', name: 'Wire TV', url: 'https://tv.example', username: 'viewer', enabled: true, enable_live: true, enable_movies: true, enable_series: true };
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (_input, options) => {
      if (options?.method === 'PATCH') provider = { ...provider, ...JSON.parse(String(options.body)) };
      return new Response(JSON.stringify(options?.method === 'PATCH' ? provider : [provider]), { status: 200 });
    });
    render(<Connections api={cookieClient()} kind="providers"/>);
    fireEvent.click(await screen.findByRole('switch', { name: 'Live TV for Wire TV' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/providers/wire', expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ enable_live: false }) })));
    await waitFor(() => expect(screen.getByLabelText('Content scopes for Wire TV')).toHaveTextContent('Scopes: Movies, Series'));
  });
  it('retains server scope state after a failed save and permits retry', async () => {
    const provider = { id: 'p', name: 'My TV', url: 'https://tv.example', username: 'viewer', enabled: true, enable_live: true };
    const api = vi.fn().mockImplementation((_path, method) => method === 'PATCH' ? Promise.reject(new Error('Scope update failed')) : Promise.resolve([provider]));
    render(<Connections api={api} kind="providers"/>);
    fireEvent.click(await screen.findByRole('switch', { name: 'Live TV for My TV' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Scope update failed');
    expect(screen.getByRole('switch', { name: 'Live TV for My TV' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('switch', { name: 'Live TV for My TV' })).not.toBeDisabled();
  });
  it.each(['0', '33', '1.5'])('does not PATCH invalid cap %s', async value => {
    const api = vi.fn().mockResolvedValue([{ id: 'p1', name: 'My TV', url: 'https://tv.example', username: 'alice', enabled: true, max_connections: 1 }]);
    render(<Connections api={api} kind="providers"/>);
    fireEvent.change(await screen.findByLabelText('Concurrent upstream streams for My TV'), { target: { value } });
    expect(screen.getByRole('button', { name: 'Save stream limit' })).toBeDisabled();
    expect(api.mock.calls.some(([, method]) => method === 'PATCH')).toBe(false);
  });
});
