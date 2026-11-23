import React, { useEffect, useState } from 'react';
import { Box, Text, useInput, useStdout } from 'ink';
import { truncateText } from '../../cli/formatters.js';
import { useCore } from '../context/CoreContext.js';

export function HistoryScreen(): React.JSX.Element {
  const { core, history, refreshHistory, setStatusBanner, setActiveScreen } =
    useCore();
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

  useEffect(() => {
    refreshHistory();
  }, [refreshHistory]);

  const visibleSlots = Math.max(4, terminalRows - 13);

  useEffect(() => {
    if (history.length === 0) {
      setSelectedIndex(0);
      setScrollOffset(0);
    } else if (selectedIndex >= history.length) {
      setSelectedIndex(history.length - 1);
    }
  }, [history.length, selectedIndex]);

  useEffect(() => {
    if (selectedIndex < scrollOffset) {
      setScrollOffset(selectedIndex);
    } else if (selectedIndex >= scrollOffset + visibleSlots) {
      setScrollOffset(selectedIndex - visibleSlots + 1);
    }
  }, [selectedIndex, scrollOffset, visibleSlots]);

  useInput((input, key) => {
    if (key.upArrow || input === 'k') {
      setSelectedIndex((prev) => Math.max(0, prev - 1));
      return;
    }
    if (key.downArrow || input === 'j') {
      setSelectedIndex((prev) => Math.min(history.length - 1, prev + 1));
      return;
    }
    if (key.pageUp) {
      setSelectedIndex((prev) => Math.max(0, prev - visibleSlots));
      return;
    }
    if (key.pageDown) {
      setSelectedIndex((prev) =>
        Math.min(history.length - 1, prev + visibleSlots),
      );
      return;
    }

    if (input === 'c') {
      const removed = core.history.clearHistory();
      refreshHistory();
      setStatusBanner(`Cleared ${removed} history record(s)`);
      return;
    }

    const selected = history[selectedIndex];
    if (input === 'r' && selected) {
      void core.downloads.downloadSingleUrl(selected.url).then((res) => {
        setStatusBanner(
          res.duplicate
            ? `Already queued: ${res.job.title}`
            : `Re-queued: ${res.job.title}`,
        );
        setActiveScreen('queue');
      });
    }
  });

  const visibleHistory = history.slice(scrollOffset, scrollOffset + visibleSlots);
  const selectedRecord = history[selectedIndex];

  return (
    <Box flexDirection="column" flexGrow={1}>
      <Box justifyContent="space-between" flexShrink={0}>
        <Text bold color="cyan" wrap="truncate-end">
          Download History ({history.length})
        </Text>
        <Text color="gray" wrap="truncate-end">
          ↑/↓ Scroll · [r] Re-queue · [c] Clear History
        </Text>
      </Box>

      {history.length === 0 ? (
        <Box marginTop={1}>
          <Text color="gray">No completed or failed downloads recorded yet.</Text>
        </Box>
      ) : (
        <Box flexDirection="column" flexGrow={1}>
          {visibleHistory.map((rec, offsetIdx) => {
            const actualIdx = scrollOffset + offsetIdx;
            const isSelected = actualIdx === selectedIndex;
            const dateStr = rec.completedAt.replace('T', ' ').slice(0, 16);
            const badgeColor =
              rec.status === 'completed'
                ? 'green'
                : rec.status === 'cancelled'
                  ? 'yellow'
                  : 'red';
            return (
              <Box key={rec.id} justifyContent="space-between">
                <Text
                  bold={isSelected}
                  color={isSelected ? 'cyan' : 'white'}
                  wrap="truncate-end"
                >
                  {isSelected ? '▶ ' : '  '}
                  {truncateText(rec.title, 40)}
                </Text>
                <Box gap={1} flexShrink={0}>
                  <Text color="cyan">{rec.format}</Text>
                  <Text color={badgeColor} bold>
                    {rec.status.toUpperCase()}
                  </Text>
                  <Text color="gray">{dateStr}</Text>
                </Box>
              </Box>
            );
          })}
        </Box>
      )}

      {selectedRecord ? (
        <Box flexDirection="column" flexShrink={0}>
          <Text color="gray" wrap="truncate-end">
            Source: {selectedRecord.sourceExtractor} · Dest:{' '}
            {selectedRecord.destinationPath}
          </Text>
          {selectedRecord.errorMessage ? (
            <Text color="red" wrap="truncate-end">
              Error: {selectedRecord.errorMessage}
            </Text>
          ) : null}
        </Box>
      ) : null}
    </Box>
  );
}
