import { randomUUID } from 'node:crypto';
import type { HistoryRepository } from '../infrastructure/sqlite/history-repo.js';
import type { DownloadJob } from '../types/download.js';
import type { HistoryRecord, HistoryStatus } from '../types/history.js';

function formatSummaryForJob(job: DownloadJob): string {
  if (job.mode === 'audio') {
    return `Audio (${job.audioFormat})`;
  }
  return `${job.maxResolution} (${job.outputContainer})`;
}

export class HistoryService {
  constructor(private readonly repo: HistoryRepository) {}

  listHistory(limit = 100): HistoryRecord[] {
    return this.repo.list(limit);
  }

  getById(id: string): HistoryRecord | null {
    return this.repo.getById(id);
  }

  recordJobResult(
    job: DownloadJob,
    status: HistoryStatus,
    errorMessage: string | null = null,
  ): HistoryRecord {
    const record: HistoryRecord = {
      id: randomUUID(),
      url: job.url,
      title: job.title,
      sourceExtractor: job.sourceExtractor,
      format: formatSummaryForJob(job),
      destinationPath: job.destinationPath ?? job.outputDir,
      status,
      errorMessage,
      completedAt: new Date().toISOString(),
    };
    this.repo.insert(record);
    return record;
  }

  deleteRecord(id: string): boolean {
    return this.repo.deleteById(id);
  }

  clearHistory(): number {
    return this.repo.clearAll();
  }
}
