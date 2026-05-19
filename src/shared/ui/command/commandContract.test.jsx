import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  CommandAIBlock,
  CommandBadge,
  CommandCTA,
  CommandErrorState,
  CommandLoadingState,
  CommandStatusSurface,
  CommandSurface,
  normalizeCommandTone,
} from "./index";

const SRC_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function readSrc(relPath) {
  return fs.readFileSync(path.join(SRC_ROOT, relPath), "utf8");
}

describe("command UI primitives", () => {
  it("normalizes tone classes and falls back to neutral", () => {
    expect(normalizeCommandTone("execution")).toBe("execution");
    expect(normalizeCommandTone("ai")).toBe("ai");
    expect(normalizeCommandTone("unknown")).toBe("neutral");

    const html = renderToStaticMarkup(
      <CommandSurface tone="unknown">Surface</CommandSurface>
    );

    expect(html).toContain("CommandSurface--tone-neutral");
    expect(html).toContain('data-command-tone="neutral"');
  });

  it("renders all required state tones without making AI the default", () => {
    const html = renderToStaticMarkup(
      <>
        <CommandBadge tone="execution">Execution</CommandBadge>
        <CommandBadge tone="attention">Attention</CommandBadge>
        <CommandBadge tone="critical">Critical</CommandBadge>
        <CommandBadge tone="disabled">Disabled</CommandBadge>
        <CommandBadge tone="offline">Offline</CommandBadge>
        <CommandAIBlock title="Coach" />
      </>
    );

    expect(html).toContain("CommandBadge--tone-execution");
    expect(html).toContain("CommandBadge--tone-attention");
    expect(html).toContain("CommandBadge--tone-critical");
    expect(html).toContain("CommandBadge--tone-disabled");
    expect(html).toContain("CommandBadge--tone-offline");
    expect(html).toContain("CommandSurface--tone-ai");
  });

  it("keeps primary CTA off-white by default and AI tone opt-in", () => {
    const defaultHtml = renderToStaticMarkup(<CommandCTA>Activer</CommandCTA>);
    const aiHtml = renderToStaticMarkup(<CommandCTA tone="ai">Demander à l’IA</CommandCTA>);
    const css = readSrc("shared/ui/command/command.css");

    expect(defaultHtml).toContain("CommandCTA--primary");
    expect(defaultHtml).toContain('data-command-tone="neutral"');
    expect(defaultHtml).not.toContain("CommandCTA--tone-ai");
    expect(aiHtml).toContain("CommandCTA--tone-ai");
    expect(css).toContain("var(--command-cta-bg)");
    expect(css).not.toContain("var(--accent-primary)");
  });

  it("renders loading and critical recovery command states", () => {
    const loading = renderToStaticMarkup(
      <CommandLoadingState label="SYSTÈME" title="Chargement de ton système…" />
    );
    const error = renderToStaticMarkup(
      <CommandErrorState title="Échec" subtitle="Tu peux réessayer." />
    );
    const status = renderToStaticMarkup(
      <CommandStatusSurface steps={["Analyse", { label: "Synchronisation", status: "complete" }]} />
    );

    expect(loading).toContain("CommandStateScreen");
    expect(loading).toContain("Chargement de ton système");
    expect(error).toContain("CommandErrorState");
    expect(error).toContain("CommandSurface--tone-critical");
    expect(status).toContain("CommandStatusStep--active");
    expect(status).toContain("CommandStatusStep--complete");
  });

  it("wires command primitives into app-level route and error states", () => {
    const app = readSrc("App.jsx");
    const boundary = readSrc("components/ErrorBoundary.jsx");

    expect(app).toContain("CommandLoadingState");
    expect(app).toContain('data-testid="user-data-loading-screen"');
    expect(app).toContain('data-testid="first-run-redirecting-screen"');
    expect(app).not.toContain("<p>Chargement...</p>");
    expect(app).not.toContain("<p>Redirection...</p>");
    expect(boundary).toContain("CommandErrorState");
    expect(boundary).toContain("CommandCTA");
  });
});
