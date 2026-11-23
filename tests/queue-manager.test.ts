import { afterEach, describe, expect, it } from 'vitest';
import { SettingsService } from '../src/config/settings-service.js';
import { HistoryService } from '../src/core/history-service.js';
import { QueueManager } from '../src/core/queue-manager.js';
import { VideoDLDatabase } from '../src/infrastructure/sqlite/database.js';
import { HistoryRepository } from '../src/infrastructure/sqlite/history-repo.js';
import { QueueRepository } from '../src/infrastructure/sqlite/queue-repo.js';
import type {
  ActiveDownloadCallbacks,
  ActiveDownloadHandle,
  MediaDownloadEngine,
} from '../src/infrastructure/ytdlp/ytdlp-engine.js';
import type { DownloadJob, VideoMetadata } from '../src/types/download.js';
import type { AppSettings } from '../src/types/settings.js';

class MockEngine implements MediaDownloadEngine {
  public startedJobs: string[] = [];
  private resolvers = new Map<
    string,
    (res: { exitCode: number | null; signal: NodeJS.Signals | null; stderrTail: string }) => void
  >();

  async fetchMetadata(url: string): Promise<VideoMetadata> {
    return {
      id: 'mock',
      url,
      title: 'Mock Video',
      extractor: 'mock',
      durationSeconds: 60,
      uploader: 'Tester',
      isPlaylist: false,
    };
  }

  startDownload(
    job: DownloadJob,
    _settings: AppSettings,
    callbacks: ActiveDownloadCallbacks,
  ): ActiveDownloadHandle {
    this.startedJobs.push(job.id);
    callbacks.onProgress({
      percent: 25,
      downloadedBytes: 250,
      totalBytes: 1000,
      speedBytesPerSec: 50,
      etaSeconds: 15,
    });

    const result = new Promise<{
      exitCode: number | null;
      signal: NodeJS.Signals | null;
      stderrTail: string;
    }>((resolve) => {
      this.resolvers.set(job.id, resolve);
    });

    return {
      cancel: (signal = 'SIGTERM') => {
        const resolve = this.resolvers.get(job.id);
        if (resolve) {
          this.resolvers.delete(job.id);
          resolve({ exitCode: null, signal, stderrTail: '' });
        }
      },
      result,
    };
  }

  finishJob(jobId: string, exitCode = 0, stderrTail = ''): void {
    const resolve = this.resolvers.get(jobId);
    if (resolve) {
      this.resolvers.delete(jobId);
      resolve({ exitCode, signal: null, stderrTail });
    }
  }
}

describe('QueueManager', () => {
  const dbs: VideoDLDatabase[] = [];

  afterEach(() => {
    while (dbs.length > 0) {
      dbs.pop()?.close();
    }
  });

  function setup(maxConcurrentDownloads = 1) {
    const db = new VideoDLDatabase(':memory:');
    dbs.push(db);
    const settingsSvc = new SettingsService(db);
    settingsSvc.updateSettings({ maxConcurrentDownloads });
    const queueRepo = new QueueRepository(db);
    const historySvc = new HistoryService(new HistoryRepository(db));
    const engine = new MockEngine();
    const queue = new QueueManager(queueRepo, historySvc, settingsSvc, engine);
    return { queue, engine, historySvc };
  }

  it('prevents duplicate active URLs and enforces maxConcurrentDownloads', async () => {
    const { queue, engine } = setup(1);

    const first = queue.enqueue({ url: 'https://example.com/1', title: 'One' });
    const dup = queue.enqueue({ url: 'https://example.com/1', title: 'One' });
    const second = queue.enqueue({ url: 'https://example.com/2', title: 'Two' });

    expect(first.duplicate).toBe(false);
    expect(dup.duplicate).toBe(true);
    expect(dup.job.id).toBe(first.job.id);
    expect(engine.startedJobs).toEqual([first.job.id]);
    expect(queue.getJob(second.job.id)?.status).toBe('pending');

    engine.finishJob(first.job.id, 0);
    await new Promise((r) => setTimeout(r, 20));

    expect(queue.getJob(first.job.id)?.status).toBe('completed');
    expect(engine.startedJobs).toEqual([first.job.id, second.job.id]);
  });

  it('supports pause, resume, cancel, and retry transitions', async () => {
    const { queue, engine } = setup(1);

    const { job } = queue.enqueue({ url: 'https://example.com/p', title: 'PauseMe' });
    expect(queue.pauseJob(job.id)).toBe(true);
    await new Promise((r) => setTimeout(r, 20));
    expect(queue.getJob(job.id)?.status).toBe('paused');

    expect(queue.resumeJob(job.id)).toBe(true);
    expect(queue.getJob(job.id)?.status).toBe('downloading');

    engine.finishJob(job.id, 1, 'Network error');
    await new Promise((r) => setTimeout(r, 20));
    expect(queue.getJob(job.id)?.status).toBe('failed');

    expect(queue.retryJob(job.id)).toBe(true);
    expect(queue.getJob(job.id)?.status).toBe('downloading');

    expect(queue.cancelJob(job.id)).toBe(true);
    await new Promise((r) => setTimeout(r, 20));
    expect(queue.getJob(job.id)?.status).toBe('cancelled');
  });
});
