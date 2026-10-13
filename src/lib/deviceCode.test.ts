import {describe, it, expect} from 'vitest';
import {readDeviceCode} from './deviceCode';
describe('host-compatible device codes', () => {
  it('preserves all eight digits including leading zeroes', () => {
    for (const code of ['00123456', '00000000', '12345678']) expect(readDeviceCode(code)).toBe(code);
  });
  it('normalizes documented ten-hex legacy codes without numeric conversion', () => {
    expect(readDeviceCode(' 00ab12cd3f ')).toBe('00AB12CD3F');
    expect(readDeviceCode('0012345678')).toBe('0012345678');
  });
  it('rejects other lengths, eight-letter examples, nonhex characters and internal separators', () => {
    for (const code of ['', '123456', '1234567', '123456789', '12345678901', 'ABCD1234', 'G012345678', 'AB12-CD34E', '00 123456']) expect(readDeviceCode(code)).toBeUndefined();
  });
});
