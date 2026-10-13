import {describe, it, expect, vi} from 'vitest';
import type {Client} from './api';
import {readSimklStatus, simklClient} from './simklApi';
const authorization = 'https://simkl.com/oauth2/authorize?response_type=code&state=fixture-state';
describe('SIMKL v3 account adapter', () => {
  it('reads actual configured/linked fields and retains only safe tracking counts', () => {
    expect(readSimklStatus({configured: true, linked: true, connection: {id: 'simkl:2'}, tracking: {pending: 1, failed: 2}, access_token: 'synthetic-private'})).toEqual({configured: true, linked: true, tracking: {pending: 1, failed: 2}});
    expect(readSimklStatus({configured: false, linked: false})).toEqual({configured: false, linked: false});
  });
  it('rejects retired connected fields and malformed counts instead of pretending to be unlinked', () => {
    for (const data of [{configured: true, connected: true}, {configured: false, linked: true}, {configured: true, linked: true, tracking: {pending: -1, failed: 0}}]) expect(() => readSimklStatus(data)).toThrow('invalid SIMKL connection');
  });
  it('uses the exact profile v3 status/authorize/delete routes', async () => {
    const api = vi.fn(async (_path: string, method?: string) => method === 'POST' ? {authorization_url: authorization, expires_in_seconds: 600} : method === 'DELETE' ? {linked: false} : {configured: true, linked: false});
    const client = simklClient(api as unknown as Client, '2'); const signal = new AbortController().signal;
    await client.status(signal); expect(await client.authorize(signal)).toBe(authorization); await client.disconnect(signal);
    expect(api.mock.calls).toEqual([['/v3/profiles/2/simkl', 'GET', undefined, signal], ['/v3/profiles/2/simkl/authorize', 'POST', {}, signal], ['/v3/profiles/2/simkl', 'DELETE', undefined, signal]]);
  });
  it('rejects retired authorization_url spelling and unsafe redirect recipients', async () => {
    const payloads = [{authorize_url: authorization, expires_in_seconds: 600}, ...['https://simkl.com.evil.example/oauth2/authorize', 'http://simkl.com/oauth2/authorize', 'https://user@simkl.com/oauth2/authorize', 'javascript:alert(1)', 'https://simkl.com/oauth2/authorize#fragment'].map(authorization_url => ({authorization_url, expires_in_seconds: 600}))];
    for (const payload of payloads) await expect(simklClient((async () => payload) as Client, '2').authorize()).rejects.toThrow('invalid SIMKL connection');
  });
  it('keeps failed unlink and parent/session errors visible', async () => {
    await expect(simklClient((async () => ({linked: true})) as Client, '2').disconnect()).rejects.toThrow('invalid SIMKL connection');
    const failure = new Error('Parent access required');
    await expect(simklClient((async () => {throw failure;}) as Client, '2').authorize()).rejects.toBe(failure);
  });
});
