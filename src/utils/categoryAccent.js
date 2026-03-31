import { DEFAULT_CATEGORY_COLOR, resolveCategoryPalette } from "./categoryPalette";

const DEFAULT_ACCENT = DEFAULT_CATEGORY_COLOR;
const DEFAULT_SECONDARY = "#7C5CFF";
const WARNING_ACCENT = "#f59e0b";
const DANGER_ACCENT = "#ef4444";
const CATEGORY_BASE_SURFACE = "#0f1115";

function normalizeHex(hex) {
  if (typeof hex !== "string") return null;
  const raw = hex.trim().replace(/^#/, "");
  if (raw.length === 3) {
    const expanded = `${raw[0]}${raw[0]}${raw[1]}${raw[1]}${raw[2]}${raw[2]}`;
    return /^[0-9a-fA-F]{6}$/.test(expanded) ? `#${expanded.toUpperCase()}` : null;
  }
  return /^[0-9a-fA-F]{6}$/.test(raw) ? `#${raw.toUpperCase()}` : null;
}

function hexToRgb(hex) {
  const normalized = normalizeHex(hex);
  if (!normalized) return null;
  const raw = normalized.slice(1);
  const r = parseInt(raw.slice(0, 2), 16);
  const g = parseInt(raw.slice(2, 4), 16);
  const b = parseInt(raw.slice(4, 6), 16);
  if ([r, g, b].some((value) => Number.isNaN(value))) return null;
  return { r, g, b };
}

function rgbToHex({ r, g, b }) {
  const toHex = (value) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

function mixHex(baseHex, mixHexValue, weight = 0.5) {
  const base = hexToRgb(baseHex);
  const mix = hexToRgb(mixHexValue);
  if (!base || !mix) return normalizeHex(baseHex) || normalizeHex(mixHexValue) || DEFAULT_ACCENT;
  const ratio = Math.max(0, Math.min(1, Number.isFinite(weight) ? weight : 0.5));
  return rgbToHex({
    r: base.r + (mix.r - base.r) * ratio,
    g: base.g + (mix.g - base.g) * ratio,
    b: base.b + (mix.b - base.b) * ratio,
  });
}

function hexToRgba(hex, alpha = 0.16) {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  const safeAlpha = Math.max(0, Math.min(1, Number.isFinite(alpha) ? alpha : 0.16));
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${safeAlpha})`;
}

function resolveCategoryGradient(name, baseColor) {
  const palette = resolveCategoryPalette(name, baseColor);
  const primary = normalizeHex(palette.primary) || normalizeHex(baseColor) || DEFAULT_ACCENT;
  const secondary = normalizeHex(palette.secondary) || mixHex(primary, DEFAULT_SECONDARY, 0.42);
  return [primary, secondary];
}

function resolveUiLevel(level) {
  if (level === "focus") {
    return {
      tintAlpha: 0.2,
      tintSecondaryAlpha: 0.1,
      borderAlpha: 0.3,
      borderStrongAlpha: 0.44,
      glowAlpha: 0.22,
      bandAlpha: 0.18,
      focusStartAlpha: 0.22,
      focusEndAlpha: 0.12,
    };
  }
  if (level === "surface") {
    return {
      tintAlpha: 0.16,
      tintSecondaryAlpha: 0.08,
      borderAlpha: 0.24,
      borderStrongAlpha: 0.34,
      glowAlpha: 0.18,
      bandAlpha: 0.16,
      focusStartAlpha: 0.18,
      focusEndAlpha: 0.09,
    };
  }
  return {
    tintAlpha: 0.12,
    tintSecondaryAlpha: 0.06,
    borderAlpha: 0.3,
    borderStrongAlpha: 0.38,
    glowAlpha: 0.16,
    bandAlpha: 0.14,
    focusStartAlpha: 0.16,
    focusEndAlpha: 0.08,
  };
}

function applyTone(primary, secondary, stateTone = "default") {
  if (stateTone === "weak") {
    return {
      primary: mixHex(primary, CATEGORY_BASE_SURFACE, 0.26),
      secondary: mixHex(secondary, CATEGORY_BASE_SURFACE, 0.22),
      alphaMultiplier: 0.76,
    };
  }
  if (stateTone === "critical") {
    const criticalPrimary = mixHex(mixHex(primary, WARNING_ACCENT, 0.12), CATEGORY_BASE_SURFACE, 0.1);
    const criticalSecondary = mixHex(mixHex(secondary, DANGER_ACCENT, 0.14), CATEGORY_BASE_SURFACE, 0.1);
    return {
      primary: criticalPrimary,
      secondary: criticalSecondary,
      alphaMultiplier: 0.88,
    };
  }
  return { primary, secondary, alphaMultiplier: 1 };
}

export function resolveCategoryStateTone({ value = null, done = null, expected = null } = {}) {
  if (Number.isFinite(expected) && expected > 0 && Number.isFinite(done) && done <= 0) return "critical";
  if (!Number.isFinite(value)) return "default";
  if (value < 0.25) return "critical";
  if (value < 0.5) return "weak";
  return "default";
}

export function getCategoryAccentVars(categoryOrColor, fallback = DEFAULT_ACCENT) {
  const category =
    categoryOrColor && typeof categoryOrColor === "object" && !Array.isArray(categoryOrColor)
      ? categoryOrColor
      : null;
  const palette = resolveCategoryPalette(category || categoryOrColor, fallback);
  const baseColor = normalizeHex(palette.primary) || normalizeHex(fallback) || DEFAULT_ACCENT;
  const gradientColors = resolveCategoryGradient(category || categoryOrColor, baseColor);
  const primary = gradientColors[0] || baseColor;
  const secondary = gradientColors[1] || mixHex(primary, DEFAULT_SECONDARY, 0.42);
  const tint = hexToRgba(primary, 0.16) || "rgba(255,255,255,0.06)";
  const glow = hexToRgba(primary, 0.18) || "rgba(91,140,255,0.18)";
  const gradient = `linear-gradient(135deg, ${primary}, ${secondary})`;

  return {
    "--accent": primary,
    "--accentSecondary": secondary,
    "--accentTint": tint,
    "--accent-soft": tint,
    "--catColor": primary,
    "--catGlow": glow,
    "--categoryGradient": gradient,
    "--category-gradient": gradient,
  };
}

export function getCategoryUiVars(categoryOrColor, options = {}) {
  const { level = "pill", stateTone = "default", fallback = DEFAULT_ACCENT } =
    options && typeof options === "object" ? options : {};
  const baseVars = getCategoryAccentVars(categoryOrColor, fallback);
  const levelConfig = resolveUiLevel(level);
  const toned = applyTone(baseVars["--accent"], baseVars["--accentSecondary"], stateTone);
  const primary = toned.primary || baseVars["--accent"];
  const secondary = toned.secondary || baseVars["--accentSecondary"];
  const alphaMultiplier = toned.alphaMultiplier || 1;
  const tint = hexToRgba(primary, levelConfig.tintAlpha * alphaMultiplier) || baseVars["--accentTint"];
  const tintSecondary =
    hexToRgba(secondary, levelConfig.tintSecondaryAlpha * alphaMultiplier) ||
    hexToRgba(primary, levelConfig.tintSecondaryAlpha * alphaMultiplier) ||
    baseVars["--accentTint"];
  const border = hexToRgba(primary, levelConfig.borderAlpha) || baseVars["--accentTint"];
  const borderStrong = hexToRgba(primary, levelConfig.borderStrongAlpha) || border;
  const glow = hexToRgba(primary, levelConfig.glowAlpha) || baseVars["--catGlow"];
  const band = hexToRgba(primary, levelConfig.bandAlpha * alphaMultiplier) || tint;
  const focusStart = hexToRgba(primary, levelConfig.focusStartAlpha * alphaMultiplier) || tint;
  const focusEnd = hexToRgba(secondary, levelConfig.focusEndAlpha * alphaMultiplier) || tintSecondary;
  const gradient = `linear-gradient(135deg, ${primary}, ${secondary})`;

  return {
    ...baseVars,
    "--accent": primary,
    "--accentSecondary": secondary,
    "--accentTint": tint,
    "--accent-soft": tint,
    "--catColor": primary,
    "--catGlow": glow,
    "--categoryGradient": gradient,
    "--category-gradient": gradient,
    "--categoryUiLevel": level,
    "--categoryUiStateTone": stateTone,
    "--categoryUiTint": tint,
    "--categoryUiTintSecondary": tintSecondary,
    "--categoryUiBorder": border,
    "--categoryUiBorderStrong": borderStrong,
    "--categoryUiGlow": glow,
    "--categoryUiBand": band,
    "--categoryUiFocusStart": focusStart,
    "--categoryUiFocusEnd": focusEnd,
    "--categoryUiGradient": gradient,
  };
}
