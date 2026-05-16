import { describe, expect, it } from "vitest";
import {
  addFirstRunDraftWindow,
  createEmptyFirstRunWindow,
  getNextFirstRunStatus,
  hasMeaningfulFirstRunState,
  isFirstRunSignalsReady,
  isFirstRunWhyReady,
  isFirstRunDone,
  normalizeFirstRunV1,
  patchFirstRunDraftWindow,
  removeFirstRunDraftWindow,
  buildAiAssistedRecommendedGeneratedPlans,
  buildDeterministicRecommendedGeneratedPlans,
  buildLocalStubGeneratedPlans,
} from "./firstRunModel";

describe("firstRunModel", () => {
  it("normalizes the v1 contract with safe defaults while keeping raw draft text and incomplete windows", () => {
    const normalized = normalizeFirstRunV1({
      status: "signals",
      draftAnswers: {
        whyText: "  Reprendre le controle  ",
        primaryGoal: "  Relancer le projet  ",
        unavailableWindows: [
          {
            id: "w1",
            daysOfWeek: [1, 1, 5, 9],
            startTime: "09:00",
            endTime: "",
            label: "  Travail  ",
          },
        ],
      },
    });

    expect(normalized.version).toBe(1);
    expect(normalized.status).toBe("signals");
    expect(normalized.draftAnswers.whyText).toBe("  Reprendre le controle  ");
    expect(normalized.draftAnswers.primaryGoal).toBe("  Relancer le projet  ");
    expect(normalized.draftAnswers.unavailableWindows).toEqual([
      {
        id: "w1",
        daysOfWeek: [1, 5],
        startTime: "09:00",
        endTime: "",
        label: "  Travail  ",
      },
    ]);
    expect(normalized.generatedPlans).toBeNull();
    expect(normalized.inputHash).toBeNull();
    expect(normalized.generationError).toBeNull();
    expect(normalized.selectedPlanId).toBeNull();
    expect(normalized.commitV1.status).toBe("idle");
    expect(normalized.discoveryDone).toBe(false);
  });

  it("falls back to legacy onboarding completion only when firstRunV1 is absent", () => {
    expect(normalizeFirstRunV1(null, { legacyOnboardingCompleted: true }).status).toBe("done");
    expect(isFirstRunDone({ onboardingCompleted: true })).toBe(true);
    expect(isFirstRunDone({ firstRunV1: { status: "signals" }, onboardingCompleted: true })).toBe(false);
    expect(isFirstRunDone({ firstRunV1: { status: "done", commitV1: { status: "failed" } }, onboardingCompleted: true })).toBe(false);
    expect(isFirstRunDone({ firstRunV1: { status: "done" }, onboardingCompleted: true })).toBe(true);
  });

  it("migrates incomplete legacy onboarding to intro", () => {
    const normalized = normalizeFirstRunV1(null, { legacyOnboardingCompleted: false });
    expect(normalized.status).toBe("intro");
    expect(normalized.discoveryDone).toBe(false);
  });

  it("validates forward transitions and blocks compare without a selection", () => {
    expect(getNextFirstRunStatus("intro")).toBe("why");
    expect(getNextFirstRunStatus("signals")).toBe("generate");
    expect(getNextFirstRunStatus("compare", { selectedPlanId: null })).toBe("compare");
    expect(getNextFirstRunStatus("compare", { selectedPlanId: "tenable" })).toBe("commit");
  });

  it("keeps trim-based readiness checks separate from raw stored text", () => {
    expect(isFirstRunWhyReady("   ")).toBe(false);
    expect(isFirstRunWhyReady("  Avancer vraiment  ")).toBe(true);

    expect(
      isFirstRunSignalsReady({
        primaryGoal: "   ",
        currentCapacity: "stable",
        priorityCategoryIds: ["business"],
      }),
    ).toBe(false);

    expect(
      isFirstRunSignalsReady({
        primaryGoal: "  Relancer le projet  ",
        currentCapacity: "stable",
        priorityCategoryIds: ["business"],
      }),
    ).toBe(true);
  });

  it("treats a non-empty interrupted draft as meaningful local data", () => {
    const emptyState = normalizeFirstRunV1(null, { legacyOnboardingCompleted: false });
    expect(hasMeaningfulFirstRunState(emptyState)).toBe(false);

    const withSpacesOnly = normalizeFirstRunV1({
      draftAnswers: { whyText: "   " },
    });
    expect(hasMeaningfulFirstRunState(withSpacesOnly)).toBe(false);

    const withWhy = normalizeFirstRunV1({
      status: "why",
      draftAnswers: { whyText: "Avancer vraiment" },
    });
    expect(hasMeaningfulFirstRunState(withWhy)).toBe(true);

    const withWindow = normalizeFirstRunV1({
      draftAnswers: {
        preferredWindows: [createEmptyFirstRunWindow({ label: "Matin", daysOfWeek: [1], startTime: "07:00" })],
      },
    });
    expect(hasMeaningfulFirstRunState(withWindow)).toBe(true);
  });

  it("adds, patches, and removes draft windows without dropping incomplete lines", () => {
    const addedUnavailable = addFirstRunDraftWindow([]);
    expect(addedUnavailable).toHaveLength(1);
    expect(addedUnavailable[0]).toMatchObject({
      daysOfWeek: [],
      startTime: "",
      endTime: "",
      label: "",
    });

    const patchedUnavailable = patchFirstRunDraftWindow(addedUnavailable, addedUnavailable[0].id, {
      label: "  Travail  ",
      daysOfWeek: [1, 1, 3],
      startTime: "09:00",
    });
    expect(patchedUnavailable).toEqual([
      {
        id: addedUnavailable[0].id,
        daysOfWeek: [1, 3],
        startTime: "09:00",
        endTime: "",
        label: "  Travail  ",
      },
    ]);

    const removedUnavailable = removeFirstRunDraftWindow(patchedUnavailable, addedUnavailable[0].id);
    expect(removedUnavailable).toEqual([]);
  });

  it("normalizes generatedPlans with commitDraft canonique and legacy variants", () => {
    const normalized = normalizeFirstRunV1({
      status: "compare",
      inputHash: "hash-1",
      generatedPlans: {
        version: 2,
        source: "ai_backend",
        inputHash: "hash-1",
        generatedAt: "2026-04-19T08:00:00.000Z",
        requestId: "req-1",
        model: "gpt-5.4",
        promptVersion: "first_run_plan_v1",
        plans: [
          {
            id: "steady",
            variant: "steady",
            title: "",
            summary: "Version tenable",
            comparisonMetrics: {
              weeklyMinutes: 150,
              totalBlocks: 5,
              activeDays: 4,
              recoverySlots: 3,
              dailyDensity: "respirable",
              engagementLevel: "tenable",
            },
            categories: [{ id: "cat_1", label: "Business", role: "primary", blockCount: 3 }],
            preview: [
              {
                dayKey: "2026-04-19",
                dayLabel: "DIM 19/04",
                slotLabel: "08:00 - 08:25",
                categoryId: "cat_1",
                categoryLabel: "Business",
                title: "Bloc profond",
                minutes: 25,
              },
            ],
            todayPreview: [
              {
                dayKey: "2026-04-19",
                dayLabel: "DIM 19/04",
                slotLabel: "08:00 - 08:25",
                categoryId: "cat_1",
                categoryLabel: "Business",
                title: "Bloc profond",
                minutes: 25,
              },
            ],
            rationale: {
              whyFit: "Plan sobre.",
              capacityFit: "Charge stable.",
              constraintFit: "Contraintes respectées.",
            },
            commitDraft: {
              version: 1,
              categories: [{ id: "cat_1", templateId: "business", name: "Business", color: "#0ea5e9", order: 0 }],
              goals: [{ id: "goal_1", categoryId: "cat_1", title: "Relancer le projet", type: "OUTCOME", order: 0 }],
              actions: [
                {
                  id: "action_1",
                  categoryId: "cat_1",
                  parentGoalId: "goal_1",
                  title: "Bloc profond",
                  type: "PROCESS",
                  order: 0,
                  repeat: "weekly",
                  daysOfWeek: [1, 3, 5],
                  timeMode: "FIXED",
                  startTime: "08:00",
                  timeSlots: ["08:00"],
                  durationMinutes: 25,
                  sessionMinutes: 25,
                },
              ],
              occurrences: [
                { id: "occ_1", actionId: "action_1", date: "2026-04-19", start: "08:00", durationMinutes: 25, status: "planned" },
              ],
            },
          },
        ],
      },
      selectedPlanId: "steady",
    });

    expect(normalized.generatedPlans?.plans[0]?.variant).toBe("tenable");
    expect(normalized.generatedPlans?.plans[0]?.id).toBe("tenable");
    expect(normalized.generatedPlans?.plans[0]?.title).toBe("Plan tenable");
    expect(normalized.selectedPlanId).toBe("tenable");
    expect(normalized.generatedPlans?.plans[0]?.commitDraft?.actions[0]?.id).toBe("action_1");
    expect(normalized.generatedPlans?.plans[0]?.commitDraft?.occurrences[0]?.actionId).toBe("action_1");
  });

  it("normalizes v3 recommended plans into plans=[recommended] and auto-selects them", () => {
    const normalized = normalizeFirstRunV1({
      status: "compare",
      inputHash: "hash-v3",
      generatedPlans: {
        version: 3,
        source: "deterministic_starter",
        inputHash: "hash-v3",
        generatedAt: "2026-04-19T08:00:00.000Z",
        plan: {
          id: "recommended",
          variant: "recommended",
          title: "Plan recommandé",
          summary: "Une première semaine concrète.",
          weekGoal: "Relancer le projet",
          weekBenefit: "Créer une preuve.",
          comparisonMetrics: {
            weeklyMinutes: 150,
            totalBlocks: 5,
            activeDays: 4,
            recoverySlots: 3,
            dailyDensity: "respirable",
            engagementLevel: "recommended",
          },
          categories: [{ id: "cat_1", label: "Business", role: "primary", blockCount: 3 }],
          preview: [
            {
              dayKey: "2026-04-19",
              dayLabel: "DIM 19/04",
              slotLabel: "08:00 - 08:25",
              categoryId: "cat_1",
              categoryLabel: "Business",
              title: "Focus profond",
              minutes: 25,
            },
          ],
          todayPreview: [
            {
              dayKey: "2026-04-19",
              dayLabel: "DIM 19/04",
              slotLabel: "08:00 - 08:25",
              categoryId: "cat_1",
              categoryLabel: "Business",
              title: "Focus profond",
              minutes: 25,
            },
          ],
          weekSchedule: [
            {
              dayKey: "2026-04-19",
              dayLabel: "DIM",
              blockCount: 1,
              totalMinutes: 25,
              loadLabel: "1 bloc",
              primarySlotLabel: "08:00 - 08:25",
              headline: "Focus profond",
            },
          ],
          rhythmGuidance: { title: "Rythme", description: "Simple", startWindow: "08:00", shutdownWindow: "Soir", confidence: "bonne" },
          rationale: {
            whyFit: "Plan sobre.",
            capacityFit: "Charge stable.",
            constraintFit: "Contraintes respectées.",
          },
          commitDraft: {
            version: 1,
            categories: [{ id: "cat_1", templateId: "business", name: "Business", color: "#0ea5e9", order: 0 }],
            goals: [{ id: "goal_1", categoryId: "cat_1", title: "Relancer le projet", type: "OUTCOME", order: 0 }],
            actions: [
              {
                id: "action_1",
                categoryId: "cat_1",
                parentGoalId: "goal_1",
                title: "Focus profond",
                type: "PROCESS",
                order: 0,
                repeat: "weekly",
                daysOfWeek: [1, 3, 5],
                timeMode: "FIXED",
                startTime: "08:00",
                timeSlots: ["08:00"],
                durationMinutes: 25,
                sessionMinutes: 25,
              },
            ],
            occurrences: [
              { id: "occ_1", actionId: "action_1", date: "2026-04-19", start: "08:00", durationMinutes: 25, status: "planned" },
            ],
          },
        },
        ai: {
          status: "locked",
          missingInformation: ["Horaires précis"],
        },
      },
    });

    expect(normalized.generatedPlans?.version).toBe(3);
    expect(normalized.generatedPlans?.source).toBe("deterministic_starter");
    expect(normalized.generatedPlans?.plans).toHaveLength(1);
    expect(normalized.generatedPlans?.plans[0]?.id).toBe("recommended");
    expect(normalized.generatedPlans?.plans[0]?.variant).toBe("recommended");
    expect(normalized.generatedPlans?.plans[0]?.weekSchedule).toHaveLength(1);
    expect(normalized.generatedPlans?.ai?.status).toBe("locked");
    expect(normalized.selectedPlanId).toBe("recommended");
  });

  it("reste compatible avec les anciens payloads qui stockent occurrence.goalId", () => {
    const normalized = normalizeFirstRunV1({
      status: "compare",
      generatedPlans: {
        version: 2,
        source: "ai_backend",
        inputHash: "hash-legacy",
        generatedAt: "2026-04-19T08:00:00.000Z",
        requestId: "req-legacy",
        model: "gpt-5.4",
        promptVersion: "first_run_plan_v1",
        plans: [
          {
            id: "tenable",
            variant: "tenable",
            title: "Plan tenable",
            summary: "Version legacy",
            comparisonMetrics: {
              weeklyMinutes: 150,
              totalBlocks: 5,
              activeDays: 4,
              recoverySlots: 3,
              dailyDensity: "respirable",
              engagementLevel: "tenable",
            },
            categories: [{ id: "cat_1", label: "Business", role: "primary", blockCount: 3 }],
            preview: [
              {
                dayKey: "2026-04-19",
                dayLabel: "DIM 19/04",
                slotLabel: "08:00 - 08:25",
                categoryId: "cat_1",
                categoryLabel: "Business",
                title: "Bloc profond",
                minutes: 25,
              },
            ],
            todayPreview: [
              {
                dayKey: "2026-04-19",
                dayLabel: "DIM 19/04",
                slotLabel: "08:00 - 08:25",
                categoryId: "cat_1",
                categoryLabel: "Business",
                title: "Bloc profond",
                minutes: 25,
              },
            ],
            rationale: {
              whyFit: "Plan sobre.",
              capacityFit: "Charge stable.",
              constraintFit: "Contraintes respectées.",
            },
            commitDraft: {
              version: 1,
              categories: [{ id: "cat_1", templateId: "business", name: "Business", color: "#0ea5e9", order: 0 }],
              goals: [{ id: "goal_1", categoryId: "cat_1", title: "Relancer le projet", type: "OUTCOME", order: 0 }],
              actions: [
                {
                  id: "action_1",
                  categoryId: "cat_1",
                  parentGoalId: "goal_1",
                  title: "Bloc profond",
                  type: "PROCESS",
                  order: 0,
                  repeat: "weekly",
                  daysOfWeek: [1, 3, 5],
                  timeMode: "FIXED",
                  startTime: "08:00",
                  timeSlots: ["08:00"],
                  durationMinutes: 25,
                  sessionMinutes: 25,
                },
              ],
              occurrences: [
                { id: "occ_legacy", goalId: "action_1", date: "2026-04-19", start: "08:00", durationMinutes: 25, status: "planned" },
              ],
            },
          },
        ],
      },
    });

    expect(normalized.generatedPlans?.plans[0]?.commitDraft?.occurrences[0]?.actionId).toBe("action_1");
  });

  it("normalizes commit metadata and local fallback plans with a real commitDraft", () => {
    const normalized = normalizeFirstRunV1({
      status: "discovery",
      commitV1: {
        status: "applied",
        commitKey: "commit-1",
        selectedPlanId: "tenable",
        selectedPlanType: "tenable",
        selectedPlanSource: "local_fallback",
        appliedAt: "2026-04-29T08:00:00.000Z",
        createdCategoryIds: ["cat_1", "cat_1"],
        reusedCategoryIds: ["cat_existing"],
        createdGoalIds: ["goal_1"],
        createdActionIds: ["action_1"],
        createdOccurrenceIds: ["occ_1"],
      },
    });

    expect(normalized.commitV1).toMatchObject({
      status: "applied",
      commitKey: "commit-1",
      selectedPlanSource: "local_fallback",
      createdCategoryIds: ["cat_1"],
      reusedCategoryIds: ["cat_existing"],
    });

    const fallback = buildLocalStubGeneratedPlans(
      {
        whyText: "Reprendre le contrôle",
        primaryGoal: "Relancer le projet",
        currentCapacity: "stable",
        priorityCategoryIds: ["business"],
        preferredWindows: [{ id: "p1", daysOfWeek: [3], startTime: "08:00", endTime: "10:00", label: "Matin" }],
      },
      new Date(2026, 3, 29, 10, 0, 0, 0)
    );

    expect(fallback.source).toBe("local_fallback");
    expect(fallback.plans).toHaveLength(2);
    expect(fallback.plans[0].commitDraft.categories.length).toBeGreaterThan(0);
    expect(fallback.plans[0].commitDraft.goals.length).toBeGreaterThan(0);
    expect(fallback.plans[0].commitDraft.actions.length).toBeGreaterThan(0);
    expect(fallback.plans[0].commitDraft.occurrences.some((occurrence) => occurrence.date === "2026-04-29")).toBe(true);
  });

  it("builds an instant deterministic recommended plan with Today and 7-day structure", () => {
    const generated = buildDeterministicRecommendedGeneratedPlans(
      {
        whyText: "Reprendre le contrôle sans attendre la motivation.",
        primaryGoal: "Relancer le projet",
        currentCapacity: "stable",
        priorityCategoryIds: ["business", "productivity"],
        preferredWindows: [{ id: "p1", daysOfWeek: [3], startTime: "08:00", endTime: "10:00", label: "Matin" }],
        unavailableWindows: [{ id: "u1", daysOfWeek: [3], startTime: "12:00", endTime: "18:00", label: "Travail" }],
        locale: "fr-FR",
        timezone: "Europe/Paris",
        referenceDateKey: "2026-04-29",
      },
      { inputHash: "hash-recommended", now: new Date(2026, 3, 29, 10, 0, 0, 0) }
    );

    const recommended = generated.plans[0];
    expect(generated.version).toBe(3);
    expect(generated.source).toBe("deterministic_starter");
    expect(generated.inputHash).toBe("hash-recommended");
    expect(generated.plans).toHaveLength(1);
    expect(recommended.id).toBe("recommended");
    expect(recommended.title).toBe("Plan recommandé");
    expect(recommended.summary).not.toMatch(/fallback|IA génér/i);
    expect(recommended.commitDraft.categories.length).toBeGreaterThan(0);
    expect(recommended.commitDraft.goals.length).toBeGreaterThan(0);
    expect(recommended.commitDraft.actions.length).toBeGreaterThanOrEqual(2);
    expect(recommended.commitDraft.occurrences.some((occurrence) => occurrence.date === "2026-04-29")).toBe(true);
    expect(recommended.todayPreview.length).toBeGreaterThan(0);
    expect(recommended.weekSchedule).toHaveLength(7);
    expect(generated.ai.status).toBe("locked");
    expect(generated.ai.missingInformation).toContain("Horaires précis");
  });

  it("turns AI starter hints into a concrete v3 recommended plan without letting AI build commitDraft", () => {
    const generated = buildAiAssistedRecommendedGeneratedPlans(
      {
        whyText: "Je veux publier mon application avant juin. Améliorer ma routine sportive. Arrêter de fumer.",
        primaryGoal: "Finir l’application",
        currentCapacity: "stable",
        priorityCategoryIds: ["business", "health", "personal"],
        unavailableWindows: [{ id: "u1", daysOfWeek: [1, 2, 3, 4, 5], startTime: "09:30", endTime: "17:30", label: "Work" }],
        locale: "fr-FR",
        timezone: "Europe/Paris",
        referenceDateKey: "2026-04-29",
      },
      {
        version: 1,
        source: "ai_starter_hints",
        inputHash: "hash-ai-hints",
        generatedAt: "2026-04-29T08:00:00.000Z",
        planStrategy: {
          planTitle: "Plan recommandé",
          summary: "Finir le parcours critique sans lâcher la santé.",
          weekGoal: "Finaliser l’application et tester le parcours first-run cette semaine.",
          weekBenefit: "Une app plus proche de la publication, avec un rythme sport et anti-cigarette réaliste.",
          reasoningBullets: ["Le plan cible le parcours app avant juin.", "Les blocs restent hors horaires de travail."],
        },
        actionHints: [
          {
            id: "finish-first-access",
            categoryId: "business",
            title: "Finaliser le parcours First Access",
            purpose: "Terminer le parcours d’entrée qui débloque la publication.",
            outcomeLink: "Finir l’application",
            suggestedDurationMinutes: 45,
            cadence: "3x",
            priority: 5,
            preferredWindowTag: "morning",
            avoidWindowTags: ["work"],
            todayCandidate: true,
          },
          {
            id: "test-signup-first-run",
            categoryId: "business",
            title: "Tester inscription + first-run complet",
            purpose: "Valider le chemin critique utilisateur.",
            outcomeLink: "Finir l’application",
            suggestedDurationMinutes: 30,
            cadence: "twice",
            priority: 4,
            preferredWindowTag: "evening",
            avoidWindowTags: ["work"],
            todayCandidate: false,
          },
          {
            id: "sport-light",
            categoryId: "health",
            title: "Séance sport légère",
            purpose: "Relancer la routine sportive sans casser l’énergie.",
            outcomeLink: "Routine sportive",
            suggestedDurationMinutes: 25,
            cadence: "3x",
            priority: 3,
            preferredWindowTag: "evening",
            avoidWindowTags: ["work"],
            todayCandidate: false,
          },
        ],
        riskRituals: [
          {
            categoryId: "personal",
            title: "Revue anti-cigarette",
            durationMinutes: 5,
            trigger: "Envie de fumer",
            purpose: "Noter le déclencheur et choisir une action de remplacement.",
          },
        ],
        ai: { status: "succeeded", missingInformation: [] },
      },
      { inputHash: "hash-ai-hints", now: new Date(2026, 3, 29, 8, 0, 0, 0) }
    );

    const recommended = generated.plans[0];
    const actionTitles = recommended.commitDraft.actions.map((action) => action.title);
    expect(generated.source).toBe("ai_assisted_starter");
    expect(generated.ai.status).toBe("succeeded");
    expect(recommended.summary).toContain("Finir le parcours critique");
    expect(actionTitles).toContain("Finaliser le parcours First Access");
    expect(actionTitles).toContain("Tester inscription + first-run complet");
    expect(actionTitles).toContain("Séance sport légère");
    expect(actionTitles).toContain("Revue anti-cigarette");
    expect(actionTitles).not.toContain("Focus profond");
    expect(actionTitles).not.toContain("Mouvement");
    expect(recommended.commitDraft.occurrences.length).toBeGreaterThan(0);
    expect(recommended.commitDraft.occurrences.every((occurrence) => occurrence.start < "09:30" || occurrence.start >= "17:30")).toBe(true);
    expect(recommended.todayPreview.length).toBeGreaterThan(0);
    expect(recommended.weekSchedule).toHaveLength(7);
  });

  it("repairs vague starter hint titles before building the recommended commitDraft", () => {
    const generated = buildAiAssistedRecommendedGeneratedPlans(
      {
        whyText: "Je veux publier mon application avant juin et reprendre le sport.",
        primaryGoal: "Finir l’application",
        currentCapacity: "stable",
        priorityCategoryIds: ["business", "health"],
        locale: "fr-FR",
        timezone: "Europe/Paris",
        referenceDateKey: "2026-04-29",
      },
      {
        planStrategy: {
          summary: "Plan concret.",
          weekGoal: "Finir l’application.",
          weekBenefit: "Publication plus proche.",
          reasoningBullets: ["Actions réparées."],
        },
        actionHints: [
          {
            id: "generic-focus",
            categoryId: "business",
            title: "Focus profond",
            purpose: "Avancer.",
            suggestedDurationMinutes: 30,
            cadence: "3x",
            priority: 5,
            preferredWindowTag: "morning",
            avoidWindowTags: [],
            todayCandidate: true,
          },
          {
            id: "generic-move",
            categoryId: "health",
            title: "Mouvement",
            purpose: "Bouger.",
            suggestedDurationMinutes: 25,
            cadence: "twice",
            priority: 3,
            preferredWindowTag: "evening",
            avoidWindowTags: [],
            todayCandidate: false,
          },
        ],
        riskRituals: [],
      },
      { inputHash: "hash-vague", now: new Date(2026, 3, 29, 8, 0, 0, 0) }
    );

    const actionTitles = generated.plans[0].commitDraft.actions.map((action) => action.title);
    expect(actionTitles).toContain("Finaliser l’application");
    expect(actionTitles).toContain("Séance sport légère");
    expect(actionTitles).not.toContain("Focus profond");
    expect(actionTitles).not.toContain("Mouvement");
  });
});
