import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { CrashReporter, installGlobalErrorHandlers } from "./core/crashReporter";
import { WatchdogCrashScreen } from "./boot/WatchdogCrashScreen";
import { installAnchoranSDK } from "./core/anchoranSDK";
import "./theme/theme.css";

installGlobalErrorHandlers();
installAnchoranSDK();

// The crash watchdog (electron/main.ts's createCrashScreenWindow)
// loads this exact same renderer bundle with a `?crash=1&msg=...`
// query instead of building a separate one — this is the one place
// that reads it and picks WatchdogCrashScreen instead of the normal
// app, so nothing else in Anchoran needs to know this mode exists.
const params = new URLSearchParams(window.location.search);
const crashMessage = params.get("crash") === "1" ? (params.get("msg") ?? "Anchoran crashed.") : null;

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    {crashMessage !== null ? (
      <WatchdogCrashScreen message={crashMessage} />
    ) : (
      <CrashReporter>
        <App />
      </CrashReporter>
    )}
  </React.StrictMode>
);
