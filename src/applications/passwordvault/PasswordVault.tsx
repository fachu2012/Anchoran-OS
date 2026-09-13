import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { persistGet, persistSet } from "@/core/persist";
import { randomSaltBase64, encryptJson, decryptJson } from "./crypto";
import "@/applications/apps.css";
import "./passwordvault.css";

interface VaultEntry {
  id: string;
  title: string;
  username: string;
  password: string;
  url: string;
  notes: string;
}

const SALT_KEY = "vaultSalt";
const BLOB_KEY = "vaultBlob";

// A real generator right in the entry form — not just a link out to
// the separate Password Generator app — 16 characters, every
// character class, drawn from a real CSPRNG (crypto.getRandomValues).
const GEN_CHARS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()-_=+[]{}";
function generatePassword(length = 16): string {
  const bytes = new Uint32Array(length);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < length; i++) out += GEN_CHARS[bytes[i] % GEN_CHARS.length];
  return out;
}

type Stage = "loading" | "setup" | "locked" | "unlocked";

export function PasswordVaultApp() {
  const [stage, setStage] = useState<Stage>("loading");
  const [salt, setSalt] = useState<string | null>(null);
  const [passwordInput, setPasswordInput] = useState("");
  const [confirmInput, setConfirmInput] = useState("");
  const [masterPassword, setMasterPassword] = useState<string | null>(null);
  const [entries, setEntries] = useState<VaultEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [revealedId, setRevealedId] = useState<string | null>(null);
  const [form, setForm] = useState<Omit<VaultEntry, "id"> | null>(null);

  useEffect(() => {
    persistGet<string | null>("data", SALT_KEY, null).then((s) => {
      setSalt(s);
      setStage(s ? "locked" : "setup");
    });
  }, []);

  async function createVault() {
    if (passwordInput.length < 6) {
      setError("Use at least 6 characters for your master password.");
      return;
    }
    if (passwordInput !== confirmInput) {
      setError("Passwords don't match.");
      return;
    }
    const newSalt = randomSaltBase64();
    const blob = await encryptJson(passwordInput, newSalt, []);
    await persistSet("data", SALT_KEY, newSalt);
    await persistSet("data", BLOB_KEY, blob);
    setSalt(newSalt);
    setMasterPassword(passwordInput);
    setEntries([]);
    setPasswordInput("");
    setConfirmInput("");
    setError(null);
    setStage("unlocked");
  }

  async function unlock() {
    if (!salt) return;
    const blob = await persistGet<string | null>("data", BLOB_KEY, null);
    const decrypted = blob ? await decryptJson<VaultEntry[]>(passwordInput, salt, blob) : [];
    if (decrypted === null) {
      setError("Incorrect master password.");
      return;
    }
    setMasterPassword(passwordInput);
    setEntries(decrypted);
    setPasswordInput("");
    setError(null);
    setStage("unlocked");
  }

  async function persistEntries(next: VaultEntry[]) {
    if (!masterPassword || !salt) return;
    setEntries(next);
    const blob = await encryptJson(masterPassword, salt, next);
    persistSet("data", BLOB_KEY, blob);
  }

  function addEntry() {
    setForm({ title: "", username: "", password: "", url: "", notes: "" });
  }

  function saveForm() {
    if (!form || !form.title.trim()) return;
    persistEntries([...entries, { id: `${Date.now()}`, ...form }]);
    setForm(null);
  }

  function removeEntry(id: string) {
    persistEntries(entries.filter((e) => e.id !== id));
  }

  function lock() {
    setMasterPassword(null);
    setEntries([]);
    setStage("locked");
  }

  if (stage === "loading") return <div className="app-root" />;

  if (stage === "setup" || stage === "locked") {
    return (
      <div className="app-root">
        <div className="app-content vault-gate">
          <Icon name="lock" size={36} />
          <h3 style={{ margin: "8px 0 2px", fontWeight: 500 }}>
            {stage === "setup" ? "Create your vault" : "Vault locked"}
          </h3>
          <p style={{ color: "var(--anchoran-text-secondary)", fontSize: 12.5, textAlign: "center", maxWidth: 260 }}>
            {stage === "setup"
              ? "Choose a master password. It never leaves this device and there is no way to recover it if forgotten."
              : "Enter your master password to unlock."}
          </p>
          <input
            type="password"
            placeholder="Master password"
            value={passwordInput}
            onChange={(e) => setPasswordInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (stage === "setup" ? createVault() : unlock())}
            className="vault-input"
            autoFocus
          />
          {stage === "setup" && (
            <input
              type="password"
              placeholder="Confirm password"
              value={confirmInput}
              onChange={(e) => setConfirmInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && createVault()}
              className="vault-input"
            />
          )}
          {error && <div className="vault-error">{error}</div>}
          <button className="app-toolbar-btn" onClick={stage === "setup" ? createVault : unlock}>
            {stage === "setup" ? "Create vault" : "Unlock"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="app-root">
      <div className="app-toolbar">
        <button className="app-toolbar-btn" onClick={addEntry}>
          <Icon name="plus" size={14} /> Add
        </button>
        <button className="app-toolbar-btn" onClick={lock} style={{ marginLeft: "auto" }}>
          <Icon name="lock" size={13} /> Lock
        </button>
      </div>
      <div className="app-content">
        {form && (
          <div className="vault-form">
            <input
              placeholder="Title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              autoFocus
            />
            <input
              placeholder="Username"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
            />
            <div style={{ display: "flex", gap: 6 }}>
              <input
                placeholder="Password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                style={{ flex: 1 }}
              />
              <button
                className="app-toolbar-btn"
                type="button"
                title="Generate a strong password"
                onClick={() => setForm({ ...form, password: generatePassword() })}
              >
                <Icon name="restart" size={13} /> Generate
              </button>
            </div>
            <input placeholder="URL" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} />
            <div style={{ display: "flex", gap: 6 }}>
              <button className="app-toolbar-btn" onClick={saveForm}>
                Save
              </button>
              <button className="app-toolbar-btn" onClick={() => setForm(null)}>
                Cancel
              </button>
            </div>
          </div>
        )}
        <div className="vault-list">
          {entries.length === 0 && !form && (
            <div style={{ color: "var(--anchoran-text-secondary)", fontSize: 12.5 }}>No entries yet.</div>
          )}
          {entries.map((e) => (
            <div key={e.id} className="vault-entry">
              <div className="vault-entry-title">{e.title}</div>
              <div className="vault-entry-row">
                <span>{e.username}</span>
                <button className="todo-remove" onClick={() => removeEntry(e.id)} aria-label="Delete">
                  <Icon name="close" size={12} />
                </button>
              </div>
              <div className="vault-entry-row">
                <span className="vault-entry-secret">{revealedId === e.id ? e.password : "••••••••"}</span>
                <button
                  className="app-toolbar-btn"
                  onClick={() => setRevealedId((id) => (id === e.id ? null : e.id))}
                >
                  {revealedId === e.id ? "Hide" : "Show"}
                </button>
                <button className="app-toolbar-btn" onClick={() => navigator.clipboard?.writeText(e.password)}>
                  <Icon name="copy" size={12} />
                </button>
              </div>
              {e.url && <div className="vault-entry-url">{e.url}</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
