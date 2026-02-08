// Small shared helpers.
// Keep this file dependency-free (used by both web + Capacitor builds).

export function uid() {
  // Prefer cryptographically strong IDs when available.
  // - crypto.randomUUID(): modern browsers / iOS WKWebView recent versions.
  // - crypto.getRandomValues(): fallback.
  try {
    if (typeof globalThis !== "undefined" && globalThis.crypto) {
      const c = globalThis.crypto;
      if (typeof c.randomUUID === "function") return c.randomUUID();

      if (typeof c.getRandomValues === "function") {
        const bytes = new Uint8Array(16);
        c.getRandomValues(bytes);
        // RFC4122-ish v4 formatting (best-effort)
        bytes[6] = (bytes[6] & 0x0f) | 0x40;
        bytes[8] = (bytes[8] & 0x3f) | 0x80;
        const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
        return (
          hex.slice(0, 8) +
          "-" +
          hex.slice(8, 12) +
          "-" +
          hex.slice(12, 16) +
          "-" +
          hex.slice(16, 20) +
          "-" +
          hex.slice(20)
        );
      }
    }
  } catch {
    // ignore
  }

  // Last resort: keep old behavior (non-crypto), but reduce collision chance.
  return (
    Math.random().toString(16).slice(2) +
    Date.now().toString(16) +
    Math.random().toString(16).slice(2)
  );
}

export function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

export function sameArray(a, b) {
  if (a === b) return true;
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

export async function readFileAsDataUrl(file) {
  return await new Promise((resolve, reject) => {
    try {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result || ""));
      r.onerror = () => reject(r.error || new Error("FileReader error"));
      r.onabort = () => reject(new Error("FileReader aborted"));
      r.readAsDataURL(file);
    } catch (err) {
      reject(err);
    }
  });
}
