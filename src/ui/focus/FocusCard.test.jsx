import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import FocusCard from "./FocusCard";

describe("FocusCard", () => {
  it("renders the secondary focus adjustment title", () => {
    const html = renderToStaticMarkup(<FocusCard />);
    expect(html).toContain("Ajuster le focus");
  });

  it("renders the secondary hint instead of a competing start CTA", () => {
    const html = renderToStaticMarkup(<FocusCard />);
    expect(html).toContain("Aucun focus secondaire sélectionné");
    expect(html).toContain("Change le focus seulement si tu veux dévier du plan du jour.");
  });

  it("renders the current focus summary when an occurrence is provided", () => {
    const occ = { id: "occ-1", goalId: "g1", date: "2026-02-03", start: "16:00", status: "planned" };
    const goalsById = new Map([["g1", { id: "g1", title: "Action" }]]);
    const html = renderToStaticMarkup(<FocusCard focusOccurrence={occ} goalsById={goalsById} />);
    expect(html).toContain("Focus actuel");
    expect(html).toContain("Action");
    expect(html).toContain("16:00");
  });
});
