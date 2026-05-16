import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import FirstRunGenerateScreen from "./FirstRunGenerateScreen";

describe("FirstRunGenerateScreen", () => {
  it("renders a deterministic system preparation shell while generation is running", () => {
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

    expect(html).toContain("PRÉPARATION");
    expect(html).toContain("Préparation de ton système");
    expect(html).toContain("Relancer le projet principal");
    expect(html).toContain("firstRunSystemChamber");
    expect(html).toContain("Analyse de tes signaux");
    expect(html).toContain("Construction des blocs");
    expect(html).toContain("Organisation des 7 jours");
    expect(html).toContain("Préparation de Today");
    expect(html).toContain("Ne ferme pas l’app.");
    expect(html).not.toContain("Réessayer");
    expect(html).not.toContain("local fallback");
    expect(html).not.toContain("généré par l’IA");
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
    expect(html).toContain("Impossible de finaliser le plan.");
    expect(html).toContain("Le plan préparé n&#x27;a pas pu être validé. Réessaie.");
    expect(html).toContain("Réessayer avec les mêmes signaux");
    expect(html).toContain("Réessayer");
    expect(html).toContain("Référence: req-first-run-invalid");
  });

  it("can show the bounded AI refinement copy without switching to an AI spectacle", () => {
    const html = renderToStaticMarkup(
      <FirstRunGenerateScreen
        data={{}}
        isLoading
        error={null}
        goalLabel="Finir l’application"
        isAiRefining
        onBack={() => {}}
        onRetry={() => {}}
      />
    );

    expect(html).toContain("On affine ton plan à partir de tes signaux.");
    expect(html).toContain("firstRunSystemChamber");
    expect(html).not.toContain("L’IA construit ton système");
  });
});
