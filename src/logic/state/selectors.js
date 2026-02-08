export function selectProfile(state) {
  return state && typeof state === "object" && state.profile && typeof state.profile === "object"
    ? state.profile
    : {};
}

export function selectUi(state) {
  return state && typeof state === "object" && state.ui && typeof state.ui === "object" ? state.ui : {};
}

export function selectCategories(state) {
  return Array.isArray(state?.categories) ? state.categories : [];
}

export function selectGoals(state) {
  return Array.isArray(state?.goals) ? state.goals : [];
}

export function selectSelectedCategoryByView(state) {
  const ui = selectUi(state);
  const raw = ui.selectedCategoryByView && typeof ui.selectedCategoryByView === "object" ? ui.selectedCategoryByView : {};
  return {
    home: raw.home || null,
    library: raw.library || null,
    plan: raw.plan || null,
    pilotage: raw.pilotage || null,
  };
}
