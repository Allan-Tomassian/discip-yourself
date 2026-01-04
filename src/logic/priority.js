export function isPrimaryCategory(category) {
  return category?.priorityLevel === "primary";
}

export function isPrimaryGoal(goal) {
  return goal?.priority === "prioritaire";
}

export function normalizePriorities(data) {
  if (!data || typeof data !== "object") return data;

  const categories = Array.isArray(data.categories) ? data.categories : [];
  const goals = Array.isArray(data.goals) ? data.goals : [];

  let nextCategories = categories;
  let categoriesChanged = false;
  let primaryCategoryId = null;

  categories.forEach((cat, index) => {
    if (!cat || typeof cat !== "object") return;
    let nextLevel = cat.priorityLevel === "primary" ? "primary" : "normal";
    if (nextLevel === "primary") {
      if (primaryCategoryId) nextLevel = "normal";
      else primaryCategoryId = cat.id || `__idx_${index}`;
    }
    if (cat.priorityLevel !== nextLevel) {
      if (!categoriesChanged) {
        nextCategories = categories.slice();
        categoriesChanged = true;
      }
      nextCategories[index] = { ...cat, priorityLevel: nextLevel };
    }
  });

  let nextGoals = goals;
  let goalsChanged = false;
  const primaryByCategory = new Set();

  goals.forEach((goal, index) => {
    if (!goal || typeof goal !== "object") return;
    const catId = goal.categoryId || null;
    let nextPriority = goal.priority === "prioritaire" || goal.priority === "bonus" ? goal.priority : "secondaire";
    if (nextPriority === "prioritaire") {
      if (primaryByCategory.has(catId)) nextPriority = "secondaire";
      else primaryByCategory.add(catId);
    }
    if (goal.priority !== nextPriority) {
      if (!goalsChanged) {
        nextGoals = goals.slice();
        goalsChanged = true;
      }
      nextGoals[index] = { ...goal, priority: nextPriority };
    }
  });

  if (!categoriesChanged && !goalsChanged) return data;
  return {
    ...data,
    categories: nextCategories,
    goals: nextGoals,
  };
}

export function setPrimaryCategory(data, categoryId) {
  if (!data || typeof data !== "object" || !categoryId) return data;
  const categories = Array.isArray(data.categories) ? data.categories : [];
  let found = false;
  let changed = false;
  const nextCategories = categories.map((cat) => {
    if (!cat || typeof cat !== "object") return cat;
    const nextLevel = cat.id === categoryId ? "primary" : "normal";
    if (cat.id === categoryId) found = true;
    if (cat.priorityLevel !== nextLevel) {
      changed = true;
      return { ...cat, priorityLevel: nextLevel };
    }
    if (!cat.priorityLevel) {
      changed = true;
      return { ...cat, priorityLevel: nextLevel };
    }
    return cat;
  });
  if (!found || !changed) return data;
  return { ...data, categories: nextCategories };
}

export function setPrimaryGoalForCategory(data, categoryId, goalId) {
  if (!data || typeof data !== "object" || !categoryId || !goalId) return data;
  const goals = Array.isArray(data.goals) ? data.goals : [];
  let found = false;
  let changed = false;
  const nextGoals = goals.map((goal) => {
    if (!goal || typeof goal !== "object") return goal;
    if (goal.categoryId !== categoryId) return goal;
    const nextPriority = goal.id === goalId ? "prioritaire" : goal.priority === "prioritaire" ? "secondaire" : goal.priority || "secondaire";
    if (goal.id === goalId) found = true;
    if (goal.priority !== nextPriority || !goal.priority) {
      changed = true;
      return { ...goal, priority: nextPriority };
    }
    return goal;
  });
  if (!found || !changed) return data;
  const nextCategories = (data.categories || []).map((cat) =>
    cat.id === categoryId ? { ...cat, mainGoalId: goalId } : cat
  );
  return { ...data, goals: nextGoals, categories: nextCategories };
}
