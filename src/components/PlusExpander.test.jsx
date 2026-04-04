import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import PlusExpander from "./PlusExpander";

vi.mock("../ui/portal/Portal", () => ({
  default: ({ children }) => <>{children}</>,
}));

describe("PlusExpander", () => {
  it("keeps the simplified V1 launcher labels", () => {
    const html = renderToStaticMarkup(
      <PlusExpander
        open
        anchorRect={{ top: 20, left: 20, right: 60, bottom: 40, width: 40, height: 20 }}
        onClose={() => {}}
        onChooseObjective={() => {}}
        onChooseAction={() => {}}
      />
    );

    expect(html).toContain("Action rapide");
    expect(html).toContain("Objectif");
    expect(html).not.toContain("Structurer avec le Coach");
    expect(html).not.toContain("Reprendre");
  });

  it("shows resume only when a draft exists", () => {
    const html = renderToStaticMarkup(
      <PlusExpander
        open
        anchorRect={{ top: 20, left: 20, right: 60, bottom: 40, width: 40, height: 20 }}
        onClose={() => {}}
        onChooseObjective={() => {}}
        onChooseAction={() => {}}
        onResumeDraft={() => {}}
        hasDraft
      />
    );

    expect(html).toContain("Reprendre");
  });
});
