type ActionTileProps = {
  label: string;
  hint: string;
  onClick: () => void;
};

export function ActionTile({ label, hint, onClick }: ActionTileProps) {
  return (
    <button type="button" className="lw-action-tile" onClick={onClick}>
      <span className="lw-action-title">{label}</span>
      <span className="lw-action-hint">{hint}</span>
    </button>
  );
}
