import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

/**
 * Resolves XDG Base Directory paths for VideoDL configuration, data, and downloads.
 * Supports VIDEODL_DATA_DIR for isolated test runs.
 */
export function getConfigDir(): string {
  if (process.env.VIDEODL_DATA_DIR) {
    return join(process.env.VIDEODL_DATA_DIR, 'config');
  }
  const xdgConfig = process.env.XDG_CONFIG_HOME;
  const base = xdgConfig && xdgConfig.trim() !== '' ? xdgConfig : join(homedir(), '.config');
  return join(base, 'videodl');
}

export function getDataDir(): string {
  if (process.env.VIDEODL_DATA_DIR) {
    return process.env.VIDEODL_DATA_DIR;
  }
  const xdgData = process.env.XDG_DATA_HOME;
  const base = xdgData && xdgData.trim() !== '' ? xdgData : join(homedir(), '.local', 'share');
  return join(base, 'videodl');
}

export function getDatabasePath(): string {
  return join(getDataDir(), 'videodl.db');
}

export function getDefaultDownloadDir(): string {
  const xdgVideos = process.env.XDG_VIDEOS_DIR;
  if (xdgVideos && xdgVideos.trim() !== '') {
    return join(xdgVideos, 'VideoDL');
  }
  const videosDir = join(homedir(), 'Videos');
  if (existsSync(videosDir)) {
    return join(videosDir, 'VideoDL');
  }
  return join(homedir(), 'Downloads', 'VideoDL');
}
