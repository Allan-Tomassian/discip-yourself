import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AccentItem from "../../components/AccentItem";
import { safeConfirm, safePrompt } from "../../utils/dialogs";
import { addDays, startOfWeekKey, todayKey } from "../../utils/dates";
import { isPrimaryCategory, isPrimaryGoal, setPrimaryCategory } from "../../logic/priority";
import { resolveGoalType } from "../../domain/goalType";
import { linkProcessToOutcome, splitProcessByLink } from "../../logic/linking";
import { ensureSystemInboxCategory, SYSTEM_INBOX_ID } from "../../logic/state";
import { removeScheduleRulesForAction } from "../../logic/occurrencePlanner";
import { buildPlanningSections } from "../../utils/librarySections";
import { LABELS } from "../../ui/labels";
import {
  getCategoryProfile,
  hasMeaningfulCategoryProfile,
  normalizeCategoryProfilesV1,
} from "../../domain/categoryProfile";
import { GateButton, GateSection, GateSectionIntro } from "../../shared/ui/gate/Gate";
import { GateIconButton, GateInput, GateTextarea } from "../../shared/ui/gate/GateForm";
import { BehaviorCue, useBehaviorFeedback } from "../../feedback/BehaviorFeedbackContext";
import { deriveBehaviorFeedbackSignal, deriveLibraryBehaviorCue } from "../../feedback/feedbackDerivers";

function Button({ variant = "primary", size = "sm", className = "", ...props }) {
  const gateVariant =
    variant === "ghost"
      ? "ghost"
      : variant === "secondary"
      ? "secondary"
        : variant === "danger"
          ? "ghost"
          : "primary";
  const mergedClassName = [className, "GatePressable"].filter(Boolean).join(" ");
  return <GateButton variant={gateVariant} size={size} className={mergedClassName} {...props} />;
}

function Card({ className = "", children, accentBorder: _accentBorder, ...props }) {
  const mergedClassName = ["GateSurfacePremium", "GateCardPremium", "GateSecondarySectionCard", "libraryManageCard", className]
    .filter(Boolean)
    .join(" ");
  return (
    <GateSection className={mergedClassName} collapsible={false} {...props}>
      {children}
    </GateSection>
  );
}

function Input({ className = "", ...props }) {
  return <GateInput className={className} {...props} />;
}

function Textarea({ className = "", ...props }) {
  return <GateTextarea className={className} {...props} />;
}

function Chip({ children, active = false, className = "", type = "button", ...props }) {
  return (
    <button
      type={type}
      className={`chip${active ? " isActive" : ""}${className ? ` ${className}` : ""}`}
      {...props}
    >
      {children}
    </button>
  );
}

function ChipRow({ children, className = "", ...props }) {
  return (
    <div className={`chipRow${className ? ` ${className}` : ""}`} {...props}>
      {children}
    </div>
  );
}

function IconButton({ icon, children, className = "", ...props }) {
  const iconMap = { gear: "⚙︎", close: "×", back: "←", plus: "+" };
  const content = children || iconMap[icon] || icon;
  return (
    <GateIconButton className={className} {...props}>
      {content}
    </GateIconButton>
  );
}

function getTourId(inlineEdit, value) {
  return inlineEdit ? undefined : value;
}

function normalizeProfileDraft(profile) {
  const safeProfile = profile && typeof profile === "object" ? profile : {};
  return {
    subject: typeof safeProfile.subject === "string" ? safeProfile.subject : "",
    mainGoal: typeof safeProfile.mainGoal === "string" ? safeProfile.mainGoal : "",
    currentPriority: typeof safeProfile.currentPriority === "string" ? safeProfile.currentPriority : "",
    watchpoints: Array.isArray(safeProfile.watchpoints) ? [...safeProfile.watchpoints] : [],
    constraints: Array.isArray(safeProfile.constraints) ? [...safeProfile.constraints] : [],
    currentLevel: Number.isInteger(safeProfile.currentLevel) ? safeProfile.currentLevel : null,
    notes: typeof safeProfile.notes === "string" ? safeProfile.notes : "",
  };
}

function comparableProfile(profile) {
  const safeProfile = profile && typeof profile === "object" ? profile : {};
  return {
    categoryId: safeProfile.categoryId || null,
    subject: safeProfile.subject || null,
    mainGoal: safeProfile.mainGoal || null,
    currentPriority: safeProfile.currentPriority || null,
    watchpoints: Array.isArray(safeProfile.watchpoints) ? safeProfile.watchpoints : [],
    constraints: Array.isArray(safeProfile.constraints) ? safeProfile.constraints : [],
    currentLevel: Number.isInteger(safeProfile.currentLevel) ? safeProfile.currentLevel : null,
    notes: safeProfile.notes || null,
  };
}

function buildNextCategoryProfilesState(previous, categoryId, patch) {
  const categories = Array.isArray(previous?.categories) ? previous.categories : [];
  const currentState = normalizeCategoryProfilesV1(previous?.category_profiles_v1, categories);
  const currentProfile = getCategoryProfile(
    {
      categories,
      category_profiles_v1: currentState,
    },
    categoryId
  );

  let nextState = normalizeCategoryProfilesV1(
    {
      version: 1,
      byCategoryId: {
        ...currentState.byCategoryId,
        [categoryId]: {
          ...currentProfile,
          ...patch,
          categoryId,
          updatedAt: new Date().toISOString(),
        },
      },
    },
    categories
  );

  let nextProfile = getCategoryProfile(
    {
      categories,
      category_profiles_v1: nextState,
    },
    categoryId
  );

  if (!hasMeaningfulCategoryProfile(nextProfile)) {
    const nextByCategoryId = { ...nextState.byCategoryId };
    delete nextByCategoryId[categoryId];
    nextState = normalizeCategoryProfilesV1(
      {
        version: 1,
        byCategoryId: nextByCategoryId,
      },
      categories
    );
    nextProfile = getCategoryProfile(
      {
        categories,
        category_profiles_v1: nextState,
      },
      categoryId
    );
  }

  if (JSON.stringify(comparableProfile(currentProfile)) === JSON.stringify(comparableProfile(nextProfile))) {
    return null;
  }

  return nextState;
}

export default function CategoryManageInline({
  data,
  setData,
  categoryId,
  onOpenCreateOutcome,
  onOpenCreateHabit,
  onOpenPilotage,
  onEditItem,
  onClose,
  inlineEdit = false,
}) {
  const { emitBehaviorFeedback } = useBehaviorFeedback();
  const safeData = data && typeof data === "object" ? data : {};
  const categories = useMemo(
    () => (Array.isArray(safeData.categories) ? safeData.categories : []),
    [safeData.categories]
  );
  const goals = useMemo(
    () => (Array.isArray(safeData.goals) ? safeData.goals : []),
    [safeData.goals]
  );
  const occurrences = useMemo(
    () => (Array.isArray(safeData.occurrences) ? safeData.occurrences : []),
    [safeData.occurrences]
  );
  const category = useMemo(
    () => categories.find((c) => c?.id === categoryId) || null,
    [categories, categoryId]
  );

  const [showWhy, setShowWhy] = useState(true);
  const [selectedOutcomeId, setSelectedOutcomeId] = useState(null);
  const [categoryMenuOpen, setCategoryMenuOpen] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [whyDraft, setWhyDraft] = useState("");
  const categoryProfile = useMemo(
    () => getCategoryProfile(safeData, category?.id || null),
    [category?.id, safeData]
  );
  const [profileDraft, setProfileDraft] = useState(() => normalizeProfileDraft(categoryProfile));
  const [watchpointInput, setWatchpointInput] = useState("");
  const [constraintInput, setConstraintInput] = useState("");
  const profileDraftRef = useRef(profileDraft);

  useEffect(() => {
    setNameDraft(category?.name || "");
    setWhyDraft(category?.whyText || "");
    setCategoryMenuOpen(false);
  }, [category?.id, category?.name, category?.whyText]);

  useEffect(() => {
    const nextDraft = normalizeProfileDraft(categoryProfile);
    profileDraftRef.current = nextDraft;
    setProfileDraft(nextDraft);
    setWatchpointInput("");
    setConstraintInput("");
  }, [categoryProfile]);

  useEffect(() => {
    profileDraftRef.current = profileDraft;
  }, [profileDraft]);

  const outcomeGoals = useMemo(() => {
    if (!category?.id) return [];
    return goals.filter((g) => g.categoryId === category.id && resolveGoalType(g) === "OUTCOME");
  }, [category?.id, goals]);

  useEffect(() => {
    if (!category?.id) {
      setSelectedOutcomeId(null);
      return;
    }
    const preferredId =
      safeData?.ui?.selectedGoalByCategory &&
      typeof safeData.ui.selectedGoalByCategory === "object" &&
      outcomeGoals.some((goal) => goal?.id === safeData.ui.selectedGoalByCategory[category.id])
        ? safeData.ui.selectedGoalByCategory[category.id]
        : null;
    const mainId = category.mainGoalId && outcomeGoals.some((g) => g.id === category.mainGoalId)
      ? category.mainGoalId
      : null;
    const fallback = outcomeGoals[0]?.id || null;
    setSelectedOutcomeId((prev) => {
      if (prev && outcomeGoals.some((g) => g.id === prev)) return prev;
      return preferredId || mainId || fallback;
    });
  }, [category?.id, category?.mainGoalId, outcomeGoals, safeData?.ui?.selectedGoalByCategory]);

  const selectedOutcome = selectedOutcomeId
    ? outcomeGoals.find((g) => g.id === selectedOutcomeId) || null
    : null;

  const processGoals = useMemo(() => {
    if (!category?.id) return [];
    return goals.filter((g) => g.categoryId === category.id && resolveGoalType(g) === "PROCESS");
  }, [category?.id, goals]);

  const { linked: linkedHabits, unlinked: unlinkedHabits } = useMemo(() => {
    if (!processGoals.length) return { linked: [], unlinked: [] };
    if (!selectedOutcome?.id) return { linked: [], unlinked: processGoals };
    return splitProcessByLink(processGoals, selectedOutcome.id);
  }, [processGoals, selectedOutcome?.id]);

  const habitWeekStats = useMemo(() => {
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
      if (status !== "skipped" && status !== "canceled") entry.planned += 1;
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
  }, [occurrences, processGoals]);

  const actionSections = useMemo(
    () => buildPlanningSections([...linkedHabits, ...unlinkedHabits], outcomeGoals),
    [linkedHabits, outcomeGoals, unlinkedHabits]
  );
  const categoryBehaviorCue = useMemo(
    () =>
      deriveLibraryBehaviorCue({
        category,
        outcomeCount: outcomeGoals.length,
        processCount: processGoals.length,
        hasProfile: hasMeaningfulCategoryProfile(categoryProfile),
      }),
    [category, categoryProfile, outcomeGoals.length, processGoals.length]
  );

  const commitName = useCallback(() => {
    if (!category?.id || typeof setData !== "function") return;
    const nextName = String(nameDraft || "").trim();
    if (!nextName) {
      setNameDraft(category.name || "");
      return;
    }
    if (nextName === String(category.name || "").trim()) return;
    setData((prev) => ({
      ...prev,
      categories: (prev.categories || []).map((cat) =>
        cat.id === category.id ? { ...cat, name: nextName } : cat
      ),
    }));
    emitBehaviorFeedback(
      deriveBehaviorFeedbackSignal({
        intent: "clarify_category",
        payload: {
          surface: "library",
          categoryId: category.id,
        },
      })
    );
  }, [category?.id, category?.name, emitBehaviorFeedback, nameDraft, setData]);

  const commitWhy = useCallback(() => {
    if (!category?.id || typeof setData !== "function") return;
    const nextWhy = String(whyDraft || "");
    if (nextWhy === String(category.whyText || "")) return;
    setData((prev) => ({
      ...prev,
      categories: (prev.categories || []).map((cat) =>
        cat.id === category.id ? { ...cat, whyText: nextWhy } : cat
      ),
    }));
    emitBehaviorFeedback(
      deriveBehaviorFeedbackSignal({
        intent: "clarify_category",
        payload: {
          surface: "library",
          categoryId: category.id,
        },
      })
    );
  }, [category?.id, category?.whyText, emitBehaviorFeedback, setData, whyDraft]);

  const commitCategoryProfilePatch = useCallback(
    (patch) => {
      if (!category?.id || typeof setData !== "function") return;
      setData((previous) => {
        const nextCategoryProfiles = buildNextCategoryProfilesState(previous, category.id, patch);
        if (!nextCategoryProfiles) return previous;
        return {
          ...previous,
          category_profiles_v1: nextCategoryProfiles,
        };
      });
    },
    [category?.id, setData]
  );

  const commitCategoryProfileDraft = useCallback(
    (draft) => {
      if (!draft) return;
      commitCategoryProfilePatch({
        subject: draft.subject,
        mainGoal: draft.mainGoal,
        currentPriority: draft.currentPriority,
        watchpoints: draft.watchpoints,
        constraints: draft.constraints,
        currentLevel: draft.currentLevel,
        notes: draft.notes,
      });
    },
    [commitCategoryProfilePatch]
  );

  useEffect(() => {
    if (!inlineEdit) return undefined;
    return () => {
      if (!category?.id || typeof setData !== "function") return;
      const nextName = String(nameDraft || "").trim();
      const currentName = String(category.name || "").trim();
      const nextWhy = String(whyDraft || "");
      const currentWhy = String(category.whyText || "");
      if (!nextName && nextWhy === currentWhy) return;
      if (nextName === currentName && nextWhy === currentWhy) return;
      setData((prev) => ({
        ...prev,
        categories: (prev.categories || []).map((cat) => {
          if (cat.id !== category.id) return cat;
          return {
            ...cat,
            ...(nextName ? { name: nextName } : null),
            ...(nextWhy !== currentWhy ? { whyText: nextWhy } : null),
          };
        }),
      }));
    };
  }, [inlineEdit, category?.id, category?.name, category?.whyText, nameDraft, setData, whyDraft]);

  useEffect(() => {
    if (!inlineEdit) return undefined;
    return () => {
      if (!category?.id) return;
      commitCategoryProfileDraft(profileDraftRef.current);
    };
  }, [category?.id, commitCategoryProfileDraft, inlineEdit]);

  function linkHabitToSelectedOutcome(habitId) {
    if (!selectedOutcome?.id || typeof setData !== "function") return;
    setData((prev) => linkProcessToOutcome(prev, habitId, selectedOutcome.id));
    emitBehaviorFeedback(
      deriveBehaviorFeedbackSignal({
        intent: "link_action",
        payload: {
          surface: "library",
          categoryId: category?.id || null,
        },
      })
    );
  }

  function openPilotage() {
    if (typeof onOpenPilotage === "function") onOpenPilotage();
  }

  function addProfileListItem(kind) {
    const isWatchpoints = kind === "watchpoints";
    const inputValue = isWatchpoints ? watchpointInput : constraintInput;
    const trimmed = String(inputValue || "").trim();
    if (!trimmed) return;
    const currentList = isWatchpoints ? profileDraft.watchpoints : profileDraft.constraints;
    const nextDraft = {
      ...profileDraft,
      [kind]: [...currentList, trimmed],
    };
    setProfileDraft(nextDraft);
    commitCategoryProfilePatch({ [kind]: nextDraft[kind] });
    if (isWatchpoints) setWatchpointInput("");
    else setConstraintInput("");
  }

  function removeProfileListItem(kind, value) {
    const currentList = kind === "watchpoints" ? profileDraft.watchpoints : profileDraft.constraints;
    const nextDraft = {
      ...profileDraft,
      [kind]: currentList.filter((entry) => entry !== value),
    };
    setProfileDraft(nextDraft);
    commitCategoryProfilePatch({ [kind]: nextDraft[kind] });
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
    emitBehaviorFeedback(
      deriveBehaviorFeedbackSignal({
        intent: "clarify_category",
        payload: {
          surface: "library",
          categoryId: category.id,
        },
      })
    );
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
    emitBehaviorFeedback(
      deriveBehaviorFeedbackSignal({
        intent: "clarify_category",
        payload: {
          surface: "library",
          categoryId: category.id,
        },
      })
    );
  }

  function setCategoryPriority() {
    if (!category?.id || typeof setData !== "function") return;
    setData((prev) => setPrimaryCategory(prev, category.id));
    emitBehaviorFeedback(
      deriveBehaviorFeedbackSignal({
        intent: "set_priority",
        payload: {
          surface: "library",
          categoryId: category.id,
        },
      })
    );
  }

  function deleteCategory() {
    if (!category?.id || typeof setData !== "function") return;
    if (category.id === SYSTEM_INBOX_ID) return;
    const ok = safeConfirm("Supprimer cette catégorie ? Les éléments sortiront du flux principal et devront être reclassés.");
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
    if (typeof onClose === "function") onClose();
  }

  function deleteOutcome(goal) {
    if (!goal?.id || typeof setData !== "function") return;
    const ok = safeConfirm(`Supprimer ce ${LABELS.goalLower} ?`);
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
      const nextState = {
        ...prev,
        goals: nextGoals,
        occurrences: nextOccurrences,
        reminders: nextReminders,
        sessions: nextSessions,
        checks: nextChecks,
        ui: nextUi,
      };
      return removeScheduleRulesForAction(nextState, goalId);
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

  if (!category) {
    return (
      <section className="mainPageSection">
        <GateSectionIntro title="Catégorie introuvable" subtitle="Cette catégorie n’existe plus." />
        <Card accentBorder>
          <div className="GateInlineMetaCard col gap8">
            <div className="GateRoleHelperText">Reviens à la bibliothèque pour ouvrir une autre catégorie.</div>
          </div>
        </Card>
      </section>
    );
  }

  const whyText = (category.whyText || "").trim();
  const whyDisplay = whyText || "Aucun mini-why pour cette catégorie.";

  return (
    <div className="libraryManageStack stack stackGap16" style={{ "--catColor": category.color || "#7C3AED" }}>
      <section className="mainPageSection">
        <GateSectionIntro title="Réglages" subtitle="Nom, priorité et paramètres de la catégorie." />
        <Card accentBorder data-tour-id={getTourId(inlineEdit, "manage-category-card")}>
          <div className="libraryManageCardBody stack stackGap12">
            <div className="row rowBetween alignCenter gap12">
              <div className="stack stackGap12 minW0">
                {inlineEdit ? (
                  <div className="row gap8 alignCenter wrap">
                    <Input
                      value={nameDraft}
                      onChange={(event) => setNameDraft(event.target.value)}
                      onBlur={commitName}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          commitName();
                          event.currentTarget.blur();
                        }
                      }}
                      aria-label="Nom de la catégorie"
                      data-testid={`library-manage-name-${category.id}`}
                    />
                    {isPrimaryCategory(category) ? (
                      <span className="badge badgeAccent">Prioritaire</span>
                    ) : null}
                  </div>
                ) : (
                  <div className="stack stackGap12">
                    <div className="GateRoleCardTitle">
                      {category.name || "Catégorie"}
                      {isPrimaryCategory(category) ? (
                        <span className="badge badgeAccent ml8">Prioritaire</span>
                      ) : null}
                    </div>
                    {categoryBehaviorCue ? <BehaviorCue cue={categoryBehaviorCue} category={category} /> : null}
                  </div>
                )}
              </div>
              <div className="row gap8">
                <IconButton
                  icon="gear"
                  aria-label="Paramètres catégorie"
                  onClick={() => {
                    setCategoryMenuOpen((prev) => !prev);
                  }}
                  data-tour-id={getTourId(inlineEdit, "manage-category-settings")}
                />
                <IconButton
                  icon="close"
                  className="iconBtnDanger"
                  aria-label="Supprimer la catégorie"
                  onClick={deleteCategory}
                  data-tour-id={getTourId(inlineEdit, "manage-category-delete")}
                />
              </div>
            </div>
            {categoryMenuOpen ? (
              <div className="stack stackGap12">
                {!inlineEdit ? (
                  <Button
                    variant="ghost"
                    onClick={() => {
                      renameCategory();
                      setCategoryMenuOpen(false);
                    }}
                    data-tour-id={getTourId(inlineEdit, "manage-category-rename")}
                  >
                    Renommer
                  </Button>
                ) : null}
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
                  data-tour-id={getTourId(inlineEdit, "manage-category-priority")}
                >
                  {isPrimaryCategory(category) ? "Prioritaire" : "Définir comme prioritaire"}
                </Button>
              </div>
            ) : null}
          </div>
        </Card>
      </section>

      <section className="mainPageSection">
        <GateSectionIntro
          title="Mini-why"
          subtitle="Visible pour cette catégorie."
          actions={
            <button
              className="linkBtn"
              type="button"
              onClick={() => setShowWhy((value) => !value)}
              data-tour-id={getTourId(inlineEdit, "manage-mini-why-toggle")}
            >
              {showWhy ? "Masquer" : "Afficher"}
            </button>
          }
        />
        <Card accentBorder data-tour-id={getTourId(inlineEdit, "manage-mini-why")}>
          <div className="libraryManageCardBody stack stackGap12">
            {showWhy ? (
              inlineEdit ? (
                <textarea
                  className="input"
                  rows={3}
                  value={whyDraft}
                  onChange={(event) => setWhyDraft(event.target.value)}
                  onBlur={commitWhy}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                      event.preventDefault();
                      commitWhy();
                      event.currentTarget.blur();
                    }
                  }}
                  aria-label="Mini-why"
                  data-testid={`library-manage-why-${category.id}`}
                />
              ) : (
                <div className="GateInlineMetaCard">
                  <div className="GateRoleHelperText">{whyDisplay}</div>
                </div>
              )
            ) : null}
            <div className="row rowEnd">
              {inlineEdit ? (
                <Button variant="ghost" onClick={commitWhy}>
                  Sauver
                </Button>
              ) : (
                <Button variant="ghost" onClick={editMiniWhy}>
                  Éditer
                </Button>
              )}
            </div>
          </div>
        </Card>
      </section>

      <section className="mainPageSection">
        <GateSectionIntro
          title="Profil de catégorie"
          subtitle="Contexte stratégique optionnel pour guider les recommandations."
        />
        <Card accentBorder data-tour-id={getTourId(inlineEdit, "manage-category-profile")}>
          <div className="libraryManageCardBody stack stackGap12">
            <div className="stack stackGap12">
              <div className="col" style={{ gap: 6 }}>
                <div className="small2 textMuted">Sujet principal</div>
                <Input
                  value={profileDraft.subject}
                  onChange={(event) =>
                    setProfileDraft((previous) => ({ ...previous, subject: event.target.value }))
                  }
                  onBlur={() => commitCategoryProfilePatch({ subject: profileDraft.subject })}
                  placeholder="Ex: Reprendre ma forme"
                  aria-label="Sujet principal"
                  data-testid={`library-manage-profile-subject-${category.id}`}
                />
              </div>

              <div className="col" style={{ gap: 6 }}>
                <div className="small2 textMuted">Objectif principal</div>
                <Input
                  value={profileDraft.mainGoal}
                  onChange={(event) =>
                    setProfileDraft((previous) => ({ ...previous, mainGoal: event.target.value }))
                  }
                  onBlur={() => commitCategoryProfilePatch({ mainGoal: profileDraft.mainGoal })}
                  placeholder="Ex: Retrouver de l’énergie"
                  aria-label="Objectif principal"
                  data-testid={`library-manage-profile-main-goal-${category.id}`}
                />
              </div>

              <div className="col" style={{ gap: 6 }}>
                <div className="small2 textMuted">Priorité actuelle</div>
                <Input
                  value={profileDraft.currentPriority}
                  onChange={(event) =>
                    setProfileDraft((previous) => ({ ...previous, currentPriority: event.target.value }))
                  }
                  onBlur={() => commitCategoryProfilePatch({ currentPriority: profileDraft.currentPriority })}
                  placeholder="Ex: Dormir plus régulièrement"
                  aria-label="Priorité actuelle"
                  data-testid={`library-manage-profile-priority-${category.id}`}
                />
              </div>

              <div className="col" style={{ gap: 8 }}>
                <div className="small2 textMuted">Points à surveiller</div>
                <div className="row wrap gap8">
                  <Input
                    value={watchpointInput}
                    onChange={(event) => setWatchpointInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key !== "Enter") return;
                      event.preventDefault();
                      addProfileListItem("watchpoints");
                    }}
                    placeholder="Ex: Sommeil"
                    aria-label="Ajouter un point à surveiller"
                  />
                  <Button variant="ghost" onClick={() => addProfileListItem("watchpoints")}>
                    Ajouter
                  </Button>
                </div>
                {profileDraft.watchpoints.length ? (
                  <ChipRow>
                    {profileDraft.watchpoints.map((item) => (
                      <Chip
                        key={`watchpoint-${item}`}
                        active
                        onClick={() => removeProfileListItem("watchpoints", item)}
                        aria-label={`Retirer ${item}`}
                      >
                        {item} ×
                      </Chip>
                    ))}
                  </ChipRow>
                ) : null}
              </div>

              <div className="col" style={{ gap: 8 }}>
                <div className="small2 textMuted">Contraintes</div>
                <div className="row wrap gap8">
                  <Input
                    value={constraintInput}
                    onChange={(event) => setConstraintInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key !== "Enter") return;
                      event.preventDefault();
                      addProfileListItem("constraints");
                    }}
                    placeholder="Ex: Horaires irréguliers"
                    aria-label="Ajouter une contrainte"
                  />
                  <Button variant="ghost" onClick={() => addProfileListItem("constraints")}>
                    Ajouter
                  </Button>
                </div>
                {profileDraft.constraints.length ? (
                  <ChipRow>
                    {profileDraft.constraints.map((item) => (
                      <Chip
                        key={`constraint-${item}`}
                        active
                        onClick={() => removeProfileListItem("constraints", item)}
                        aria-label={`Retirer ${item}`}
                      >
                        {item} ×
                      </Chip>
                    ))}
                  </ChipRow>
                ) : null}
              </div>

              <div className="col" style={{ gap: 8 }}>
                <div className="small2 textMuted">Niveau actuel</div>
                <ChipRow>
                  {[1, 2, 3, 4, 5].map((level) => (
                    <Chip
                      key={`level-${level}`}
                      active={profileDraft.currentLevel === level}
                      onClick={() => {
                        const nextLevel = profileDraft.currentLevel === level ? null : level;
                        setProfileDraft((previous) => ({ ...previous, currentLevel: nextLevel }));
                        commitCategoryProfilePatch({ currentLevel: nextLevel });
                      }}
                      aria-pressed={profileDraft.currentLevel === level}
                    >
                      {level}
                    </Chip>
                  ))}
                </ChipRow>
              </div>

              <div className="col" style={{ gap: 6 }}>
                <div className="small2 textMuted">Notes</div>
                <Textarea
                  rows={4}
                  value={profileDraft.notes}
                  onChange={(event) =>
                    setProfileDraft((previous) => ({ ...previous, notes: event.target.value }))
                  }
                  onBlur={() => commitCategoryProfilePatch({ notes: profileDraft.notes })}
                  placeholder="Ajoute un contexte utile si nécessaire."
                  aria-label="Notes du profil catégorie"
                  data-testid={`library-manage-profile-notes-${category.id}`}
                />
              </div>
            </div>
          </div>
        </Card>
      </section>

      <section className="mainPageSection">
        <GateSectionIntro
          title="Actions"
          subtitle={`Les actions vivent d’abord ici. Tu peux les relier à un ${LABELS.goalLower} seulement si cela aide.`}
          actions={
            typeof onOpenCreateHabit === "function" ? (
              <Button
                onClick={() => onOpenCreateHabit(category.id)}
                data-tour-id={getTourId(inlineEdit, "manage-actions-create")}
              >
                Créer une action
              </Button>
            ) : null
          }
        />
        <Card accentBorder data-tour-id={getTourId(inlineEdit, "manage-actions-section")}>
          <div className="libraryManageCardBody stack stackGap12">
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
                        <AccentItem key={goal.id} color={category.color || "#7C3AED"}>
                          <div className="stack gap6 minW0 wFull">
                            <div className="row rowBetween alignCenter gap12">
                              <div className="itemTitle">{goal.title || "Action"}</div>
                              <div className="row gap8 wrap">
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
                              <div className="row wrap" style={{ gap: 6 }}>
                                {badges.map((label, idx) => (
                                  <span key={`${goal.id}-badge-${idx}`} className="badge">
                                    {label}
                                  </span>
                                ))}
                              </div>
                            ) : null}
                            <div className="itemSub">{`Cette semaine : ${stat.done} terminées · ${stat.done}/${stat.planned}`}</div>
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
              </div>
            ) : (
              <div className="GateInlineMetaCard">
                <div className="GateRoleHelperText">Aucune action dans cette catégorie.</div>
              </div>
            )}
          </div>
        </Card>
      </section>

      <section className="mainPageSection">
        <GateSectionIntro
          title={`${LABELS.goals} (optionnel)`}
          subtitle="Utile pour structurer certaines actions, pas pour agir au quotidien."
          actions={
            typeof onOpenCreateOutcome === "function" ? (
              <Button
                variant="ghost"
                onClick={() => onOpenCreateOutcome(category.id)}
                data-tour-id={getTourId(inlineEdit, "manage-objectives-create")}
              >
                Créer un {LABELS.goalLower}
              </Button>
            ) : null
          }
        />
        <Card accentBorder data-tour-id={getTourId(inlineEdit, "manage-objectives-section")}>
          <div className="libraryManageCardBody stack stackGap12">
            {outcomeGoals.length ? (
              <div className="stack stackGap12">
                {outcomeGoals.map((g) => (
                  <AccentItem key={g.id} color={category.color || "#7C3AED"}>
                    <div className="minW0">
                      <div className="itemTitle">
                        {g.title || LABELS.goal}
                        {isPrimaryGoal(g) ? (
                          <span className="badge badgeAccent ml8">Prioritaire</span>
                        ) : null}
                      </div>
                      <div className="itemSub">{g.id === category.mainGoalId ? "Objectif principal" : "Objectif secondaire"}</div>
                    </div>
                    <div className="row gap8">
                      <IconButton
                        icon="gear"
                        aria-label={`Paramètres ${LABELS.goalLower}`}
                        onClick={() => openEditItem(g)}
                      />
                      <IconButton
                        icon="close"
                        aria-label={`Supprimer le ${LABELS.goalLower}`}
                        onClick={() => deleteOutcome(g)}
                      />
                    </div>
                  </AccentItem>
                ))}
              </div>
            ) : (
              <div className="GateInlineMetaCard">
                <div className="GateRoleHelperText">Aucun {LABELS.goalLower} dans cette catégorie.</div>
              </div>
            )}
          </div>
        </Card>
      </section>

      <section className="mainPageSection">
        <GateSectionIntro
          title="Pilotage"
          subtitle="État, charge et discipline."
          actions={
            <Button variant="ghost" onClick={openPilotage} data-tour-id={getTourId(inlineEdit, "manage-open-pilotage")}>
              Ouvrir le pilotage
            </Button>
          }
        />
        <Card accentBorder data-tour-id={getTourId(inlineEdit, "manage-pilotage-section")}>
          <div className="GateInlineMetaCard">
            <div className="GateRoleHelperText">Lecture seule depuis cette catégorie.</div>
          </div>
        </Card>
      </section>
    </div>
  );
}
