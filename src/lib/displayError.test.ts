import {describe, expect, it} from 'vitest';
import {displayError} from './displayError';
describe('safe actionable errors', () => {
  it('distinguishes connection capacity from rate limiting', () => {
    expect(displayError('Provider connection limit reached',429)).toContain('Stop another stream');
    expect(displayError(null,429)).toContain('Too many requests');
  });
  it('preserves normal validation but hides transport details', () => {
    expect(displayError('Provider name is required',400)).toBe('Provider name is required');
    for (const message of ['https://provider.test/private', 'Authorization: Bearer secret', '<html>oops</html>', 'Cookie: private'])
      expect(displayError(message,502)).toBe('The server or provider is temporarily unavailable. Try again later.');
  });
});
