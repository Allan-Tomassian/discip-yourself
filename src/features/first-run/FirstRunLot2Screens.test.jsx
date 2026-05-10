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

describe("First-run lot 2 screens", () => {
  it("keeps the lot 2 visual layer scoped away from Today and commit/generation engines", () => {
    const files = [
      "FirstRunCommandSurface.jsx",
      "FirstRunNarrativeBackdrop.jsx",
      "FirstRunProgressRail.jsx",
      "FirstRunIntroScreen.jsx",
      "FirstRunWhyScreen.jsx",
      "FirstRunSignalsScreen.jsx",
      "firstRun.css",
    ];
    const sources = files.map((file) =>
      readFileSync(new URL(`./${file}`, import.meta.url), "utf8")
    );
    const joined = sources.join("\n");

    expect(joined).not.toContain("features/today");
    expect(joined).not.toContain("components/today");
    expect(joined).not.toContain("todayDataAdapter");
    expect(joined).not.toContain("firstRunCommit");
    expect(joined).not.toContain("aiFirstRunClient");
    expect(joined).not.toMatch(/#(?:7c3aed|8b5cf6|9333ea|a855f7|c084fc)/i);
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
    expect(html).not.toContain("Pourquoi veux-tu te discipliner maintenant ?");
    expect(html).not.toContain("changer de vie");
    expect(html).not.toContain("Ce texte sert de point de départ");
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

    expect(html).toContain("Quels sont tes");
    expect(html).toContain("plus grands freins");
    expect(html).toContain("Sélectionne ce qui te correspond.");
    expect(html).toContain("On construira ton système autour de ça.");
    expect(html).toContain("Cap principal");
    expect(html).toContain("Ce que ton système doit faire avancer en premier.");
    expect(html).toContain("Ex. remettre mon projet en mouvement");
    expect(html).toContain("Capacité actuelle");
    expect(html).toContain("Zones à reprendre en main");
    expect(html).toContain("Contraintes horaires");
    expect(html).toContain("Créneaux favorables");
    expect(html).toContain("Aucune pour l’instant.");
    expect(html).toContain("Ajoute-en un si tu en as déjà un en tête.");
    expect(html).toContain("Générer les plans");
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

    expect(html.indexOf("Cap principal")).toBeLessThan(html.indexOf("Capacité actuelle"));
    expect(html.indexOf("Capacité actuelle")).toBeLessThan(html.indexOf("Zones à reprendre en main"));
    expect(html.indexOf("Zones à reprendre en main")).toBeLessThan(html.indexOf("Contraintes horaires"));
    expect(html.indexOf("Contraintes horaires")).toBeLessThan(html.indexOf("Créneaux favorables"));
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
    expect(commitHtml).toContain("On applique ton choix dans ton vrai système");
    expect(commitHtml).not.toContain("ne crée pas encore le vrai système produit");
    expect(commitHtml).not.toContain("6/7");
    expect(discoveryHtml).not.toContain("7/7");
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

    expect(html).toContain("Impossible d’appliquer ce plan pour le moment");
    expect(html).toContain("Valider ce choix");
  });
});
