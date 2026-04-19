import { describe, expect, it } from "vitest";
import { resolveAuthGateState } from "./authGateModel";

const VERIFIED_SESSION = {
  access_token: "token",
  user: {
    id: "user-1",
    email: "user@example.com",
    email_confirmed_at: "2026-03-23T10:00:00.000Z",
  },
};

describe("authGateModel", () => {
  it("redirige vers signup sans session hors routes auth", () => {
    expect(resolveAuthGateState({ loading: false, pathname: "/", session: null })).toEqual({
      kind: "redirect",
      to: "/auth/signup",
    });
  });

  it("rend la route login sans session", () => {
    expect(resolveAuthGateState({ loading: false, pathname: "/auth/login", session: null })).toEqual({
      kind: "screen",
      screen: "login",
    });
  });

  it("force verify-email si la session n'est pas verifiee", () => {
    expect(
      resolveAuthGateState({
        loading: false,
        pathname: "/",
        session: { access_token: "token", user: { id: "user-1", email: "user@example.com" } },
        emailVerified: false,
      })
    ).toEqual({
      kind: "redirect",
      to: "/auth/verify-email",
    });
  });

  it("sort des routes auth vers onboarding quand le cache first-run indique un flow incomplet", () => {
    expect(
      resolveAuthGateState({
        loading: false,
        pathname: "/auth/login",
        session: VERIFIED_SESSION,
        emailVerified: true,
        firstRunDone: false,
        onboardingCompleted: false,
      })
    ).toEqual({
      kind: "redirect",
      to: "/onboarding",
    });
  });

  it("retombe sur le flag legacy quand firstRun est absent mais onboardingCompleted vaut false", () => {
    expect(
      resolveAuthGateState({
        loading: false,
        pathname: "/auth/login",
        session: VERIFIED_SESSION,
        emailVerified: true,
        firstRunDone: null,
        onboardingCompleted: false,
      })
    ).toEqual({
      kind: "redirect",
      to: "/onboarding",
    });
  });

  it("laisse entrer dans l'app quand session + email verifies", () => {
    expect(
      resolveAuthGateState({
        loading: false,
        pathname: "/",
        session: VERIFIED_SESSION,
        emailVerified: true,
        firstRunDone: true,
        onboardingCompleted: true,
      })
    ).toEqual({
      kind: "app",
    });
  });

  it("ne force pas onboarding quand le cache first-run est inconnu", () => {
    expect(
      resolveAuthGateState({
        loading: false,
        pathname: "/auth/login",
        session: VERIFIED_SESSION,
        emailVerified: true,
        firstRunDone: null,
        onboardingCompleted: null,
      })
    ).toEqual({
      kind: "redirect",
      to: "/",
    });
  });

  it("priorise le flow recovery tant que le mot de passe n'est pas redefine", () => {
    expect(
      resolveAuthGateState({
        loading: false,
        pathname: "/auth/login",
        session: VERIFIED_SESSION,
        emailVerified: true,
        recoveryMode: true,
      })
    ).toEqual({
      kind: "redirect",
      to: "/auth/reset-password",
    });
  });
});
