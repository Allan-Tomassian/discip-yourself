import { describe, expect, it } from "vitest";
import { formatSupabaseAuthError, maskSecret } from "./authDiagnostics";

describe("formatSupabaseAuthError", () => {
  it("inclut status + message quand disponibles", () => {
    const result = formatSupabaseAuthError({ status: 429, message: "Rate limit" });
    expect(result.statusCode).toBe(429);
    expect(result.sourceMessage).toBe("Rate limit");
    expect(result.userMessage).toContain("status 429");
    expect(result.userMessage).toContain("Rate limit");
  });

  it("retourne un diagnostic réseau si status absent", () => {
    const result = formatSupabaseAuthError(new Error("Failed to fetch"));
    expect(result.statusCode).toBeNull();
    expect(result.userMessage).toContain("Failed to fetch");
  });
});

describe("maskSecret", () => {
  it("masque la clé sans l'exposer en clair", () => {
    expect(maskSecret("abcdef123456")).toBe("abcd...3456");
  });
});
