import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import TodayTrajectoryCard from "./TodayTrajectoryCard";

const TRAJECTORY = {
  currentDayIndex: 6,
  completedBlocks: 1,
  todayFrictionCount: 1,
  remainingMinutesToday: 25,
  days: [
    { id: "d1", label: "Ven 15", completionPercent: 25, frictionCount: 0 },
    { id: "d2", label: "Sam 16", completionPercent: 50, frictionCount: 0 },
    { id: "d3", label: "Dim 17", completionPercent: 75, frictionCount: 0 },
    { id: "d4", label: "Lun 18", completionPercent: 55, frictionCount: 0 },
    { id: "d5", label: "Mar 19", completionPercent: 50, frictionCount: 1, hasFriction: true },
    { id: "d6", label: "Mer 20", completionPercent: 100, frictionCount: 0 },
    { id: "d7", label: "Jeu 21", completionPercent: 100, frictionCount: 0, isCurrent: true },
  ],
};

describe("TodayTrajectoryCard", () => {
  it("renders the premium trajectory card without score wording", () => {
    const html = renderToStaticMarkup(<TodayTrajectoryCard trajectory={TRAJECTORY} />);

    expect(html).toContain("Trajectoire du jour");
    expect(html).toContain("Vue 7 derniers jours");
    expect(html).toContain("Un point de blocage demande un ajustement.");
    expect(html).toContain("<svg");
    expect(html).toContain("Aujourd’hui");
    expect(html).toContain("Bloc terminé");
    expect(html).toContain("Point de blocage");
    expect(html).toContain("Restantes");
    expect(html).not.toContain("Discipline score");
    expect(html).not.toContain("Mode exécution");
    expect(html).not.toContain("Tu avances, continue.");
  });

  it("uses calm copy and avoids friction markers when no friction exists", () => {
    const html = renderToStaticMarkup(
      <TodayTrajectoryCard
        trajectory={{
          ...TRAJECTORY,
          todayFrictionCount: 0,
          days: TRAJECTORY.days.map((day) => ({ ...day, frictionCount: 0, hasFriction: false })),
        }}
      />
    );

    expect(html).toContain("Ton système avance aujourd’hui.");
    expect(html).not.toContain("Une friction demande un ajustement.");
    expect(html).not.toContain("Un point de blocage demande un ajustement.");
    expect(html).not.toContain("todayTrajectoryFrictionMarker");
  });
});
