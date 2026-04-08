import { describe, expect, it } from "vitest";
import {
  buildUniversalCaptureCoachPrefill,
  resolveUniversalCaptureDecision,
} from "./universalCapture";

describe("resolveUniversalCaptureDecision", () => {
  it("route les intentions concretes vers une action", () => {
    expect(resolveUniversalCaptureDecision("Appeler le dentiste demain")).toMatchObject({
      route: "direct_action",
      normalizedText: "Appeler le dentiste demain",
    });
    expect(resolveUniversalCaptureDecision("Faire 3 séances de sport par semaine")).toMatchObject({
      route: "direct_action",
      normalizedText: "Faire 3 séances de sport par semaine",
    });
  });

  it("route une cible large et unique vers un objectif", () => {
    expect(resolveUniversalCaptureDecision("Lancer la nouvelle page d’accueil")).toMatchObject({
      route: "direct_goal",
      normalizedText: "Lancer la nouvelle page d’accueil",
    });
  });

  it("bascule vers le coach en clarification pour une intention trop vague", () => {
    expect(resolveUniversalCaptureDecision("sport")).toMatchObject({
      route: "coach_clarify",
      normalizedText: "sport",
    });
  });

  it("bascule vers le coach en structuration pour une intention composite", () => {
    expect(
      resolveUniversalCaptureDecision("Je veux mieux manger, reprendre le sport et organiser mes semaines")
    ).toMatchObject({
      route: "coach_structuring",
      normalizedText: "Je veux mieux manger, reprendre le sport et organiser mes semaines",
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
