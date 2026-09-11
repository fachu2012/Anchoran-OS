/**
 * Real client-side encryption for the Password Vault, via the Web
 * Crypto API already built into Electron's renderer — no native
 * module, no external service. The master password never leaves this
 * process and is never itself stored; only a random salt (needed to
 * re-derive the same key next time) and the encrypted vault blob are
 * persisted. Forgetting the master password means the vault cannot be
 * recovered — there is no backdoor, the same as any real vault.
 */

function bufToBase64(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

function base64ToBuf(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt as BufferSource, iterations: 150000, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export function randomSaltBase64(): string {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return bufToBase64(salt.buffer);
}

export async function encryptJson(password: string, saltBase64: string, data: unknown): Promise<string> {
  const salt = new Uint8Array(base64ToBuf(saltBase64));
  const key = await deriveKey(password, salt);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(data));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext);
  return `${bufToBase64(iv.buffer)}.${bufToBase64(ciphertext)}`;
}

/** Returns null if the password is wrong (decryption/auth-tag failure) rather than throwing. */
export async function decryptJson<T>(password: string, saltBase64: string, blob: string): Promise<T | null> {
  try {
    const [ivB64, ctB64] = blob.split(".");
    const salt = new Uint8Array(base64ToBuf(saltBase64));
    const key = await deriveKey(password, salt);
    const iv = new Uint8Array(base64ToBuf(ivB64));
    const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, base64ToBuf(ctB64));
    return JSON.parse(new TextDecoder().decode(plaintext)) as T;
  } catch {
    return null;
  }
}
