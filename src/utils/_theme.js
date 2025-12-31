export const THEME_PRESETS = ["aurora", "midnight", "sunset", "ocean", "forest"];

export function getBgPresetCss(preset) {
  switch (preset) {
    case "midnight":
      return "radial-gradient(900px 600px at 20% 0%, rgba(255,255,255,0.10), transparent 55%), radial-gradient(900px 600px at 90% 30%, rgba(255,255,255,0.06), transparent 55%), linear-gradient(180deg, #05060A, #070816)";
    case "sunset":
      return "radial-gradient(900px 600px at 20% 10%, rgba(244,63,94,0.22), transparent 55%), radial-gradient(900px 600px at 90% 30%, rgba(251,146,60,0.18), transparent 55%), radial-gradient(700px 500px at 40% 95%, rgba(250,204,21,0.10), transparent 60%), linear-gradient(180deg, #05060A, #0B0817)";
    case "ocean":
      return "radial-gradient(900px 600px at 20% 0%, rgba(6,182,212,0.22), transparent 55%), radial-gradient(900px 600px at 100% 30%, rgba(59,130,246,0.16), transparent 55%), radial-gradient(700px 500px at 40% 100%, rgba(34,211,238,0.10), transparent 55%), linear-gradient(180deg, #05060A, #061225)";
    case "forest":
      return "radial-gradient(900px 600px at 20% 0%, rgba(34,197,94,0.18), transparent 55%), radial-gradient(900px 600px at 90% 35%, rgba(16,185,129,0.14), transparent 55%), radial-gradient(700px 500px at 50% 100%, rgba(132,204,22,0.10), transparent 60%), linear-gradient(180deg, #05060A, #07140F)";
    case "aurora":
    default:
      return "radial-gradient(1200px 600px at 20% 0%, rgba(124,58,237,0.35), transparent 60%), radial-gradient(900px 500px at 100% 30%, rgba(6,182,212,0.25), transparent 55%), radial-gradient(700px 500px at 40% 100%, rgba(34,197,94,0.18), transparent 55%)";
  }
}

export function getThemeForPage(data, pageId) {
  if (pageId === "home") {
    return data?.ui?.pageThemes?.home || data?.ui?.pageThemeHome || "aurora";
  }
  return "aurora";
}

export function getAccentForPage(data, pageId) {
  if (pageId === "home") {
    return data?.ui?.pageAccents?.home || data?.ui?.accentHome || "#FFFFFF";
  }
  return "#FFFFFF";
}

export function getBackgroundCss({ data, pageId, image }) {
  const preset = getThemeForPage(data, pageId);
  const theme = getBgPresetCss(preset);
  if (!image) return theme;
  return `${theme}, linear-gradient(rgba(5,6,10,0.78), rgba(5,6,10,0.86)), url(${image})`;
}
