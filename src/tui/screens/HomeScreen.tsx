import React from 'react';
import { Box, Text } from 'ink';
import { formatSpeed, truncateText } from '../../cli/formatters.js';
import { ProgressBar } from '../components/ProgressBar.js';
import { useCore } from '../context/CoreContext.js';

export function HomeScreen(): React.JSX.Element {
  const { jobs, history, settings, dependencyReport } = useCore();

  const activeJobs = jobs.filter(
    (j) =>
      j.status === 'downloading' ||
      j.status === 'processing' ||
      j.status === 'fetching_metadata',
  );
  const pendingCount = jobs.filter((j) => j.status === 'pending').length;
  const pausedCount = jobs.filter((j) => j.status === 'paused').length;
  const completedHistoryCount = history.filter(
    (h) => h.status === 'completed',
  ).length;

  return (
    <Box flexDirection="column" gap={1}>
      <Text bold color="cyan">
        Dashboard Overview
      </Text>

      <Box gap={1}>
        <Box
          borderStyle="round"
          borderColor="green"
          paddingX={1}
          flexDirection="column"
          flexGrow={1}
          flexBasis={0}
        >
          <Text color="gray" wrap="truncate-end">
            Active / Queued
          </Text>
          <Text bold wrap="truncate-end">
            {activeJobs.length} active · {pendingCount} pending
          </Text>
          <Text color="gray" wrap="truncate-end">
            {pausedCount} paused
          </Text>
        </Box>

        <Box
          borderStyle="round"
          borderColor="blue"
          paddingX={1}
          flexDirection="column"
          flexGrow={1}
          flexBasis={0}
        >
          <Text color="gray" wrap="truncate-end">
            History
          </Text>
          <Text bold wrap="truncate-end">
            {completedHistoryCount} completed
          </Text>
          <Text color="gray" wrap="truncate-end">
            {history.length} total
          </Text>
        </Box>

        <Box
          borderStyle="round"
          borderColor="magenta"
          paddingX={1}
          flexDirection="column"
          flexGrow={1}
          flexBasis={0}
        >
          <Text color="gray" wrap="truncate-end">
            Default Profile
          </Text>
          <Text bold wrap="truncate-end">
            {settings.maxResolution} · {settings.outputContainer.toUpperCase()}
          </Text>
          <Text color="gray" wrap="truncate-end">
            Max parallel: {settings.maxConcurrentDownloads}
          </Text>
        </Box>
      </Box>

      {dependencyReport && !dependencyReport.allRequiredMet ? (
        <Box borderStyle="single" borderColor="red" paddingX={1} flexDirection="column">
          <Text bold color="red">
            Missing Required Dependencies
          </Text>
          <Text wrap="truncate-end">
            Press [6] for missing tools and Fedora install instructions.
          </Text>
        </Box>
      ) : null}

      <Box flexDirection="column">
        <Text bold color="white">
          Active Downloads
        </Text>
        {activeJobs.length === 0 ? (
          <Text color="gray" wrap="truncate-end">
            No active downloads. Press [n] or [2] to start a new download.
          </Text>
        ) : (
          activeJobs.slice(0, 4).map((job) => (
            <Box key={job.id} flexDirection="column">
              <Box justifyContent="space-between">
                <Text wrap="truncate-end">{truncateText(job.title, 40)}</Text>
                <Text color="cyan">{formatSpeed(job.progress.speedBytesPerSec)}</Text>
              </Box>
              <ProgressBar percent={job.progress.percent} width={24} />
            </Box>
          ))
        )}
      </Box>

      <Text color="gray" wrap="truncate-end">
        [n] New Download · [3] Queue · [4] History · [5] Settings · [6] Deps
      </Text>
    </Box>
  );
}
