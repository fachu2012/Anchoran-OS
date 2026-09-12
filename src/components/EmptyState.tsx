import { Icon, type IconName } from "./Icon";

/** A shared "nothing here yet" pattern — see the `.empty-state` rules in apps.css. */
export function EmptyState({ icon, title, description }: { icon: IconName; title: string; description?: string }) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">
        <Icon name={icon} size={32} />
      </div>
      <div className="empty-state-title">{title}</div>
      {description && <div className="empty-state-desc">{description}</div>}
    </div>
  );
}
