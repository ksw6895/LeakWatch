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
      <span className="lw-eyebrow">Command Center</span>
      <div className="lw-title">
        <Text as="h2" variant="headingLg">
          Shopify Auth + LeakWatch Ops
        </Text>
      </div>
      <div className="lw-subtitle">
        <Text as="p" variant="bodyMd">
          Every store signal in one place: connect, verify session token, upload evidence, and chase
          savings.
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
            Authenticate store
          </Button>
          <Button onClick={onCallApi} disabled={!host}>
            Verify session token
          </Button>
        </div>
      </Box>
    </div>
  );
}
