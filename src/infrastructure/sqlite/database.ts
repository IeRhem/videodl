import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export class VideoDLDatabase {
  public readonly db: DatabaseSync;
  public readonly dbPath: string;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
    if (dbPath !== ':memory:') {
      mkdirSync(dirname(dbPath), { recursive: true });
    }
    this.db = new DatabaseSync(dbPath);
    this.initialize();
  }

  private initialize(): void {
    this.db.exec('PRAGMA journal_mode = WAL;');
    this.db.exec('PRAGMA foreign_keys = ON;');

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS queue_jobs (
        id TEXT PRIMARY KEY,
        url TEXT NOT NULL,
        title TEXT NOT NULL,
        source_extractor TEXT NOT NULL,
        is_playlist INTEGER NOT NULL DEFAULT 0,
        playlist_title TEXT,
        playlist_index INTEGER,
        playlist_total INTEGER,
        mode TEXT NOT NULL,
        max_resolution TEXT NOT NULL,
        output_container TEXT NOT NULL,
        audio_format TEXT NOT NULL,
        output_dir TEXT NOT NULL,
        destination_path TEXT,
        status TEXT NOT NULL,
        progress_percent REAL NOT NULL DEFAULT 0,
        downloaded_bytes INTEGER,
        total_bytes INTEGER,
        speed_bytes_per_sec REAL,
        eta_seconds INTEGER,
        error_message TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS history (
        id TEXT PRIMARY KEY,
        url TEXT NOT NULL,
        title TEXT NOT NULL,
        source_extractor TEXT NOT NULL,
        format TEXT NOT NULL,
        destination_path TEXT NOT NULL,
        status TEXT NOT NULL,
        error_message TEXT,
        completed_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_queue_status ON queue_jobs(status);
      CREATE INDEX IF NOT EXISTS idx_history_completed_at ON history(completed_at DESC);
    `);
  }

  close(): void {
    this.db.close();
  }
}
