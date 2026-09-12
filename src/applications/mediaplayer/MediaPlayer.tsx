import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { useNotificationStore } from "@/notifications/notificationStore";
import { useVolumeMixerStore } from "@/desktop/volumeMixerStore";
import "@/applications/apps.css";
import "./mediaplayer.css";

const AUDIO_EXT = new Set([".mp3", ".wav", ".ogg", ".m4a"]);
const VIDEO_EXT = new Set([".mp4", ".webm"]);

interface MediaItem {
  name: string;
  path: string;
  isVideo: boolean;
}

function toFileUrl(filePath: string) {
  return "file:///" + encodeURI(filePath.replace(/\\/g, "/"));
}

export function MediaPlayerApp() {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [activePath, setActivePath] = useState<string | null>(null);
  const pushNotification = useNotificationStore((s) => s.push);
  const mixerLevel = useVolumeMixerStore((s) => s.getLevel("mediaPlayer"));
  const mediaRef = useRef<HTMLMediaElement>(null);

  useEffect(() => {
    const el = mediaRef.current;
    if (el) {
      el.volume = mixerLevel.volume;
      el.muted = mixerLevel.muted;
    }
  }, [mixerLevel, activePath]);

  async function refresh() {
    if (!window.anchoran) return;
    const folders = await window.anchoran.fsSpecialFolders();
    const [musicResult, videosResult] = await Promise.all([
      window.anchoran.fsListDir(folders.music),
      window.anchoran.fsListDir(folders.videos),
    ]);
    const collected: MediaItem[] = [];
    if (!("error" in musicResult)) {
      for (const e of musicResult.entries) {
        const ext = e.name.slice(e.name.lastIndexOf(".")).toLowerCase();
        if (!e.isDirectory && AUDIO_EXT.has(ext)) collected.push({ name: e.name, path: e.path, isVideo: false });
      }
    }
    if (!("error" in videosResult)) {
      for (const e of videosResult.entries) {
        const ext = e.name.slice(e.name.lastIndexOf(".")).toLowerCase();
        if (!e.isDirectory && VIDEO_EXT.has(ext)) collected.push({ name: e.name, path: e.path, isVideo: true });
      }
    }
    setItems(collected);
  }

  useEffect(() => {
    refresh();
  }, []);

  const active = items.find((i) => i.path === activePath) ?? items[0];

  async function importMedia() {
    if (!window.anchoran) return;
    const result = await window.anchoran.importMedia();
    if (result && "dataUrl" in result) {
      const isVideo = result.dataUrl.startsWith("data:video");
      const folders = await window.anchoran.fsSpecialFolders();
      const targetDir = isVideo ? folders.videos : folders.music;
      const write = await window.anchoran.fsWriteDataUrl(targetDir, result.fileName, result.dataUrl);
      if ("error" in write) {
        pushNotification("Media Player", write.error);
        return;
      }
      await refresh();
      setActivePath(write.path);
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
              No media yet — import a file, or record a voice memo / screen recording.
            </div>
          )}
          {items.map((item) => (
            <button key={item.path} className="mediaplayer-item" data-active={item.path === active?.path} onClick={() => setActivePath(item.path)}>
              <Icon name={item.isVideo ? "photoViewer" : "mediaPlayer"} size={15} />
              <span>{item.name}</span>
            </button>
          ))}
        </div>
        <div className="mediaplayer-stage">
          {active ? (
            active.isVideo ? (
              <video ref={mediaRef as never} src={toFileUrl(active.path)} controls key={active.path} />
            ) : (
              <div className="mediaplayer-audio">
                <Icon name="mediaPlayer" size={48} />
                <div className="mediaplayer-title">{active.name}</div>
                <audio ref={mediaRef as never} src={toFileUrl(active.path)} controls key={active.path} />
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
