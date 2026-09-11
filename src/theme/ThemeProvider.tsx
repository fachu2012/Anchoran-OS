import { useEffect, type ReactNode } from "react";
import { usePreferencesStore } from "./preferencesStore";

export function ThemeProvider({ children }: { children: ReactNode }) {
  const themeMode = usePreferencesStore((s) => s.themeMode);
  const accentColor = usePreferencesStore((s) => s.accentColor);
  const uiScale = usePreferencesStore((s) => s.uiScale);
  const animationsEnabled = usePreferencesStore((s) => s.animationsEnabled);
  const nightLightEnabled = usePreferencesStore((s) => s.nightLightEnabled);
  const brightness = usePreferencesStore((s) => s.brightness);
  const highContrast = usePreferencesStore((s) => s.highContrast);
  const largeText = usePreferencesStore((s) => s.largeText);

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

  // Night Light and brightness both work as a single CSS filter chain on
  // the root element — a warm sepia/saturate tint for Night Light,
  // layered with a brightness() multiplier for the brightness slider —
  // rather than touching every surface color individually.
  useEffect(() => {
    const filters: string[] = [];
    if (brightness < 1) filters.push(`brightness(${brightness})`);
    if (nightLightEnabled) filters.push("sepia(0.25) saturate(1.15) hue-rotate(-8deg)");
    document.documentElement.style.setProperty("--anchoran-display-filter", filters.join(" ") || "none");
  }, [nightLightEnabled, brightness]);

  useEffect(() => {
    document.documentElement.setAttribute("data-high-contrast", highContrast ? "on" : "off");
  }, [highContrast]);

  useEffect(() => {
    document.documentElement.setAttribute("data-large-text", largeText ? "on" : "off");
  }, [largeText]);

  return <>{children}</>;
}
