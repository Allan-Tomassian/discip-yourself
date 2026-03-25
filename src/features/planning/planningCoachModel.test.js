import { describe, expect, it } from "vitest";
import { buildPlanningCoachFallback } from "./planningCoachModel";

function createMaps() {
  const goalsById = new Map([
    ["g1", { id: "g1", title: "Bloc business", categoryId: "c1" }],
    ["g2", { id: "g2", title: "Bloc santé", categoryId: "c2" }],
  ]);
  const categoriesById = new Map([
    ["c1", { id: "c1", name: "Business" }],
    ["c2", { id: "c2", name: "Santé" }],
  ]);
  return { goalsById, categoriesById };
}

describe("planningCoachModel", () => {
  it("retourne semaine vide quand aucune occurrence n'est planifiee", () => {
    const { goalsById, categoriesById } = createMaps();
    const result = buildPlanningCoachFallback({
      selectedDateKey: "2026-03-25",
      activeCategoryId: "c1",
      occurrences: [],
      goalsById,
      categoriesById,
    });

    expect(result.headline).toBe("Semaine vide");
    expect(result.primaryAction?.label).toBe("Ajouter un premier bloc");
  });

  it("retourne journee vide quand la semaine existe mais pas le jour selectionne", () => {
    const { goalsById, categoriesById } = createMaps();
    const result = buildPlanningCoachFallback({
      selectedDateKey: "2026-03-25",
      activeCategoryId: "c1",
      occurrences: [
        { id: "occ-1", goalId: "g1", date: "2026-03-26", status: "planned", durationMinutes: 30 },
      ],
      goalsById,
      categoriesById,
    });

    expect(result.headline).toBe("Journée vide");
    expect(result.suggestedDurationMin).toBe(20);
  });

  it("detecte une charge trop dense au dela de six occurrences", () => {
    const { goalsById, categoriesById } = createMaps();
    const occurrences = Array.from({ length: 7 }, (_, index) => ({
      id: `occ-${index + 1}`,
      goalId: "g1",
      date: "2026-03-25",
      status: "planned",
      durationMinutes: 15,
    }));

    const result = buildPlanningCoachFallback({
      selectedDateKey: "2026-03-25",
      activeCategoryId: "c1",
      occurrences,
      goalsById,
      categoriesById,
    });

    expect(result.headline).toBe("Charge trop dense");
    expect(result.primaryAction?.label).toBe("Déplacer un bloc secondaire");
  });

  it("detecte un desequilibre quand une categorie concentre 80% du temps", () => {
    const { goalsById, categoriesById } = createMaps();
    const result = buildPlanningCoachFallback({
      selectedDateKey: "2026-03-25",
      activeCategoryId: "c1",
      occurrences: [
        { id: "occ-1", goalId: "g1", date: "2026-03-25", status: "planned", durationMinutes: 80 },
        { id: "occ-2", goalId: "g2", date: "2026-03-26", status: "planned", durationMinutes: 20 },
      ],
      goalsById,
      categoriesById,
    });

    expect(result.headline).toContain("Déséquilibre");
    expect(result.reason).toContain("80%");
  });
});
