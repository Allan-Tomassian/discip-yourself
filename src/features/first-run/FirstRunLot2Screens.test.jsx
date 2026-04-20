import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import FirstRunCommitScreen from "./FirstRunCommitScreen";
import FirstRunCompareScreen from "./FirstRunCompareScreen";
import FirstRunDiscoveryScreen from "./FirstRunDiscoveryScreen";
import FirstRunGenerateScreen from "./FirstRunGenerateScreen";
import FirstRunIntroScreen from "./FirstRunIntroScreen";
import FirstRunSignalsScreen from "./FirstRunSignalsScreen";
import FirstRunWhyScreen from "./FirstRunWhyScreen";

describe("First-run lot 2 screens", () => {
  it("renders the intro as a short welcome screen with the new visible progression", () => {
    const html = renderToStaticMarkup(
      <FirstRunIntroScreen data={{ profile: { username: "allan" } }} onStart={() => {}} />
    );

    expect(html).toContain("Premiers pas");
    expect(html).toContain("1/5");
    expect(html).toContain("Bienvenue, allan");
    expect(html).toContain("On pose l’essentiel pour préparer tes deux premiers plans.");
    expect(html).toContain("Ton pourquoi");
    expect(html).toContain("Tes signaux réels");
    expect(html).toContain("Tes 2 plans");
    expect(html).not.toContain("On prépare ta première vraie semaine");
    expect(html).not.toContain("Deux minutes pour poser ton pourquoi");
  });

  it("renders why with shorter wording and a single honest helper", () => {
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

    expect(html).toContain("Premiers pas");
    expect(html).toContain("2/5");
    expect(html).toContain("Pourquoi maintenant ?");
    expect(html).toContain("Quelques mots suffisent pour dire ce qui compte vraiment pour toi.");
    expect(html).toContain("Pas besoin d’écrire beaucoup. Sois simplement honnête.");
    expect(html).toContain("Ex. reprendre le contrôle de mes semaines et relancer mon projet");
    expect(html).not.toContain("Pourquoi veux-tu te discipliner maintenant ?");
    expect(html).not.toContain("Ce texte sert de point de départ");
  });

  it("renders signals with quieter copy and without the repeated category helper text", () => {
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

    expect(html).toContain("Premiers pas");
    expect(html).toContain("3/5");
    expect(html).toContain("Quelques signaux utiles");
    expect(html).toContain("On cadre juste ce qu’il faut pour préparer deux plans crédibles.");
    expect(html).toContain("Objectif principal");
    expect(html).toContain("Ex. remettre mon projet en mouvement");
    expect(html).toContain("Le niveau de charge qui te paraît réaliste maintenant.");
    expect(html).toContain("Choisis jusqu’à 3 domaines à faire avancer d’abord.");
    expect(html).toContain("Aucune pour l’instant.");
    expect(html).toContain("Ajoute-en un si tu en as déjà un en tête.");
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
    expect(html).toContain("--categoryUiBorder");
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

    expect(html.indexOf("Objectif principal")).toBeLessThan(html.indexOf("Capacité actuelle"));
    expect(html.indexOf("Capacité actuelle")).toBeLessThan(html.indexOf("Catégories prioritaires"));
    expect(html.indexOf("Catégories prioritaires")).toBeLessThan(html.indexOf("Indisponibilités"));
    expect(html.indexOf("Indisponibilités")).toBeLessThan(html.indexOf("Créneaux favorables"));
    expect(html).toContain("Repère");
    expect(html).toContain("Début");
    expect(html).toContain("Fin");
    expect(html).toContain("Ajouter une indisponibilité");
  });

  it("maps visible progression to 4/5 and 5/5, then hides it after compare", () => {
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
      <FirstRunCommitScreen data={{}} selectedPlan={null} onBack={() => {}} onContinue={() => {}} />
    );
    const discoveryHtml = renderToStaticMarkup(
      <FirstRunDiscoveryScreen data={{}} onComplete={() => {}} />
    );

    expect(generateHtml).toContain("4/5");
    expect(compareHtml).toContain("5/5");
    expect(commitHtml).not.toContain("6/7");
    expect(discoveryHtml).not.toContain("7/7");
  });
});
