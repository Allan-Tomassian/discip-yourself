export const LS_KEY = "discip_yourself_v2";

// Side keys (backward compatible)
const LS_KEY_BACKUP = `${LS_KEY}__bak`;
const LS_KEY_META = `${LS_KEY}__meta`;

// Reasonable guard for localStorage (varies by browser; keep conservative)
const MAX_BYTES = 4_500_000; // ~4.5MB

function safeParse(raw) {
  if (typeof raw !== "string" || !raw.trim()) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function safeStringify(value) {
  // Avoid hard crash on accidental circular refs.
  const seen = new WeakSet();
  try {
    return JSON.stringify(value, (_k, v) => {
      if (v && typeof v === "object") {
        if (seen.has(v)) return "[Circular]";
        seen.add(v);
      }
      return v;
    });
  } catch {
    return null;
  }
}

function byteLength(str) {
  if (typeof str !== "string") return 0;
  // UTF-8 approx
  return new Blob([str]).size;
}

function writeMeta(meta) {
  try {
    localStorage.setItem(LS_KEY_META, JSON.stringify(meta));
  } catch {
    // ignore
  }
}

function readMeta() {
  return safeParse(localStorage.getItem(LS_KEY_META)) || null;
}

export function loadState() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    const parsed = safeParse(raw);
    if (parsed) return parsed;

    // Recovery path: try backup if primary is corrupted.
    const bak = localStorage.getItem(LS_KEY_BACKUP);
    const bakParsed = safeParse(bak);
    if (bakParsed) {
      // Attempt to restore primary for next launch.
      try {
        localStorage.setItem(LS_KEY, JSON.stringify(bakParsed));
        writeMeta({ ...(readMeta() || {}), recoveredAt: Date.now(), source: "backup" });
      } catch {
        // ignore
      }
      return bakParsed;
    }

    return null;
  } catch {
    return null;
  }
}

export function saveState(state) {
  // Keep the behavior: best-effort persistence, no throws.
  try {
    const json = safeStringify(state);
    if (!json) return;

    const bytes = byteLength(json);
    if (bytes > MAX_BYTES) {
      // Prevent quota blowups. Keep a meta trace for debugging.
      writeMeta({
        ...(readMeta() || {}),
        lastError: "STATE_TOO_LARGE",
        lastBytes: bytes,
        lastAttemptAt: Date.now(),
      });
      return;
    }

    // Backup previous good state before overwriting.
    try {
      const prev = localStorage.getItem(LS_KEY);
      if (prev && prev !== json) localStorage.setItem(LS_KEY_BACKUP, prev);
    } catch {
      // ignore
    }

    localStorage.setItem(LS_KEY, json);
    writeMeta({
      ...(readMeta() || {}),
      lastSavedAt: Date.now(),
      lastBytes: bytes,
      lastError: "",
    });
  } catch (err) {
    // QuotaExceededError or Safari private mode etc.
    try {
      writeMeta({
        ...(readMeta() || {}),
        lastError: "SAVE_FAILED",
        lastAttemptAt: Date.now(),
      });
    } catch {
      // ignore
    }
    void err;
  }
}

export function clearState() {
  try {
    localStorage.removeItem(LS_KEY);
    localStorage.removeItem(LS_KEY_BACKUP);
    localStorage.removeItem(LS_KEY_META);
  } catch (err) {
    void err;
  }
}
