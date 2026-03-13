import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import CreateV2OutcomeNextAction from "./CreateV2OutcomeNextAction";

describe("CreateV2OutcomeNextAction", () => {
  it("frames the follow-up action as optional and non-blocking", () => {
    const html = renderToStaticMarkup(
      <CreateV2OutcomeNextAction
        data={{
          goals: [{ id: "o1", title: "Mieux dormir", type: "OUTCOME", categoryId: "c1" }],
          ui: { createDraft: { createdOutcomeId: "o1", activeOutcomeId: "o1", category: { mode: "existing", id: "c1" } } },
        }}
        setData={() => {}}
        onDone={() => {}}
        embedded
      />
    );

    expect(html).toContain("Ajouter une action maintenant ?");
    expect(html).toContain("Tu pourras ajouter ou lier une action plus tard.");
    expect(html).not.toContain("sera en brouillon");
  });
});
