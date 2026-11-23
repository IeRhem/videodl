import { SettingsService } from '../config/settings-service.js';
import { getDatabasePath } from '../config/xdg.js';
import { VideoDLDatabase } from '../infrastructure/sqlite/database.js';
import { HistoryRepository } from '../infrastructure/sqlite/history-repo.js';
import { QueueRepository } from '../infrastructure/sqlite/queue-repo.js';
import { DependencyChecker } from '../infrastructure/system/dependency-checker.js';
import {
  type MediaDownloadEngine,
  YtDlpEngine,
} from '../infrastructure/ytdlp/ytdlp-engine.js';
import { DownloadService } from './download-service.js';
import { HistoryService } from './history-service.js';
import { QueueManager } from './queue-manager.js';

export interface VideoDLCoreOptions {
  dbPath?: string;
  engine?: MediaDownloadEngine;
}

export class VideoDLCore {
  public readonly database: VideoDLDatabase;
  public readonly settings: SettingsService;
  public readonly history: HistoryService;
  public readonly queue: QueueManager;
  public readonly downloads: DownloadService;
  public readonly dependencies: DependencyChecker;

  private closed = false;

  constructor(options: VideoDLCoreOptions = {}) {
    const dbPath = options.dbPath ?? getDatabasePath();
    const engine = options.engine ?? new YtDlpEngine();

    this.database = new VideoDLDatabase(dbPath);
    const queueRepo = new QueueRepository(this.database);
    const historyRepo = new HistoryRepository(this.database);

    this.settings = new SettingsService(this.database);
    this.history = new HistoryService(historyRepo);
    this.queue = new QueueManager(queueRepo, this.history, this.settings, engine);
    this.downloads = new DownloadService(engine, this.queue, this.settings);
    this.dependencies = new DependencyChecker();
  }

  async shutdown(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    await this.queue.shutdownGracefully();
    this.database.close();
  }
}
