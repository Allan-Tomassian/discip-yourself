import { describe, expect, it } from "vitest";
import { normalizeUsername, validateUsername } from "./username";

describe("username", () => {
  it("trim + lower correctement", () => {
    expect(normalizeUsername("  Allan_User  ")).toBe("allan_user");
  });

  it("valide le regex attendu", () => {
    expect(validateUsername("ok_user-1").ok).toBe(true);
    expect(validateUsername("bad space").ok).toBe(false);
    expect(validateUsername("ab").ok).toBe(false);
  });
});
