import { describe, expect, it } from "vitest";
import {
  deriveActionProtocol,
  deriveTodayActionProtocolBrief,
  resolveActionProtocolType,
} from "./actionProtocol";

describe("actionProtocol", () => {
  it("detects deep work from business delivery signals", () => {
    expect(
      resolveActionProtocolType({
        title: "Build onboarding MVP",
        categoryName: "Business",
      })
    ).toBe("deep_work");
  });

  it("keeps writing-heavy delivery work in deep work instead of admin", () => {
    expect(
      resolveActionProtocolType({
        title: "Write onboarding email sequence",
        categoryName: "Business",
      })
    ).toBe("deep_work");
  });

  it("detects sport from title and category cues", () => {
    expect(
      resolveActionProtocolType({
        title: "Gym session upper body",
        categoryName: "Sport",
      })
    ).toBe("sport");
  });

  it("detects admin from friction-removal cues", () => {
    expect(
      resolveActionProtocolType({
        title: "Envoyer la facture client",
        categoryName: "Ops",
      })
    ).toBe("admin");
  });

  it("detects routine from habit-like signals", () => {
    expect(
      resolveActionProtocolType({
        title: "Morning reset",
        categoryName: "Habitudes",
        isHabitLike: true,
      })
    ).toBe("routine");
  });

  it("falls back to generic when signals stay weak", () => {
    expect(
      resolveActionProtocolType({
        title: "Bloc du jour",
        categoryName: "Général",
      })
    ).toBe("generic");
  });

  it("builds a full protocol payload", () => {
    expect(
      deriveActionProtocol({
        title: "Build onboarding MVP",
        categoryName: "Business",
        durationMinutes: 50,
      })
    ).toEqual({
      type: "deep_work",
      why: "avancer sur un levier concret",
      firstStep: "ouvre la première sous-partie précise",
      ifBlocked: "réduis le scope à un sous-livrable",
      successDefinition: "une avancée visible est produite",
    });
  });

  it("builds the compact Today brief for ready state", () => {
    expect(
      deriveTodayActionProtocolBrief({
        protocol: deriveActionProtocol({
          title: "Build onboarding MVP",
          categoryName: "Business",
          durationMinutes: 50,
        }),
        mode: "ready",
      })
    ).toEqual([
      { label: "Cap", text: "avancer sur un levier concret" },
      { label: "Départ", text: "ouvre la première sous-partie précise" },
    ]);
  });

  it("builds the compact Today brief for active session state", () => {
    expect(
      deriveTodayActionProtocolBrief({
        protocol: deriveActionProtocol({
          title: "Gym session upper body",
          categoryName: "Sport",
          durationMinutes: 45,
        }),
        mode: "session",
      })
    ).toEqual([
      { label: "Cap", text: "activer ton énergie et tenir le rythme" },
      { label: "Blocage", text: "fais la version courte" },
    ]);
  });
});
