const DEFAULT_ACCENT = "#5B8CFF";
const DEFAULT_SECONDARY = "#7C5CFF";

const CATEGORY_GRADIENTS = [
  { match: ["sport", "sports", "fitness"], colors: ["#3aa0ff", "#6366f1"] },
  { match: ["business", "travail", "work", "career"], colors: ["#6366f1", "#8b5cf6"] },
  { match: ["social"], colors: ["#f59e0b", "#ef4444"] },
  { match: ["apprentissage", "learning", "study", "education"], colors: ["#14b8a6", "#3aa0ff"] },
  { match: ["mental", "mindset"], colors: ["#8b5cf6", "#ec4899"] },
  { match: ["finance", "finances", "argent", "money"], colors: ["#22c55e", "#3aa0ff"] },
  { match: ["relation", "relations", "relationship"], colors: ["#fb7185", "#f59e0b"] },
  { match: ["maison", "home", "house"], colors: ["#94a3b8", "#6366f1"] },
];

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

function normalizeCategoryName(input) {
  if (typeof input !== "string") return "";
  return input
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function resolveCategoryGradient(name, baseColor) {
  const normalizedName = normalizeCategoryName(name);
  const preset = CATEGORY_GRADIENTS.find((entry) =>
    entry.match.some((candidate) => normalizedName.includes(candidate))
  );
  if (preset) return preset.colors;
  const primary = normalizeHex(baseColor) || DEFAULT_ACCENT;
  const secondary = mixHex(primary, DEFAULT_SECONDARY, 0.42);
  return [primary, secondary];
}

export function getCategoryAccentVars(categoryOrColor, fallback = DEFAULT_ACCENT) {
  const category =
    categoryOrColor && typeof categoryOrColor === "object" && !Array.isArray(categoryOrColor)
      ? categoryOrColor
      : null;
  const baseColor =
    normalizeHex(category?.color) ||
    normalizeHex(typeof categoryOrColor === "string" ? categoryOrColor : "") ||
    normalizeHex(fallback) ||
    DEFAULT_ACCENT;
  const gradientColors = resolveCategoryGradient(category?.name || category?.label || "", baseColor);
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
