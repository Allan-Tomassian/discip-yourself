function hexToRgba(hex, alpha) {
  if (typeof hex !== "string") return null;
  const clean = hex.replace("#", "").trim();
  if (clean.length !== 6) return null;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  if ([r, g, b].some((v) => Number.isNaN(v))) return null;
  const a = typeof alpha === "number" ? alpha : 0.25;
  return `rgba(${r},${g},${b},${a})`;
}

export function getCategoryAccentVars(color, fallback = "#7C3AED") {
  const base = typeof color === "string" && color.trim() ? color.trim() : fallback;
  const glow = hexToRgba(base, 0.12);
  const tint = hexToRgba(base, 0.1);
  return {
    "--accent": base,
    "--accentTint": tint || "rgba(255,255,255,.06)",
    "--catColor": base,
    "--catGlow": glow || "rgba(124,58,237,.12)",
  };
}
