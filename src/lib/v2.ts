export type CursorPage<T> = { items: T[]; next_cursor: string | null };
export type IptvConnection = {
  id: string; name: string; enabled: boolean; enable_live: boolean;
  enable_movies: boolean; enable_series: boolean; credentials_encrypted: boolean;
  refresh: { state: string; error?: string | null; error_code?: string | null; last_success_at?: number | null };
};
export type VodMatch = { vod_id: string; provider_id: string; type: 'movie' | 'series'; name: string; year: number | null; poster?: string | null; matched?: boolean; metadataId?: string };
/** A bounded control response, not a whole-library count or index. */
export function cursorPage<T>(value: unknown, limit = 50): CursorPage<T> {
  const page = value as Partial<CursorPage<T>> | null;
  if (!page || !Array.isArray(page.items) || page.items.length > limit ||
      !(page.next_cursor === null || typeof page.next_cursor === 'string' && /^[A-Za-z0-9_-]{1,4096}$/.test(page.next_cursor)))
    throw new Error('The server returned an invalid catalog page. Update the server or try again.');
  return { items: page.items, next_cursor: page.next_cursor };
}
