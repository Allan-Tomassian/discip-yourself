export const TOTEM_V1_VERSION = 1;

export const TOTEM_COLOR_CATALOG = [
  { id: "eagle-amber", label: "Ambre", color: "#F59E0B", price: 120 },
  { id: "eagle-sky", label: "Azur", color: "#38BDF8", price: 120 },
  { id: "eagle-forest", label: "Forêt", color: "#34D399", price: 120 },
  { id: "eagle-violet", label: "Violet", color: "#A78BFA", price: 120 },
  { id: "eagle-rose", label: "Rose", color: "#FB7185", price: 120 },
  { id: "eagle-silver", label: "Argent", color: "#94A3B8", price: 120 },
];

export const TOTEM_ACCESSORY_CATALOG = [
  { id: "cap", label: "Casquette", emoji: "🧢", price: 200 },
  { id: "cape", label: "Cape", emoji: "🧣", price: 260 },
  { id: "glasses", label: "Lunettes", emoji: "🕶️", price: 220 },
  { id: "badge", label: "Badge", emoji: "🏅", price: 240 },
  { id: "headphones", label: "Casque", emoji: "🎧", price: 280 },
  { id: "crown", label: "Couronne", emoji: "👑", price: 400 },
];

const DEFAULT_BODY_COLOR = TOTEM_COLOR_CATALOG[0].color;

function asObject(value) {
  return value && typeof value === "object" ? value : {};
}

function toSafeInt(value, fallback = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.floor(parsed));
}

function sanitizeUniqueList(list, allowedIds) {
  const unique = [];
  const seen = new Set();
  const allowed = new Set(Array.isArray(allowedIds) ? allowedIds : []);
  for (const value of Array.isArray(list) ? list : []) {
    if (typeof value !== "string") continue;
    const id = value.trim();
    if (!id || seen.has(id)) continue;
    if (allowed.size && !allowed.has(id)) continue;
    seen.add(id);
    unique.push(id);
  }
  return unique;
}

export function findTotemAccessoryById(accessoryId) {
  return TOTEM_ACCESSORY_CATALOG.find((item) => item.id === accessoryId) || null;
}

export function getTotemAccessoryEmoji(accessoryIds = []) {
  const first = Array.isArray(accessoryIds) ? accessoryIds[0] : "";
  const hit = findTotemAccessoryById(first);
  return hit?.emoji || "";
}

export function ensureTotemV1(rawTotem) {
  const raw = asObject(rawTotem);
  const rawEquipped = asObject(raw.equipped);
  const rawOwned = asObject(raw.owned);

  const allowedColors = TOTEM_COLOR_CATALOG.map((item) => item.id);
  const colorById = new Map(TOTEM_COLOR_CATALOG.map((item) => [item.id, item.color]));
  const allowedAccessories = TOTEM_ACCESSORY_CATALOG.map((item) => item.id);

  const ownedColorIds = sanitizeUniqueList(rawOwned.colors, allowedColors);
  if (!ownedColorIds.includes(TOTEM_COLOR_CATALOG[0].id)) {
    ownedColorIds.unshift(TOTEM_COLOR_CATALOG[0].id);
  }

  const ownedAccessories = sanitizeUniqueList(rawOwned.accessories, allowedAccessories);

  let equippedBodyColor = typeof rawEquipped.bodyColor === "string" ? rawEquipped.bodyColor.trim() : "";
  if (equippedBodyColor && !equippedBodyColor.startsWith("#")) {
    equippedBodyColor = colorById.get(equippedBodyColor) || "";
  }
  const allowedColorHex = new Set(TOTEM_COLOR_CATALOG.map((item) => item.color.toLowerCase()));
  if (!equippedBodyColor || !allowedColorHex.has(equippedBodyColor.toLowerCase())) {
    equippedBodyColor = DEFAULT_BODY_COLOR;
  }

  const equippedAccessoryIds = sanitizeUniqueList(rawEquipped.accessoryIds, ownedAccessories);

  return {
    version: TOTEM_V1_VERSION,
    equipped: {
      bodyColor: equippedBodyColor,
      accessoryIds: equippedAccessoryIds,
    },
    owned: {
      colors: ownedColorIds,
      accessories: ownedAccessories,
    },
    lastAnimationAt: toSafeInt(raw.lastAnimationAt, 0),
    animationEnabled: raw.animationEnabled !== false,
  };
}
