import type { DownloadJob } from '../../types/download.js';
import type { AppSettings, VideoResolution } from '../../types/settings.js';

export const PROGRESS_PREFIX = '__VDL__|';
export const FILE_PREFIX = '__VDL_FILE__|';

function buildVideoFormatSelector(resolution: VideoResolution): string {
  if (resolution === 'best') {
    return 'bestvideo+bestaudio/best';
  }
  const height = resolution.replace('p', '');
  return `bestvideo[height<=${height}]+bestaudio/best[height<=${height}]/best`;
}

function mapAudioQuality(quality: AppSettings['audioQuality']): string {
  if (quality === 'best') return '0';
  return quality;
}

/**
 * Builds argument array for yt-dlp metadata extraction.
 * Uses '--' before the URL to prevent option injection.
 */
export function buildMetadataArgs(
  url: string,
  settings: AppSettings,
  flatPlaylist: boolean,
): string[] {
  const args: string[] = [
    '--dump-single-json',
    '--no-warnings',
    '--no-color',
    '--ignore-errors',
  ];

  if (flatPlaylist) {
    args.push('--flat-playlist');
  } else {
    args.push('--no-playlist');
  }

  if (settings.browserCookies !== 'none') {
    args.push('--cookies-from-browser', settings.browserCookies);
  }

  args.push('--', url);
  return args;
}

/**
 * Builds argument array for yt-dlp media download.
 * Uses '--' before the URL and never invokes a shell.
 */
export function buildDownloadArgs(
  job: DownloadJob,
  settings: AppSettings,
): string[] {
  const args: string[] = [
    '--newline',
    '--progress',
    '--no-warnings',
    '--no-color',
    '--continue',
    '--progress-template',
    `download:${PROGRESS_PREFIX}%(progress._percent_str)s|%(progress.downloaded_bytes)s|%(progress.total_bytes,progress.total_bytes_estimate)s|%(progress.speed)s|%(progress.eta)s`,
    '--print',
    `after_move:${FILE_PREFIX}%(filepath)s`,
  ];

  if (!job.isPlaylist) {
    args.push('--no-playlist');
  }

  if (job.mode === 'audio') {
    const targetFormat = job.audioFormat === 'best' ? 'opus' : job.audioFormat;
    args.push(
      '-x',
      '--audio-format',
      targetFormat,
      '--audio-quality',
      mapAudioQuality(settings.audioQuality),
    );
  } else {
    args.push(
      '-f',
      buildVideoFormatSelector(job.maxResolution),
      '--merge-output-format',
      job.outputContainer,
    );
  }

  args.push('-P', job.outputDir, '-o', '%(title)s [%(id)s].%(ext)s');

  if (settings.browserCookies !== 'none') {
    args.push('--cookies-from-browser', settings.browserCookies);
  }

  args.push('--', job.url);
  return args;
}

/**
 * Redacts browser cookie flags before any diagnostic or log output.
 */
export function redactSensitiveArgs(args: string[]): string[] {
  const redacted: string[] = [];
  for (let i = 0; i < args.length; i += 1) {
    const current = args[i] ?? '';
    if (current === '--cookies-from-browser') {
      redacted.push(current);
      if (i + 1 < args.length) {
        redacted.push('[REDACTED]');
        i += 1;
      }
    } else {
      redacted.push(current);
    }
  }
  return redacted;
}
