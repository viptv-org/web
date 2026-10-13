// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import {render, screen, fireEvent, waitFor} from '@testing-library/react';
import {describe, it, expect, vi} from 'vitest';
import {SimklConnection} from './SimklConnection';
import type {Client} from './lib/api';
const authorization = 'https://simkl.com/oauth2/authorize?response_type=code&state=fixture-state';
describe('profile SIMKL connection', () => {
  it('links through the v3 authorization response and presents no unsupported sync/list actions', async () => {
    const api = vi.fn(async (_path: string, method?: string) => method === 'POST' ? {authorization_url: authorization, expires_in_seconds: 600} : {configured: true, linked: false}); const navigate = vi.fn();
    render(<SimklConnection api={api as unknown as Client} profile="2" onAuthorize={navigate}/>);
    const link = await screen.findByRole('button', {name: 'Link SIMKL'}); await waitFor(() => expect(link).toBeEnabled());
    fireEvent.click(link); await waitFor(() => expect(navigate).toHaveBeenCalledWith(authorization));
    expect(api.mock.calls.map(call => call[0])).toEqual(['/v3/profiles/2/simkl', '/v3/profiles/2/simkl/authorize']);
    expect(screen.queryByText(/merge|synchroniz|custom lists/i)).not.toBeInTheDocument();
  });
  it('uses actual linked state, unlinks and reloads exactly one status read', async () => {
    let linked = true; const api = vi.fn(async (_path: string, method?: string) => {if (method === 'DELETE') linked = false; return {configured: true, linked, tracking: {pending: 0, failed: 0}};});
    render(<SimklConnection api={api as unknown as Client} profile="2"/>); fireEvent.click(await screen.findByRole('button', {name: 'Disconnect SIMKL'}));
    await screen.findByText('SIMKL disconnected. VIPTV history and saved titles retained.'); await waitFor(() => expect(screen.getByRole('button', {name: 'Link SIMKL'})).toBeEnabled());
    expect(api.mock.calls.map(call => call[1])).toEqual(['GET', 'DELETE', 'GET']);
  });
  it('disables authorization for an unconfigured host or invalid legacy response', async () => {
    const api = vi.fn(async (path: string) => path.includes('/2/') ? {configured: false, linked: false} : {configured: true, connected: false});
    const view = render(<SimklConnection api={api as unknown as Client} profile="2"/>);
    await screen.findByText('SIMKL is not configured on this server.'); expect(screen.getByRole('button', {name: 'Link SIMKL'})).toBeDisabled();
    view.rerender(<SimklConnection api={api as unknown as Client} profile="3"/>);
    await screen.findByText('The server returned an invalid SIMKL connection response.'); expect(screen.getByRole('button', {name: 'Link SIMKL'})).toBeDisabled();
  });
  it('never redirects a retired profile authorization after a profile change', async () => {
    let finish: (value: unknown) => void = () => {}; let oldSignal: AbortSignal | undefined;
    const api = vi.fn((path: string, method?: string, _body?: unknown, signal?: AbortSignal) => method === 'POST' ? new Promise(resolve => {finish = resolve; oldSignal = signal;}) : Promise.resolve({configured: true, linked: false})); const navigate = vi.fn();
    const view = render(<SimklConnection api={api as unknown as Client} profile="2" onAuthorize={navigate}/>);
    const link = await screen.findByRole('button', {name: 'Link SIMKL'}); await waitFor(() => expect(link).toBeEnabled()); fireEvent.click(link);
    await waitFor(() => expect(oldSignal).toBeDefined()); view.rerender(<SimklConnection api={api as unknown as Client} profile="3" onAuthorize={navigate}/>);
    expect(oldSignal?.aborted).toBe(true); finish({authorization_url: authorization, expires_in_seconds: 600});
    await waitFor(() => expect(screen.getByRole('button', {name: 'Link SIMKL'})).toBeEnabled()); expect(navigate).not.toHaveBeenCalled();
  });
});
