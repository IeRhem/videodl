import type { SettingsService } from '../config/settings-service.js';
import { validateAndNormalizeUrl } from '../infrastructure/system/url-validator.js';
import type { MediaDownloadEngine } from '../infrastructure/ytdlp/ytdlp-engine.js';
import type {
  DownloadJob,
  DownloadOptionsOverride,
  VideoMetadata,
} from '../types/download.js';
import type { EnqueueResult, QueueManager } from './queue-manager.js';

export interface PlaylistQueueResult {
  metadata: VideoMetadata;
  queued: EnqueueResult[];
}

export class DownloadService {
  constructor(
    private readonly engine: MediaDownloadEngine,
    private readonly queueManager: QueueManager,
    private readonly settingsService: SettingsService,
  ) {}

  async inspectUrl(
    rawUrl: string,
    options: { flatPlaylist?: boolean } = {},
  ): Promise<VideoMetadata> {
    const validation = validateAndNormalizeUrl(rawUrl);
    if (!validation.valid) {
      throw new Error(validation.error ?? 'Invalid URL.');
    }

    const settings = this.settingsService.getSettings();
    const flat = options.flatPlaylist ?? validation.isLikelyPlaylist;
    return this.engine.fetchMetadata(validation.normalizedUrl, settings, {
      flatPlaylist: flat,
    });
  }

  async downloadSingleUrl(
    rawUrl: string,
    overrides?: DownloadOptionsOverride,
  ): Promise<EnqueueResult> {
    const validation = validateAndNormalizeUrl(rawUrl);
    if (!validation.valid) {
      throw new Error(validation.error ?? 'Invalid URL.');
    }

    const settings = this.settingsService.getSettings();
    let title = validation.normalizedUrl;
    let extractor = 'yt-dlp';

    try {
      const metadata = await this.engine.fetchMetadata(
        validation.normalizedUrl,
        settings,
        { flatPlaylist: false },
      );
      title = metadata.title;
      extractor = metadata.extractor;
    } catch {
      // Allow queueing even if pre-fetch fails (e.g., transient check); yt-dlp download will surface concrete error
    }

    return this.queueManager.enqueue({
      url: validation.normalizedUrl,
      title,
      sourceExtractor: extractor,
      isPlaylist: false,
      overrides,
    });
  }

  async downloadPlaylistUrl(
    rawUrl: string,
    overrides?: DownloadOptionsOverride,
  ): Promise<PlaylistQueueResult> {
    const validation = validateAndNormalizeUrl(rawUrl);
    if (!validation.valid) {
      throw new Error(validation.error ?? 'Invalid URL.');
    }

    const settings = this.settingsService.getSettings();
    const metadata = await this.engine.fetchMetadata(
      validation.normalizedUrl,
      settings,
      { flatPlaylist: true },
    );

    if (!metadata.isPlaylist || !metadata.entries || metadata.entries.length === 0) {
      const single = this.queueManager.enqueue({
        url: metadata.url || validation.normalizedUrl,
        title: metadata.title,
        sourceExtractor: metadata.extractor,
        isPlaylist: false,
        overrides,
      });
      return { metadata, queued: [single] };
    }

    const limit =
      overrides?.limit && overrides.limit > 0
        ? Math.min(overrides.limit, metadata.entries.length)
        : metadata.entries.length;

    const selectedEntries = metadata.entries.slice(0, limit);
    const playlistTitle = metadata.playlistTitle ?? metadata.title;
    const total = selectedEntries.length;

    const queued: EnqueueResult[] = selectedEntries.map((entry, idx) =>
      this.queueManager.enqueue({
        url: entry.url,
        title: entry.title,
        sourceExtractor: metadata.extractor,
        isPlaylist: true,
        playlistTitle,
        playlistIndex: idx + 1,
        playlistTotal: total,
        overrides,
      }),
    );

    return { metadata, queued };
  }

  waitForJobs(jobIds: string[]): Promise<DownloadJob[]> {
    const targetIds = new Set(jobIds);
    const isTerminal = (status: DownloadJob['status']) =>
      status === 'completed' || status === 'failed' || status === 'cancelled';

    const checkDone = (): DownloadJob[] | null => {
      const all = this.queueManager
        .listJobs()
        .filter((j) => targetIds.has(j.id));
      if (all.length === 0 || all.every((j) => isTerminal(j.status))) {
        return all;
      }
      return null;
    };

    const immediate = checkDone();
    if (immediate) {
      return Promise.resolve(immediate);
    }

    return new Promise((resolve) => {
      const onUpdated = () => {
        const done = checkDone();
        if (done) {
          this.queueManager.off('updated', onUpdated);
          resolve(done);
        }
      };
      this.queueManager.on('updated', onUpdated);
    });
  }
}
