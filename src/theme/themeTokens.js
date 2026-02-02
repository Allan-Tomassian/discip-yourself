// Premium, Apple-style theme tokens.
// Goals:
// - Richer depth (vignette + highlight + subtle noise)
// - Better contrast and legibility
// - “Motion-ready” tokens (optional CSS animation using background-position)
// - Backward compatible keys: background, bg, text, muted, muted2, border, glass, glass2, accent, glow

export const DEFAULT_THEME = "aurora";

// Brand accent fallback (can still be overridden per theme or per user).
export const BRAND_ACCENT = "#F7931A";

// Helper: a consistent glow for brand accent.
export const BRAND_GLOW = "rgba(247,147,26,.35)";

// CTA text tuned for the brand accent.
const CTA_TEXT_DARK = "#1B1206";

// Shared surfaces and shadows tuned for iOS-like glass.
const SHARED = {
  // Shadow stack (Apple-ish): subtle ambient + tighter contact shadow
  shadow: "0 18px 50px rgba(0,0,0,.45), 0 2px 10px rgba(0,0,0,.25)",
  shadowSoft: "0 10px 30px rgba(0,0,0,.35), 0 1px 8px rgba(0,0,0,.18)",
  shadowCard: "0 10px 30px rgba(0,0,0,.35), 0 1px 8px rgba(0,0,0,.18)",

  // Rings (focus/active states)
  ring: "0 0 0 1px rgba(255,255,255,.14)",
  ringStrong: "0 0 0 1px rgba(255,255,255,.20)",

  // Backdrop blur hint (used in CSS if you want)
  blur: "16px",

  // Premium surfaces (optional, but used for consistent “Apple glass”)
  surface: "rgba(255,255,255,.075)",
  surface2: "rgba(255,255,255,.105)",
  surface3: "rgba(255,255,255,.135)",
  borderStrong: "rgba(255,255,255,.22)",
  textStrong: "rgba(255,255,255,.92)",
  danger: "#FB7185",
  warning: "#FBBF24",
  success: "#34D399",

  // Background motion helpers
  backgroundSize: "180% 180%",
  backgroundPosition: "0% 0%",
  // Kebab-case aliases for CSS vars used in index.css
  "background-size": "180% 180%",
  "background-position": "0% 0%",
};

// Premium layered backgrounds:
// - A base dark gradient
// - One conic gradient for subtle color flow
// - 2–3 radial highlights
// - A vignette (dark edges)
// - A tiny noise layer (very subtle)
// NOTE: “noise” is simulated with repeating-linear-gradients (works everywhere, no images).

const THEME_TOKENS = {
  // Default: crisp, high-contrast, neon-glass aurora.
  aurora: {
    background:
      "radial-gradient(1200px 650px at 18% 8%, rgba(124,58,237,.34), transparent 60%)," +
      "radial-gradient(900px 540px at 95% 22%, rgba(14,165,233,.22), transparent 55%)," +
      "radial-gradient(780px 560px at 42% 102%, rgba(34,197,94,.16), transparent 58%)," +
      "conic-gradient(from 210deg at 55% 45%, rgba(124,58,237,.14), rgba(14,165,233,.10), rgba(34,197,94,.08), rgba(124,58,237,.14)) ," +
      "radial-gradient(1200px 900px at 50% 55%, rgba(0,0,0,.0), rgba(0,0,0,.62) 72%, rgba(0,0,0,.84) 100%)," +
      "repeating-linear-gradient(135deg, rgba(255,255,255,.020) 0px, rgba(255,255,255,.020) 1px, rgba(255,255,255,0) 2px, rgba(255,255,255,0) 6px)," +
      "linear-gradient(180deg, #05060A, #05060A)",
    bg: "#05060A",
    text: "#FFFFFF",
    muted: "rgba(255,255,255,.72)",
    muted2: "rgba(255,255,255,.52)",
    border: "rgba(255,255,255,.18)",
    glass: "rgba(255,255,255,.080)",
    glass2: "rgba(255,255,255,.125)",
    accent: BRAND_ACCENT,
    glow: BRAND_GLOW,
    ...SHARED,
  },

  // Minimal, premium dark (iOS style): neutral glass with crisp typography.
  midnight: {
    background:
      "radial-gradient(1100px 680px at 18% 10%, rgba(255,255,255,.09), transparent 58%)," +
      "radial-gradient(900px 560px at 92% 28%, rgba(255,255,255,.06), transparent 58%)," +
      "conic-gradient(from 230deg at 55% 40%, rgba(255,255,255,.06), rgba(255,255,255,.00), rgba(255,255,255,.04), rgba(255,255,255,.06)) ," +
      "radial-gradient(1200px 900px at 50% 55%, rgba(0,0,0,.0), rgba(0,0,0,.62) 74%, rgba(0,0,0,.86) 100%)," +
      "repeating-linear-gradient(115deg, rgba(255,255,255,.016) 0px, rgba(255,255,255,.016) 1px, rgba(255,255,255,0) 2px, rgba(255,255,255,0) 7px)," +
      "linear-gradient(180deg, #07070C, #05060A)",
    bg: "#05060A",
    text: "#F3F4F6",
    muted: "rgba(243,244,246,.66)",
    muted2: "rgba(243,244,246,.46)",
    border: "rgba(243,244,246,.16)",
    glass: "rgba(255,255,255,.070)",
    glass2: "rgba(255,255,255,.110)",
    accent: BRAND_ACCENT,
    glow: BRAND_GLOW,
    ...SHARED,
  },

  // Warm premium: subtle reds/oranges with deep blacks.
  sunset: {
    background:
      "radial-gradient(1100px 680px at 18% 12%, rgba(244,63,94,.22), transparent 58%)," +
      "radial-gradient(980px 560px at 96% 30%, rgba(251,146,60,.18), transparent 58%)," +
      "radial-gradient(820px 540px at 50% 105%, rgba(250,204,21,.10), transparent 60%)," +
      "conic-gradient(from 215deg at 55% 45%, rgba(244,63,94,.10), rgba(251,146,60,.08), rgba(250,204,21,.06), rgba(244,63,94,.10)) ," +
      "radial-gradient(1200px 900px at 50% 55%, rgba(0,0,0,.0), rgba(0,0,0,.64) 72%, rgba(0,0,0,.88) 100%)," +
      "repeating-linear-gradient(135deg, rgba(255,255,255,.018) 0px, rgba(255,255,255,.018) 1px, rgba(255,255,255,0) 2px, rgba(255,255,255,0) 7px)," +
      "linear-gradient(180deg, #07060A, #05060A)",
    bg: "#05060A",
    text: "#FFF7F1",
    muted: "rgba(255,247,241,.70)",
    muted2: "rgba(255,247,241,.50)",
    border: "rgba(255,247,241,.16)",
    glass: "rgba(255,255,255,.078)",
    glass2: "rgba(255,255,255,.120)",
    accent: "#FB923C",
    glow: "rgba(251,146,60,.30)",
    ...SHARED,
  },

  // Cool premium: blue/cyan depth with glass.
  ocean: {
    background:
      "radial-gradient(1150px 700px at 18% 10%, rgba(6,182,212,.20), transparent 58%)," +
      "radial-gradient(980px 560px at 96% 30%, rgba(59,130,246,.16), transparent 58%)," +
      "radial-gradient(820px 540px at 45% 105%, rgba(34,211,238,.10), transparent 60%)," +
      "conic-gradient(from 225deg at 55% 45%, rgba(6,182,212,.10), rgba(59,130,246,.08), rgba(34,211,238,.06), rgba(6,182,212,.10)) ," +
      "radial-gradient(1200px 900px at 50% 55%, rgba(0,0,0,.0), rgba(0,0,0,.64) 72%, rgba(0,0,0,.88) 100%)," +
      "repeating-linear-gradient(120deg, rgba(255,255,255,.016) 0px, rgba(255,255,255,.016) 1px, rgba(255,255,255,0) 2px, rgba(255,255,255,0) 7px)," +
      "linear-gradient(180deg, #05060A, #061225)",
    bg: "#05060A",
    text: "#F2FAFF",
    muted: "rgba(242,250,255,.66)",
    muted2: "rgba(242,250,255,.46)",
    border: "rgba(242,250,255,.15)",
    glass: "rgba(255,255,255,.070)",
    glass2: "rgba(255,255,255,.112)",
    accent: "#22D3EE",
    glow: "rgba(34,211,238,.30)",
    ...SHARED,
  },

  // Organic premium: greens with depth, still dark.
  forest: {
    background:
      "radial-gradient(1150px 700px at 18% 10%, rgba(34,197,94,.18), transparent 58%)," +
      "radial-gradient(980px 560px at 96% 30%, rgba(16,185,129,.14), transparent 58%)," +
      "radial-gradient(820px 540px at 50% 105%, rgba(132,204,22,.10), transparent 60%)," +
      "conic-gradient(from 220deg at 55% 45%, rgba(34,197,94,.10), rgba(16,185,129,.08), rgba(132,204,22,.06), rgba(34,197,94,.10)) ," +
      "radial-gradient(1200px 900px at 50% 55%, rgba(0,0,0,.0), rgba(0,0,0,.64) 72%, rgba(0,0,0,.88) 100%)," +
      "repeating-linear-gradient(135deg, rgba(255,255,255,.016) 0px, rgba(255,255,255,.016) 1px, rgba(255,255,255,0) 2px, rgba(255,255,255,0) 7px)," +
      "linear-gradient(180deg, #05060A, #07140F)",
    bg: "#05060A",
    text: "#F2FFF6",
    muted: "rgba(242,255,246,.66)",
    muted2: "rgba(242,255,246,.46)",
    border: "rgba(242,255,246,.15)",
    glass: "rgba(255,255,255,.070)",
    glass2: "rgba(255,255,255,.112)",
    accent: "#22C55E",
    glow: "rgba(34,197,94,.28)",
    ...SHARED,
  },
};

function clampByte(value) {
  const n = Number(value);
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(255, n));
}

function clamp01(value, fallback = 0.3) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(1, n));
}

/**
 * Normalizes a hex color into "#RRGGBB".
 * Accepts: "#RRGGBB", "RRGGBB", "#RGB", "RGB".
 * Returns null if invalid.
 */
export function normalizeHexColor(input) {
  if (typeof input !== "string") return null;
  const raw = input.trim().replace(/^#/, "");
  if (raw.length === 3) {
    const r = raw[0];
    const g = raw[1];
    const b = raw[2];
    const expanded = `${r}${r}${g}${g}${b}${b}`;
    if (!/^[0-9a-fA-F]{6}$/.test(expanded)) return null;
    return `#${expanded.toUpperCase()}`;
  }
  if (raw.length === 6) {
    if (!/^[0-9a-fA-F]{6}$/.test(raw)) return null;
    return `#${raw.toUpperCase()}`;
  }
  return null;
}

export function isValidHexColor(input) {
  return Boolean(normalizeHexColor(input));
}

function hexToRgba(hex, alpha) {
  const normalized = normalizeHexColor(hex);
  if (!normalized) return null;
  const clean = normalized.replace("#", "");
  const r = clampByte(parseInt(clean.slice(0, 2), 16));
  const g = clampByte(parseInt(clean.slice(2, 4), 16));
  const b = clampByte(parseInt(clean.slice(4, 6), 16));
  const a = clamp01(alpha, 0.3);
  return `rgba(${r},${g},${b},${a})`;
}

export function listThemes() {
  return Object.keys(THEME_TOKENS);
}

/**
 * Reads the preferred theme name from state.
 * Supports per-page storage via ui.pageThemes[page].
 * Backward compatible for the legacy home fields.
 */
export function getThemeName(data, page = "home") {
  const byPage = data?.ui?.pageThemes?.[page];
  if (typeof byPage === "string" && byPage.trim()) return byPage.trim();

  // Legacy (home only)
  if (page === "home") {
    const legacy = data?.ui?.pageThemeHome;
    if (typeof legacy === "string" && legacy.trim()) return legacy.trim();
  }

  return DEFAULT_THEME;
}

/**
 * Reads the preferred accent override from state.
 * Supports per-page storage via ui.pageAccents[page].
 * Backward compatible for the legacy home fields.
 */
export function getThemeAccent(data, page = "home") {
  const byPage = data?.ui?.pageAccents?.[page];
  if (typeof byPage === "string" && byPage.trim()) return byPage.trim();

  // Legacy (home only)
  if (page === "home") {
    const legacy = data?.ui?.accentHome;
    if (typeof legacy === "string" && legacy.trim()) return legacy.trim();
  }

  return null;
}

export function resolveThemeTokens(themeName) {
  if (typeof themeName !== "string" || !themeName.trim()) return THEME_TOKENS[DEFAULT_THEME];
  return THEME_TOKENS[themeName.trim()] || THEME_TOKENS[DEFAULT_THEME];
}

/**
 * Applies theme tokens as CSS variables on :root.
 * This is the only place that writes the CSS variables.
 */
export function applyThemeTokens(themeName, accentOverride) {
  if (typeof document === "undefined") return;

  const tokens = resolveThemeTokens(themeName);
  const normalizedAccent = normalizeHexColor(accentOverride);

  // If the user overrides the accent, compute a matching glow automatically.
  const nextGlow = normalizedAccent ? hexToRgba(normalizedAccent, 0.3) : null;

  const finalTokens = {
    ...tokens,
    // Global brand accent everywhere unless the user explicitly overrides it.
    accent: normalizedAccent || BRAND_ACCENT,
    glow: nextGlow || BRAND_GLOW,
    // Cross-app aliases to avoid hardcoded colors elsewhere.
    accentStrong: normalizedAccent || BRAND_ACCENT,
    accentPrimary: normalizedAccent || BRAND_ACCENT,
    focus: normalizedAccent || BRAND_ACCENT,
    focusGlow: hexToRgba(normalizedAccent || BRAND_ACCENT, 0.35) || BRAND_GLOW,
    cta: normalizedAccent || BRAND_ACCENT,
    ctaText: CTA_TEXT_DARK,
    accentText: CTA_TEXT_DARK,
  };

  const root = document.documentElement;
  Object.entries(finalTokens).forEach(([key, value]) => {
    if (typeof value === "string" && value.trim()) {
      root.style.setProperty(`--${key}`, value);

      // Keep CSS variable naming consistent across codebase.
      // index.css expects --background-size / --background-position.
      if (key === "backgroundSize") root.style.setProperty("--background-size", value);
      if (key === "backgroundPosition") root.style.setProperty("--background-position", value);
    }
  });

  // Convenience alias used in some CSS
  root.style.setProperty("--accentGlow", finalTokens.glow);

  // Debug-friendly dataset values
  root.dataset.theme = (typeof themeName === "string" && themeName.trim()) ? themeName.trim() : DEFAULT_THEME;
  root.dataset.accent = finalTokens.accent;

  // iOS browser chrome color
  try {
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "theme-color");
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", finalTokens.accent);
  } catch (err) {
    void err;
  }
}

/**
 * Convenience helper: apply tokens directly from the persisted app state.
 */
export function applyThemeFromState(data, page = "home") {
  // Force a single global theme across the app.
  // This avoids the Settings page (or any other page) overriding the theme and creating color inconsistencies.
  const name = getThemeName(data, "home");
  const accent = getThemeAccent(data, "home");
  applyThemeTokens(name, accent);
}

export { THEME_TOKENS };
