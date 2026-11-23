export type DependencyName = 'node' | 'yt-dlp' | 'ffmpeg' | 'js-runtime';

export interface DependencyCheckResult {
  name: DependencyName;
  displayName: string;
  required: boolean;
  installed: boolean;
  version: string | null;
  path: string | null;
  installHint: string;
  message?: string;
}

export interface SystemDependencyReport {
  allRequiredMet: boolean;
  checkedAt: string;
  results: DependencyCheckResult[];
}
