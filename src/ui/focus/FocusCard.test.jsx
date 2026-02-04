import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import FocusCard from "./FocusCard";

describe("FocusCard", () => {
  it("renders the focus card title", () => {
    const html = renderToStaticMarkup(<FocusCard />);
    expect(html).toContain("Focus du jour");
  });

  it("renders the empty state copy", () => {
    const html = renderToStaticMarkup(<FocusCard />);
    expect(html).toContain("Rien de prévu");
    expect(html).toContain("Démarrer");
  });

  it("renders Démarrer when a current occurrence is provided", () => {
    const occ = { id: "occ-1", goalId: "g1", date: "2026-02-03", start: "16:00", status: "planned" };
    const goalsById = new Map([["g1", { id: "g1", title: "Action" }]]);
    const html = renderToStaticMarkup(<FocusCard focusOccurrence={occ} goalsById={goalsById} />);
    expect(html).toContain("Démarrer");
  });
});
