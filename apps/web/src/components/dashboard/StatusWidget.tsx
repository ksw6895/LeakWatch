import { Box, Button, Text } from '@shopify/polaris';

export function StatusWidget({
  shop,
  host,
  apiStatus,
  onAuthenticate,
  onCallApi,
}: {
  shop: string | null;
  host: string | null;
  apiStatus: string;
  onAuthenticate: () => void;
  onCallApi: () => void;
}) {
  return (
    <div className="lw-hero">
      <span className="lw-eyebrow">Dashboard</span>
      <div className="lw-title">
        <Text as="h2" variant="headingLg">
          Subscription intelligence at a glance
        </Text>
      </div>
      <div className="lw-subtitle">
        <Text as="p" variant="bodyMd">
          Validate your embedded session, then move to uploads, leaks, and actions.
        </Text>
      </div>
      <Box paddingBlockStart="200">
        <span className="lw-inline-chip lw-inline-chip--strong">shop: {shop ?? 'missing'}</span>{' '}
        <span className="lw-inline-chip">host: {host ?? 'missing'}</span>{' '}
        <span className="lw-inline-chip">API call: {apiStatus}</span>
      </Box>
      <Box paddingBlockStart="300">
        <div className="lw-actions-row">
          <Button variant="primary" onClick={onAuthenticate} disabled={!shop}>
            Re-authenticate
          </Button>
          <Button onClick={onCallApi} disabled={!host}>
            Verify session
          </Button>
        </div>
      </Box>
    </div>
  );
}
