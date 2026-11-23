import React, { useEffect, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import {
  AUDIO_FORMATS,
  AUDIO_QUALITIES,
  BROWSER_COOKIE_SOURCES,
  OUTPUT_CONTAINERS,
  VIDEO_RESOLUTIONS,
} from '../../config/defaults.js';
import type { AppSettings } from '../../types/settings.js';
import { useCore } from '../context/CoreContext.js';

function cycleItem<T>(list: readonly T[], current: T, delta: number): T {
  const idx = list.indexOf(current);
  const next = (idx + delta + list.length) % list.length;
  return list[next] ?? list[0]!;
}

export function SettingsScreen(): React.JSX.Element {
  const { core, settings, refreshSettings, setIsInputFocused, setStatusBanner } =
    useCore();

  const [selectedRow, setSelectedRow] = useState(0);
  const [editingDir, setEditingDir] = useState(false);
  const [dirBuffer, setDirBuffer] = useState(settings.downloadDir);

  useEffect(() => {
    setIsInputFocused(editingDir);
    return () => setIsInputFocused(false);
  }, [editingDir, setIsInputFocused]);

  useEffect(() => {
    if (!editingDir) {
      setDirBuffer(settings.downloadDir);
    }
  }, [settings.downloadDir, editingDir]);

  const applyUpdate = (partial: Partial<AppSettings>, label: string) => {
    try {
      core.settings.updateSettings(partial);
      refreshSettings();
      setStatusBanner(`Saved ${label}`);
    } catch (err) {
      setStatusBanner(`Error: ${(err as Error).message}`);
    }
  };

  useInput((input, key) => {
    if (editingDir) {
      if (key.escape) {
        setEditingDir(false);
        setDirBuffer(settings.downloadDir);
        return;
      }
      if (key.return) {
        setEditingDir(false);
        applyUpdate({ downloadDir: dirBuffer }, 'download directory');
        return;
      }
      if (key.backspace || key.delete) {
        setDirBuffer((prev) => prev.slice(0, -1));
        return;
      }
      if (input && !key.ctrl && !key.meta) {
        setDirBuffer((prev) => prev + input);
      }
      return;
    }

    if (key.upArrow) {
      setSelectedRow((prev) => (prev + 6) % 7);
      return;
    }
    if (key.downArrow) {
      setSelectedRow((prev) => (prev + 1) % 7);
      return;
    }

    if (input === 'R') {
      core.settings.resetSettings();
      refreshSettings();
      setStatusBanner('Reset settings to defaults');
      return;
    }

    const delta = key.leftArrow ? -1 : key.rightArrow || key.return || input === ' ' ? 1 : 0;

    if (selectedRow === 0 && (key.return || input === 'e')) {
      setEditingDir(true);
      return;
    }

    if (delta === 0) return;

    if (selectedRow === 1) {
      const next = cycleItem(VIDEO_RESOLUTIONS, settings.maxResolution, delta);
      applyUpdate({ maxResolution: next }, `maxResolution = ${next}`);
    } else if (selectedRow === 2) {
      const next = cycleItem(OUTPUT_CONTAINERS, settings.outputContainer, delta);
      applyUpdate({ outputContainer: next }, `container = ${next}`);
    } else if (selectedRow === 3) {
      const next = cycleItem(AUDIO_FORMATS, settings.audioFormat, delta);
      applyUpdate({ audioFormat: next }, `audioFormat = ${next}`);
    } else if (selectedRow === 4) {
      const next = cycleItem(AUDIO_QUALITIES, settings.audioQuality, delta);
      applyUpdate({ audioQuality: next }, `audioQuality = ${next}`);
    } else if (selectedRow === 5) {
      const next = Math.max(
        1,
        Math.min(5, settings.maxConcurrentDownloads + delta),
      );
      applyUpdate({ maxConcurrentDownloads: next }, `concurrency = ${next}`);
    } else if (selectedRow === 6) {
      const next = cycleItem(
        BROWSER_COOKIE_SOURCES,
        settings.browserCookies,
        delta,
      );
      applyUpdate({ browserCookies: next }, `browserCookies = ${next}`);
    }
  });

  const rows: Array<{ label: string; value: string; hint?: string }> = [
    {
      label: 'Download Directory',
      value: editingDir ? `${dirBuffer}█` : settings.downloadDir,
      hint: editingDir ? 'Enter to save, Esc to cancel' : 'Press Enter to edit path',
    },
    {
      label: 'Max Video Resolution',
      value: settings.maxResolution,
    },
    {
      label: 'Output Container',
      value: settings.outputContainer.toUpperCase(),
    },
    {
      label: 'Audio Format',
      value: settings.audioFormat,
    },
    {
      label: 'Audio Quality',
      value: settings.audioQuality,
    },
    {
      label: 'Concurrent Downloads',
      value: String(settings.maxConcurrentDownloads),
    },
    {
      label: 'Browser Cookies (Local)',
      value: settings.browserCookies,
      hint: 'Passed locally to yt-dlp only; never logged or uploaded',
    },
  ];

  return (
    <Box flexDirection="column" gap={1}>
      <Box justifyContent="space-between">
        <Text bold color="cyan">
          Settings
        </Text>
        <Text color="gray">↑/↓ Select · ←/→ Change · [Shift+R] Reset Defaults</Text>
      </Box>

      <Box flexDirection="column">
        {rows.map((row, idx) => {
          const active = idx === selectedRow;
          return (
            <Box key={row.label} flexDirection="column">
              <Box>
                <Text bold={active} color={active ? 'cyan' : 'white'}>
                  {active ? '▶ ' : '  '}
                  {row.label.padEnd(26)}
                </Text>
                <Text color={active ? 'green' : 'gray'}>{row.value}</Text>
              </Box>
              {active && row.hint ? (
                <Text color="gray">    {row.hint}</Text>
              ) : null}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
