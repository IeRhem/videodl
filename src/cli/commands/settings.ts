import chalk from 'chalk';
import type { VideoDLCore } from '../../core/app-core.js';
import type { AppSettings } from '../../types/settings.js';

export interface SettingsCommandOptions {
  get?: string;
  set?: string;
  reset?: boolean;
  json?: boolean;
}

const VALID_KEYS: ReadonlyArray<keyof AppSettings> = [
  'downloadDir',
  'maxResolution',
  'outputContainer',
  'audioFormat',
  'audioQuality',
  'maxConcurrentDownloads',
  'browserCookies',
];

export function runSettingsCommand(
  core: VideoDLCore,
  opts: SettingsCommandOptions,
): number {
  if (opts.reset) {
    const reset = core.settings.resetSettings();
    console.log(chalk.green('Settings reset to defaults.'));
    if (opts.json) {
      console.log(JSON.stringify(reset, null, 2));
    }
    return 0;
  }

  if (opts.set) {
    const eqIndex = opts.set.indexOf('=');
    if (eqIndex <= 0) {
      console.error(chalk.red('Invalid format. Use --set key=value'));
      return 1;
    }
    const key = opts.set.slice(0, eqIndex).trim() as keyof AppSettings;
    const rawValue = opts.set.slice(eqIndex + 1).trim();

    if (!VALID_KEYS.includes(key)) {
      console.error(
        chalk.red(`Unknown setting "${key}". Valid keys: ${VALID_KEYS.join(', ')}`),
      );
      return 1;
    }

    const parsedValue =
      key === 'maxConcurrentDownloads' ? Number(rawValue) : rawValue;

    try {
      const updated = core.settings.updateSettings({
        [key]: parsedValue,
      } as Partial<AppSettings>);
      const displayVal =
        key === 'browserCookies' && updated[key] !== 'none'
          ? `${updated[key]} (local only)`
          : String(updated[key]);
      console.log(chalk.green(`Updated ${key} = ${displayVal}`));
      return 0;
    } catch (err) {
      console.error(
        chalk.red(`Failed to update setting: ${(err as Error).message}`),
      );
      return 1;
    }
  }

  const current = core.settings.getSettings();

  if (opts.get) {
    const key = opts.get.trim() as keyof AppSettings;
    if (!VALID_KEYS.includes(key)) {
      console.error(
        chalk.red(`Unknown setting "${key}". Valid keys: ${VALID_KEYS.join(', ')}`),
      );
      return 1;
    }
    console.log(String(current[key]));
    return 0;
  }

  if (opts.json) {
    console.log(JSON.stringify(current, null, 2));
    return 0;
  }

  console.log(chalk.bold('VideoDL Settings'));
  console.log(chalk.gray('─'.repeat(50)));
  console.log(`downloadDir:            ${chalk.cyan(current.downloadDir)}`);
  console.log(`maxResolution:          ${chalk.cyan(current.maxResolution)}`);
  console.log(`outputContainer:        ${chalk.cyan(current.outputContainer)}`);
  console.log(`audioFormat:            ${chalk.cyan(current.audioFormat)}`);
  console.log(`audioQuality:           ${chalk.cyan(current.audioQuality)}`);
  console.log(
    `maxConcurrentDownloads: ${chalk.cyan(String(current.maxConcurrentDownloads))}`,
  );
  console.log(
    `browserCookies:         ${chalk.cyan(current.browserCookies)} ${chalk.gray('(kept local only)')}`,
  );
  return 0;
}
