import { describe, expect, it } from 'vitest';
import { cursorPage, isCursorToken, isPositiveId } from './v2';

describe('v2 response validators', () => {
  it('accepts only opaque cursor tokens', () => {
    expect(isCursorToken('p_50-A')).toBe(true);
    for (const value of ['', 'a b', 'a/b', 'x'.repeat(4097), null, 5]) expect(isCursorToken(value)).toBe(false);
  });
  it('accepts positive safe integer IDs as numbers or decimal strings', () => {
    for (const value of [1, '208', Number.MAX_SAFE_INTEGER]) expect(isPositiveId(value)).toBe(true);
    for (const value of [0, -1, '01', '1.0', 1.5, '9007199254740993', '', null, undefined, {}]) expect(isPositiveId(value)).toBe(false);
  });
  it('validates page shape once and maps each row', () => {
    expect(cursorPage({ items: [1, 2], next_cursor: null }, 50, value => String(value))).toEqual({ items: ['1', '2'], next_cursor: null });
    expect(() => cursorPage({ items: [1, 2], next_cursor: null }, 1)).toThrow('invalid catalog page');
    expect(() => cursorPage({ items: [], next_cursor: 'bad cursor' })).toThrow('invalid catalog page');
    expect(() => cursorPage({ items: [{}], next_cursor: null }, 50, () => { throw new Error('bad row'); })).toThrow('bad row');
  });
});
