import { describe, expect, it } from "vitest";
import {
  assessPreparedSessionRunbookQuality,
  buildSessionRunbookV1,
  deriveGuidedCurrentStep,
  normalizePreparedSessionRunbook,
  normalizeSessionBlueprintSnapshot,
  summarizeSessionRunbookPatch,
} from "./sessionRunbook";

function makeBlueprint(overrides = {}) {
  return {
    version: 1,
    protocolType: "sport",
    why: "activer ton énergie et tenir le rythme",
    firstStep: "commence par 3 min d’échauffement",
    ifBlocked: "fais la version courte",
    successDefinition: "séance tenue ou version courte assumée",
    estimatedMinutes: 20,
    ...overrides,
  };
}

describe("sessionRunbook", () => {
  it("normalizes a persisted blueprint snapshot for launch use", () => {
    expect(
      normalizeSessionBlueprintSnapshot({
        protocolType: "deep_work",
        why: "avancer sur un levier concret",
        firstStep: "ouvre la sous-partie exacte",
        ifBlocked: "réduis le scope",
        successDefinition: "une avancée visible existe",
        estimatedMinutes: 45,
      })
    ).toEqual({
      version: 1,
      protocolType: "deep_work",
      why: "avancer sur un levier concret",
      firstStep: "ouvre la sous-partie exacte",
      ifBlocked: "réduis le scope",
      successDefinition: "une avancée visible existe",
      estimatedMinutes: 45,
    });
  });

  it("builds a richer sport fallback runbook with objective, steps, and items", () => {
    const runbook = buildSessionRunbookV1({
      blueprintSnapshot: makeBlueprint(),
      occurrence: { id: "occ_1", goalId: "goal_1", date: "2026-04-10", durationMinutes: 20 },
      action: { id: "goal_1", title: "Séance de sport rapide de 20 minutes" },
      category: { id: "cat_sport", name: "Sport" },
    });

    expect(runbook).toMatchObject({
      version: 1,
      protocolType: "sport",
      occurrenceId: "occ_1",
      actionId: "goal_1",
      title: "Séance de sport rapide de 20 minutes",
      categoryName: "Sport",
      durationMinutes: 20,
      source: "deterministic_fallback",
      objective: {
        why: "activer ton énergie et tenir le rythme",
        successDefinition: "séance tenue ou version courte assumée",
      },
    });
    expect(runbook.steps.map((step) => step.label)).toEqual([
      "Échauffement",
      "Bloc principal",
      "Retour au calme",
    ]);
    expect(runbook.steps.reduce((sum, step) => sum + step.minutes, 0)).toBe(20);
    expect(runbook.steps[1].items.length).toBeGreaterThan(1);
    expect(runbook.steps.flatMap((step) => step.items).length).toBeGreaterThanOrEqual(6);
  });

  it("maps deep work blocks to opening, main block, and close", () => {
    const runbook = buildSessionRunbookV1({
      blueprintSnapshot: makeBlueprint({
        protocolType: "deep_work",
        why: "avancer sur un levier concret",
        firstStep: "ouvre la sous-partie exacte",
        ifBlocked: "réduis le scope",
        successDefinition: "une avancée visible existe",
        estimatedMinutes: 45,
      }),
      occurrence: { id: "occ_2", goalId: "goal_2", date: "2026-04-10", durationMinutes: 45 },
      action: { id: "goal_2", title: "Finaliser la landing page" },
      category: { id: "cat_business", name: "Business" },
    });

    expect(runbook.steps.map((step) => step.label)).toEqual(["Ouverture", "Bloc principal", "Clôture"]);
    expect(runbook.steps[1].minutes).toBeGreaterThan(runbook.steps[0].minutes);
  });

  it("normalizes a prepared v2 runbook only when density stays within bounds", () => {
    const prepared = normalizePreparedSessionRunbook({
      version: 2,
      protocolType: "deep_work",
      occurrenceId: "occ_3",
      actionId: "goal_3",
      dateKey: "2026-04-10",
      title: "Finaliser la landing page",
      categoryName: "Business",
      objective: {
        why: "sortir une version livrable",
        successDefinition: "une version publiable existe",
      },
      steps: [
        {
          label: "Ouverture",
          purpose: "rétablir le bon contexte",
          successCue: "point d’entrée clair",
          items: [
            { label: "Relire la zone utile", minutes: 2, guidance: "rouvre uniquement la partie exacte" },
            { label: "Fixer le point d’entrée", minutes: 1, guidance: "choisis le prochain sous-bloc" },
          ],
        },
        {
          label: "Bloc principal",
          purpose: "avancer sur le coeur du livrable",
          successCue: "un sous-livrable concret existe",
          items: [
            { label: "Premier passage", minutes: 8, guidance: "attaque le point le plus utile" },
            { label: "Passage critique", minutes: 10, guidance: "pousse jusqu’au vrai déblocage" },
            { label: "Trace exploitable", minutes: 4, guidance: "laisse quelque chose de réutilisable" },
          ],
        },
        {
          label: "Clôture",
          purpose: "préparer la reprise",
          successCue: "suite lisible",
          items: [
            { label: "Noter la reprise", minutes: 2, guidance: "écris la prochaine action" },
            { label: "Nettoyer le contexte", minutes: 1, guidance: "garde seulement l’essentiel" },
          ],
        },
      ],
    });

    expect(prepared).toMatchObject({
      version: 2,
      source: "ai_prepared",
      durationMinutes: 28,
    });
    expect(prepared.steps).toHaveLength(3);
    expect(prepared.steps[1].items).toHaveLength(3);
  });

  it("accepts a premium sport runbook only when the content is specific enough", () => {
    const quality = assessPreparedSessionRunbookQuality({
      preparedRunbook: {
        version: 2,
        protocolType: "sport",
        occurrenceId: "occ_4",
        actionId: "goal_4",
        dateKey: "2026-04-10",
        title: "Circuit jambes et gainage",
        categoryName: "Sport",
        objective: {
          why: "tenir un bloc cardio-force net",
          successDefinition: "le circuit est tenu sans casser la forme",
        },
        steps: [
          {
            label: "Mise en route",
            purpose: "préparer les appuis",
            successCue: "souffle posé",
            items: [
              {
                label: "Montées de genoux",
                minutes: 3,
                guidance: "alterne 30 sec dynamiques puis 30 sec plus calmes pour monter en température",
                successCue: "respiration stable",
              },
              {
                label: "Squats au poids du corps",
                minutes: 2,
                guidance: "fais 2 séries de 12 reps en gardant le buste haut",
                successCue: "genoux stables",
              },
            ],
          },
          {
            label: "Bloc force",
            purpose: "tenir le coeur utile",
            successCue: "gainage propre",
            items: [
              {
                label: "Fentes alternées",
                minutes: 4,
                guidance: "2 séries de 10 reps par jambe sans te précipiter",
                successCue: "appuis nets",
                restSec: 25,
              },
              {
                label: "Planche avant",
                minutes: 4,
                guidance: "3 passages de 40 sec avec 20 sec de repos entre les passages",
                successCue: "bassin aligné",
                restSec: 20,
              },
              {
                label: "Pont fessier",
                minutes: 3,
                guidance: "2 séries de 15 reps avec montée contrôlée et pause d’une seconde en haut",
                successCue: "fessiers engagés",
                restSec: 20,
              },
            ],
          },
          {
            label: "Retour au calme",
            purpose: "faire redescendre proprement",
            successCue: "souffle revenu",
            items: [
              {
                label: "Marche lente",
                minutes: 2,
                guidance: "marche en récupérant le souffle avant de t’arrêter",
                successCue: "fréquence calmée",
              },
              {
                label: "Étirements hanches et mollets",
                minutes: 2,
                guidance: "tiens 30 sec par côté sans forcer",
                successCue: "tension relâchée",
              },
            ],
          },
        ],
      },
    });

    expect(quality).toMatchObject({
      isPremiumReady: true,
      validationPassed: true,
      richnessPassed: true,
      reason: null,
      rejectionReason: null,
      rejectionStage: null,
    });
    expect(quality.stepCount).toBe(3);
    expect(quality.itemCount).toBe(7);
  });

  it("accepts a premium deep work runbook only when the content is concrete and restartable", () => {
    const quality = assessPreparedSessionRunbookQuality({
      preparedRunbook: {
        version: 2,
        protocolType: "deep_work",
        occurrenceId: "occ_4b",
        actionId: "goal_4b",
        dateKey: "2026-04-10",
        title: "Structurer la note produit",
        categoryName: "Travail",
        objective: {
          why: "sortir une avancée visible sur le livrable",
          successDefinition: "une version réutilisable existe à la fin du bloc",
        },
        steps: [
          {
            label: "Ouverture utile",
            purpose: "rentrer dans le bon sous-sujet",
            successCue: "point d’entrée verrouillé",
            items: [
              {
                label: "Rouvrir le plan de note",
                minutes: 3,
                guidance: "relis uniquement la section cible et note le sous-livrable attendu",
                successCue: "sous-livrable choisi",
              },
              {
                label: "Choisir l’ordre d’attaque",
                minutes: 2,
                guidance: "liste les 2 sous-parties à traiter dans l’ordre pour éviter de repartir en vrac",
                successCue: "ordre clair",
              },
            ],
          },
          {
            label: "Production",
            purpose: "faire avancer le coeur du livrable",
            successCue: "matière exploitable créée",
            items: [
              {
                label: "Écrire la section problème",
                minutes: 8,
                guidance: "rédige une première version complète de la section problème avec 3 points maximum",
                successCue: "section complète",
              },
              {
                label: "Rédiger les décisions",
                minutes: 8,
                guidance: "enchaîne directement sur les décisions concrètes à garder ou à couper; si tu bloques, reformule-les d’abord en 3 puces",
                successCue: "décisions formulées",
              },
              {
                label: "Vérifier la trace finale",
                minutes: 4,
                guidance: "contrôle que la note peut être reprise telle quelle plus tard",
                successCue: "trace réutilisable",
              },
            ],
          },
          {
            label: "Clôture",
            purpose: "préparer la reprise",
            successCue: "suite explicite",
            items: [
              {
                label: "Noter le prochain sous-livrable",
                minutes: 3,
                guidance: "écris la prochaine sous-partie à ouvrir et le critère de fin associé pour reprendre sans friction",
                successCue: "reprise prête",
              },
              {
                label: "Nettoyer le contexte de travail",
                minutes: 2,
                guidance: "laisse seulement les documents utiles à la prochaine reprise",
                successCue: "contexte propre",
              },
            ],
          },
        ],
      },
    });

    expect(quality).toMatchObject({
      isPremiumReady: true,
      validationPassed: true,
      richnessPassed: true,
      reason: null,
      rejectionReason: null,
      rejectionStage: null,
    });
    expect(quality.stepCount).toBe(3);
    expect(quality.itemCount).toBe(7);
  });

  it("rejects a generic prepared runbook as non premium-ready", () => {
    const quality = assessPreparedSessionRunbookQuality({
      preparedRunbook: {
        version: 2,
        protocolType: "deep_work",
        occurrenceId: "occ_5",
        actionId: "goal_5",
        dateKey: "2026-04-10",
        title: "Structurer la note produit",
        categoryName: "Travail",
        objective: {
          why: "sortir une note utile",
          successDefinition: "une trace existe",
        },
        steps: [
          {
            label: "Ouverture",
            purpose: "rentrer dans le sujet",
            successCue: "contexte rouvert",
            items: [
              { label: "Rouvre le contexte", minutes: 2, guidance: "remets sous les yeux ce qui sert le bloc" },
              { label: "Premier passage utile", minutes: 2, guidance: "attaque le sujet sans changer de thème" },
            ],
          },
          {
            label: "Bloc principal",
            purpose: "avancer",
            successCue: "avancée visible",
            items: [
              { label: "Passage principal", minutes: 8, guidance: "travaille le coeur du sujet" },
              { label: "Passage critique", minutes: 8, guidance: "continue jusqu’au point utile" },
              { label: "Trace exploitable", minutes: 4, guidance: "laisse quelque chose de réutilisable" },
            ],
          },
          {
            label: "Clôture",
            purpose: "sortir proprement",
            successCue: "suite notée",
            items: [
              { label: "Noter la reprise", minutes: 2, guidance: "écris la suite" },
              { label: "Nettoyer le contexte", minutes: 2, guidance: "range l’essentiel" },
            ],
          },
        ],
      },
    });

    expect(quality.isPremiumReady).toBe(false);
    expect(quality.validationPassed).toBe(true);
    expect(quality.richnessPassed).toBe(false);
    expect(quality.reason).toBe("richness_failed");
    expect(quality.rejectionReason).toBe("richness_failed");
    expect(quality.rejectionStage).toBe("quality_gate");
  });

  it("accepts sport plans with short exercise labels when execution details stay concrete", () => {
    const quality = assessPreparedSessionRunbookQuality({
      preparedRunbook: {
        version: 2,
        protocolType: "sport",
        occurrenceId: "occ_6",
        actionId: "goal_6",
        dateKey: "2026-04-10",
        title: "Bloc cardio court",
        categoryName: "Sport",
        objective: {
          why: "tenir un effort net sans casser la forme",
          successDefinition: "le bloc est fait avec un rythme propre",
        },
        steps: [
          {
            label: "Échauffement",
            purpose: "monter doucement",
            successCue: "corps prêt",
            items: [
              {
                label: "Jog sur place",
                minutes: 2,
                guidance: "alterne 20 sec souples puis 20 sec plus dynamiques pour monter le rythme",
                successCue: "souffle lancé",
              },
              {
                label: "Air squats",
                minutes: 2,
                guidance: "fais 15 reps contrôlées en gardant les appuis propres",
                successCue: "appuis stables",
              },
            ],
          },
          {
            label: "Bloc effort",
            purpose: "tenir le coeur du bloc",
            successCue: "rythme propre",
            items: [
              {
                label: "Pompes",
                minutes: 3,
                guidance: "enchaîne des séries courtes sans casser l’alignement",
                successCue: "gainage tenu",
                execution: { reps: 10, restSec: 20 },
              },
              {
                label: "Burpees",
                minutes: 3,
                guidance: "tiens des répétitions propres plutôt qu’un sprint brouillon",
                successCue: "souffle sous contrôle",
                execution: { reps: 8, restSec: 25 },
              },
              {
                label: "Sprint",
                minutes: 2,
                guidance: "fais 4 efforts de 20 sec avec une vraie récup entre chaque",
                successCue: "relance nette",
                execution: { durationSec: 20, restSec: 25 },
              },
            ],
          },
          {
            label: "Retour au calme",
            purpose: "redescendre proprement",
            successCue: "souffle revenu",
            items: [
              {
                label: "Marche lente",
                minutes: 2,
                guidance: "marche jusqu’à sentir la respiration redescendre",
                successCue: "rythme calmé",
              },
              {
                label: "Étirements",
                minutes: 2,
                guidance: "tiens 30 sec par zone sans forcer pour délier les jambes",
                successCue: "tension relâchée",
              },
            ],
          },
        ],
      },
    });

    expect(quality.isPremiumReady).toBe(true);
    expect(quality.validationPassed).toBe(true);
    expect(quality.richnessPassed).toBe(true);
  });

  it("rejects vague admin runbooks that still look structurally valid", () => {
    const quality = assessPreparedSessionRunbookQuality({
      preparedRunbook: {
        version: 2,
        protocolType: "admin",
        occurrenceId: "occ_7",
        actionId: "goal_7",
        dateKey: "2026-04-10",
        title: "Bloc admin",
        categoryName: "Admin",
        objective: {
          why: "faire avancer l’administratif",
          successDefinition: "quelque chose avance",
        },
        steps: [
          {
            label: "Ouverture",
            purpose: "te mettre dedans",
            successCue: "contexte rouvert",
            items: [
              { label: "Rouvre le contexte", minutes: 2, guidance: "regarde ce qu’il faut faire" },
              { label: "Premier passage utile", minutes: 2, guidance: "commence par ce qui semble utile" },
            ],
          },
          {
            label: "Traitement",
            purpose: "avancer",
            successCue: "quelque chose bouge",
            items: [
              { label: "Passage principal", minutes: 5, guidance: "traite le coeur du sujet" },
              { label: "Passage critique", minutes: 5, guidance: "continue jusqu’au point utile" },
              { label: "Trace exploitable", minutes: 4, guidance: "laisse une trace si possible" },
            ],
          },
          {
            label: "Clôture",
            purpose: "sortir",
            successCue: "suite notée",
            items: [
              { label: "Noter la reprise", minutes: 2, guidance: "écris la suite" },
              { label: "Nettoyer le contexte", minutes: 2, guidance: "range l’essentiel" },
            ],
          },
        ],
      },
    });

    expect(quality.isPremiumReady).toBe(false);
    expect(quality.validationPassed).toBe(true);
    expect(quality.richnessPassed).toBe(false);
    expect(quality.rejectionReason).toBe("richness_failed");
  });

  it("accepts a premium admin runbook when actions, completion, and relaunch cues are concrete", () => {
    const quality = assessPreparedSessionRunbookQuality({
      preparedRunbook: {
        version: 2,
        protocolType: "admin",
        occurrenceId: "occ_7b",
        actionId: "goal_7b",
        dateKey: "2026-04-10",
        title: "Boucler le bloc admin du jour",
        categoryName: "Admin",
        objective: {
          why: "vider les points administratifs qui bloquent la semaine",
          successDefinition: "les documents critiques sont traités ou relancés proprement",
        },
        steps: [
          {
            label: "Ouverture utile",
            purpose: "poser la file exacte",
            successCue: "ordre de traitement clair",
            items: [
              {
                label: "Ouvrir les 3 dossiers à traiter",
                minutes: 3,
                guidance: "mets côte à côte la facture fournisseur, le mail client en attente et le dossier URSSAF pour éviter les allers-retours",
                successCue: "file visible",
              },
              {
                label: "Choisir l’ordre de passage",
                minutes: 2,
                guidance: "attaque d’abord ce qui a une échéance ferme puis note le deuxième dossier à relancer ensuite",
                successCue: "ordre verrouillé",
              },
            ],
          },
          {
            label: "Traitement",
            purpose: "clore les sorties concrètes du bloc",
            successCue: "sorties envoyées ou validées",
            items: [
              {
                label: "Vérifier la facture fournisseur d’avril",
                minutes: 6,
                guidance: "contrôle montant, TVA et IBAN puis marque la facture prête à payer seulement si les 3 points sont cohérents",
                successCue: "facture validée",
                execution: {
                  deliverable: "facture annotée prête à payer",
                  doneWhen: "montant, TVA et IBAN sont validés",
                },
              },
              {
                label: "Envoyer la relance au client Martin",
                minutes: 6,
                guidance: "rédige le mail de relance, joins la facture et envoie-le avant de fermer l’onglet",
                successCue: "mail envoyé",
                execution: {
                  deliverable: "mail de relance envoyé avec pièce jointe",
                  doneWhen: "le mail est parti avec la bonne facture",
                  relaunchCue: "si le client ne répond pas, relance vendredi à 14h",
                },
              },
              {
                label: "Classer le justificatif URSSAF",
                minutes: 4,
                guidance: "range le PDF dans le bon dossier puis note la prochaine pièce attendue pour éviter une recherche plus tard",
                successCue: "pièce classée",
                execution: {
                  doneWhen: "le PDF est rangé au bon endroit",
                  relaunchCue: "la prochaine pièce à demander est notée dans la checklist",
                },
              },
            ],
          },
          {
            label: "Clôture",
            purpose: "laisser une reprise lisible",
            successCue: "suite évidente",
            items: [
              {
                label: "Noter le prochain suivi admin",
                minutes: 2,
                guidance: "écris le prochain point à vérifier et sa date pour ne pas rouvrir tout le contexte demain",
                successCue: "prochaine relance notée",
              },
              {
                label: "Fermer la file proprement",
                minutes: 2,
                guidance: "archive les documents traités et laisse uniquement les éléments utiles à la prochaine action",
                successCue: "bureau propre",
              },
            ],
          },
        ],
      },
    });

    expect(quality.isPremiumReady).toBe(true);
    expect(quality.validationPassed).toBe(true);
    expect(quality.richnessPassed).toBe(true);
    expect(quality.rejectionReason).toBe(null);
  });

  it("derives the current guided item from elapsed seconds", () => {
    const runbook = buildSessionRunbookV1({
      blueprintSnapshot: makeBlueprint(),
      occurrence: { id: "occ_1", goalId: "goal_1", date: "2026-04-10", durationMinutes: 20 },
      action: { id: "goal_1", title: "Séance de sport rapide de 20 minutes" },
      category: { id: "cat_sport", name: "Sport" },
    });

    const idle = deriveGuidedCurrentStep({ sessionRunbook: runbook, elapsedSec: 0 });
    const middle = deriveGuidedCurrentStep({ sessionRunbook: runbook, elapsedSec: 8 * 60 });

    expect(idle.currentStepIndex).toBe(0);
    expect(idle.currentStep.label).toBe("Échauffement");
    expect(idle.currentItem).toBeTruthy();
    expect(idle.currentItemProgress01).toBeGreaterThanOrEqual(0);
    expect(middle.currentStepIndex).toBe(1);
    expect(middle.currentStep.label).toBe("Bloc principal");
    expect(middle.currentItem).toBeTruthy();
    expect(middle.nextItem || null).not.toBe(undefined);
  });

  it("summarizes a runbook patch without exposing runtime-only details", () => {
    const runbook = buildSessionRunbookV1({
      blueprintSnapshot: makeBlueprint(),
      occurrence: { id: "occ_1", goalId: "goal_1", date: "2026-04-10", durationMinutes: 20 },
      action: { id: "goal_1", title: "Séance de sport rapide de 20 minutes" },
      category: { id: "cat_sport", name: "Sport" },
    });

    expect(summarizeSessionRunbookPatch(runbook)).toEqual({
      version: 1,
      stepCount: 3,
      itemCount: expect.any(Number),
    });
  });
});
