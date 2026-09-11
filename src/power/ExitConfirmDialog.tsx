import "./power.css";

export function ExitConfirmDialog({ onCancel, onExit }: { onCancel: () => void; onExit: () => void }) {
  return (
    <div className="power-backdrop">
      <div className="confirm-panel">
        <div className="confirm-title">Exit Anchoran?</div>
        <div className="confirm-actions">
          <button className="confirm-btn cancel" onClick={onCancel}>
            Cancel
          </button>
          <button className="confirm-btn exit" onClick={onExit}>
            Exit
          </button>
        </div>
      </div>
    </div>
  );
}
