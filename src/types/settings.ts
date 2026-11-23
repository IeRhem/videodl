export type VideoResolution =
  | '2160p'
  | '1440p'
  | '1080p'
  | '720p'
  | '480p'
  | '360p'
  | 'best';

export type OutputContainer = 'mkv' | 'mp4' | 'webm';

export type AudioFormat = 'best' | 'mp3' | 'm4a' | 'flac' | 'opus';

export type AudioQuality = 'best' | '320k' | '256k' | '192k' | '128k';

export type BrowserCookieSource =
  | 'none'
  | 'firefox'
  | 'chromium'
  | 'chrome'
  | 'brave'
  | 'edge';

export interface AppSettings {
  downloadDir: string;
  maxResolution: VideoResolution;
  outputContainer: OutputContainer;
  audioFormat: AudioFormat;
  audioQuality: AudioQuality;
  maxConcurrentDownloads: number;
  browserCookies: BrowserCookieSource;
}
