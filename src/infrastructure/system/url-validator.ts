export interface ValidatedUrlResult {
  valid: boolean;
  normalizedUrl: string;
  isLikelyPlaylist: boolean;
  error?: string;
}

const CONTROL_CHARS_REGEX = /[\u0000-\u001F\u007F]/;

/**
 * Validates and normalizes user-supplied URLs.
 * Only http: and https: URLs with a valid hostname are accepted.
 */
export function validateAndNormalizeUrl(rawInput: string): ValidatedUrlResult {
  const trimmed = rawInput.trim();

  if (trimmed.length === 0) {
    return {
      valid: false,
      normalizedUrl: '',
      isLikelyPlaylist: false,
      error: 'URL cannot be empty.',
    };
  }

  if (trimmed.length > 2048) {
    return {
      valid: false,
      normalizedUrl: '',
      isLikelyPlaylist: false,
      error: 'URL exceeds maximum allowed length (2048 characters).',
    };
  }

  if (CONTROL_CHARS_REGEX.test(trimmed)) {
    return {
      valid: false,
      normalizedUrl: '',
      isLikelyPlaylist: false,
      error: 'URL contains invalid control characters.',
    };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return {
      valid: false,
      normalizedUrl: '',
      isLikelyPlaylist: false,
      error: 'Invalid URL format. Include http:// or https://.',
    };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return {
      valid: false,
      normalizedUrl: '',
      isLikelyPlaylist: false,
      error: `Unsupported URL protocol "${parsed.protocol}". Only http:// and https:// are allowed.`,
    };
  }

  if (!parsed.hostname || parsed.hostname.trim().length === 0) {
    return {
      valid: false,
      normalizedUrl: '',
      isLikelyPlaylist: false,
      error: 'URL must include a valid hostname.',
    };
  }

  const normalizedUrl = parsed.toString();
  return {
    valid: true,
    normalizedUrl,
    isLikelyPlaylist: isLikelyPlaylistUrl(normalizedUrl),
  };
}

/**
 * Heuristic check for playlist-like URLs across common platforms.
 */
export function isLikelyPlaylistUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.searchParams.has('list')) {
      return true;
    }
    const lowerPath = parsed.pathname.toLowerCase();
    return (
      lowerPath.includes('/playlist') ||
      lowerPath.includes('/playlists') ||
      lowerPath.includes('/sets/') ||
      lowerPath.includes('/album/')
    );
  } catch {
    return false;
  }
}
