import type {
  DownloadProgress,
  PlaylistEntryMetadata,
  VideoMetadata,
} from '../../types/download.js';
import { FILE_PREFIX, PROGRESS_PREFIX } from './ytdlp-args.js';

function parseNullableNumber(raw: string | undefined): number | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (
    trimmed === '' ||
    trimmed === 'NA' ||
    trimmed === 'N/A' ||
    trimmed === 'None' ||
    trimmed === 'Unknown'
  ) {
    return null;
  }
  const num = Number(trimmed);
  return Number.isFinite(num) ? num : null;
}

function parsePercent(raw: string | undefined): number {
  if (!raw) return 0;
  const cleaned = raw.replace('%', '').trim();
  const num = Number(cleaned);
  if (!Number.isFinite(num)) return 0;
  return Math.max(0, Math.min(100, num));
}

/**
 * Parses a yt-dlp progress line formatted with PROGRESS_PREFIX.
 */
export function parseProgressLine(line: string): DownloadProgress | null {
  const idx = line.indexOf(PROGRESS_PREFIX);
  if (idx === -1) {
    return null;
  }

  const payload = line.slice(idx + PROGRESS_PREFIX.length);
  const parts = payload.split('|');
  if (parts.length < 5) {
    return null;
  }

  const downloadedBytes = parseNullableNumber(parts[1]);
  const totalBytes = parseNullableNumber(parts[2]);
  let percent = parsePercent(parts[0]);

  if (
    percent === 0 &&
    downloadedBytes !== null &&
    totalBytes !== null &&
    totalBytes > 0
  ) {
    percent = Math.max(0, Math.min(100, (downloadedBytes / totalBytes) * 100));
  }

  return {
    percent,
    downloadedBytes,
    totalBytes,
    speedBytesPerSec: parseNullableNumber(parts[3]),
    etaSeconds: parseNullableNumber(parts[4]),
  };
}

/**
 * Parses a yt-dlp post-move filepath output line formatted with FILE_PREFIX.
 */
export function parseDestinationLine(line: string): string | null {
  const idx = line.indexOf(FILE_PREFIX);
  if (idx === -1) {
    return null;
  }
  const path = line.slice(idx + FILE_PREFIX.length).trim();
  return path.length > 0 ? path : null;
}

interface RawYtDlpEntry {
  id?: string;
  url?: string;
  webpage_url?: string;
  original_url?: string;
  title?: string;
  duration?: number | null;
}

interface RawYtDlpJson {
  id?: string;
  webpage_url?: string;
  original_url?: string;
  title?: string;
  extractor?: string;
  extractor_key?: string;
  duration?: number | null;
  uploader?: string | null;
  _type?: string;
  entries?: Array<RawYtDlpEntry | null>;
}

/**
 * Parses yt-dlp --dump-single-json output into VideoMetadata.
 */
export function parseMetadataJson(
  jsonText: string,
  fallbackUrl: string,
): VideoMetadata {
  const data = JSON.parse(jsonText) as RawYtDlpJson;
  const isPlaylist =
    data._type === 'playlist' ||
    (Array.isArray(data.entries) && data.entries.length > 0);

  const extractor = data.extractor_key || data.extractor || 'unknown';
  const title = data.title?.trim() || 'Untitled Media';
  const resolvedUrl = data.webpage_url || data.original_url || fallbackUrl;

  if (isPlaylist) {
    const rawEntries = (data.entries ?? []).filter(
      (entry): entry is RawYtDlpEntry => entry !== null && typeof entry === 'object',
    );

    const entries: PlaylistEntryMetadata[] = rawEntries
      .map((entry, idx) => {
        const entryUrl =
          entry.webpage_url ||
          entry.url ||
          entry.original_url ||
          '';
        return {
          id: entry.id || `entry-${idx + 1}`,
          url: entryUrl,
          title: entry.title?.trim() || `Video ${idx + 1}`,
          durationSeconds:
            typeof entry.duration === 'number' && Number.isFinite(entry.duration)
              ? entry.duration
              : null,
        };
      })
      .filter((entry) => entry.url.startsWith('http://') || entry.url.startsWith('https://'));

    return {
      id: data.id || 'playlist',
      url: resolvedUrl,
      title,
      extractor,
      durationSeconds: null,
      uploader: data.uploader ?? null,
      isPlaylist: true,
      playlistTitle: title,
      playlistCount: entries.length,
      entries,
    };
  }

  return {
    id: data.id || 'video',
    url: resolvedUrl,
    title,
    extractor,
    durationSeconds:
      typeof data.duration === 'number' && Number.isFinite(data.duration)
        ? data.duration
        : null,
    uploader: data.uploader ?? null,
    isPlaylist: false,
  };
}
