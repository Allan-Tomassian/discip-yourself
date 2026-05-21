import { describe, expect, it } from "vitest";
import { buildTodayData, buildTodayTrajectoryModel, getTodayVisualSmokeModel } from "./todayDataAdapter";
import { validateTodayAdapterInvariants } from "../../logic/systemInvariants";

const SELECTED_DATE_KEY = "2026-04-28";
const NOW = new Date("2026-04-28T12:00:00");

function baseData(overrides = {}) {
  return {
    profile: { name: "Allan" },
    categories: [{ id: "cat-work", name: "Travail" }],
    goals: [{ id: "goal-deep", title: "Deep work", categoryId: "cat-work", priority: "high" }],
    occurrences: [],
    microChecks: {},
    ui: {},
    ...overrides,
  };
}

function build(overrides = {}) {
  return buildTodayData({
    data: baseData(overrides.data),
    selectedDateKey: overrides.selectedDateKey || SELECTED_DATE_KEY,
    now: overrides.now || NOW,
    auth: overrides.auth,
    profile: overrides.profile,
    manualTodayAnalysis: overrides.manualTodayAnalysis,
    persistenceScope: overrides.persistenceScope,
    dataLoading: overrides.dataLoading,
    dataLoadError: overrides.dataLoadError,
    hasCachedData: overrides.hasCachedData,
    isOnline: overrides.isOnline,
    visualSmokeModel: overrides.visualSmokeModel,
  });
}

describe("buildTodayData", () => {
  it("returns unavailable score and baseline delta without history", () => {
    const result = build({ data: { occurrences: [], microChecks: {} } });

    expect(result.scoreDisplay).toBe("--%");
    expect(result.scoreAvailable).toBe(false);
    expect(result.previousDayDeltaDisplay).toBe("Point de départ");
    expect(result.previousDayDeltaAvailable).toBe(false);
  });

  it("allows a real zero score when expected historical signal exists", () => {
    const result = build({
      data: {
        occurrences: [
          {
            id: "occ-missed",
            goalId: "goal-deep",
            date: "2026-04-27",
            start: "09:00",
            durationMinutes: 30,
            status: "missed",
          },
        ],
      },
    });

    expect(result.scoreDisplay).toBe("0%");
    expect(result.scoreAvailable).toBe(true);
    expect(result.previousDayDeltaDisplay).toBe("Point de départ");
  });

  it("maps two completed blocks out of three to 67 percent progress", () => {
    const result = build({
      data: {
        occurrences: [
          {
            id: "occ-1",
            goalId: "goal-deep",
            date: SELECTED_DATE_KEY,
            start: "07:00",
            status: "done",
          },
          {
            id: "occ-2",
            goalId: "goal-deep",
            date: SELECTED_DATE_KEY,
            start: "09:30",
            status: "done",
          },
          {
            id: "occ-3",
            goalId: "goal-deep",
            date: SELECTED_DATE_KEY,
            start: "13:00",
            status: "planned",
          },
        ],
      },
    });

    expect(result.completedBlocks).toBe(2);
    expect(result.totalBlocks).toBe(3);
    expect(result.timelineProgressPercent).toBe(67);
    expect(result.timelineProgressLabel).toBe("67%");
  });

  it("maps an active session to a resume primary action", () => {
    const result = build({
      data: {
        ui: {
          activeSession: {
            occurrenceId: "occ-active",
            dateKey: SELECTED_DATE_KEY,
            habitIds: ["goal-deep"],
            runtimePhase: "in_progress",
          },
        },
        occurrences: [
          {
            id: "occ-active",
            goalId: "goal-deep",
            date: SELECTED_DATE_KEY,
            start: "13:00",
            durationMinutes: 30,
            status: "in_progress",
          },
        ],
      },
    });

    expect(result.primaryAction.status).toBe("in_progress");
    expect(result.primaryAction.primaryLabel).toBe("Reprendre");
    expect(result.timelineItems[0]).toMatchObject({
      id: "occ-active",
      status: "in_progress",
    });
  });

  it("maps an empty day to safe coach/planning fallbacks", () => {
    const result = build({ data: { occurrences: [] } });

    expect(result.state).toBe("empty_day");
    expect(result.totalBlocks).toBe(0);
    expect(result.timelineProgressPercent).toBeNull();
    expect(result.timelineProgressLabel).toBe("--%");
    expect(result.hero.scoreLabel).toBe("--%");
    expect(result.primaryAction.status).toBe("empty");
    expect(result.primaryAction.label).toBe("Prochaine action");
    expect(result.primaryAction.title).toBe("Construis ton prochain bloc");
    expect(result.primaryAction.primaryLabel).toContain("Coach IA");
    expect(result.primaryAction.secondaryLabel).toBe("Planning");
    expect(result.primaryAction.detailLabel).toBe("Coach IA");
    expect(result.aiInsight.status).toBe("unavailable");
    expect(result.aiInsight.canApply).toBe(false);
  });

  it("uses loading_without_cache only when loading has no cache", () => {
    const result = build({
      data: { occurrences: [] },
      dataLoading: true,
      hasCachedData: false,
    });

    expect(result.state).toBe("loading_without_cache");
    expect(result.scoreDisplay).toBe("--%");
    expect(result.previousDayDeltaDisplay).toBe("Point de départ");
    expect(result.primaryAction.label).toBe("CHARGEMENT");
    expect(result.primaryAction.primaryLabel).toBe("Patienter");
    expect(result.primaryAction.canPrimary).toBe(false);
    expect(result.timelineMode).toBe("disabled");
    expect(result.aiMode).toBe("hidden");
  });

  it("keeps cached cockpit visible while refreshing", () => {
    const result = build({
      dataLoading: true,
      hasCachedData: true,
      data: {
        occurrences: [
          { id: "past", goalId: "goal-deep", date: "2026-04-27", start: "09:00", status: "done" },
          { id: "today", goalId: "goal-deep", date: SELECTED_DATE_KEY, start: "13:00", status: "planned" },
        ],
      },
    });

    expect(result.state).toBe("neutral");
    expect(result.isRefreshing).toBe(true);
    expect(result.timelineMode).toBe("normal");
  });

  it("uses error_without_cache only when load error has no cache", () => {
    const result = build({
      dataLoadError: "Network failed",
      hasCachedData: false,
    });

    expect(result.state).toBe("error_without_cache");
    expect(result.primaryAction.label).toBe("ACTION INDISPONIBLE");
    expect(result.primaryAction.primaryLabel).toBe("Réessayer");
    expect(result.primaryAction.canPrimary).toBe(false);
    expect(result.motionIntensity).toBe("none");
  });

  it("keeps cached cockpit visible when loading errors after cache", () => {
    const result = build({
      dataLoadError: "Network failed",
      hasCachedData: true,
      data: {
        occurrences: [
          { id: "past", goalId: "goal-deep", date: "2026-04-27", start: "09:00", status: "done" },
          { id: "today", goalId: "goal-deep", date: SELECTED_DATE_KEY, start: "13:00", status: "planned" },
        ],
      },
    });

    expect(result.state).toBe("neutral");
    expect(result.flags.error).toBe("Network failed");
    expect(result.isRefreshing).toBe(false);
  });

  it("uses offline_without_cache only when offline has no cache", () => {
    const result = build({
      isOnline: false,
      hasCachedData: false,
    });

    expect(result.state).toBe("offline_without_cache");
    expect(result.flags.offline).toBe(true);
    expect(result.canUseLocalActions).toBe(false);
    expect(result.primaryAction.label).toBe("HORS-LIGNE");
    expect(result.primaryAction.primaryLabel).toBe("Hors-ligne");
    expect(result.primaryAction.canSecondary).toBe(false);
    expect(result.primaryAction.canDetail).toBe(false);
  });

  it("keeps offline cached late cockpit visible with local actions flag", () => {
    const result = build({
      isOnline: false,
      hasCachedData: true,
      data: {
        occurrences: [
          { id: "past", goalId: "goal-deep", date: "2026-04-27", start: "09:00", status: "done" },
          {
            id: "late",
            goalId: "goal-deep",
            date: SELECTED_DATE_KEY,
            start: "09:00",
            durationMinutes: 30,
            status: "planned",
          },
        ],
      },
    });

    expect(result.state).toBe("late");
    expect(result.flags.offline).toBe(true);
    expect(result.canUseLocalActions).toBe(true);
    expect(result.primaryAction.label).toBe("Prochaine action");
    expect(result.primaryAction.title).toBe("Récupérer le prochain bloc");
    expect(result.primaryAction.primaryLabel).toBe("Simplifier le bloc");
    expect(result.primaryAction.secondaryLabel).toBe("Réduire");
    expect(result.primaryAction.detailLabel).toBe("Reporter");
  });

  it("prioritizes in_progress over late", () => {
    const result = build({
      data: {
        ui: {
          activeSession: {
            occurrenceId: "active",
            dateKey: SELECTED_DATE_KEY,
            habitIds: ["goal-deep"],
            runtimePhase: "in_progress",
          },
        },
        occurrences: [
          { id: "past", goalId: "goal-deep", date: "2026-04-27", start: "09:00", status: "done" },
          { id: "active", goalId: "goal-deep", date: SELECTED_DATE_KEY, start: "13:00", status: "in_progress" },
          { id: "late", goalId: "goal-deep", date: SELECTED_DATE_KEY, start: "08:00", durationMinutes: 20, status: "planned" },
        ],
      },
    });

    expect(result.state).toBe("in_progress");
    expect(result.primaryAction.label).toBe("BLOC EN COURS");
    expect(result.primaryAction.primaryLabel).toBe("Reprendre");
  });

  it("keeps postponed visible without making the old slot launchable primary work", () => {
    const result = build({
      data: {
        occurrences: [
          { id: "past", goalId: "goal-deep", date: "2026-04-27", start: "09:00", status: "done" },
          { id: "postponed", goalId: "goal-deep", date: SELECTED_DATE_KEY, start: "13:00", status: "rescheduled" },
        ],
      },
    });

    expect(result.primaryAction.occurrenceId).not.toBe("postponed");
    expect(result.primaryAction.status).toBe("empty");
    expect(result.primaryAction.primaryLabel).toContain("Coach IA");
    expect(result.timelineItems[0].status).toBe("postponed");
  });

  it("maps first_day when today has a first real action and no history", () => {
    const result = build({
      data: {
        occurrences: [
          { id: "first", goalId: "goal-deep", date: SELECTED_DATE_KEY, start: "13:00", durationMinutes: 30, status: "planned" },
        ],
      },
    });

    expect(result.state).toBe("first_day");
    expect(result.previousDayDeltaDisplay).toBe("Point de départ");
    expect(result.primaryAction.primaryLabel).toBe("Démarrer");
  });

  it("maps returning_after_absence from older history without recent signal", () => {
    const result = build({
      data: {
        occurrences: [
          { id: "old", goalId: "goal-deep", date: "2026-04-20", start: "09:00", status: "done" },
          { id: "return", goalId: "goal-deep", date: SELECTED_DATE_KEY, start: "13:00", durationMinutes: 30, status: "planned" },
        ],
      },
    });

    expect(result.state).toBe("returning_after_absence");
    expect(result.primaryAction.primaryLabel).toBe("Simplifier le bloc");
  });

  it("maps locked without faking a discipline score", () => {
    const result = build({
      data: {
        occurrences: [
          { id: "done-1", goalId: "goal-deep", date: SELECTED_DATE_KEY, start: "07:00", status: "done" },
          { id: "done-2", goalId: "goal-deep", date: SELECTED_DATE_KEY, start: "09:00", status: "done" },
        ],
      },
    });

    expect(result.state).toBe("locked");
    expect(result.timelineProgressLabel).toBe("100%");
    expect(result.scoreDisplay).toBe("--%");
    expect(result.primaryAction.label).toBe("JOURNÉE VERROUILLÉE");
    expect(result.primaryAction.primaryLabel).toBe("Voir demain");
    expect(result.primaryAction.detailLabel).toBe("Voir progression");
    expect(result.primaryAction.canPrimary).toBe(false);
  });

  it("never ties the primary action to terminal or moved occurrences", () => {
    const data = {
      occurrences: [
        { id: "done-1", goalId: "goal-deep", date: SELECTED_DATE_KEY, start: "07:00", status: "done" },
        { id: "missed-1", goalId: "goal-deep", date: SELECTED_DATE_KEY, start: "08:00", status: "missed" },
        { id: "canceled-1", goalId: "goal-deep", date: SELECTED_DATE_KEY, start: "09:00", status: "canceled" },
        { id: "skipped-1", goalId: "goal-deep", date: SELECTED_DATE_KEY, start: "11:00", status: "skipped" },
        { id: "postponed-1", goalId: "goal-deep", date: SELECTED_DATE_KEY, start: "13:00", status: "rescheduled" },
      ],
    };
    const result = build({ data });

    expect(["done-1", "missed-1", "canceled-1", "skipped-1", "postponed-1"]).not.toContain(result.primaryAction.occurrenceId);
    expect(validateTodayAdapterInvariants({ state: baseData(data), todayData: result, selectedDateKey: SELECTED_DATE_KEY }).ok).toBe(true);
  });

  it("surfaces a blocked occurrence as restartable recovery work", () => {
    const result = build({
      data: {
        occurrences: [
          { id: "blocked", goalId: "goal-deep", date: SELECTED_DATE_KEY, start: "09:00", status: "planned", durationMinutes: 30 },
        ],
        sessionHistory: [
          {
            id: "session-blocked",
            occurrenceId: "blocked",
            dateKey: SELECTED_DATE_KEY,
            state: "ended",
            endedReason: "blocked",
          },
        ],
      },
    });

    expect(result.primaryAction).toMatchObject({
      status: "blocked",
      label: "Prochaine action",
      title: "Récupérer le prochain bloc",
      primaryLabel: "Simplifier le bloc",
      secondaryLabel: "Ajuster",
      reason: "Ce bloc a rencontré une friction. Repars court, ou ajuste-le.",
    });
    expect(result.timelineItems[0].status).toBe("blocked");
    expect(result.systemSignals.map((signal) => signal.type)).toContain("blocked_block");
    expect(result.primarySystemSignal?.type).toBe("blocked_block");
  });

  it("surfaces a reported occurrence as restartable recovery work", () => {
    const result = build({
      data: {
        occurrences: [
          { id: "reported", goalId: "goal-deep", date: SELECTED_DATE_KEY, start: "09:00", status: "planned", durationMinutes: 30 },
        ],
        sessionHistory: [
          {
            id: "session-reported",
            occurrenceId: "reported",
            dateKey: SELECTED_DATE_KEY,
            state: "ended",
            endedReason: "reported",
          },
        ],
      },
    });

    expect(result.primaryAction).toMatchObject({
      status: "reported",
      label: "Prochaine action",
      title: "Récupérer le prochain bloc",
      primaryLabel: "Simplifier le bloc",
      secondaryLabel: "Changer l’heure",
      reason: "Tu as signalé une friction. Choisis une version faisable.",
    });
    expect(result.timelineItems[0].status).toBe("reported");
  });

  it("keeps active session ahead of old blocked or reported history", () => {
    const result = build({
      data: {
        ui: {
          activeSession: {
            occurrenceId: "active-friction",
            dateKey: SELECTED_DATE_KEY,
            habitIds: ["goal-deep"],
            runtimePhase: "in_progress",
          },
        },
        occurrences: [
          { id: "active-friction", goalId: "goal-deep", date: SELECTED_DATE_KEY, start: "09:00", status: "planned" },
        ],
        sessionHistory: [
          {
            id: "session-blocked",
            occurrenceId: "active-friction",
            dateKey: SELECTED_DATE_KEY,
            state: "ended",
            endedReason: "blocked",
          },
        ],
      },
    });

    expect(result.primaryAction.status).toBe("in_progress");
    expect(result.primaryAction.primaryLabel).toBe("Reprendre");
    expect(result.timelineItems[0].status).toBe("in_progress");
  });

  it("maps risk for a currently exposed planned block without flashing late", () => {
    const result = build({
      data: {
        occurrences: [
          { id: "past", goalId: "goal-deep", date: "2026-04-27", start: "09:00", status: "done" },
          { id: "risk", goalId: "goal-deep", date: SELECTED_DATE_KEY, start: "11:50", durationMinutes: 30, status: "planned" },
        ],
      },
    });

    expect(result.state).toBe("risk");
    expect(result.tone).toBe("risk");
    expect(result.primaryAction.primaryLabel).toBe("Démarrer");
  });

  it("maps control when execution progress exists", () => {
    const result = build({
      data: {
        occurrences: [
          { id: "done", goalId: "goal-deep", date: SELECTED_DATE_KEY, start: "07:00", status: "done" },
          { id: "next", goalId: "goal-deep", date: SELECTED_DATE_KEY, start: "13:00", status: "planned" },
        ],
      },
    });

    expect(result.state).toBe("control");
    expect(result.welcomeLine).toBe("Bon retour — aujourd’hui, on avance bloc par bloc.");
    expect(result.primaryAction.label).toBe("Prochaine action");
    expect(result.primaryAction.title).toBe("Démarrer le bloc");
    expect(result.primaryAction.primaryLabel).toBe("Démarrer");
    expect(result.primaryAction.secondaryLabel).toBe("Reporter");
    expect(result.primaryAction.detailLabel).toBe("Voir détail");
  });

  it("maps neutral for a stable structured day before execution starts", () => {
    const result = build({
      data: {
        occurrences: [
          { id: "past", goalId: "goal-deep", date: "2026-04-27", start: "09:00", status: "done" },
          { id: "next", goalId: "goal-deep", date: SELECTED_DATE_KEY, start: "13:00", status: "planned" },
        ],
      },
    });

    expect(result.state).toBe("neutral");
    expect(result.primaryAction.label).toBe("Prochaine action");
    expect(result.primaryAction.title).toBe("Démarrer le bloc");
    expect(result.primaryAction.primaryLabel).toBe("Démarrer");
    expect(result.primaryAction.secondaryLabel).toBe("Reporter");
    expect(result.primaryAction.detailLabel).toBe("Voir détail");
  });

  it("builds a seven-day trajectory without exposing a fake score", () => {
    const result = build({
      data: {
        occurrences: [
          { id: "done", goalId: "goal-deep", date: SELECTED_DATE_KEY, start: "07:00", durationMinutes: 30, status: "done" },
          { id: "missed", goalId: "goal-deep", date: SELECTED_DATE_KEY, start: "08:00", durationMinutes: 25, status: "missed" },
          { id: "planned", goalId: "goal-deep", date: SELECTED_DATE_KEY, start: "13:00", durationMinutes: 25, status: "planned" },
          { id: "previous", goalId: "goal-deep", date: "2026-04-24", start: "09:00", durationMinutes: 30, status: "planned" },
        ],
      },
    });

    expect(result.trajectory.days).toHaveLength(7);
    expect(result.trajectory.currentDayIndex).toBe(6);
    expect(result.trajectory.completedBlocks).toBe(1);
    expect(result.trajectory.todayFrictionCount).toBe(1);
    expect(result.trajectory.remainingMinutesToday).toBe(25);
    expect(result.trajectory.days[6]).toMatchObject({
      isCurrent: true,
      completionPercent: 33,
      hasFriction: true,
    });
    expect(result.trajectory.days[0].completionPercent).toBe(0);
    expect(result.trajectory).not.toHaveProperty("scoreDisplay");
  });

  it("keeps DEV smoke fixture values coherent by state", () => {
    const originalWindow = globalThis.window;
    try {
      globalThis.window = {
        __TODAY_VISUAL_SMOKE__: true,
        __TODAY_VISUAL_SMOKE_STATE__: "late",
      };
      expect(getTodayVisualSmokeModel()).toMatchObject({
        state: "late",
        scoreLabel: "24%",
        deltaLabel: "-18% vs hier",
      });

      globalThis.window.__TODAY_VISUAL_SMOKE_STATE__ = "risk";
      expect(getTodayVisualSmokeModel()).toMatchObject({
        state: "risk",
        scoreLabel: "41%",
        deltaLabel: "-12% vs hier",
      });

      globalThis.window.__TODAY_VISUAL_SMOKE_STATE__ = "locked";
      expect(getTodayVisualSmokeModel()).toMatchObject({
        state: "locked",
        scoreLabel: "91%",
        deltaLabel: "+14% vs hier",
      });
    } finally {
      if (originalWindow === undefined) {
        delete globalThis.window;
      } else {
        globalThis.window = originalWindow;
      }
    }
  });

  it("keeps AI unavailable as a local mode without inventing recommendations", () => {
    const result = build({
      data: {
        occurrences: [
          { id: "done", goalId: "goal-deep", date: SELECTED_DATE_KEY, start: "07:00", status: "done" },
          { id: "next", goalId: "goal-deep", date: SELECTED_DATE_KEY, start: "13:00", status: "planned" },
        ],
      },
      manualTodayAnalysis: null,
    });

    expect(result.state).toBe("control");
    expect(result.aiMode).toBe("unavailable");
    expect(result.aiInsight.recommendation).toBe("");
    expect(result.aiInsight.canApply).toBe(false);
  });

  it("applies the smoke fixture deterministically without leaking into production data", () => {
    const smokeModel = {
      scoreLabel: "72%",
      deltaLabel: "+8% vs hier",
      doneBlocksCount: 2,
      plannedBlocksCount: 3,
      timelineProgressLabel: "67%",
      cockpitStatus: {
        welcome: "Bon retour — aujourd’hui, on avance bloc par bloc.",
        mode: "MODE EXÉCUTION",
        title: "Tu es en contrôle.",
        detail: "Ne casse pas le rythme maintenant.",
      },
      primaryAction: {
        title: "Deep work",
        description: "Avancer sur ton objectif principal.",
        durationLabel: "30 min",
        timingLabel: "13:00",
        categoryLabel: "Travail",
        priorityLabel: "Priorité haute",
        reason: "C’est le bloc qui débloque ta journée.",
        ctaLabel: "Verrouiller 30 min",
      },
      timelineItems: [
        { id: "smoke-routine", timeLabel: "07:00", title: "Routine", status: "done" },
        { id: "smoke-sport", timeLabel: "09:30", title: "Sport", status: "done" },
        { id: "smoke-deep", timeLabel: "13:00", title: "Deep work", status: "in_progress" },
      ],
      ai: {
        headline: "Tu tiens mieux les blocs courts.",
        recommendation: "Garde ce bloc à 30 min.",
        reason: "Tes sessions de 20-40 min ont 67% de taux de complétion ces 7 derniers jours.",
      },
    };

    const smoked = build({ visualSmokeModel: smokeModel });
    expect(smoked.scoreDisplay).toBe("72%");
    expect(smoked.previousDayDeltaDisplay).toBe("+8% vs hier");
    expect(smoked.completedBlocks).toBe(2);
    expect(smoked.totalBlocks).toBe(3);
    expect(smoked.timelineProgressPercent).toBe(67);
    expect(smoked.primaryAction.title).toBe("Deep work");
    expect(smoked.primaryAction.primaryLabel).toBe("Verrouiller 30 min");
    expect(smoked.timelineItems[2].status).toBe("in_progress");
    expect(smoked.aiInsight.recommendation).toBe("Garde ce bloc à 30 min.");

    const production = build();
    expect(production.scoreDisplay).toBe("--%");
    expect(production.primaryAction.title).not.toBe("Deep work");
    expect(getTodayVisualSmokeModel()).toBeNull();
  });
});

describe("buildTodayTrajectoryModel", () => {
  it("marks current day, friction, empty days, and remaining minutes", () => {
    const goalsById = new Map([["goal-deep", { id: "goal-deep", durationMinutes: 30 }]]);
    const result = buildTodayTrajectoryModel({
      selectedDateKey: SELECTED_DATE_KEY,
      goalsById,
      occurrences: [
        { id: "old-done", goalId: "goal-deep", date: "2026-04-25", status: "done" },
        { id: "today-done", goalId: "goal-deep", date: SELECTED_DATE_KEY, status: "done" },
        { id: "today-blocked", goalId: "goal-deep", date: SELECTED_DATE_KEY, status: "planned", durationMinutes: 25 },
      ],
      sessionHistory: [
        { id: "blocked-history", occurrenceId: "today-blocked", dateKey: SELECTED_DATE_KEY, state: "ended", endedReason: "blocked" },
      ],
    });

    expect(result.days).toHaveLength(7);
    expect(result.days[6].isCurrent).toBe(true);
    expect(result.days[6].completedCount).toBe(1);
    expect(result.days[6].frictionCount).toBe(1);
    expect(result.days[6].completionPercent).toBe(50);
    expect(result.days[0].isEmpty).toBe(true);
    expect(result.remainingMinutesToday).toBe(25);
  });
});
