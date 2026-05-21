import {
  SYSTEM_ANALYSIS_CONFIRMATION_LEVEL,
  SYSTEM_ANALYSIS_CORRECTION_ACTION,
  SYSTEM_ANALYSIS_CORRECTION_ITEM_ACTION,
  SYSTEM_ANALYSIS_CORRECTION_TARGET_TYPE,
  SYSTEM_ANALYSIS_ISSUE_SEVERITY,
  SYSTEM_ANALYSIS_SUPPORT_STATUS,
  validateCorrectionDraft,
} from "./systemAnalysisContract";
import { PLANNING_REPAIR_TYPE } from "../../logic/planningRepairModel";
import {
  addDaysLocal,
  normalizeLocalDateKey,
  normalizeStartTime,
} from "../../utils/datetime";

export const SYSTEM_ANALYSIS_CORRECTION_GROUP = Object.freeze({
  PRIORITY: "priority",
  LOAD: "load",
  OCCURRENCES: "occurrences",
  OBJECTIVES: "objectives",
  ACTIONS: "actions",
  NEXT_7_DAYS: "next7Days",
  PLANNING: "planning",
  UNSUPPORTED: "unsupported",
});

export const SYSTEM_ANALYSIS_CORRECTION_REVIEW_STATUS = Object.freeze({
  VALID: "valid",
  NEEDS_REVIEW: "needs_review",
  UNSUPPORTED: "unsupported",
  APPLIED: "applied",
});

const GROUP_LABELS = Object.freeze({
  [SYSTEM_ANALYSIS_CORRECTION_GROUP.PRIORITY]: "Priorité",
  [SYSTEM_ANALYSIS_CORRECTION_GROUP.LOAD]: "Charge",
  [SYSTEM_ANALYSIS_CORRECTION_GROUP.OCCURRENCES]: "Blocs",
  [SYSTEM_ANALYSIS_CORRECTION_GROUP.OBJECTIVES]: "Objectifs",
  [SYSTEM_ANALYSIS_CORRECTION_GROUP.ACTIONS]: "Actions",
  [SYSTEM_ANALYSIS_CORRECTION_GROUP.NEXT_7_DAYS]: "7 jours",
  [SYSTEM_ANALYSIS_CORRECTION_GROUP.PLANNING]: "Planning",
  [SYSTEM_ANALYSIS_CORRECTION_GROUP.UNSUPPORTED]: "À revoir",
});

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function safeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function safeNumber(value, fallback = null) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function hasError(issues) {
  return safeArray(issues).some((issue) => issue?.severity === SYSTEM_ANALYSIS_ISSUE_SEVERITY.ERROR);
}

function issueMatchesPath(issue, path) {
  const issuePath = safeString(issue?.path);
  return issuePath === path || issuePath.startsWith(`${path}.`);
}

function issuesForPath(issues, path) {
  return safeArray(issues).filter((issue) => issueMatchesPath(issue, path));
}

function getOccurrenceById(state, occurrenceId) {
  const id = safeString(occurrenceId);
  return safeArray(state?.occurrences).find((occurrence) => safeString(occurrence?.id) === id) || null;
}

function getGoalById(state, goalId) {
  const id = safeString(goalId);
  return safeArray(state?.goals).find((goal) => safeString(goal?.id) === id) || null;
}

function getOccurrenceDate(occurrence) {
  return normalizeLocalDateKey(occurrence?.date || occurrence?.dateKey) || "";
}

function hasValidationRequirement(requirements, expected) {
  const normalizedExpected = safeString(expected).toLowerCase();
  return safeArray(requirements).some((requirement) => safeString(requirement).toLowerCase() === normalizedExpected);
}

function normalizeConfidence(value) {
  const confidence = safeNumber(value, null);
  if (confidence === null) return null;
  return Math.max(0, Math.min(1, confidence));
}

function buildItem({
  id,
  group,
  label,
  description,
  reason,
  expectedImpact = "",
  confidence = null,
  status,
  selectedIds,
  appliedIds = new Set(),
  validationIssues = [],
  repairPreview = null,
  visibleByDefault = true,
  priorityRank = null,
  destructive = false,
  supportStatus = "",
  targetType = "",
  action = "",
}) {
  const applied = appliedIds.has(id);
  const selectable =
    !destructive &&
    status === SYSTEM_ANALYSIS_CORRECTION_REVIEW_STATUS.VALID &&
    Boolean(repairPreview) &&
    !hasError(validationIssues);
  const selected = !applied && selectable && selectedIds.has(id);
  return {
    id,
    group,
    label: safeString(label),
    description: safeString(description),
    reason: safeString(reason),
    expectedImpact: safeString(expectedImpact),
    confidence: normalizeConfidence(confidence),
    status: applied ? SYSTEM_ANALYSIS_CORRECTION_REVIEW_STATUS.APPLIED : status,
    selected,
    selectable: !applied && selectable,
    applied,
    validationIssues: safeArray(validationIssues),
    repairPreview: applied ? null : repairPreview,
    visibleByDefault: Boolean(visibleByDefault),
    priorityRank: Number.isFinite(Number(priorityRank)) ? Number(priorityRank) : null,
    destructive: Boolean(destructive),
    supportStatus: safeString(supportStatus),
    targetType: safeString(targetType),
    action: safeString(action),
  };
}

function getActionLabel(action) {
  switch (action) {
    case SYSTEM_ANALYSIS_CORRECTION_ACTION.MOVE:
      return "Déplacer le bloc";
    case SYSTEM_ANALYSIS_CORRECTION_ACTION.POSTPONE:
      return "Reporter le bloc";
    case SYSTEM_ANALYSIS_CORRECTION_ACTION.REDUCE_DURATION:
      return "Réduire la durée";
    case SYSTEM_ANALYSIS_CORRECTION_ACTION.SKIP_ONCE:
      return "Ignorer cette occurrence";
    case SYSTEM_ANALYSIS_CORRECTION_ACTION.PROTECT:
      return "Protéger ce bloc";
    default:
      return "Correction de bloc";
  }
}

function getCorrectionItemActionLabel(action) {
  switch (action) {
    case SYSTEM_ANALYSIS_CORRECTION_ITEM_ACTION.ADD:
      return "Ajouter";
    case SYSTEM_ANALYSIS_CORRECTION_ITEM_ACTION.REMOVE:
      return "Supprimer";
    case SYSTEM_ANALYSIS_CORRECTION_ITEM_ACTION.REPLACE:
      return "Remplacer";
    case SYSTEM_ANALYSIS_CORRECTION_ITEM_ACTION.REDUCE:
      return "Réduire";
    case SYSTEM_ANALYSIS_CORRECTION_ITEM_ACTION.MOVE:
      return "Déplacer";
    case SYSTEM_ANALYSIS_CORRECTION_ITEM_ACTION.PROTECT:
      return "Protéger";
    case SYSTEM_ANALYSIS_CORRECTION_ITEM_ACTION.PAUSE:
      return "Mettre en pause";
    case SYSTEM_ANALYSIS_CORRECTION_ITEM_ACTION.CLARIFY:
      return "Clarifier";
    case SYSTEM_ANALYSIS_CORRECTION_ITEM_ACTION.MERGE:
      return "Fusionner";
    case SYSTEM_ANALYSIS_CORRECTION_ITEM_ACTION.SPLIT:
      return "Séparer";
    case SYSTEM_ANALYSIS_CORRECTION_ITEM_ACTION.KEEP:
      return "Conserver";
    case SYSTEM_ANALYSIS_CORRECTION_ITEM_ACTION.REBALANCE:
      return "Rééquilibrer";
    case SYSTEM_ANALYSIS_CORRECTION_ITEM_ACTION.LINK:
      return "Lier";
    default:
      return "Correction";
  }
}

function combineExpectedImpactAndRisk(item) {
  const expectedImpact = safeString(item?.expectedImpact);
  const risk = safeString(item?.risk);
  if (expectedImpact && risk) return `${expectedImpact} · Risque : ${risk}`;
  return expectedImpact || (risk ? `Risque : ${risk}` : "");
}

function buildOccurrenceRepairPreview({ adjustment, occurrence, validationRequirements }) {
  const occurrenceId = safeString(adjustment?.occurrenceId);
  const action = safeString(adjustment?.action);
  const proposedDateKey = normalizeLocalDateKey(adjustment?.proposedDateKey || adjustment?.dateKey);
  const proposedStart = normalizeStartTime(adjustment?.proposedStart || adjustment?.start);
  const proposedDurationMinutes = safeNumber(adjustment?.proposedDurationMinutes ?? adjustment?.durationMinutes, null);
  const reason = safeString(adjustment?.reason);

  if (action === SYSTEM_ANALYSIS_CORRECTION_ACTION.PROTECT) {
    return {
      status: SYSTEM_ANALYSIS_CORRECTION_REVIEW_STATUS.UNSUPPORTED,
      description: "Protection à afficher seulement pour l’instant.",
      repairPreview: null,
    };
  }

  if (action === SYSTEM_ANALYSIS_CORRECTION_ACTION.MOVE) {
    if (!proposedDateKey || !proposedStart) {
      return {
        status: SYSTEM_ANALYSIS_CORRECTION_REVIEW_STATUS.NEEDS_REVIEW,
        description: "Date ou heure cible manquante.",
        repairPreview: null,
      };
    }
    return {
      status: SYSTEM_ANALYSIS_CORRECTION_REVIEW_STATUS.VALID,
      description: `Vers ${proposedDateKey} à ${proposedStart}.`,
      repairPreview: {
        type: PLANNING_REPAIR_TYPE.CHOOSE_TIME,
        occurrenceId,
        dateKey: proposedDateKey,
        start: proposedStart,
        durationMinutes: proposedDurationMinutes || undefined,
        reason,
      },
    };
  }

  if (action === SYSTEM_ANALYSIS_CORRECTION_ACTION.POSTPONE) {
    if (!proposedDateKey) {
      return {
        status: SYSTEM_ANALYSIS_CORRECTION_REVIEW_STATUS.NEEDS_REVIEW,
        description: "Date de report manquante.",
        repairPreview: null,
      };
    }
    const tomorrow = addDaysLocal(getOccurrenceDate(occurrence), 1);
    if (tomorrow && proposedDateKey === tomorrow) {
      return {
        status: SYSTEM_ANALYSIS_CORRECTION_REVIEW_STATUS.VALID,
        description: `Reporter au ${proposedDateKey}${proposedStart ? ` à ${proposedStart}` : ""}.`,
        repairPreview: {
          type: PLANNING_REPAIR_TYPE.MOVE_TOMORROW,
          occurrenceId,
          dateKey: proposedDateKey,
          start: proposedStart || undefined,
          durationMinutes: proposedDurationMinutes || undefined,
          reason,
        },
      };
    }
    if (proposedStart) {
      return {
        status: SYSTEM_ANALYSIS_CORRECTION_REVIEW_STATUS.VALID,
        description: `Replacer le ${proposedDateKey} à ${proposedStart}.`,
        repairPreview: {
          type: PLANNING_REPAIR_TYPE.CHOOSE_TIME,
          occurrenceId,
          dateKey: proposedDateKey,
          start: proposedStart,
          durationMinutes: proposedDurationMinutes || undefined,
          reason,
        },
      };
    }
    return {
      status: SYSTEM_ANALYSIS_CORRECTION_REVIEW_STATUS.NEEDS_REVIEW,
      description: "Heure de report à choisir.",
      repairPreview: null,
    };
  }

  if (action === SYSTEM_ANALYSIS_CORRECTION_ACTION.REDUCE_DURATION) {
    if (!proposedDurationMinutes || proposedDurationMinutes <= 0) {
      return {
        status: SYSTEM_ANALYSIS_CORRECTION_REVIEW_STATUS.NEEDS_REVIEW,
        description: "Durée cible manquante.",
        repairPreview: null,
      };
    }
    return {
      status: SYSTEM_ANALYSIS_CORRECTION_REVIEW_STATUS.VALID,
      description: `Réduire à ${proposedDurationMinutes} min.`,
      repairPreview: {
        type: PLANNING_REPAIR_TYPE.REDUCE_DURATION,
        occurrenceId,
        durationMinutes: proposedDurationMinutes,
        reason,
      },
    };
  }

  if (action === SYSTEM_ANALYSIS_CORRECTION_ACTION.SKIP_ONCE) {
    if (!hasValidationRequirement(validationRequirements, "destructive_confirmation")) {
      return {
        status: SYSTEM_ANALYSIS_CORRECTION_REVIEW_STATUS.NEEDS_REVIEW,
        description: "Cette action demande une confirmation destructive explicite.",
        repairPreview: null,
      };
    }
    return {
      status: SYSTEM_ANALYSIS_CORRECTION_REVIEW_STATUS.VALID,
      description: "Marquer ce bloc comme ignoré une seule fois.",
      repairPreview: {
        type: PLANNING_REPAIR_TYPE.SKIP_ONCE,
        occurrenceId,
        reason,
      },
    };
  }

  return {
    status: SYSTEM_ANALYSIS_CORRECTION_REVIEW_STATUS.UNSUPPORTED,
    description: "Correction non prise en charge par la revue v1.",
    repairPreview: null,
  };
}

function overrideStatusForIssues(mapped, validationIssues) {
  if (hasError(validationIssues)) {
    return {
      ...mapped,
      status: SYSTEM_ANALYSIS_CORRECTION_REVIEW_STATUS.UNSUPPORTED,
      repairPreview: null,
    };
  }
  if (validationIssues.some((issue) => issue?.code === "CORRECTION_NOT_PLANNING_REPAIR_COMPATIBLE")) {
    return {
      ...mapped,
      status: SYSTEM_ANALYSIS_CORRECTION_REVIEW_STATUS.UNSUPPORTED,
      repairPreview: null,
      description: mapped.description || "Cette occurrence n’est pas réparable directement.",
    };
  }
  return mapped;
}

function buildCorrectionItemRepairPreview(item) {
  const targetId = safeString(item?.targetId);
  const targetType = safeString(item?.targetType);
  const action = safeString(item?.action);
  const proposedDateKey = normalizeLocalDateKey(item?.proposedDateKey || item?.dateKey);
  const proposedStart = normalizeStartTime(item?.proposedStart || item?.start);
  const proposedDurationMinutes = safeNumber(item?.proposedDurationMinutes ?? item?.durationMinutes, null);
  const reason = safeString(item?.why) || safeString(item?.reason);

  if (targetType !== SYSTEM_ANALYSIS_CORRECTION_TARGET_TYPE.OCCURRENCE) {
    return {
      status: SYSTEM_ANALYSIS_CORRECTION_REVIEW_STATUS.NEEDS_REVIEW,
      description: safeString(item?.whatChanges) || "Cette proposition demande une revue dédiée.",
      repairPreview: null,
    };
  }

  if (action === SYSTEM_ANALYSIS_CORRECTION_ITEM_ACTION.MOVE) {
    if (!proposedDateKey || !proposedStart) {
      return {
        status: SYSTEM_ANALYSIS_CORRECTION_REVIEW_STATUS.NEEDS_REVIEW,
        description: "Date ou heure cible manquante.",
        repairPreview: null,
      };
    }
    return {
      status: SYSTEM_ANALYSIS_CORRECTION_REVIEW_STATUS.VALID,
      description: `Vers ${proposedDateKey} à ${proposedStart}.`,
      repairPreview: {
        type: PLANNING_REPAIR_TYPE.CHOOSE_TIME,
        occurrenceId: targetId,
        dateKey: proposedDateKey,
        start: proposedStart,
        durationMinutes: proposedDurationMinutes || undefined,
        reason,
      },
    };
  }

  if (action === SYSTEM_ANALYSIS_CORRECTION_ITEM_ACTION.REDUCE) {
    if (!proposedDurationMinutes || proposedDurationMinutes <= 0) {
      return {
        status: SYSTEM_ANALYSIS_CORRECTION_REVIEW_STATUS.NEEDS_REVIEW,
        description: "Durée cible manquante.",
        repairPreview: null,
      };
    }
    return {
      status: SYSTEM_ANALYSIS_CORRECTION_REVIEW_STATUS.VALID,
      description: `Réduire à ${proposedDurationMinutes} min.`,
      repairPreview: {
        type: PLANNING_REPAIR_TYPE.REDUCE_DURATION,
        occurrenceId: targetId,
        durationMinutes: proposedDurationMinutes,
        reason,
      },
    };
  }

  return {
    status: SYSTEM_ANALYSIS_CORRECTION_REVIEW_STATUS.NEEDS_REVIEW,
    description: safeString(item?.whatChanges) || "Cette proposition demande une revue dédiée avant application.",
    repairPreview: null,
  };
}

function statusFromCorrectionItem(item) {
  const supportStatus = safeString(item?.supportStatus);
  if (supportStatus === SYSTEM_ANALYSIS_SUPPORT_STATUS.APPLICABLE) return SYSTEM_ANALYSIS_CORRECTION_REVIEW_STATUS.VALID;
  if (supportStatus === SYSTEM_ANALYSIS_SUPPORT_STATUS.UNSUPPORTED) return SYSTEM_ANALYSIS_CORRECTION_REVIEW_STATUS.UNSUPPORTED;
  return SYSTEM_ANALYSIS_CORRECTION_REVIEW_STATUS.NEEDS_REVIEW;
}

function groupForCorrectionItem(item, index) {
  const targetType = safeString(item?.targetType);
  const supportStatus = safeString(item?.supportStatus);
  if (item?.destructive === true || supportStatus === SYSTEM_ANALYSIS_SUPPORT_STATUS.UNSUPPORTED) {
    return SYSTEM_ANALYSIS_CORRECTION_GROUP.UNSUPPORTED;
  }
  if (supportStatus === SYSTEM_ANALYSIS_SUPPORT_STATUS.APPLICABLE && index < 3) {
    return SYSTEM_ANALYSIS_CORRECTION_GROUP.PRIORITY;
  }
  if (targetType === SYSTEM_ANALYSIS_CORRECTION_TARGET_TYPE.OCCURRENCE) return SYSTEM_ANALYSIS_CORRECTION_GROUP.OCCURRENCES;
  if (targetType === SYSTEM_ANALYSIS_CORRECTION_TARGET_TYPE.OBJECTIVE) return SYSTEM_ANALYSIS_CORRECTION_GROUP.OBJECTIVES;
  if (targetType === SYSTEM_ANALYSIS_CORRECTION_TARGET_TYPE.ACTION) return SYSTEM_ANALYSIS_CORRECTION_GROUP.ACTIONS;
  if (
    targetType === SYSTEM_ANALYSIS_CORRECTION_TARGET_TYPE.SCHEDULE ||
    targetType === SYSTEM_ANALYSIS_CORRECTION_TARGET_TYPE.SYSTEM
  ) {
    return SYSTEM_ANALYSIS_CORRECTION_GROUP.PLANNING;
  }
  return SYSTEM_ANALYSIS_CORRECTION_GROUP.UNSUPPORTED;
}

function buildCorrectionItems({ draft, selectedIds, appliedIds, contractIssues }) {
  return safeArray(draft?.correctionItems).map((item, index) => {
    const path = `correctionItems[${index}]`;
    const validationIssues = issuesForPath(contractIssues, path);
    const supportStatus = safeString(item?.supportStatus);
    const destructive = item?.destructive === true;
    const mapped = overrideStatusForIssues(
      buildCorrectionItemRepairPreview(item),
      validationIssues
    );
    const declaredStatus = statusFromCorrectionItem(item);
    const status = destructive
      ? SYSTEM_ANALYSIS_CORRECTION_REVIEW_STATUS.NEEDS_REVIEW
      : (declaredStatus === SYSTEM_ANALYSIS_CORRECTION_REVIEW_STATUS.VALID ? mapped.status : declaredStatus);
    const visibleByDefault = index < 3 || status === SYSTEM_ANALYSIS_CORRECTION_REVIEW_STATUS.VALID;
    return buildItem({
      id: safeString(item?.id) || `correction-item:${index}`,
      group: groupForCorrectionItem(item, index),
      label: getCorrectionItemActionLabel(item?.action),
      description: mapped.description || safeString(item?.whatChanges) || safeString(item?.title),
      reason: item?.why,
      expectedImpact: combineExpectedImpactAndRisk(item),
      confidence: item?.confidence,
      status,
      selectedIds,
      appliedIds,
      validationIssues,
      repairPreview: status === SYSTEM_ANALYSIS_CORRECTION_REVIEW_STATUS.VALID ? mapped.repairPreview : null,
      visibleByDefault,
      priorityRank: index + 1,
      destructive,
      supportStatus,
      targetType: item?.targetType,
      action: item?.action,
    });
  });
}

function buildOccurrenceItems({ draft, state, selectedIds, appliedIds, contractIssues }) {
  const validationRequirements = safeArray(draft?.validationRequirements);
  return safeArray(draft?.occurrenceAdjustments).map((adjustment, index) => {
    const occurrenceId = safeString(adjustment?.occurrenceId);
    const action = safeString(adjustment?.action);
    const path = `occurrenceAdjustments[${index}]`;
    const validationIssues = issuesForPath(contractIssues, path);
    const occurrence = getOccurrenceById(state, occurrenceId);
    const goal = getGoalById(state, occurrence?.goalId);
    const mapped = overrideStatusForIssues(
      buildOccurrenceRepairPreview({ adjustment, occurrence, validationRequirements }),
      validationIssues
    );
    return buildItem({
      id: `occurrence:${index}:${occurrenceId || "missing"}:${action || "unknown"}`,
      group: SYSTEM_ANALYSIS_CORRECTION_GROUP.OCCURRENCES,
      label: getActionLabel(action),
      description: mapped.description || safeString(goal?.title) || occurrenceId,
      reason: adjustment?.reason,
      expectedImpact: adjustment?.expectedImpact,
      confidence: adjustment?.confidence,
      status: mapped.status,
      selectedIds,
      appliedIds,
      validationIssues,
      repairPreview: mapped.repairPreview,
    });
  });
}

function buildLoadItem({ draft, selectedIds, appliedIds, contractIssues }) {
  const load = draft?.correctedLoad;
  if (!isPlainObject(load)) return [];
  const parts = [];
  if (Number.isFinite(Number(load.targetBlocksPerDay))) parts.push(`${load.targetBlocksPerDay} blocs/jour`);
  if (Number.isFinite(Number(load.maxDailyMinutes))) parts.push(`${load.maxDailyMinutes} min max`);
  return [
    buildItem({
      id: "load:corrected-load",
      group: SYSTEM_ANALYSIS_CORRECTION_GROUP.LOAD,
      label: "Charge corrigée",
      description: parts.join(" · ") || "Cible de charge proposée.",
      reason: load.reason,
      status: SYSTEM_ANALYSIS_CORRECTION_REVIEW_STATUS.NEEDS_REVIEW,
      selectedIds,
      appliedIds,
      validationIssues: issuesForPath(contractIssues, "correctedLoad"),
      repairPreview: null,
    }),
  ];
}

function buildGoalItems({ entries, group, idKey, selectedIds, appliedIds, contractIssues }) {
  return safeArray(entries).map((adjustment, index) => {
    const path = `${group === SYSTEM_ANALYSIS_CORRECTION_GROUP.OBJECTIVES ? "objectiveAdjustments" : "actionAdjustments"}[${index}]`;
    const action = safeString(adjustment?.action);
    return buildItem({
      id: `${group}:${index}:${safeString(adjustment?.[idKey] || adjustment?.goalId) || "missing"}:${action || "unknown"}`,
      group,
      label: action ? `Proposition: ${action}` : "Proposition à revoir",
      description: "Cette correction demande une revue dédiée avant application.",
      reason: adjustment?.reason,
      confidence: adjustment?.confidence,
      status: SYSTEM_ANALYSIS_CORRECTION_REVIEW_STATUS.NEEDS_REVIEW,
      selectedIds,
      appliedIds,
      validationIssues: issuesForPath(contractIssues, path),
      repairPreview: null,
    });
  });
}

function buildNext7DaysItems({ draft, selectedIds, appliedIds, contractIssues }) {
  const days = safeArray(draft?.next7DaysPlan);
  if (!days.length) return [];
  const totalMinutes = days.reduce((sum, day) => sum + Math.max(0, Number(day?.totalMinutes) || 0), 0);
  return [
    buildItem({
      id: "next7Days:summary",
      group: SYSTEM_ANALYSIS_CORRECTION_GROUP.NEXT_7_DAYS,
      label: "Plan 7 jours proposé",
      description: `${days.length} jour${days.length > 1 ? "s" : ""} · ${totalMinutes} min`,
      reason: safeString(days[0]?.focus) || "Résumé de direction seulement.",
      status: SYSTEM_ANALYSIS_CORRECTION_REVIEW_STATUS.NEEDS_REVIEW,
      selectedIds,
      appliedIds,
      validationIssues: issuesForPath(contractIssues, "next7DaysPlan"),
      repairPreview: null,
    }),
  ];
}

function buildGroups(items) {
  const order = [
    SYSTEM_ANALYSIS_CORRECTION_GROUP.PRIORITY,
    SYSTEM_ANALYSIS_CORRECTION_GROUP.OCCURRENCES,
    SYSTEM_ANALYSIS_CORRECTION_GROUP.LOAD,
    SYSTEM_ANALYSIS_CORRECTION_GROUP.OBJECTIVES,
    SYSTEM_ANALYSIS_CORRECTION_GROUP.ACTIONS,
    SYSTEM_ANALYSIS_CORRECTION_GROUP.PLANNING,
    SYSTEM_ANALYSIS_CORRECTION_GROUP.NEXT_7_DAYS,
    SYSTEM_ANALYSIS_CORRECTION_GROUP.UNSUPPORTED,
  ];
  return order
    .map((id) => {
      const groupItems = items.filter((item) => item.group === id);
      return {
        id,
        label: GROUP_LABELS[id],
        items: groupItems,
        itemCount: groupItems.length,
        selectableCount: groupItems.filter((item) => item.selectable).length,
        validCount: groupItems.filter((item) => item.status === SYSTEM_ANALYSIS_CORRECTION_REVIEW_STATUS.VALID).length,
      };
    })
    .filter((group) => group.itemCount > 0);
}

export function buildSystemAnalysisCorrectionReview({
  result,
  state,
  snapshot,
  selectedIds = [],
  appliedCorrectionIds = [],
} = {}) {
  const rawDraft = isPlainObject(result?.correctionDraft) ? result.correctionDraft : null;
  const validation = validateCorrectionDraft(rawDraft, { state, snapshot });
  const draft = validation.normalized || rawDraft || {};
  const selectedSet = new Set(safeArray(selectedIds).map(safeString).filter(Boolean));
  const appliedSet = new Set(safeArray(appliedCorrectionIds).map(safeString).filter(Boolean));
  const contractIssues = safeArray(validation.issues);
  const hasV2CorrectionItems = Array.isArray(draft?.correctionItems);
  const items = hasV2CorrectionItems
    ? buildCorrectionItems({ draft, selectedIds: selectedSet, appliedIds: appliedSet, contractIssues })
    : [
      ...buildOccurrenceItems({ draft, state, selectedIds: selectedSet, appliedIds: appliedSet, contractIssues }),
      ...buildLoadItem({ draft, selectedIds: selectedSet, appliedIds: appliedSet, contractIssues }),
      ...buildGoalItems({
        entries: draft.objectiveAdjustments,
        group: SYSTEM_ANALYSIS_CORRECTION_GROUP.OBJECTIVES,
        idKey: "goalId",
        selectedIds: selectedSet,
        appliedIds: appliedSet,
        contractIssues,
      }),
      ...buildGoalItems({
        entries: draft.actionAdjustments,
        group: SYSTEM_ANALYSIS_CORRECTION_GROUP.ACTIONS,
        idKey: "actionId",
        selectedIds: selectedSet,
        appliedIds: appliedSet,
        contractIssues,
      }),
      ...buildNext7DaysItems({ draft, selectedIds: selectedSet, appliedIds: appliedSet, contractIssues }),
    ];
  const selectedValidItems = items.filter((item) => item.selected && item.selectable);

  return {
    groups: buildGroups(items),
    items,
    selectedIds: selectedValidItems.map((item) => item.id),
    selectableCount: items.filter((item) => item.selectable).length,
    selectedCount: items.filter((item) => item.selected).length,
    validSelectedCount: selectedValidItems.length,
    hasValidSelection: selectedValidItems.length > 0,
    contractIssues,
    confirmationSummary: {
      title: "Corrections sélectionnées",
      description: selectedValidItems.length
        ? `${selectedValidItems.length} correction${selectedValidItems.length > 1 ? "s" : ""} prête${selectedValidItems.length > 1 ? "s" : ""} pour la validation finale.`
        : "Aucune correction prête sélectionnée.",
      items: selectedValidItems.map((item) => ({
        id: item.id,
        label: item.label,
        description: item.description,
        repairPreview: item.repairPreview,
      })),
    },
  };
}
