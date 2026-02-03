// Premium, Apple-style theme tokens.
// Goals:
// - Richer depth (vignette + highlight + subtle noise)
// - Better contrast and legibility
// - “Motion-ready” tokens (optional CSS animation using background-position)
// - Backward compatible keys: background, bg, text, muted, muted2, border, glass, glass2, accent, glow

export const DEFAULT_THEME = "aurora";

// Brand accent fallback (can still be overridden per theme or per user).
export const BRAND_ACCENT = "#F7931A";

// Helper: a consistent glow for brand accent (kept subtle).
export const BRAND_GLOW = "rgba(247,147,26,.22)";

// CTA text tuned for the brand accent.
const CTA_TEXT_DARK = "#1A1208";

// Shared surfaces, layout, and shadows tuned for iOS-like glass.
const SHARED = {
  // Shadow stack (Apple-ish): subtle ambient + tighter contact shadow
  shadow: "0 10px 26px rgba(0,0,0,.30), 0 2px 6px rgba(0,0,0,.20)",
  shadowSoft: "0 6px 16px rgba(0,0,0,.22), 0 1px 4px rgba(0,0,0,.16)",
  shadowCard: "0 18px 40px rgba(0,0,0,.34), 0 4px 10px rgba(0,0,0,.22)",
  shadowSm: "0 6px 16px rgba(0,0,0,.22), 0 1px 4px rgba(0,0,0,.16)",
  shadowMd: "0 10px 26px rgba(0,0,0,.30), 0 2px 6px rgba(0,0,0,.20)",
  shadowLg: "0 18px 40px rgba(0,0,0,.34), 0 4px 10px rgba(0,0,0,.22)",
  shadowControl: "inset 0 1px 0 rgba(255,255,255,.10), 0 8px 20px rgba(0,0,0,.22)",
  shadowControlFocus: "0 0 0 1px rgba(255,255,255,.14), 0 0 10px rgba(0,0,0,.20)",

  // Rings (focus/active states)
  ring: "0 0 0 1px rgba(255,255,255,.10)",
  ringStrong: "0 0 0 1px rgba(255,255,255,.16)",

  // Backdrop blur hint (used in CSS if you want)
  blur: "14px",
  cardBlur: "16px",
  controlBlur: "10px",

  // Premium surfaces (optional, but used for consistent “Apple glass”)
  surface: "rgba(255,255,255,.06)",
  surface2: "rgba(255,255,255,.09)",
  surface3: "rgba(255,255,255,.12)",
  surface1: "rgba(255,255,255,.06)",
  borderSubtle: "rgba(255,255,255,.14)",
  borderStrong: "rgba(255,255,255,.20)",
  textStrong: "rgba(255,255,255,.94)",
  text1: "rgba(255,255,255,.94)",
  text2: "rgba(255,255,255,.66)",
  text3: "rgba(255,255,255,.46)",
  // Kebab-case aliases used in CSS
  "surface-1": "rgba(255,255,255,.06)",
  "surface-2": "rgba(255,255,255,.09)",
  "surface-3": "rgba(255,255,255,.12)",
  "border-subtle": "rgba(255,255,255,.14)",
  "border-strong": "rgba(255,255,255,.20)",
  "text-strong": "rgba(255,255,255,.94)",
  "text-1": "rgba(255,255,255,.94)",
  "text-2": "rgba(255,255,255,.66)",
  "text-3": "rgba(255,255,255,.46)",
  "shadow-soft": "0 6px 16px rgba(0,0,0,.22), 0 1px 4px rgba(0,0,0,.16)",
  "shadow-card": "0 18px 40px rgba(0,0,0,.34), 0 4px 10px rgba(0,0,0,.22)",
  "shadow-sm": "0 6px 16px rgba(0,0,0,.22), 0 1px 4px rgba(0,0,0,.16)",
  "shadow-md": "0 10px 26px rgba(0,0,0,.30), 0 2px 6px rgba(0,0,0,.20)",
  "shadow-lg": "0 18px 40px rgba(0,0,0,.34), 0 4px 10px rgba(0,0,0,.22)",
  danger: "#FB7185",
  warning: "#FBBF24",
  success: "#34D399",

  // Card + control tokens
  cardBg: "var(--surface-1)",
  cardBorder: "var(--border-subtle)",
  cardShadow: "var(--shadow-md)",
  cardRadius: "20px",
  controlBg: "var(--surface-1)",
  controlBgHover: "var(--surface-2)",
  controlBgActive: "var(--surface-3)",
  controlBorder: "var(--border-subtle)",
  controlBorderStrong: "var(--border-strong)",
  controlInset: "inset 0 1px 1px rgba(255,255,255,.05)",
  controlText: "var(--text-1)",
  controlPlaceholder: "var(--text-3)",
  controlRadius: "14px",
  controlHeight: "44px",

  // Buttons + chips
  buttonHeight: "40px",
  buttonRadius: "14px",
  buttonDisabledOpacity: "0.55",
  buttonGhostBg: "transparent",
  buttonGhostBorder: "var(--border-subtle)",
  buttonGhostText: "var(--text-1)",
  buttonSecondaryBg: "var(--surface-2)",
  buttonSecondaryBorder: "var(--border-strong)",
  buttonSecondaryText: "var(--text-1)",
  buttonDangerBg: "rgba(251,113,133,.95)",
  buttonDangerBorder: "rgba(251,113,133,.55)",
  buttonDangerText: "#FFFFFF",
  iconBtnBg: "rgba(255,255,255,.07)",
  iconBtnBorder: "rgba(255,255,255,.16)",
  iconBtnText: "rgba(255,255,255,.82)",
  iconBtnHoverBg: "rgba(255,255,255,.10)",

  // Menu tokens
  menuBg: "rgba(12,14,18,.92)",
  menuBorder: "rgba(255,255,255,.16)",
  menuShadow: "var(--shadow-sm)",
  menuOptionHover: "rgba(255,255,255,.05)",
  controlDisabledOpacity: "0.6",

  // Small UI tokens
  badgeBg: "rgba(255,255,255,.07)",
  badgeBorder: "rgba(255,255,255,.16)",
  badgeText: "rgba(255,255,255,.80)",
  chipBg: "rgba(255,255,255,.05)",
  chipHoverBg: "rgba(255,255,255,.08)",
  hintBg: "rgba(255,255,255,.04)",
  hintBorder: "rgba(255,255,255,.10)",
  divider: "rgba(255,255,255,.08)",
  kpiBg: "rgba(0,0,0,.22)",
  kpiBorder: "rgba(255,255,255,.14)",
  textSubtle: "rgba(255,255,255,.58)",
  linkBtnText: "rgba(255,255,255,.86)",
  dragHandleBg: "rgba(255,255,255,.05)",
  dragHandleText: "rgba(255,255,255,.74)",
  progressTrackBg: "rgba(255,255,255,.14)",
  progressFillBg: "rgba(255,255,255,.92)",
  checkRowBorder: "rgba(255,255,255,.10)",
  checkRowBg: "rgba(255,255,255,.035)",
  checkRowHoverBg: "rgba(255,255,255,.055)",
  panelBorder: "rgba(255,255,255,.10)",
  panelBg: "rgba(255,255,255,.035)",
  panelFooterBg: "rgba(5,6,10,.65)",
  panelFooterBorder: "rgba(255,255,255,.10)",
  editDayOptionBg: "rgba(255,255,255,.05)",
  overlayBackdrop: "rgba(0,0,0,.52)",
  overlaySheetBackdrop: "rgba(0,0,0,.40)",
  overlayTransparent: "rgba(0,0,0,0)",
  overlayBlur: "6px",
  panelFooterBlur: "10px",
  pulseBorder: "rgba(255,255,255,.22)",
  drawerShadow: "var(--shadow-lg)",

  // Navigation
  navShadow: "var(--shadow-md)",
  navBtnBorder: "rgba(255,255,255,.10)",
  navBtnText: "rgba(255,255,255,.68)",
  navBtnHoverBg: "rgba(255,255,255,.06)",
  navBtnActiveBg: "rgba(255,255,255,.90)",
  navBtnActiveText: "#000000",
  navBtnActiveShadow: "0 8px 24px rgba(0,0,0,.20)",
  navGearBg: "rgba(255,255,255,.08)",
  navGearText: "rgba(255,255,255,.82)",
  navGearHoverBg: "rgba(255,255,255,.14)",
  navGearActiveBg: "rgba(255,255,255,.90)",
  navGearActiveText: "#000000",
  navGearActiveShadow: "0 8px 24px rgba(0,0,0,.20)",
  railAddBg: "rgba(255,255,255,.035)",
  railAddShadow: "var(--shadow-sm)",

  // Selects (liquid-style)
  liquidSelectBg: "rgba(255,255,255,.07)",
  liquidSelectBorder: "rgba(255,255,255,.20)",
  liquidSelectShadow: "inset 0 1px 0 rgba(255,255,255,.16), 0 12px 26px rgba(0,0,0,.24)",
  liquidSelectBlur: "14px",

  // Accent + danger tints (overridden in applyThemeTokens)
  accentTintSoft: "rgba(255,255,255,.08)",
  accentTint: "rgba(255,255,255,.12)",
  accentTintStrong: "rgba(255,255,255,.16)",
  accentTintStrongest: "rgba(255,255,255,.20)",
  accentBorder: "rgba(255,255,255,.32)",
  accentBorderStrong: "rgba(255,255,255,.26)",
  hintAccentText: "rgba(255,255,255,.88)",
  dangerTint: "rgba(251,113,133,.10)",
  dangerBorder: "rgba(251,113,133,.32)",
  hintDangerText: "rgba(255,255,255,.90)",
  menuOptionSelectedStrong: "rgba(255,255,255,.18)",
  menuOptionSelectedBorder: "rgba(255,255,255,.26)",

  // Form checkboxes
  sessionCheckBorder: "rgba(255,255,255,.28)",
  sessionCheckBg: "rgba(255,255,255,.07)",
  sessionCheckMark: "#111111",
  textOnLight: "#000000",

  // Background motion helpers
  bgVignetteOpacity: "0.68",
  bgNoiseOpacity: "0.18",
  bgStripesOpacity: "0.08",
  bgNoiseBlend: "soft-light",
  bgStripesBlend: "soft-light",
  "bg-vignette-opacity": "0.68",
  "bg-noise-opacity": "0.18",
  "bg-stripes-opacity": "0.08",
  "bg-noise-blend": "soft-light",
  "bg-stripes-blend": "soft-light",
  backgroundSize: "150% 150%",
  backgroundPosition: "0% 0%",
  backgroundVignetteOpacity: "0.68",
  backgroundGrainOpacity: "0.18",
  backgroundGrainBlend: "soft-light",
  // Kebab-case aliases for CSS vars used in index.css
  "background-size": "150% 150%",
  "background-position": "0% 0%",
  "background-vignette-opacity": "0.68",
  "background-grain-opacity": "0.18",
  "background-grain-blend": "soft-light",
  bgNoise: "var(--backgroundGrain)",
  bgStripes:
    "repeating-linear-gradient(90deg, rgba(255,255,255,var(--bg-stripes-opacity, 0.12)) 0px, rgba(255,255,255,var(--bg-stripes-opacity, 0.12)) 1px, rgba(255,255,255,0) 1px, rgba(255,255,255,0) 14px)",
  "bg-noise": "var(--backgroundGrain)",
  "bg-stripes":
    "repeating-linear-gradient(90deg, rgba(255,255,255,var(--bg-stripes-opacity, 0.12)) 0px, rgba(255,255,255,var(--bg-stripes-opacity, 0.12)) 1px, rgba(255,255,255,0) 1px, rgba(255,255,255,0) 14px)",

  // Layout + spacing
  "space-4": "4px",
  "space-6": "6px",
  "space-8": "8px",
  "space-10": "10px",
  "space-12": "12px",
  "space-14": "14px",
  "space-16": "16px",
  "space-18": "18px",
  "space-20": "20px",
  "space-24": "24px",
  "space-32": "32px",
  "radius-8": "8px",
  "radius-12": "12px",
  "radius-16": "16px",
  "radius-22": "20px",
  "radius-pill": "999px",
  "radius-card": "20px",
  "radius-btn": "14px",
  "radius-input": "14px",
  "radius-chip": "14px",
  "input-height": "44px",
  "btn-height": "40px",
  "page-max": "420px",
  "page-header-gap": "12px",
  "page-section-gap": "12px",
  "page-top-gap": "8px",
  pageTitleMarginTop: "6px",
  pageTitleToSubtitle: "6px",
  subtitleToContent: "12px",
  cardGap: "12px",
  navOffset: "88px",
  navGap: "10px",

  // Typography
  "font-xs": "11px",
  "font-sm": "12px",
  "font-md": "14px",
  "font-lg": "15px",
  "font-title": "24px",
  "font-weight-regular": "400",
  "font-weight-semibold": "600",
  "font-weight-bold": "700",
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
      "radial-gradient(1100px 700px at 18% 8%, rgba(124,58,237,.22), transparent 62%)," +
      "radial-gradient(900px 560px at 92% 18%, rgba(14,165,233,.16), transparent 62%)," +
      "radial-gradient(820px 520px at 45% 110%, rgba(34,197,94,.10), transparent 66%)," +
      "linear-gradient(180deg, #05060A, #05060A)",
    bgBase:
      "radial-gradient(1100px 700px at 18% 8%, rgba(124,58,237,.22), transparent 62%)," +
      "radial-gradient(900px 560px at 92% 18%, rgba(14,165,233,.16), transparent 62%)," +
      "radial-gradient(820px 520px at 45% 110%, rgba(34,197,94,.10), transparent 66%)," +
      "linear-gradient(180deg, #05060A, #05060A)",
    backgroundVignette:
      "radial-gradient(1200px 900px at 50% 55%, rgba(0,0,0,.0), rgba(0,0,0,.54) 72%, rgba(0,0,0,.78) 100%)",
    bgVignette:
      "radial-gradient(1200px 900px at 50% 55%, rgba(0,0,0,.0), rgba(0,0,0,.54) 72%, rgba(0,0,0,.78) 100%)",
    backgroundGrain:
      "repeating-linear-gradient(135deg, rgba(255,255,255,.008) 0px, rgba(255,255,255,.008) 1px, rgba(255,255,255,0) 2px, rgba(255,255,255,0) 8px)",
    bgNoise:
      "repeating-linear-gradient(135deg, rgba(255,255,255,.008) 0px, rgba(255,255,255,.008) 1px, rgba(255,255,255,0) 2px, rgba(255,255,255,0) 8px)",
    bgStripes:
      "repeating-linear-gradient(90deg, rgba(255,255,255,.010) 0px, rgba(255,255,255,.010) 1px, rgba(255,255,255,0) 1px, rgba(255,255,255,0) 16px)",
    bg: "#05060A",
    text: "#F5F7FA",
    muted: "rgba(245,247,250,.68)",
    muted2: "rgba(245,247,250,.46)",
    border: "rgba(255,255,255,.14)",
    glass: "rgba(255,255,255,.06)",
    glass2: "rgba(255,255,255,.10)",
    accent: BRAND_ACCENT,
    glow: BRAND_GLOW,
    ...SHARED,
  },

  // Minimal, premium dark (iOS style): neutral glass with crisp typography.
  midnight: {
    background:
      "radial-gradient(1100px 680px at 18% 10%, rgba(255,255,255,.08), transparent 62%)," +
      "radial-gradient(900px 560px at 92% 28%, rgba(255,255,255,.05), transparent 62%)," +
      "linear-gradient(180deg, #06070C, #05060A)",
    bgBase:
      "radial-gradient(1100px 680px at 18% 10%, rgba(255,255,255,.08), transparent 62%)," +
      "radial-gradient(900px 560px at 92% 28%, rgba(255,255,255,.05), transparent 62%)," +
      "linear-gradient(180deg, #06070C, #05060A)",
    backgroundVignette:
      "radial-gradient(1200px 900px at 50% 55%, rgba(0,0,0,.0), rgba(0,0,0,.56) 74%, rgba(0,0,0,.80) 100%)",
    bgVignette:
      "radial-gradient(1200px 900px at 50% 55%, rgba(0,0,0,.0), rgba(0,0,0,.56) 74%, rgba(0,0,0,.80) 100%)",
    backgroundGrain:
      "repeating-linear-gradient(115deg, rgba(255,255,255,.007) 0px, rgba(255,255,255,.007) 1px, rgba(255,255,255,0) 2px, rgba(255,255,255,0) 8px)",
    bgNoise:
      "repeating-linear-gradient(115deg, rgba(255,255,255,.007) 0px, rgba(255,255,255,.007) 1px, rgba(255,255,255,0) 2px, rgba(255,255,255,0) 8px)",
    bgStripes:
      "repeating-linear-gradient(90deg, rgba(255,255,255,.010) 0px, rgba(255,255,255,.010) 1px, rgba(255,255,255,0) 1px, rgba(255,255,255,0) 16px)",
    bg: "#05060A",
    text: "#F1F4F8",
    muted: "rgba(241,244,248,.64)",
    muted2: "rgba(241,244,248,.42)",
    border: "rgba(241,244,248,.14)",
    glass: "rgba(255,255,255,.055)",
    glass2: "rgba(255,255,255,.09)",
    accent: BRAND_ACCENT,
    glow: BRAND_GLOW,
    ...SHARED,
  },

  // Warm premium: subtle reds/oranges with deep blacks.
  sunset: {
    background:
      "radial-gradient(1100px 680px at 18% 12%, rgba(244,63,94,.16), transparent 62%)," +
      "radial-gradient(980px 560px at 96% 30%, rgba(251,146,60,.12), transparent 62%)," +
      "radial-gradient(820px 540px at 50% 105%, rgba(250,204,21,.08), transparent 66%)," +
      "linear-gradient(180deg, #07060A, #05060A)",
    bgBase:
      "radial-gradient(1100px 680px at 18% 12%, rgba(244,63,94,.16), transparent 62%)," +
      "radial-gradient(980px 560px at 96% 30%, rgba(251,146,60,.12), transparent 62%)," +
      "radial-gradient(820px 540px at 50% 105%, rgba(250,204,21,.08), transparent 66%)," +
      "linear-gradient(180deg, #07060A, #05060A)",
    backgroundVignette:
      "radial-gradient(1200px 900px at 50% 55%, rgba(0,0,0,.0), rgba(0,0,0,.56) 72%, rgba(0,0,0,.82) 100%)",
    bgVignette:
      "radial-gradient(1200px 900px at 50% 55%, rgba(0,0,0,.0), rgba(0,0,0,.56) 72%, rgba(0,0,0,.82) 100%)",
    backgroundGrain:
      "repeating-linear-gradient(135deg, rgba(255,255,255,.008) 0px, rgba(255,255,255,.008) 1px, rgba(255,255,255,0) 2px, rgba(255,255,255,0) 8px)",
    bgNoise:
      "repeating-linear-gradient(135deg, rgba(255,255,255,.008) 0px, rgba(255,255,255,.008) 1px, rgba(255,255,255,0) 2px, rgba(255,255,255,0) 8px)",
    bgStripes:
      "repeating-linear-gradient(90deg, rgba(255,255,255,.010) 0px, rgba(255,255,255,.010) 1px, rgba(255,255,255,0) 1px, rgba(255,255,255,0) 16px)",
    bg: "#05060A",
    text: "#FFF1E6",
    muted: "rgba(255,241,230,.68)",
    muted2: "rgba(255,241,230,.46)",
    border: "rgba(255,241,230,.14)",
    glass: "rgba(255,255,255,.06)",
    glass2: "rgba(255,255,255,.105)",
    accent: "#FB923C",
    glow: "rgba(251,146,60,.30)",
    ...SHARED,
  },

  // Cool premium: blue/cyan depth with glass.
  ocean: {
    background:
      "radial-gradient(1150px 700px at 18% 10%, rgba(6,182,212,.16), transparent 62%)," +
      "radial-gradient(980px 560px at 96% 30%, rgba(59,130,246,.12), transparent 62%)," +
      "radial-gradient(820px 540px at 45% 105%, rgba(34,211,238,.08), transparent 66%)," +
      "linear-gradient(180deg, #05060A, #061225)",
    bgBase:
      "radial-gradient(1150px 700px at 18% 10%, rgba(6,182,212,.16), transparent 62%)," +
      "radial-gradient(980px 560px at 96% 30%, rgba(59,130,246,.12), transparent 62%)," +
      "radial-gradient(820px 540px at 45% 105%, rgba(34,211,238,.08), transparent 66%)," +
      "linear-gradient(180deg, #05060A, #061225)",
    backgroundVignette:
      "radial-gradient(1200px 900px at 50% 55%, rgba(0,0,0,.0), rgba(0,0,0,.56) 72%, rgba(0,0,0,.82) 100%)",
    bgVignette:
      "radial-gradient(1200px 900px at 50% 55%, rgba(0,0,0,.0), rgba(0,0,0,.56) 72%, rgba(0,0,0,.82) 100%)",
    backgroundGrain:
      "repeating-linear-gradient(120deg, rgba(255,255,255,.007) 0px, rgba(255,255,255,.007) 1px, rgba(255,255,255,0) 2px, rgba(255,255,255,0) 8px)",
    bgNoise:
      "repeating-linear-gradient(120deg, rgba(255,255,255,.007) 0px, rgba(255,255,255,.007) 1px, rgba(255,255,255,0) 2px, rgba(255,255,255,0) 8px)",
    bgStripes:
      "repeating-linear-gradient(90deg, rgba(255,255,255,.010) 0px, rgba(255,255,255,.010) 1px, rgba(255,255,255,0) 1px, rgba(255,255,255,0) 16px)",
    bg: "#05060A",
    text: "#F0F7FF",
    muted: "rgba(240,247,255,.64)",
    muted2: "rgba(240,247,255,.42)",
    border: "rgba(240,247,255,.14)",
    glass: "rgba(255,255,255,.055)",
    glass2: "rgba(255,255,255,.095)",
    accent: "#22D3EE",
    glow: "rgba(34,211,238,.30)",
    ...SHARED,
  },

  // Organic premium: greens with depth, still dark.
  forest: {
    background:
      "radial-gradient(1150px 700px at 18% 10%, rgba(34,197,94,.14), transparent 62%)," +
      "radial-gradient(980px 560px at 96% 30%, rgba(16,185,129,.11), transparent 62%)," +
      "radial-gradient(820px 540px at 50% 105%, rgba(132,204,22,.08), transparent 66%)," +
      "linear-gradient(180deg, #05060A, #07140F)",
    bgBase:
      "radial-gradient(1150px 700px at 18% 10%, rgba(34,197,94,.14), transparent 62%)," +
      "radial-gradient(980px 560px at 96% 30%, rgba(16,185,129,.11), transparent 62%)," +
      "radial-gradient(820px 540px at 50% 105%, rgba(132,204,22,.08), transparent 66%)," +
      "linear-gradient(180deg, #05060A, #07140F)",
    backgroundVignette:
      "radial-gradient(1200px 900px at 50% 55%, rgba(0,0,0,.0), rgba(0,0,0,.56) 72%, rgba(0,0,0,.82) 100%)",
    bgVignette:
      "radial-gradient(1200px 900px at 50% 55%, rgba(0,0,0,.0), rgba(0,0,0,.56) 72%, rgba(0,0,0,.82) 100%)",
    backgroundGrain:
      "repeating-linear-gradient(135deg, rgba(255,255,255,.007) 0px, rgba(255,255,255,.007) 1px, rgba(255,255,255,0) 2px, rgba(255,255,255,0) 8px)",
    bgNoise:
      "repeating-linear-gradient(135deg, rgba(255,255,255,.007) 0px, rgba(255,255,255,.007) 1px, rgba(255,255,255,0) 2px, rgba(255,255,255,0) 8px)",
    bgStripes:
      "repeating-linear-gradient(90deg, rgba(255,255,255,.010) 0px, rgba(255,255,255,.010) 1px, rgba(255,255,255,0) 1px, rgba(255,255,255,0) 16px)",
    bg: "#05060A",
    text: "#F1FFF6",
    muted: "rgba(241,255,246,.64)",
    muted2: "rgba(241,255,246,.42)",
    border: "rgba(241,255,246,.14)",
    glass: "rgba(255,255,255,.055)",
    glass2: "rgba(255,255,255,.095)",
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
  const accentBase = normalizedAccent || BRAND_ACCENT;
  const dangerBase = tokens?.danger || "#FB7185";

  // If the user overrides the accent, compute a matching glow automatically.
  const nextGlow = normalizedAccent ? hexToRgba(normalizedAccent, 0.22) : null;
  const accentTintSoft = hexToRgba(accentBase, 0.08);
  const accentTint = hexToRgba(accentBase, 0.12);
  const accentTintStrong = hexToRgba(accentBase, 0.16);
  const accentTintStrongest = hexToRgba(accentBase, 0.2);
  const accentBorder = hexToRgba(accentBase, 0.32);
  const accentBorderStrong = hexToRgba(accentBase, 0.26);
  const menuOptionSelected = hexToRgba(accentBase, 0.14);
  const menuOptionSelectedStrong = hexToRgba(accentBase, 0.18);
  const menuOptionSelectedBorder = hexToRgba(accentBase, 0.26);
  const dangerTint = hexToRgba(dangerBase, 0.1);
  const dangerBorder = hexToRgba(dangerBase, 0.32);
  const accentRing = `0 0 0 1px ${accentBase}, 0 0 6px ${hexToRgba(accentBase, 0.18) || BRAND_GLOW}`;
  const bgBase = tokens.bgBase || tokens.background;
  const bgVignette = tokens.bgVignette || tokens.backgroundVignette;
  const bgNoise = tokens.bgNoise || tokens.backgroundGrain;
  const bgStripes = tokens.bgStripes || tokens["bg-stripes"];

  const finalTokens = {
    ...tokens,
    // Global brand accent everywhere unless the user explicitly overrides it.
    accent: accentBase,
    glow: nextGlow || BRAND_GLOW,
    // Cross-app aliases to avoid hardcoded colors elsewhere.
    accentStrong: accentBase,
    accentPrimary: accentBase,
    focus: accentBase,
    focusGlow: hexToRgba(accentBase, 0.22) || BRAND_GLOW,
    cta: accentBase,
    ctaText: CTA_TEXT_DARK,
    accentText: CTA_TEXT_DARK,
    // Unified focus ring tokens
    focusRing: `0 0 0 1px ${accentBase}, 0 0 6px ${hexToRgba(accentBase, 0.18) || BRAND_GLOW}`,
    controlFocusRing: `0 0 0 1px ${accentBase}, 0 0 5px ${hexToRgba(accentBase, 0.18) || BRAND_GLOW}`,
    controlBorderFocus: accentBase,
    // Primary button tokens (accent-driven)
    buttonBg: accentBase,
    buttonBorder: hexToRgba(accentBase, 0.6) || accentBase,
    buttonText: CTA_TEXT_DARK,
    buttonShadow:
      `0 8px 18px ${hexToRgba(accentBase, 0.22) || "rgba(0,0,0,.22)"}`,
    buttonHoverFilter: "brightness(1.02)",
    buttonActiveFilter: "brightness(0.98)",
    // Menu option selection tint
    menuOptionSelected: menuOptionSelected || tokens.menuOptionSelected,
    menuOptionSelectedStrong: menuOptionSelectedStrong || tokens.menuOptionSelectedStrong,
    menuOptionSelectedBorder: menuOptionSelectedBorder || tokens.menuOptionSelectedBorder,
    accentTintSoft: accentTintSoft || tokens.accentTintSoft,
    accentTint: accentTint || tokens.accentTint,
    accentTintStrong: accentTintStrong || tokens.accentTintStrong,
    accentTintStrongest: accentTintStrongest || tokens.accentTintStrongest,
    accentBorder: accentBorder || tokens.accentBorder,
    accentBorderStrong: accentBorderStrong || tokens.accentBorderStrong,
    dangerTint: dangerTint || tokens.dangerTint,
    dangerBorder: dangerBorder || tokens.dangerBorder,
    accentSoft: accentTintSoft || tokens.accentSoft,
    accentRing,
    "accent-soft": accentTintSoft || tokens.accentSoft,
    "accent-ring": accentRing,
    "bg-base": bgBase,
    "bg-vignette": bgVignette,
    "bg-noise": bgNoise,
    "bg-stripes": bgStripes,
    "bg-vignette-opacity": tokens.bgVignetteOpacity || tokens.backgroundVignetteOpacity,
    "bg-noise-opacity": tokens.bgNoiseOpacity || tokens.backgroundGrainOpacity,
    "bg-stripes-opacity": tokens.bgStripesOpacity,
    "bg-noise-blend": tokens.bgNoiseBlend || tokens.backgroundGrainBlend,
    "bg-stripes-blend": tokens.bgStripesBlend || tokens.backgroundGrainBlend,
    "surface-1": tokens.surface || tokens.surface1,
    "surface-2": tokens.surface2,
    "surface-3": tokens.surface3,
    "border-subtle": tokens.border,
    "border-strong": tokens.borderStrong || tokens["border-strong"],
    "shadow-sm": tokens.shadowSm || tokens.shadowSoft,
    "shadow-md": tokens.shadowMd || tokens.shadow,
    "shadow-lg": tokens.shadowLg || tokens.shadowCard,
    "text-1": tokens.text,
    "text-2": tokens.muted,
    "text-3": tokens.muted2,
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
