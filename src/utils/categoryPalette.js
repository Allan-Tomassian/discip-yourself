const DEFAULT_CATEGORY_COLOR = "#4F7CFF";

const CATEGORY_PRESETS = Object.freeze([
  {
    key: "general",
    primary: "#6F7C91",
    secondary: "#556273",
    aliases: ["general", "generale", "général", "generique", "sys inbox", "sys_inbox", "inbox"],
  },
  {
    key: "business",
    primary: "#4F7CFF",
    secondary: "#3E5FCF",
    aliases: ["business", "biz", "company", "entreprise", "startup"],
  },
  {
    key: "travail",
    primary: "#2FA7B0",
    secondary: "#327F93",
    aliases: ["travail", "work", "job", "career", "productivite", "productivité", "productivity", "cat work", "cat_work"],
  },
  {
    key: "health",
    primary: "#35B36E",
    secondary: "#2C8D63",
    aliases: ["sante", "santé", "health", "bien etre", "bien-être", "wellness", "cat health", "cat_health"],
  },
  {
    key: "finance",
    primary: "#90A63B",
    secondary: "#6F8732",
    aliases: ["finance", "finances", "argent", "money", "budget"],
  },
  {
    key: "learning",
    primary: "#D4A23A",
    secondary: "#AA7C30",
    aliases: ["apprentissage", "learning", "study", "education", "eduquer", "éducation"],
  },
  {
    key: "relations",
    primary: "#C97C3D",
    secondary: "#A35E39",
    aliases: ["relation", "relations", "relationship", "relationships", "couple", "famille"],
  },
  {
    key: "sport",
    primary: "#D85E74",
    secondary: "#B44962",
    aliases: ["sport", "sports", "fitness", "workout", "entrainement", "entraînement", "cat sport", "cat_sport"],
  },
  {
    key: "social",
    primary: "#B75C98",
    secondary: "#8E4C88",
    aliases: ["social", "amis", "communaute", "communauté", "network"],
  },
  {
    key: "mental",
    primary: "#8665E8",
    secondary: "#5F5FCF",
    aliases: ["mental", "mindset", "focus mental", "psychologie"],
  },
  {
    key: "maison",
    primary: "#7D8FA8",
    secondary: "#5D6F87",
    aliases: ["maison", "home", "house", "foyer"],
  },
  {
    key: "personal",
    primary: "#A66C56",
    secondary: "#7F5244",
    aliases: ["personnel", "personal", "perso", "self"],
  },
]);

function normalizeHex(hex) {
  if (typeof hex !== "string") return null;
  const raw = hex.trim().replace(/^#/, "");
  if (raw.length === 3) {
    const expanded = `${raw[0]}${raw[0]}${raw[1]}${raw[1]}${raw[2]}${raw[2]}`;
    return /^[0-9a-fA-F]{6}$/.test(expanded) ? `#${expanded.toUpperCase()}` : null;
  }
  return /^[0-9a-fA-F]{6}$/.test(raw) ? `#${raw.toUpperCase()}` : null;
}

function normalizeToken(value) {
  if (typeof value !== "string") return "";
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildCategorySearchSpace(categoryOrInput) {
  if (!categoryOrInput) return [];
  if (typeof categoryOrInput === "string") {
    const normalized = normalizeToken(categoryOrInput);
    return normalized ? [normalized] : [];
  }
  if (typeof categoryOrInput !== "object" || Array.isArray(categoryOrInput)) return [];

  const rawValues = [
    categoryOrInput.id,
    categoryOrInput.name,
    categoryOrInput.label,
    categoryOrInput.slug,
    categoryOrInput.key,
    categoryOrInput.templateId,
  ];

  const out = new Set();
  for (const rawValue of rawValues) {
    const normalized = normalizeToken(rawValue);
    if (!normalized) continue;
    out.add(normalized);
  }
  return Array.from(out);
}

function searchSpaceMatchesAlias(searchSpace, alias) {
  const normalizedAlias = normalizeToken(alias);
  if (!normalizedAlias) return false;
  return searchSpace.some((entry) => {
    if (entry === normalizedAlias) return true;
    if (entry.includes(normalizedAlias)) return true;
    const tokens = entry.split(" ").filter(Boolean);
    return tokens.includes(normalizedAlias);
  });
}

export function getCategoryPalettePresets() {
  return CATEGORY_PRESETS;
}

export function resolveCategoryPalettePreset(categoryOrInput) {
  const searchSpace = buildCategorySearchSpace(categoryOrInput);
  if (!searchSpace.length) return null;

  for (const preset of CATEGORY_PRESETS) {
    if (preset.aliases.some((alias) => searchSpaceMatchesAlias(searchSpace, alias))) {
      return preset;
    }
  }
  return null;
}

export function pickCategoryPaletteColor(index = 0) {
  const visualPresets = CATEGORY_PRESETS.filter((preset) => preset.key !== "general");
  const safeIndex = Number.isFinite(index) ? Math.abs(Math.trunc(index)) : 0;
  return visualPresets[safeIndex % visualPresets.length]?.primary || DEFAULT_CATEGORY_COLOR;
}

export function resolveCategoryColor(categoryOrInput, fallback = DEFAULT_CATEGORY_COLOR) {
  const preset = resolveCategoryPalettePreset(categoryOrInput);
  if (preset?.primary) return preset.primary;

  if (categoryOrInput && typeof categoryOrInput === "object" && !Array.isArray(categoryOrInput)) {
    const direct =
      normalizeHex(categoryOrInput.color) ||
      normalizeHex(categoryOrInput.accentColor) ||
      normalizeHex(categoryOrInput.hex) ||
      normalizeHex(categoryOrInput.themeColor);
    if (direct) return direct;
  }

  return normalizeHex(typeof categoryOrInput === "string" ? categoryOrInput : "") || normalizeHex(fallback) || DEFAULT_CATEGORY_COLOR;
}

export function resolveCategoryPalette(categoryOrInput, fallback = DEFAULT_CATEGORY_COLOR) {
  const preset = resolveCategoryPalettePreset(categoryOrInput);
  if (preset) {
    return {
      key: preset.key,
      primary: preset.primary,
      secondary: preset.secondary,
      canonical: true,
    };
  }

  const primary = resolveCategoryColor(categoryOrInput, fallback);
  return {
    key: "custom",
    primary,
    secondary: null,
    canonical: false,
  };
}

export { DEFAULT_CATEGORY_COLOR, normalizeHex };
