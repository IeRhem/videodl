import type {
  DownloadJob,
  DownloadMode,
  DownloadStatus,
} from '../../types/download.js';
import type {
  AudioFormat,
  OutputContainer,
  VideoResolution,
} from '../../types/settings.js';
import type { VideoDLDatabase } from './database.js';

interface QueueRow {
  id: string;
  url: string;
  title: string;
  source_extractor: string;
  is_playlist: number;
  playlist_title: string | null;
  playlist_index: number | null;
  playlist_total: number | null;
  mode: string;
  max_resolution: string;
  output_container: string;
  audio_format: string;
  output_dir: string;
  destination_path: string | null;
  status: string;
  progress_percent: number;
  downloaded_bytes: number | null;
  total_bytes: number | null;
  speed_bytes_per_sec: number | null;
  eta_seconds: number | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

function rowToJob(row: QueueRow): DownloadJob {
  return {
    id: row.id,
    url: row.url,
    title: row.title,
    sourceExtractor: row.source_extractor,
    isPlaylist: row.is_playlist === 1,
    playlistTitle: row.playlist_title,
    playlistIndex: row.playlist_index,
    playlistTotal: row.playlist_total,
    mode: row.mode as DownloadMode,
    maxResolution: row.max_resolution as VideoResolution,
    outputContainer: row.output_container as OutputContainer,
    audioFormat: row.audio_format as AudioFormat,
    outputDir: row.output_dir,
    destinationPath: row.destination_path,
    status: row.status as DownloadStatus,
    progress: {
      percent: row.progress_percent,
      downloadedBytes: row.downloaded_bytes,
      totalBytes: row.total_bytes,
      speedBytesPerSec: row.speed_bytes_per_sec,
      etaSeconds: row.eta_seconds,
    },
    errorMessage: row.error_message,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class QueueRepository {
  constructor(private readonly database: VideoDLDatabase) {}

  /**
   * Transitions any active-state jobs left over from an ungraceful exit into 'paused'
   * so they can be resumed safely.
   */
  recoverInterruptedJobs(): number {
    const now = new Date().toISOString();
    const stmt = this.database.db.prepare(`
      UPDATE queue_jobs
      SET status = 'paused', updated_at = ?
      WHERE status IN ('downloading', 'fetching_metadata', 'processing')
    `);
    const result = stmt.run(now);
    return Number(result.changes);
  }

  insert(job: DownloadJob): void {
    const stmt = this.database.db.prepare(`
      INSERT INTO queue_jobs (
        id, url, title, source_extractor, is_playlist, playlist_title,
        playlist_index, playlist_total, mode, max_resolution, output_container,
        audio_format, output_dir, destination_path, status, progress_percent,
        downloaded_bytes, total_bytes, speed_bytes_per_sec, eta_seconds,
        error_message, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      job.id,
      job.url,
      job.title,
      job.sourceExtractor,
      job.isPlaylist ? 1 : 0,
      job.playlistTitle,
      job.playlistIndex,
      job.playlistTotal,
      job.mode,
      job.maxResolution,
      job.outputContainer,
      job.audioFormat,
      job.outputDir,
      job.destinationPath,
      job.status,
      job.progress.percent,
      job.progress.downloadedBytes,
      job.progress.totalBytes,
      job.progress.speedBytesPerSec,
      job.progress.etaSeconds,
      job.errorMessage,
      job.createdAt,
      job.updatedAt,
    );
  }

  update(job: DownloadJob): void {
    const stmt = this.database.db.prepare(`
      UPDATE queue_jobs SET
        title = ?,
        source_extractor = ?,
        destination_path = ?,
        status = ?,
        progress_percent = ?,
        downloaded_bytes = ?,
        total_bytes = ?,
        speed_bytes_per_sec = ?,
        eta_seconds = ?,
        error_message = ?,
        updated_at = ?
      WHERE id = ?
    `);

    stmt.run(
      job.title,
      job.sourceExtractor,
      job.destinationPath,
      job.status,
      job.progress.percent,
      job.progress.downloadedBytes,
      job.progress.totalBytes,
      job.progress.speedBytesPerSec,
      job.progress.etaSeconds,
      job.errorMessage,
      job.updatedAt,
      job.id,
    );
  }

  getById(id: string): DownloadJob | null {
    const stmt = this.database.db.prepare(
      'SELECT * FROM queue_jobs WHERE id = ?',
    );
    const row = stmt.get(id) as unknown as QueueRow | undefined;
    return row ? rowToJob(row) : null;
  }

  findActiveByUrl(url: string): DownloadJob | null {
    const stmt = this.database.db.prepare(`
      SELECT * FROM queue_jobs
      WHERE url = ?
        AND status IN ('pending', 'fetching_metadata', 'downloading', 'processing', 'paused')
      LIMIT 1
    `);
    const row = stmt.get(url) as unknown as QueueRow | undefined;
    return row ? rowToJob(row) : null;
  }

  listAll(): DownloadJob[] {
    const stmt = this.database.db.prepare(`
      SELECT * FROM queue_jobs
      ORDER BY created_at ASC
    `);
    const rows = stmt.all() as unknown as QueueRow[];
    return rows.map(rowToJob);
  }

  deleteById(id: string): boolean {
    const stmt = this.database.db.prepare('DELETE FROM queue_jobs WHERE id = ?');
    const result = stmt.run(id);
    return Number(result.changes) > 0;
  }

  clearFinished(): number {
    const stmt = this.database.db.prepare(`
      DELETE FROM queue_jobs
      WHERE status IN ('completed', 'failed', 'cancelled')
    `);
    const result = stmt.run();
    return Number(result.changes);
  }
}
