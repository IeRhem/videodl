import { mkdirSync } from 'node:fs';
import type {
  DownloadJob,
  DownloadProgress,
  VideoMetadata,
} from '../../types/download.js';
import type { AppSettings } from '../../types/settings.js';
import {
  runCommandCapture,
  spawnStreamingProcess,
} from '../process/spawn-runner.js';
import { buildDownloadArgs, buildMetadataArgs } from './ytdlp-args.js';
import {
  parseDestinationLine,
  parseMetadataJson,
  parseProgressLine,
} from './ytdlp-parser.js';

export interface ActiveDownloadCallbacks {
  onProgress: (progress: DownloadProgress) => void;
  onDestination: (filePath: string) => void;
  onProcessing?: () => void;
}

export interface ActiveDownloadHandle {
  cancel: (signal?: NodeJS.Signals) => void;
  result: Promise<{
    exitCode: number | null;
    signal: NodeJS.Signals | null;
    stderrTail: string;
    errorCode?: string;
  }>;
}

export interface MediaDownloadEngine {
  fetchMetadata(
    url: string,
    settings: AppSettings,
    options?: { flatPlaylist?: boolean },
  ): Promise<VideoMetadata>;
  startDownload(
    job: DownloadJob,
    settings: AppSettings,
    callbacks: ActiveDownloadCallbacks,
  ): ActiveDownloadHandle;
}

export class YtDlpEngine implements MediaDownloadEngine {
  async fetchMetadata(
    url: string,
    settings: AppSettings,
    options: { flatPlaylist?: boolean } = {},
  ): Promise<VideoMetadata> {
    const flatPlaylist = options.flatPlaylist ?? false;
    const args = buildMetadataArgs(url, settings, flatPlaylist);
    const res = await runCommandCapture('yt-dlp', args, { timeoutMs: 30_000 });

    if (res.errorCode === 'ENOENT') {
      throw new Error(
        'yt-dlp executable was not found. Install it with: sudo dnf install yt-dlp',
      );
    }

    const trimmedStdout = res.stdout.trim();
    if (res.exitCode !== 0 && trimmedStdout.length === 0) {
      const msg = res.stderr.trim() || `yt-dlp exited with code ${res.exitCode}`;
      throw new Error(msg);
    }

    // --dump-single-json outputs one JSON document on stdout
    const lines = trimmedStdout.split(/\r?\n/).filter((l) => l.trim().startsWith('{'));
    const jsonLine = lines[lines.length - 1];
    if (!jsonLine) {
      throw new Error(
        res.stderr.trim() || 'Failed to parse metadata returned by yt-dlp.',
      );
    }

    return parseMetadataJson(jsonLine, url);
  }

  startDownload(
    job: DownloadJob,
    settings: AppSettings,
    callbacks: ActiveDownloadCallbacks,
  ): ActiveDownloadHandle {
    mkdirSync(job.outputDir, { recursive: true });
    const args = buildDownloadArgs(job, settings);

    const handleLine = (line: string) => {
      const progress = parseProgressLine(line);
      if (progress) {
        callbacks.onProgress(progress);
        return;
      }

      const dest = parseDestinationLine(line);
      if (dest) {
        callbacks.onDestination(dest);
        return;
      }

      if (
        line.includes('[Merger]') ||
        line.includes('[ExtractAudio]') ||
        line.includes('[ffmpeg]')
      ) {
        callbacks.onProcessing?.();
      }
    };

    const handle = spawnStreamingProcess('yt-dlp', args, {
      onStdoutLine: handleLine,
      onStderrLine: handleLine,
    });

    return {
      cancel: (signal: NodeJS.Signals = 'SIGTERM') => {
        handle.kill(signal);
      },
      result: handle.promise,
    };
  }
}
