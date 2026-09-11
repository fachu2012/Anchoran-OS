import { useState } from "react";
import { usePreferencesStore } from "@/theme/preferencesStore";
import { WALLPAPERS } from "@/desktop/wallpapers";
import "./onboarding.css";

const ANCHORAN_LOGO = new URL("../../assets/logo/anchoran-logo.svg", import.meta.url).href;

type Step = "welcome" | "username" | "pin" | "avatar" | "wallpaper" | "finish";
const STEPS: Step[] = ["welcome", "username", "pin", "avatar", "wallpaper", "finish"];

/**
 * Anchoran's first-run welcome wizard — shown once, the first time the
 * OS boots after installing, before the desktop appears (comparable to
 * Windows' own OOBE). Every step but the welcome/finish bookends can be
 * skipped; nothing here is a hard requirement to use Anchoran.
 */
export function Onboarding({ onComplete }: { onComplete: () => void }) {
  const [stepIndex, setStepIndex] = useState(0);
  const step = STEPS[stepIndex];
  const prefs = usePreferencesStore();

  const [usernameDraft, setUsernameDraft] = useState(prefs.username === "user" ? "" : prefs.username);
  const [pinDraft, setPinDraft] = useState("");
  const [pinConfirmDraft, setPinConfirmDraft] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);

  function next() {
    if (stepIndex < STEPS.length - 1) setStepIndex(stepIndex + 1);
    else finish();
  }
  function skip() {
    next();
  }
  function finish() {
    prefs.completeOnboarding();
    onComplete();
  }

  async function importAvatar() {
    const result = await window.anchoran?.importImage();
    if (result && "dataUrl" in result) prefs.setAvatar(result.dataUrl);
  }
  async function importWallpaper() {
    const result = await window.anchoran?.importImage();
    if (result && "dataUrl" in result) prefs.setCustomWallpaper(result.dataUrl);
  }

  return (
    <div className="onboarding-root">
      <div className="onboarding-card">
        <img src={ANCHORAN_LOGO} alt="" width={44} height={44} className="onboarding-logo" />

        {step === "welcome" && (
          <>
            <h1 className="onboarding-title">Welcome to Anchoran OS</h1>
            <p className="onboarding-body">Let's set up your account. This only takes a minute — every step can be skipped.</p>
            <div className="onboarding-actions">
              <button className="onboarding-btn onboarding-btn-primary" onClick={next}>
                Get started
              </button>
            </div>
          </>
        )}

        {step === "username" && (
          <>
            <h1 className="onboarding-title">What should we call you?</h1>
            <input
              className="onboarding-input"
              value={usernameDraft}
              placeholder="Your name"
              autoFocus
              onChange={(e) => setUsernameDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && usernameDraft.trim() && (prefs.setUsername(usernameDraft.trim()), next())}
            />
            <div className="onboarding-actions">
              <button className="onboarding-btn" onClick={skip}>
                Skip
              </button>
              <button
                className="onboarding-btn onboarding-btn-primary"
                disabled={!usernameDraft.trim()}
                onClick={() => {
                  prefs.setUsername(usernameDraft.trim());
                  next();
                }}
              >
                Next
              </button>
            </div>
          </>
        )}

        {step === "pin" && (
          <>
            <h1 className="onboarding-title">Set a lock screen PIN</h1>
            <p className="onboarding-body">Optional — keeps Anchoran locked until you enter it.</p>
            <input
              className="onboarding-input"
              type="password"
              inputMode="numeric"
              placeholder="4+ digits"
              value={pinDraft}
              onChange={(e) => {
                setPinDraft(e.target.value.replace(/\D/g, "").slice(0, 8));
                setPinError(null);
              }}
            />
            <input
              className="onboarding-input"
              type="password"
              inputMode="numeric"
              placeholder="Confirm PIN"
              value={pinConfirmDraft}
              onChange={(e) => {
                setPinConfirmDraft(e.target.value.replace(/\D/g, "").slice(0, 8));
                setPinError(null);
              }}
            />
            {pinError && <div className="onboarding-error">{pinError}</div>}
            <div className="onboarding-actions">
              <button className="onboarding-btn" onClick={skip}>
                Skip
              </button>
              <button
                className="onboarding-btn onboarding-btn-primary"
                onClick={() => {
                  if (!pinDraft && !pinConfirmDraft) {
                    next();
                    return;
                  }
                  if (pinDraft.length < 4) {
                    setPinError("PIN must be at least 4 digits.");
                    return;
                  }
                  if (pinDraft !== pinConfirmDraft) {
                    setPinError("PINs don't match.");
                    return;
                  }
                  prefs.setLockPin(pinDraft);
                  next();
                }}
              >
                Next
              </button>
            </div>
          </>
        )}

        {step === "avatar" && (
          <>
            <h1 className="onboarding-title">Add a profile picture</h1>
            <p className="onboarding-body">Optional — shown on your lock screen.</p>
            <div
              className="onboarding-avatar"
              style={prefs.avatarDataUrl ? { backgroundImage: `url(${prefs.avatarDataUrl})` } : undefined}
            >
              {!prefs.avatarDataUrl && usernameDraft.slice(0, 1).toUpperCase()}
            </div>
            <button className="onboarding-btn" onClick={importAvatar}>
              Import from Windows…
            </button>
            <div className="onboarding-actions">
              <button className="onboarding-btn" onClick={skip}>
                Skip
              </button>
              <button className="onboarding-btn onboarding-btn-primary" onClick={next}>
                Next
              </button>
            </div>
          </>
        )}

        {step === "wallpaper" && (
          <>
            <h1 className="onboarding-title">Choose a wallpaper</h1>
            <div className="onboarding-wallpapers">
              {WALLPAPERS.map((wp) => (
                <button
                  key={wp.id}
                  className="onboarding-wallpaper-swatch"
                  data-active={prefs.wallpaperId === wp.id}
                  style={{ background: wp.preview }}
                  onClick={() => prefs.setWallpaper(wp.id)}
                  aria-label={wp.name}
                />
              ))}
              {prefs.customWallpaperDataUrl && (
                <button
                  className="onboarding-wallpaper-swatch"
                  data-active={prefs.wallpaperId === "custom"}
                  style={{ backgroundImage: `url(${prefs.customWallpaperDataUrl})`, backgroundSize: "cover" }}
                  onClick={() => prefs.setWallpaper("custom")}
                  aria-label="Imported wallpaper"
                />
              )}
            </div>
            <button className="onboarding-btn" onClick={importWallpaper}>
              Import from Windows…
            </button>
            <div className="onboarding-actions">
              <button className="onboarding-btn onboarding-btn-primary" onClick={next}>
                Next
              </button>
            </div>
          </>
        )}

        {step === "finish" && (
          <>
            <h1 className="onboarding-title">You're all set</h1>
            <p className="onboarding-body">Welcome to Anchoran OS{prefs.username !== "user" ? `, ${prefs.username}` : ""}.</p>
            <div className="onboarding-actions">
              <button className="onboarding-btn onboarding-btn-primary" onClick={finish}>
                Go to desktop
              </button>
            </div>
          </>
        )}

        <div className="onboarding-dots">
          {STEPS.map((s, i) => (
            <span key={s} className="onboarding-dot" data-active={i === stepIndex} />
          ))}
        </div>
      </div>
    </div>
  );
}
