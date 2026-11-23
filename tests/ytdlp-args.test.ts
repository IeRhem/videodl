import { describe, expect, it } from 'vitest';
import { createDefaultSettings } from '../src/config/defaults.js';
import {
  buildDownloadArgs,
  buildMetadataArgs,
  redactSensitiveArgs,
} from '../src/infrastructure/ytdlp/ytdlp-args.js';
import type { DownloadJob } from '../src/types/download.js';

function makeJob(overrides: Partial<DownloadJob> = {}): DownloadJob {
  return {
    id: 'job-1',
    url: 'https://example.com/video?v=123',
    title: 'Sample Video',
    sourceExtractor: 'youtube',
    isPlaylist: false,
    playlistTitle: null,
    playlistIndex: null,
    playlistTotal: null,
    mode: 'video',
    maxResolution: '1080p',
    outputContainer: 'mkv',
    audioFormat: 'best',
    outputDir: '/tmp/downloads',
    destinationPath: null,
    status: 'pending',
    progress: {
      percent: 0,
      downloadedBytes: null,
      totalBytes: null,
      speedBytesPerSec: null,
      etaSeconds: null,
    },
    errorMessage: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('ytdlp-args', () => {
  it('builds default 1080p MKV download arguments with -- separator', () => {
    const settings = createDefaultSettings();
    const args = buildDownloadArgs(makeJob(), settings);

    expect(args).toContain('--newline');
    expect(args).toContain('--progress');
    expect(args).toContain('--continue');
    expect(args).toContain('--no-playlist');
    expect(args).toContain('bestvideo[height<=1080]+bestaudio/best[height<=1080]/best');
    expect(args).toContain('--merge-output-format');
    expect(args).toContain('mkv');

    const sepIdx = args.indexOf('--');
    expect(sepIdx).toBeGreaterThan(-1);
    expect(args[sepIdx + 1]).toBe('https://example.com/video?v=123');
  });

  it('builds audio-only extraction arguments', () => {
    const settings = { ...createDefaultSettings(), audioQuality: '320k' as const };
    const args = buildDownloadArgs(
      makeJob({ mode: 'audio', audioFormat: 'mp3' }),
      settings,
    );

    expect(args).toContain('-x');
    expect(args).toContain('--audio-format');
    expect(args).toContain('mp3');
    expect(args).toContain('--audio-quality');
    expect(args).toContain('320k');
  });

  it('includes browser cookie flag locally and redacts it in logs', () => {
    const settings = { ...createDefaultSettings(), browserCookies: 'firefox' as const };
    const args = buildMetadataArgs('https://example.com/v', settings, true);

    expect(args).toContain('--flat-playlist');
    expect(args).toContain('--cookies-from-browser');
    expect(args).toContain('firefox');

    const redacted = redactSensitiveArgs(args);
    expect(redacted).toContain('[REDACTED]');
    expect(redacted).not.toContain('firefox');
  });
});
