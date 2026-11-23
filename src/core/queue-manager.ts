import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';
import type { SettingsService } from '../config/settings-service.js';
import type { QueueRepository } from '../infrastructure/sqlite/queue-repo.js';
import type {
  ActiveDownloadHandle,
  MediaDownloadEngine,
} from '../infrastructure/ytdlp/ytdlp-engine.js';
import type {
  DownloadJob,
  DownloadOptionsOverride,
  DownloadProgress,
} from '../types/download.js';
import type { HistoryService } from './history-service.js';

export interface CreateJobInput {
  url: string;
  title?: string;
  sourceExtractor?: string;
  isPlaylist?: boolean;
  playlistTitle?: string | null;
  playlistIndex?: number | null;
  playlistTotal?: number | null;
  overrides?: DownloadOptionsOverride;
}

export interface EnqueueResult {
  job: DownloadJob;
  duplicate: boolean;
}

const EMPTY_PROGRESS: DownloadProgress = {
  percent: 0,
  downloadedBytes: null,
  totalBytes: null,
  speedBytesPerSec: null,
  etaSeconds: null,
};

export class QueueManager extends EventEmitter {
  private readonly activeHandles = new Map<string, ActiveDownloadHandle>();
  private readonly pendingIntent = new Map<string, 'pause' | 'cancel' | 'shutdown'>();
  private isShuttingDown = false;

  constructor(
    private readonly queueRepo: QueueRepository,
    private readonly historyService: HistoryService,
    private readonly settingsService: SettingsService,
    private readonly engine: MediaDownloadEngine,
  ) {
    super();
    this.queueRepo.recoverInterruptedJobs();
  }

  listJobs(): DownloadJob[] {
    return this.queueRepo.listAll();
  }

  getJob(id: string): DownloadJob | null {
    return this.queueRepo.getById(id);
  }

  enqueue(input: CreateJobInput): EnqueueResult {
    const existing = this.queueRepo.findActiveByUrl(input.url);
    if (existing) {
      return { job: existing, duplicate: true };
    }

    const settings = this.settingsService.getSettings();
    const now = new Date().toISOString();

    const job: DownloadJob = {
      id: randomUUID(),
      url: input.url,
      title: input.title?.trim() || input.url,
      sourceExtractor: input.sourceExtractor || 'yt-dlp',
      isPlaylist: input.isPlaylist ?? false,
      playlistTitle: input.playlistTitle ?? null,
      playlistIndex: input.playlistIndex ?? null,
      playlistTotal: input.playlistTotal ?? null,
      mode: input.overrides?.mode ?? 'video',
      maxResolution: input.overrides?.maxResolution ?? settings.maxResolution,
      outputContainer:
        input.overrides?.outputContainer ?? settings.outputContainer,
      audioFormat: input.overrides?.audioFormat ?? settings.audioFormat,
      outputDir: input.overrides?.outputDir ?? settings.downloadDir,
      destinationPath: null,
      status: 'pending',
      progress: { ...EMPTY_PROGRESS },
      errorMessage: null,
      createdAt: now,
      updatedAt: now,
    };

    this.queueRepo.insert(job);
    this.emit('updated', this.listJobs());
    this.scheduleNext();

    return { job, duplicate: false };
  }

  scheduleNext(): void {
    if (this.isShuttingDown) return;

    const settings = this.settingsService.getSettings();
    const maxConcurrent = Math.max(1, settings.maxConcurrentDownloads);

    const jobs = this.queueRepo.listAll();
    const pendingJobs = jobs.filter((j) => j.status === 'pending');

    for (const job of pendingJobs) {
      if (this.activeHandles.size >= maxConcurrent) {
        break;
      }
      if (this.activeHandles.has(job.id)) {
        continue;
      }
      this.startJob(job);
    }
  }

  private startJob(job: DownloadJob): void {
    const settings = this.settingsService.getSettings();
    const updatedJob: DownloadJob = {
      ...job,
      status: 'downloading',
      errorMessage: null,
      updatedAt: new Date().toISOString(),
    };
    this.queueRepo.update(updatedJob);
    this.emit('updated', this.listJobs());

    let latestJob = updatedJob;
    let lastDbPersistMs = 0;

    const handle = this.engine.startDownload(updatedJob, settings, {
      onProgress: (progress) => {
        const nowMs = Date.now();
        latestJob = {
          ...latestJob,
          status: 'downloading',
          progress,
          updatedAt: new Date(nowMs).toISOString(),
        };
        if (nowMs - lastDbPersistMs >= 400 || progress.percent >= 100) {
          lastDbPersistMs = nowMs;
          this.queueRepo.update(latestJob);
        }
        this.emit('jobProgress', latestJob);
        this.emit(
          'updated',
          this.listJobs().map((j) => (j.id === latestJob.id ? latestJob : j)),
        );
      },
      onDestination: (filePath) => {
        latestJob = {
          ...latestJob,
          destinationPath: filePath,
          updatedAt: new Date().toISOString(),
        };
        this.queueRepo.update(latestJob);
      },
      onProcessing: () => {
        latestJob = {
          ...latestJob,
          status: 'processing',
          updatedAt: new Date().toISOString(),
        };
        this.queueRepo.update(latestJob);
        this.emit('updated', this.listJobs());
      },
    });

    this.activeHandles.set(job.id, handle);

    void handle.result.then((outcome) => {
      this.activeHandles.delete(job.id);
      const intent = this.pendingIntent.get(job.id);
      this.pendingIntent.delete(job.id);

      const current = this.queueRepo.getById(job.id) ?? latestJob;
      const now = new Date().toISOString();

      if (intent === 'pause' || intent === 'shutdown') {
        const pausedJob: DownloadJob = {
          ...current,
          status: 'paused',
          updatedAt: now,
        };
        this.queueRepo.update(pausedJob);
        this.emit('updated', this.listJobs());
        if (!this.isShuttingDown) {
          this.scheduleNext();
        }
        return;
      }

      if (intent === 'cancel') {
        const cancelledJob: DownloadJob = {
          ...current,
          status: 'cancelled',
          updatedAt: now,
        };
        this.queueRepo.update(cancelledJob);
        this.historyService.recordJobResult(cancelledJob, 'cancelled', null);
        this.emit('updated', this.listJobs());
        this.scheduleNext();
        return;
      }

      if (outcome.exitCode === 0) {
        const completedJob: DownloadJob = {
          ...current,
          status: 'completed',
          progress: {
            ...current.progress,
            percent: 100,
            etaSeconds: 0,
            speedBytesPerSec: null,
          },
          errorMessage: null,
          updatedAt: now,
        };
        this.queueRepo.update(completedJob);
        this.historyService.recordJobResult(completedJob, 'completed', null);
        this.emit('jobCompleted', completedJob);
        this.emit('updated', this.listJobs());
        this.scheduleNext();
        return;
      }

      const errMsg =
        outcome.errorCode === 'ENOENT'
          ? 'yt-dlp was not found in PATH.'
          : outcome.stderrTail.trim() ||
            `Download exited with code ${outcome.exitCode ?? 'unknown'}`;

      const failedJob: DownloadJob = {
        ...current,
        status: 'failed',
        errorMessage: errMsg,
        updatedAt: now,
      };
      this.queueRepo.update(failedJob);
      this.historyService.recordJobResult(failedJob, 'failed', errMsg);
      this.emit('jobFailed', failedJob);
      this.emit('updated', this.listJobs());
      this.scheduleNext();
    });
  }

  pauseJob(id: string): boolean {
    const job = this.queueRepo.getById(id);
    if (!job) return false;

    const handle = this.activeHandles.get(id);
    if (handle) {
      this.pendingIntent.set(id, 'pause');
      handle.cancel('SIGTERM');
      return true;
    }

    if (job.status === 'pending') {
      this.queueRepo.update({
        ...job,
        status: 'paused',
        updatedAt: new Date().toISOString(),
      });
      this.emit('updated', this.listJobs());
      return true;
    }

    return false;
  }

  resumeJob(id: string): boolean {
    const job = this.queueRepo.getById(id);
    if (!job || job.status !== 'paused') return false;

    this.queueRepo.update({
      ...job,
      status: 'pending',
      errorMessage: null,
      updatedAt: new Date().toISOString(),
    });
    this.emit('updated', this.listJobs());
    this.scheduleNext();
    return true;
  }

  cancelJob(id: string): boolean {
    const job = this.queueRepo.getById(id);
    if (!job) return false;

    const handle = this.activeHandles.get(id);
    if (handle) {
      this.pendingIntent.set(id, 'cancel');
      handle.cancel('SIGTERM');
      return true;
    }

    if (job.status === 'pending' || job.status === 'paused') {
      const cancelledJob: DownloadJob = {
        ...job,
        status: 'cancelled',
        updatedAt: new Date().toISOString(),
      };
      this.queueRepo.update(cancelledJob);
      this.historyService.recordJobResult(cancelledJob, 'cancelled', null);
      this.emit('updated', this.listJobs());
      return true;
    }

    return false;
  }

  retryJob(id: string): boolean {
    const job = this.queueRepo.getById(id);
    if (!job || (job.status !== 'failed' && job.status !== 'cancelled')) {
      return false;
    }

    this.queueRepo.update({
      ...job,
      status: 'pending',
      progress: { ...EMPTY_PROGRESS },
      errorMessage: null,
      updatedAt: new Date().toISOString(),
    });
    this.emit('updated', this.listJobs());
    this.scheduleNext();
    return true;
  }

  removeJob(id: string): boolean {
    if (this.activeHandles.has(id)) {
      return false;
    }
    const deleted = this.queueRepo.deleteById(id);
    if (deleted) {
      this.emit('updated', this.listJobs());
    }
    return deleted;
  }

  clearFinished(): number {
    const removed = this.queueRepo.clearFinished();
    if (removed > 0) {
      this.emit('updated', this.listJobs());
    }
    return removed;
  }

  async shutdownGracefully(): Promise<void> {
    this.isShuttingDown = true;
    const activeEntries = Array.from(this.activeHandles.entries());
    if (activeEntries.length === 0) {
      return;
    }

    const waiters = activeEntries.map(([id, handle]) => {
      this.pendingIntent.set(id, 'shutdown');
      handle.cancel('SIGTERM');
      return handle.result;
    });

    await Promise.race([
      Promise.allSettled(waiters),
      new Promise<void>((resolve) => setTimeout(resolve, 4000)),
    ]);
  }
}
