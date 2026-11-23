import React, { useEffect, useState } from 'react';
import { Box, Text, useInput, useStdout } from 'ink';
import {
  formatBytes,
  formatDuration,
  formatSpeed,
  truncateText,
} from '../../cli/formatters.js';
import type { DownloadStatus } from '../../types/download.js';
import { ProgressBar } from '../components/ProgressBar.js';
import { useCore } from '../context/CoreContext.js';

function statusColor(status: DownloadStatus): string {
  switch (status) {
    case 'downloading':
      return 'cyan';
    case 'processing':
      return 'yellow';
    case 'completed':
      return 'green';
    case 'failed':
      return 'red';
    case 'paused':
      return 'magenta';
    case 'cancelled':
      return 'gray';
    default:
      return 'white';
  }
}

export function QueueScreen(): React.JSX.Element {
  const { core, jobs, setStatusBanner } = useCore();
  const { stdout } = useStdout();
  const [terminalRows, setTerminalRows] = useState(stdout.rows || 24);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [scrollOffset, setScrollOffset] = useState(0);

  useEffect(() => {
    const onResize = () => setTerminalRows(stdout.rows || 24);
    stdout.on('resize', onResize);
    return () => {
      stdout.off('resize', onResize);
    };
  }, [stdout]);

  // Header (3) + Footer (3) + Main Border (2) + Queue Title/Hints (2) + Scroll Bar (1) = 11 rows overhead
  // Each queue row takes 2 lines (compact layout)
  const visibleSlots = Math.max(3, Math.floor((terminalRows - 11) / 2));

  useEffect(() => {
    if (jobs.length === 0) {
      setSelectedIndex(0);
      setScrollOffset(0);
      return;
    }
    setSelectedIndex((prev) => Math.min(prev, jobs.length - 1));
  }, [jobs.length]);

  useEffect(() => {
    if (selectedIndex < scrollOffset) {
      setScrollOffset(selectedIndex);
    } else if (selectedIndex >= scrollOffset + visibleSlots) {
      setScrollOffset(selectedIndex - visibleSlots + 1);
    }
  }, [selectedIndex, scrollOffset, visibleSlots]);

  const selectedJob = jobs[selectedIndex];

  useInput((input, key) => {
    if (jobs.length === 0) return;

    if (key.upArrow || input === 'k') {
      setSelectedIndex((prev) => Math.max(0, prev - 1));
      return;
    }
    if (key.downArrow || input === 'j') {
      setSelectedIndex((prev) => Math.min(jobs.length - 1, prev + 1));
      return;
    }
    if (key.pageUp) {
      setSelectedIndex((prev) => Math.max(0, prev - visibleSlots));
      return;
    }
    if (key.pageDown) {
      setSelectedIndex((prev) => Math.min(jobs.length - 1, prev + visibleSlots));
      return;
    }

    if (!selectedJob) return;

    if (input === 'p') {
      if (selectedJob.status === 'paused') {
        core.queue.resumeJob(selectedJob.id);
        setStatusBanner(`Resumed: ${truncateText(selectedJob.title, 30)}`);
      } else if (
        selectedJob.status === 'downloading' ||
        selectedJob.status === 'pending' ||
        selectedJob.status === 'processing'
      ) {
        core.queue.pauseJob(selectedJob.id);
        setStatusBanner(`Paused: ${truncateText(selectedJob.title, 30)}`);
      }
    } else if (input === 'c') {
      if (core.queue.cancelJob(selectedJob.id)) {
        setStatusBanner(`Cancelled: ${truncateText(selectedJob.title, 30)}`);
      }
    } else if (input === 'r') {
      if (core.queue.retryJob(selectedJob.id)) {
        setStatusBanner(`Retrying: ${truncateText(selectedJob.title, 30)}`);
      }
    } else if (input === 'd') {
      if (core.queue.removeJob(selectedJob.id)) {
        setStatusBanner('Removed job from queue');
      }
    } else if (input === 'x') {
      const cleared = core.queue.clearFinished();
      setStatusBanner(`Cleared ${cleared} finished job(s)`);
    }
  });

  const visibleJobs = jobs.slice(scrollOffset, scrollOffset + visibleSlots);
  const rangeStart = jobs.length === 0 ? 0 : scrollOffset + 1;
  const rangeEnd = Math.min(jobs.length, scrollOffset + visibleJobs.length);

  return (
    <Box flexDirection="column" flexGrow={1}>
      <Box justifyContent="space-between" flexShrink={0}>
        <Text bold color="cyan" wrap="truncate-end">
          Download Queue ({jobs.length})
        </Text>
        <Text color="gray" wrap="truncate-end">
          ↑/↓ Scroll · [p] Pause/Resume · [c] Cancel · [r] Retry · [d] Del · [x] Clear
        </Text>
      </Box>

      {jobs.length === 0 ? (
        <Box marginTop={1}>
          <Text color="gray">
            Queue is empty. Press [n] or [2] to add a download.
          </Text>
        </Box>
      ) : (
        <Box flexDirection="column" flexGrow={1} marginTop={0}>
          {visibleJobs.map((job, offsetIdx) => {
            const actualIndex = scrollOffset + offsetIdx;
            const isSelected = actualIndex === selectedIndex;
            const prefix = isSelected ? '▶ ' : '  ';
            const playlistTag =
              job.playlistIndex && job.playlistTotal
                ? `[${job.playlistIndex}/${job.playlistTotal}] `
                : '';

            const sizeText =
              job.progress.totalBytes !== null
                ? `${formatBytes(job.progress.downloadedBytes)} / ${formatBytes(job.progress.totalBytes)}`
                : formatBytes(job.progress.downloadedBytes);

            return (
              <Box key={job.id} flexDirection="column">
                <Box justifyContent="space-between">
                  <Text
                    bold={isSelected}
                    color={isSelected ? 'cyan' : 'white'}
                    wrap="truncate-end"
                  >
                    {prefix}
                    {playlistTag}
                    {truncateText(job.title, 48)}
                  </Text>
                  <Text color={statusColor(job.status)} bold>
                    {job.status.toUpperCase()}
                  </Text>
                </Box>

                <Box justifyContent="space-between">
                  <Box>
                    <Text>  </Text>
                    <ProgressBar
                      percent={job.progress.percent}
                      width={20}
                      color={
                        job.status === 'failed'
                          ? 'red'
                          : job.status === 'paused'
                            ? 'magenta'
                            : 'green'
                      }
                    />
                  </Box>
                  <Text color="gray" wrap="truncate-end">
                    {job.errorMessage
                      ? truncateText(`Err: ${job.errorMessage}`, 42)
                      : `${sizeText} · ${formatSpeed(job.progress.speedBytesPerSec)} · ETA ${formatDuration(job.progress.etaSeconds)}`}
                  </Text>
                </Box>
              </Box>
            );
          })}
        </Box>
      )}

      {jobs.length > visibleSlots ? (
        <Box justifyContent="space-between" flexShrink={0}>
          <Text color="gray">
            Showing {rangeStart}–{rangeEnd} of {jobs.length}
          </Text>
          <Text color="gray">
            {scrollOffset > 0 ? '▲ More above ' : ''}
            {rangeEnd < jobs.length ? '▼ More below' : ''}
          </Text>
        </Box>
      ) : null}
    </Box>
  );
}
