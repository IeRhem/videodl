import chalk from 'chalk';
import type { VideoDLCore } from '../../core/app-core.js';
import { truncateText } from '../formatters.js';

export interface HistoryCommandOptions {
  limit?: number;
  clear?: boolean;
  json?: boolean;
}

export function runHistoryCommand(
  core: VideoDLCore,
  opts: HistoryCommandOptions,
): number {
  if (opts.clear) {
    const removed = core.history.clearHistory();
    console.log(chalk.green(`Cleared ${removed} history record(s).`));
    return 0;
  }

  const records = core.history.listHistory(opts.limit ?? 25);

  if (opts.json) {
    console.log(JSON.stringify(records, null, 2));
    return 0;
  }

  if (records.length === 0) {
    console.log(chalk.gray('No download history yet.'));
    return 0;
  }

  console.log(chalk.bold(`Download History (${records.length})`));
  console.log(chalk.gray('─'.repeat(80)));

  for (const rec of records) {
    const badge =
      rec.status === 'completed'
        ? chalk.green('DONE')
        : rec.status === 'cancelled'
          ? chalk.yellow('CANC')
          : chalk.red('FAIL');
    const dateStr = rec.completedAt.replace('T', ' ').slice(0, 19);
    console.log(
      `${badge}  ${chalk.bold(truncateText(rec.title, 44))}  ${chalk.cyan(rec.format)}  ${chalk.gray(dateStr)}`,
    );
    console.log(`      ${chalk.gray('Source:')} ${rec.sourceExtractor}  ${chalk.gray('Dest:')} ${rec.destinationPath}`);
    if (rec.errorMessage) {
      console.log(`      ${chalk.red('Error:')} ${truncateText(rec.errorMessage, 70)}`);
    }
  }

  return 0;
}
