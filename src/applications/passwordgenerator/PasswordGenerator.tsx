import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import "@/applications/apps.css";
import "./passwordgenerator.css";

const LOWER = "abcdefghijklmnopqrstuvwxyz";
const UPPER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const DIGITS = "0123456789";
const SYMBOLS = "!@#$%^&*()-_=+[]{}";

function generate(length: number, opts: { lower: boolean; upper: boolean; digits: boolean; symbols: boolean }) {
  let pool = "";
  if (opts.lower) pool += LOWER;
  if (opts.upper) pool += UPPER;
  if (opts.digits) pool += DIGITS;
  if (opts.symbols) pool += SYMBOLS;
  if (!pool) return "";
  const bytes = new Uint32Array(length);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < length; i++) out += pool[bytes[i] % pool.length];
  return out;
}

function strengthLabel(length: number, poolCount: number) {
  const bits = Math.log2(Math.max(poolCount, 1)) * length;
  if (bits < 40) return { label: "Weak", level: 1 };
  if (bits < 70) return { label: "Fair", level: 2 };
  if (bits < 100) return { label: "Strong", level: 3 };
  return { label: "Very strong", level: 4 };
}

export function PasswordGeneratorApp() {
  const [length, setLength] = useState(16);
  const [lower, setLower] = useState(true);
  const [upper, setUpper] = useState(true);
  const [digits, setDigits] = useState(true);
  const [symbols, setSymbols] = useState(true);
  const [password, setPassword] = useState("");
  const [copied, setCopied] = useState(false);

  function regenerate() {
    setPassword(generate(length, { lower, upper, digits, symbols }));
  }

  useEffect(() => {
    regenerate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [length, lower, upper, digits, symbols]);

  function copy() {
    if (!password) return;
    navigator.clipboard?.writeText(password);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  }

  const poolCount = (lower ? 26 : 0) + (upper ? 26 : 0) + (digits ? 10 : 0) + (symbols ? SYMBOLS.length : 0);
  const strength = strengthLabel(length, poolCount);

  return (
    <div className="app-root">
      <div className="app-content pwgen-content">
        <div className="pwgen-output">
          <span>{password || "—"}</span>
          <div className="pwgen-output-actions">
            <button className="app-toolbar-btn" onClick={regenerate} aria-label="Regenerate">
              <Icon name="restart" size={14} />
            </button>
            <button className="app-toolbar-btn" onClick={copy} aria-label="Copy">
              <Icon name="copy" size={14} />
            </button>
          </div>
        </div>
        {copied && <div className="pwgen-copied">Copied to clipboard</div>}

        <div className="pwgen-strength" data-level={strength.level}>
          <div className="pwgen-strength-bar" />
          <div className="pwgen-strength-bar" />
          <div className="pwgen-strength-bar" />
          <div className="pwgen-strength-bar" />
          <span>{strength.label}</span>
        </div>

        <div className="pwgen-row">
          <label>Length</label>
          <input
            type="range"
            min={6}
            max={40}
            value={length}
            onChange={(e) => setLength(Number(e.target.value))}
          />
          <span className="pwgen-length-value">{length}</span>
        </div>

        <label className="pwgen-check">
          <input type="checkbox" checked={lower} onChange={(e) => setLower(e.target.checked)} /> Lowercase (a-z)
        </label>
        <label className="pwgen-check">
          <input type="checkbox" checked={upper} onChange={(e) => setUpper(e.target.checked)} /> Uppercase (A-Z)
        </label>
        <label className="pwgen-check">
          <input type="checkbox" checked={digits} onChange={(e) => setDigits(e.target.checked)} /> Digits (0-9)
        </label>
        <label className="pwgen-check">
          <input type="checkbox" checked={symbols} onChange={(e) => setSymbols(e.target.checked)} /> Symbols (!@#…)
        </label>
      </div>
    </div>
  );
}
