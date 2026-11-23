import React, { useEffect, useState } from 'react';
import { Box, render, useApp, useInput, useStdout } from 'ink';
import type { VideoDLCore } from '../core/app-core.js';
import { Header } from './components/Header.js';
import { Sidebar } from './components/Sidebar.js';
import { StatusFooter } from './components/StatusFooter.js';
import { CoreProvider, type ScreenId, useCore } from './context/CoreContext.js';
import { HistoryScreen } from './screens/HistoryScreen.js';
import { HomeScreen } from './screens/HomeScreen.js';
import { NewDownloadScreen } from './screens/NewDownloadScreen.js';
import { QueueScreen } from './screens/QueueScreen.js';
import { SettingsScreen } from './screens/SettingsScreen.js';
import { SystemStatusScreen } from './screens/SystemStatusScreen.js';

const SCREEN_BY_KEY: Record<string, ScreenId> = {
  '1': 'home',
  '2': 'new-download',
  '3': 'queue',
  '4': 'history',
  '5': 'settings',
  '6': 'system-status',
};

const ENTER_ALT_SCREEN = '\x1b[?1049h\x1b[2J\x1b[H';
const EXIT_ALT_SCREEN = '\x1b[?1049l';

function useTerminalSize(): { columns: number; rows: number } {
  const { stdout } = useStdout();
  const [size, setSize] = useState({
    columns: stdout.columns || 80,
    rows: stdout.rows || 24,
  });

  useEffect(() => {
    const onResize = () => {
      setSize({
        columns: stdout.columns || 80,
        rows: stdout.rows || 24,
      });
    };
    stdout.on('resize', onResize);
    return () => {
      stdout.off('resize', onResize);
    };
  }, [stdout]);

  return size;
}

function DashboardShell(): React.JSX.Element {
  const { activeScreen, setActiveScreen, isInputFocused, setStatusBanner } =
    useCore();
  const { exit } = useApp();
  const { columns, rows } = useTerminalSize();

  useInput((input) => {
    if (isInputFocused) return;

    if (input === 'q') {
      exit();
      return;
    }

    if (input === 'n') {
      setStatusBanner(null);
      setActiveScreen('new-download');
      return;
    }

    const target = SCREEN_BY_KEY[input];
    if (target) {
      setStatusBanner(null);
      setActiveScreen(target);
    }
  });

  const renderScreen = () => {
    switch (activeScreen) {
      case 'home':
        return <HomeScreen />;
      case 'new-download':
        return <NewDownloadScreen />;
      case 'queue':
        return <QueueScreen />;
      case 'history':
        return <HistoryScreen />;
      case 'settings':
        return <SettingsScreen />;
      case 'system-status':
        return <SystemStatusScreen />;
    }
  };

  return (
    <Box
      flexDirection="column"
      width={columns}
      height={rows}
      overflow="hidden"
    >
      <Header />
      <Box flexGrow={1} gap={1} overflow="hidden">
        <Sidebar />
        <Box
          flexGrow={1}
          borderStyle="single"
          borderColor="gray"
          paddingX={1}
          flexDirection="column"
          overflow="hidden"
        >
          {renderScreen()}
        </Box>
      </Box>
      <StatusFooter />
    </Box>
  );
}

export async function launchTui(core: VideoDLCore): Promise<void> {
  if (!process.stdin.isTTY) {
    console.error(
      'Interactive TUI requires a TTY terminal. Run `videodl --help` for CLI commands.',
    );
    process.exitCode = 1;
    return;
  }

  let restored = false;
  const restoreScreen = () => {
    if (!restored) {
      restored = true;
      process.stdout.write(EXIT_ALT_SCREEN);
    }
  };

  process.stdout.write(ENTER_ALT_SCREEN);
  process.once('exit', restoreScreen);

  try {
    const instance = render(
      <CoreProvider core={core}>
        <DashboardShell />
      </CoreProvider>,
    );
    await instance.waitUntilExit();
  } finally {
    process.off('exit', restoreScreen);
    restoreScreen();
  }
}
