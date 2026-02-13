import { Text } from '@shopify/polaris';

export function MetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="lw-metric lw-metric--compact">
      <div className="lw-metric-label">{label}</div>
      <div className="lw-metric-value">{value}</div>
      {hint ? (
        <Text as="p" variant="bodySm" tone="subdued">
          {hint}
        </Text>
      ) : null}
    </div>
  );
}
