/** Keep device codes as strings: decimal codes may start with zero. */
export function readDeviceCode(raw: string): string | undefined {
  const code = raw.trim().toUpperCase();
  return /^(?:[0-9]{8}|[0-9A-F]{10})$/.test(code) ? code : undefined;
}
