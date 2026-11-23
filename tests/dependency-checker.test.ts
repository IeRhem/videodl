import { describe, expect, it } from 'vitest';
import { DependencyChecker } from '../src/infrastructure/system/dependency-checker.js';

describe('DependencyChecker', () => {
  it('checks node, yt-dlp, ffmpeg, and js-runtime', async () => {
    const checker = new DependencyChecker();
    const report = await checker.checkAll();

    expect(report.results.map((r) => r.name)).toEqual([
      'node',
      'yt-dlp',
      'ffmpeg',
      'js-runtime',
    ]);

    const nodeDep = report.results.find((r) => r.name === 'node');
    expect(nodeDep?.installed).toBe(true);
    expect(nodeDep?.version).toBe(process.version);
    expect(report.allRequiredMet).toBe(true);
  });
});
