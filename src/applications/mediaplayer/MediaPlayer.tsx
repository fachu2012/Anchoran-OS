import { useMemo, useState } from "react";
import { Icon } from "@/components/Icon";
import { useFsStore, ROOT_ID, TRASH_ID } from "@/filesystem/fs";
import { useNotificationStore } from "@/notifications/notificationStore";
import "@/applications/apps.css";
import "./mediaplayer.css";

export function MediaPlayerApp() {
  const nodes = useFsStore((s) => s.nodes);
  const createFile = useFsStore((s) => s.createFile);
  const pushNotification = useNotificationStore((s) => s.push);
  const [activeId, setActiveId] = useState<string | null>(null);

  const items = useMemo(
    () =>
      Object.values(nodes).filter(
        (n) =>
          n.type === "file" &&
          n.parentId !== TRASH_ID &&
          (n.content?.startsWith("data:audio") || n.content?.startsWith("data:video"))
      ),
    [nodes]
  );

  const active = items.find((n) => n.id === activeId) ?? items[0];
  const isVideo = active?.content?.startsWith("data:video");

  async function importMedia() {
    if (!window.anchoran) return;
    const result = await window.anchoran.importMedia();
    if (result && "dataUrl" in result) {
      const id = createFile(ROOT_ID, result.fileName, result.dataUrl);
      setActiveId(id);
    } else if (result && "error" in result) {
      pushNotification("Media Player", result.error);
    }
  }

  return (
    <div className="app-root">
      <div className="app-toolbar">
        <button className="app-toolbar-btn" onClick={importMedia}>
          <Icon name="mediaPlayer" size={14} /> Import from Windows…
        </button>
      </div>
      <div className="app-content mediaplayer-content">
        <div className="mediaplayer-list">
          {items.length === 0 && (
            <div style={{ color: "var(--anchoran-text-secondary)", fontSize: 12.5, padding: 8 }}>
              No media yet — import a file, or record a voice memo.
            </div>
          )}
          {items.map((item) => (
            <button
              key={item.id}
              className="mediaplayer-item"
              data-active={item.id === active?.id}
              onClick={() => setActiveId(item.id)}
            >
              <Icon name={item.content?.startsWith("data:video") ? "photoViewer" : "mediaPlayer"} size={15} />
              <span>{item.name}</span>
            </button>
          ))}
        </div>
        <div className="mediaplayer-stage">
          {active ? (
            isVideo ? (
              <video src={active.content} controls key={active.id} />
            ) : (
              <div className="mediaplayer-audio">
                <Icon name="mediaPlayer" size={48} />
                <div className="mediaplayer-title">{active.name}</div>
                <audio src={active.content} controls key={active.id} />
              </div>
            )
          ) : (
            <div style={{ color: "var(--anchoran-text-secondary)", fontSize: 12.5 }}>Nothing selected.</div>
          )}
        </div>
      </div>
    </div>
  );
}
