import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import CategoryManageInline from "./CategoryManageInline";

describe("CategoryManageInline", () => {
  it("centers the category view on actions before advanced objectives", () => {
    const html = renderToStaticMarkup(
      <CategoryManageInline
        data={{
          categories: [{ id: "c1", name: "Santé", color: "#22c55e", mainGoalId: "o1" }],
          goals: [
            { id: "o1", categoryId: "c1", title: "Courir un 10 km", type: "OUTCOME" },
            { id: "a1", categoryId: "c1", title: "Marcher 20 min", type: "PROCESS", planType: "ANYTIME_EXPECTED" },
          ],
          occurrences: [],
        }}
        setData={() => {}}
        categoryId="c1"
      />
    );

    expect(html).toContain("Les actions vivent d’abord ici.");
    expect(html).toContain("Objectifs avancés (optionnel)");
    expect(html.indexOf(">Actions<")).toBeLessThan(html.indexOf(">Objectifs avancés (optionnel)<"));
  });
});
