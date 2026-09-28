/** Only safe display text crosses into the dashboard; raw transport bodies stay private. */
export function displayError(error: unknown, status: number): string {
  const message = typeof error === 'string' ? error.trim() : '';
  if (message === 'Provider connection limit reached' || message === 'All available connections are busy. Try this channel again shortly.')
    return 'This IPTV provider has reached its connection limit. Stop another stream or choose another provider.';
  if (message && message.length <= 240 && !/:\/\/|bearer |authorization|cookie|password|token[=:]|secret=|[<>\x00-\x1f]|traceback|stack trace/i.test(message)) return message;
  if (status === 429) return 'Too many requests. Wait a moment and try again.';
  if (status >= 500) return 'The server or provider is temporarily unavailable. Try again later.';
  return `Request failed (${status}). Try again.`;
}
