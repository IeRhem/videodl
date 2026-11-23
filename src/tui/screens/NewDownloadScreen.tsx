import React, { useEffect, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import {
  AUDIO_FORMATS,
  OUTPUT_CONTAINERS,
  VIDEO_RESOLUTIONS,
} from '../../config/defaults.js';
import { validateAndNormalizeUrl } from '../../infrastructure/system/url-validator.js';
import type { DownloadMode } from '../../types/download.js';
import type {
  AudioFormat,
  OutputContainer,
  VideoResolution,
} from '../../types/settings.js';
import { useCore } from '../context/CoreContext.js';

type FieldIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6;
type PlaylistBehavior = 'auto' | 'single' | 'playlist';

const PLAYLIST_MODES: readonly PlaylistBehavior[] = ['auto', 'single', 'playlist'];

function cycleItem<T>(list: readonly T[], current: T, delta: number): T {
  const idx = list.indexOf(current);
  const next = (idx + delta + list.length) % list.length;
  return list[next] ?? list[0]!;
}

export function NewDownloadScreen(): React.JSX.Element {
  const {
    core,
    settings,
    setActiveScreen,
    setIsInputFocused,
    setStatusBanner,
  } = useCore();

  const [focusedField, setFocusedField] = useState<FieldIndex>(0);
  const [urlInput, setUrlInput] = useState('');
  const [mode, setMode] = useState<DownloadMode>('video');
  const [resolution, setResolution] = useState<VideoResolution>(
    settings.maxResolution,
  );
  const [container, setContainer] = useState<OutputContainer>(
    settings.outputContainer,
  );
  const [audioFormat, setAudioFormat] = useState<AudioFormat>(
    settings.audioFormat,
  );
  const [playlistMode, setPlaylistMode] = useState<PlaylistBehavior>('auto');
  const [outputDir, setOutputDir] = useState(settings.downloadDir);
  const [feedback, setFeedback] = useState<{
    type: 'info' | 'error' | 'success';
    text: string;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isTextEditing = focusedField === 0 || focusedField === 5;

  useEffect(() => {
    setIsInputFocused(isTextEditing);
    return () => setIsInputFocused(false);
  }, [isTextEditing, setIsInputFocused]);

  const submitDownload = async () => {
    if (isSubmitting) return;
    const validation = validateAndNormalizeUrl(urlInput);
    if (!validation.valid) {
      setFeedback({
        type: 'error',
        text: validation.error ?? 'Invalid URL.',
      });
      return;
    }

    setIsSubmitting(true);
    setFeedback({ type: 'info', text: 'Inspecting URL and adding to queue...' });

    try {
      const treatAsPlaylist =
        playlistMode === 'playlist' ||
        (playlistMode === 'auto' && validation.isLikelyPlaylist);

      const overrides = {
        mode,
        maxResolution: resolution,
        outputContainer: container,
        audioFormat,
        outputDir: outputDir.trim() || settings.downloadDir,
      };

      if (treatAsPlaylist) {
        const res = await core.downloads.downloadPlaylistUrl(
          validation.normalizedUrl,
          overrides,
        );
        setStatusBanner(
          `Queued ${res.queued.length} item(s) from "${res.metadata.playlistTitle ?? res.metadata.title}"`,
        );
      } else {
        const res = await core.downloads.downloadSingleUrl(
          validation.normalizedUrl,
          overrides,
        );
        setStatusBanner(
          res.duplicate
            ? `Already queued: ${res.job.title}`
            : `Queued: ${res.job.title}`,
        );
      }

      setUrlInput('');
      setActiveScreen('queue');
    } catch (err) {
      setFeedback({
        type: 'error',
        text: (err as Error).message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  useInput((input, key) => {
    if (key.escape) {
      setFocusedField(1);
      return;
    }

    if (key.tab || key.downArrow) {
      setFocusedField((prev) => ((prev + 1) % 7) as FieldIndex);
      return;
    }

    if (key.upArrow) {
      setFocusedField((prev) => ((prev + 6) % 7) as FieldIndex);
      return;
    }

    // Text input handling for URL (0) and Output Directory (5)
    if (focusedField === 0 || focusedField === 5) {
      if (key.return) {
        if (focusedField === 0) {
          void submitDownload();
        } else {
          setFocusedField(6);
        }
        return;
      }
      if (key.backspace || key.delete) {
        if (focusedField === 0) {
          setUrlInput((prev) => prev.slice(0, -1));
        } else {
          setOutputDir((prev) => prev.slice(0, -1));
        }
        return;
      }
      if (input && !key.ctrl && !key.meta) {
        if (focusedField === 0) {
          setUrlInput((prev) => prev + input);
        } else {
          setOutputDir((prev) => prev + input);
        }
      }
      return;
    }

    // Option cycling for non-text fields
    const delta = key.leftArrow ? -1 : key.rightArrow || input === ' ' ? 1 : 0;

    if (focusedField === 1 && delta !== 0) {
      setMode((prev) => (prev === 'video' ? 'audio' : 'video'));
    } else if (focusedField === 2 && delta !== 0) {
      if (mode === 'video') {
        setResolution((prev) => cycleItem(VIDEO_RESOLUTIONS, prev, delta));
      } else {
        setAudioFormat((prev) => cycleItem(AUDIO_FORMATS, prev, delta));
      }
    } else if (focusedField === 3 && delta !== 0) {
      setContainer((prev) => cycleItem(OUTPUT_CONTAINERS, prev, delta));
    } else if (focusedField === 4 && delta !== 0) {
      setPlaylistMode((prev) => cycleItem(PLAYLIST_MODES, prev, delta));
    } else if (focusedField === 6 && (key.return || input === ' ')) {
      void submitDownload();
    }
  });

  const renderFieldLabel = (idx: FieldIndex, label: string) => (
    <Text bold={focusedField === idx} color={focusedField === idx ? 'cyan' : 'gray'}>
      {focusedField === idx ? '▶ ' : '  '}
      {label.padEnd(18)}
    </Text>
  );

  return (
    <Box flexDirection="column" gap={1}>
      <Text bold color="cyan">
        New Download
      </Text>
      <Text color="gray">
        Paste a video or playlist URL. Use ↑/↓ or Tab to move, ←/→ to change options, Enter to queue.
      </Text>

      <Box flexDirection="column" gap={0}>
        <Box>
          {renderFieldLabel(0, 'URL:')}
          <Text color={focusedField === 0 ? 'white' : 'gray'}>
            {urlInput || (focusedField === 0 ? 'https://...' : '(empty)')}
            {focusedField === 0 ? '█' : ''}
          </Text>
        </Box>

        <Box>
          {renderFieldLabel(1, 'Mode:')}
          <Text color="white">{mode === 'video' ? 'Video + Audio' : 'Audio Only'}</Text>
        </Box>

        <Box>
          {renderFieldLabel(2, mode === 'video' ? 'Max Quality:' : 'Audio Format:')}
          <Text color="white">
            {mode === 'video' ? resolution : audioFormat}
          </Text>
        </Box>

        <Box>
          {renderFieldLabel(3, 'Container:')}
          <Text color={mode === 'video' ? 'white' : 'gray'}>
            {mode === 'video' ? container.toUpperCase() : 'N/A (Audio mode)'}
          </Text>
        </Box>

        <Box>
          {renderFieldLabel(4, 'Playlist Mode:')}
          <Text color="white">{playlistMode}</Text>
        </Box>

        <Box>
          {renderFieldLabel(5, 'Output Folder:')}
          <Text color={focusedField === 5 ? 'white' : 'gray'}>
            {outputDir}
            {focusedField === 5 ? '█' : ''}
          </Text>
        </Box>

        <Box marginTop={1}>
          {renderFieldLabel(6, 'Action:')}
          <Text
            bold
            color={focusedField === 6 ? 'black' : 'green'}
            backgroundColor={focusedField === 6 ? 'green' : undefined}
          >
            {isSubmitting ? ' Queuing... ' : ' [ Start / Add to Queue ] '}
          </Text>
        </Box>
      </Box>

      {feedback ? (
        <Text
          color={
            feedback.type === 'error'
              ? 'red'
              : feedback.type === 'success'
                ? 'green'
                : 'yellow'
          }
        >
          {feedback.text}
        </Text>
      ) : null}
    </Box>
  );
}
