export const DEFAULT_THEME = "discipline";
export const BRAND_ACCENT = "#4C7DFF";

const IS_DEV = typeof import.meta !== "undefined" && import.meta.env && import.meta.env.DEV;
let warnedAccentOverride = false;

const FOUNDATION_RUNTIME_KEYS = [
  "accent",
  "glow",
  "accentStrong",
  "accentPrimary",
  "accentSecondary",
  "focus",
  "focusGlow",
  "cta",
  "ctaText",
  "accentText",
  "textOnLight",
  "focusRing",
  "controlFocusRing",
  "controlBorderFocus",
  "buttonBg",
  "buttonBorder",
  "buttonText",
  "buttonShadow",
  "buttonHoverFilter",
  "buttonActiveFilter",
  "menuOptionSelected",
  "menuOptionSelectedStrong",
  "menuOptionSelectedBorder",
  "accentTintSoft",
  "accentTint",
  "accentTintStrong",
  "accentTintStrongest",
  "accentBorder",
  "accentBorderStrong",
  "dangerTint",
  "dangerBorder",
  "accentSoft",
  "accentRing",
  "bg-base",
  "bg-vignette",
  "bg-noise",
  "bg-stripes",
  "bg-vignette-opacity",
  "bg-noise-opacity",
  "bg-stripes-opacity",
  "bg-noise-blend",
  "bg-stripes-blend",
  "surface-1",
  "surface-2",
  "surface-3",
  "surface-primary",
  "surface-elevated",
  "background-primary",
  "background-secondary",
  "background-tertiary",
  "border-subtle",
  "border-strong",
  "shadow-sm",
  "shadow-md",
  "shadow-lg",
  "text-1",
  "text-2",
  "text-3",
  "text-primary",
  "text-secondary",
  "text-muted",
  "background-size",
  "background-position",
];

export const THEME_TOKENS = Object.freeze({
  [DEFAULT_THEME]: Object.freeze({
    accent: BRAND_ACCENT,
  }),
});

function warnAccentOverride(value) {
  if (!IS_DEV || warnedAccentOverride) return;
  warnedAccentOverride = true;
  // eslint-disable-next-line no-console
  console.warn("[theme] Accent override ignored (brand-locked).", { value });
}

function clearLegacyThemeOverrides(root) {
  FOUNDATION_RUNTIME_KEYS.forEach((key) => root.style.removeProperty(`--${key}`));
}

export function listThemes() {
  return [DEFAULT_THEME];
}

export function getThemeName(data, page = "home") {
  void data;
  void page;
  return DEFAULT_THEME;
}

export function getThemeAccent(data, page = "home") {
  void data;
  void page;
  return BRAND_ACCENT;
}

export function resolveThemeTokens(themeName) {
  void themeName;
  return THEME_TOKENS[DEFAULT_THEME];
}

export function applyThemeTokens(themeName, accentOverride) {
  void themeName;
  if (typeof document === "undefined") return;

  if (accentOverride && accentOverride !== BRAND_ACCENT) {
    warnAccentOverride(accentOverride);
  }

  const root = document.documentElement;
  clearLegacyThemeOverrides(root);
  root.style.setProperty("--accent", BRAND_ACCENT);
  root.style.setProperty("--accentPrimary", BRAND_ACCENT);
  root.style.setProperty("--accent-primary", BRAND_ACCENT);
  root.dataset.theme = DEFAULT_THEME;
  root.dataset.accent = BRAND_ACCENT;

  try {
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "theme-color");
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", BRAND_ACCENT);
  } catch (error) {
    void error;
  }
}

export function applyThemeFromState(data, page = "home") {
  void data;
  void page;
  applyThemeTokens(DEFAULT_THEME, BRAND_ACCENT);
}
