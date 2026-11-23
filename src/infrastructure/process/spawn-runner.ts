import { spawn, type ChildProcess } from 'node:child_process';

export interface CommandCaptureOptions {
  timeoutMs?: number;
  cwd?: string;
  env?: NodeJS.ProcessEnv;
}

export interface CommandCaptureResult {
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
  errorCode?: string;
}

export interface StreamingProcessCallbacks {
  onStdoutLine?: (line: string) => void;
  onStderrLine?: (line: string) => void;
}

export interface StreamingProcessHandle {
  pid: number | undefined;
  kill: (signal?: NodeJS.Signals) => boolean;
  promise: Promise<{
    exitCode: number | null;
    signal: NodeJS.Signals | null;
    stderrTail: string;
    errorCode?: string;
  }>;
}

/**
 * Executes an external command safely with shell: false and captures stdout/stderr.
 */
export function runCommandCapture(
  command: string,
  args: string[],
  options: CommandCaptureOptions = {},
): Promise<CommandCaptureResult> {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      shell: false,
      cwd: options.cwd,
      env: options.env ?? process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let settled = false;
    let timer: NodeJS.Timeout | undefined;

    if (options.timeoutMs && options.timeoutMs > 0) {
      timer = setTimeout(() => {
        if (!settled) {
          child.kill('SIGTERM');
          settled = true;
          resolve({
            exitCode: null,
            signal: 'SIGTERM',
            stdout,
            stderr: stderr || 'Command timed out',
            errorCode: 'ETIMEDOUT',
          });
        }
      }, options.timeoutMs);
    }

    child.stdout?.setEncoding('utf8');
    child.stderr?.setEncoding('utf8');

    child.stdout?.on('data', (chunk: string) => {
      stdout += chunk;
    });

    child.stderr?.on('data', (chunk: string) => {
      stderr += chunk;
    });

    child.on('error', (err: NodeJS.ErrnoException) => {
      if (timer) clearTimeout(timer);
      if (!settled) {
        settled = true;
        resolve({
          exitCode: null,
          signal: null,
          stdout,
          stderr: err.message,
          errorCode: err.code,
        });
      }
    });

    child.on('close', (exitCode, signal) => {
      if (timer) clearTimeout(timer);
      if (!settled) {
        settled = true;
        resolve({
          exitCode,
          signal,
          stdout,
          stderr,
        });
      }
    });
  });
}

function createLineSplitter(onLine?: (line: string) => void): (chunk: string) => void {
  let buffer = '';
  return (chunk: string) => {
    if (!onLine) return;
    buffer += chunk;
    const parts = buffer.split(/\r?\n|\r/);
    buffer = parts.pop() ?? '';
    for (const part of parts) {
      if (part.length > 0) {
        onLine(part);
      }
    }
  };
}

/**
 * Spawns a long-running child process with shell: false and streams lines from stdout and stderr.
 */
export function spawnStreamingProcess(
  command: string,
  args: string[],
  callbacks: StreamingProcessCallbacks = {},
  cwd?: string,
): StreamingProcessHandle {
  const child: ChildProcess = spawn(command, args, {
    shell: false,
    cwd,
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const stdoutSplitter = createLineSplitter(callbacks.onStdoutLine);
  const stderrLines: string[] = [];

  const stderrSplitter = createLineSplitter((line) => {
    stderrLines.push(line);
    if (stderrLines.length > 50) {
      stderrLines.shift();
    }
    callbacks.onStderrLine?.(line);
  });

  child.stdout?.setEncoding('utf8');
  child.stderr?.setEncoding('utf8');

  child.stdout?.on('data', stdoutSplitter);
  child.stderr?.on('data', stderrSplitter);

  const promise = new Promise<{
    exitCode: number | null;
    signal: NodeJS.Signals | null;
    stderrTail: string;
    errorCode?: string;
  }>((resolve) => {
    let settled = false;

    child.on('error', (err: NodeJS.ErrnoException) => {
      if (!settled) {
        settled = true;
        resolve({
          exitCode: null,
          signal: null,
          stderrTail: err.message,
          errorCode: err.code,
        });
      }
    });

    child.on('close', (exitCode, signal) => {
      if (!settled) {
        settled = true;
        resolve({
          exitCode,
          signal,
          stderrTail: stderrLines.join('\n'),
        });
      }
    });
  });

  return {
    pid: child.pid,
    kill: (signal: NodeJS.Signals = 'SIGTERM') => {
      if (child.killed || child.exitCode !== null) {
        return false;
      }
      return child.kill(signal);
    },
    promise,
  };
}
