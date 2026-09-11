import { useEffect, useState } from "react";
import { Wallpaper } from "@/desktop/Wallpaper";
import { usePreferencesStore } from "@/theme/preferencesStore";

export function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  const username = usePreferencesStore((s) => s.username);
  const [now] = useState(new Date());

  useEffect(() => {
    window.addEventListener("keydown", onUnlock, { once: true });
    return () => window.removeEventListener("keydown", onUnlock);
  }, [onUnlock]);

  return (
    <div
      style={{ position: "absolute", inset: 0, zIndex: 1000 }}
      onClick={onUnlock}
      onKeyDown={onUnlock}
      tabIndex={0}
      role="button"
      aria-label="Unlock Anchoran"
    >
      <Wallpaper />
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          color: "#fff",
          textShadow: "0 2px 12px rgba(0,0,0,0.4)",
        }}
      >
        <div style={{ fontSize: 72, fontWeight: 300, fontVariantNumeric: "tabular-nums" }}>
          {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </div>
        <div style={{ fontSize: 16, opacity: 0.85 }}>
          {now.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })}
        </div>
        <div
          style={{
            marginTop: 60,
            width: 72,
            height: 72,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.15)",
            border: "1px solid rgba(255,255,255,0.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 22,
          }}
        >
          {username.slice(0, 1).toUpperCase()}
        </div>
        <div style={{ fontSize: 14, marginTop: 6 }}>{username}</div>
        <div style={{ fontSize: 12, opacity: 0.7, marginTop: 40 }}>Click or press any key to unlock</div>
      </div>
    </div>
  );
}
