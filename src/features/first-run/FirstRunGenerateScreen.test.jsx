import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import FirstRunGenerateScreen from "./FirstRunGenerateScreen";

describe("FirstRunGenerateScreen", () => {
  it("renders a real premium preparation shell while generation is running", () => {
    const html = renderToStaticMarkup(
      <FirstRunGenerateScreen
        data={{}}
        isLoading
        error={null}
        goalLabel="Relancer le projet principal"
        onBack={() => {}}
        onRetry={() => {}}
      />
    );

    expect(html).toContain("Préparation premium en cours");
    expect(html).toContain("Relancer le projet principal");
    expect(html).toContain("Synthèse de tes signaux utiles.");
    expect(html).toContain("Construction d&#x27;un plan tenable et d&#x27;un plan ambitieux.");
    expect(html).not.toContain("Réessayer");
  });

  it("keeps an honest error state with retry and request reference", () => {
    const html = renderToStaticMarkup(
      <FirstRunGenerateScreen
        data={{}}
        isLoading={false}
        error={{
          code: "INVALID_RESPONSE",
          requestId: "req-first-run-invalid",
        }}
        goalLabel=""
        onBack={() => {}}
        onRetry={() => {}}
      />
    );

    expect(html).toContain("Préparation interrompue");
    expect(html).toContain("Réessayer");
    expect(html).toContain("Référence: req-first-run-invalid");
  });
});
