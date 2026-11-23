import type { VideoDLDatabase } from '../infrastructure/sqlite/database.js';
import type { AppSettings } from '../types/settings.js';
import { AppSettingsSchema, createDefaultSettings } from './defaults.js';

interface SettingRow {
  key: string;
  value: string;
}

export class SettingsService {
  private cached: AppSettings | null = null;

  constructor(private readonly database: VideoDLDatabase) {}

  getSettings(): AppSettings {
    if (this.cached) {
      return { ...this.cached };
    }

    const defaults = createDefaultSettings();
    const rows = this.database.db
      .prepare('SELECT key, value FROM settings')
      .all() as unknown as SettingRow[];

    const raw: Record<string, unknown> = { ...defaults };
    for (const row of rows) {
      try {
        raw[row.key] = JSON.parse(row.value);
      } catch {
        // Ignore malformed persisted setting and fall back to default
      }
    }

    const parsed = AppSettingsSchema.safeParse(raw);
    const resolved = parsed.success ? parsed.data : defaults;
    this.cached = resolved;
    return { ...resolved };
  }

  updateSettings(partial: Partial<AppSettings>): AppSettings {
    const current = this.getSettings();
    const merged = { ...current, ...partial };
    const validated = AppSettingsSchema.parse(merged);

    const now = new Date().toISOString();
    const stmt = this.database.db.prepare(`
      INSERT INTO settings (key, value, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        updated_at = excluded.updated_at
    `);

    for (const [key, value] of Object.entries(validated)) {
      stmt.run(key, JSON.stringify(value), now);
    }

    this.cached = validated;
    return { ...validated };
  }

  resetSettings(): AppSettings {
    this.database.db.prepare('DELETE FROM settings').run();
    const defaults = createDefaultSettings();
    this.cached = defaults;
    return { ...defaults };
  }
}
