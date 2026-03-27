import { resolveGoalType } from "./goalType.js";
import { compareOccurrencesByUserAiPreference } from "./userAiProfile.js";

export const TODAY_CATEGORY_SELECTION_SCOPE = Object.freeze({
  NONE: "none",
  ACTIVE_CATEGORY: "active_category",
  CROSS_CATEGORY: "cross_category",
  STRUCTURE_MISSING: "structure_missing",
});

export const TODAY_CATEGORY_REASON_LINK_TYPE = Object.freeze({
  DIRECT_CATEGORY: "direct_category",
  CROSS_CATEGORY: "cross_category",
  STRUCTURE_MISSING: "structure_missing",
});

const AI_FOUNDATION_PLANNING_TEMPLATE_ID = "ai_onboarding_planning";
const STOP_TOKENS = new Set([
  "a",
  "au",
  "aux",
  "avec",
  "ce",
  "ces",
  "dans",
  "de",
  "des",
  "du",
  "en",
  "et",
  "la",
  "le",
  "les",
  "mon",
  "mes",
  "pour",
  "sur",
  "ta",
  "tes",
  "ton",
  "une",
  "un",
  "the",
  "your",
]);

const CATEGORY_FAMILY_HINTS = Object.freeze({
  health: ["sante", "health", "sport", "fitness", "run", "course", "marche", "stretch", "wellness"],
  business: ["business", "travail", "work", "vente", "client", "prospect", "pitch", "meeting", "appel", "email", "offre"],
  learning: ["apprentissage", "learning", "learn", "etud", "study", "lecture", "cours", "notes"],
  personal: ["personnel", "personal", "maison", "rangement", "famille", "message", "administratif"],
  finance: ["finance", "budget", "depense", "compta", "epargne", "revenu", "revenus", "income", "money", "cash"],
  productivity: ["productivite", "productivity", "focus", "execution", "deep", "work"],
});

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokenize(value) {
  const normalized = normalizeText(value);
  if (!normalized) return [];
  return normalized
    .split(/\s+/)
    .filter((token) => token && token.length >= 3 && !STOP_TOKENS.has(token));
}

function buildGoalsById(goals) {
  return new Map(safeArray(goals).filter((goal) => goal?.id).map((goal) => [goal.id, goal]));
}

function buildCategoriesById(categories) {
  return new Map(safeArray(categories).filter((category) => category?.id).map((category) => [category.id, category]));
}

function isExecutableGoal(goal) {
  if (!goal || typeof goal !== "object" || !goal.id || !goal.categoryId) return false;
  const status = typeof goal.status === "string" ? goal.status.toLowerCase() : "";
  if (status === "archived" || status === "deleted" || status === "removed" || status === "done") return false;
  if (goal.templateId === AI_FOUNDATION_PLANNING_TEMPLATE_ID) return false;
  return resolveGoalType(goal) === "PROCESS";
}

function getGoalPriorityRank(goal) {
  const raw =
    typeof goal?.priority === "string"
      ? goal.priority
      : typeof goal?.priorityLevel === "string"
        ? goal.priorityLevel
        : "";
  const key = raw.toLowerCase();
  if (key === "prioritaire" || key === "primary") return 3;
  if (key === "secondaire" || key === "secondary") return 2;
  if (key === "bonus") return 1;
  return 0;
}

function buildGoalActivityIndex(occurrences = []) {
  const index = new Map();
  for (const occurrence of safeArray(occurrences)) {
    const goalId = typeof occurrence?.goalId === "string" ? occurrence.goalId : "";
    const dateKey = typeof occurrence?.date === "string" ? occurrence.date : "";
    if (!goalId || !dateKey) continue;
    const current = index.get(goalId) || {
      lastPlannedDateKey: null,
      durationMin: null,
    };
    if (!current.lastPlannedDateKey || dateKey > current.lastPlannedDateKey) {
      current.lastPlannedDateKey = dateKey;
    }
    if (Number.isFinite(occurrence?.durationMinutes)) {
      current.durationMin = occurrence.durationMinutes;
    }
    index.set(goalId, current);
  }
  return index;
}

function getOccurrenceStartLabel(occurrence) {
  const start =
    typeof occurrence?.start === "string" && occurrence.start
      ? occurrence.start
      : typeof occurrence?.slotKey === "string" && occurrence.slotKey
        ? occurrence.slotKey
        : "";
  return start || null;
}

function compareOccurrences(left, right, preferredTimeBlocks = []) {
  const leftStatus = String(left?.status || "");
  const rightStatus = String(right?.status || "");
  if (leftStatus !== rightStatus) {
    if (leftStatus === "in_progress") return -1;
    if (rightStatus === "in_progress") return 1;
  }
  if (Array.isArray(preferredTimeBlocks) && preferredTimeBlocks.length > 0) {
    const preferredComparison = compareOccurrencesByUserAiPreference(left, right, preferredTimeBlocks);
    if (preferredComparison !== 0) return preferredComparison;
  }
  const leftStart = getOccurrenceStartLabel(left) || "99:99";
  const rightStart = getOccurrenceStartLabel(right) || "99:99";
  if (leftStart !== rightStart) return leftStart.localeCompare(rightStart);
  return String(left?.id || "").localeCompare(String(right?.id || ""));
}

function compareCandidateSummaries(left, right) {
  const leftPriority = Number.isFinite(left?.priorityRank) ? left.priorityRank : 0;
  const rightPriority = Number.isFinite(right?.priorityRank) ? right.priorityRank : 0;
  if (leftPriority !== rightPriority) return rightPriority - leftPriority;
  const leftHasHistory = left?.lastPlannedDateKey ? 0 : 1;
  const rightHasHistory = right?.lastPlannedDateKey ? 0 : 1;
  if (leftHasHistory !== rightHasHistory) return leftHasHistory - rightHasHistory;
  const leftDate = left?.lastPlannedDateKey || "";
  const rightDate = right?.lastPlannedDateKey || "";
  if (leftDate !== rightDate) return rightDate.localeCompare(leftDate);
  return String(left?.title || "").localeCompare(String(right?.title || ""));
}

function getLinkedOutcome(goal, goalsById) {
  const linkedId =
    (typeof goal?.parentId === "string" && goal.parentId.trim()) ||
    (typeof goal?.outcomeId === "string" && goal.outcomeId.trim()) ||
    (typeof goal?.primaryGoalId === "string" && goal.primaryGoalId.trim()) ||
    "";
  if (!linkedId) return null;
  const linkedGoal = goalsById.get(linkedId) || null;
  return resolveGoalType(linkedGoal) === "OUTCOME" ? linkedGoal : null;
}

function resolveContributionTarget(activeCategory, goalsById) {
  const mainGoalId = typeof activeCategory?.mainGoalId === "string" ? activeCategory.mainGoalId.trim() : "";
  const mainGoal = mainGoalId ? goalsById.get(mainGoalId) || null : null;
  return {
    label: mainGoal?.title || activeCategory?.name || "ta priorité active",
    mainGoal,
  };
}

function classifyFamilyFromTokens(tokens = []) {
  let bestFamily = null;
  let bestScore = 0;
  for (const [family, hints] of Object.entries(CATEGORY_FAMILY_HINTS)) {
    let score = 0;
    for (const token of hints) {
      if (tokens.includes(token)) score += 1;
    }
    if (score > bestScore) {
      bestFamily = family;
      bestScore = score;
    }
  }
  return bestScore > 0 ? bestFamily : null;
}

function buildCategoryFamilyTokens({ category, mainGoal, linkedOutcome, goal }) {
  return tokenize(
    [
      category?.name || "",
      mainGoal?.title || "",
      linkedOutcome?.title || "",
      goal?.title || "",
      goal?.habitNotes || "",
      goal?.notes || "",
    ].join(" ")
  );
}

function buildCategorySnapshot({ activeCategory, goals, occurrences }) {
  const activeCategoryId = activeCategory?.id || null;
  if (!activeCategoryId) {
    return {
      activeCategoryId: null,
      activeCategoryLabel: null,
      actionCount: 0,
      occurrenceCount: 0,
      investedMinutes: 0,
      lastActivityDateKey: null,
    };
  }

  const actionCount = safeArray(goals).filter(
    (goal) => goal?.categoryId === activeCategoryId && resolveGoalType(goal) === "PROCESS"
  ).length;

  let occurrenceCount = 0;
  let investedMinutes = 0;
  let lastActivityDateKey = null;
  const goalsById = buildGoalsById(goals);
  for (const occurrence of safeArray(occurrences)) {
    const goal = goalsById.get(occurrence?.goalId || "") || null;
    if (!goal || goal.categoryId !== activeCategoryId) continue;
    occurrenceCount += 1;
    const dateKey = typeof occurrence?.date === "string" ? occurrence.date : "";
    if (dateKey && (!lastActivityDateKey || dateKey > lastActivityDateKey)) {
      lastActivityDateKey = dateKey;
    }
    if (occurrence?.status === "done" && Number.isFinite(occurrence?.durationMinutes)) {
      investedMinutes += occurrence.durationMinutes;
    }
  }

  return {
    activeCategoryId,
    activeCategoryLabel: activeCategory?.name || activeCategoryId,
    actionCount,
    occurrenceCount,
    investedMinutes,
    lastActivityDateKey,
  };
}

function hasActiveCategoryStructureGap({ activeCategory, goals }) {
  if (!activeCategory?.id) return false;
  const executableGoals = safeArray(goals)
    .filter(isExecutableGoal)
    .filter((goal) => goal.categoryId === activeCategory.id);
  return executableGoals.length === 0;
}

function buildReasonLinkLabel({ reasonLinkType, activeCategoryLabel, recommendedCategoryLabel }) {
  if (reasonLinkType === TODAY_CATEGORY_REASON_LINK_TYPE.CROSS_CATEGORY) {
    if (recommendedCategoryLabel && activeCategoryLabel) {
      return `Action en ${recommendedCategoryLabel} utile pour ${activeCategoryLabel}`;
    }
    if (recommendedCategoryLabel) return `Action reliée à ${recommendedCategoryLabel}`;
    return "Action reliée à ta priorité active";
  }
  if (reasonLinkType === TODAY_CATEGORY_REASON_LINK_TYPE.STRUCTURE_MISSING) {
    return activeCategoryLabel ? `Structurer ${activeCategoryLabel}` : "Structurer la catégorie active";
  }
  return activeCategoryLabel ? `Recommandée dans ${activeCategoryLabel}` : "Recommandée dans la catégorie active";
}

function buildDirectExplanation({ recommendedActionTitle, activeCategoryLabel, contributionTargetLabel, hasOccurrence }) {
  if (hasOccurrence && activeCategoryLabel) {
    return `${recommendedActionTitle} reste l'action la plus cohérente dans ${activeCategoryLabel} maintenant.`;
  }
  if (recommendedActionTitle) {
    return `${recommendedActionTitle} n’est pas encore planifiée aujourd’hui. Programme-la pour avancer sur ${contributionTargetLabel}.`;
  }
  return activeCategoryLabel
    ? `Reste sur ${activeCategoryLabel} pour garder une recommandation claire.`
    : "Reste sur la catégorie active pour garder une recommandation claire.";
}

function buildCrossCategoryExplanation({ recommendedActionTitle, recommendedCategoryLabel, contributionTargetLabel, hasOccurrence }) {
  const categoryPart = recommendedCategoryLabel ? ` en ${recommendedCategoryLabel}` : "";
  if (hasOccurrence) {
    return `${recommendedActionTitle}${categoryPart} contribue à ${contributionTargetLabel}.`;
  }
  return `${recommendedActionTitle}${categoryPart} contribue à ${contributionTargetLabel}. Programme-la si tu veux faire avancer cet objectif.`;
}

function buildStructureMissingExplanation({ activeCategoryLabel, contributionTargetLabel }) {
  if (activeCategoryLabel) {
    return `Tu n’as pas encore défini d’action exploitable pour ${contributionTargetLabel}. Commence par clarifier l’objectif ou créer une première action en ${activeCategoryLabel}.`;
  }
  return `Tu n’as pas encore défini d’action exploitable pour ${contributionTargetLabel}. Commence par clarifier l’objectif ou créer une première action.`;
}

export function resolveCrossCategoryContribution({
  activeCategory = null,
  candidateGoal = null,
  categoriesById,
  goalsById,
}) {
  if (!activeCategory?.id || !candidateGoal?.id) return null;
  if (candidateGoal.categoryId === activeCategory.id) return null;

  const candidateCategory = categoriesById.get(candidateGoal.categoryId) || null;
  const activeContributionTarget = resolveContributionTarget(activeCategory, goalsById);
  const activeMainGoal = activeContributionTarget.mainGoal;
  const candidateLinkedOutcome = getLinkedOutcome(candidateGoal, goalsById);

  if (
    candidateLinkedOutcome &&
    activeMainGoal &&
    candidateLinkedOutcome.id === activeMainGoal.id &&
    candidateLinkedOutcome.categoryId === activeCategory.id
  ) {
    return {
      score: 100,
      evidenceType: "linked_outcome_match",
      contributionTargetLabel: activeContributionTarget.label,
      recommendedCategoryId: candidateGoal.categoryId || null,
      recommendedCategoryLabel: candidateCategory?.name || null,
      explanation: buildCrossCategoryExplanation({
        recommendedActionTitle: candidateGoal.title || "Action",
        recommendedCategoryLabel: candidateCategory?.name || null,
        contributionTargetLabel: activeContributionTarget.label,
        hasOccurrence: false,
      }),
    };
  }

  const activeTokens = buildCategoryFamilyTokens({
    category: activeCategory,
    mainGoal: activeMainGoal,
  });
  const candidateTokens = buildCategoryFamilyTokens({
    category: candidateCategory,
    linkedOutcome: candidateLinkedOutcome,
    goal: candidateGoal,
  });
  const overlap = activeTokens.filter((token) => candidateTokens.includes(token));
  if (overlap.length > 0) {
    return {
      score: 60 + overlap.length * 5,
      evidenceType: "token_overlap",
      contributionTargetLabel: activeContributionTarget.label,
      recommendedCategoryId: candidateGoal.categoryId || null,
      recommendedCategoryLabel: candidateCategory?.name || null,
      explanation: buildCrossCategoryExplanation({
        recommendedActionTitle: candidateGoal.title || "Action",
        recommendedCategoryLabel: candidateCategory?.name || null,
        contributionTargetLabel: activeContributionTarget.label,
        hasOccurrence: false,
      }),
    };
  }

  const activeFamily = classifyFamilyFromTokens(activeTokens);
  const candidateFamily = classifyFamilyFromTokens(candidateTokens);
  if (activeFamily === "finance" && candidateFamily === "business") {
    return {
      score: 40,
      evidenceType: "family_mapping_business_to_finance",
      contributionTargetLabel: activeContributionTarget.label,
      recommendedCategoryId: candidateGoal.categoryId || null,
      recommendedCategoryLabel: candidateCategory?.name || null,
      explanation: buildCrossCategoryExplanation({
        recommendedActionTitle: candidateGoal.title || "Action",
        recommendedCategoryLabel: candidateCategory?.name || null,
        contributionTargetLabel: activeContributionTarget.label,
        hasOccurrence: false,
      }),
    };
  }

  return null;
}

function buildCandidateSummary({ goal, activity, category, contribution = null }) {
  return {
    actionId: goal.id,
    title: goal.title || "Action",
    categoryId: goal.categoryId || null,
    categoryName: category?.name || null,
    durationMin: Number.isFinite(goal.sessionMinutes) ? goal.sessionMinutes : activity?.durationMin || null,
    lastPlannedDateKey: activity?.lastPlannedDateKey || null,
    priorityRank: getGoalPriorityRank(goal),
    contribution,
  };
}

function withSharedFields({
  activeCategory,
  categorySnapshot,
  contributionTargetLabel,
  reasonLinkType,
  selectionScope,
  recommendedAction,
  recommendedOccurrence,
  recommendedCategory,
  explanation,
  candidateActionSummaries = [],
  gapReason = "none",
  hasGapToday = false,
  activeCategoryCandidateCount = 0,
  crossCategoryCandidateCount = 0,
}) {
  const recommendedActionTitle =
    recommendedAction?.title ||
    (recommendedOccurrence ? recommendedOccurrence.title || "Action" : null) ||
    candidateActionSummaries[0]?.title ||
    null;
  const recommendedCategoryLabel = recommendedCategory?.name || activeCategory?.name || null;
  return {
    hasGapToday,
    gapReason,
    selectionScope,
    reasonLinkType,
    recommendedActionId: recommendedAction?.id || recommendedOccurrence?.goalId || candidateActionSummaries[0]?.actionId || null,
    recommendedOccurrenceId: recommendedOccurrence?.id || null,
    recommendedActionTitle,
    recommendedOccurrence,
    recommendedCategoryId: recommendedCategory?.id || activeCategory?.id || null,
    recommendedCategoryLabel,
    contributionTargetLabel,
    reasonLinkLabel: buildReasonLinkLabel({
      reasonLinkType,
      activeCategoryLabel: activeCategory?.name || null,
      recommendedCategoryLabel,
    }),
    explanation,
    categorySnapshot,
    activeCategoryCandidateCount,
    crossCategoryCandidateCount,
    candidateActionSummaries: candidateActionSummaries.map(({ contribution, ...summary }) => ({
      ...summary,
      contributionTargetLabel: contribution?.contributionTargetLabel || null,
      evidenceType: contribution?.evidenceType || null,
    })),
  };
}

export function computeCategoryScopedRecommendation({
  activeDate = "",
  systemToday = "",
  activeCategoryId = null,
  categories = [],
  goals = [],
  occurrences = [],
  plannedActionsForActiveDate = [],
  preferredTimeBlocks = [],
}) {
  const categoriesById = buildCategoriesById(categories);
  const goalsById = buildGoalsById(goals);
  const activeCategory = activeCategoryId ? categoriesById.get(activeCategoryId) || null : null;
  const categorySnapshot = buildCategorySnapshot({ activeCategory, goals, occurrences });
  const activeCategoryNeedsStructure = hasActiveCategoryStructureGap({ activeCategory, goals });
  const contributionTarget = resolveContributionTarget(activeCategory, goalsById);
  const contributionTargetLabel = contributionTarget.label;
  const isToday = Boolean(activeDate && systemToday && activeDate === systemToday);
  const activityByGoal = buildGoalActivityIndex(occurrences);
  const plannedDayOccurrences = safeArray(plannedActionsForActiveDate)
    .map((occurrence) => {
      const goal = goalsById.get(occurrence?.goalId || "") || null;
      const category = categoriesById.get(goal?.categoryId || "") || null;
      return {
        ...occurrence,
        title: goal?.title || occurrence?.title || "Action",
        goalCategoryId: goal?.categoryId || null,
        goalCategoryName: category?.name || null,
      };
    })
    .sort((left, right) => compareOccurrences(left, right, preferredTimeBlocks));

  const activeDayOccurrences = plannedDayOccurrences.filter((occurrence) => {
    if (!activeCategory?.id) return true;
    return occurrence?.goalCategoryId === activeCategory.id;
  });

  if (activeDayOccurrences.length > 0) {
    const occurrence = activeDayOccurrences[0];
    const recommendedGoal = goalsById.get(occurrence.goalId || "") || null;
    return withSharedFields({
      activeCategory: activeCategory || categoriesById.get(occurrence.goalCategoryId || "") || null,
      categorySnapshot,
      contributionTargetLabel,
      reasonLinkType: TODAY_CATEGORY_REASON_LINK_TYPE.DIRECT_CATEGORY,
      selectionScope: TODAY_CATEGORY_SELECTION_SCOPE.ACTIVE_CATEGORY,
      recommendedAction: recommendedGoal,
      recommendedOccurrence: occurrence,
      recommendedCategory: categoriesById.get(recommendedGoal?.categoryId || "") || activeCategory || null,
      explanation: buildDirectExplanation({
        recommendedActionTitle: occurrence.title || recommendedGoal?.title || "Action",
        activeCategoryLabel: activeCategory?.name || occurrence.goalCategoryName || null,
        contributionTargetLabel,
        hasOccurrence: true,
      }),
    });
  }

  const emptyDay = plannedDayOccurrences.length === 0;
  const emptyActiveCategory = Boolean(activeCategory?.id) && plannedDayOccurrences.length > 0;
  const totalPlannedMinutes = plannedDayOccurrences.reduce(
    (total, occurrence) => total + (Number.isFinite(occurrence?.durationMinutes) ? occurrence.durationMinutes : 0),
    0
  );
  const lowLoadToday = plannedDayOccurrences.length > 0 && totalPlannedMinutes < 30;
  const gapReason = emptyDay
    ? "empty_day"
    : emptyActiveCategory
      ? "empty_active_category"
      : lowLoadToday
        ? "low_load_day"
        : "none";
  const hasGapToday = isToday && gapReason !== "none";

  const plannedGoalIdsForActiveDate = new Set(plannedDayOccurrences.map((occurrence) => occurrence?.goalId).filter(Boolean));
  const activeCategoryCandidates = safeArray(goals)
    .filter(isExecutableGoal)
    .filter((goal) => !plannedGoalIdsForActiveDate.has(goal.id))
    .filter((goal) => !activeCategory?.id || goal.categoryId === activeCategory.id)
    .map((goal) =>
      buildCandidateSummary({
        goal,
        activity: activityByGoal.get(goal.id) || null,
        category: categoriesById.get(goal.categoryId) || null,
      })
    )
    .sort(compareCandidateSummaries);

  const crossCategoryCandidates = safeArray(goals)
    .filter(isExecutableGoal)
    .filter((goal) => !plannedGoalIdsForActiveDate.has(goal.id))
    .filter((goal) => !activeCategory?.id || goal.categoryId !== activeCategory.id)
    .map((goal) => {
      const contribution = resolveCrossCategoryContribution({
        activeCategory,
        candidateGoal: goal,
        categoriesById,
        goalsById,
      });
      if (!contribution) return null;
      return buildCandidateSummary({
        goal,
        activity: activityByGoal.get(goal.id) || null,
        category: categoriesById.get(goal.categoryId) || null,
        contribution,
      });
    })
    .filter(Boolean)
    .sort((left, right) => {
      const leftScore = left?.contribution?.score || 0;
      const rightScore = right?.contribution?.score || 0;
      if (leftScore !== rightScore) return rightScore - leftScore;
      return compareCandidateSummaries(left, right);
    });

  const crossDayOccurrences = plannedDayOccurrences
    .map((occurrence) => {
      const goal = goalsById.get(occurrence.goalId || "") || null;
      const contribution = resolveCrossCategoryContribution({
        activeCategory,
        candidateGoal: goal,
        categoriesById,
        goalsById,
      });
      return {
        occurrence,
        goal,
        contribution,
      };
    })
    .filter((entry) => entry.goal && entry.contribution)
    .sort((left, right) => {
      const leftScore = left.contribution?.score || 0;
      const rightScore = right.contribution?.score || 0;
      if (leftScore !== rightScore) return rightScore - leftScore;
      return compareOccurrences(left.occurrence, right.occurrence, preferredTimeBlocks);
    });

  if (hasGapToday && activeCategoryCandidates.length > 0) {
    const selected = activeCategoryCandidates[0];
    const selectedGoal = goalsById.get(selected.actionId || "") || null;
    return withSharedFields({
      activeCategory,
      categorySnapshot,
      contributionTargetLabel,
      reasonLinkType: TODAY_CATEGORY_REASON_LINK_TYPE.DIRECT_CATEGORY,
      selectionScope: TODAY_CATEGORY_SELECTION_SCOPE.ACTIVE_CATEGORY,
      recommendedAction: selectedGoal,
      recommendedOccurrence: null,
      recommendedCategory: categoriesById.get(selected.categoryId || "") || activeCategory || null,
      explanation: buildDirectExplanation({
        recommendedActionTitle: selected.title,
        activeCategoryLabel: activeCategory?.name || null,
        contributionTargetLabel,
        hasOccurrence: false,
      }),
      candidateActionSummaries: activeCategoryCandidates.slice(0, 2),
      gapReason,
      hasGapToday,
      activeCategoryCandidateCount: activeCategoryCandidates.length,
      crossCategoryCandidateCount: crossCategoryCandidates.length,
    });
  }

  if (hasGapToday && activeCategoryNeedsStructure) {
    return withSharedFields({
      activeCategory,
      categorySnapshot,
      contributionTargetLabel,
      reasonLinkType: TODAY_CATEGORY_REASON_LINK_TYPE.STRUCTURE_MISSING,
      selectionScope: TODAY_CATEGORY_SELECTION_SCOPE.STRUCTURE_MISSING,
      recommendedAction: null,
      recommendedOccurrence: null,
      recommendedCategory: activeCategory,
      explanation: buildStructureMissingExplanation({
        activeCategoryLabel: activeCategory?.name || null,
        contributionTargetLabel,
      }),
      candidateActionSummaries: [],
      gapReason,
      hasGapToday,
      activeCategoryCandidateCount: activeCategoryCandidates.length,
      crossCategoryCandidateCount: 0,
    });
  }

  if (crossDayOccurrences.length > 0) {
    const selected = crossDayOccurrences[0];
    return withSharedFields({
      activeCategory,
      categorySnapshot,
      contributionTargetLabel: selected.contribution.contributionTargetLabel,
      reasonLinkType: TODAY_CATEGORY_REASON_LINK_TYPE.CROSS_CATEGORY,
      selectionScope: TODAY_CATEGORY_SELECTION_SCOPE.CROSS_CATEGORY,
      recommendedAction: selected.goal,
      recommendedOccurrence: selected.occurrence,
      recommendedCategory: categoriesById.get(selected.goal?.categoryId || "") || null,
      explanation: buildCrossCategoryExplanation({
        recommendedActionTitle: selected.occurrence.title || selected.goal?.title || "Action",
        recommendedCategoryLabel: categoriesById.get(selected.goal?.categoryId || "")?.name || null,
        contributionTargetLabel: selected.contribution.contributionTargetLabel,
        hasOccurrence: true,
      }),
    });
  }

  if (hasGapToday && crossCategoryCandidates.length > 0) {
    const selected = crossCategoryCandidates[0];
    const selectedGoal = goalsById.get(selected.actionId || "") || null;
    return withSharedFields({
      activeCategory,
      categorySnapshot,
      contributionTargetLabel: selected.contribution?.contributionTargetLabel || contributionTargetLabel,
      reasonLinkType: TODAY_CATEGORY_REASON_LINK_TYPE.CROSS_CATEGORY,
      selectionScope: TODAY_CATEGORY_SELECTION_SCOPE.CROSS_CATEGORY,
      recommendedAction: selectedGoal,
      recommendedOccurrence: null,
      recommendedCategory: categoriesById.get(selected.categoryId || "") || null,
      explanation: selected.contribution?.explanation || buildCrossCategoryExplanation({
        recommendedActionTitle: selected.title,
        recommendedCategoryLabel: selected.categoryName,
        contributionTargetLabel: selected.contribution?.contributionTargetLabel || contributionTargetLabel,
        hasOccurrence: false,
      }),
      candidateActionSummaries: crossCategoryCandidates.slice(0, 2),
      gapReason,
      hasGapToday,
      activeCategoryCandidateCount: activeCategoryCandidates.length,
      crossCategoryCandidateCount: crossCategoryCandidates.length,
    });
  }

  if (hasGapToday) {
    return withSharedFields({
      activeCategory,
      categorySnapshot,
      contributionTargetLabel,
      reasonLinkType: TODAY_CATEGORY_REASON_LINK_TYPE.STRUCTURE_MISSING,
      selectionScope: TODAY_CATEGORY_SELECTION_SCOPE.STRUCTURE_MISSING,
      recommendedAction: null,
      recommendedOccurrence: null,
      recommendedCategory: activeCategory,
      explanation: buildStructureMissingExplanation({
        activeCategoryLabel: activeCategory?.name || null,
        contributionTargetLabel,
      }),
      candidateActionSummaries: [],
      gapReason,
      hasGapToday,
      activeCategoryCandidateCount: activeCategoryCandidates.length,
      crossCategoryCandidateCount: 0,
    });
  }

  return withSharedFields({
    activeCategory,
    categorySnapshot,
    contributionTargetLabel,
    reasonLinkType: TODAY_CATEGORY_REASON_LINK_TYPE.DIRECT_CATEGORY,
    selectionScope: TODAY_CATEGORY_SELECTION_SCOPE.NONE,
    recommendedAction: null,
    recommendedOccurrence: null,
    recommendedCategory: activeCategory,
    explanation: activeCategory?.name
      ? `Reste dans ${activeCategory.name} pour garder un fil d’exécution clair.`
      : "Reste sur la catégorie visible pour garder un fil d’exécution clair.",
  });
}
