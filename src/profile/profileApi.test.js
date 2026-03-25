import { describe, expect, it } from "vitest";
import { normalizeProfilePayload } from "./profileApi";

describe("profileApi", () => {
  it("autorise un username vide dans les updates de profil", () => {
    expect(
      normalizeProfilePayload("user-1", {
        email: "user@example.com",
        username: "",
        full_name: "Allan",
      })
    ).toEqual({
      id: "user-1",
      email: "user@example.com",
      username: null,
      full_name: "Allan",
    });
  });

  it("normalise un username non vide", () => {
    expect(
      normalizeProfilePayload("user-1", {
        username: " Allan_User ",
      })
    ).toEqual({
      id: "user-1",
      username: "allan_user",
    });
  });

  it("rejette un username invalide", () => {
    expect(() =>
      normalizeProfilePayload("user-1", {
        username: "a",
      })
    ).toThrow("Le nom d'utilisateur doit contenir 3 à 30 caractères.");
  });
});

