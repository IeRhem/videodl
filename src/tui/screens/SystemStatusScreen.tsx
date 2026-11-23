import React from 'react';
import { Box, Text, useInput } from 'ink';
import { useCore } from '../context/CoreContext.js';

export function SystemStatusScreen(): React.JSX.Element {
  const { dependencyReport, refreshDependencies, setStatusBanner } = useCore();

  useInput((input) => {
    if (input === 'r') {
      setStatusBanner('Re-checking system dependencies...');
      void refreshDependencies().then(() => {
        setStatusBanner('Dependency check complete');
      });
    }
  });

  return (
    <Box flexDirection="column" gap={1}>
      <Box justifyContent="space-between">
        <Text bold color="cyan">
          System Dependency Status
        </Text>
        <Text color="gray">[r] Re-run Checks</Text>
      </Box>

      {!dependencyReport ? (
        <Text color="yellow">Checking installed tools...</Text>
      ) : (
        <Box flexDirection="column" gap={0}>
          {dependencyReport.results.map((dep) => (
            <Box
              key={dep.name}
              flexDirection="column"
              borderStyle="single"
              borderColor={dep.installed ? 'green' : dep.required ? 'red' : 'yellow'}
              paddingX={1}
            >
              <Box justifyContent="space-between">
                <Text bold>
                  {dep.displayName}{' '}
                  <Text color="gray">
                    ({dep.required ? 'Required' : 'Optional'})
                  </Text>
                </Text>
                <Text
                  bold
                  color={dep.installed ? 'green' : dep.required ? 'red' : 'yellow'}
                >
                  {dep.installed ? 'INSTALLED' : 'MISSING'}
                </Text>
              </Box>
              <Text color="gray">
                Version: {dep.version ?? '—'} · Path: {dep.path ?? '—'}
              </Text>
              {!dep.installed ? (
                <Text color="yellow">Install: {dep.installHint}</Text>
              ) : null}
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}
