import React from "react";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import FirstRunCommitScreen from "./FirstRunCommitScreen";
import FirstRunCompareScreen from "./FirstRunCompareScreen";
import FirstRunDiscoveryScreen from "./FirstRunDiscoveryScreen";
import FirstRunGenerateScreen from "./FirstRunGenerateScreen";
import FirstRunIntroScreen from "./FirstRunIntroScreen";
import FirstRunSignalsScreen from "./FirstRunSignalsScreen";
import FirstRunWhyScreen from "./FirstRunWhyScreen";
import {
  FIRST_RUN_WHY_INSPIRATION_CHIPS,
  getFirstRunWhyAiCta,
  getFirstRunWhyAiMode,
  resolveFirstRunWhySuggestionText,
} from "./firstRunWhyAiAssistantModel";

describe("First-run narrative screens", () => {
  it("keeps the first-run visual layer scoped away from Today and protected engines", () => {
    const files = [
      "FirstRunCommandSurface.jsx",
      "FirstRunNarrativeBackdrop.jsx",
      "FirstRunProgressRail.jsx",
      "FirstRunIntroScreen.jsx",
      "FirstRunWhyScreen.jsx",
      "FirstRunSignalsScreen.jsx",
      "firstRun.css",
    ];
    const sources = files.map((file) => readFileSync(new URL(`./${file}`, import.meta.url), "utf8"));
    const joined = sources.join("\n");
    const cssSource = readFileSync(new URL("./firstRun.css", import.meta.url), "utf8");
    const primaryButtonRule = cssSource.match(/\.firstRunNarrativeScreen \.gateButton--primary[\s\S]*?\}/)?.[0] || "";

    expect(joined).not.toContain("features/today");
    expect(joined).not.toContain("components/today");
    expect(joined).not.toContain("todayDataAdapter");
    expect(joined).not.toMatch(/from\s+["'][^"']*firstRunCommit/i);
    expect(joined).not.toMatch(/from\s+["'][^"']*aiFirstRunClient/i);
    expect(primaryButtonRule).not.toMatch(/#(?:7c3aed|8b5cf6|9333ea|a855f7|c084fc)|139,\s*92,\s*246|first-run-ai/i);
  });

  it("renders the intro as a premium system-building entry screen", () => {
    const html = renderToStaticMarkup(
      <FirstRunIntroScreen data={{ profile: { username: "allan" } }} onStart={() => {}} />
    );

    expect(html).toContain("Progression first-run");
    expect(html).toContain("Intro");
    expect(html).toContain("Pourquoi");
    expect(html).toContain("Signaux");
    expect(html).toContain("Tu es ici pour");
    expect(html).toContain("reprendre le contrôle.");
    expect(html).toContain("Pas pour être motivé.");
    expect(html).toContain("Pour construire une discipline qui tient.");
    expect(html).toContain("Procrastination");
    expect(html).toContain("Objectifs flous");
    expect(html).toContain("Exécution");
    expect(html).toContain("firstRunAccentWord");
    expect(html).toContain("système");
    expect(html).toContain("devient ton avantage injuste.");
    expect(html).not.toContain("Bienvenue, allan");
    expect(html).not.toContain("On prépare ta première vraie semaine");
    expect(html).not.toContain("Deux minutes pour poser ton pourquoi");
  });

  it("renders why with the corrected system-building language and preserved input", () => {
    const html = renderToStaticMarkup(
      <FirstRunWhyScreen
        data={{}}
        value=""
        error=""
        onChange={() => {}}
        onBack={() => {}}
        onContinue={() => {}}
      />
    );

    expect(html).toContain("Pourquoi veux-tu créer ton système ?");
    expect(html).toContain("Rappelle-toi ce que tu veux reprendre en main.");
    expect(html).toContain("C’est cette raison qui tiendra quand la motivation disparaît.");
    expect(html).toContain("TA RAISON PROFONDE");
    expect(html).toContain("Écris pourquoi tu veux construire ce système...");
    expect(html).toContain("0 / 1200");
    expect(html).toContain("Ton système doit servir une vraie raison.");
    expect(html).toContain("La motivation baisse. Une raison claire reste.");
    expect(html).toContain("M’aider à formuler");
    expect(html).not.toContain("Assistance IA");
    expect(html).not.toContain("Utiliser cette version");
    FIRST_RUN_WHY_INSPIRATION_CHIPS.forEach((chip) => {
      expect(html).not.toContain(chip.label);
    });
    expect(html).not.toContain("Pourquoi veux-tu te discipliner maintenant ?");
    expect(html).not.toContain("changer de vie");
    expect(html).not.toContain("Ce texte sert de point de départ");
  });

  it("frames the why AI unavailable state as an intentional manual fallback", () => {
    const source = readFileSync(new URL("./FirstRunWhyAiAssistant.jsx", import.meta.url), "utf8");

    expect(source).toContain(
      "Aide IA indisponible pour l’instant. Tu peux continuer en mode manuel : tes réponses suffisent pour générer un plan."
    );
    expect(source).not.toContain("L’IA n’a pas répondu. Tu peux continuer manuellement.");
  });

  it("switches the why AI helper between inspiration and clarification without changing readiness", () => {
    expect(getFirstRunWhyAiMode("")).toBe("inspiration");
    expect(getFirstRunWhyAiCta("")).toBe("M’aider à formuler");
    expect(getFirstRunWhyAiMode("Je veux publier mon application avant juin.")).toBe("clarify");
    expect(getFirstRunWhyAiCta("Je veux publier mon application avant juin.")).toBe("Clarifier avec l’IA");
    expect(
      resolveFirstRunWhySuggestionText({
        clarification: {
          clarifiedWhy: "Je veux publier mon application avant juin avec une discipline réaliste.",
        },
      })
    ).toBe("Je veux publier mon application avant juin avec une discipline réaliste.");
  });

  it("renders the why AI clarification CTA for existing rough text", () => {
    const html = renderToStaticMarkup(
      <FirstRunWhyScreen
        data={{}}
        value="Je veux publier mon application avant juin. Améliorer ma routine sportive. Arrêter de fumer."
        error=""
        onChange={() => {}}
        onBack={() => {}}
        onContinue={() => {}}
      />
    );

    expect(html).toContain("Clarifier avec l’IA");
    expect(html).not.toContain("Garde ton intention. L’IA aide seulement à la rendre plus nette.");
    expect(html).not.toContain("Utiliser cette version");
  });

  it("renders signals as a command-signal board while keeping required fields visible", () => {
    const html = renderToStaticMarkup(
      <FirstRunSignalsScreen
        data={{}}
        draftAnswers={{
          primaryGoal: "",
          currentCapacity: null,
          priorityCategoryIds: [],
          unavailableWindows: [],
          preferredWindows: [],
        }}
        canContinue={false}
        onBack={() => {}}
        onContinue={() => {}}
        onPrimaryGoalChange={() => {}}
        onCapacityChange={() => {}}
        onTogglePriorityCategory={() => {}}
        onAddUnavailableWindow={() => {}}
        onPatchUnavailableWindow={() => {}}
        onRemoveUnavailableWindow={() => {}}
        onAddPreferredWindow={() => {}}
        onPatchPreferredWindow={() => {}}
        onRemovePreferredWindow={() => {}}
      />
    );

    expect(html).toContain("Construis ton premier système d’exécution.");
    expect(html).toContain("Donne juste les signaux nécessaires : cap, capacité, domaines et créneaux.");
    expect(html).toContain("Résultat prioritaire");
    expect(html).toContain("Ce que ton système doit faire avancer en premier.");
    expect(html).toContain("Ex. remettre mon projet en mouvement");
    expect(html).toContain("Capacité actuelle");
    expect(html).toContain("Domaines à soutenir");
    expect(html).toContain("Créneaux et contraintes");
    expect(html).toContain("Contraintes horaires");
    expect(html).toContain("Créneaux favorables");
    expect(html).toContain("Aucune pour l’instant.");
    expect(html).toContain("Ajoute-en un si tu en as déjà un en tête.");
    expect(html).toContain("Générer les plans");
    expect(html).not.toContain("Quels sont tes plus grands freins");
    expect(html).not.toContain("plus grands freins");
    expect(html).not.toContain("Cap principal");
    expect(html).not.toContain("Zones à reprendre en main");
    expect(html).not.toContain("Contraintes &amp; créneaux");
    expect(html).not.toContain("Quelques signaux essentiels");
    expect(html).not.toContain("On garde l&#x27;élan");
    expect(html).not.toContain("Utilisé pour structurer la semaine proposée.");
  });

  it("renders category cards with visible selection order and category accent vars", () => {
    const html = renderToStaticMarkup(
      <FirstRunSignalsScreen
        data={{}}
        draftAnswers={{
          primaryGoal: "Relancer le projet",
          currentCapacity: "stable",
          priorityCategoryIds: ["health", "finance"],
          unavailableWindows: [],
          preferredWindows: [],
        }}
        canContinue
        onBack={() => {}}
        onContinue={() => {}}
        onPrimaryGoalChange={() => {}}
        onCapacityChange={() => {}}
        onTogglePriorityCategory={() => {}}
        onAddUnavailableWindow={() => {}}
        onPatchUnavailableWindow={() => {}}
        onRemoveUnavailableWindow={() => {}}
        onAddPreferredWindow={() => {}}
        onPatchPreferredWindow={() => {}}
        onRemovePreferredWindow={() => {}}
      />
    );

    expect(html).toContain("#1");
    expect(html).toContain("#2");
    expect(html).toContain("firstRunCategoryCard is-selected");
    expect(html).toContain("firstRunCategoryCard is-idle");
    expect(html).toContain("Projet, revenus, exécution.");
    expect(html).not.toContain("--categoryUiBorder");
  });

  it("keeps signals block order and compact window controls", () => {
    const html = renderToStaticMarkup(
      <FirstRunSignalsScreen
        data={{}}
        draftAnswers={{
          primaryGoal: "",
          currentCapacity: "stable",
          priorityCategoryIds: ["health"],
          unavailableWindows: [
            {
              id: "u1",
              label: "Travail",
              startTime: "09:00",
              endTime: "18:00",
              daysOfWeek: [1, 2, 3],
            },
          ],
          preferredWindows: [],
        }}
        canContinue={false}
        onBack={() => {}}
        onContinue={() => {}}
        onPrimaryGoalChange={() => {}}
        onCapacityChange={() => {}}
        onTogglePriorityCategory={() => {}}
        onAddUnavailableWindow={() => {}}
        onPatchUnavailableWindow={() => {}}
        onRemoveUnavailableWindow={() => {}}
        onAddPreferredWindow={() => {}}
        onPatchPreferredWindow={() => {}}
        onRemovePreferredWindow={() => {}}
      />
    );

    expect(html.indexOf("Résultat prioritaire")).toBeLessThan(html.indexOf("Capacité actuelle"));
    expect(html.indexOf("Capacité actuelle")).toBeLessThan(html.indexOf("Domaines à soutenir"));
    expect(html.indexOf("Domaines à soutenir")).toBeLessThan(html.indexOf("Contraintes horaires"));
    expect(html.indexOf("Contraintes horaires")).toBeLessThan(html.indexOf("Créneaux favorables"));
    expect(html).toContain("Repère");
    expect(html).toContain("Début");
    expect(html).toContain("Fin");
    expect(html).toContain("Ajouter une indisponibilité");
  });

  it("maps activation progression to generate, compare, and commit", () => {
    const generateHtml = renderToStaticMarkup(
      <FirstRunGenerateScreen data={{}} isLoading error={null} goalLabel="" onBack={() => {}} onRetry={() => {}} />
    );
    const compareHtml = renderToStaticMarkup(
      <FirstRunCompareScreen
        data={{}}
        generatedPlans={{
          plans: [
            {
              id: "tenable",
              title: "Plan tenable",
              summary: "Version respirable",
              comparisonMetrics: { weeklyMinutes: 120, totalBlocks: 3, recoverySlots: 1, dailyDensity: "respirable" },
              categories: [],
              rationale: {},
              preview: [],
              todayPreview: [],
            },
          ],
        }}
        selectedPlanId="tenable"
        onBack={() => {}}
        onSelectPlan={() => {}}
        onContinue={() => {}}
      />
    );
    const commitHtml = renderToStaticMarkup(
      <FirstRunCommitScreen
        data={{}}
        selectedPlan={{
          id: "tenable",
          title: "Plan tenable",
          summary: "Version respirable",
          preview: [],
          commitDraft: {
            categories: [{ id: "cat_business" }],
            goals: [{ id: "goal_business" }],
            actions: [{ id: "action_business" }],
            occurrences: [{ id: "occ_1", date: "2026-04-19" }],
          },
        }}
        onBack={() => {}}
        onContinue={() => {}}
      />
    );
    const discoveryHtml = renderToStaticMarkup(<FirstRunDiscoveryScreen data={{}} onComplete={() => {}} />);

    expect(generateHtml).toContain("Générer");
    expect(generateHtml).toContain("Préparer");
    expect(compareHtml).toContain("Plan");
    expect(compareHtml).toContain("Choisis ton plan");
    expect(commitHtml).toContain("Activer");
    expect(commitHtml).toContain("Prêt à activer ton plan");
    expect(commitHtml).toContain("Activer mon plan");
    expect(commitHtml).not.toContain("ne crée pas encore le vrai système produit");
    expect(discoveryHtml).toContain("Ton système est prêt");
    expect(discoveryHtml).toContain("Ton premier bloc est planifié. Tu peux commencer depuis Home.");
    expect(discoveryHtml).toContain("Aller à Home");
    expect(discoveryHtml).not.toContain("Découverte");
  });

  it("renders discovery as a user-facing confidence screen with first block details", () => {
    const html = renderToStaticMarkup(
      <FirstRunDiscoveryScreen
        data={{
          ui: {
            firstRunV1: {
              commitV1: {
                status: "applied",
                createdOccurrenceIds: ["occ_today"],
              },
            },
          },
          goals: [{ id: "action_deep", title: "Finaliser le parcours First Access", durationMinutes: 30 }],
          occurrences: [
            {
              id: "occ_today",
              goalId: "action_deep",
              date: "2026-04-29",
              start: "09:00",
              durationMinutes: 30,
              status: "planned",
            },
          ],
        }}
        onComplete={() => {}}
      />
    );

    expect(html).toContain("Ton système est prêt");
    expect(html).toContain("Objectif créé");
    expect(html).toContain("Première action définie");
    expect(html).toContain("Premier bloc planifié");
    expect(html).toContain("Premier bloc");
    expect(html).toContain("Finaliser le parcours First Access");
    expect(html).toContain("29/04/2026 · 09:00 · 30 min");
    expect(html).not.toMatch(/\b(flow|peuplement|routing)\b/i);
    expect(html).not.toContain("lot suivant");
    expect(html).not.toContain("state machine");
  });

  it("renders v3 recommended plan review as one plan with a locked AI precision card", () => {
    const html = renderToStaticMarkup(
      <FirstRunCompareScreen
        data={{}}
        generatedPlans={{
          version: 3,
          source: "deterministic_starter",
          plans: [
            {
              id: "recommended",
              variant: "recommended",
              title: "Plan recommandé",
              summary: "Une première semaine concrète.",
              weekGoal: "Relancer mon projet principal",
              weekBenefit: "Créer une preuve d’exécution dès aujourd’hui.",
              comparisonMetrics: { weeklyMinutes: 165, totalBlocks: 6, activeDays: 4, recoverySlots: 3, dailyDensity: "respirable" },
              categories: [{ id: "recommended_business", label: "Business", role: "primary", blockCount: 4 }],
              preview: [
                {
                  dayKey: "2026-04-19",
                  dayLabel: "DIM 19/04",
                  slotLabel: "09:00 - 09:30",
                  categoryId: "recommended_business",
                  categoryLabel: "Business",
                  title: "Focus profond",
                  minutes: 30,
                },
              ],
              todayPreview: [
                {
                  dayKey: "2026-04-19",
                  dayLabel: "DIM 19/04",
                  slotLabel: "09:00 - 09:30",
                  categoryId: "recommended_business",
                  categoryLabel: "Business",
                  title: "Focus profond",
                  minutes: 30,
                },
              ],
              weekSchedule: [
                { dayKey: "2026-04-19", dayLabel: "DIM", blockCount: 2, totalMinutes: 45, loadLabel: "2 blocs", headline: "Focus profond" },
                { dayKey: "2026-04-20", dayLabel: "LUN", blockCount: 1, totalMinutes: 30, loadLabel: "1 bloc", headline: "Focus profond" },
              ],
              rationale: {
                whyFit: "Ton pourquoi sert de point d’ancrage.",
                capacityFit: "Charge réaliste.",
                constraintFit: "Contraintes évitées autant que possible.",
              },
              commitDraft: {
                categories: [{ id: "recommended_business", templateId: "business", name: "Business", color: "#0ea5e9", order: 0 }],
                goals: [{ id: "recommended_goal", categoryId: "recommended_business", title: "Relancer mon projet principal", type: "OUTCOME", order: 0 }],
                actions: [
                  {
                    id: "recommended_action_focus",
                    categoryId: "recommended_business",
                    parentGoalId: "recommended_goal",
                    title: "Focus profond",
                    type: "PROCESS",
                    repeat: "weekly",
                    daysOfWeek: [1],
                    timeMode: "FIXED",
                    startTime: "09:00",
                    timeSlots: ["09:00"],
                    durationMinutes: 30,
                    sessionMinutes: 30,
                  },
                ],
                occurrences: [{ id: "recommended_occ", actionId: "recommended_action_focus", date: "2026-04-19", start: "09:00", durationMinutes: 30, status: "planned" }],
              },
            },
          ],
          ai: {
            status: "locked",
            missingInformation: ["Horaires précis", "Niveau d’énergie", "Habitudes actuelles", "Contraintes fixes"],
          },
        }}
        selectedPlanId="recommended"
        onBack={() => {}}
        onSelectPlan={() => {}}
        onContinue={() => {}}
      />
    );

    expect(html).toContain("PLAN RECOMMANDÉ");
    expect(html).toContain("Ton plan recommandé est prêt.");
    expect(html).toContain("Plan local construit à partir de tes réponses.");
    expect(html).toContain("Objectif principal");
    expect(html).toContain("Premier bloc Today");
    expect(html).toContain("Structure 7 jours");
    expect(html).toContain("Actions prévues");
    expect(html).toContain("Pourquoi ce plan est réaliste");
    expect(html).toContain("Affinage IA optionnel");
    expect(html).toContain("Verrouillé");
    expect(html).toContain("Ton plan local reste activable.");
    expect(html).toContain("Affiner plus tard");
    expect(html).toContain("disabled=\"\"");
    expect(html).not.toContain("firstRunPlanDecisionCard");
    expect(html).not.toContain("local fallback");
    expect(html).not.toContain("Ton système est généré localement.");
    expect(html).not.toContain("Plan plus précis avec IA");
  });

  it("labels recommended plans with an intentional local fallback when AI refinement fails", () => {
    const html = renderToStaticMarkup(
      <FirstRunCompareScreen
        data={{}}
        generatedPlans={{
          version: 3,
          source: "deterministic_starter",
          plans: [
            {
              id: "recommended",
              variant: "recommended",
              title: "Plan recommandé",
              summary: "Une première semaine concrète.",
              weekGoal: "Relancer mon projet principal",
              comparisonMetrics: {},
              categories: [],
              preview: [],
              todayPreview: [],
              weekSchedule: [],
              rationale: {},
              commitDraft: { categories: [], goals: [], actions: [], occurrences: [] },
            },
          ],
          ai: { status: "failed", errorCode: "NETWORK_ERROR", missingInformation: [] },
        }}
        selectedPlanId="recommended"
        onBack={() => {}}
        onSelectPlan={() => {}}
        onContinue={() => {}}
      />
    );

    expect(html).toContain("Aide IA indisponible : plan local fiable généré avec tes réponses.");
    expect(html).not.toContain("L’IA n’a pas répondu");
    expect(html).not.toContain("Plan plus précis avec IA");
  });

  it("labels v3 AI-assisted recommended plans without switching back to two-card compare", () => {
    const html = renderToStaticMarkup(
      <FirstRunCompareScreen
        data={{}}
        generatedPlans={{
          version: 3,
          source: "ai_assisted_starter",
          plans: [
            {
              id: "recommended",
              variant: "recommended",
              title: "Plan recommandé",
              summary: "Une première semaine concrète.",
              weekGoal: "Finaliser l’application",
              weekBenefit: "Premier parcours prêt.",
              comparisonMetrics: { weeklyMinutes: 165, totalBlocks: 6, activeDays: 4, recoverySlots: 3, dailyDensity: "respirable" },
              categories: [{ id: "recommended_business", label: "Business", role: "primary", blockCount: 4 }],
              preview: [
                {
                  dayKey: "2026-04-19",
                  dayLabel: "DIM 19/04",
                  slotLabel: "09:00 - 09:30",
                  categoryId: "recommended_business",
                  categoryLabel: "Business",
                  title: "Finaliser le parcours First Access",
                  minutes: 30,
                },
              ],
              todayPreview: [
                {
                  dayKey: "2026-04-19",
                  dayLabel: "DIM 19/04",
                  slotLabel: "09:00 - 09:30",
                  categoryId: "recommended_business",
                  categoryLabel: "Business",
                  title: "Finaliser le parcours First Access",
                  minutes: 30,
                },
              ],
              weekSchedule: [
                { dayKey: "2026-04-19", dayLabel: "DIM", blockCount: 1, totalMinutes: 30, loadLabel: "1 bloc", headline: "Finaliser le parcours First Access" },
              ],
              rationale: {
                whyFit: "Ton pourquoi sert de point d’ancrage.",
                capacityFit: "Charge réaliste.",
                constraintFit: "Contraintes évitées autant que possible.",
              },
              commitDraft: {
                categories: [{ id: "recommended_business", templateId: "business", name: "Business", color: "#0ea5e9", order: 0 }],
                goals: [{ id: "recommended_goal", categoryId: "recommended_business", title: "Finaliser l’application", type: "OUTCOME", order: 0 }],
                actions: [
                  {
                    id: "recommended_action_focus",
                    categoryId: "recommended_business",
                    parentGoalId: "recommended_goal",
                    title: "Finaliser le parcours First Access",
                    type: "PROCESS",
                    repeat: "weekly",
                    daysOfWeek: [1],
                    timeMode: "FIXED",
                    startTime: "09:00",
                    timeSlots: ["09:00"],
                    durationMinutes: 30,
                    sessionMinutes: 30,
                  },
                ],
                occurrences: [{ id: "recommended_occ", actionId: "recommended_action_focus", date: "2026-04-19", start: "09:00", durationMinutes: 30, status: "planned" }],
              },
            },
          ],
          ai: { status: "succeeded", missingInformation: [] },
        }}
        selectedPlanId="recommended"
        onBack={() => {}}
        onSelectPlan={() => {}}
        onContinue={() => {}}
      />
    );

    expect(html).toContain("Plan affiné avec l’IA à partir de tes réponses.");
    expect(html).toContain("firstRunRecommendedSourceBadge--ai");
    expect(html).not.toContain("firstRunPlanDecisionCard");
  });

  it("labels local fallback compare mode without presenting it as AI-generated", () => {
    const html = renderToStaticMarkup(
      <FirstRunCompareScreen
        data={{}}
        generatedPlans={{
          source: "local_fallback",
          plans: [
            {
              id: "tenable",
              title: "Plan tenable",
              summary: "Version respirable",
              comparisonMetrics: { weeklyMinutes: 120, totalBlocks: 3, recoverySlots: 1, dailyDensity: "respirable" },
              categories: [],
              rationale: {},
              preview: [],
              todayPreview: [],
            },
          ],
        }}
        selectedPlanId="tenable"
        onBack={() => {}}
        onSelectPlan={() => {}}
        onContinue={() => {}}
      />
    );

    expect(html).toContain("Plan local");
    expect(html).toContain("Plan local construit à partir de tes réponses.");
    expect(html).not.toContain("généré par l’IA");
    expect(html).not.toContain("Ton système est généré localement.");
  });

  it("keeps commit failure on the commit screen with conservative copy", () => {
    const html = renderToStaticMarkup(
      <FirstRunCommitScreen
        data={{}}
        selectedPlan={{
          id: "tenable",
          title: "Plan tenable",
          summary: "Plan de départ",
          preview: [],
          variant: "tenable",
        }}
        errorCode="MISSING_COMMIT_ACTION"
        isApplying={false}
        onBack={() => {}}
        onContinue={() => {}}
      />
    );

    expect(html).toContain("Échec de l’activation");
    expect(html).toContain("Ton système n’a pas pu être activé. Tu peux relancer sans perdre tes réponses.");
    expect(html).toContain("Réessayer");
    expect(html).toContain("Vérifier la connexion");
    expect(html).toContain("Contacter le support");
    expect(html).not.toContain("Valider ce choix");
  });

  it("shows the applying activation state without exposing actions", () => {
    const html = renderToStaticMarkup(
      <FirstRunCommitScreen
        data={{}}
        selectedPlan={{
          id: "tenable",
          title: "Plan tenable",
          summary: "Plan de départ",
          preview: [],
          variant: "tenable",
        }}
        errorCode={null}
        isApplying
        onBack={() => {}}
        onContinue={() => {}}
      />
    );

    expect(html).toContain("Activation de ton système…");
    expect(html).toContain("Création des actions");
    expect(html).toContain("Organisation des 7 jours");
    expect(html).toContain("Préparation de Today");
    expect(html).toContain("Synchronisation");
    expect(html).toContain("Ne ferme pas l’app.");
    expect(html).toContain("Activation...");
  });
});
