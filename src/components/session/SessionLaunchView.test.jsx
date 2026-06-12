import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import SessionLaunchView from "./SessionLaunchView";

describe("SessionLaunchView", () => {
  it("keeps the shared preparation shell for premium session loading", () => {
    const html = renderToStaticMarkup(<SessionLaunchView phase="preparing" title="Focus profond" />);

    expect(html).toContain("session-launch-preparing");
    expect(html).toContain("Préparation du guidage");
    expect(html).toContain("Focus profond");
    expect(html).toContain("Lecture du bloc");
    expect(html).toContain("Construction du prochain geste");
    expect(html).toContain("Tu peux toujours passer en session standard.");
  });

  it("keeps the checking access variant on the same shared shell", () => {
    const html = renderToStaticMarkup(<SessionLaunchView phase="checking_access" title="Focus profond" />);

    expect(html).toContain("session-launch-checking");
    expect(html).toContain("Vérification en cours");
    expect(html).toContain("Focus profond");
    expect(html).toContain("Session standard disponible");
  });
});
