import { describe, expect, it } from "vitest";
import {
  buildLocalTodayHeroModel,
  deriveTodayDecisionDiagnostics,
  deriveTodayHeroChrome,
  deriveTodayHeroModel,
} from "./aiNowHeroAdapter";
import {
  getTodaySupportedPrimaryIntents,
  TODAY_BACKEND_RESOLUTION_STATUS,
  TODAY_DIAGNOSTIC_REJECTION_REASON,
  TODAY_GAP_REASON,
  TODAY_INTERVENTION_TYPE,
} from "../../domain/todayIntervention";

const ACTIVE_DATE = "2026-03-13";
const SYSTEM_TODAY = "2026-03-13";
const GOALS_BY_ID = new Map([
  ["a1", { id: "a1", title: "Action locale", categoryId: "c1" }],
  ["a2", { id: "a2", title: "Action cross", categoryId: "c2" }],
]);

function buildLocalHero(overrides = {}) {
  return {
    interventionType: TODAY_INTERVENTION_TYPE.TODAY_RECOMMENDATION,
    title: "Action locale",
    meta: "Meta locale",
    primaryLabel: "Commencer maintenant",
    primaryAction: {
      kind: "start_occurrence",
      occurrence: { id: "occ_local" },
    },
    secondaryLabel: "Voir progression",
    ...overrides,
  };
}

function buildCoach(intent, overrides = {}) {
  const interventionType =
    intent === "resume_session"
      ? TODAY_INTERVENTION_TYPE.SESSION_RESUME
      : intent === "open_pilotage"
        ? TODAY_INTERVENTION_TYPE.SCHEDULE_WARNING
        : TODAY_INTERVENTION_TYPE.TODAY_RECOMMENDATION;
  return {
    kind: "now",
    decisionSource: "ai",
    interventionType,
    headline: "Titre IA",
    reason: "Raison IA",
    primaryAction: {
      label: "Action IA",
      intent,
      categoryId: "c1",
      actionId: "a1",
      occurrenceId: "occ_1",
      dateKey: ACTIVE_DATE,
    },
    meta: {
      requestId: "req_1",
      diagnostics: {
        resolutionStatus:
          overrides.decisionSource === "rules"
            ? TODAY_BACKEND_RESOLUTION_STATUS.RULES_FALLBACK
            : TODAY_BACKEND_RESOLUTION_STATUS.ACCEPTED_AI,
        rejectionReason: TODAY_DIAGNOSTIC_REJECTION_REASON.NONE,
        canonicalContextSummary: {
          activeDate: ACTIVE_DATE,
          isToday: true,
          hasActiveSessionForActiveDate: intent === "resume_session",
          hasOpenSessionOutsideActiveDate: intent === "open_pilotage",
          futureSessionsCount: intent === "open_pilotage" ? 1 : 0,
          hasPlannedActionsForActiveDate: true,
          hasFocusOccurrenceForActiveDate: true,
        },
      },
    },
    ...overrides,
  };
}

describe("deriveTodayHeroModel", () => {
  it("stays aligned with the shared Today supported primary intents", () => {
    expect(getTodaySupportedPrimaryIntents().sort()).toEqual(
      ["start_occurrence", "open_library", "resume_session", "open_pilotage"].sort()
    );
  });

  it("accepte un start_occurrence coherent", () => {
    const result = deriveTodayHeroModel({
      localHero: buildLocalHero(),
      coach: buildCoach("start_occurrence"),
      occurrencesForSelectedDay: [{ id: "occ_1", goalId: "a1", date: ACTIVE_DATE }],
      goalsById: GOALS_BY_ID,
      hasOpenSession: false,
      handlersAvailable: {},
      canonicalContextSummary: { activeDate: ACTIVE_DATE, isToday: true },
      systemTodayKey: SYSTEM_TODAY,
    });

    expect(result.source).toBe("ai");
    expect(result.title).toBe("Titre IA");
    expect(result.interventionType).toBe(TODAY_INTERVENTION_TYPE.TODAY_RECOMMENDATION);
    expect(result.primaryAction).toMatchObject({ kind: "start_occurrence" });
  });

  it("accepte un resume_session coherent", () => {
    const result = deriveTodayHeroModel({
      localHero: buildLocalHero(),
      coach: buildCoach("resume_session"),
      occurrencesForSelectedDay: [],
      goalsById: GOALS_BY_ID,
      hasOpenSession: true,
      handlersAvailable: {},
      canonicalContextSummary: { activeDate: ACTIVE_DATE, isToday: true },
      systemTodayKey: SYSTEM_TODAY,
    });

    expect(result.source).toBe("ai");
    expect(result.interventionType).toBe(TODAY_INTERVENTION_TYPE.SESSION_RESUME);
    expect(result.primaryAction).toMatchObject({ kind: "resume_session" });
  });

  it("accepte open_library si le handler existe", () => {
    const result = deriveTodayHeroModel({
      localHero: buildLocalHero(),
      coach: buildCoach("open_library"),
      occurrencesForSelectedDay: [],
      goalsById: GOALS_BY_ID,
      hasOpenSession: false,
      handlersAvailable: { openLibrary: true, openPilotage: false },
      canonicalContextSummary: { activeDate: ACTIVE_DATE, isToday: true },
      systemTodayKey: SYSTEM_TODAY,
    });

    expect(result.source).toBe("ai");
    expect(result.interventionType).toBe(TODAY_INTERVENTION_TYPE.TODAY_RECOMMENDATION);
    expect(result.primaryAction).toMatchObject({ kind: "open_library" });
  });

  it("accepte open_pilotage si le handler existe", () => {
    const result = deriveTodayHeroModel({
      localHero: buildLocalHero(),
      coach: buildCoach("open_pilotage", { interventionType: TODAY_INTERVENTION_TYPE.SCHEDULE_WARNING }),
      occurrencesForSelectedDay: [],
      goalsById: GOALS_BY_ID,
      hasOpenSession: false,
      handlersAvailable: { openLibrary: false, openPilotage: true },
      canonicalContextSummary: { activeDate: ACTIVE_DATE, isToday: true },
      systemTodayKey: SYSTEM_TODAY,
    });

    expect(result.source).toBe("ai");
    expect(result.interventionType).toBe(TODAY_INTERVENTION_TYPE.SCHEDULE_WARNING);
    expect(result.primaryAction).toMatchObject({ kind: "open_pilotage" });
  });

  it("accepte un gap-fill public mappe en today_recommendation + open_pilotage", () => {
    const result = deriveTodayHeroModel({
      localHero: buildLocalHero({
        primaryLabel: "Planifier aujourd’hui",
        primaryAction: { kind: "open_pilotage" },
      }),
      coach: buildCoach("open_pilotage", {
        interventionType: TODAY_INTERVENTION_TYPE.TODAY_RECOMMENDATION,
        headline: "Aucune action prévue aujourd’hui",
        reason: "Tu peux planifier Deep work aujourd'hui pour maintenir la continuité.",
      }),
      occurrencesForSelectedDay: [],
      goalsById: GOALS_BY_ID,
      hasOpenSession: false,
      handlersAvailable: { openPilotage: true },
      canonicalContextSummary: { activeDate: ACTIVE_DATE, isToday: true },
      systemTodayKey: SYSTEM_TODAY,
    });

    expect(result.source).toBe("ai");
    expect(result.interventionType).toBe(TODAY_INTERVENTION_TYPE.TODAY_RECOMMENDATION);
    expect(result.primaryAction).toMatchObject({ kind: "open_pilotage" });
    expect(result.title).toMatch(/Aucune action prévue aujourd’hui/);
  });

  it("rejette open_today comme CTA principal", () => {
    const result = deriveTodayHeroModel({
      localHero: buildLocalHero(),
      coach: buildCoach("open_today"),
      occurrencesForSelectedDay: [],
      goalsById: GOALS_BY_ID,
      hasOpenSession: false,
      handlersAvailable: { openLibrary: true, openPilotage: true },
      canonicalContextSummary: { activeDate: ACTIVE_DATE, isToday: true },
      systemTodayKey: SYSTEM_TODAY,
    });

    expect(result.source).toBe("local");
    expect(result.title).toBe("Action locale");
    expect(result.diagnostics.rejectionReason).toBe(TODAY_DIAGNOSTIC_REJECTION_REASON.INVALID_INTERVENTION_TYPE);
  });

  it("retombe sur le hero local si l'occurrence est introuvable", () => {
    const result = deriveTodayHeroModel({
      localHero: buildLocalHero(),
      coach: buildCoach("start_occurrence"),
      occurrencesForSelectedDay: [],
      goalsById: GOALS_BY_ID,
      hasOpenSession: false,
      handlersAvailable: {},
      canonicalContextSummary: { activeDate: ACTIVE_DATE, isToday: true },
      systemTodayKey: SYSTEM_TODAY,
    });

    expect(result.source).toBe("local");
    expect(result.title).toBe("Action locale");
  });

  it("retombe sur le hero local si start_occurrence vise une date non demarrable", () => {
    const result = deriveTodayHeroModel({
      localHero: buildLocalHero({
        primaryLabel: "Replanifier aujourd’hui",
        primaryAction: { kind: "open_pilotage" },
      }),
      coach: buildCoach("start_occurrence", {
        primaryAction: {
          label: "Demarrer",
          intent: "start_occurrence",
          categoryId: "c1",
          actionId: "a1",
          occurrenceId: "occ_1",
          dateKey: "2026-03-14",
        },
      }),
      occurrencesForSelectedDay: [{ id: "occ_1", goalId: "a1", date: "2026-03-14" }],
      goalsById: GOALS_BY_ID,
      hasOpenSession: false,
      handlersAvailable: {},
      canonicalContextSummary: { activeDate: "2026-03-14", isToday: false },
      systemTodayKey: SYSTEM_TODAY,
    });

    expect(result.source).toBe("local");
    expect(result.diagnostics.rejectionReason).toBe(TODAY_DIAGNOSTIC_REJECTION_REASON.INVALID_INTERVENTION_TYPE);
  });

  it("retombe sur le hero local si aucune session n'est ouverte", () => {
    const result = deriveTodayHeroModel({
      localHero: buildLocalHero(),
      coach: buildCoach("resume_session"),
      occurrencesForSelectedDay: [],
      goalsById: GOALS_BY_ID,
      hasOpenSession: false,
      handlersAvailable: {},
      canonicalContextSummary: { activeDate: ACTIVE_DATE, isToday: true },
      systemTodayKey: SYSTEM_TODAY,
    });

    expect(result.source).toBe("local");
    expect(result.title).toBe("Action locale");
    expect(result.diagnostics.rejectionReason).toBe(TODAY_DIAGNOSTIC_REJECTION_REASON.NO_ACTIVE_SESSION_FOR_DATE);
  });

  it("rejette une reco IA hors categorie si la preuve locale ne l'autorise pas", () => {
    const result = deriveTodayHeroModel({
      localHero: buildLocalHero({
        activeCategoryId: "c1",
        reasonLinkType: "direct_category",
        recommendedCategoryId: "c1",
      }),
      coach: buildCoach("start_occurrence", {
        primaryAction: {
          label: "Action IA",
          intent: "start_occurrence",
          categoryId: "c2",
          actionId: "a2",
          occurrenceId: "occ_cross",
          dateKey: ACTIVE_DATE,
        },
      }),
      occurrencesForSelectedDay: [{ id: "occ_cross", goalId: "a2", date: ACTIVE_DATE }],
      goalsById: GOALS_BY_ID,
      hasOpenSession: false,
      handlersAvailable: {},
      canonicalContextSummary: { activeDate: ACTIVE_DATE, isToday: true },
      systemTodayKey: SYSTEM_TODAY,
    });

    expect(result.source).toBe("local");
    expect(result.diagnostics.rejectionReason).toBe(TODAY_DIAGNOSTIC_REJECTION_REASON.CANONICAL_FALLBACK_PREFERRED);
  });
});

describe("buildLocalTodayHeroModel", () => {
  it("mappe une recommandation Today standard", () => {
    const result = buildLocalTodayHeroModel({
      activeDate: ACTIVE_DATE,
      systemTodayKey: SYSTEM_TODAY,
      activeCategoryId: "c1",
      focusOccurrenceForActiveDate: { id: "occ-1", date: ACTIVE_DATE },
      focusTitle: "Action locale",
      focusMeta: "Meta locale",
    });

    expect(result.interventionType).toBe(TODAY_INTERVENTION_TYPE.TODAY_RECOMMENDATION);
    expect(result.primaryAction).toMatchObject({ kind: "start_occurrence" });
    expect(result.reasonLinkType).toBe("direct_category");
  });

  it("mappe une reprise de session legitime", () => {
    const result = buildLocalTodayHeroModel({
      activeDate: ACTIVE_DATE,
      systemTodayKey: SYSTEM_TODAY,
      activeCategoryId: "c1",
      activeSessionForActiveDate: { id: "sess-1", occurrenceId: "occ-1" },
      focusTitle: "Action locale",
      focusMeta: "Meta locale",
    });

    expect(result.interventionType).toBe(TODAY_INTERVENTION_TYPE.SESSION_RESUME);
    expect(result.primaryAction).toMatchObject({ kind: "resume_session", categoryId: "c1" });
  });

  it("mappe un warning deterministe", () => {
    const result = buildLocalTodayHeroModel({
      activeDate: ACTIVE_DATE,
      systemTodayKey: SYSTEM_TODAY,
      activeCategoryId: "c1",
      openSessionOutsideActiveDate: { id: "sess-future" },
      futureSessions: [{ id: "sess-future" }],
      focusTitle: "Action locale",
      focusMeta: "Meta locale",
    });

    expect(result.interventionType).toBe(TODAY_INTERVENTION_TYPE.SCHEDULE_WARNING);
    expect(result.primaryAction).toMatchObject({ kind: "open_pilotage" });
  });

  it("priorise un demarrage direct avant le warning si une occurrence du jour est executable", () => {
    const result = buildLocalTodayHeroModel({
      activeDate: ACTIVE_DATE,
      systemTodayKey: SYSTEM_TODAY,
      activeCategoryId: "c1",
      openSessionOutsideActiveDate: { id: "sess-future" },
      futureSessions: [{ id: "sess-future" }],
      focusOccurrenceForActiveDate: { id: "occ-1", date: ACTIVE_DATE },
      focusTitle: "Action locale",
      focusMeta: "Meta locale",
    });

    expect(result.interventionType).toBe(TODAY_INTERVENTION_TYPE.TODAY_RECOMMENDATION);
    expect(result.primaryAction).toMatchObject({ kind: "start_occurrence" });
    expect(result.primaryLabel).toBe("Démarrer");
  });

  it("ne peut pas produire session_resume sans session sur la date active", () => {
    const result = buildLocalTodayHeroModel({
      activeDate: ACTIVE_DATE,
      systemTodayKey: SYSTEM_TODAY,
      activeCategoryId: "c1",
      openSessionOutsideActiveDate: { id: "sess-future" },
      futureSessions: [{ id: "sess-future" }],
      focusTitle: "Action locale",
      focusMeta: "Meta locale",
    });

    expect(result.interventionType).not.toBe(TODAY_INTERVENTION_TYPE.SESSION_RESUME);
  });

  it("mappe une occurrence future sur un CTA de replanification", () => {
    const result = buildLocalTodayHeroModel({
      activeDate: "2026-03-14",
      systemTodayKey: SYSTEM_TODAY,
      activeCategoryId: "c1",
      focusOccurrenceForActiveDate: { id: "occ-future", date: "2026-03-14" },
      focusTitle: "Action future",
      focusMeta: "Meta future",
    });

    expect(result.interventionType).toBe(TODAY_INTERVENTION_TYPE.TODAY_RECOMMENDATION);
    expect(result.primaryAction).toMatchObject({ kind: "open_pilotage" });
    expect(result.primaryLabel).toBe("Replanifier aujourd’hui");
  });

  it("mappe un gap local vers un CTA planifier aujourd'hui avec une action candidate nommee", () => {
    const result = buildLocalTodayHeroModel({
      activeDate: ACTIVE_DATE,
      systemTodayKey: SYSTEM_TODAY,
      activeCategoryId: "c1",
      activeCategoryName: "Focus",
      focusOccurrenceForActiveDate: null,
      gapSummary: {
        hasGapToday: true,
        gapReason: TODAY_GAP_REASON.EMPTY_DAY,
        selectionScope: "active_category",
        activeCategoryCandidateCount: 1,
        crossCategoryCandidateCount: 0,
        candidateActionSummaries: [
          {
            actionId: "a1",
            title: "Deep work",
            durationMin: 25,
          },
        ],
      },
    });

    expect(result.interventionType).toBe(TODAY_INTERVENTION_TYPE.TODAY_RECOMMENDATION);
    expect(result.primaryAction).toMatchObject({ kind: "open_pilotage" });
    expect(result.primaryLabel).toBe("Planifier aujourd’hui");
    expect(result.meta).toMatch(/Deep work/);
  });

  it("explique explicitement le fallback hors categorie quand aucun candidat actif n'existe", () => {
    const result = buildLocalTodayHeroModel({
      activeDate: ACTIVE_DATE,
      systemTodayKey: SYSTEM_TODAY,
      activeCategoryId: "c1",
      activeCategoryName: "Focus",
      focusOccurrenceForActiveDate: null,
      gapSummary: {
        hasGapToday: true,
        gapReason: TODAY_GAP_REASON.EMPTY_ACTIVE_CATEGORY,
        selectionScope: "cross_category",
        reasonLinkType: "cross_category",
        reasonLinkLabel: "Action en Sport utile pour Focus",
        contributionTargetLabel: "objectif Focus",
        activeCategoryCandidateCount: 0,
        crossCategoryCandidateCount: 1,
        candidateActionSummaries: [
          {
            actionId: "a2",
            title: "Run 20 min",
            categoryName: "Sport",
            durationMin: 20,
          },
        ],
      },
    });

    expect(result.primaryAction).toMatchObject({ kind: "open_pilotage" });
    expect(result.meta).toMatch(/objectif Focus/);
    expect(result.meta).toMatch(/Run 20 min/);
    expect(result.meta).toMatch(/Sport/);
    expect(result.reasonLinkLabel).toBe("Action en Sport utile pour Focus");
  });

  it("propose une structuration explicite quand aucun lien exploitable n'existe", () => {
    const result = buildLocalTodayHeroModel({
      activeDate: ACTIVE_DATE,
      systemTodayKey: SYSTEM_TODAY,
      activeCategoryId: "c1",
      activeCategoryName: "Finance",
      activeCategoryHasMainGoal: true,
      focusOccurrenceForActiveDate: null,
      gapSummary: {
        hasGapToday: true,
        gapReason: TODAY_GAP_REASON.EMPTY_DAY,
        selectionScope: "structure_missing",
        reasonLinkType: "structure_missing",
        reasonLinkLabel: "Structurer Finance",
        contributionTargetLabel: "objectif financier",
        activeCategoryCandidateCount: 0,
        crossCategoryCandidateCount: 0,
        candidateActionSummaries: [],
        explanation:
          "Tu n’as pas encore défini d’action exploitable pour objectif financier. Commence par clarifier l’objectif ou créer une première action en Finance.",
      },
    });

    expect(result.primaryAction).toMatchObject({ kind: "open_library" });
    expect(result.primaryLabel).toBe("Créer une première action");
    expect(result.reasonLinkType).toBe("structure_missing");
    expect(result.reasonLinkLabel).toBe("Structurer Finance");
    expect(result.meta).toMatch(/clarifier l[’']objectif/i);
  });
});

describe("deriveTodayHeroChrome", () => {
  it("retourne un chrome local sans badge quand le hero reste local", () => {
    const result = deriveTodayHeroChrome({
      todayDecisionDiagnostics: {
        resolutionStatus: "local_only",
      },
    });

    expect(result).toEqual({
      mode: "local",
      showBadge: false,
      badgeLabel: "",
      badgeTone: "",
      showLiveDot: false,
      showHint: false,
      hintText: "",
      hintTone: "",
    });
  });

  it("affiche le badge et le hint pendant le loading IA", () => {
    const result = deriveTodayHeroChrome({
      todayDecisionDiagnostics: {
        resolutionStatus: "loading_ai",
      },
    });

    expect(result.mode).toBe("loading");
    expect(result.showBadge).toBe(true);
    expect(result.badgeLabel).toBe("Coach");
    expect(result.badgeTone).toBe("ai");
    expect(result.showLiveDot).toBe(true);
    expect(result.showHint).toBe(true);
    expect(result.hintText).toBe("Analyse du jour");
  });

  it("affiche le badge coach quand la suggestion IA est visible", () => {
    const result = deriveTodayHeroChrome({
      todayDecisionDiagnostics: {
        resolutionStatus: "backend_accepted",
      },
    });

    expect(result.mode).toBe("coach");
    expect(result.showBadge).toBe(true);
    expect(result.badgeLabel).toBe("Coach");
    expect(result.badgeTone).toBe("ai");
    expect(result.showHint).toBe(false);
  });

  it("garde le badge coach visible meme si la decision backend vient des rules", () => {
    const result = deriveTodayHeroChrome({
      todayDecisionDiagnostics: {
        resolutionStatus: "backend_rules",
      },
    });

    expect(result.mode).toBe("guarded");
    expect(result.showBadge).toBe(true);
    expect(result.badgeLabel).toBe("Coach");
    expect(result.badgeTone).toBe("guarded");
  });
});

describe("deriveTodayDecisionDiagnostics", () => {
  it("explique l'etat loading du badge", () => {
    const result = deriveTodayDecisionDiagnostics({
      aiNowState: "loading",
      heroViewModel: buildLocalHero(),
      canonicalContextSummary: { activeDate: ACTIVE_DATE },
    });

    expect(result.resolutionStatus).toBe("loading_ai");
    expect(result.badgeState).toBe("loading");
  });

  it("explique une reponse backend acceptee", () => {
    const heroViewModel = deriveTodayHeroModel({
      localHero: buildLocalHero(),
      coach: buildCoach("start_occurrence"),
      occurrencesForSelectedDay: [{ id: "occ_1", goalId: "a1", date: ACTIVE_DATE }],
      goalsById: GOALS_BY_ID,
      hasOpenSession: false,
      handlersAvailable: {},
      canonicalContextSummary: { activeDate: ACTIVE_DATE, isToday: true },
      systemTodayKey: SYSTEM_TODAY,
    });

    const result = deriveTodayDecisionDiagnostics({
      aiNowState: "success",
      heroViewModel,
      coach: buildCoach("start_occurrence"),
      canonicalContextSummary: { activeDate: ACTIVE_DATE, isToday: true },
    });

    expect(result.resolutionStatus).toBe("backend_accepted");
    expect(result.badgeState).toBe("coach_visible");
  });

  it("explique un fallback rules backend retenu", () => {
    const coach = buildCoach("open_pilotage", {
      decisionSource: "rules",
      interventionType: TODAY_INTERVENTION_TYPE.SCHEDULE_WARNING,
      meta: {
        requestId: "req_rules",
        diagnostics: {
          resolutionStatus: TODAY_BACKEND_RESOLUTION_STATUS.RULES_FALLBACK,
          rejectionReason: TODAY_DIAGNOSTIC_REJECTION_REASON.NONE,
          canonicalContextSummary: {
            activeDate: ACTIVE_DATE,
            isToday: true,
            hasActiveSessionForActiveDate: false,
            hasOpenSessionOutsideActiveDate: true,
            futureSessionsCount: 1,
            hasPlannedActionsForActiveDate: true,
            hasFocusOccurrenceForActiveDate: true,
          },
        },
      },
    });
    const heroViewModel = deriveTodayHeroModel({
      localHero: buildLocalHero(),
      coach,
      occurrencesForSelectedDay: [],
      goalsById: GOALS_BY_ID,
      hasOpenSession: false,
      handlersAvailable: { openPilotage: true },
      canonicalContextSummary: { activeDate: ACTIVE_DATE, isToday: true },
      systemTodayKey: SYSTEM_TODAY,
    });

    const result = deriveTodayDecisionDiagnostics({
      aiNowState: "success",
      heroViewModel,
      coach,
      canonicalContextSummary: { activeDate: ACTIVE_DATE, isToday: true },
    });

    expect(result.resolutionStatus).toBe("backend_rules");
    expect(result.badgeState).toBe("coach_visible");
  });

  it("explique un fallback local prefere", () => {
    const coach = buildCoach("resume_session");
    const heroViewModel = deriveTodayHeroModel({
      localHero: buildLocalHero(),
      coach,
      occurrencesForSelectedDay: [],
      goalsById: GOALS_BY_ID,
      hasOpenSession: false,
      handlersAvailable: {},
      canonicalContextSummary: { activeDate: ACTIVE_DATE, isToday: true },
      systemTodayKey: SYSTEM_TODAY,
    });

    const result = deriveTodayDecisionDiagnostics({
      aiNowState: "success",
      heroViewModel,
      coach,
      canonicalContextSummary: { activeDate: ACTIVE_DATE, isToday: true },
    });

    expect(result.resolutionStatus).toBe("frontend_local_fallback");
    expect(result.rejectionReason).toBe(TODAY_DIAGNOSTIC_REJECTION_REASON.NO_ACTIVE_SESSION_FOR_DATE);
    expect(result.badgeState).toBe("coach_visible");
  });
});
