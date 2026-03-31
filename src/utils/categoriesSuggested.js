import { resolveCategoryColor } from "./categoryPalette";

const BASE_SUGGESTED = [
  { name: "Santé" },
  { name: "Business" },
  { name: "Mental" },
  { name: "Relations" },
  { name: "Finance" },
  { name: "Travail" },
  { name: "Sport" },
  { name: "Maison" },
  { name: "Apprentissage" },
  { name: "Social" },
];

function slugify(name) {
  return String(name || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

export const SUGGESTED_CATEGORIES = BASE_SUGGESTED.map((item) => ({
  id: `suggest_${slugify(item.name) || "cat"}`,
  name: item.name,
  color: resolveCategoryColor({ id: `suggest_${slugify(item.name) || "cat"}`, name: item.name }),
}));

export function findSuggestedCategory(id) {
  if (!id) return null;
  return SUGGESTED_CATEGORIES.find((c) => c.id === id) || null;
}
