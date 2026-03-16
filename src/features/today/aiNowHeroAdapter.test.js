import { describe, expect, it } from "vitest";
import { deriveTodayHeroChrome, deriveTodayHeroModel } from "./aiNowHeroAdapter";

function buildLocalHero(overrides = {}) {
  return {
    title: "Action locale",
    meta: "Meta locale",
    primaryLabel: "Commencer maintenant",
    primaryAction: {
      kind: "start_occurrence",
      occurrence: { id: "occ_local" },
    },
    secondaryLabel: "Voir progression",
    ...overrides,
  };
}

function buildCoach(intent, overrides = {}) {
  return {
    kind: "now",
    decisionSource: "ai",
    headline: "Titre IA",
    reason: "Raison IA",
    primaryAction: {
      label: "Action IA",
      intent,
      categoryId: "c1",
      actionId: "a1",
      occurrenceId: "occ_1",
      dateKey: "2026-03-13",
    },
    meta: {
      requestId: "req_1",
    },
    ...overrides,
  };
}

describe("deriveTodayHeroModel", () => {
  it("accepte un start_occurrence coherent", () => {
    const result = deriveTodayHeroModel({
      localHero: buildLocalHero(),
      coach: buildCoach("start_occurrence"),
      occurrencesForSelectedDay: [{ id: "occ_1", goalId: "a1" }],
      hasOpenSession: false,
      handlersAvailable: {},
    });

    expect(result.source).toBe("ai");
    expect(result.title).toBe("Titre IA");
    expect(result.primaryAction).toMatchObject({ kind: "start_occurrence" });
  });

  it("accepte un resume_session coherent", () => {
    const result = deriveTodayHeroModel({
      localHero: buildLocalHero(),
      coach: buildCoach("resume_session"),
      occurrencesForSelectedDay: [],
      hasOpenSession: true,
      handlersAvailable: {},
    });

    expect(result.source).toBe("ai");
    expect(result.primaryAction).toMatchObject({ kind: "resume_session" });
  });

  it("accepte open_library si le handler existe", () => {
    const result = deriveTodayHeroModel({
      localHero: buildLocalHero(),
      coach: buildCoach("open_library"),
      occurrencesForSelectedDay: [],
      hasOpenSession: false,
      handlersAvailable: { openLibrary: true, openPilotage: false },
    });

    expect(result.source).toBe("ai");
    expect(result.primaryAction).toMatchObject({ kind: "open_library" });
  });

  it("accepte open_pilotage si le handler existe", () => {
    const result = deriveTodayHeroModel({
      localHero: buildLocalHero(),
      coach: buildCoach("open_pilotage"),
      occurrencesForSelectedDay: [],
      hasOpenSession: false,
      handlersAvailable: { openLibrary: false, openPilotage: true },
    });

    expect(result.source).toBe("ai");
    expect(result.primaryAction).toMatchObject({ kind: "open_pilotage" });
  });

  it("rejette open_today comme CTA principal", () => {
    const result = deriveTodayHeroModel({
      localHero: buildLocalHero(),
      coach: buildCoach("open_today"),
      occurrencesForSelectedDay: [],
      hasOpenSession: false,
      handlersAvailable: { openLibrary: true, openPilotage: true },
    });

    expect(result.source).toBe("local");
    expect(result.title).toBe("Action locale");
  });

  it("retombe sur le hero local si l'occurrence est introuvable", () => {
    const result = deriveTodayHeroModel({
      localHero: buildLocalHero(),
      coach: buildCoach("start_occurrence"),
      occurrencesForSelectedDay: [],
      hasOpenSession: false,
      handlersAvailable: {},
    });

    expect(result.source).toBe("local");
    expect(result.title).toBe("Action locale");
  });

  it("retombe sur le hero local si aucune session n'est ouverte", () => {
    const result = deriveTodayHeroModel({
      localHero: buildLocalHero(),
      coach: buildCoach("resume_session"),
      occurrencesForSelectedDay: [],
      hasOpenSession: false,
      handlersAvailable: {},
    });

    expect(result.source).toBe("local");
    expect(result.title).toBe("Action locale");
  });
});

describe("deriveTodayHeroChrome", () => {
  it("retourne un chrome local sans badge quand le hero reste local", () => {
    const result = deriveTodayHeroChrome({
      heroSource: "local",
      aiNowState: "idle",
    });

    expect(result).toEqual({
      mode: "local",
      showBadge: false,
      badgeLabel: "",
      showHint: false,
      hintText: "",
    });
  });

  it("affiche le badge et le hint pendant le loading IA", () => {
    const result = deriveTodayHeroChrome({
      heroSource: "local",
      aiNowState: "loading",
    });

    expect(result.mode).toBe("loading");
    expect(result.showBadge).toBe(true);
    expect(result.badgeLabel).toBe("Coach IA");
    expect(result.showHint).toBe(true);
    expect(result.hintText).toBe("Prepare la suggestion du moment");
  });

  it("affiche le badge coach quand la suggestion IA est visible", () => {
    const result = deriveTodayHeroChrome({
      heroSource: "ai",
      aiNowState: "success",
    });

    expect(result.mode).toBe("coach");
    expect(result.showBadge).toBe(true);
    expect(result.badgeLabel).toBe("Coach IA");
    expect(result.showHint).toBe(false);
  });

  it("garde le badge coach visible meme si la decision backend vient des rules", () => {
    const result = deriveTodayHeroChrome({
      heroSource: "ai",
      aiNowState: "success",
    });

    expect(result.mode).toBe("coach");
    expect(result.showBadge).toBe(true);
  });
});
