// src/pages/Categories.jsx
import React, { useEffect, useMemo } from "react";
import ScreenShell from "./_ScreenShell";
import { Button, Card, AccentItem } from "../components/UI";
import SortableBlocks from "../components/SortableBlocks";
import { getCategoryCounts } from "../logic/pilotage";
import { getCategoryAccentVars } from "../utils/categoryAccent";
import { ensureSystemInboxCategory, normalizeCategory, SYSTEM_INBOX_ID } from "../logic/state";
import { resolveGoalType } from "../domain/goalType";
import { isProcessLinkedToOutcome, linkProcessToOutcome } from "../logic/linking";
import { SUGGESTED_CATEGORIES } from "../utils/categoriesSuggested";
import { canCreateCategory, isPremium } from "../logic/entitlements";
import { safePrompt } from "../utils/dialogs";
import { uid } from "../utils/helpers";
import { buildPlanningSections } from "../utils/librarySections";

// TOUR MAP:
// - primary_action: open category detail
// - key_elements: create button, category list, category cards
// - optional_elements: priority badge
function formatCount(count, singular, plural) {
  if (count === 0) return `0 ${plural}`;
  if (count === 1) return `1 ${singular}`;
  return `${count} ${plural}`;
}

export default function Categories({
  data,
  setData,
  onOpenPaywall,
  onOpenManage,
}) {
  const safeData = data && typeof data === "object" ? data : {};
  const categories = useMemo(
    () => (Array.isArray(safeData.categories) ? safeData.categories : []),
    [safeData.categories]
  );
  const goals = useMemo(() => (Array.isArray(safeData.goals) ? safeData.goals : []), [safeData.goals]);
  const isPremiumPlan = isPremium(safeData);
  const sysCategory = useMemo(
    () => categories.find((c) => c?.id === SYSTEM_INBOX_ID) || categories.find((c) => c?.system) || null,
    [categories]
  );
  const activeCategories = useMemo(
    () => categories.filter((c) => c && c.id !== SYSTEM_INBOX_ID),
    [categories]
  );
  const isEmpty = activeCategories.length === 0;
  const suggestedIds = useMemo(() => {
    const ids = new Set();
    for (const cat of SUGGESTED_CATEGORIES) {
      if (cat?.id) ids.add(cat.id);
    }
    return ids;
  }, []);
  const remainingSuggestions = useMemo(
    () => SUGGESTED_CATEGORIES.filter((s) => s && !categories.some((c) => c?.id === s.id)),
    [categories]
  );
  const defaultSuggestionsCollapsed = activeCategories.length > 0;
  const suggestionsCollapsed =
    typeof safeData?.ui?.librarySuggestionsCollapsed === "boolean"
      ? safeData.ui.librarySuggestionsCollapsed
      : defaultSuggestionsCollapsed;
  const suggestionsOpen = !suggestionsCollapsed;

  useEffect(() => {
    if (sysCategory || typeof setData !== "function") return;
    setData((prev) => ensureSystemInboxCategory(prev).state);
  }, [sysCategory, setData]);

  function activateSuggestedCategory(cat) {
    if (!cat || typeof setData !== "function") return;
    if (!canCreateCategory(safeData)) {
      if (typeof onOpenPaywall === "function") onOpenPaywall("Limite de catégories atteinte.");
      return;
    }
    setData((prev) => {
      const prevCategories = Array.isArray(prev.categories) ? prev.categories : [];
      if (prevCategories.some((c) => c?.id === cat.id)) return prev;
      if (prevCategories.some((c) => String(c?.name || "").trim().toLowerCase() === String(cat.name || "").trim().toLowerCase())) {
        return prev;
      }
      const created = normalizeCategory({ id: cat.id, name: cat.name, color: cat.color }, prevCategories.length);
      return { ...prev, categories: [...prevCategories, created] };
    });
  }

  function deactivateSuggestedCategory(cat) {
    if (!cat || typeof setData !== "function") return;
    setData((prev) => {
      let next = prev;
      const ensured = ensureSystemInboxCategory(next);
      next = ensured.state;
      const sysId = ensured.category?.id || SYSTEM_INBOX_ID;
      const nextCategories = (next.categories || []).filter((c) => c.id !== cat.id);
      const nextGoals = (next.goals || []).map((g) =>
        g && g.categoryId === cat.id ? { ...g, categoryId: sysId } : g
      );
      const nextHabits = (next.habits || []).map((h) =>
        h && h.categoryId === cat.id ? { ...h, categoryId: sysId } : h
      );
      const nextUi = { ...(next.ui || {}) };
      if (nextUi.selectedCategoryId === cat.id) nextUi.selectedCategoryId = sysId;
      if (nextUi.selectedCategoryByView) {
        const scv = { ...nextUi.selectedCategoryByView };
        if (scv.library === cat.id) scv.library = sysId;
        if (scv.plan === cat.id) scv.plan = sysId;
        if (scv.home === cat.id) scv.home = sysId;
        if (scv.pilotage === cat.id) scv.pilotage = sysId;
        nextUi.selectedCategoryByView = scv;
      }
      return {
        ...next,
        categories: nextCategories,
        goals: nextGoals,
        habits: nextHabits,
        ui: nextUi,
      };
    });
  }

  function toggleSuggestionsOpen() {
    if (typeof setData !== "function") return;
    setData((prev) => {
      const prevUi = prev.ui || {};
      const prevCategories = Array.isArray(prev.categories) ? prev.categories : [];
      const hasActive = prevCategories.some((c) => c && c.id !== SYSTEM_INBOX_ID);
      const fallbackCollapsed = hasActive;
      const currentCollapsed =
        typeof prevUi.librarySuggestionsCollapsed === "boolean"
          ? prevUi.librarySuggestionsCollapsed
          : fallbackCollapsed;
      return {
        ...prev,
        ui: { ...prevUi, librarySuggestionsCollapsed: !currentCollapsed },
      };
    });
  }

  // IMPORTANT:
  // This page must not mutate ui.selectedCategoryId (used by Plan / CategoryDetail).
  // We isolate the Library selection using ui.librarySelectedCategoryId.
  const librarySelectedCategoryId = safeData?.ui?.librarySelectedCategoryId || null;
  const homeSelectedCategoryId =
    safeData?.ui?.selectedCategoryByView?.home || safeData?.ui?.selectedCategoryId || null;
  const libraryDetailExpandedId = safeData?.ui?.libraryDetailExpandedId || null;
  const libraryViewSelectedId = librarySelectedCategoryId || homeSelectedCategoryId || null;

  function markLibraryTouched() {
    try {
      sessionStorage.setItem("library:selectedCategoryTouched", "1");
    } catch (err) {
      void err;
    }
  }

  function setLibraryCategory(categoryId) {
    if (!categoryId) return;

    // Keep Library selection local to Library page only
    if (typeof setData === "function") {
      setData((prev) => {
        const prevUi = prev.ui || {};
        const prevSel =
          prevUi.selectedCategoryByView && typeof prevUi.selectedCategoryByView === "object"
            ? prevUi.selectedCategoryByView
            : {};
        return {
          ...prev,
          ui: {
            ...prevUi,
            librarySelectedCategoryId: categoryId,
            selectedCategoryByView: { ...prevSel, library: categoryId },
          },
        };
      });
    }
  }

  function setLibraryDetailExpanded(categoryId) {
    if (typeof setData !== "function") return;
    setData((prev) => {
      const prevUi = prev.ui || {};
      if (prevUi.libraryDetailExpandedId === categoryId) return prev;
      return { ...prev, ui: { ...prevUi, libraryDetailExpandedId: categoryId } };
    });
  }

  function clearLibraryDetailExpanded() {
    if (typeof setData !== "function") return;
    setData((prev) => {
      const prevUi = prev.ui || {};
      if (!prevUi.libraryDetailExpandedId) return prev;
      return { ...prev, ui: { ...prevUi, libraryDetailExpandedId: null } };
    });
  }

  function handleOpenDetail(categoryId) {
    if (!categoryId) return;
    markLibraryTouched();
    if (libraryDetailExpandedId === categoryId) {
      clearLibraryDetailExpanded();
      return;
    }
    setLibraryCategory(categoryId);
    setLibraryDetailExpanded(categoryId);
  }

  function handleCreateCustomCategory() {
    if (!isPremiumPlan) {
      if (typeof onOpenPaywall === "function") onOpenPaywall("Création de catégories personnalisées (Premium).");
      return;
    }
    const name = safePrompt("Nom de la catégorie :", "");
    if (!name || !name.trim()) return;
    const colorInput = safePrompt("Couleur (hex) :", "#7C3AED");
    const color = typeof colorInput === "string" && colorInput.trim() ? colorInput.trim() : "#7C3AED";
    if (typeof setData !== "function") return;
    setData((prev) => {
      const prevCategories = Array.isArray(prev.categories) ? prev.categories : [];
      const exists = prevCategories.some(
        (c) => String(c?.name || "").trim().toLowerCase() === String(name).trim().toLowerCase()
      );
      if (exists) return prev;
      const created = normalizeCategory({ id: `cat_${uid()}`, name: name.trim(), color }, prevCategories.length);
      return { ...prev, categories: [...prevCategories, created] };
    });
  }

  const categoryRailOrder = useMemo(
    () => (Array.isArray(safeData?.ui?.categoryRailOrder) ? safeData.ui.categoryRailOrder : []),
    [safeData?.ui?.categoryRailOrder]
  );
  const orderedUserCategories = useMemo(() => {
    const hasUserOrder = categoryRailOrder.some((id) => id && id !== SYSTEM_INBOX_ID);
    if (hasUserOrder) {
      const map = new Map(activeCategories.map((c) => [c.id, c]));
      const ordered = categoryRailOrder.map((id) => map.get(id)).filter(Boolean);
      const missing = activeCategories.filter((c) => !categoryRailOrder.includes(c.id));
      return ordered.concat(missing);
    }
    const byName = [...activeCategories];
    byName.sort((a, b) =>
      String(a?.name || "").localeCompare(String(b?.name || ""), "fr", { sensitivity: "base" })
    );
    return byName;
  }, [activeCategories, categoryRailOrder]);

  const countsByCategory = useMemo(() => {
    const map = new Map();
    for (const c of categories) {
      const counts = getCategoryCounts({ goals }, c.id);
      map.set(c.id, { habits: counts.processCount, objectives: counts.outcomesCount });
    }
    return map;
  }, [categories, goals]);

  const selectedCategory = categories.find((c) => c.id === libraryDetailExpandedId) || null;
  const outcomeGoals = useMemo(() => {
    if (!selectedCategory?.id) return [];
    return goals.filter((g) => g.categoryId === selectedCategory.id && resolveGoalType(g) === "OUTCOME");
  }, [goals, selectedCategory?.id]);
  const processGoals = useMemo(() => {
    if (!selectedCategory?.id) return [];
    return goals.filter((g) => g.categoryId === selectedCategory.id && resolveGoalType(g) === "PROCESS");
  }, [goals, selectedCategory?.id]);
  const { unlinkedHabits, actionSections } = useMemo(() => {
    const unlinked = [];
    for (const habit of processGoals) {
      const linkedOutcome = outcomeGoals.find((g) => g?.id && isProcessLinkedToOutcome(habit, g.id)) || null;
      if (!linkedOutcome?.id) unlinked.push(habit);
    }
    return {
      unlinkedHabits: unlinked,
      actionSections: buildPlanningSections(processGoals, outcomeGoals),
    };
  }, [processGoals, outcomeGoals]);
  const unlinkedHabitIds = useMemo(() => new Set(unlinkedHabits.map((h) => h.id)), [unlinkedHabits]);
  const linkTargetId =
    (selectedCategory?.mainGoalId && outcomeGoals.some((g) => g.id === selectedCategory.mainGoalId)
      ? selectedCategory.mainGoalId
      : outcomeGoals[0]?.id) || null;

  function renderCategoryItem(category, drag, allowDrag = true) {
    if (!category) return null;
    const counts = countsByCategory.get(category.id) || { habits: 0, objectives: 0 };
    const objectives = counts.objectives;
    const habits = counts.habits;
    const hasContent = objectives > 0 || habits > 0;
    const summary =
      objectives || habits
        ? `${formatCount(objectives, "objectif", "objectifs")} · ${formatCount(habits, "action", "actions")}`
        : "Aucun élément";

    const isSelected = libraryViewSelectedId === category.id;
    const isExpanded = libraryDetailExpandedId === category.id;
    const isSuggested = suggestedIds.has(category.id);
    const detailAccentVars = getCategoryAccentVars(category.color);
    const detailWhy = (category.whyText || "").trim() || "Aucun mini-why pour cette catégorie.";
    const { attributes, listeners, setActivatorNodeRef } = drag || {};

    return (
      <div key={category.id} className="col gap8">
        <AccentItem
          color={category.color}
          selected={isSelected}
          rightSlot={
            <span className="row gap8">
              <span className="small2 textMuted2">
                {isExpanded ? "−" : "+"}
              </span>
              {allowDrag && drag ? (
                <button
                  ref={setActivatorNodeRef}
                  {...listeners}
                  {...attributes}
                  className="dragHandle"
                  aria-label="Réorganiser"
                >
                  ⋮⋮
                </button>
              ) : null}
            </span>
          }
          onClick={() => handleOpenDetail(category.id)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              handleOpenDetail(category.id);
            }
          }}
        >
          <div>
            <div className="itemTitle">{category.name}</div>
            <div className="itemSub">{summary}</div>
          </div>
        </AccentItem>
        {isExpanded ? (
          <div className="col gap8 pl10" style={detailAccentVars}>
            <div className="row rowBetween alignCenter">
              <div className="small2 textMuted2">
                Détails
              </div>
              <div className="row gap8">
                {typeof onOpenManage === "function" ? (
                  <Button variant="ghost" onClick={() => onOpenManage(category.id)}>
                    Gérer
                  </Button>
                ) : null}
                {isSuggested && category.id !== SYSTEM_INBOX_ID ? (
                  <Button
                    variant="ghost"
                    onClick={() => deactivateSuggestedCategory(category)}
                    disabled={hasContent}
                  >
                    Désactiver
                  </Button>
                ) : null}
              </div>
            </div>
            <div className="listItem catAccentRow" style={detailAccentVars}>
              <div className="small2 textMuted">
                Mini-why
              </div>
              <div className="small2 mt6">
                {detailWhy}
              </div>
            </div>
            <div className="col gap8">
              <div className="small2 textMuted">
                Objectifs
              </div>
              {outcomeGoals.length ? (
                <div className="col gap8">
                  {outcomeGoals.map((g) => {
                    const isPrimaryGoal = category.mainGoalId && g.id === category.mainGoalId;
                    return (
                      <div key={g.id} className="listItem catAccentRow" style={detailAccentVars}>
                        <div className="row rowBetween gap8">
                          <div className="itemTitle">{g.title || "Objectif"}</div>
                          {isPrimaryGoal ? (
                            <span className="badge badgeAccent">
                              Prioritaire
                            </span>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="small2">Aucun objectif dans cette catégorie.</div>
              )}
            </div>
            {actionSections.length ? (
              <div className="col gap8">
                <div className="small2 textMuted">Actions</div>
                <div className="col gap8">
                  {actionSections.map((section) => (
                    <div key={section.key} className="col gap8">
                      <div className="small2 textMuted">{section.title}</div>
                      <div className="col gap8">
                        {section.items.map(({ goal, badges }) => {
                          const canLink = unlinkedHabitIds.has(goal.id) && linkTargetId && typeof setData === "function";
                          return (
                            <div key={goal.id} className="listItem catAccentRow" style={detailAccentVars}>
                              <div className="row rowBetween gap8">
                                <div className="col gap6 minW0">
                                  <div className="itemTitle">{goal.title || "Action"}</div>
                                  {badges.length ? (
                                    <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
                                      {badges.map((label, idx) => (
                                        <span key={`${goal.id}-b-${idx}`} className="badge">
                                          {label}
                                        </span>
                                      ))}
                                    </div>
                                  ) : null}
                                </div>
                                {canLink ? (
                                  <Button
                                    variant="ghost"
                                    onClick={() => {
                                      if (!linkTargetId || typeof setData !== "function") return;
                                      setData((prev) => linkProcessToOutcome(prev, goal.id, linkTargetId));
                                    }}
                                  >
                                    Lier
                                  </Button>
                                ) : null}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                  {!linkTargetId && unlinkedHabits.length ? (
                    <div className="small2 textMuted">
                      Ajoute un objectif pour pouvoir lier ces actions.
                    </div>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="small2">Aucune action dans cette catégorie.</div>
            )}
          </div>
        ) : null}
      </div>
    );
  }

  const sysCategoryDisplay = useMemo(
    () => sysCategory || { id: SYSTEM_INBOX_ID, name: "Général", color: "#64748B" },
    [sysCategory]
  );
  const orderedRealCategories = useMemo(
    () => [sysCategoryDisplay, ...orderedUserCategories].filter(Boolean),
    [sysCategoryDisplay, orderedUserCategories]
  );

  return (
      <ScreenShell
        headerTitle={<span data-tour-id="library-title">Bibliothèque</span>}
        headerSubtitle="Catégories"
        backgroundImage={safeData?.profile?.whyImage || ""}
      >
      <div className="stack stackGap12 pageNarrow">
        <Card>
          <div className="p18">
            <div className="row rowBetween alignCenter">
              <div className="sectionTitle">Catégories</div>
              {isPremiumPlan ? (
                <Button variant="ghost" onClick={handleCreateCustomCategory}>
                  Créer une catégorie
                </Button>
              ) : null}
            </div>

            <div className="mt12 col gap10" data-tour-id="library-category-list">
              {isEmpty ? <div className="small2 textMuted">Aucune catégorie active.</div> : null}
              {orderedRealCategories.length ? (
                <SortableBlocks
                  items={orderedRealCategories}
                  getId={(item) => item.id}
                  onReorder={(nextItems) => {
                    if (typeof setData !== "function") return;
                    const nextIds = nextItems.map((item) => item.id).filter(Boolean);
                    const filtered = nextIds.filter((id) => id !== SYSTEM_INBOX_ID);
                    const nextOrder = [SYSTEM_INBOX_ID, ...filtered];
                    setData((prev) => ({
                      ...prev,
                      ui: { ...(prev.ui || {}), categoryRailOrder: nextOrder },
                    }));
                  }}
                  className="col"
                  renderItem={(category, drag) =>
                    renderCategoryItem(category, drag, category?.id !== SYSTEM_INBOX_ID)
                  }
                />
              ) : null}
              {remainingSuggestions.length ? (
                <div className="col gap8">
                  <div
                    className="row rowBetween alignCenter"
                    role="button"
                    tabIndex={0}
                    onClick={toggleSuggestionsOpen}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        toggleSuggestionsOpen();
                      }
                    }}
                  >
                    <div className="small2">
                      Suggestions de catégories
                      <span className="textMuted2"> ({remainingSuggestions.length})</span>
                    </div>
                    <span className="small2 textMuted2">
                      {suggestionsOpen ? "Réduire" : "Afficher"}
                    </span>
                  </div>
                  {suggestionsOpen ? (
                    <div className="col gap8">
                      {remainingSuggestions.map((cat) => (
                        <AccentItem key={cat.id} color={cat.color} tone="neutral">
                          <div className="row rowBetween gap8">
                            <div className="itemTitle">{cat.name}</div>
                            <Button variant="ghost" onClick={() => activateSuggestedCategory(cat)}>
                              Activer
                            </Button>
                          </div>
                        </AccentItem>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </Card>
      </div>
    </ScreenShell>
  );
}
