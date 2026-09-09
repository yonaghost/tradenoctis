import { describe, expect, it } from 'vitest';
import { assertPublicHttpUrl, BlockedUrlError } from '../net/fetchGuarded';

describe('assertPublicHttpUrl', () => {
  it('accepts well-formed public http(s) URLs', () => {
    expect(() => assertPublicHttpUrl('https://example.com/page')).not.toThrow();
    expect(() => assertPublicHttpUrl('http://example.com')).not.toThrow();
  });

  it('rejects malformed URLs', () => {
    expect(() => assertPublicHttpUrl('not a url')).toThrow(BlockedUrlError);
  });

  it('rejects non-http(s) protocols', () => {
    expect(() => assertPublicHttpUrl('file:///etc/passwd')).toThrow(BlockedUrlError);
    expect(() => assertPublicHttpUrl('ftp://example.com')).toThrow(BlockedUrlError);
  });

  it('rejects localhost and private network literals', () => {
    expect(() => assertPublicHttpUrl('http://localhost/admin')).toThrow(BlockedUrlError);
    expect(() => assertPublicHttpUrl('http://127.0.0.1/admin')).toThrow(BlockedUrlError);
    expect(() => assertPublicHttpUrl('http://192.168.1.1/')).toThrow(BlockedUrlError);
    expect(() => assertPublicHttpUrl('http://10.0.0.5/')).toThrow(BlockedUrlError);
    expect(() => assertPublicHttpUrl('http://169.254.169.254/latest/meta-data')).toThrow(BlockedUrlError);
  });
});
