import {
  DAY_ANALYSIS_ACTION_TYPE,
  DAY_ANALYSIS_SUPPORT_STATUS,
  DAY_ANALYSIS_TARGET_TYPE,
} from "./dayAnalysisTypes";

export const DAY_ANALYSIS_SHEET_STATE = Object.freeze({
  INTRO: "intro",
  READY: "ready",
  LOADING: "loading",
  RESULT: "result",
  CONFIRMATION: "confirmation",
  SUCCESS: "success",
  ERROR: "error",
});

function safeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

export function normalizeDayAnalysisSheetState(value) {
  const state = safeString(value).toLowerCase();
  if (state === "ready") return DAY_ANALYSIS_SHEET_STATE.INTRO;
  if (Object.values(DAY_ANALYSIS_SHEET_STATE).includes(state)) return state;
  return DAY_ANALYSIS_SHEET_STATE.INTRO;
}

export function isNoChangeDayAnalysisAction(action) {
  return (
    action?.type === DAY_ANALYSIS_ACTION_TYPE.NO_CHANGE ||
    action?.supportStatus === DAY_ANALYSIS_SUPPORT_STATUS.NO_CHANGE
  );
}

export function getDayAnalysisActionBadge(action) {
  const supportStatus = safeString(action?.supportStatus);
  const type = safeString(action?.type);
  if (isNoChangeDayAnalysisAction(action)) return "AUCUN CHANGEMENT";
  if (supportStatus === DAY_ANALYSIS_SUPPORT_STATUS.APPLICABLE) return "À VALIDER";
  if (supportStatus === DAY_ANALYSIS_SUPPORT_STATUS.RECOVERY_SHEET) return "À VALIDER";
  if (supportStatus === DAY_ANALYSIS_SUPPORT_STATUS.REVIEW_ONLY) return "À PRÉPARER";
  if (supportStatus === DAY_ANALYSIS_SUPPORT_STATUS.UNAVAILABLE) return "À REVOIR";
  if (supportStatus === DAY_ANALYSIS_SUPPORT_STATUS.NAVIGATION_ONLY) {
    if (type === DAY_ANALYSIS_ACTION_TYPE.OPEN_COACH || action?.targetType === DAY_ANALYSIS_TARGET_TYPE.COACH) {
      return "OUVRIR COACH";
    }
    if (
      type === DAY_ANALYSIS_ACTION_TYPE.OPEN_PLANNING ||
      action?.targetType === DAY_ANALYSIS_TARGET_TYPE.PLANNING
    ) {
      return "OUVRIR PLANNING";
    }
    return "OUVRIR";
  }
  return "À REVOIR";
}

export function getDayAnalysisActionTone(action) {
  const supportStatus = safeString(action?.supportStatus);
  if (isNoChangeDayAnalysisAction(action)) return "neutral";
  if (
    supportStatus === DAY_ANALYSIS_SUPPORT_STATUS.APPLICABLE ||
    supportStatus === DAY_ANALYSIS_SUPPORT_STATUS.RECOVERY_SHEET
  ) {
    return "ai";
  }
  if (supportStatus === DAY_ANALYSIS_SUPPORT_STATUS.NAVIGATION_ONLY) return "navigation";
  if (
    supportStatus === DAY_ANALYSIS_SUPPORT_STATUS.REVIEW_ONLY ||
    supportStatus === DAY_ANALYSIS_SUPPORT_STATUS.UNAVAILABLE
  ) {
    return "attention";
  }
  return "neutral";
}

export function getDayAnalysisPrimaryCta(action) {
  if (!action) return "Fermer";
  const type = safeString(action.type);
  const supportStatus = safeString(action.supportStatus);
  if (isNoChangeDayAnalysisAction(action)) return "Retour à Home";
  if (
    supportStatus === DAY_ANALYSIS_SUPPORT_STATUS.APPLICABLE ||
    supportStatus === DAY_ANALYSIS_SUPPORT_STATUS.RECOVERY_SHEET
  ) {
    return "Préparer la validation";
  }
  if (supportStatus === DAY_ANALYSIS_SUPPORT_STATUS.NAVIGATION_ONLY) {
    if (type === DAY_ANALYSIS_ACTION_TYPE.OPEN_COACH || action.targetType === DAY_ANALYSIS_TARGET_TYPE.COACH) {
      return "Ouvrir le Coach";
    }
    if (
      type === DAY_ANALYSIS_ACTION_TYPE.OPEN_PLANNING ||
      action.targetType === DAY_ANALYSIS_TARGET_TYPE.PLANNING
    ) {
      return "Ouvrir Planning";
    }
  }
  if (supportStatus === DAY_ANALYSIS_SUPPORT_STATUS.REVIEW_ONLY) {
    return "Préparer dans Planning";
  }
  if (supportStatus === DAY_ANALYSIS_SUPPORT_STATUS.UNAVAILABLE) {
    return "Ouvrir Planning";
  }
  return "Préparer la validation";
}

export function getDayAnalysisActionIntent(action) {
  if (!action) return "close";
  const type = safeString(action.type);
  const supportStatus = safeString(action.supportStatus);
  if (isNoChangeDayAnalysisAction(action)) return "close";
  if (supportStatus === DAY_ANALYSIS_SUPPORT_STATUS.NAVIGATION_ONLY) {
    if (type === DAY_ANALYSIS_ACTION_TYPE.OPEN_COACH || action.targetType === DAY_ANALYSIS_TARGET_TYPE.COACH) {
      return "open_coach";
    }
    if (
      type === DAY_ANALYSIS_ACTION_TYPE.OPEN_PLANNING ||
      action.targetType === DAY_ANALYSIS_TARGET_TYPE.PLANNING
    ) {
      return "open_planning";
    }
  }
  if (
    supportStatus === DAY_ANALYSIS_SUPPORT_STATUS.REVIEW_ONLY ||
    supportStatus === DAY_ANALYSIS_SUPPORT_STATUS.UNAVAILABLE
  ) {
    return "open_planning";
  }
  return "prepare_validation";
}

export function resolveDayAnalysisSelectedAction({ result, selectedActionId }) {
  const recommended = result?.recommendedAction || null;
  const actions = [recommended, ...safeArray(result?.alternatives)].filter(Boolean);
  const id = safeString(selectedActionId);
  if (id) return actions.find((action) => action?.id === id) || recommended;
  return recommended;
}

export function getDayAnalysisErrorCopy(error) {
  const code = safeString(typeof error === "string" ? error : error?.errorCode || error?.code).toUpperCase();
  if (code === "PREMIUM_REQUIRED") {
    return {
      title: "Analyse réservée Premium",
      copy: "Cette analyse nécessite un accès Premium. Aucune donnée n’a été modifiée.",
    };
  }
  if (code === "QUOTA_EXCEEDED" || code === "RATE_LIMITED") {
    return {
      title: "Analyse limitée pour l’instant",
      copy: "Tu as atteint la limite disponible. Réessaie plus tard, sans changement appliqué.",
    };
  }
  if (code === "DAY_ANALYSIS_PROVIDER_TIMEOUT" || code === "TIMEOUT") {
    return {
      title: "Analyse trop longue",
      copy: "Le service n’a pas répondu à temps. Tu peux relancer l’analyse.",
    };
  }
  if (code === "INVALID_DAY_ANALYSIS_RESPONSE" || code === "INVALID_RESPONSE") {
    return {
      title: "Analyse non exploitable",
      copy: "La réponse n’était pas assez sûre pour être affichée. Aucune modification n’a été appliquée.",
    };
  }
  if (code === "SNAPSHOT_INVALID") {
    return {
      title: "Données du jour incomplètes",
      copy: "L’analyse ne peut pas lire correctement la journée pour le moment.",
    };
  }
  if (code === "DAY_ANALYSIS_STALE_TARGET" || code === "DAY_ANALYSIS_STALE_CANDIDATE") {
    return {
      title: "Analyse à relancer",
      copy: "La journée a changé depuis cette analyse. Relance-la avant d’appliquer une correction.",
    };
  }
  if (code === "DAY_ANALYSIS_ACTION_UNSUPPORTED") {
    return {
      title: "Action à préparer",
      copy: "Cette action doit être préparée dans Planning ou avec le Coach. Aucune modification n’a été appliquée.",
    };
  }
  if (code === "DAY_ANALYSIS_APPLY_FAILED" || code === "DAY_ANALYSIS_INVARIANT_FAILED") {
    return {
      title: "Correction non appliquée",
      copy: "La correction n’était pas assez sûre pour être appliquée. Ta journée n’a pas été modifiée.",
    };
  }
  return {
    title: "Analyse indisponible",
    copy: "Impossible de lancer l’analyse maintenant. Réessaie dans quelques instants.",
  };
}

export function buildDayAnalysisPreviewRows(action) {
  const preview = action?.preview && typeof action.preview === "object" ? action.preview : {};
  const rows = [];
  const addRow = (label, value) => {
    const text = Number.isFinite(value) ? String(Math.round(value)) : safeString(value);
    if (text) rows.push({ label, value: text });
  };

  addRow("Changement", preview.summary || action?.description);
  addRow("Bloc", preview.targetTitle || preview.title || preview.occurrenceTitle || preview.actionTitle);
  if (preview.before || preview.after) {
    addRow("Avant", preview.before?.summary || preview.before?.start || preview.before?.durationMinutes);
    addRow("Après", preview.after?.summary || preview.after?.start || preview.after?.durationMinutes);
  }
  if (Number.isFinite(preview.durationMinutes)) addRow("Durée", `${Math.round(preview.durationMinutes)} min`);
  return rows.slice(0, 4);
}
