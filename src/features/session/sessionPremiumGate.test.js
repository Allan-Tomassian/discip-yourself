import { describe, expect, it } from "vitest";
import {
  buildBoundedPremiumSessionPreview,
  resolveSessionPremiumGateDecision,
} from "./sessionPremiumGate";

describe("sessionPremiumGate", () => {
  it("maps entitlement statuses to launch decisions", () => {
    expect(resolveSessionPremiumGateDecision({ status: "unknown" })).toBe("checking_access");
    expect(resolveSessionPremiumGateDecision({ status: "free" })).toBe("locked_preview");
    expect(resolveSessionPremiumGateDecision({ status: "premium" })).toBe("premium");
    expect(resolveSessionPremiumGateDecision({ status: "founder" })).toBe("premium");
    expect(resolveSessionPremiumGateDecision({ status: "error" })).toBe("access_error");
  });

  it("builds a bounded preview without exposing the full premium plan", () => {
    const preview = buildBoundedPremiumSessionPreview({
      actionTitle: "Bloc sport du soir",
      durationMinutes: 20,
      blueprintSnapshot: {
        protocolType: "sport",
        why: "reprendre un bloc cardio-force net",
        successDefinition: "le circuit est tenu sans casser la forme",
      },
      fallbackRunbook: {
        protocolType: "sport",
        durationMinutes: 20,
        objective: {
          why: "reprendre un bloc cardio-force net",
          successDefinition: "le circuit est tenu sans casser la forme",
        },
        steps: [
          {
            label: "Échauffement",
            purpose: "mettre le corps en route",
            items: [
              {
                label: "Montée en rythme",
                guidance: "augmente doucement l’intensité",
              },
            ],
          },
          {
            label: "Bloc principal",
            purpose: "tenir la partie utile",
            items: [
              {
                label: "Séquence utile",
                guidance: "reste sur le coeur du bloc prévu",
              },
            ],
          },
          {
            label: "Retour au calme",
            purpose: "redescendre proprement",
            items: [
              {
                label: "Respiration finale",
                guidance: "reviens à un souffle stable",
              },
            ],
          },
        ],
      },
    });

    expect(preview.totalDuration).toBe(20);
    expect(preview.steps).toHaveLength(3);
    expect(preview.steps[0]).toMatchObject({
      label: "Échauffement",
      purpose: "mettre le corps en route",
    });
    expect(preview.premiumBenefit).toContain("repères de réussite");
  });
});
