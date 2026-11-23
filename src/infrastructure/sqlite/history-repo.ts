import type { HistoryRecord, HistoryStatus } from '../../types/history.js';
import type { VideoDLDatabase } from './database.js';

interface HistoryRow {
  id: string;
  url: string;
  title: string;
  source_extractor: string;
  format: string;
  destination_path: string;
  status: string;
  error_message: string | null;
  completed_at: string;
}

function rowToRecord(row: HistoryRow): HistoryRecord {
  return {
    id: row.id,
    url: row.url,
    title: row.title,
    sourceExtractor: row.source_extractor,
    format: row.format,
    destinationPath: row.destination_path,
    status: row.status as HistoryStatus,
    errorMessage: row.error_message,
    completedAt: row.completed_at,
  };
}

export class HistoryRepository {
  constructor(private readonly database: VideoDLDatabase) {}

  insert(record: HistoryRecord): void {
    const stmt = this.database.db.prepare(`
      INSERT INTO history (
        id, url, title, source_extractor, format,
        destination_path, status, error_message, completed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      record.id,
      record.url,
      record.title,
      record.sourceExtractor,
      record.format,
      record.destinationPath,
      record.status,
      record.errorMessage,
      record.completedAt,
    );
  }

  list(limit = 100): HistoryRecord[] {
    const safeLimit = Math.max(1, Math.min(limit, 1000));
    const stmt = this.database.db.prepare(`
      SELECT * FROM history
      ORDER BY completed_at DESC
      LIMIT ?
    `);
    const rows = stmt.all(safeLimit) as unknown as HistoryRow[];
    return rows.map(rowToRecord);
  }

  getById(id: string): HistoryRecord | null {
    const stmt = this.database.db.prepare('SELECT * FROM history WHERE id = ?');
    const row = stmt.get(id) as unknown as HistoryRow | undefined;
    return row ? rowToRecord(row) : null;
  }

  deleteById(id: string): boolean {
    const stmt = this.database.db.prepare('DELETE FROM history WHERE id = ?');
    const result = stmt.run(id);
    return Number(result.changes) > 0;
  }

  clearAll(): number {
    const stmt = this.database.db.prepare('DELETE FROM history');
    const result = stmt.run();
    return Number(result.changes);
  }
}
