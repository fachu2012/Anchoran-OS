import { useEffect, useRef, useState } from "react";
import { Wallpaper } from "@/desktop/Wallpaper";
import { usePreferencesStore } from "@/theme/preferencesStore";
import { useProfilesStore } from "@/core/profilesStore";
import { usePinAttemptsStore } from "@/core/pinAttemptsStore";

const UNLOCK_ANIMATION_MS = 220;
const DEFAULT_AVATAR = new URL("../../assets/avatar/default-avatar.png", import.meta.url).href;

export function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  const username = usePreferencesStore((s) => s.username);
  const lockPin = usePreferencesStore((s) => s.lockPin);
  const avatarDataUrl = usePreferencesStore((s) => s.avatarDataUrl);
  const profiles = useProfilesStore((s) => s.profiles);
  const activeProfileId = useProfilesStore((s) => s.activeProfileId);
  const switchProfile = useProfilesStore((s) => s.switchProfile);
  const [now] = useState(new Date());
  const [unlocking, setUnlocking] = useState(false);
  const [pinPromptOpen, setPinPromptOpen] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState(false);
  const pinInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  function requestUnlock() {
    if (unlocking) return;
    setUnlocking(true);
    setTimeout(onUnlock, UNLOCK_ANIMATION_MS);
  }

  function selectProfile(id: string) {
    if (id === activeProfileId) return;
    switchProfile(id);
    setPinPromptOpen(false);
    setPinInput("");
  }

  function wake() {
    if (unlocking) return;
    if (lockPin) {
      setPinPromptOpen(true);
      setTimeout(() => pinInputRef.current?.focus(), 0);
    } else {
      requestUnlock();
    }
  }

  // One capture-phase guard for the whole time the lock screen is up:
  // the lock screen is only a visual overlay, not a real focus trap —
  // without this, a keystroke could still reach whatever real app
  // happened to have focus underneath (invisible behind the lock
  // screen), the Launcher included, since global shortcuts like the
  // Windows key/Ctrl+Alt+L still open it there. Anything not aimed at
  // the lock screen's own elements (the PIN field once it's open)
  // never reaches the desktop while locked. Without a PIN, any key
  // unlocks (matching the "press any key" hint below); with one,
  // Space opens the PIN entry the same as a click does.
  useEffect(() => {
    function guard(e: KeyboardEvent) {
      if (containerRef.current?.contains(e.target as Node)) return;
      e.stopPropagation();
      e.preventDefault();
      if (!lockPin || e.key === " " || e.key === "Spacebar") wake();
    }
    window.addEventListener("keydown", guard, true);
    return () => window.removeEventListener("keydown", guard, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lockPin]);

  useEffect(() => {
    if (!lockPin || pinInput.length !== lockPin.length) return;
    if (pinInput === lockPin) {
      requestUnlock();
    } else {
      setPinError(true);
      usePinAttemptsStore.getState().record();
      setTimeout(() => {
        setPinInput("");
        setPinError(false);
      }, 500);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pinInput, lockPin]);

  return (
    <div
      ref={containerRef}
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 1000,
        animation: unlocking
          ? `lock-out ${UNLOCK_ANIMATION_MS}ms cubic-bezier(0.4,0,1,1) forwards`
          : "lock-in 320ms cubic-bezier(0.16,1,0.3,1)",
      }}
      onClick={wake}
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
        {profiles.length > 1 && (
          <div style={{ display: "flex", gap: 14, marginTop: 50 }} onClick={(e) => e.stopPropagation()}>
            {profiles.map((p) => (
              <button
                key={p.id}
                onClick={() => selectProfile(p.id)}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 6,
                  background: "transparent",
                  border: "none",
                  color: "#fff",
                  cursor: "pointer",
                  opacity: p.id === activeProfileId ? 1 : 0.55,
                }}
              >
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: "50%",
                    background: `url(${p.avatarDataUrl || DEFAULT_AVATAR}) center/cover`,
                    border: p.id === activeProfileId ? "2px solid #fff" : "1px solid rgba(255,255,255,0.4)",
                  }}
                />
                <span style={{ fontSize: 11 }}>{p.name}</span>
              </button>
            ))}
          </div>
        )}
        {profiles.length <= 1 && (
          <div
            style={{
              marginTop: 60,
              width: 72,
              height: 72,
              borderRadius: "50%",
              background: `url(${avatarDataUrl || DEFAULT_AVATAR}) center/cover`,
              border: "1px solid rgba(255,255,255,0.3)",
            }}
          />
        )}
        <div style={{ fontSize: 14, marginTop: 6 }}>{username}</div>

        {!pinPromptOpen ? (
          <div style={{ fontSize: 12, opacity: 0.7, marginTop: 40 }}>
            {lockPin ? "Click to enter your PIN" : "Click or press any key to unlock"}
          </div>
        ) : (
          <div
            style={{ marginTop: 32, display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                gap: 10,
                animation: pinError ? "pin-shake 300ms ease" : undefined,
              }}
            >
              {Array.from({ length: Math.max(lockPin?.length ?? 4, pinInput.length) }).map((_, i) => (
                <div
                  key={i}
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: "50%",
                    border: "1px solid rgba(255,255,255,0.6)",
                    background: i < pinInput.length ? (pinError ? "#E0847D" : "#fff") : "transparent",
                  }}
                />
              ))}
            </div>
            <input
              ref={pinInputRef}
              type="password"
              inputMode="numeric"
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value.replace(/\D/g, "").slice(0, 8))}
              style={{
                opacity: 0,
                position: "absolute",
                width: 1,
                height: 1,
              }}
              autoFocus
            />
            <div style={{ fontSize: 11, opacity: 0.6 }}>Enter PIN</div>
          </div>
        )}
      </div>
      <style>{`
        @keyframes lock-in {
          from { opacity: 0; transform: scale(1.02); }
          to { opacity: 1; transform: none; }
        }
        @keyframes lock-out {
          from { opacity: 1; transform: none; }
          to { opacity: 0; transform: scale(1.02); }
        }
        @keyframes pin-shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-6px); }
          75% { transform: translateX(6px); }
        }
      `}</style>
    </div>
  );
}
