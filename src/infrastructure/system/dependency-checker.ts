import type {
  DependencyCheckResult,
  SystemDependencyReport,
} from '../../types/dependencies.js';
import { runCommandCapture } from '../process/spawn-runner.js';

async function resolveBinaryPath(binaryName: string): Promise<string | null> {
  const res = await runCommandCapture('which', [binaryName], { timeoutMs: 3000 });
  if (res.exitCode === 0) {
    const firstLine = res.stdout.trim().split(/\r?\n/)[0];
    return firstLine && firstLine.length > 0 ? firstLine : null;
  }
  return null;
}

async function checkNode(): Promise<DependencyCheckResult> {
  const path = process.execPath || (await resolveBinaryPath('node'));
  return {
    name: 'node',
    displayName: 'Node.js',
    required: true,
    installed: true,
    version: process.version,
    path,
    installHint: 'sudo dnf install nodejs',
  };
}

async function checkYtDlp(): Promise<DependencyCheckResult> {
  const [res, binPath] = await Promise.all([
    runCommandCapture('yt-dlp', ['--version'], { timeoutMs: 5000 }),
    resolveBinaryPath('yt-dlp'),
  ]);

  const installed = res.exitCode === 0 && res.stdout.trim().length > 0;
  return {
    name: 'yt-dlp',
    displayName: 'yt-dlp',
    required: true,
    installed,
    version: installed ? res.stdout.trim().split(/\r?\n/)[0] ?? null : null,
    path: installed ? binPath : null,
    installHint: 'sudo dnf install yt-dlp  (or: pipx install yt-dlp)',
    message: installed ? undefined : 'yt-dlp is required to extract and download media.',
  };
}

async function checkFfmpeg(): Promise<DependencyCheckResult> {
  const [res, binPath] = await Promise.all([
    runCommandCapture('ffmpeg', ['-version'], { timeoutMs: 5000 }),
    resolveBinaryPath('ffmpeg'),
  ]);

  const installed = res.exitCode === 0;
  let version: string | null = null;
  if (installed) {
    const firstLine = res.stdout.trim().split(/\r?\n/)[0] ?? '';
    const match = firstLine.match(/ffmpeg version\s+([^\s]+)/i);
    version = match?.[1] ?? (firstLine || null);
  }

  return {
    name: 'ffmpeg',
    displayName: 'FFmpeg',
    required: true,
    installed,
    version,
    path: installed ? binPath : null,
    installHint:
      'sudo dnf install ffmpeg-free  (or enable RPM Fusion: sudo dnf install ffmpeg)',
    message: installed
      ? undefined
      : 'FFmpeg is required for merging video/audio streams and converting containers.',
  };
}

async function checkJsRuntime(): Promise<DependencyCheckResult> {
  // Check deno first, then node (both are supported JS runtimes for yt-dlp extraction)
  const denoRes = await runCommandCapture('deno', ['--version'], { timeoutMs: 3000 });
  if (denoRes.exitCode === 0) {
    const binPath = await resolveBinaryPath('deno');
    const match = denoRes.stdout.match(/deno\s+([^\s]+)/i);
    return {
      name: 'js-runtime',
      displayName: 'JS Runtime (Deno/Node)',
      required: false,
      installed: true,
      version: match?.[1] ? `deno ${match[1]}` : 'deno',
      path: binPath,
      installHint: 'sudo dnf install nodejs',
    };
  }

  const nodeRes = await runCommandCapture('node', ['--version'], { timeoutMs: 3000 });
  const nodePath = await resolveBinaryPath('node');
  if (nodeRes.exitCode === 0) {
    return {
      name: 'js-runtime',
      displayName: 'JS Runtime (Node.js)',
      required: false,
      installed: true,
      version: `node ${nodeRes.stdout.trim()}`,
      path: nodePath ?? process.execPath,
      installHint: 'sudo dnf install nodejs',
    };
  }

  return {
    name: 'js-runtime',
    displayName: 'JS Runtime',
    required: false,
    installed: false,
    version: null,
    path: null,
    installHint: 'sudo dnf install nodejs  (or install deno)',
    message: 'A JavaScript runtime helps yt-dlp solve extractor challenges.',
  };
}

export class DependencyChecker {
  async checkAll(): Promise<SystemDependencyReport> {
    const results = await Promise.all([
      checkNode(),
      checkYtDlp(),
      checkFfmpeg(),
      checkJsRuntime(),
    ]);

    const allRequiredMet = results
      .filter((r) => r.required)
      .every((r) => r.installed);

    return {
      allRequiredMet,
      checkedAt: new Date().toISOString(),
      results,
    };
  }
}
