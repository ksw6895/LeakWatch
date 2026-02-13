'use client';

import { Box, Button, Text } from '@shopify/polaris';

type StateKind = 'loading' | 'empty' | 'error';

type StatePanelProps = {
  kind: StateKind;
  title?: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function StatePanel({ kind, title, message, actionLabel, onAction }: StatePanelProps) {
  return (
    <div
      className={`lw-state-panel lw-state-panel--${kind}`}
      role={kind === 'error' ? 'alert' : 'status'}
    >
      <Text as="h3" variant="headingSm">
        {title ??
          (kind === 'loading' ? 'Loading' : kind === 'empty' ? 'No data yet' : 'Something failed')}
      </Text>
      <Box paddingBlockStart="100">
        <Text as="p" variant="bodySm" tone={kind === 'error' ? 'critical' : 'subdued'}>
          {message}
        </Text>
      </Box>
      {actionLabel && onAction ? (
        <Box paddingBlockStart="200">
          <Button onClick={onAction}>{actionLabel}</Button>
        </Box>
      ) : null}
    </div>
  );
}
