const BASE_SUGGESTED = [
  { name: "Santé", color: "#22C55E" },
  { name: "Business", color: "#0EA5E9" },
  { name: "Mental", color: "#A855F7" },
  { name: "Relations", color: "#F97316" },
  { name: "Finance", color: "#10B981" },
  { name: "Travail", color: "#6366F1" },
  { name: "Sport", color: "#F43F5E" },
  { name: "Maison", color: "#14B8A6" },
  { name: "Apprentissage", color: "#EAB308" },
  { name: "Social", color: "#EC4899" },
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
  color: item.color,
}));

export function findSuggestedCategory(id) {
  if (!id) return null;
  return SUGGESTED_CATEGORIES.find((c) => c.id === id) || null;
}

