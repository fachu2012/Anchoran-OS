import { useEffect, type ReactNode } from "react";
import { usePreferencesStore } from "./preferencesStore";

export function ThemeProvider({ children }: { children: ReactNode }) {
  const themeMode = usePreferencesStore((s) => s.themeMode);
  const accentColor = usePreferencesStore((s) => s.accentColor);
  const uiScale = usePreferencesStore((s) => s.uiScale);
  const animationsEnabled = usePreferencesStore((s) => s.animationsEnabled);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", themeMode);
  }, [themeMode]);

  useEffect(() => {
    document.documentElement.style.setProperty("--anchoran-accent", accentColor);
  }, [accentColor]);

  useEffect(() => {
    document.documentElement.style.setProperty("--anchoran-ui-scale", String(uiScale));
  }, [uiScale]);

  useEffect(() => {
    document.documentElement.setAttribute(
      "data-animations",
      animationsEnabled ? "on" : "off"
    );
  }, [animationsEnabled]);

  return <>{children}</>;
}
