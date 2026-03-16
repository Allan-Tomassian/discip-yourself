import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import PlusExpander from "./PlusExpander";

vi.mock("../ui/portal/Portal", () => ({
  default: ({ children }) => <>{children}</>,
}));

describe("PlusExpander", () => {
  it("keeps action creation primary and demotes advanced goal creation", () => {
    const html = renderToStaticMarkup(
      <PlusExpander
        open
        anchorRect={{ top: 20, left: 20, right: 60, bottom: 40, width: 40, height: 20 }}
        onClose={() => {}}
        onChooseObjective={() => {}}
        onChooseAction={() => {}}
      />
    );

    expect(html).toContain("Créer une action");
    expect(html).toContain("Créer un objectif avancé");
  });
});
