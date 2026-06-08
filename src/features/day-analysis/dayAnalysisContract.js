import {
  DAY_ANALYSIS_ACTION_TYPE,
  DAY_ANALYSIS_SUPPORT_STATUS,
  DAY_ANALYSIS_TARGET_TYPE,
  DAY_ANALYSIS_VERSION,
} from "./dayAnalysisTypes";

const VALID_ACTION_TYPES = new Set(Object.values(DAY_ANALYSIS_ACTION_TYPE));
const VALID_SUPPORT_STATUSES = new Set(Object.values(DAY_ANALYSIS_SUPPORT_STATUS));
const VALID_TARGET_TYPES = new Set(Object.values(DAY_ANALYSIS_TARGET_TYPE));

const UNSAFE_TEXT_PATTERNS = [
  {
    code: "guilt_or_shame_copy",
    pattern: /\b(faute|culpabil|honte|paresse|tu aurais dû|échec personnel)\b/i,
  },
  {
    code: "broad_system_rewrite",
    pattern: /\b(tout le système|réécrire|refondre|reconstruire.+système|changer tous|réorganiser toute)\b/i,
  },
  {
    code: "unsupported_mutation_claim",
    pattern:
      /(j['’]ai (modifié|déplacé|réduit|créé|supprimé)|a été (modifié|déplacé|créé|supprimé)|appliqué automatiquement)/i,
  },
  {
    code: "medical_claim",
    pattern: /\b(diagnostic médical|dépression|anxiété|traitement|médicament|clinique|pathologie)\b/i,
  },
  {
    code: "unsupported_delete_action",
    pattern: /\b(supprimer|effacer|delete|remove)\b.{0,40}\b(objectif|action|bloc|occurrence)\b/i,
  },
  {
    code: "multi_day_strategy_claim",
    pattern: /\b(semaine complète|plusieurs semaines|30 jours|prochains 7 jours|plan global|analyse système|stratégie globale)\b/i,
  },
];

function safeString(value, max = 240) {
  if (typeof value !== "string") return "";
  const text = value.trim();
  return text.length > max ? text.slice(0, max) : text;
}

function normalizeConfidence(value) {
  const confidence = Number(value);
  if (!Number.isFinite(confidence)) return null;
  if (confidence < 0 || confidence > 1) return null;
  return confidence;
}

function collectText(value, parts = []) {
  if (typeof value === "string") {
    parts.push(value);
    return parts;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectText(item, parts));
    return parts;
  }
  if (value && typeof value === "object") {
    Object.values(value).forEach((item) => collectText(item, parts));
  }
  return parts;
}

function normalizeDiagnosis(value, issues) {
  if (!value || typeof value !== "object") {
    issues.push({ code: "missing_diagnosis", message: "Diagnosis is required." });
    return null;
  }

  const title = safeString(value.title, 120);
  const explanation = safeString(value.explanation, 500);
  const evidence = Array.isArray(value.evidence)
    ? value.evidence.slice(0, 4).map((item) => safeString(item, 180)).filter(Boolean)
    : [];
  const confidence = normalizeConfidence(value.confidence);

  if (!title) issues.push({ code: "missing_diagnosis_title", message: "Diagnosis title is required." });
  if (!explanation) {
    issues.push({
      code: "missing_diagnosis_explanation",
      message: "Diagnosis explanation is required.",
    });
  }
  if (confidence == null) {
    issues.push({
      code: "invalid_diagnosis_confidence",
      message: "Diagnosis confidence must be between 0 and 1.",
    });
  }

  return { title, explanation, evidence, confidence };
}

function normalizeRecommendedAction(value, { candidatesById, issues, path }) {
  if (!value || typeof value !== "object") {
    issues.push({ code: `${path}_missing`, message: "Recommended action is required." });
    return null;
  }

  const id = safeString(value.id, 120);
  const candidate = candidatesById.get(id);
  if (!id || !candidate) {
    issues.push({
      code: `${path}_unknown_candidate`,
      message: "Recommended action must reference an available deterministic candidate.",
    });
    return null;
  }

  const type = safeString(value.type, 80) || candidate.type;
  const targetType = safeString(value.targetType, 80) || candidate.targetType;
  const supportStatus = safeString(value.supportStatus, 80) || candidate.supportStatus;

  if (!VALID_ACTION_TYPES.has(type)) {
    issues.push({ code: `${path}_invalid_type`, message: "Unsupported action type." });
  }
  if (type !== candidate.type) {
    issues.push({
      code: `${path}_type_mismatch`,
      message: "Action type must match the deterministic candidate.",
    });
  }
  if (!VALID_TARGET_TYPES.has(targetType)) {
    issues.push({ code: `${path}_invalid_target_type`, message: "Unsupported target type." });
  }
  if (!VALID_SUPPORT_STATUSES.has(supportStatus)) {
    issues.push({
      code: `${path}_invalid_support_status`,
      message: "Unsupported support status.",
    });
  }

  return {
    id,
    type,
    label: safeString(value.label, 120) || candidate.label,
    description: safeString(value.description, 500) || candidate.description,
    targetType,
    targetId: safeString(value.targetId, 120) || candidate.targetId,
    supportStatus,
    deterministicAction: candidate.deterministicAction || null,
    confirmationRequired:
      typeof value.confirmationRequired === "boolean"
        ? value.confirmationRequired
        : Boolean(candidate.confirmationRequired),
    preview: value.preview && typeof value.preview === "object" ? value.preview : candidate.preview || {},
  };
}

function normalizeAlternatives(value, context) {
  if (!Array.isArray(value)) return [];
  return value
    .slice(0, 2)
    .map((alternative, index) =>
      normalizeRecommendedAction(alternative, {
        ...context,
        path: `alternative_${index}`,
      }),
    )
    .filter(Boolean);
}

function validateUnsafeText(result, issues) {
  const text = collectText(result).join("\n");
  for (const { code, pattern } of UNSAFE_TEXT_PATTERNS) {
    if (pattern.test(text)) {
      issues.push({
        code,
        message: "Day analysis copy contains unsupported wording.",
      });
    }
  }
}

function normalizeDataLimitations(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 6).map((item) => safeString(item, 120)).filter(Boolean);
}

function normalizeModelMeta(value) {
  if (!value || typeof value !== "object") return null;
  return {
    requestId: safeString(value.requestId, 120) || null,
    model: safeString(value.model, 120) || null,
    modelClass: safeString(value.modelClass, 120) || null,
    promptVersion: safeString(value.promptVersion, 120) || null,
    decisionSource: safeString(value.decisionSource, 120) || null,
  };
}

function normalizeQuota(value) {
  if (!value || typeof value !== "object") return null;
  const remaining = Number(value.remaining);
  return {
    featureId: safeString(value.featureId, 120) || null,
    planTier: safeString(value.planTier, 80) || null,
    remaining: Number.isFinite(remaining) ? Math.max(0, Math.round(remaining)) : null,
  };
}

export function validateDayAnalysisResult(result, { candidates = [], dayKey } = {}) {
  const issues = [];
  const warnings = [];
  if (!result || typeof result !== "object") {
    return {
      ok: false,
      normalized: null,
      issues: [{ code: "invalid_result", message: "Result must be an object." }],
      warnings,
    };
  }

  if (result.version !== DAY_ANALYSIS_VERSION) {
    issues.push({ code: "invalid_version", message: "Unsupported day analysis version." });
  }

  const normalizedDayKey = safeString(result.dayKey, 40);
  if (!normalizedDayKey) {
    issues.push({ code: "missing_day_key", message: "dayKey is required." });
  } else if (dayKey && normalizedDayKey !== dayKey) {
    issues.push({ code: "day_key_mismatch", message: "dayKey does not match the requested day." });
  }

  const candidatesById = new Map(candidates.map((candidate) => [candidate.id, candidate]));
  const diagnosis = normalizeDiagnosis(result.diagnosis, issues);
  const recommendedAction = normalizeRecommendedAction(result.recommendedAction, {
    candidatesById,
    issues,
    path: "recommended_action",
  });
  const alternatives = normalizeAlternatives(result.alternatives, {
    candidatesById,
    issues,
    path: "alternative",
  });

  if (recommendedAction) {
    for (const alternative of alternatives) {
      if (alternative.id === recommendedAction.id) {
        issues.push({
          code: "duplicate_alternative",
          message: "Alternatives must not duplicate the recommended action.",
        });
      }
    }
  }

  if (result.userConfirmationRequired !== true) {
    issues.push({
      code: "missing_user_confirmation_requirement",
      message: "Day analysis actions require explicit user confirmation.",
    });
  }

  validateUnsafeText(result, issues);

  const normalized = {
    version: DAY_ANALYSIS_VERSION,
    dayKey: normalizedDayKey,
    diagnosis,
    recommendedAction,
    alternatives,
    dataLimitations: normalizeDataLimitations(result.dataLimitations),
    userConfirmationRequired: true,
    modelMeta: normalizeModelMeta(result.modelMeta),
    quota: normalizeQuota(result.quota),
  };

  return {
    ok: issues.length === 0,
    normalized: issues.length === 0 ? normalized : null,
    issues,
    warnings,
  };
}
