import { describe, expect, it } from 'vitest';
import {
  isLikelyPlaylistUrl,
  validateAndNormalizeUrl,
} from '../src/infrastructure/system/url-validator.js';

describe('url-validator', () => {
  it('accepts valid https URLs and normalizes them', () => {
    const res = validateAndNormalizeUrl('  https://www.youtube.com/watch?v=dQw4w9WgXcQ  ');
    expect(res.valid).toBe(true);
    expect(res.normalizedUrl).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    expect(res.isLikelyPlaylist).toBe(false);
  });

  it('detects playlist URLs from query parameters or path', () => {
    expect(
      validateAndNormalizeUrl('https://www.youtube.com/playlist?list=PL123').isLikelyPlaylist,
    ).toBe(true);
    expect(
      isLikelyPlaylistUrl('https://www.youtube.com/watch?v=abc&list=PL123'),
    ).toBe(true);
    expect(
      isLikelyPlaylistUrl('https://soundcloud.com/artist/sets/album-name'),
    ).toBe(true);
  });

  it('rejects empty, malformed, control-char, and non-http(s) URLs', () => {
    expect(validateAndNormalizeUrl('').valid).toBe(false);
    expect(validateAndNormalizeUrl('not-a-url').valid).toBe(false);
    expect(validateAndNormalizeUrl('file:///etc/passwd').valid).toBe(false);
    expect(validateAndNormalizeUrl('javascript:alert(1)').valid).toBe(false);
    expect(validateAndNormalizeUrl('https://example.com/\nrm -rf').valid).toBe(false);
  });
});
