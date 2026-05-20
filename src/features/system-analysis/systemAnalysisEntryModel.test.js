import { describe, expect, it } from "vitest";
import { buildSystemAnalysisEntryModel } from "./systemAnalysisEntryModel";

describe("buildSystemAnalysisEntryModel", () => {
  it("returns an enabled premium entry when eligible", () => {
    const model = buildSystemAnalysisEntryModel({
      eligibility: { eligible: true, missingRequirements: [] },
    });

    expect(model).toMatchObject({
      visible: true,
      enabled: true,
      state: "available",
      tone: "ai",
      label: "Analyser le système",
      reason: "Analyse premium disponible.",
    });
  });

  it("returns a disabled locked entry with the first missing reason", () => {
    const model = buildSystemAnalysisEntryModel({
      eligibility: {
        eligible: false,
        missingRequirements: [
          { code: "not_enough_planned_blocks", label: "Pas assez de blocs planifiés" },
        ],
      },
    });

    expect(model).toMatchObject({
      visible: true,
      enabled: false,
      state: "locked",
      tone: "ai",
      label: "Analyse système",
      reason: "Pas assez de blocs planifiés",
    });
  });

  it("returns a disabled running entry", () => {
    const model = buildSystemAnalysisEntryModel({
      eligibility: { eligible: true },
      availabilityState: "running",
    });

    expect(model).toMatchObject({
      enabled: false,
      state: "running",
      tone: "ai",
      label: "Analyse en cours…",
    });
  });

  it("returns a disabled AI entry for quota exhaustion", () => {
    const model = buildSystemAnalysisEntryModel({
      eligibility: { eligible: true },
      availabilityState: "quota_exhausted",
    });

    expect(model).toMatchObject({
      enabled: false,
      state: "quota_exhausted",
      tone: "ai",
      label: "Analyse utilisée",
      reason: "Quota mensuel utilisé.",
    });
  });
});
