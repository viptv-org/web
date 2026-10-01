export type CursorPage<T> = { items: T[]; next_cursor: string | null };
export type IptvConnection = {
  id: string; name: string; enabled: boolean; enable_live: boolean;
  enable_movies: boolean; enable_series: boolean; credentials_encrypted: boolean;
  refresh: { state: string; error?: string | null; error_code?: string | null; last_success_at?: number | null };
};
export type VodMatch = { vod_id: string; provider_id: string; type: 'movie' | 'series'; name: string; year: number | null; poster?: string | null; matched?: boolean; metadataId?: string };
/** An opaque v2 continuation token as the backend issues it. */
export const isCursorToken = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9_-]{1,4096}$/.test(value);
/** A positive database ID, sent as a JSON number or a decimal string. */
export const isPositiveId = (value: unknown): value is number | string =>
  (typeof value === 'number' || typeof value === 'string') && /^[1-9][0-9]*$/.test(String(value)) && Number.isSafeInteger(Number(value));
/** A bounded control response, not a whole-library count or index. Rows are checked by `row`. */
export function cursorPage<T>(value: unknown, limit = 50, row: (value: unknown) => T = value => value as T): CursorPage<T> {
  const page = value as Partial<CursorPage<unknown>> | null;
  if (!page || !Array.isArray(page.items) || page.items.length > limit || !(page.next_cursor === null || isCursorToken(page.next_cursor)))
    throw new Error('The server returned an invalid catalog page. Update the server or try again.');
  return { items: page.items.map(row), next_cursor: page.next_cursor };
}
