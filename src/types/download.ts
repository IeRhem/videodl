import type {
  AudioFormat,
  OutputContainer,
  VideoResolution,
} from './settings.js';

export type DownloadStatus =
  | 'pending'
  | 'fetching_metadata'
  | 'downloading'
  | 'processing'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type DownloadMode = 'video' | 'audio';

export interface DownloadProgress {
  percent: number;
  downloadedBytes: number | null;
  totalBytes: number | null;
  speedBytesPerSec: number | null;
  etaSeconds: number | null;
}

export interface PlaylistEntryMetadata {
  id: string;
  url: string;
  title: string;
  durationSeconds: number | null;
}

export interface VideoMetadata {
  id: string;
  url: string;
  title: string;
  extractor: string;
  durationSeconds: number | null;
  uploader: string | null;
  isPlaylist: boolean;
  playlistTitle?: string;
  playlistCount?: number;
  entries?: PlaylistEntryMetadata[];
}

export interface DownloadJob {
  id: string;
  url: string;
  title: string;
  sourceExtractor: string;
  isPlaylist: boolean;
  playlistTitle: string | null;
  playlistIndex: number | null;
  playlistTotal: number | null;
  mode: DownloadMode;
  maxResolution: VideoResolution;
  outputContainer: OutputContainer;
  audioFormat: AudioFormat;
  outputDir: string;
  destinationPath: string | null;
  status: DownloadStatus;
  progress: DownloadProgress;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DownloadOptionsOverride {
  mode?: DownloadMode;
  maxResolution?: VideoResolution;
  outputContainer?: OutputContainer;
  audioFormat?: AudioFormat;
  outputDir?: string;
  limit?: number;
}
