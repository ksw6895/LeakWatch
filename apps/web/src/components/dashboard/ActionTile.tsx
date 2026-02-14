type ActionTileProps = {
  label: string;
  hint: string;
  onClick: () => void;
};

export function ActionTile({ label, hint, onClick }: ActionTileProps) {
  return (
    <button type="button" className="lw-action-tile" onClick={onClick}>
      <span className="lw-action-tile-row">
        <span className="lw-action-copy">
          <span className="lw-action-title">{label}</span>
          <span className="lw-action-hint">{hint}</span>
        </span>
        <span className="lw-action-icon" aria-hidden="true">
          →
        </span>
      </span>
    </button>
  );
}
