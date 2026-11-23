import React from 'react';
import { Box, Text } from 'ink';
import { useCore } from '../context/CoreContext.js';

export function Header(): React.JSX.Element {
  const { jobs, dependencyReport, settings } = useCore();

  const activeCount = jobs.filter(
    (j) =>
      j.status === 'downloading' ||
      j.status === 'processing' ||
      j.status === 'fetching_metadata',
  ).length;
  const pendingCount = jobs.filter((j) => j.status === 'pending').length;

  const depsOk = dependencyReport?.allRequiredMet ?? null;

  return (
    <Box
      borderStyle="round"
      borderColor="cyan"
      paddingX={1}
      justifyContent="space-between"
      flexShrink={0}
    >
      <Text wrap="truncate-end">
        <Text bold color="cyan">
          VideoDL
        </Text>
        <Text color="gray"> · {settings.maxResolution} {settings.outputContainer.toUpperCase()}</Text>
      </Text>
      <Text wrap="truncate-end">
        <Text color="gray">Active: </Text>
        <Text color={activeCount > 0 ? 'green' : 'white'}>{activeCount}</Text>
        <Text color="gray"> · Queue: </Text>
        <Text color={pendingCount > 0 ? 'yellow' : 'white'}>{pendingCount}</Text>
        <Text color="gray"> · Deps: </Text>
        {depsOk === null ? (
          <Text color="yellow">…</Text>
        ) : depsOk ? (
          <Text color="green">OK</Text>
        ) : (
          <Text color="red">MISSING</Text>
        )}
      </Text>
    </Box>
  );
}
