import { BRAND_ACCENT, getThemeAccent, getThemeName, listThemes } from "../theme/themeTokens";

export const THEME_PRESETS = listThemes();

// Backgrounds are now exclusively defined by themeTokens.js.
export function getBgPresetCss() {
  return "";
}

export function getThemeForPage(data, pageId) {
  return getThemeName(data, pageId);
}

export function getAccentForPage(data, pageId) {
  return getThemeAccent(data, pageId) || BRAND_ACCENT;
}

export function getBackgroundCss() {
  return "";
}
