import { describe, expect, it } from "vitest";
import {
  buildUniversalCaptureCoachPrefill,
  resolveUniversalCaptureDecision,
} from "./universalCapture";

describe("resolveUniversalCaptureDecision", () => {
  it("construit une preview action en haute confiance quand le draft est deterministe", () => {
    expect(
      resolveUniversalCaptureDecision("Appeler le dentiste demain", {
        categoryId: "cat_health",
        categoryLabel: "Santé",
      })
    ).toMatchObject({
      route: "direct_action",
      confidence: "high",
      normalizedText: "Appeler le dentiste demain",
      preview: {
        kind: "action",
        title: "Appeler le dentiste demain",
        categoryId: "cat_health",
        meta: {
          categoryLabel: "Santé",
          dateLabel: "Demain",
        },
        actionDraft: {
          title: "Appeler le dentiste demain",
          categoryId: "cat_health",
          repeat: "none",
        },
      },
    });
  });

  it("garde les actions cadencees hors preview en confiance moyenne", () => {
    expect(resolveUniversalCaptureDecision("Faire 3 séances de sport par semaine")).toMatchObject({
      route: "direct_action",
      confidence: "medium",
      fallbackCoachRoute: "coach_structuring",
      normalizedText: "Faire 3 séances de sport par semaine",
      preview: null,
    });
  });

  it("construit une preview objectif en haute confiance pour une cible unique", () => {
    expect(
      resolveUniversalCaptureDecision("Lancer la nouvelle page d’accueil", {
        categoryId: "cat_business",
        categoryLabel: "Business",
      })
    ).toMatchObject({
      route: "direct_goal",
      confidence: "high",
      normalizedText: "Lancer la nouvelle page d’accueil",
      preview: {
        kind: "goal",
        title: "Lancer la nouvelle page d’accueil",
        categoryId: "cat_business",
        meta: {
          categoryLabel: "Business",
        },
        outcomeDraft: {
          title: "Lancer la nouvelle page d’accueil",
          categoryId: "cat_business",
        },
      },
    });
  });

  it("bascule vers le coach en clarification pour une intention trop vague", () => {
    expect(resolveUniversalCaptureDecision("sport")).toMatchObject({
      route: "coach_clarify",
      confidence: "low",
      normalizedText: "sport",
      preview: null,
    });
  });

  it("bascule vers le coach en structuration pour une intention composite", () => {
    expect(
      resolveUniversalCaptureDecision("Je veux mieux manger, reprendre le sport et organiser mes semaines")
    ).toMatchObject({
      route: "coach_structuring",
      confidence: "low",
      normalizedText: "Je veux mieux manger, reprendre le sport et organiser mes semaines",
      preview: null,
    });
  });

  it("reste conservateur en cas de doute", () => {
    expect(resolveUniversalCaptureDecision("Remettre de l’ordre dans mon activité")).toMatchObject({
      route: "coach_structuring",
    });
    expect(resolveUniversalCaptureDecision("priorités")).toMatchObject({
      route: "coach_clarify",
    });
  });
});

describe("buildUniversalCaptureCoachPrefill", () => {
  it("genere les prefills de clarification et de structuration", () => {
    expect(
      buildUniversalCaptureCoachPrefill({
        route: "coach_clarify",
        text: "sport",
      })
    ).toBe('Aide-moi à clarifier cette intention et à en faire le prochain pas utile : "sport"');

    expect(
      buildUniversalCaptureCoachPrefill({
        route: "coach_structuring",
        text: "Je veux mieux manger, reprendre le sport et organiser mes semaines",
      })
    ).toBe(
      'Aide-moi à structurer ce que je veux faire avancer à partir de cette intention : "Je veux mieux manger, reprendre le sport et organiser mes semaines"'
    );
  });
});
