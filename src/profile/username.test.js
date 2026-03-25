import { describe, expect, it } from "vitest";
import { normalizeUsername, validateOptionalUsername, validateUsername } from "./username";

describe("username", () => {
  it("trim + lower correctement", () => {
    expect(normalizeUsername("  Allan_User  ")).toBe("allan_user");
  });

  it("valide le regex attendu", () => {
    expect(validateUsername("ok_user-1").ok).toBe(true);
    expect(validateUsername("bad space").ok).toBe(false);
    expect(validateUsername("ab").ok).toBe(false);
  });

  it("autorise un username vide pour un profil optionnel", () => {
    expect(validateOptionalUsername("").ok).toBe(true);
    expect(validateOptionalUsername("  ").normalized).toBe("");
    expect(validateOptionalUsername("bad space").ok).toBe(false);
  });
});
