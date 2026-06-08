import { describe, expect, it } from "vitest";
import {
  DAY_ANALYSIS_ACTION_TYPE,
  DAY_ANALYSIS_SUPPORT_STATUS,
  DAY_ANALYSIS_TARGET_TYPE,
} from "./dayAnalysisTypes";
import {
  getDayAnalysisActionBadge,
  getDayAnalysisActionIntent,
  getDayAnalysisErrorCopy,
  getDayAnalysisPrimaryCta,
  isNoChangeDayAnalysisAction,
} from "./dayAnalysisSheetModel";

describe("dayAnalysisSheetModel", () => {
  it("maps support statuses to user-facing badges and CTAs", () => {
    const applicable = { type: DAY_ANALYSIS_ACTION_TYPE.REDUCE_DURATION, supportStatus: DAY_ANALYSIS_SUPPORT_STATUS.APPLICABLE };
    const coach = {
      type: DAY_ANALYSIS_ACTION_TYPE.OPEN_COACH,
      targetType: DAY_ANALYSIS_TARGET_TYPE.COACH,
      supportStatus: DAY_ANALYSIS_SUPPORT_STATUS.NAVIGATION_ONLY,
    };
    const planning = {
      type: DAY_ANALYSIS_ACTION_TYPE.OPEN_PLANNING,
      targetType: DAY_ANALYSIS_TARGET_TYPE.PLANNING,
      supportStatus: DAY_ANALYSIS_SUPPORT_STATUS.NAVIGATION_ONLY,
    };
    const reviewOnly = {
      type: DAY_ANALYSIS_ACTION_TYPE.ADD_SHORT_BLOCK,
      supportStatus: DAY_ANALYSIS_SUPPORT_STATUS.REVIEW_ONLY,
    };

    expect(getDayAnalysisActionBadge(applicable)).toBe("À VALIDER");
    expect(getDayAnalysisPrimaryCta(applicable)).toBe("Préparer la validation");
    expect(getDayAnalysisActionIntent(applicable)).toBe("prepare_validation");
    expect(getDayAnalysisActionBadge(coach)).toBe("OUVRIR COACH");
    expect(getDayAnalysisPrimaryCta(coach)).toBe("Ouvrir le Coach");
    expect(getDayAnalysisActionIntent(coach)).toBe("open_coach");
    expect(getDayAnalysisActionBadge(planning)).toBe("OUVRIR PLANNING");
    expect(getDayAnalysisPrimaryCta(planning)).toBe("Ouvrir Planning");
    expect(getDayAnalysisActionIntent(planning)).toBe("open_planning");
    expect(getDayAnalysisActionBadge(reviewOnly)).toBe("À PRÉPARER");
    expect(getDayAnalysisPrimaryCta(reviewOnly)).toBe("Préparer dans Planning");
    expect(getDayAnalysisActionIntent(reviewOnly)).toBe("open_planning");
  });

  it("maps no-change actions to a calm Home return", () => {
    const action = {
      type: DAY_ANALYSIS_ACTION_TYPE.NO_CHANGE,
      supportStatus: DAY_ANALYSIS_SUPPORT_STATUS.NO_CHANGE,
    };

    expect(isNoChangeDayAnalysisAction(action)).toBe(true);
    expect(getDayAnalysisActionBadge(action)).toBe("AUCUN CHANGEMENT");
    expect(getDayAnalysisPrimaryCta(action)).toBe("Retour à Home");
    expect(getDayAnalysisActionIntent(action)).toBe("close");
  });

  it("keeps backend error copy safe and non-technical", () => {
    expect(getDayAnalysisErrorCopy({ errorCode: "DAY_ANALYSIS_PROVIDER_TIMEOUT" })).toMatchObject({
      title: "Analyse trop longue",
    });
    expect(getDayAnalysisErrorCopy({ errorCode: "QUOTA_EXCEEDED" }).copy).not.toContain("provider");
    expect(getDayAnalysisErrorCopy({ errorCode: "PREMIUM_REQUIRED" }).copy).not.toContain("stack");
    expect(getDayAnalysisErrorCopy({ errorCode: "DAY_ANALYSIS_STALE_CANDIDATE" })).toMatchObject({
      title: "Analyse à relancer",
    });
    expect(getDayAnalysisErrorCopy({ errorCode: "DAY_ANALYSIS_APPLY_FAILED" })).toMatchObject({
      title: "Correction non appliquée",
    });
    expect(getDayAnalysisErrorCopy({ errorCode: "UNKNOWN" })).toMatchObject({
      title: "Analyse indisponible",
      copy: "Impossible de lancer l’analyse maintenant. Réessaie dans quelques instants.",
    });
  });
});
