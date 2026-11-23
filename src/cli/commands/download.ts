import chalk from 'chalk';
import type { VideoDLCore } from '../../core/app-core.js';
import type { DownloadJob, DownloadOptionsOverride } from '../../types/download.js';
import type {
  AudioFormat,
  OutputContainer,
  VideoResolution,
} from '../../types/settings.js';
import { formatBytes, formatDuration, formatSpeed, renderBar } from '../formatters.js';

export interface DownloadCommandOptions {
  resolution?: VideoResolution;
  container?: OutputContainer;
  dir?: string;
  audioOnly?: boolean;
  audioFormat?: AudioFormat;
}

function renderJobProgressLine(job: DownloadJob): string {
  const bar = renderBar(job.progress.percent, 22);
  const pct = job.progress.percent.toFixed(1).padStart(5, ' ');
  const size =
    job.progress.totalBytes !== null
      ? `${formatBytes(job.progress.downloadedBytes)} / ${formatBytes(job.progress.totalBytes)}`
      : formatBytes(job.progress.downloadedBytes);
  const speed = formatSpeed(job.progress.speedBytesPerSec);
  const eta = formatDuration(job.progress.etaSeconds);
  const statusLabel =
    job.status === 'processing' ? chalk.yellow('processing') : chalk.cyan('downloading');
  return `${statusLabel} [${chalk.green(bar)}] ${pct}% | ${size} | ${speed} | ETA ${eta}`;
}

export async function runDownloadCommand(
  core: VideoDLCore,
  url: string,
  opts: DownloadCommandOptions,
): Promise<number> {
  const depReport = await core.dependencies.checkAll();
  if (!depReport.allRequiredMet) {
    console.error(chalk.red('Missing required system dependencies:'));
    for (const dep of depReport.results.filter((r) => r.required && !r.installed)) {
      console.error(`  - ${dep.displayName}: ${dep.message ?? 'Not installed'}`);
      console.error(`    Install hint: ${chalk.yellow(dep.installHint)}`);
    }
    return 1;
  }

  const overrides: DownloadOptionsOverride = {
    mode: opts.audioOnly ? 'audio' : 'video',
    maxResolution: opts.resolution,
    outputContainer: opts.container,
    audioFormat: opts.audioFormat,
    outputDir: opts.dir,
  };

  console.log(chalk.cyan('Resolving metadata...'));
  const { job, duplicate } = await core.downloads.downloadSingleUrl(url, overrides);

  if (duplicate) {
    console.log(chalk.yellow(`Already in queue: ${job.title} (${job.status})`));
  } else {
    console.log(chalk.bold(`Queued: ${job.title}`));
    console.log(
      chalk.gray(
        `Format: ${job.mode === 'audio' ? `Audio (${job.audioFormat})` : `${job.maxResolution} ${job.outputContainer.toUpperCase()}`} -> ${job.outputDir}`,
      ),
    );
  }

  const isTty = Boolean(process.stdout.isTTY);
  const onProgress = (updated: DownloadJob) => {
    if (updated.id !== job.id) return;
    const line = renderJobProgressLine(updated);
    if (isTty) {
      process.stdout.write(`\r\x1b[K${line}`);
    } else {
      console.log(line);
    }
  };

  core.queue.on('jobProgress', onProgress);
  const [finished] = await core.downloads.waitForJobs([job.id]);
  core.queue.off('jobProgress', onProgress);

  if (isTty) {
    process.stdout.write('\n');
  }

  if (!finished) {
    console.error(chalk.red('Download job disappeared unexpectedly.'));
    return 1;
  }

  if (finished.status === 'completed') {
    console.log(
      chalk.green(`✔ Completed: ${finished.title}\n  Saved to: ${finished.destinationPath ?? finished.outputDir}`),
    );
    return 0;
  }

  console.error(
    chalk.red(`✖ Failed (${finished.status}): ${finished.errorMessage ?? 'Unknown error'}`),
  );
  return 1;
}
