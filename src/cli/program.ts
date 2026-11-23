import { Command } from 'commander';
import { VideoDLCore } from '../core/app-core.js';
import { launchTui } from '../tui/App.js';
import type {
  AudioFormat,
  OutputContainer,
  VideoResolution,
} from '../types/settings.js';
import { runDoctorCommand } from './commands/doctor.js';
import { runDownloadCommand } from './commands/download.js';
import { runHistoryCommand } from './commands/history.js';
import { runPlaylistCommand } from './commands/playlist.js';
import { runSettingsCommand } from './commands/settings.js';

export const APP_VERSION = '0.1.0';

export function buildCliProgram(core: VideoDLCore): Command {
  const program = new Command();

  program
    .name('videodl')
    .description(
      'Linux Terminal Video Downloader with interactive TUI & CLI backed by yt-dlp and FFmpeg',
    )
    .version(APP_VERSION, '-v, --version', 'Display the installed version');

  // Default action when invoked with no subcommand -> launch Ink TUI
  program.action(async () => {
    await launchTui(core);
  });

  program
    .command('download <url>')
    .description('Download an individual video from a supported URL')
    .option(
      '-r, --resolution <res>',
      'Max video resolution (best, 2160p, 1440p, 1080p, 720p, 480p, 360p)',
    )
    .option('-c, --container <ext>', 'Output container (mkv, mp4, webm)')
    .option('-d, --dir <path>', 'Download directory')
    .option('-a, --audio-only', 'Extract audio only')
    .option(
      '--audio-format <fmt>',
      'Audio format when using --audio-only (best, mp3, m4a, flac, opus)',
    )
    .action(async (url: string, options: Record<string, unknown>) => {
      const code = await runDownloadCommand(core, url, {
        resolution: options.resolution as VideoResolution | undefined,
        container: options.container as OutputContainer | undefined,
        dir: options.dir as string | undefined,
        audioOnly: Boolean(options.audioOnly),
        audioFormat: options.audioFormat as AudioFormat | undefined,
      });
      process.exitCode = code;
    });

  program
    .command('playlist <url>')
    .description('Download an entire playlist from a supported URL')
    .option(
      '-r, --resolution <res>',
      'Max video resolution (best, 2160p, 1440p, 1080p, 720p, 480p, 360p)',
    )
    .option('-c, --container <ext>', 'Output container (mkv, mp4, webm)')
    .option('-d, --dir <path>', 'Download directory')
    .option('-a, --audio-only', 'Extract audio only')
    .option(
      '--audio-format <fmt>',
      'Audio format when using --audio-only (best, mp3, m4a, flac, opus)',
    )
    .option('-l, --limit <n>', 'Limit number of playlist entries to queue', (v) =>
      Number.parseInt(v, 10),
    )
    .action(async (url: string, options: Record<string, unknown>) => {
      const code = await runPlaylistCommand(core, url, {
        resolution: options.resolution as VideoResolution | undefined,
        container: options.container as OutputContainer | undefined,
        dir: options.dir as string | undefined,
        audioOnly: Boolean(options.audioOnly),
        audioFormat: options.audioFormat as AudioFormat | undefined,
        limit: options.limit as number | undefined,
      });
      process.exitCode = code;
    });

  program
    .command('history')
    .description('View or clear previous download records')
    .option('-n, --limit <count>', 'Maximum number of records to display', (v) =>
      Number.parseInt(v, 10),
    )
    .option('--clear', 'Clear all download history')
    .option('--json', 'Output history as JSON')
    .action((options: Record<string, unknown>) => {
      const code = runHistoryCommand(core, {
        limit: options.limit as number | undefined,
        clear: Boolean(options.clear),
        json: Boolean(options.json),
      });
      process.exitCode = code;
    });

  program
    .command('settings')
    .description('View or manage application preferences')
    .option('--get <key>', 'Get a specific setting value')
    .option('--set <key=value>', 'Set a specific setting value')
    .option('--reset', 'Reset all settings to defaults')
    .option('--json', 'Output settings as JSON')
    .action((options: Record<string, unknown>) => {
      const code = runSettingsCommand(core, {
        get: options.get as string | undefined,
        set: options.set as string | undefined,
        reset: Boolean(options.reset),
        json: Boolean(options.json),
      });
      process.exitCode = code;
    });

  program
    .command('doctor')
    .alias('status')
    .description('Check system dependencies (Node.js, yt-dlp, FFmpeg, JS runtime)')
    .action(async () => {
      const code = await runDoctorCommand(core);
      process.exitCode = code;
    });

  return program;
}
