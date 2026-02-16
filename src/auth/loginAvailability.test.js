import { describe, expect, it } from "vitest";
import { getLoginAvailability } from "./loginAvailability";

describe("getLoginAvailability", () => {
  it("désactive l'envoi si Supabase est absent et expose la raison config", () => {
    const result = getLoginAvailability({
      supabaseReady: false,
      email: "hello@example.com",
      sending: false,
    });

    expect(result.canSend).toBe(false);
    expect(result.reasonKey).toBe("supabase_missing");
    expect(result.reasonMessage).toMatch(/Configuration Supabase manquante/i);
  });

  it("active l'envoi si Supabase est prêt et email valide", () => {
    const result = getLoginAvailability({
      supabaseReady: true,
      email: "hello@example.com",
      sending: false,
    });

    expect(result.canSend).toBe(true);
    expect(result.reasonKey).toBe("");
    expect(result.reasonMessage).toBe("");
  });
});
