import React from 'react';
import { Box, Text } from 'ink';
import { type ScreenId, useCore } from '../context/CoreContext.js';

export interface NavItem {
  id: ScreenId;
  keyHint: string;
  label: string;
}

export const NAV_ITEMS: readonly NavItem[] = [
  { id: 'home', keyHint: '1', label: 'Home' },
  { id: 'new-download', keyHint: '2', label: 'New Download' },
  { id: 'queue', keyHint: '3', label: 'Queue' },
  { id: 'history', keyHint: '4', label: 'History' },
  { id: 'settings', keyHint: '5', label: 'Settings' },
  { id: 'system-status', keyHint: '6', label: 'Dependencies' },
];

export function Sidebar(): React.JSX.Element {
  const { activeScreen, jobs } = useCore();
  const queueCount = jobs.filter(
    (j) =>
      j.status === 'downloading' ||
      j.status === 'pending' ||
      j.status === 'processing' ||
      j.status === 'paused',
  ).length;

  return (
    <Box
      flexDirection="column"
      width={21}
      flexShrink={0}
      borderStyle="single"
      borderColor="gray"
      paddingX={1}
      paddingY={0}
    >
      <Text bold color="gray">
        NAVIGATION
      </Text>
      <Box marginTop={1} flexDirection="column">
        {NAV_ITEMS.map((item) => {
          const isActive = item.id === activeScreen;
          const badge =
            item.id === 'queue' && queueCount > 0 ? ` (${queueCount})` : '';
          return (
            <Box key={item.id} marginBottom={0}>
              <Text
                bold={isActive}
                color={isActive ? 'cyan' : 'white'}
                inverse={isActive}
              >
                {` [${item.keyHint}] ${item.label}${badge} `}
              </Text>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
