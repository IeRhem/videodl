import chalk from 'chalk';
import type { VideoDLCore } from '../../core/app-core.js';

export async function runDoctorCommand(core: VideoDLCore): Promise<number> {
  const report = await core.dependencies.checkAll();

  console.log(chalk.bold('VideoDL System Dependency Check'));
  console.log(chalk.gray('─'.repeat(65)));

  for (const dep of report.results) {
    const status = dep.installed
      ? chalk.green('OK     ')
      : dep.required
        ? chalk.red('MISSING')
        : chalk.yellow('WARN   ');

    const version = dep.version ? chalk.cyan(dep.version) : chalk.gray('not found');
    const loc = dep.path ? chalk.gray(`(${dep.path})`) : '';
    console.log(`${status} ${dep.displayName.padEnd(24)} ${version} ${loc}`);

    if (!dep.installed) {
      console.log(`        Install: ${chalk.yellow(dep.installHint)}`);
    }
  }

  console.log('');
  if (report.allRequiredMet) {
    console.log(chalk.green('All required system dependencies are available.'));
    return 0;
  }

  console.log(
    chalk.red('Some required dependencies are missing. See installation hints above.'),
  );
  return 1;
}
