import chalk from 'chalk';
import type { VideoDLCore } from '../../core/app-core.js';
import type { DownloadJob, DownloadOptionsOverride } from '../../types/download.js';
import type {
  AudioFormat,
  OutputContainer,
  VideoResolution,
} from '../../types/settings.js';
import { formatSpeed, renderBar, truncateText } from '../formatters.js';

export interface PlaylistCommandOptions {
  resolution?: VideoResolution;
  container?: OutputContainer;
  dir?: string;
  audioOnly?: boolean;
  audioFormat?: AudioFormat;
  limit?: number;
}

export async function runPlaylistCommand(
  core: VideoDLCore,
  url: string,
  opts: PlaylistCommandOptions,
): Promise<number> {
  const depReport = await core.dependencies.checkAll();
  if (!depReport.allRequiredMet) {
    console.error(chalk.red('Missing required system dependencies:'));
    for (const dep of depReport.results.filter((r) => r.required && !r.installed)) {
      console.error(`  - ${dep.displayName}: ${chalk.yellow(dep.installHint)}`);
    }
    return 1;
  }

  const overrides: DownloadOptionsOverride = {
    mode: opts.audioOnly ? 'audio' : 'video',
    maxResolution: opts.resolution,
    outputContainer: opts.container,
    audioFormat: opts.audioFormat,
    outputDir: opts.dir,
    limit: opts.limit,
  };

  console.log(chalk.cyan('Fetching playlist metadata...'));
  const result = await core.downloads.downloadPlaylistUrl(url, overrides);

  const totalCount = result.metadata.playlistCount ?? result.queued.length;
  console.log(
    chalk.bold(
      `Playlist: ${result.metadata.playlistTitle ?? result.metadata.title} (${result.queued.length} of ${totalCount} items queued)`,
    ),
  );

  const jobIds = result.queued.map((q) => q.job.id);
  const targetSet = new Set(jobIds);

  const onProgress = (job: DownloadJob) => {
    if (!targetSet.has(job.id)) return;
    const idxTag =
      job.playlistIndex && job.playlistTotal
        ? `[${job.playlistIndex}/${job.playlistTotal}] `
        : '';
    const bar = renderBar(job.progress.percent, 16);
    console.log(
      `${idxTag}${truncateText(job.title, 36)} [${chalk.green(bar)}] ${job.progress.percent.toFixed(1)}% (${formatSpeed(job.progress.speedBytesPerSec)})`,
    );
  };

  const onCompleted = (job: DownloadJob) => {
    if (!targetSet.has(job.id)) return;
    console.log(chalk.green(`✔ Completed: ${job.title}`));
  };

  const onFailed = (job: DownloadJob) => {
    if (!targetSet.has(job.id)) return;
    console.error(chalk.red(`✖ Failed: ${job.title} — ${job.errorMessage ?? 'Error'}`));
  };

  core.queue.on('jobProgress', onProgress);
  core.queue.on('jobCompleted', onCompleted);
  core.queue.on('jobFailed', onFailed);

  const finished = await core.downloads.waitForJobs(jobIds);

  core.queue.off('jobProgress', onProgress);
  core.queue.off('jobCompleted', onCompleted);
  core.queue.off('jobFailed', onFailed);

  const completedCount = finished.filter((j) => j.status === 'completed').length;
  const failedCount = finished.filter((j) => j.status === 'failed').length;

  console.log(
    chalk.bold(
      `\nPlaylist finished: ${chalk.green(`${completedCount} completed`)}, ${
        failedCount > 0 ? chalk.red(`${failedCount} failed`) : chalk.gray('0 failed')
      }`,
    ),
  );

  return failedCount > 0 ? 1 : 0;
}
