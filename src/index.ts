import { buildCliProgram } from './cli/program.js';
import { VideoDLCore } from './core/app-core.js';

// Suppress Node's ExperimentalWarning for node:sqlite in CLI/TUI output
const originalEmitWarning = process.emitWarning.bind(process);
process.emitWarning = ((warning: string | Error, ...args: unknown[]) => {
  const msg = typeof warning === 'string' ? warning : warning.message;
  if (msg.includes('SQLite is an experimental feature')) {
    return;
  }
  return (originalEmitWarning as (...a: unknown[]) => void)(warning, ...args);
}) as typeof process.emitWarning;

async function main(): Promise<void> {
  const core = new VideoDLCore();
  let shuttingDown = false;

  const handleSignal = async (signal: NodeJS.Signals) => {
    if (shuttingDown) return;
    shuttingDown = true;
    await core.shutdown();
    process.exit(signal === 'SIGINT' ? 130 : 143);
  };

  process.on('SIGINT', () => {
    void handleSignal('SIGINT');
  });
  process.on('SIGTERM', () => {
    void handleSignal('SIGTERM');
  });

  try {
    const program = buildCliProgram(core);
    await program.parseAsync(process.argv);
  } catch (err) {
    console.error((err as Error).message);
    process.exitCode = 1;
  } finally {
    if (!shuttingDown) {
      await core.shutdown();
    }
  }
}

void main();
