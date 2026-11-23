import { z } from 'zod';
import type {
  AppSettings,
  AudioFormat,
  AudioQuality,
  BrowserCookieSource,
  OutputContainer,
  VideoResolution,
} from '../types/settings.js';
import { getDefaultDownloadDir } from './xdg.js';

export const VIDEO_RESOLUTIONS: readonly VideoResolution[] = [
  'best',
  '2160p',
  '1440p',
  '1080p',
  '720p',
  '480p',
  '360p',
];

export const OUTPUT_CONTAINERS: readonly OutputContainer[] = [
  'mkv',
  'mp4',
  'webm',
];

export const AUDIO_FORMATS: readonly AudioFormat[] = [
  'best',
  'mp3',
  'm4a',
  'flac',
  'opus',
];

export const AUDIO_QUALITIES: readonly AudioQuality[] = [
  'best',
  '320k',
  '256k',
  '192k',
  '128k',
];

export const BROWSER_COOKIE_SOURCES: readonly BrowserCookieSource[] = [
  'none',
  'firefox',
  'chromium',
  'chrome',
  'brave',
  'edge',
];

export const AppSettingsSchema = z.object({
  downloadDir: z.string().trim().min(1, 'Download directory must not be empty'),
  maxResolution: z.enum([
    '2160p',
    '1440p',
    '1080p',
    '720p',
    '480p',
    '360p',
    'best',
  ]),
  outputContainer: z.enum(['mkv', 'mp4', 'webm']),
  audioFormat: z.enum(['best', 'mp3', 'm4a', 'flac', 'opus']),
  audioQuality: z.enum(['best', '320k', '256k', '192k', '128k']),
  maxConcurrentDownloads: z.number().int().min(1).max(5),
  browserCookies: z.enum([
    'none',
    'firefox',
    'chromium',
    'chrome',
    'brave',
    'edge',
  ]),
});

export function createDefaultSettings(): AppSettings {
  return {
    downloadDir: getDefaultDownloadDir(),
    maxResolution: '1080p',
    outputContainer: 'mkv',
    audioFormat: 'best',
    audioQuality: 'best',
    maxConcurrentDownloads: 2,
    browserCookies: 'none',
  };
}

export const DEFAULT_SETTINGS: AppSettings = createDefaultSettings();
