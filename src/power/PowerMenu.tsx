import { Icon } from "@/components/Icon";
import "./power.css";

export function PowerMenu({
  onClose,
  onShutDown,
  onRestart,
  onLock,
  onSleep,
}: {
  onClose: () => void;
  onShutDown: () => void;
  onRestart: () => void;
  onLock: () => void;
  onSleep: () => void;
}) {
  return (
    <div className="power-backdrop" onClick={onClose}>
      <div className="power-panel" onClick={(e) => e.stopPropagation()}>
        <button className="power-item" onClick={onLock}>
          <Icon name="lock" size={16} /> Lock
        </button>
        <button className="power-item" onClick={onSleep}>
          <Icon name="minimize" size={16} /> Sleep
        </button>
        <button className="power-item" onClick={onRestart}>
          <Icon name="restore" size={16} /> Restart Anchoran
        </button>
        <button className="power-item" onClick={onShutDown}>
          <Icon name="power" size={16} /> Shut Down Anchoran
        </button>
      </div>
    </div>
  );
}
