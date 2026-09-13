import { Icon } from "@/components/Icon";
import "./power.css";

export function PowerMenu({
  onClose,
  onShutDown,
  onRestart,
  onLock,
  onSleep,
  onSignOut,
}: {
  onClose: () => void;
  onShutDown: () => void;
  onRestart: () => void;
  onLock: () => void;
  onSleep: () => void;
  onSignOut: () => void;
}) {
  return (
    <div className="power-backdrop" onClick={onClose}>
      <div className="power-panel" onClick={(e) => e.stopPropagation()}>
        <button className="power-item" onClick={onLock}>
          <Icon name="lock" size={16} /> Lock
        </button>
        <button className="power-item" onClick={onSignOut}>
          <Icon name="userSwitch" size={16} /> Sign out
        </button>
        <button className="power-item" onClick={onSleep}>
          <Icon name="minimize" size={16} /> Sleep
        </button>
        <button className="power-item" onClick={onRestart}>
          <Icon name="restart" size={16} /> Restart Anchoran
        </button>
        <button className="power-item" onClick={onShutDown}>
          <Icon name="power" size={16} /> Shut Down Anchoran
        </button>
      </div>
    </div>
  );
}
