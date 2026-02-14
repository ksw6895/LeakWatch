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
    <div className="lw-card lw-metric-card">
      <div>
        <div className="lw-metric-label">{label}</div>
        <div className="lw-metric-value">{value}</div>
      </div>
      {hint ? <div className="lw-metric-hint">{hint}</div> : null}
    </div>
  );
}
