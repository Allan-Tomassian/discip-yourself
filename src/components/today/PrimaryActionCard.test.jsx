import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import PrimaryActionCard from "./PrimaryActionCard";

describe("PrimaryActionCard", () => {
  it("renders the premium next-action surface with a decorative backdrop", () => {
    const html = renderToStaticMarkup(
      <PrimaryActionCard
        label="Prochaine action"
        title="Démarrer le bloc"
        description="Deep work"
        durationLabel="30 min"
        timingLabel="13:00"
        categoryLabel="Travail"
        priorityLabel="Prioritaire"
        primaryLabel="Démarrer"
      />
    );

    expect(html).toContain("Prochaine action");
    expect(html).toContain("Démarrer le bloc");
    expect(html).toContain("Démarrer");
    expect(html).toContain("30 min");
    expect(html).toContain("13:00");
    expect(html).toContain("Travail");
    expect(html).toContain('class="todayPrimaryBackdrop"');
    expect(html).toContain('aria-hidden="true"');
    expect(html).not.toContain("ACTION CRITIQUE");
    expect(html).not.toContain("Action critique");
  });

  it("does not render an empty fallback reason", () => {
    const html = renderToStaticMarkup(
      <PrimaryActionCard
        status="empty"
        title="Construis ton prochain bloc"
        description="Ta journée a un espace libre, mais aucun bloc clair."
        reason=""
        primaryLabel="Créer le bloc avec le Coach IA"
        secondaryLabel="Planning"
        detailLabel="Coach IA"
      />
    );

    expect(html).toContain("Construis ton prochain bloc");
    expect(html).toContain("Ta journée a un espace libre, mais aucun bloc clair.");
    expect(html).toContain("Créer le bloc avec le Coach IA");
    expect(html).not.toContain("Passe par Coach IA");
    expect(html).not.toContain("todayPrimaryReason");
  });
});
