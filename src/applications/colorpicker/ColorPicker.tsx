import { useMemo, useState } from "react";
import { Icon } from "@/components/Icon";
import "@/applications/apps.css";
import "./colorpicker.css";

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, Math.round(l * 100)];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
  else if (max === g) h = ((b - r) / d + 2) * 60;
  else h = ((r - g) / d + 4) * 60;
  return [Math.round(h), Math.round(s * 100), Math.round(l * 100)];
}

function CopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="colorpicker-copy-row"
      onClick={() => {
        navigator.clipboard?.writeText(value).catch(() => {});
        setCopied(true);
        setTimeout(() => setCopied(false), 1000);
      }}
    >
      <span className="colorpicker-copy-label">{label}</span>
      <span className="colorpicker-copy-value">{value}</span>
      <Icon name={copied ? "check" : "copy"} size={14} />
    </button>
  );
}

export function ColorPickerApp() {
  const [color, setColor] = useState("#6E9BF7");
  const [swatches, setSwatches] = useState<string[]>(["#6E9BF7", "#1E3A8A", "#0F766E", "#7C3AED", "#B45309"]);

  const [r, g, b] = useMemo(() => hexToRgb(color), [color]);
  const [h, s, l] = useMemo(() => rgbToHsl(r, g, b), [r, g, b]);

  return (
    <div className="app-root">
      <div className="app-content colorpicker-content">
        <div className="colorpicker-preview" style={{ background: color }}>
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="colorpicker-input"
            aria-label="Pick a color"
          />
        </div>

        <div className="colorpicker-values">
          <CopyRow label="HEX" value={color.toUpperCase()} />
          <CopyRow label="RGB" value={`rgb(${r}, ${g}, ${b})`} />
          <CopyRow label="HSL" value={`hsl(${h}, ${s}%, ${l}%)`} />
        </div>

        <div className="colorpicker-swatches">
          {swatches.map((sw) => (
            <button
              key={sw}
              className="colorpicker-swatch"
              style={{ background: sw }}
              onClick={() => setColor(sw)}
              aria-label={sw}
            />
          ))}
          <button
            className="colorpicker-swatch colorpicker-swatch-add"
            onClick={() => setSwatches((s) => (s.includes(color) ? s : [...s, color].slice(-10)))}
            aria-label="Save current color"
          >
            <Icon name="plus" size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
