const DEFAULT_THEME = "aurora";
const BITCOIN_ACCENT = "#F7931A";
const BITCOIN_GLOW = "rgba(247,147,26,.35)";

const THEME_TOKENS = {
  aurora: {
    background:
      "radial-gradient(1200px 600px at 20% 0%, rgba(124,58,237,0.35), transparent 60%), radial-gradient(900px 500px at 100% 30%, rgba(6,182,212,0.25), transparent 55%), radial-gradient(700px 500px at 40% 100%, rgba(34,197,94,0.18), transparent 55%), linear-gradient(180deg, #05060A, #05060A)",
    bg: "#05060A",
    text: "#FFFFFF",
    muted: "rgba(255,255,255,.65)",
    muted2: "rgba(255,255,255,.45)",
    border: "rgba(255,255,255,.16)",
    glass: "rgba(255,255,255,.08)",
    glass2: "rgba(255,255,255,.12)",
    accent: BITCOIN_ACCENT,
    glow: BITCOIN_GLOW,
  },
  midnight: {
    background:
      "radial-gradient(900px 600px at 20% 0%, rgba(255,255,255,0.10), transparent 55%), radial-gradient(900px 600px at 90% 30%, rgba(255,255,255,0.06), transparent 55%), linear-gradient(180deg, #05060A, #070816)",
    bg: "#05060A",
    text: "#EDEFF3",
    muted: "rgba(237,239,243,.6)",
    muted2: "rgba(237,239,243,.42)",
    border: "rgba(237,239,243,.14)",
    glass: "rgba(255,255,255,.06)",
    glass2: "rgba(255,255,255,.10)",
    accent: BITCOIN_ACCENT,
    glow: BITCOIN_GLOW,
  },
  sunset: {
    background:
      "radial-gradient(900px 600px at 20% 10%, rgba(244,63,94,0.22), transparent 55%), radial-gradient(900px 600px at 90% 30%, rgba(251,146,60,0.18), transparent 55%), radial-gradient(700px 500px at 40% 95%, rgba(250,204,21,0.10), transparent 60%), linear-gradient(180deg, #05060A, #0B0817)",
    bg: "#05060A",
    text: "#FFF7F1",
    muted: "rgba(255,247,241,.62)",
    muted2: "rgba(255,247,241,.42)",
    border: "rgba(255,247,241,.14)",
    glass: "rgba(255,255,255,.08)",
    glass2: "rgba(255,255,255,.12)",
    accent: BITCOIN_ACCENT,
    glow: BITCOIN_GLOW,
  },
  ocean: {
    background:
      "radial-gradient(900px 600px at 20% 0%, rgba(6,182,212,0.22), transparent 55%), radial-gradient(900px 600px at 100% 30%, rgba(59,130,246,0.16), transparent 55%), radial-gradient(700px 500px at 40% 100%, rgba(34,211,238,0.10), transparent 55%), linear-gradient(180deg, #05060A, #061225)",
    bg: "#05060A",
    text: "#F2FAFF",
    muted: "rgba(242,250,255,.6)",
    muted2: "rgba(242,250,255,.4)",
    border: "rgba(242,250,255,.14)",
    glass: "rgba(255,255,255,.07)",
    glass2: "rgba(255,255,255,.11)",
    accent: BITCOIN_ACCENT,
    glow: BITCOIN_GLOW,
  },
  forest: {
    background:
      "radial-gradient(900px 600px at 20% 0%, rgba(34,197,94,0.18), transparent 55%), radial-gradient(900px 600px at 90% 35%, rgba(16,185,129,0.14), transparent 55%), radial-gradient(700px 500px at 50% 100%, rgba(132,204,22,0.10), transparent 60%), linear-gradient(180deg, #05060A, #07140F)",
    bg: "#05060A",
    text: "#F2FFF6",
    muted: "rgba(242,255,246,.6)",
    muted2: "rgba(242,255,246,.4)",
    border: "rgba(242,255,246,.14)",
    glass: "rgba(255,255,255,.07)",
    glass2: "rgba(255,255,255,.11)",
    accent: BITCOIN_ACCENT,
    glow: BITCOIN_GLOW,
  },
};

function clampByte(value) {
  const n = Number(value);
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(255, n));
}

function hexToRgba(hex, alpha) {
  if (typeof hex !== "string") return null;
  const clean = hex.replace("#", "").trim();
  if (clean.length !== 6) return null;
  const r = clampByte(parseInt(clean.slice(0, 2), 16));
  const g = clampByte(parseInt(clean.slice(2, 4), 16));
  const b = clampByte(parseInt(clean.slice(4, 6), 16));
  const a = Number.isFinite(alpha) ? alpha : 0.3;
  return `rgba(${r},${g},${b},${a})`;
}

export function getThemeName(data) {
  return data?.ui?.pageThemes?.home || data?.ui?.pageThemeHome || DEFAULT_THEME;
}

export function getThemeAccent(data) {
  return data?.ui?.pageAccents?.home || data?.ui?.accentHome || null;
}

export function resolveThemeTokens(themeName) {
  return THEME_TOKENS[themeName] || THEME_TOKENS[DEFAULT_THEME];
}

export function applyThemeTokens(themeName, accentOverride) {
  if (typeof document === "undefined") return;
  const tokens = resolveThemeTokens(themeName);
  const nextAccent = typeof accentOverride === "string" && accentOverride.trim() ? accentOverride.trim() : null;
  const overrideGlow = nextAccent ? hexToRgba(nextAccent, 0.3) : null;
  const hasAccentOverride = Boolean(overrideGlow);
  const nextGlow = hasAccentOverride ? overrideGlow : tokens.glow;
  const finalTokens = {
    ...tokens,
    accent: hasAccentOverride ? nextAccent : tokens.accent,
    glow: nextGlow || tokens.glow,
  };
  const root = document.documentElement;
  Object.entries(finalTokens).forEach(([key, value]) => {
    root.style.setProperty(`--${key}`, value);
  });
  root.dataset.theme = themeName;
}

export { DEFAULT_THEME, THEME_TOKENS };
