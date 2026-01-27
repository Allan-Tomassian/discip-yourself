import React, { useEffect, useState } from "react";
import ScreenShell from "./_ScreenShell";
import { AccentItem, Button, Card, IconButton } from "../components/UI";
import Gauge from "../components/Gauge";
import { getAccentForPage } from "../utils/_theme";
import { safeConfirm, safePrompt } from "../utils/dialogs";
import { addDays, startOfWeekKey, todayKey } from "../utils/dates";
import { isPrimaryCategory, isPrimaryGoal, setPrimaryCategory } from "../logic/priority";
import { resolveGoalType } from "../domain/goalType";
import { linkProcessToOutcome, splitProcessByLink } from "../logic/linking";
import { ensureSystemInboxCategory, SYSTEM_INBOX_ID } from "../logic/state";
import { buildPlanningSections } from "../utils/librarySections";

// TOUR MAP:
// - primary_action: manage goals/actions in a category
// - key_elements: back button, category settings, objectives/actions sections
// - optional_elements: pilotage link, mini-why toggle
const MEASURE_UNITS = {
  money: "€",
  counter: "",
  time: "min",
  energy: "pts",
  distance: "km",
  weight: "kg",
};

export default function CategoryView({
  data,
  setData,
  categoryId,
  onBack,
  onOpenPilotage,
  onOpenProgress,
  onEditItem,
}) {
  const safeData = data && typeof data === "object" ? data : {};
  const categories = Array.isArray(safeData.categories) ? safeData.categories : [];
  const goals = Array.isArray(safeData.goals) ? safeData.goals : [];
  const uiLibraryCategoryId =
    safeData?.ui?.selectedCategoryByView?.library || safeData?.ui?.librarySelectedCategoryId || null;
  const resolvedCategoryId =
    (uiLibraryCategoryId && categories.some((c) => c.id === uiLibraryCategoryId) && uiLibraryCategoryId) ||
    (categoryId && categories.some((c) => c.id === categoryId) && categoryId) ||
    categories[0]?.id ||
    null;
  const category = categories.find((c) => c.id === resolvedCategoryId) || null;
  const [showWhy, setShowWhy] = useState(true);
  const [selectedOutcomeId, setSelectedOutcomeId] = useState(null);
  const [categoryMenuOpen, setCategoryMenuOpen] = useState(false);

  useEffect(() => {
    if (safeData?.ui?.manageScrollTo !== "actions") return;
    if (typeof document === "undefined") return;
    const section = document.querySelector('[data-tour-id="manage-actions-section"]');
    const cta = document.querySelector('[data-tour-id="manage-actions-create"]');
    if (section && typeof section.scrollIntoView === "function") {
      section.scrollIntoView({ behavior: "smooth", block: "start" });
      section.classList.add("flashPulse");
    }
    if (cta) cta.classList.add("flashPulseBtn");
    if (typeof setData === "function") {
      setData((prev) => ({
        ...prev,
        ui: {
          ...(prev.ui || {}),
          manageScrollTo: null,
        },
      }));
    }
    const timeout = window.setTimeout(() => {
      if (section) section.classList.remove("flashPulse");
      if (cta) cta.classList.remove("flashPulseBtn");
    }, 1600);
    return () => window.clearTimeout(timeout);
  }, [safeData?.ui?.manageScrollTo, setData]);

  const outcomeGoals = category?.id
    ? goals.filter((g) => g.categoryId === category.id && resolveGoalType(g) === "OUTCOME")
    : [];

  useEffect(() => {
    if (!category?.id) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedOutcomeId(null);
      return;
    }
    const mainId = category.mainGoalId && outcomeGoals.some((g) => g.id === category.mainGoalId)
      ? category.mainGoalId
      : null;
    const fallback = outcomeGoals[0]?.id || null;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedOutcomeId((prev) => {
      if (prev && outcomeGoals.some((g) => g.id === prev)) return prev;
      return mainId || fallback;
    });
  }, [category?.id, category?.mainGoalId, outcomeGoals]);

  const selectedOutcome = selectedOutcomeId ? outcomeGoals.find((g) => g.id === selectedOutcomeId) || null : null;

  const processGoals = category?.id
    ? goals.filter((g) => g.categoryId === category.id && resolveGoalType(g) === "PROCESS")
    : [];

  const { linked: linkedHabits, unlinked: unlinkedHabits } = !processGoals.length
    ? { linked: [], unlinked: [] }
    : !selectedOutcome?.id
      ? { linked: [], unlinked: processGoals }
      : splitProcessByLink(processGoals, selectedOutcome.id);

  const gaugeGoals = (() => {
    const main = category?.mainGoalId ? outcomeGoals.find((g) => g.id === category.mainGoalId) : null;
    const rest = main ? outcomeGoals.filter((g) => g.id !== main.id) : outcomeGoals;
    return main ? [main, ...rest] : outcomeGoals;
  })();
  const gaugeSlice = gaugeGoals.slice(0, 2);
  const occurrences = Array.isArray(safeData.occurrences) ? safeData.occurrences : [];
  const habitWeekStats = (() => {
    const stats = new Map();
    if (!processGoals.length) return stats;
    const weekStartKey = startOfWeekKey(new Date());
    const weekStartDate = new Date(`${weekStartKey}T12:00:00`);
    const weekKeys = Array.from({ length: 7 }, (_, i) => todayKey(addDays(weekStartDate, i)));
    const weekSet = new Set(weekKeys);

    const occurrenceStats = new Map();
    for (const occ of occurrences) {
      if (!occ || typeof occ.goalId !== "string" || typeof occ.date !== "string") continue;
      if (!weekSet.has(occ.date)) continue;
      const entry = occurrenceStats.get(occ.goalId) || { planned: 0, done: 0 };
      const status = occ.status || "planned";
      if (status !== "skipped") entry.planned += 1;
      if (status === "done") entry.done += 1;
      occurrenceStats.set(occ.goalId, entry);
    }

    for (const h of processGoals) {
      const occ = occurrenceStats.get(h.id) || { planned: 0, done: 0 };
      const planned = occ.planned;
      const done = occ.done;
      const ratio = planned ? Math.min(1, done / planned) : 0;
      stats.set(h.id, { planned, done, ratio });
    }
    return stats;
  })();
  const actionSections = buildPlanningSections([...linkedHabits, ...unlinkedHabits], outcomeGoals);

  function linkHabitToSelectedOutcome(habitId) {
    if (!selectedOutcome?.id || typeof setData !== "function") return;
    setData((prev) => linkProcessToOutcome(prev, habitId, selectedOutcome.id));
  }

  function openPilotage() {
    if (typeof onOpenPilotage === "function") onOpenPilotage();
  }

  function renameCategory() {
    if (!category?.id || typeof setData !== "function") return;
    const nextName = safePrompt("Renommer la catégorie :", category.name || "");
    if (!nextName || !nextName.trim()) return;
    setData((prev) => ({
      ...prev,
      categories: (prev.categories || []).map((cat) =>
        cat.id === category.id ? { ...cat, name: nextName.trim() } : cat
      ),
    }));
  }

  function recolorCategory() {
    if (!category?.id || typeof setData !== "function") return;
    const nextColor = safePrompt("Couleur (hex) :", category.color || "#7C3AED");
    if (!nextColor || !nextColor.trim()) return;
    setData((prev) => ({
      ...prev,
      categories: (prev.categories || []).map((cat) =>
        cat.id === category.id ? { ...cat, color: nextColor.trim() } : cat
      ),
    }));
  }

  function editMiniWhy() {
    if (!category?.id || typeof setData !== "function") return;
    const nextWhy = safePrompt("Mini-why :", category.whyText || "");
    if (nextWhy == null) return;
    setData((prev) => ({
      ...prev,
      categories: (prev.categories || []).map((cat) =>
        cat.id === category.id ? { ...cat, whyText: String(nextWhy) } : cat
      ),
    }));
  }

  function setCategoryPriority() {
    if (!category?.id || typeof setData !== "function") return;
    setData((prev) => setPrimaryCategory(prev, category.id));
  }

  function deleteCategory() {
    if (!category?.id || typeof setData !== "function") return;
    if (category.id === SYSTEM_INBOX_ID) return;
    const ok = safeConfirm("Supprimer cette catégorie ? Les éléments seront déplacés vers Général.");
    if (!ok) return;
    setData((prev) => {
      let next = prev;
      const ensured = ensureSystemInboxCategory(next);
      next = ensured.state;
      const sysId = ensured.category?.id || SYSTEM_INBOX_ID;
      const nextCategories = (next.categories || []).filter((cat) => cat.id !== category.id);
      const nextGoals = (next.goals || []).map((g) =>
        g && g.categoryId === category.id ? { ...g, categoryId: sysId } : g
      );
      const nextHabits = (next.habits || []).map((h) =>
        h && h.categoryId === category.id ? { ...h, categoryId: sysId } : h
      );
      const nextUi = { ...(next.ui || {}) };
      if (nextUi.selectedCategoryId === category.id) nextUi.selectedCategoryId = sysId;
      if (nextUi.selectedCategoryByView) {
        const scv = { ...nextUi.selectedCategoryByView };
        if (scv.library === category.id) scv.library = sysId;
        if (scv.plan === category.id) scv.plan = sysId;
        if (scv.home === category.id) scv.home = sysId;
        scv.pilotage = scv.pilotage === category.id ? sysId : scv.pilotage;
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
    if (typeof onBack === "function") onBack();
  }

  function deleteOutcome(goal) {
    if (!goal?.id || typeof setData !== "function") return;
    const ok = safeConfirm("Supprimer cet objectif ?");
    if (!ok) return;
    setData((prev) => {
      const nextGoals = (prev.goals || [])
        .filter((g) => g && g.id !== goal.id)
        .map((g) =>
          g && g.parentId === goal.id ? { ...g, parentId: null, outcomeId: null } : g
        );
      const nextCategories = (prev.categories || []).map((cat) =>
        cat.mainGoalId === goal.id ? { ...cat, mainGoalId: null } : cat
      );
      return { ...prev, goals: nextGoals, categories: nextCategories };
    });
  }

  function deleteAction(goal) {
    if (!goal?.id || typeof setData !== "function") return;
    const ok = safeConfirm("Supprimer cette action ?");
    if (!ok) return;
    const goalId = goal.id;
    setData((prev) => {
      const nextGoals = (prev.goals || []).filter((g) => g && g.id !== goalId);
      const nextOccurrences = (prev.occurrences || []).filter((o) => o && o.goalId !== goalId);
      const nextReminders = (prev.reminders || []).filter((r) => r && r.goalId !== goalId);
      const nextSessions = Array.isArray(prev.sessions)
        ? prev.sessions
            .map((s) => {
              if (!s || typeof s !== "object") return s;
              const habitIds = Array.isArray(s.habitIds) ? s.habitIds.filter((id) => id !== goalId) : [];
              const doneHabitIds = Array.isArray(s.doneHabitIds) ? s.doneHabitIds.filter((id) => id !== goalId) : [];
              return { ...s, habitIds, doneHabitIds };
            })
            .filter((s) => {
              if (!s || typeof s !== "object") return false;
              const hasHabits = Array.isArray(s.habitIds) && s.habitIds.length > 0;
              const hasDone = Array.isArray(s.doneHabitIds) && s.doneHabitIds.length > 0;
              return hasHabits || hasDone;
            })
        : prev.sessions;
      let nextChecks = prev.checks;
      if (nextChecks && typeof nextChecks === "object") {
        const cleaned = {};
        for (const [key, bucket] of Object.entries(nextChecks)) {
          const habits = Array.isArray(bucket?.habits) ? bucket.habits.filter((id) => id !== goalId) : [];
          const micro = bucket?.micro && typeof bucket.micro === "object" ? bucket.micro : {};
          if (habits.length || Object.keys(micro).length) cleaned[key] = { ...bucket, habits, micro };
        }
        nextChecks = cleaned;
      }
      const nextUi = { ...(prev.ui || {}) };
      if (nextUi.activeSession?.habitIds) {
        const kept = nextUi.activeSession.habitIds.filter((id) => id !== goalId);
        nextUi.activeSession = kept.length ? { ...nextUi.activeSession, habitIds: kept } : null;
      }
      if (nextUi.sessionDraft?.objectiveId === goalId) nextUi.sessionDraft = null;
      return {
        ...prev,
        goals: nextGoals,
        occurrences: nextOccurrences,
        reminders: nextReminders,
        sessions: nextSessions,
        checks: nextChecks,
        ui: nextUi,
      };
    });
  }

  function unlinkAction(goalId) {
    if (!goalId || typeof setData !== "function") return;
    setData((prev) => ({
      ...prev,
      goals: (prev.goals || []).map((g) =>
        g && g.id === goalId ? { ...g, parentId: null, outcomeId: null } : g
      ),
    }));
  }

  function openEditItem(item) {
    if (!item) return;
    const type = resolveGoalType(item);
    if (typeof onEditItem === "function") {
      onEditItem({ id: item.id, type, categoryId: item.categoryId || null });
    }
  }

  if (!categories.length) {
    return (
      <ScreenShell
        headerTitle={<span data-tour-id="manage-title">Gérer</span>}
        headerSubtitle="Aucune catégorie"
        backgroundImage={safeData?.profile?.whyImage || ""}
      >
        <Card accentBorder>
          <div className="p18">
            <div className="titleSm">Aucune catégorie</div>
            <div className="small mt6">
              Crée un objectif ou une action depuis la bibliothèque pour commencer.
            </div>
            <div className="mt12">
              <Button variant="ghost" className="btnBackCompact backBtn" onClick={onBack} data-tour-id="manage-back">
                ← Retour
              </Button>
            </div>
          </div>
        </Card>
      </ScreenShell>
    );
  }

  if (!category) {
    return (
      <ScreenShell
        headerTitle={<span data-tour-id="manage-title">Gérer</span>}
        headerSubtitle="Catégorie introuvable"
        backgroundImage={safeData?.profile?.whyImage || ""}
      >
        <Card accentBorder>
          <div className="p18">
            <div className="titleSm">Catégorie introuvable</div>
            <div className="small mt6">
              Cette catégorie n’existe plus.
            </div>
            <div className="mt12">
              <Button variant="ghost" className="btnBackCompact backBtn" onClick={onBack} data-tour-id="manage-back">
                ← Retour
              </Button>
            </div>
          </div>
        </Card>
      </ScreenShell>
    );
  }

  const accent = category?.color || getAccentForPage(safeData, "home");
  const backgroundImage = category.wallpaper || safeData.profile?.whyImage || "";
  const whyText = (category.whyText || "").trim();
  const whyDisplay = whyText || "Aucun mini-why pour cette catégorie.";
  const headerRight = (
    <div className="panelNarrow">
      <div className="col gap8 alignEnd">
        {outcomeGoals.length ? (
          <div className="col gap8 alignEnd wFull">
            {gaugeSlice.map((g) => (
              <Gauge
                key={g.id}
                className="manageGauge"
                label={g.title || "Objectif"}
                currentValue={g.currentValue}
                targetValue={g.targetValue}
                unit={MEASURE_UNITS[g.measureType] || ""}
                accentColor={category.color || accent}
              />
            ))}
            <button
              className="linkBtn"
              type="button"
              onClick={() => (typeof onOpenProgress === "function" ? onOpenProgress(category.id) : null)}
              aria-label="Voir la progression"
            >
              →
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );

  return (
    <ScreenShell
      accent={accent}
      backgroundImage={backgroundImage}
      headerTitle={<span data-tour-id="manage-title">Gérer</span>}
      headerSubtitle={
        <div className="stack stackGap12">
          <div data-tour-id="manage-category-name">{category.name || "Catégorie"}</div>
          <Button variant="ghost" className="btnBackCompact backBtn" onClick={onBack} data-tour-id="manage-back">
            ← Retour
          </Button>
        </div>
      }
      headerRight={headerRight}
      headerRowAlign="start"
    >
      <div className="stack stackGap12" style={{ "--catColor": category.color || "#7C3AED" }}>
        <Card accentBorder data-tour-id="manage-category-card">
          <div className="p18 stack stackGap12">
            <div className="row rowBetween alignCenter">
              <div>
                <div className="titleSm">Catégorie</div>
                <div className="small2">
                  {category.name || "Catégorie"}
                  {isPrimaryCategory(category) ? (
                    <span className="badge badgeAccent ml8">
                      Prioritaire
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="row gap8">
                <IconButton
                  icon="gear"
                  aria-label="Paramètres catégorie"
                  onClick={() => {
                    setCategoryMenuOpen((prev) => !prev);
                  }}
                  data-tour-id="manage-category-settings"
                />
                <IconButton
                  icon="close"
                  className="iconBtnDanger"
                  aria-label="Supprimer la catégorie"
                  onClick={deleteCategory}
                  data-tour-id="manage-category-delete"
                />
              </div>
            </div>
              {categoryMenuOpen ? (
                <div className="stack stackGap12">
                  <Button
                    variant="ghost"
                    onClick={() => {
                      renameCategory();
                      setCategoryMenuOpen(false);
                    }}
                    data-tour-id="manage-category-rename"
                  >
                    Renommer
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      recolorCategory();
                      setCategoryMenuOpen(false);
                    }}
                  >
                    Modifier la couleur
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setCategoryPriority();
                      setCategoryMenuOpen(false);
                  }}
                  disabled={isPrimaryCategory(category)}
                  data-tour-id="manage-category-priority"
                >
                  {isPrimaryCategory(category) ? "Prioritaire" : "Définir comme prioritaire"}
                </Button>
              </div>
            ) : null}
          </div>
        </Card>

        <Card accentBorder data-tour-id="manage-mini-why">
          <div className="p18 stack stackGap12">
            <div className="row rowBetween alignCenter">
              <div>
                <div className="titleSm">Mini-why</div>
                <div className="small2">Visible pour cette catégorie</div>
              </div>
              <button className="linkBtn" onClick={() => setShowWhy((v) => !v)} data-tour-id="manage-mini-why-toggle">
                {showWhy ? "Masquer" : "Afficher"}
              </button>
            </div>
            {showWhy ? <div className="small2">{whyDisplay}</div> : null}
            <div className="row rowEnd">
              <Button variant="ghost" onClick={editMiniWhy}>
                Éditer
              </Button>
            </div>
          </div>
        </Card>

        <Card accentBorder data-tour-id="manage-objectives-section">
          <div className="p18 stack stackGap12">
            <div className="titleSm">Objectifs</div>
            {outcomeGoals.length ? (
              <div className="stack stackGap12">
                {outcomeGoals.map((g) => (
                  <AccentItem key={g.id} color={category.color || accent}>
                    <div className="minW0">
                      <div className="itemTitle">
                        {g.title || "Objectif"}
                        {isPrimaryGoal(g) ? (
                          <span
                            className="badge badgeAccent ml8"
                          >
                            Prioritaire
                          </span>
                        ) : null}
                      </div>
                      <div className="itemSub">{g.id === category.mainGoalId ? "Principal" : "Secondaire"}</div>
                    </div>
                    <div className="row gap8">
                      <IconButton
                        icon="gear"
                        aria-label="Paramètres objectif"
                        onClick={() => openEditItem(g)}
                      />
                      <IconButton
                        icon="close"
                        aria-label="Supprimer l’objectif"
                        onClick={() => deleteOutcome(g)}
                      />
                    </div>
                  </AccentItem>
                ))}
              </div>
            ) : (
              <div className="stack stackGap12">
                <div className="small2">Aucun objectif dans cette catégorie.</div>
              </div>
            )}
          </div>
        </Card>

        <Card accentBorder data-tour-id="manage-actions-section">
          <div className="p18 stack stackGap12">
            <div className="titleSm">Actions</div>
            {actionSections.length ? (
              <div className="stack stackGap12">
                {actionSections.map((section) => (
                  <div key={section.key} className="stack stackGap12">
                    <div className="small2 textMuted">{section.title}</div>
                    {section.items.map(({ goal, badges }) => {
                      const stat = habitWeekStats.get(goal.id) || { planned: 0, done: 0, ratio: 0 };
                      const linkedToSelected =
                        selectedOutcome?.id &&
                        (goal.parentId === selectedOutcome.id ||
                          goal.primaryGoalId === selectedOutcome.id ||
                          goal.outcomeId === selectedOutcome.id);
                      const showLink = linkedToSelected || Boolean(selectedOutcome?.id);
                      return (
                        <AccentItem key={goal.id} color={category.color || accent}>
                          <div className="stack gap6 minW0 wFull">
                            <div className="row rowBetween alignCenter">
                              <div className="itemTitle">{goal.title || "Action"}</div>
                              <div className="row gap8">
                                <IconButton
                                  icon="gear"
                                  aria-label="Paramètres action"
                                  onClick={() => openEditItem(goal)}
                                />
                                {showLink ? (
                                  linkedToSelected ? (
                                    <Button
                                      variant="ghost"
                                      onClick={() => unlinkAction(goal.id)}
                                      disabled={!goal.parentId && !goal.outcomeId}
                                    >
                                      Délier
                                    </Button>
                                  ) : (
                                    <Button
                                      variant="ghost"
                                      onClick={() => linkHabitToSelectedOutcome(goal.id)}
                                      disabled={!selectedOutcome?.id || typeof setData !== "function"}
                                    >
                                      Lier
                                    </Button>
                                  )
                                ) : null}
                                <IconButton
                                  icon="close"
                                  aria-label="Supprimer l’action"
                                  onClick={() => deleteAction(goal)}
                                />
                              </div>
                            </div>
                            {badges.length ? (
                              <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
                                {badges.map((label, idx) => (
                                  <span key={`${goal.id}-badge-${idx}`} className="badge">
                                    {label}
                                  </span>
                                ))}
                              </div>
                            ) : null}
                            <div className="itemSub">
                              {`Cette semaine : ${stat.done} terminées · ${stat.done}/${stat.planned}`}
                            </div>
                            <div className="progressTrack">
                              <div
                                className="progressFill"
                                style={{
                                  width: `${Math.round(stat.ratio * 100)}%`,
                                }}
                              />
                            </div>
                          </div>
                        </AccentItem>
                      );
                    })}
                  </div>
                ))}
                {!selectedOutcome?.id ? (
                  <div className="small2 textMuted">Sélectionne un objectif pour lier ces actions.</div>
                ) : null}
              </div>
            ) : (
              <div className="stack stackGap12">
                <div className="small2">Aucune action dans cette catégorie.</div>
              </div>
            )}
          </div>
        </Card>

        <Card accentBorder data-tour-id="manage-pilotage-section">
          <div className="p18 stack stackGap12">
            <div className="titleSm">Pilotage</div>
            <div className="small2">Etat, charge et discipline (lecture seule).</div>
            <Button variant="ghost" onClick={openPilotage} data-tour-id="manage-open-pilotage">
              Ouvrir le pilotage
            </Button>
          </div>
        </Card>
      </div>
    </ScreenShell>
  );
}
