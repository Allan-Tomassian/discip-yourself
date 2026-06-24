import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import Objectives from "./Objectives";

function buildState({ objective = {}, action = null, occurrences = [], sessionHistory = [], activeSession = null } = {}) {
  const goals = [
    {
      id: "out-1",
      type: "OUTCOME",
      categoryId: "cat-1",
      title: "Objectif clé",
      status: "active",
      ...objective,
    },
  ];
  if (action) {
    goals.push({
      id: "act-1",
      type: "PROCESS",
      categoryId: "cat-1",
      parentId: "out-1",
      title: "Action liée",
      status: "active",
      ...action,
    });
  }
  return {
    categories: [{ id: "cat-1", name: "Travail", color: "#30f273" }],
    goals,
    occurrences,
    sessionHistory,
    ui: {
      onboardingCompleted: true,
      selectedDateKey: "2026-04-14",
      selectedDate: "2026-04-14",
      activeSession,
    },
  };
}

function renderObjectives(data) {
  return renderToStaticMarkup(
    <Objectives
      data={data}
      setData={() => {}}
      onOpenCreateAction={() => {}}
      onEditItem={() => {}}
      onOpenSession={() => {}}
      onOpenRecoverySheet={() => {}}
    />
  );
}

describe("Objectives actionability contract", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders one dominant ready CTA for a launchable block", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-14T12:00:00"));

    const html = renderObjectives(
      buildState({
        action: {},
        occurrences: [{ id: "occ-1", goalId: "act-1", date: "2026-04-14", start: "12:00", status: "planned", durationMinutes: 45 }],
      })
    );

    expect(html).toContain("Prêt à démarrer");
    expect(html).toContain("Démarrer");
    expect(html.match(/objective-actionability-cta-/g)).toHaveLength(1);
  });

  it("renders Reprendre for an active linked session", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-14T12:00:00"));

    const html = renderObjectives(
      buildState({
        action: {},
        occurrences: [{ id: "occ-1", goalId: "act-1", date: "2026-04-14", start: "12:00", status: "in_progress", durationMinutes: 45 }],
        activeSession: { occurrenceId: "occ-1", dateKey: "2026-04-14", runtimePhase: "paused", status: "partial" },
      })
    );

    expect(html).toContain("Session en cours");
    expect(html).toContain("Reprendre");
  });

  it("shows future blocks as on track without premature Démarrer", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-14T12:00:00"));

    const html = renderObjectives(
      buildState({
        action: {},
        occurrences: [{ id: "occ-1", goalId: "act-1", date: "2026-04-15", start: "10:00", status: "planned", durationMinutes: 45 }],
      })
    );

    expect(html).toContain("Prochain bloc");
    expect(html).not.toContain("Démarrer");
  });

  it("renders recovery, planning, missing action, and terminal states distinctly", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-14T12:00:00"));

    expect(
      renderObjectives(
        buildState({
          action: {},
          occurrences: [{ id: "occ-1", goalId: "act-1", date: "2026-04-14", start: "09:00", status: "missed", durationMinutes: 45 }],
        })
      )
    ).toContain("Réparer");

    expect(renderObjectives(buildState({ action: {} }))).toContain("Planifier");
    expect(renderObjectives(buildState())).toContain("Ajouter une action");
    expect(renderObjectives(buildState({ objective: { status: "done" } }))).toContain("Terminé");
    expect(renderObjectives(buildState({ objective: { status: "paused" } }))).toContain("En pause");
  });
});
