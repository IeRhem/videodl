import { afterEach, describe, expect, it } from 'vitest';
import { SettingsService } from '../src/config/settings-service.js';
import { HistoryService } from '../src/core/history-service.js';
import { VideoDLDatabase } from '../src/infrastructure/sqlite/database.js';
import { HistoryRepository } from '../src/infrastructure/sqlite/history-repo.js';
import { QueueRepository } from '../src/infrastructure/sqlite/queue-repo.js';
import type { DownloadJob } from '../src/types/download.js';

describe('sqlite repositories and settings service', () => {
  const openDbs: VideoDLDatabase[] = [];

  afterEach(() => {
    while (openDbs.length > 0) {
      openDbs.pop()?.close();
    }
  });

  function createDb(): VideoDLDatabase {
    const db = new VideoDLDatabase(':memory:');
    openDbs.push(db);
    return db;
  }

  it('persists, updates, and resets settings', () => {
    const db = createDb();
    const settingsSvc = new SettingsService(db);

    const defaults = settingsSvc.getSettings();
    expect(defaults.maxResolution).toBe('1080p');
    expect(defaults.outputContainer).toBe('mkv');

    const updated = settingsSvc.updateSettings({
      maxResolution: '2160p',
      outputContainer: 'mp4',
      maxConcurrentDownloads: 3,
      browserCookies: 'firefox',
    });
    expect(updated.maxResolution).toBe('2160p');
    expect(updated.maxConcurrentDownloads).toBe(3);

    // Re-read using fresh service instance against same DB
    const freshSvc = new SettingsService(db);
    expect(freshSvc.getSettings().browserCookies).toBe('firefox');

    const reset = freshSvc.resetSettings();
    expect(reset.maxResolution).toBe('1080p');
    expect(reset.browserCookies).toBe('none');
  });

  it('recovers interrupted queue jobs into paused state and records history', () => {
    const db = createDb();
    const queueRepo = new QueueRepository(db);
    const historyRepo = new HistoryRepository(db);
    const historySvc = new HistoryService(historyRepo);

    const job: DownloadJob = {
      id: 'q1',
      url: 'https://example.com/v1',
      title: 'Video One',
      sourceExtractor: 'Youtube',
      isPlaylist: false,
      playlistTitle: null,
      playlistIndex: null,
      playlistTotal: null,
      mode: 'video',
      maxResolution: '1080p',
      outputContainer: 'mkv',
      audioFormat: 'best',
      outputDir: '/tmp',
      destinationPath: '/tmp/Video One.mkv',
      status: 'downloading',
      progress: {
        percent: 50,
        downloadedBytes: 500,
        totalBytes: 1000,
        speedBytesPerSec: 100,
        etaSeconds: 5,
      },
      errorMessage: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:01.000Z',
    };

    queueRepo.insert(job);
    const recovered = queueRepo.recoverInterruptedJobs();
    expect(recovered).toBe(1);
    expect(queueRepo.getById('q1')?.status).toBe('paused');

    historySvc.recordJobResult(job, 'completed', null);
    const records = historySvc.listHistory(10);
    expect(records).toHaveLength(1);
    expect(records[0]?.title).toBe('Video One');
    expect(records[0]?.format).toBe('1080p (mkv)');
    expect(records[0]?.status).toBe('completed');
  });
});
