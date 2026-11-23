import React from 'react';
import { Box, Text } from 'ink';
import { useCore } from '../context/CoreContext.js';

export function StatusFooter(): React.JSX.Element {
  const { isInputFocused, statusBanner } = useCore();

  return (
    <Box
      borderStyle="single"
      borderColor="gray"
      paddingX={1}
      justifyContent="space-between"
      flexShrink={0}
    >
      <Text color="gray" wrap="truncate-end">
        {isInputFocused
          ? 'Input: Type · Tab/↑↓ Move · Esc Exit Input'
          : '1-6 Screen · n New · q Quit'}
      </Text>
      {statusBanner ? (
        <Text color="yellow" wrap="truncate-end">
          {statusBanner}
        </Text>
      ) : null}
    </Box>
  );
}
