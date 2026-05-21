import {
  PLANNING_REPAIR_TYPE,
  applyOccurrenceRepair,
} from "../../logic/planningRepairModel";
import {
  SYSTEM_INVARIANT_SEVERITY,
  validateSystemInvariants,
} from "../../logic/systemInvariants";
import { SYSTEM_ANALYSIS_CORRECTION_GROUP } from "./systemAnalysisCorrectionReviewModel";

export const SYSTEM_ANALYSIS_APPLY_ERROR = Object.freeze({
  NO_SELECTED_CORRECTIONS: "NO_SELECTED_CORRECTIONS",
  DUPLICATE_OCCURRENCE_REPAIR: "DUPLICATE_OCCURRENCE_REPAIR",
  UNSUPPORTED_REPAIR: "UNSUPPORTED_REPAIR",
  REPAIR_FAILED: "REPAIR_FAILED",
  INVARIANT_ERROR: "INVARIANT_ERROR",
});

const SUPPORTED_REPAIR_TYPES = new Set([
  PLANNING_REPAIR_TYPE.CHOOSE_TIME,
  PLANNING_REPAIR_TYPE.MOVE_LATER_TODAY,
  PLANNING_REPAIR_TYPE.MOVE_TOMORROW,
  PLANNING_REPAIR_TYPE.REDUCE_DURATION,
  PLANNING_REPAIR_TYPE.SKIP_ONCE,
]);

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function safeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function cloneRepairPreview(repairPreview) {
  return isPlainObject(repairPreview) ? { ...repairPreview } : null;
}

function normalizeSelectedItem(item) {
  const repairPreview = cloneRepairPreview(item?.repairPreview);
  return {
    id: safeString(item?.id),
    label: safeString(item?.label),
    description: safeString(item?.description),
    reason: safeString(item?.reason),
    group: safeString(item?.group),
    repairPreview,
  };
}

function isSelectedApplicableOccurrenceItem(item) {
  const repairPreview = item?.repairPreview;
  const itemGroup = safeString(item?.group);
  const targetType = safeString(item?.targetType);
  return Boolean(
    item?.selected === true &&
      item?.selectable === true &&
      (itemGroup === SYSTEM_ANALYSIS_CORRECTION_GROUP.OCCURRENCES || targetType === "occurrence") &&
      isPlainObject(repairPreview) &&
      SUPPORTED_REPAIR_TYPES.has(safeString(repairPreview.type)) &&
      safeString(repairPreview.occurrenceId)
  );
}

function getSelectedReviewItems(review) {
  return safeArray(review?.items).filter((item) => item?.selected === true);
}

function getSelectedApplicableItems(review) {
  return getSelectedReviewItems(review).filter(isSelectedApplicableOccurrenceItem).map(normalizeSelectedItem);
}

function getSelectedNotAppliedItems(review) {
  return getSelectedReviewItems(review)
    .filter((item) => !isSelectedApplicableOccurrenceItem(item))
    .map(normalizeSelectedItem);
}

function makeResult({
  ok,
  state,
  nextState = state,
  appliedItems = [],
  changedOccurrenceIds = [],
  warnings = [],
  invariantIssues = [],
  errorCode = "",
  summary = {},
}) {
  return {
    ok: Boolean(ok),
    nextState,
    appliedItems: safeArray(appliedItems),
    changedOccurrenceIds: Array.from(new Set(safeArray(changedOccurrenceIds).map(safeString).filter(Boolean))),
    warnings: safeArray(warnings).map(safeString).filter(Boolean),
    invariantIssues: safeArray(invariantIssues),
    errorCode: safeString(errorCode),
    summary: {
      title: safeString(summary.title) || (ok ? "Corrections appliquées" : "Corrections non appliquées"),
      message: safeString(summary.message),
      ...summary,
    },
  };
}

export function buildSystemAnalysisApplicationPreview({ review } = {}) {
  const selectedItems = getSelectedApplicableItems(review);
  const selectedNotAppliedItems = getSelectedNotAppliedItems(review);
  const allNotAppliedItems = safeArray(review?.items)
    .filter((item) => !isSelectedApplicableOccurrenceItem(item))
    .map(normalizeSelectedItem);

  return {
    ok: selectedItems.length > 0,
    selectedItems,
    selectedNotAppliedItems,
    notAppliedItems: allNotAppliedItems,
    selectedCount: selectedItems.length,
    notAppliedCount: allNotAppliedItems.length,
    summary: {
      title: "Prochaine étape : validation finale",
      message: selectedItems.length
        ? `${selectedItems.length} correction${selectedItems.length > 1 ? "s" : ""} prête${selectedItems.length > 1 ? "s" : ""} à appliquer après confirmation.`
        : "Aucune correction applicable sélectionnée.",
      willChange: selectedItems.map((item) => `${item.label}${item.description ? ` · ${item.description}` : ""}`),
      willNotChange: allNotAppliedItems.length
        ? "Les propositions non sélectionnées, à revoir ou non prises en charge ne seront pas modifiées."
        : "Aucune autre proposition ne sera modifiée.",
    },
  };
}

export function applySystemAnalysisSelectedCorrections({
  state,
  review,
  now,
  invariantOptions,
} = {}) {
  const selectedItems = getSelectedApplicableItems(review);
  const selectedNotAppliedItems = getSelectedNotAppliedItems(review);
  if (!selectedItems.length) {
    return makeResult({
      ok: false,
      state,
      warnings: selectedNotAppliedItems.length ? ["selected_items_not_applicable"] : [],
      errorCode: SYSTEM_ANALYSIS_APPLY_ERROR.NO_SELECTED_CORRECTIONS,
      summary: {
        message: "Aucune correction applicable n’est sélectionnée.",
      },
    });
  }

  const seenOccurrenceIds = new Set();
  for (const item of selectedItems) {
    const occurrenceId = safeString(item.repairPreview?.occurrenceId);
    if (seenOccurrenceIds.has(occurrenceId)) {
      return makeResult({
        ok: false,
        state,
        errorCode: SYSTEM_ANALYSIS_APPLY_ERROR.DUPLICATE_OCCURRENCE_REPAIR,
        summary: {
          message: "Plusieurs corrections ciblent le même bloc. Applique une seule correction par bloc.",
        },
      });
    }
    seenOccurrenceIds.add(occurrenceId);
  }

  let workingState = state;
  const appliedItems = [];
  const changedOccurrenceIds = [];
  const warnings = selectedNotAppliedItems.length ? ["selected_items_not_applicable"] : [];
  for (const item of selectedItems) {
    const repairPreview = item.repairPreview;
    if (!SUPPORTED_REPAIR_TYPES.has(safeString(repairPreview?.type))) {
      return makeResult({
        ok: false,
        state,
        appliedItems: [],
        changedOccurrenceIds: [],
        warnings,
        errorCode: SYSTEM_ANALYSIS_APPLY_ERROR.UNSUPPORTED_REPAIR,
        summary: {
          message: "Une correction sélectionnée n’est pas prise en charge.",
        },
      });
    }

    const repairResult = applyOccurrenceRepair({
      state: workingState,
      occurrenceId: repairPreview.occurrenceId,
      repair: repairPreview,
      now,
    });
    if (!repairResult.ok) {
      return makeResult({
        ok: false,
        state,
        appliedItems: [],
        changedOccurrenceIds: [],
        warnings: [...warnings, ...safeArray(repairResult.warnings)],
        errorCode: SYSTEM_ANALYSIS_APPLY_ERROR.REPAIR_FAILED,
        summary: {
          message: "Une correction sélectionnée ne peut pas être appliquée proprement.",
          failedItemId: item.id,
        },
      });
    }

    workingState = repairResult.nextState;
    changedOccurrenceIds.push(...safeArray(repairResult.changedOccurrenceIds));
    warnings.push(...safeArray(repairResult.warnings));
    appliedItems.push({
      id: item.id,
      label: item.label,
      description: item.description,
      occurrenceId: safeString(repairPreview.occurrenceId),
      repairType: safeString(repairPreview.type),
      changedOccurrenceIds: safeArray(repairResult.changedOccurrenceIds),
    });
  }

  const invariantResult = validateSystemInvariants(workingState, invariantOptions);
  const invariantIssues = safeArray(invariantResult.issues);
  const invariantErrors = invariantIssues.filter((issue) => issue?.severity === SYSTEM_INVARIANT_SEVERITY.ERROR);
  if (invariantErrors.length) {
    return makeResult({
      ok: false,
      state,
      appliedItems: [],
      changedOccurrenceIds: [],
      warnings,
      invariantIssues,
      errorCode: SYSTEM_ANALYSIS_APPLY_ERROR.INVARIANT_ERROR,
      summary: {
        message: "Les corrections produisent un état incohérent, donc rien n’a été appliqué.",
      },
    });
  }

  return makeResult({
    ok: true,
    state,
    nextState: workingState,
    appliedItems,
    changedOccurrenceIds,
    warnings,
    invariantIssues,
    summary: {
      title: "Corrections appliquées",
      message: `${appliedItems.length} correction${appliedItems.length > 1 ? "s" : ""} appliquée${appliedItems.length > 1 ? "s" : ""}.`,
    },
  });
}
