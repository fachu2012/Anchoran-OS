import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ErrorBoundary, installGlobalErrorHandlers } from "./core/ErrorBoundary";
import { installAnchoranSDK } from "./core/anchoranSDK";
import "./theme/theme.css";

installGlobalErrorHandlers();
installAnchoranSDK();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
