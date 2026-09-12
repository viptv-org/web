import { ApiError, type Client } from './api';

/** Credentials stay in HttpOnly cookies; only the CSRF value lives in memory. */
export function createAccountClient(onExpired: () => void) {
  let csrf = '';
  let epoch = 0;
  let refreshRevision = 0;
  let refresh: Promise<void> | undefined;
  const controllers = new Set<AbortController>();
  const publicPaths = new Set(['/auth/status', '/auth/login', '/auth/register', '/auth/recover', '/auth/refresh', '/auth/logout']);
  const acceptCsrf = (data: unknown, response?: Response) => {
    const value = data && typeof data === 'object' ? (data as Record<string, unknown>).csrf_token : undefined;
    const header = response?.headers.get('X-CSRF-Token');
    if (typeof value === 'string') csrf = value;
    else if (header) csrf = header;
  };
  async function request<T>(path: string, method = 'GET', body?: unknown, signal?: AbortSignal): Promise<T> {
    const owner = epoch;
    const initialRevision = refreshRevision;
    const send = async (): Promise<T> => {
      const controller = new AbortController(); controllers.add(controller);
      const timeout = path.endsWith('/sync') ? 180000 : path === '/playback' ? 70000 : 45000;
      try {
        const response = await fetch(`/api${path}`, {
          method, credentials: 'include', cache: 'no-store',
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(timeout), ...(signal ? [signal] : [])]),
          headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(method !== 'GET' && csrf ? { 'X-CSRF-Token': csrf } : {}) },
          ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
        });
        const text = await response.text();
        let data: unknown;
        try { data = text ? JSON.parse(text, (key, value) => ['id', 'profile_id', 'account_id', 'device_id', 'addon_id', 'provider_id', 'vod_id'].includes(key) && typeof value === 'number' ? String(value) : value) : undefined; }
        catch { throw new Error('The server returned an unexpected response.'); }
        if (owner !== epoch || signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
        const record = data && typeof data === 'object' ? data as Record<string, unknown> : undefined;
        if (!response.ok) throw new ApiError(
          ['/auth/login', '/auth/recover'].includes(path) ? 'Sign-in or recovery failed. Check your details and try again.' : path === '/auth/register' ? 'Account creation failed. Check your details and try again.' : typeof record?.error === 'string' ? record.error : `Request failed (${response.status}).`,
          response.status, typeof record?.error_code === 'string' ? record.error_code : undefined,
        );
        acceptCsrf(data, response);
        return data as T;
      } finally { controllers.delete(controller); }
    };
    try { return await send(); }
    catch (error) {
      if (!(error instanceof ApiError) || error.status !== 401 || publicPaths.has(path) || owner !== epoch) throw error;
      // One shared rotation for concurrent failures. A 401 is an explicit rejection,
      // unlike a network timeout, so one retry cannot duplicate accepted mutations.
      try {
        if (initialRevision === refreshRevision) {
          if (!refresh) {
            refresh = request<void>('/auth/refresh', 'POST', {}).then(() => { refreshRevision++; }).finally(() => { refresh = undefined; });
          }
          await refresh;
        }
        if (owner !== epoch || signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
        return await send();
      } catch (second) {
        if (owner === epoch && second instanceof ApiError && second.status === 401) {
          clear(); onExpired();
        }
        throw second;
      }
    }
  }
  function clear() { epoch++; csrf = ''; refresh = undefined; for (const controller of controllers) controller.abort(); controllers.clear(); }
  return { api: request as Client, clear, setCsrf: acceptCsrf };
}
