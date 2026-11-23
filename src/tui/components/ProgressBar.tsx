import React from 'react';
import { Text } from 'ink';
import { renderBar } from '../../cli/formatters.js';

export interface ProgressBarProps {
  percent: number;
  width?: number;
  color?: string;
}

export function ProgressBar({
  percent,
  width = 24,
  color = 'green',
}: ProgressBarProps): React.JSX.Element {
  const bar = renderBar(percent, width);
  return (
    <Text>
      <Text color="gray">[</Text>
      <Text color={color}>{bar}</Text>
      <Text color="gray">]</Text>
      <Text> {percent.toFixed(1).padStart(5, ' ')}%</Text>
    </Text>
  );
}
