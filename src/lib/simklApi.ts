import type {Client} from './api';

export type SimklStatus = {
  configured: boolean;
  linked: boolean;
  tracking?: {pending: number; failed: number};
};
const invalid = () => new Error('The server returned an invalid SIMKL connection response.');
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalid();
  return value as Record<string, unknown>;
}
export function readSimklStatus(value: unknown): SimklStatus {
  const data = record(value);
  if (typeof data.configured !== 'boolean' || typeof data.linked !== 'boolean' || (data.linked && !data.configured)) throw invalid();
  const status: SimklStatus = {configured: data.configured, linked: data.linked};
  if (data.tracking != null) {
    const counts = record(data.tracking);
    if (![counts.pending, counts.failed].every(value => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0)) throw invalid();
    status.tracking = {pending: counts.pending as number, failed: counts.failed as number};
  }
  return status;
}
export function simklClient(api: Client, profile: string) {
  const base = `/v3/profiles/${encodeURIComponent(profile)}/simkl`;
  return {
    async status(signal?: AbortSignal) {return readSimklStatus(await api<unknown>(base, 'GET', undefined, signal));},
    async authorize(signal?: AbortSignal) {
      const data = record(await api<unknown>(`${base}/authorize`, 'POST', {}, signal));
      if (typeof data.authorization_url !== 'string' || data.authorization_url.length > 8192 || typeof data.expires_in_seconds !== 'number' || !Number.isSafeInteger(data.expires_in_seconds) || data.expires_in_seconds <= 0) throw invalid();
      let url: URL;
      try {url = new URL(data.authorization_url);} catch {throw invalid();}
      if (url.origin !== 'https://simkl.com' || url.pathname !== '/oauth2/authorize' || url.username || url.password || url.hash) throw invalid();
      return data.authorization_url;
    },
    async disconnect(signal?: AbortSignal) {
      const data = record(await api<unknown>(base, 'DELETE', undefined, signal));
      if (data.linked !== false) throw invalid();
    },
  };
}
